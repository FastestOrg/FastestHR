import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  Trash2,
  Loader2,
  ShieldAlert,
  UserX,
  KeyRound,
  FileSpreadsheet,
  Clock,
  CalendarDays,
  Target,
  MessageSquare,
  HardDrive,
  Laptop,
} from 'lucide-react';
import { toast } from 'sonner';

interface DeleteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    work_email?: string | null;
    employee_code?: string | null;
    user_id?: string | null;
  } | null;
  onDeleted?: () => void;
}

export function DeleteEmployeeDialog({
  open,
  onOpenChange,
  employee,
  onDeleted,
}: DeleteEmployeeDialogProps) {
  const queryClient = useQueryClient();
  const { user, profile } = useAuthStore();
  const [confirmationInput, setConfirmationInput] = useState('');

  const fullName = employee
    ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
    : '';

  const isSelf = !!(employee?.user_id && user?.id && employee.user_id === user.id);
  const isAuthorized =
    profile?.platform_role === 'company_admin' || profile?.platform_role === 'super_admin';

  // Expected confirmation phrase: exact full name or 'DELETE'
  const isConfirmed =
    confirmationInput.trim() === fullName ||
    confirmationInput.trim().toUpperCase() === 'DELETE';

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id) throw new Error('No employee selected');
      if (isSelf) throw new Error('You cannot delete your own Administrator account.');

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('You must be authenticated to perform this action');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-employee`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            employee_id: employee.id,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete employee and account');
      }

      return result;
    },
    onSuccess: (data) => {
      toast.success(data.message || `Employee ${fullName} was completely removed.`);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['leave-history'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['exits'] });
      onOpenChange(false);
      setConfirmationInput('');
      if (onDeleted) {
        onDeleted();
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete employee');
    },
  });

  const handleClose = () => {
    if (!deleteMutation.isPending) {
      setConfirmationInput('');
      onOpenChange(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl border-destructive/30 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden p-0">
        {/* Top Warning Banner */}
        <div className="bg-destructive/15 border-b border-destructive/25 p-6 flex items-start gap-4">
          <div className="p-3 rounded-full bg-destructive/20 text-destructive shrink-0">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-destructive flex items-center gap-2">
              Permanently Delete Employee & Account
            </DialogTitle>
            <DialogDescription className="text-destructive/90 text-sm mt-1">
              This action is <span className="font-bold underline">completely irreversible</span>. All data and portal access will be permanently destroyed.
            </DialogDescription>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Target employee summary card */}
          <div className="p-3.5 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground text-base">{fullName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {employee.work_email || 'No email'} {employee.employee_code && `• ${employee.employee_code}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-mono font-medium">
              <UserX className="h-3.5 w-3.5" /> Full Purge
            </div>
          </div>

          {/* Self Deletion Alert */}
          {isSelf ? (
            <Alert variant="destructive" className="bg-destructive/15 border-destructive/30">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="font-bold">Self-Deletion Blocked</AlertTitle>
              <AlertDescription className="text-xs">
                You are currently logged into this Administrator account. To delete this account, please log in with another Company Administrator account or transfer ownership.
              </AlertDescription>
            </Alert>
          ) : !isAuthorized ? (
            <Alert variant="destructive" className="bg-destructive/15 border-destructive/30">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="font-bold">Unauthorized Action</AlertTitle>
              <AlertDescription className="text-xs">
                Only Company Administrators and Super Administrators have permission to delete an employee completely.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Detailed Itemized Destruction Checklist */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              The following will be permanently erased:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/40 border border-border/40">
                <KeyRound className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Auth Login Account</p>
                  <p className="text-muted-foreground text-[11px]">Purges login credentials & sessions</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/40 border border-border/40">
                <Clock className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Attendance & Shifts</p>
                  <p className="text-muted-foreground text-[11px]">Clock-ins, geofences, and shift allocations</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/40 border border-border/40">
                <CalendarDays className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Leaves & Balances</p>
                  <p className="text-muted-foreground text-[11px]">Leave applications, approvals, & accruals</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/40 border border-border/40">
                <FileSpreadsheet className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Payroll & Payslips</p>
                  <p className="text-muted-foreground text-[11px]">Salary structures and generated payslips</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/40 border border-border/40">
                <Target className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Performance & KPIs</p>
                  <p className="text-muted-foreground text-[11px]">Daily/monthly KPI scores and reviews</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/40 border border-border/40">
                <MessageSquare className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Messages & Bookings</p>
                  <p className="text-muted-foreground text-[11px]">Chat logs, meeting setups, & bookings</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/40 border border-border/40">
                <HardDrive className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Uploaded Documents</p>
                  <p className="text-muted-foreground text-[11px]">Avatars, verification files, & attachments</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/40 border border-border/40">
                <Laptop className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Assigned Devices/Assets</p>
                  <p className="text-muted-foreground text-[11px]">Released back to company inventory</p>
                </div>
              </div>
            </div>
          </div>

          {/* Safety Confirmation Input */}
          {!isSelf && isAuthorized && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <label className="text-xs font-semibold text-foreground block">
                To confirm deletion, type <span className="font-mono font-bold text-destructive select-all">{fullName}</span> or <span className="font-mono font-bold text-destructive select-all">DELETE</span> below:
              </label>
              <Input
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={`Type "${fullName}" or "DELETE"`}
                className="bg-background border-destructive/40 focus-visible:ring-destructive font-mono text-sm"
                autoComplete="off"
                disabled={deleteMutation.isPending}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <DialogFooter className="p-4 bg-muted/20 border-t border-border/50 flex sm:justify-between items-center gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={deleteMutation.isPending}
            className="rounded-full px-5"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={!isConfirmed || isSelf || !isAuthorized || deleteMutation.isPending}
            className="rounded-full px-6 font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-md transition-all"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting All Data...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Permanently Delete Everything
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
