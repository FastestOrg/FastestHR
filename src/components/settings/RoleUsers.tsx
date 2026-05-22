import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, Trash2, Search, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface RoleUsersProps {
  roleId: string;
  companyId?: string | null;
}

export function RoleUsers({ roleId, companyId }: RoleUsersProps) {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch currently assigned users
  const { data: assignedUsers = [], isLoading: isLoadingAssigned } = useQuery({
    queryKey: ['role-users', roleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          id,
          user_id,
          created_at,
          profiles!inner(id, full_name, avatar_url, platform_role)
        `)
        .eq('role_id', roleId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!roleId,
  });

  // Fetch all company profiles to allow assigning
  const { data: allProfiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['company-profiles', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, platform_role')
        .eq('company_id', companyId)
        .eq('is_active', true);
        
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && open,
  });

  const assignUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: roleId,
          assigned_by: profile?.id,
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('User assigned to role');
      queryClient.invalidateQueries({ queryKey: ['role-users', roleId] });
      setOpen(false);
    },
    onError: (error: any) => {
      if (error.code === '23505') { // Unique violation
        toast.error('User is already assigned to this role');
      } else {
        toast.error(error.message || 'Failed to assign user');
      }
    }
  });

  const revokeUser = useMutation({
    mutationFn: async (userRoleId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', userRoleId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Role revoked successfully');
      queryClient.invalidateQueries({ queryKey: ['role-users', roleId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to revoke role');
    }
  });

  // Filter profiles that are not already assigned to this role, and match search
  const assignedUserIds = assignedUsers.map((u: any) => u.user_id);
  // Optimization: Pre-calculate lowercased search term outside the filter loop
  const searchLower = search.toLowerCase();
  const assignableProfiles = allProfiles
    .filter((p: any) => !assignedUserIds.includes(p.id))
    .filter((p: any) => p.full_name?.toLowerCase().includes(searchLower));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Users with this role</h3>
          <p className="text-sm text-muted-foreground">
            {assignedUsers.length} user{assignedUsers.length !== 1 && 's'} assigned to this role.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Assign User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>Assign Role to User</DialogTitle>
              <DialogDescription>
                Search for an employee to assign this custom role.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                {isLoadingProfiles ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
                ) : assignableProfiles.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {search ? 'No unassigned users found matching your search.' : 'All users are already assigned to this role.'}
                  </div>
                ) : (
                  assignableProfiles.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={p.avatar_url} />
                          <AvatarFallback>{p.full_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{p.platform_role.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => assignUser.mutate(p.id)}
                        disabled={assignUser.isPending}
                      >
                        Assign
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        {isLoadingAssigned ? (
          <div className="p-8 text-center text-muted-foreground animate-pulse">Loading assigned users...</div>
        ) : assignedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/10">
            <Users className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No users assigned yet.</p>
          </div>
        ) : (
          <div className="divide-y">
            {assignedUsers.map((assignment: any) => {
              const user = assignment.profiles;
              return (
                <div key={assignment.id} className="flex items-center justify-between p-4 bg-card hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 border shadow-sm">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {user.full_name?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.full_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] capitalize font-normal px-1.5 rounded-sm">
                          {user.platform_role.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Assigned {new Date(assignment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    aria-label={`Remove ${user.full_name} from role`}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm(`Remove ${user.full_name} from this role?`)) {
                         revokeUser.mutate(assignment.id);
                      }
                    }}
                    disabled={revokeUser.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
