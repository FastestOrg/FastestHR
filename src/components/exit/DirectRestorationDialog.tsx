import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  UserCheck,
  Building2,
  Mail,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';

export interface DirectRestorationEmployee {
  id: string;
  first_name: string;
  last_name: string;
  work_email?: string | null;
  personal_email?: string | null;
  employee_code?: string | null;
  status?: string | null;
  deleted_at?: string | null;
  departments?: { name: string } | null;
  designations?: { title: string } | null;
}

interface DirectRestorationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: DirectRestorationEmployee | null;
  exitId?: string | null;
  onRestored?: () => void;
}

export function DirectRestorationDialog({
  open,
  onOpenChange,
  employee,
  exitId,
  onRestored,
}: DirectRestorationDialogProps) {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  const isAdmin =
    profile?.platform_role === 'company_admin' ||
    profile?.platform_role === 'super_admin' ||
    profile?.platform_role === 'hr_manager';

  const fullName = employee
    ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Employee'
    : '';

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id) throw new Error('No employee selected for restoration');
      if (!isAdmin) {
        throw new Error('Access denied: Direct Restoration requires administrator privileges.');
      }

      // 1. Update employee back to active and clear deleted_at soft-deletion flag
      const { error: empError } = await supabase
        .from('employees')
        .update({
          status: 'active',
          deleted_at: null,
        })
        .eq('id', employee.id);

      if (empError) throw empError;

      // 2. Remove any associated employee_exit records to clear offboarding lock
      if (exitId) {
        const { error: exitErr } = await supabase
          .from('employee_exits')
          .delete()
          .eq('id', exitId);
        if (exitErr) console.warn('Could not remove specific exit record:', exitErr);
      } else {
        const { error: exitErr } = await supabase
          .from('employee_exits')
          .delete()
          .eq('employee_id', employee.id);
        if (exitErr) console.warn('Could not remove exit records for employee:', exitErr);
      }

      // 3. Insert audit log entry if table is available
      try {
        if (profile?.company_id && profile?.id) {
          await supabase.from('audit_logs').insert({
            company_id: profile.company_id,
            user_id: profile.id,
            action: 'employee.direct_restoration',
            details: {
              employee_id: employee.id,
              employee_name: fullName,
              restored_by: profile.id,
              restored_at: new Date().toISOString(),
            },
          });
        }
      } catch (auditErr) {
        console.warn('Audit logging skipped or failed:', auditErr);
      }

      return true;
    },
    onSuccess: () => {
      // Invalidate all related caches to immediately reflect in UI
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['exits'] });
      queryClient.invalidateQueries({ queryKey: ['activeEmployees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', employee?.id] });
      queryClient.invalidateQueries({ queryKey: ['managers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['org-chart'] });
      queryClient.invalidateQueries({ queryKey: ['new-hires'] });

      toast.success(
        `Direct Restoration Complete: ${fullName} has been reactivated and restored to Active status!`,
        { duration: 5000 }
      );

      onOpenChange(false);
      onRestored?.();
    },
    onError: (err: any) => {
      console.error('Failed to restore employee:', err);
      toast.error(err?.message || 'Failed to restore employee. Please try again.');
    },
  });

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <RotateCcw className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg">Direct Restoration: Reactivate Employee</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            This administrator action immediately reinstates a terminated or offboarded employee back into active organization records.
          </DialogDescription>
        </DialogHeader>

        {/* Employee Summary Card */}
        <div className="p-3.5 rounded-lg border border-border/60 bg-muted/30 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 border border-border/50">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                {(employee.first_name?.[0] || 'E') + (employee.last_name?.[0] || '')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-foreground truncate">{fullName}</p>
                <Badge variant="outline" className="text-[10px] uppercase bg-destructive/10 text-destructive border-destructive/30">
                  {employee.status || 'Terminated'}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                {employee.employee_code && (
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3 text-muted-foreground/60" />
                    {employee.employee_code}
                  </span>
                )}
                {employee.departments?.name && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-muted-foreground/60" />
                    {employee.departments.name}
                  </span>
                )}
                {(employee.work_email || employee.personal_email) && (
                  <span className="flex items-center gap-1 truncate max-w-[180px]">
                    <Mail className="h-3 w-3 text-muted-foreground/60" />
                    {employee.work_email || employee.personal_email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Restoration Impact Checklist */}
        <div className="space-y-2 py-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Restoration Actions to be executed:
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2.5 p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <p className="font-medium">Status Reset to Active</p>
                <p className="text-[11px] text-muted-foreground">
                  Clears the <code className="bg-muted px-1 py-0.5 rounded text-[10px]">deleted_at</code> soft-deletion timestamp and sets employee status to <span className="font-semibold text-emerald-600 dark:text-emerald-400">active</span>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <p className="font-medium">Exit & Offboarding Clearance</p>
                <p className="text-[11px] text-muted-foreground">
                  Cancels and purges the exit record lock in Exit Management, returning them to the active roster.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <p className="font-medium">Roster & Directory Reinstatement</p>
                <p className="text-[11px] text-muted-foreground">
                  The employee will immediately appear on the organization chart, active employee list, and payroll calculation radars.
                </p>
              </div>
            </div>
          </div>
        </div>

        {!isAdmin && (
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 flex items-center gap-2 text-destructive text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>Only Company Administrators and HR Managers can perform direct restoration.</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={restoreMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
            onClick={() => restoreMutation.mutate()}
            disabled={restoreMutation.isPending || !isAdmin}
          >
            {restoreMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Restoring Employee...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                Restore to Active Status
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
