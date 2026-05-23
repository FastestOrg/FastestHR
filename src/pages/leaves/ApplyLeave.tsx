import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CalendarDays, Loader2, Send, Clock, CheckCircle, XCircle, FileText, Upload, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';

interface LeaveType {
  id: string;
  name: string;
  code: string;
  color?: string | null;
  requires_document?: boolean;
}

interface LeaveBalance {
  id: string;
  leave_type_id: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  leave_types?: LeaveType | null;
}

interface RecentLeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: 'pending' | 'approved' | 'rejected';
  leave_types?: { name: string } | null;
}

interface HolidayItem {
  id: string;
  name: string;
  date: string;
}

export default function ApplyLeave() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  const [form, setForm] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    document_url: '',
  });

  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Fetch logged-in employee record
  const { data: employee } = useQuery({
    queryKey: ['my-employee', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, company_id, reporting_manager_id')
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch leave types for the company
  const { data: leaveTypes = [] } = useQuery<LeaveType[]>({
    queryKey: ['leave-types', employee?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_types')
        .select('*')
        .eq('company_id', employee!.company_id)
        .eq('is_active', true)
        .order('name');
      return (data as LeaveType[]) || [];
    },
    enabled: !!employee?.company_id,
  });

  // Fetch leave balances
  const { data: leaveBalances = [], isLoading: loadingBalances } = useQuery<LeaveBalance[]>({
    queryKey: ['leave-balances', employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_balances')
        .select('*, leave_types(name, color, code, requires_document)')
        .eq('employee_id', employee!.id)
        .eq('year', new Date().getFullYear());
      return (data as unknown as LeaveBalance[]) || [];
    },
    enabled: !!employee?.id,
  });

  // Auto-initialize mutation for missing leave balances
  const initBalancesMutation = useMutation({
    mutationFn: async (empId: string) => {
      const { error } = await supabase.rpc('initialize_employee_leave_balances', { emp_id: empId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
    }
  });

  useEffect(() => {
    if (!loadingBalances && leaveBalances.length === 0 && employee?.id) {
      initBalancesMutation.mutate(employee.id);
    }
  }, [loadingBalances, leaveBalances.length, employee?.id, initBalancesMutation]);

  // Fetch recent leave requests
  const { data: myLeaves = [] } = useQuery<RecentLeaveRequest[]>({
    queryKey: ['my-leaves', employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_requests')
        .select('*, leave_types(name)')
        .eq('employee_id', employee!.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return (data as unknown as RecentLeaveRequest[]) || [];
    },
    enabled: !!employee?.id,
  });

  // Fetch company work days
  const { data: companyDetails } = useQuery({
    queryKey: ['company-details', employee?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('work_days')
        .eq('id', employee!.company_id)
        .maybeSingle();
      return data;
    },
    enabled: !!employee?.company_id,
  });

  // Fetch company holidays
  const { data: holidaysList = [] } = useQuery<HolidayItem[]>({
    queryKey: ['company-holidays', employee?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('holidays')
        .select('id, name, date')
        .eq('company_id', employee!.company_id);
      return (data as HolidayItem[]) || [];
    },
    enabled: !!employee?.company_id,
  });

  const getLeaveBreakdown = (startDateStr: string, endDateStr: string) => {
    const breakdown = {
      calendarDays: 0,
      weekends: [] as string[],
      holidays: [] as { date: string; name: string }[],
      netDays: 0,
    };

    if (!startDateStr || !endDateStr) return breakdown;

    const parseLocalDate = (str: string) => {
      const [year, month, day] = str.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    const start = parseLocalDate(startDateStr);
    const end = parseLocalDate(endDateStr);
    if (end < start) return breakdown;

    const activeHolidays = new Map(holidaysList.map(h => [h.date, h.name || 'Company Holiday']));
    const allowedWorkDays = companyDetails?.work_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    const current = new Date(start);
    while (current <= end) {
      breakdown.calendarDays++;
      const dateStr = current.toLocaleDateString('en-CA');
      const weekdayName = current.toLocaleDateString('en-US', { weekday: 'short' });
      
      const isHoliday = activeHolidays.has(dateStr);
      const isWorkday = allowedWorkDays.includes(weekdayName);

      if (isHoliday) {
        breakdown.holidays.push({ date: dateStr, name: activeHolidays.get(dateStr) || 'Holiday' });
      } else if (!isWorkday) {
        breakdown.weekends.push(`${dateStr} (${weekdayName})`);
      } else {
        breakdown.netDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return breakdown;
  };

  const calculateNetLeaveDays = (startDateStr: string, endDateStr: string) => {
    return getLeaveBreakdown(startDateStr, endDateStr).netDays;
  };

  const checkIsLocked = (startDateStr: string) => {
    if (!startDateStr) return false;
    const [year, month, day] = startDateStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);
    const today = new Date();
    
    // Hard Lock: past 30 days is locked
    const diffDays = differenceInDays(today, startDate);
    if (diffDays > 30) return true;
    
    // Month lock: if today is past the 5th of the month, previous month's payroll is closed
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const startMonth = startDate.getMonth();
    const startYear = startDate.getFullYear();
    
    if (startYear < currentYear || (startYear === currentYear && startMonth < currentMonth)) {
      if (today.getDate() > 5) {
        return true;
      }
    }
    
    return false;
  };

  const totalDays = calculateNetLeaveDays(form.start_date, form.end_date);

  const selectedBalance = leaveBalances.find(lb => lb.leave_type_id === form.leave_type_id);
  const remainingDays = selectedBalance 
    ? (selectedBalance.total_days || 0) - (selectedBalance.used_days || 0) - (selectedBalance.pending_days || 0) 
    : 0;
  
  const requiresDoc = selectedBalance?.leave_types?.requires_document && totalDays >= 3;

  // Real-time overlapping request check
  const { data: overlappingRequests = [] } = useQuery<RecentLeaveRequest[]>({
    queryKey: ['overlapping-leaves', employee?.id, form.start_date, form.end_date],
    queryFn: async () => {
      if (!employee?.id || !form.start_date || !form.end_date) return [];
      const { data, error } = await supabase
        .from('leave_requests')
        .select('id, start_date, end_date, leave_types(name)')
        .eq('employee_id', employee.id)
        .in('status', ['approved', 'pending'])
        .lte('start_date', form.end_date)
        .gte('end_date', form.start_date);
      if (error) throw error;
      return (data as unknown as RecentLeaveRequest[]) || [];
    },
    enabled: !!employee?.id && !!form.start_date && !!form.end_date && form.start_date <= form.end_date,
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${employee?.id}/${Date.now()}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('leave-documents')
        .upload(fileName, file, { upsert: true });

      if (error) {
        if (error.message.includes('bucket not found') || error.message.includes('does not exist')) {
          toast.error('Leave documents storage bucket not found. Please upload to a cloud service (e.g. Google Drive) and enter the link directly.');
          setUploadingDoc(false);
          return;
        }
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('leave-documents')
        .getPublicUrl(fileName);

      setForm(prev => ({ ...prev, document_url: publicUrl }));
      toast.success('Supporting document uploaded successfully!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Upload failed: ${msg}`);
    } finally {
      setUploadingDoc(false);
    }
  };

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!employee) throw new Error('Employee record not found.');

      // Check backdated lockout first
      if (checkIsLocked(form.start_date)) {
        throw new Error('Backdated Lockout: Leaves cannot be requested for dates in closed payroll periods.');
      }

      // Check for overlapping approved or pending leave requests
      const { data: overlaps, error: checkError } = await supabase
        .from('leave_requests')
        .select('id, start_date, end_date, leave_types(name)')
        .eq('employee_id', employee.id)
        .in('status', ['approved', 'pending'])
        .lte('start_date', form.end_date)
        .gte('end_date', form.start_date);

      if (checkError) {
        console.error('Error checking overlapping leaves:', checkError);
        throw new Error('Failed to validate leave request overlap. Please try again.');
      }

      if (overlaps && overlaps.length > 0) {
        const overlap = overlaps[0];
        const leaveTypeName = (overlap.leave_types as { name?: string } | null)?.name || 'another request';
        throw new Error(
          `You already have a pending or approved leave request (${leaveTypeName}) from ${overlap.start_date} to ${overlap.end_date} that overlaps with your selected dates.`
        );
      }

      const hasManager = !!employee.reporting_manager_id;
      const tiersObj = {
        tiers: {
          ...(hasManager ? { manager: { status: 'pending', id: employee.reporting_manager_id } } : {}),
          hr: { status: 'pending' }
        }
      };

      const { data, error } = await supabase
        .from('leave_requests')
        .insert([{
          employee_id: employee.id,
          company_id: employee.company_id,
          leave_type_id: form.leave_type_id,
          start_date: form.start_date,
          end_date: form.end_date,
          total_days: totalDays,
          reason: form.reason || null,
          document_url: form.document_url || null,
          status: 'pending' as const,
          rejection_reason: JSON.stringify(tiersObj)
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast.success('Leave request submitted successfully');

      const submittedStart = form.start_date;
      const submittedEnd = form.end_date;

      setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '', document_url: '' });

      try {
        if (employee) {
          let managerUserId: string | null = null;
          if (employee.reporting_manager_id) {
            const { data: mgr } = await supabase
              .from('employees')
              .select('user_id')
              .eq('id', employee.reporting_manager_id)
              .maybeSingle();
            managerUserId = mgr?.user_id || null;
          }

          if (managerUserId) {
            await supabase.from('notifications').insert({
              company_id: employee.company_id,
              user_id: managerUserId,
              type: 'leave_request',
              title: 'New Leave Request Submitted',
              message: `${employee.first_name} ${employee.last_name} has requested leave from ${submittedStart} to ${submittedEnd}.`,
              link: '/leave'
            });
          } else {
            const { data: admins } = await supabase
              .from('profiles')
              .select('id')
              .eq('company_id', employee.company_id)
              .in('platform_role', ['company_admin', 'hr_manager']);

            if (admins && admins.length > 0) {
              const notificationsToInsert = admins.map(adm => ({
                company_id: employee.company_id,
                user_id: adm.id,
                type: 'leave_request',
                title: 'New Leave Request Submitted',
                message: `${employee.first_name} ${employee.last_name} has requested leave from ${submittedStart} to ${submittedEnd}.`,
                link: '/leave'
              }));
              await supabase.from('notifications').insert(notificationsToInsert);
            }
          }
        }
      } catch (notifErr) {
        console.error("Error dispatching leave submission notification:", notifErr);
      }
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to submit leave request';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      toast.error('Please fill all required fields');
      return;
    }
    if (form.end_date < form.start_date) {
      toast.error('End date cannot be before start date');
      return;
    }
    if (checkIsLocked(form.start_date)) {
      toast.error('Backdated Lockout: Leaves cannot be requested for dates in closed payroll periods.');
      return;
    }
    if (totalDays <= 0) {
      toast.error('Leave duration must be at least 1 day');
      return;
    }
    if (selectedBalance && totalDays > remainingDays) {
      toast.error(`Insufficient leave balance. You requested ${totalDays} days, but only have ${remainingDays} days remaining.`);
      return;
    }
    if (requiresDoc && !form.document_url) {
      toast.error(`A supporting document is required for ${selectedBalance?.leave_types?.name} requests of 3 or more days.`);
      return;
    }
    applyMutation.mutate();
  };

  const statusStyle: Record<string, string> = {
    approved: 'border-success text-success bg-success/10',
    rejected: 'border-destructive text-destructive bg-destructive/10',
    pending: 'border-warning text-warning bg-warning/10',
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'approved') return <CheckCircle className="h-4 w-4 text-success" />;
    if (status === 'rejected') return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-warning" />;
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/leave')} className="border border-border/50 rounded-full" aria-label="Go back to leave page">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <CalendarDays className="h-6 w-6" /> Apply for Leave
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Submit a new leave request</p>
        </div>
      </div>

      {/* Leave Balances */}
      {leaveBalances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {leaveBalances.map((lb) => (
            <Card
              key={lb.id}
              className={`cursor-pointer transition-all shadow-sm rounded-xl border ${
                form.leave_type_id === lb.leave_type_id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border/50 bg-card/40 hover:border-primary/50'
              }`}
              onClick={() => setForm((p) => ({ ...p, leave_type_id: lb.leave_type_id }))}
            >
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  {lb.leave_types?.name || 'Leave'}
                </p>
                <p className={`text-2xl font-bold ${form.leave_type_id === lb.leave_type_id ? 'text-primary' : 'text-foreground'}`}>
                  {((lb.total_days || 0) - (lb.used_days || 0) - (lb.pending_days || 0)).toFixed(0)}
                </p>
                <p className="text-xs font-medium text-muted-foreground">of {lb.total_days || 0} remaining</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="overflow-hidden lg:col-span-3 rounded-2xl border border-border/50 shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4 bg-muted/5">
            <CardTitle className="text-base font-bold">New Leave Request</CardTitle>
            <CardDescription className="text-xs">Fill in the details below</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Leave Type <span className="text-destructive">*</span>
                </label>
                <select
                  value={form.leave_type_id}
                  onChange={(e) => setForm((p) => ({ ...p, leave_type_id: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none transition-colors"
                  required
                >
                  <option value="">— Select Leave Type —</option>
                   {leaveTypes.length === 0 ? (
                    <option value="" disabled>
                      {profile?.platform_role === 'company_admin' 
                        ? 'No leave types found. Please add them in Settings.' 
                        : 'No leave types available. Contact your admin.'}
                    </option>
                  ) : (
                    leaveTypes.map((lt) => (
                      <option key={lt.id} value={lt.id}>{lt.name}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    From Date <span className="text-destructive">*</span>
                  </label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} required className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    To Date <span className="text-destructive">*</span>
                  </label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} required min={form.start_date} className="bg-background border-border/50 text-sm h-10 shadow-sm" />
                </div>
              </div>

              {form.start_date && checkIsLocked(form.start_date) && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Lockout Active:</strong> You cannot request leave for this date ({form.start_date}). Leaves for past months are locked once payroll is finalized (after the 5th of the subsequent month) or if the start date is more than 30 days in the past.
                  </div>
                </div>
              )}

              {overlappingRequests && overlappingRequests.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Collision Alert:</strong> You already have a pending or approved leave request ({overlappingRequests[0].leave_types?.name || 'Leave'}) from {overlappingRequests[0].start_date} to {overlappingRequests[0].end_date} that overlaps with your selected dates.
                  </div>
                </div>
              )}

              {totalDays > 0 && (
                <div className="space-y-3">
                  {/* Visual Duration Card */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary flex justify-between items-center shadow-sm">
                    <span>Duration: <strong className="text-base font-bold">{totalDays} working day{totalDays > 1 ? 's' : ''}</strong></span>
                    {selectedBalance && (
                      <span className="text-xs font-semibold">
                        Remaining: <strong className={`text-sm ${remainingDays >= totalDays ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{remainingDays} days</strong>
                      </span>
                    )}
                  </div>

                  {/* Gorgeous Breakdown Details */}
                  {(() => {
                    const breakdown = getLeaveBreakdown(form.start_date, form.end_date);
                    return (
                      <div className="rounded-xl border border-border/40 bg-muted/5 p-4 space-y-3 text-xs">
                        <h4 className="font-semibold text-foreground uppercase tracking-wider text-[10px] text-muted-foreground border-b border-border/20 pb-1.5">Leave Breakdown</h4>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="p-2 rounded-lg bg-muted/30">
                            <p className="text-muted-foreground text-[10px] font-medium">Calendar Days</p>
                            <p className="text-sm font-bold text-foreground mt-0.5">{breakdown.calendarDays}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/30">
                            <p className="text-muted-foreground text-[10px] font-medium">Excluded Days</p>
                            <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">{breakdown.weekends.length + breakdown.holidays.length}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                            <p className="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">Working Days</p>
                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{breakdown.netDays}</p>
                          </div>
                        </div>

                        {/* Holiday Detail List */}
                        {breakdown.holidays.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <p className="font-semibold text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Holidays Excluded ({breakdown.holidays.length})
                            </p>
                            <div className="pl-3 space-y-1 text-muted-foreground text-[11px]">
                              {breakdown.holidays.map((h, i) => (
                                <div key={i} className="flex justify-between">
                                  <span>{h.name}</span>
                                  <span className="font-mono">{h.date}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Weekend Detail List */}
                        {breakdown.weekends.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <p className="font-semibold text-[10px] text-muted-foreground flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground"></span>
                              Weekends Excluded ({breakdown.weekends.length})
                            </p>
                            <div className="pl-3 text-muted-foreground text-[11px] grid grid-cols-2 gap-x-4 gap-y-1">
                              {breakdown.weekends.map((w, i) => (
                                <div key={i} className="font-mono">{w.split(' ')[0]}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {selectedBalance && totalDays > remainingDays && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <div>
                        <strong>Insufficient Balance:</strong> You only have {remainingDays} days remaining for this leave type, but requested {totalDays} days. Please adjust your dates.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Supporting Document Uploader (Conditional) */}
              {requiresDoc && (
                <div className="space-y-3 border border-amber-500/20 bg-amber-500/5 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-2 text-xs text-amber-600 font-medium">
                    <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="uppercase tracking-wider font-bold">Supporting Document Required</p>
                      <p className="text-muted-foreground font-normal mt-0.5">A medical certificate or official proof is required for {selectedBalance?.leave_types?.name || 'this leave type'} of 3 or more days.</p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">Upload File</label>
                      <div className="relative flex items-center justify-center border border-dashed border-border/70 hover:border-primary/50 bg-background h-10 rounded-md cursor-pointer transition-all">
                        <input
                          type="file"
                          onChange={handleFileChange}
                          disabled={uploadingDoc}
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {uploadingDoc ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Upload className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>{uploadingDoc ? 'Uploading...' : 'Choose File (PDF, Image)'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">Or Enter Document URL</label>
                      <Input
                        type="url"
                        placeholder="https://drive.google.com/..."
                        value={form.document_url}
                        onChange={(e) => setForm(p => ({ ...p, document_url: e.target.value }))}
                        className="bg-background border-border/50 text-xs h-10"
                      />
                    </div>
                  </div>

                  {form.document_url && (
                    <div className="text-[10px] text-success font-semibold flex items-center gap-1.5 bg-success/5 px-2.5 py-1.5 rounded border border-success/20 w-fit">
                      <CheckCircle className="h-3 w-3" />
                      <span>Document Attached: <a href={form.document_url} target="_blank" rel="noreferrer" className="underline font-bold truncate max-w-[180px] inline-block align-bottom">View Document</a></span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason / Notes</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  rows={3}
                  placeholder="Optional reason for leave..."
                  className="flex w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none shadow-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate('/leave')}>Cancel</Button>
                <Button 
                  type="submit" 
                  disabled={applyMutation.isPending || uploadingDoc || (overlappingRequests && overlappingRequests.length > 0) || checkIsLocked(form.start_date)} 
                  className="flex-1 gap-2 rounded-xl"
                >
                  {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {applyMutation.isPending ? 'Submitting...' : checkIsLocked(form.start_date) ? 'Locked Period' : (overlappingRequests && overlappingRequests.length > 0) ? 'Overlapping Dates' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden lg:col-span-2 rounded-2xl border border-border/50 shadow-sm bg-card/10">
          <CardHeader className="border-b border-border/50 pb-4 bg-muted/5">
            <CardTitle className="text-sm font-bold">Recent Requests</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {myLeaves.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground mt-1">No requests found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myLeaves.map((leave) => (
                  <div key={leave.id} className="rounded-xl border border-border/50 bg-background/40 p-3 shadow-sm hover:border-primary/20 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={leave.status} />
                        <span className="text-xs font-semibold uppercase">{leave.leave_types?.name || 'Leave'}</span>
                      </div>
                      <Badge variant="outline" className={`uppercase text-[9px] py-0 rounded-full ${statusStyle[leave.status] || ''}`}>
                        {leave.status}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {leave.start_date} → {leave.end_date} · {leave.total_days}d
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
