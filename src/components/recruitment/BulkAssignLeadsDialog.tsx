import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BulkAssignLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: string[];
  leadNames: string[];
  jobId?: string;
  onSuccess?: () => void;
}

export function BulkAssignLeadsDialog({
  open,
  onOpenChange,
  leadIds,
  leadNames,
  jobId,
  onSuccess,
}: BulkAssignLeadsDialogProps) {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedRecruiter, setSelectedRecruiter] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch recruiters (and hr_managers) visible under this user
  const { data: recruiters = [], isLoading: loadingRecruiters } = useQuery({
    queryKey: ['recruiters', profile?.company_id, profile?.id],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, full_name, platform_role, manager_id')
        .eq('company_id', profile!.company_id!)
        .eq('is_active', true)
        .in('platform_role', ['recruiter', 'hr_manager'])
        .order('full_name');

      // If current user is an HR Manager, only show their direct reports
      if (profile?.platform_role === 'hr_manager') {
        query = query.eq('manager_id', profile.id);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!profile?.company_id && open,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const assigneeId = selectedRecruiter === 'unassigned' || !selectedRecruiter ? null : selectedRecruiter;
      const { error } = await supabase
        .from('candidates')
        .update({
          assigned_to: assigneeId,
          assigned_by: profile!.id,
          assigned_at: new Date().toISOString(),
          recruiter_notes: notes || null,
        })
        .in('id', leadIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-board', profile?.company_id] });
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: ['candidates', jobId] });
      }
      toast.success(`${leadIds.length} candidate${leadIds.length !== 1 ? 's' : ''} assigned successfully`);
      onSuccess?.();
      onOpenChange(false);
      setNotes('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to assign candidates');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecruiter) {
      toast.error('Please select a recruiter');
      return;
    }
    mutation.mutate();
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const selectedRecruiterData = recruiters.find((r: any) => r.id === selectedRecruiter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Bulk Assign Candidates
          </DialogTitle>
          <DialogDescription>
            Assign <strong>{leadIds.length} candidate{leadIds.length !== 1 ? 's' : ''}</strong> to a team member.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 border rounded-lg p-3 my-2">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Users className="h-3 w-3" />
            Selected Candidates
          </div>
          <ScrollArea className="h-[80px]">
            <div className="flex flex-wrap gap-1.5">
              {leadNames.map((name, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] font-normal py-0 px-2 h-5 bg-background border-border/50">
                  {name}
                </Badge>
              ))}
            </div>
          </ScrollArea>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-assign-recruiter">Assign To</Label>
            <Select
              value={selectedRecruiter}
              onValueChange={setSelectedRecruiter}
              disabled={mutation.isPending || loadingRecruiters}
            >
              <SelectTrigger id="bulk-assign-recruiter" className="h-10">
                <SelectValue placeholder={loadingRecruiters ? 'Loading...' : 'Select recruiter'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {recruiters.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                          {getInitials(r.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{r.full_name}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto capitalize">
                        {r.platform_role.replace('_', ' ')}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRecruiterData && (
              <p className="text-xs text-muted-foreground">
                Assigning {leadIds.length} leads to <strong>{selectedRecruiterData.full_name}</strong>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-assign-notes">Notes for Recruiter (optional)</Label>
            <Textarea
              id="bulk-assign-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any context or instructions for the recruiter..."
              rows={3}
              disabled={mutation.isPending}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mutation.isPending ? 'Assigning...' : 'Assign Leads'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
