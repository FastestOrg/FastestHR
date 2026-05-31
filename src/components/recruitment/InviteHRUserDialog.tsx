import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus, AlertCircle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface InviteHRUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usedLicences: number;
  totalLicences: number;
}

export function InviteHRUserDialog({
  open,
  onOpenChange,
  usedLicences,
  totalLicences,
}: InviteHRUserDialogProps) {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    employeeId: '',
    email: '',
    role: 'recruiter' as 'recruiter' | 'hr_manager',
    managerId: '',
  });
  const [openSelector, setOpenSelector] = useState(false);

  const licenceFull = usedLicences >= totalLicences;

  // Fetch Employees for selection
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees-for-invite', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, work_email, user_id')
        .eq('company_id', profile!.company_id!)
        .is('deleted_at', null)
        .order('first_name');
      return data || [];
    },
    enabled: !!profile?.company_id && open,
  });

  // Fetch HR Managers for the manager selector
  const { data: hrManagers = [] } = useQuery({
    queryKey: ['hr-managers', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', profile!.company_id!)
        .eq('platform_role', 'hr_manager')
        .eq('is_active', true)
        .order('full_name');
      return data || [];
    },
    enabled: !!profile?.company_id && open,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error('No company');
      if (licenceFull) throw new Error('Licence limit reached');

      const selectedEmployee = employees.find(e => e.id === formData.employeeId);
      if (!selectedEmployee) throw new Error('Please select an employee');

      const email = selectedEmployee.work_email;
      if (!email) throw new Error('Selected employee has no work email');

      // If employee already has a user_id, just update their profile
      if (selectedEmployee.user_id) {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ 
            platform_role: formData.role, 
            manager_id: formData.managerId || null 
          })
          .eq('id', selectedEmployee.user_id);
        
        if (updateErr) throw updateErr;
        return { existing: true, email };
      }

      // 1. Create invitation in DB
      const { data: invitation, error: invErr } = await supabase
        .from('invitations')
        .insert({
          company_id: profile.company_id,
          email: email.trim().toLowerCase(),
          invited_by: profile.id,
        })
        .select()
        .single();

      if (invErr) throw invErr;

      // 2. Send magic link via Supabase Auth
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            company_id: profile.company_id,
            platform_role: formData.role,
            manager_id: formData.managerId || null,
            full_name: `${selectedEmployee.first_name} ${selectedEmployee.last_name}`
          }
        },
      });

      if (otpErr) throw otpErr;
      return { invitation, email };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['recruitment-team', profile?.company_id] });
      toast.success(data.existing ? `Role updated for ${data.email}` : `Invitation sent to ${data.email}`);
      setFormData({ employeeId: '', email: '', role: 'recruiter', managerId: '' });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send invitation');
    },
  });

  const employeeDict = useMemo(() => {
    return employees.reduce((acc: any, emp: any) => {
      acc[emp.id] = emp;
      return acc;
    }, {});
  }, [employees]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId) {
      toast.error('Please select an employee');
      return;
    }
    if (formData.role === 'recruiter' && !formData.managerId && hrManagers.length > 0) {
      toast.error('Please assign a manager for this recruiter');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite HR Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to add a Recruiter or HR Manager to your team.
          </DialogDescription>
        </DialogHeader>

        {licenceFull && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Licence limit reached ({usedLicences}/{totalLicences}). Upgrade your plan to add more users.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2 flex flex-col">
            <Label htmlFor="employee-select">Select Employee *</Label>
            <Popover open={openSelector} onOpenChange={setOpenSelector}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openSelector}
                  className="w-full justify-between bg-background"
                  disabled={mutation.isPending || licenceFull || loadingEmployees}
                >
                  {formData.employeeId
                    ? `${employeeDict[formData.employeeId]?.first_name || ''} ${employeeDict[formData.employeeId]?.last_name || ''}`
                    : "Select employee..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Search employee..." />
                  <CommandEmpty>No employee found.</CommandEmpty>
                  <CommandGroup className="max-h-60 overflow-y-auto">
                    {employees.map((employee) => (
                      <CommandItem
                        key={employee.id}
                        value={`${employee.first_name} ${employee.last_name}`}
                        onSelect={() => {
                          setFormData({ 
                            ...formData, 
                            employeeId: employee.id,
                            email: employee.work_email || ''
                          });
                          setOpenSelector(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.employeeId === employee.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{employee.first_name} {employee.last_name}</span>
                          <span className="text-xs text-muted-foreground">{employee.work_email}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            {formData.email && (
              <p className="text-xs text-muted-foreground mt-1 px-1">
                Will be invited as: <span className="font-medium text-foreground">{formData.email}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(v) => setFormData({ ...formData, role: v as any, managerId: '' })}
              disabled={mutation.isPending || licenceFull}
            >
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recruiter">Recruiter</SelectItem>
                <SelectItem value="hr_manager">HR Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.role === 'recruiter' && (
            <div className="space-y-2">
              <Label htmlFor="invite-manager">Reporting Manager</Label>
              <Select
                value={formData.managerId}
                onValueChange={(v) => setFormData({ ...formData, managerId: v })}
                disabled={mutation.isPending || licenceFull}
              >
                <SelectTrigger id="invite-manager">
                  <SelectValue placeholder="Select manager (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {hrManagers.length === 0 ? (
                    <SelectItem value="none" disabled>No HR Managers yet</SelectItem>
                  ) : (
                    hrManagers.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || licenceFull}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mutation.isPending ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
