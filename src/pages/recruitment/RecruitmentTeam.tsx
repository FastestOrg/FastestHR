import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, UserPlus, Shield, UserCheck, Activity, Loader2,
  MoreVertical, UserX, RefreshCw, Crown, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { InviteHRUserDialog } from '@/components/recruitment/InviteHRUserDialog';

interface TeamMember {
  id: string;
  full_name: string;
  platform_role: string;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  managerName?: string;
  activeLeads?: number;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  hr_manager: { label: 'HR Manager', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: Crown },
  recruiter: { label: 'Recruiter', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: UserCheck },
  company_admin: { label: 'Admin', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Shield },
};

export function RecruitmentTeam() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  // Fetch company info for licence data
  const { data: company } = useQuery({
    queryKey: ['company-info', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('license_limit, name')
        .eq('id', profile!.company_id!)
        .single();
      return data;
    },
    enabled: !!profile?.company_id,
  });

  // Fetch all HR team members
  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['recruitment-team', profile?.company_id],
    queryFn: async () => {
      const { data: members } = await (supabase as any)
        .from('profiles')
        .select('id, full_name, platform_role, manager_id, is_active, created_at')
        .eq('company_id', profile!.company_id!)
        .in('platform_role', ['recruiter', 'hr_manager', 'company_admin'])
        .order('platform_role')
        .order('full_name');

      if (!members || members.length === 0) return [];

      // ⚡ Bolt: Batch fetch managers to avoid N+1 queries while retaining fast DB-level counts
      const managerIds = [...new Set(members.map((m: any) => m.manager_id).filter(Boolean))];

      const [managersRes, ...countsRes] = await Promise.all([
        managerIds.length > 0
          ? (supabase as any).from('profiles').select('id, full_name').in('id', managerIds)
          : Promise.resolve({ data: [] }),
        ...members.map((m: any) =>
          (supabase as any)
            .from('candidates')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', m.id)
            .neq('stage', 'rejected')
        )
      ]);

      const managerMap = new Map(
        (managersRes.data || []).map((m: any) => [m.id, m.full_name])
      );

      return members.map((m: any, index: number) => ({
        ...m,
        managerName: m.manager_id ? managerMap.get(m.manager_id) : undefined,
        activeLeads: countsRes[index].count || 0
      })) as TeamMember[];
    },
    enabled: !!profile?.company_id,
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitment-team'] });
      toast.success('User deactivated');
    },
    onError: () => toast.error('Failed to deactivate user'),
  });

  const { data: usedLicences = 0 } = useQuery({
    queryKey: ['used-seats', profile?.company_id],
    queryFn: async () => {
      const { count } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile!.company_id!)
        .eq('status', 'active')
        .is('deleted_at', null);
      return count || 0;
    },
    enabled: !!profile?.company_id,
  });

  const activeMembers = teamMembers.filter((m) => m.is_active);
  const totalLicences = company?.license_limit || 5;
  const licencePercent = Math.min((usedLicences / Math.max(totalLicences, 1)) * 100, 100);

  const managers = teamMembers.filter((m) => m.platform_role === 'hr_manager' && m.is_active);
  const recruiters = teamMembers.filter((m) => m.platform_role === 'recruiter' && m.is_active);

  // ⚡ BOLT OPTIMIZATION: Calculate recruiter groupings in a single pass instead of O(N*M) filters in render
  const { recruitersByManager, unassignedRecruiters } = useMemo(() => {
    const byManager: Record<string, any[]> = {};
    const unassigned: any[] = [];
    for (const r of recruiters) {
      if (r.manager_id) {
        if (!byManager[r.manager_id]) byManager[r.manager_id] = [];
        byManager[r.manager_id].push(r);
      } else {
        unassigned.push(r);
      }
    }
    return { recruitersByManager: byManager, unassignedRecruiters: unassigned };
  }, [recruiters]);


  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const canManage = ['company_admin', 'hr_manager'].includes(profile?.platform_role || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Licence Widget */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Licence Widget */}
        <Card className="md:col-span-1 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Licence Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-3xl font-bold text-foreground">{usedLicences}</span>
              <span className="text-muted-foreground text-sm mb-1">/ {totalLicences} seats</span>
            </div>
            <Progress
              value={licencePercent}
              className={`h-2 ${licencePercent >= 90 ? '[&>div]:bg-red-500' : licencePercent >= 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-primary'}`}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {totalLicences - usedLicences} seat{totalLicences - usedLicences !== 1 ? 's' : ''} remaining
            </p>
          </CardContent>
        </Card>

        {/* Team Summary */}
        <Card className="bg-background/50 border-border/50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-400">{managers.length}</p>
                <p className="text-xs text-muted-foreground mt-1">HR Managers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">{recruiters.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Recruiters</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        {canManage && (
          <Card className="bg-background/50 border-border/50 flex flex-col items-center justify-center gap-3 p-6">
            <UserPlus className="h-8 w-8 text-primary/40" />
            <p className="text-sm text-muted-foreground text-center">Add recruiters or HR managers to your team</p>
            <Button
              onClick={() => setShowInviteDialog(true)}
              disabled={usedLicences >= totalLicences}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Invite Team Member
            </Button>
          </Card>
        )}
      </div>

      {/* Hierarchy View: Managers → Recruiters */}
      {managers.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Team Hierarchy
          </h3>
          <div className="space-y-3">
            {managers.map((manager) => {
              // ⚡ BOLT OPTIMIZATION: O(1) lookup instead of O(N) filter inside map
              const reports = recruitersByManager[manager.id] || [];
              return (
                <Card key={manager.id} className="bg-background/50 border-border/50">
                  <CardContent className="p-4">
                    {/* Manager row */}
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-9 w-9 border-2 border-purple-500/30">
                        <AvatarFallback className="bg-purple-500/10 text-purple-400 text-xs font-bold">
                          {getInitials(manager.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground">{manager.full_name}</p>
                        <Badge className={`text-[10px] px-1.5 py-0 ${ROLE_CONFIG.hr_manager.color}`}>
                          HR Manager
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{manager.activeLeads} active leads</p>
                      </div>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Manager actions" title="Manager actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-red-400"
                              onClick={() => deactivateMutation.mutate(manager.id)}
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {/* Recruiter reports */}
                    {reports.length > 0 && (
                      <div className="ml-6 border-l border-border/40 pl-4 space-y-2">
                        {reports.map((recruiter) => (
                          <div key={recruiter.id} className="flex items-center gap-3">
                            <ChevronRight className="h-3 w-3 text-muted-foreground/40 -ml-1 flex-shrink-0" />
                            <Avatar className="h-7 w-7 border border-blue-500/20">
                              <AvatarFallback className="bg-blue-500/10 text-blue-400 text-[10px] font-bold">
                                {getInitials(recruiter.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground">{recruiter.full_name}</p>
                            </div>
                            <Badge className={`text-[10px] px-1.5 py-0 ${ROLE_CONFIG.recruiter.color}`}>
                              Recruiter
                            </Badge>
                            <p className="text-xs text-muted-foreground min-w-[60px] text-right">
                              {recruiter.activeLeads} leads
                            </p>
                            {canManage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Recruiter actions" title="Recruiter actions">
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-red-400"
                                    onClick={() => deactivateMutation.mutate(recruiter.id)}
                                  >
                                    <UserX className="h-4 w-4 mr-2" />
                                    Deactivate
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {reports.length === 0 && (
                      <p className="ml-6 text-xs text-muted-foreground/50 pl-4 border-l border-border/30">
                        No recruiters assigned yet
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Unassigned recruiters */}
      {unassignedRecruiters.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Unassigned Recruiters
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unassignedRecruiters.map((recruiter) => (
              <Card key={recruiter.id} className="bg-background/50 border-border/50 border-dashed">
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-500/10 text-blue-400 text-xs">
                      {getInitials(recruiter.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{recruiter.full_name}</p>
                    <p className="text-xs text-muted-foreground">{recruiter.activeLeads} active leads</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {teamMembers.length === 0 && (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground">No HR team members yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Invite recruiters and managers to get started</p>
        </div>
      )}

      <InviteHRUserDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        usedLicences={usedLicences}
        totalLicences={totalLicences}
      />
    </div>
  );
}
