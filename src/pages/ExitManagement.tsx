import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserMinus, ClipboardCheck, DollarSign, MessageSquare, Package, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

const assetChecklist = [
  'Laptop / Desktop',
  'ID Card / Access Card',
  'Company Phone',
  'Parking Pass',
  'Keys / Locks',
  'Credit Card',
  'Uniforms',
  'Books / Documents',
];

const getDaysBetween = (d1Str: string, d2Str: string) => {
  if (!d1Str || !d2Str) return 0;
  const d1 = new Date(d1Str);
  const d2 = new Date(d2Str);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getDaysInMonth = (dateStr: string) => {
  if (!dateStr) return 30;
  const date = new Date(dateStr);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

const getDayOfMonth = (dateStr: string) => {
  if (!dateStr) return 0;
  return new Date(dateStr).getDate();
};

const getCurrencySymbol = (code?: string) => {
  switch (code?.toUpperCase()) {
    case 'INR': return '₹';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'USD':
    default: return '$';
  }
};


// ⚡ Bolt: Hoisted static object configuration outside of component body
// to prevent unnecessary memory reallocation on every render.
const statusColor: Record<string, string> = {
  initiated: 'border-warning text-warning bg-warning/10',
  in_progress: 'border-info text-info bg-info/10',
  completed: 'border-success text-success bg-success/10',
};

export default function ExitManagement() {
  const { profile } = useAuthStore();
  const isAdmin = profile?.platform_role === 'company_admin' || profile?.platform_role === 'super_admin';
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: '', resignation_date: '', last_working_day: '', reason: '' });
  const [selectedExit, setSelectedExit] = useState<string | null>(null);
  const [interviewAnswers, setInterviewAnswers] = useState<string[]>(['', '', '', '']);

  // Fetch Exits
  const { data: exits = [], isLoading: isLoadingExits } = useQuery({
    queryKey: ['exits', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_exits')
        .select(`
          *,
          employees (id, first_name, last_name, employee_code, departments(name))
        `)
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Fetch Active Employees for new exit dropdown

  // ⚡ Bolt: Single-pass aggregation of exit stats to avoid O(N*3) re-calculations on every render
  const exitStats = useMemo(() => {
    let active = 0;
    let completed = 0;
    let pendingSettlements = 0;
    for (const e of exits) {
      if (e.status !== 'completed') active++;
      if (e.status === 'completed') completed++;
      if (!e.settlement_done) pendingSettlements++;
    }
    return { active, completed, pendingSettlements };
  }, [exits]);

  const { data: activeEmployees = [] } = useQuery({
    queryKey: ['activeEmployees', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code, departments(name)')
        .eq('company_id', profile!.company_id!)
        .neq('status', 'terminated')
        .neq('status', 'resigned')
        .is('deleted_at', null)
        .order('first_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id && dialogOpen,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.employee_id) throw new Error('Please select an employee');
      if (!form.resignation_date) throw new Error('Resignation date is required');
      if (!form.last_working_day) throw new Error('Last working day is required');

      const { data, error } = await supabase
        .from('employee_exits')
        .insert({
          company_id: profile!.company_id!,
          employee_id: form.employee_id,
          resignation_date: form.resignation_date,
          last_working_day: form.last_working_day,
          reason: form.reason || null,
          status: 'initiated',
        })
        .select()
        .single();

      if (error) throw error;

      // Update employee status to resigned
      await supabase
        .from('employees')
        .update({ status: 'resigned' })
        .eq('id', form.employee_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exits'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['activeEmployees'] });
      toast.success('Exit process initiated successfully');
      setDialogOpen(false);
      setForm({ employee_id: '', resignation_date: '', last_working_day: '', reason: '' });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to initiate exit');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { data, error } = await supabase
        .from('employee_exits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exits'] });
      toast.success('Exit record updated');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update record')
  });

  const handleCreate = () => {
    createMutation.mutate();
  };

  const getAssetChecks = (exitRecord: any) => {
    if (exitRecord.assets_checklist && Array.isArray(exitRecord.assets_checklist) && exitRecord.assets_checklist.length > 0) {
      return exitRecord.assets_checklist;
    }
    return assetChecklist.map(() => false);
  };

  const toggleAsset = (exitId: string, idx: number, currentList: boolean[]) => {
    const updated = [...currentList];
    updated[idx] = !updated[idx];
    const allReturned = updated.every(Boolean);
    updateMutation.mutate({ 
      id: exitId, 
      updates: { 
        assets_checklist: updated,
        assets_returned: allReturned
      } 
    });
  };

  const submitInterview = (exitId: string) => {
    updateMutation.mutate({
      id: exitId,
      updates: {
        exit_interview: true,
        exit_interview_answers: interviewAnswers
      }
    });
  };

  const selectedRecord = exits.find(e => e.id === selectedExit);

  const [settlementInput, setSettlementInput] = useState({
    baseSalary: 0,
    workingDaysInMonth: 30,
    daysWorked: 0,
    standardNoticeDays: 30,
    noticeServedDays: 0,
    remainingLeaves: 0,
    customBonus: 0,
    customDeduction: 0,
    adjustmentReason: '',
    waiveNoticeRecovery: false,
  });

  // Query salary structure for exit employee
  const { data: salaryStructure } = useQuery({
    queryKey: ['exit-salary-structure', selectedRecord?.employee_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('salary_structures')
        .select('*')
        .eq('employee_id', selectedRecord!.employee_id)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedRecord?.employee_id,
  });

  // Query leave balances for exit employee
  const { data: leaveBalances = [] } = useQuery({
    queryKey: ['exit-leave-balances', selectedRecord?.employee_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_balances')
        .select('*, leave_types(name, color, code)')
        .eq('employee_id', selectedRecord!.employee_id)
        .eq('year', new Date().getFullYear());
      return data || [];
    },
    enabled: !!selectedRecord?.employee_id,
  });

  // Query company profile to fetch dynamic currency setting
  const { data: companyProfile } = useQuery({
    queryKey: ['company-profile', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile!.company_id!)
        .single();
      return data;
    },
    enabled: !!profile?.company_id,
  });

  // Auto-populate settlement calculations when selected exit changes
  useEffect(() => {
    if (selectedRecord) {
      if (selectedRecord.settlement_done && selectedRecord.settlement_summary) {
        const summary = selectedRecord.settlement_summary as any;
        setSettlementInput({
          baseSalary: summary.base_salary || 0,
          workingDaysInMonth: summary.working_days_in_month || 30,
          daysWorked: summary.days_worked || 0,
          standardNoticeDays: summary.standard_notice_days || 30,
          noticeServedDays: summary.notice_served_days || 0,
          remainingLeaves: summary.remaining_leaves || 0,
          customBonus: summary.custom_bonus || 0,
          customDeduction: summary.custom_deduction || 0,
          adjustmentReason: summary.custom_adjustment_reason || '',
          waiveNoticeRecovery: summary.waive_notice_recovery || false,
        });
      } else {
        const annualGross = salaryStructure ? Number(salaryStructure.gross_salary) : 0;
        const monthlySalary = annualGross > 0 ? (annualGross / 12) : 0;
        const daysInMonth = selectedRecord.last_working_day ? getDaysInMonth(selectedRecord.last_working_day) : 30;
        const daysWorked = selectedRecord.last_working_day ? getDayOfMonth(selectedRecord.last_working_day) : 0;
        
        const servedDays = (selectedRecord.resignation_date && selectedRecord.last_working_day)
          ? getDaysBetween(selectedRecord.resignation_date, selectedRecord.last_working_day)
          : 0;
          
        const totalUnusedLeaves = leaveBalances.reduce((acc: number, curr: any) => {
          const remaining = (curr.total_days || 0) - (curr.used_days || 0);
          return acc + Math.max(0, remaining);
        }, 0);

        setSettlementInput({
          baseSalary: Math.round(monthlySalary),
          workingDaysInMonth: daysInMonth,
          daysWorked: daysWorked,
          standardNoticeDays: 30,
          noticeServedDays: servedDays,
          remainingLeaves: totalUnusedLeaves,
          customBonus: 0,
          customDeduction: 0,
          adjustmentReason: '',
          waiveNoticeRecovery: false,
        });
      }
    }
  }, [selectedRecord, salaryStructure, leaveBalances]);

  const handleSaveSettlement = async (exitId: string) => {
    if (!selectedRecord) return;
    
    const toastId = toast.loading("Finalizing offboarding settlement ledgers...");
    
    try {
      const dailySalary = settlementInput.baseSalary / settlementInput.workingDaysInMonth;
      const unpaidSalaryVal = Math.round(dailySalary * settlementInput.daysWorked * 100) / 100;
      
      const noticeShortfall = Math.max(0, settlementInput.standardNoticeDays - settlementInput.noticeServedDays);
      const noticeRecoveryVal = settlementInput.waiveNoticeRecovery 
        ? 0 
        : Math.round(noticeShortfall * dailySalary * 100) / 100;
      
      const leaveEncashmentVal = Math.round(settlementInput.remainingLeaves * dailySalary * 100) / 100;
      
      const netSettlementVal = Math.round(
        (unpaidSalaryVal - noticeRecoveryVal + leaveEncashmentVal + Number(settlementInput.customBonus) - Number(settlementInput.customDeduction)) * 100
      ) / 100;

      const summaryObj = {
        base_salary: settlementInput.baseSalary,
        working_days_in_month: settlementInput.workingDaysInMonth,
        days_worked: settlementInput.daysWorked,
        standard_notice_days: settlementInput.standardNoticeDays,
        notice_served_days: settlementInput.noticeServedDays,
        remaining_leaves: settlementInput.remainingLeaves,
        unpaid_salary: unpaidSalaryVal,
        notice_recovery: noticeRecoveryVal,
        leave_encashment: leaveEncashmentVal,
        custom_bonus: Number(settlementInput.customBonus),
        custom_deduction: Number(settlementInput.customDeduction),
        custom_adjustment_reason: settlementInput.adjustmentReason,
        net_settlement: netSettlementVal,
        daily_salary: Math.round(dailySalary * 100) / 100,
        shortfall_days: noticeShortfall,
        waive_notice_recovery: settlementInput.waiveNoticeRecovery
      };

      // 1. Zero out remaining leave balances
      const { data: activeBalances } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', selectedRecord.employee_id)
        .eq('year', new Date().getFullYear());

      if (activeBalances && activeBalances.length > 0) {
        const upsertData = activeBalances.map(bal => ({
          ...bal,
          used_days: bal.total_days
        }));

        await supabase
          .from('leave_balances')
          .upsert(upsertData);
      }

      // 2. Create offboarding payroll run record
      const resignationDateStr = selectedRecord.resignation_date || new Date().toISOString().split('T')[0];
      const lastWorkingDateStr = selectedRecord.last_working_day || new Date().toISOString().split('T')[0];

      const { data: newRun, error: runError } = await supabase
        .from('payroll_runs')
        .insert({
          company_id: profile!.company_id!,
          period_start: resignationDateStr,
          period_end: lastWorkingDateStr,
          status: 'finalized',
          total_gross: unpaidSalaryVal + leaveEncashmentVal + Number(settlementInput.customBonus),
          total_deductions: noticeRecoveryVal + Number(settlementInput.customDeduction),
          total_net: netSettlementVal,
          processed_by: profile!.id,
          finalized_at: new Date().toISOString()
        })
        .select()
        .single();

      if (runError) throw runError;

      // 3. Create payslip ledger entry
      if (newRun) {
        const breakdownJSON = {
          unpaid_salary: unpaidSalaryVal,
          notice_recovery: noticeRecoveryVal,
          leave_encashment: leaveEncashmentVal,
          custom_bonus: Number(settlementInput.customBonus),
          custom_deduction: Number(settlementInput.customDeduction),
          adjustment_reason: settlementInput.adjustmentReason,
          settlement_type: 'final_offboarding_settlement'
        };

        const { error: payslipError } = await supabase
          .from('payslips')
          .insert({
            payroll_run_id: newRun.id,
            employee_id: selectedRecord.employee_id,
            company_id: profile!.company_id!,
            gross_salary: unpaidSalaryVal + leaveEncashmentVal + Number(settlementInput.customBonus),
            total_deductions: noticeRecoveryVal + Number(settlementInput.customDeduction),
            net_salary: netSettlementVal,
            working_days: settlementInput.workingDaysInMonth,
            paid_days: settlementInput.daysWorked,
            lop_days: 0,
            breakdown: breakdownJSON
          });

        if (payslipError) throw payslipError;
      }

      // 4. Update exit record details and employee status to terminated
      const { error: exitUpdateErr } = await supabase
        .from('employee_exits')
        .update({
          settlement_done: true,
          status: 'completed',
          settlement_summary: summaryObj
        })
        .eq('id', exitId);

      if (exitUpdateErr) throw exitUpdateErr;

      const { error: empUpdateErr } = await supabase
        .from('employees')
        .update({ status: 'terminated' })
        .eq('id', selectedRecord.employee_id);

      if (empUpdateErr) throw empUpdateErr;

      // Invalidate queries to reload details dynamically
      queryClient.invalidateQueries({ queryKey: ['exits'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['activeEmployees'] });
      queryClient.invalidateQueries({ queryKey: ['exit-leave-balances'] });

      toast.success("Offboarding settlement and payslip ledger finalized successfully!", { id: toastId });
    } catch (err: any) {
      console.error("Failed to complete settlement transaction:", err);
      toast.error(err?.message || "Failed to finalize offboarding settlement.", { id: toastId });
    }
  };

  // Set initial interview answers when selection changes
  const handleTabChange = (val: string) => {
    if (val === 'interview' && selectedRecord) {
      const existingAnswers = selectedRecord.exit_interview_answers;
      if (existingAnswers && Array.isArray(existingAnswers) && existingAnswers.length > 0) {
        setInterviewAnswers(existingAnswers as string[]);
      } else {
        setInterviewAnswers(['', '', '', '']);
      }
    }
  };

  const getEmployeeName = (emp: any) => emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown';
  const getDepartmentName = (emp: any) => emp?.departments?.name || 'Unknown Department';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exit Management</h1>
          <p className="text-muted-foreground mt-1">Offboarding, exit interviews & final settlements</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Initiate Exit</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Initiate Employee Exit</DialogTitle>
                <DialogDescription>Start the offboarding process for an active employee</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Employee</Label>
                  <Select value={form.employee_id} onValueChange={(val) => setForm(f => ({ ...f, employee_id: val }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an active employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeEmployees.map((emp: any) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} ({emp.employee_code || 'N/A'}) - {emp.departments?.name || 'No Dept'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Resignation Date</Label>
                    <Input type="date" value={form.resignation_date} onChange={(e) => setForm(f => ({ ...f, resignation_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Working Day</Label>
                    <Input type="date" value={form.last_working_day} onChange={(e) => setForm(f => ({ ...f, last_working_day: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reason for Leaving</Label>
                  <Textarea placeholder="Reason..." rows={2} value={form.reason} onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={createMutation.isPending}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Initiate Exit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <UserMinus className="w-8 h-8 text-warning" />
            <div>
              <p className="text-sm text-muted-foreground">Active Exits</p>
              <p className="text-3xl font-bold text-warning">{exitStats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <ClipboardCheck className="w-8 h-8 text-success" />
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-3xl font-bold text-success">{exitStats.completed}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Pending Settlements</p>
              <p className="text-3xl font-bold text-destructive">{exitStats.pendingSettlements}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Exit List */}
        <Card className="lg:col-span-1 overflow-hidden h-fit">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base">Exit Records</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/50 max-h-[600px] overflow-y-auto">
            {isLoadingExits ? (
              <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : exits.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 px-4">
                <UserMinus className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No exit records</p>
              </div>
            ) : (
              exits.map(exit => (
                <div
                  key={exit.id}
                  className={`p-4 cursor-pointer hover:bg-muted/30 transition-colors ${selectedExit === exit.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                  onClick={() => setSelectedExit(exit.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm">{getEmployeeName(exit.employees)}</h4>
                    <Badge variant="outline" className={`text-[10px] uppercase ${statusColor[exit.status]}`}>{exit.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{getDepartmentName(exit.employees)} • LWD: {exit.last_working_day || 'N/A'}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Detail Panel */}
        <Card className="lg:col-span-2 overflow-hidden h-fit">
          {!selectedRecord ? (
            <CardContent className="flex flex-col items-center gap-2 py-16">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Select an exit record to view details</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{getEmployeeName(selectedRecord.employees)}</span>
                  {selectedRecord.status !== 'completed' && selectedRecord.assets_returned && selectedRecord.exit_interview && (
                     <Button size="sm" variant="outline" className="h-7 text-xs border-success/50 text-success hover:bg-success hover:text-success-foreground" onClick={() => updateMutation.mutate({id: selectedRecord.id, updates: {status: 'in_progress'}})}>Mark In Progress</Button>
                  )}
                </CardTitle>
                <CardDescription>{getDepartmentName(selectedRecord.employees)} • Resigned: {selectedRecord.resignation_date || 'N/A'}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="overview" onValueChange={handleTabChange}>
                  <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="assets">Asset Return</TabsTrigger>
                    <TabsTrigger value="interview">Exit Interview</TabsTrigger>
                    <TabsTrigger value="settlement">Settlement</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="p-6 space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded border border-border/50 bg-background/50">
                        <p className="text-xs text-muted-foreground uppercase">Resignation Date</p>
                        <p className="font-medium text-sm mt-1">{selectedRecord.resignation_date || '—'}</p>
                      </div>
                      <div className="p-3 rounded border border-border/50 bg-background/50">
                        <p className="text-xs text-muted-foreground uppercase">Last Working Day</p>
                        <p className="font-medium text-sm mt-1">{selectedRecord.last_working_day || '—'}</p>
                      </div>
                    </div>
                    <div className="p-3 rounded border border-border/50 bg-background/50">
                      <p className="text-xs text-muted-foreground uppercase">Reason for Leaving</p>
                      <p className="text-sm mt-1">{selectedRecord.reason || 'Not specified'}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <Badge variant="outline" className={selectedRecord.exit_interview ? 'border-success text-success bg-success/10' : 'border-muted text-muted-foreground'}>
                        <MessageSquare className="w-3 h-3 mr-1" /> Exit Interview {selectedRecord.exit_interview ? '✓' : '—'}
                      </Badge>
                      <Badge variant="outline" className={selectedRecord.assets_returned ? 'border-success text-success bg-success/10' : 'border-muted text-muted-foreground'}>
                        <Package className="w-3 h-3 mr-1" /> Assets {selectedRecord.assets_returned ? '✓' : '—'}
                      </Badge>
                      <Badge variant="outline" className={selectedRecord.settlement_done ? 'border-success text-success bg-success/10' : 'border-muted text-muted-foreground'}>
                        <DollarSign className="w-3 h-3 mr-1" /> Settlement {selectedRecord.settlement_done ? '✓' : '—'}
                      </Badge>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="assets" className="p-6 mt-0">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium">Asset Return Checklist</h4>
                      {selectedRecord.assets_returned && <Badge variant="outline" className="border-success text-success bg-success/10">All Returned</Badge>}
                    </div>
                    <div className="space-y-3">
                      {assetChecklist.map((item, idx) => {
                        const checks = getAssetChecks(selectedRecord);
                        return (
                          <div key={item} className="flex items-center gap-3 p-2 rounded border border-border/30 hover:bg-muted/20 cursor-pointer" onClick={() => toggleAsset(selectedRecord.id, idx, checks)}>
                            {updateMutation.isPending && updateMutation.variables?.updates?.assets_checklist !== undefined ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <Checkbox checked={checks[idx] || false} />
                            )}
                            <span className={`text-sm select-none ${checks[idx] ? 'line-through text-muted-foreground' : ''}`}>{item}</span>
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="interview" className="p-6 space-y-4 mt-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Exit Interview Form</h4>
                      {selectedRecord.exit_interview && <Badge variant="outline" className="border-success text-success bg-success/10">Completed</Badge>}
                    </div>
                    <div className="space-y-4">
                      {['What did you enjoy most about working here?', 'What could we improve as an organization?', 'Would you recommend this company to others?', 'Any suggestions for your successor?'].map((q, i) => (
                        <div key={i} className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{q}</Label>
                          <Textarea 
                            placeholder="Your response..." 
                            rows={2} 
                            className="text-sm resize-y" 
                            disabled={selectedRecord.exit_interview}
                            value={interviewAnswers[i] || ''}
                            onChange={(e) => {
                              const newAns = [...interviewAnswers];
                              newAns[i] = e.target.value;
                              setInterviewAnswers(newAns);
                            }}
                          />
                        </div>
                      ))}
                      {!selectedRecord.exit_interview && (
                        <Button size="sm" onClick={() => submitInterview(selectedRecord.id)} disabled={updateMutation.isPending}>
                          {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Submit Interview
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="settlement" className="p-6 space-y-6 mt-0">
                    <div className="flex items-center justify-between border-b border-border/50 pb-4">
                      <div>
                        <h4 className="text-base font-semibold">Final Settlement Summary</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">Calculate unpaid dues, notice recovery, and leave balances.</p>
                      </div>
                      {selectedRecord.settlement_done ? (
                        <Badge className="border-success text-success bg-success/10 text-xs font-semibold px-2.5 py-1">
                          Settlement Finalized ✓
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-warning text-warning bg-warning/10 text-xs font-semibold px-2.5 py-1">
                          Draft Settlement
                        </Badge>
                      )}
                    </div>

                    {/* Dynamic Calculations Panel */}
                    {(() => {
                      const currency = companyProfile?.currency || 'USD';
                      const symbol = getCurrencySymbol(currency);
                      
                      const formatCurrency = (val: number) => {
                        return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      };

                      const baseSalary = Number(settlementInput.baseSalary) || 0;
                      const workingDaysInMonth = Number(settlementInput.workingDaysInMonth) || 30;
                      const daysWorked = Number(settlementInput.daysWorked) || 0;
                      const standardNoticeDays = Number(settlementInput.standardNoticeDays) || 30;
                      const noticeServedDays = Number(settlementInput.noticeServedDays) || 0;
                      const remainingLeaves = Number(settlementInput.remainingLeaves) || 0;
                      const customBonus = Number(settlementInput.customBonus) || 0;
                      const customDeduction = Number(settlementInput.customDeduction) || 0;
                      const waiveNoticeRecovery = !!settlementInput.waiveNoticeRecovery;

                      const dailySalary = workingDaysInMonth > 0 ? (baseSalary / workingDaysInMonth) : 0;
                      const unpaidSalaryVal = dailySalary * daysWorked;
                      const shortfallDays = Math.max(0, standardNoticeDays - noticeServedDays);
                      const noticeRecoveryVal = waiveNoticeRecovery ? 0 : shortfallDays * dailySalary;
                      const leaveEncashmentVal = remainingLeaves * dailySalary;

                      const totalEarnings = unpaidSalaryVal + leaveEncashmentVal + customBonus;
                      const totalDeductions = noticeRecoveryVal + customDeduction;
                      const netSettlementVal = totalEarnings - totalDeductions;

                      return (
                        <div className="space-y-6">
                          {/* If not finalized, display input form for Admin */}
                          {!selectedRecord.settlement_done && isAdmin ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-lg border border-border/50">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Monthly Gross Salary ({symbol})</Label>
                                <Input
                                  type="number"
                                  className="h-9 text-sm"
                                  value={settlementInput.baseSalary || ''}
                                  onChange={(e) => setSettlementInput(prev => ({ ...prev, baseSalary: Number(e.target.value) }))}
                                />
                                {!salaryStructure && (
                                  <p className="text-[10px] text-warning flex items-center gap-1 mt-1">
                                    <AlertTriangle className="w-3 h-3" /> No profile salary structure; manual entry required.
                                  </p>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Days in Final Month</Label>
                                <Input
                                  type="number"
                                  className="h-9 text-sm"
                                  value={settlementInput.workingDaysInMonth || ''}
                                  onChange={(e) => setSettlementInput(prev => ({ ...prev, workingDaysInMonth: Number(e.target.value) }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Days Worked in Final Month</Label>
                                <Input
                                  type="number"
                                  className="h-9 text-sm"
                                  value={settlementInput.daysWorked || ''}
                                  onChange={(e) => setSettlementInput(prev => ({ ...prev, daysWorked: Number(e.target.value) }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Standard Notice (Days)</Label>
                                <Input
                                  type="number"
                                  className="h-9 text-sm"
                                  value={settlementInput.standardNoticeDays || ''}
                                  onChange={(e) => setSettlementInput(prev => ({ ...prev, standardNoticeDays: Number(e.target.value) }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Notice Served (Days)</Label>
                                <Input
                                  type="number"
                                  className="h-9 text-sm"
                                  value={settlementInput.noticeServedDays || ''}
                                  onChange={(e) => setSettlementInput(prev => ({ ...prev, noticeServedDays: Number(e.target.value) }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Leaves to Encash</Label>
                                <Input
                                  type="number"
                                  className="h-9 text-sm"
                                  value={settlementInput.remainingLeaves || 0}
                                  onChange={(e) => setSettlementInput(prev => ({ ...prev, remainingLeaves: Number(e.target.value) }))}
                                />
                              </div>
                              <div className="space-y-1.5 flex flex-col justify-end pb-1.5">
                                <div className="flex items-center space-x-2 h-9">
                                  <Checkbox
                                    id="waiveNotice"
                                    checked={settlementInput.waiveNoticeRecovery}
                                    onCheckedChange={(checked) => setSettlementInput(prev => ({ ...prev, waiveNoticeRecovery: !!checked }))}
                                  />
                                  <Label htmlFor="waiveNotice" className="text-xs font-semibold text-warning cursor-pointer select-none">
                                    Waive Notice Recovery
                                  </Label>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Custom Bonus ({symbol})</Label>
                                <Input
                                  type="number"
                                  className="h-9 text-sm"
                                  placeholder="0.00"
                                  value={settlementInput.customBonus || ''}
                                  onChange={(e) => setSettlementInput(prev => ({ ...prev, customBonus: Number(e.target.value) }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Custom Deduction ({symbol})</Label>
                                <Input
                                  type="number"
                                  className="h-9 text-sm"
                                  placeholder="0.00"
                                  value={settlementInput.customDeduction || ''}
                                  onChange={(e) => setSettlementInput(prev => ({ ...prev, customDeduction: Number(e.target.value) }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Adjustment Reason</Label>
                                <Input
                                  type="text"
                                  className="h-9 text-sm"
                                  placeholder="e.g. Gratuity, asset claim"
                                  value={settlementInput.adjustmentReason || ''}
                                  onChange={(e) => setSettlementInput(prev => ({ ...prev, adjustmentReason: e.target.value }))}
                                />
                              </div>
                            </div>
                          ) : null}

                          {/* Payslip/Settlement Side-by-Side Sheet View */}
                          <div className="grid md:grid-cols-2 gap-6">
                            {/* Earnings Column */}
                            <div className="p-5 rounded-xl border border-success/20 bg-success/5 shadow-sm">
                              <h5 className="font-semibold text-sm text-success mb-4 flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Earnings & Allowances
                              </h5>
                              <div className="space-y-3 text-sm">
                                <div className="flex justify-between border-b border-border/30 pb-2">
                                  <span className="text-muted-foreground">Unpaid Salary ({daysWorked} days worked)</span>
                                  <span className="font-medium text-foreground">{formatCurrency(unpaidSalaryVal)}</span>
                                </div>
                                <div className="flex justify-between border-b border-border/30 pb-2">
                                  <span className="text-muted-foreground">Leave Encashment ({remainingLeaves} days)</span>
                                  <span className="font-medium text-foreground">{formatCurrency(leaveEncashmentVal)}</span>
                                </div>
                                {customBonus > 0 && (
                                  <div className="flex justify-between border-b border-border/30 pb-2 text-success">
                                    <span>Custom Bonus ({settlementInput.adjustmentReason || 'Bonus'})</span>
                                    <span className="font-semibold">+{formatCurrency(customBonus)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-bold pt-2 text-success text-base">
                                  <span>Total Earnings</span>
                                  <span>{formatCurrency(totalEarnings)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Deductions Column */}
                            <div className="p-5 rounded-xl border border-destructive/20 bg-destructive/5 shadow-sm">
                              <h5 className="font-semibold text-sm text-destructive mb-4 flex items-center gap-2">
                                <UserMinus className="w-4 h-4" /> Recoveries & Deductions
                              </h5>
                              <div className="space-y-3 text-sm">
                                <div className="flex justify-between border-b border-border/30 pb-2">
                                  <span className="text-muted-foreground flex items-center gap-1.5">
                                    Notice Shortfall Recovery ({shortfallDays} days shortfall)
                                    {waiveNoticeRecovery && (
                                      <Badge variant="outline" className="border-warning/30 text-warning bg-warning/5 text-[10px] font-medium py-0 px-1.5 leading-none h-4">
                                        Waived
                                      </Badge>
                                    )}
                                  </span>
                                  <span className="font-medium text-foreground">{formatCurrency(noticeRecoveryVal)}</span>
                                </div>
                                {customDeduction > 0 && (
                                  <div className="flex justify-between border-b border-border/30 pb-2 text-destructive">
                                    <span>Custom Claim / Damage ({settlementInput.adjustmentReason || 'Deduction'})</span>
                                    <span className="font-semibold">-{formatCurrency(customDeduction)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-bold pt-2 text-destructive text-base">
                                  <span>Total Deductions</span>
                                  <span>{formatCurrency(totalDeductions)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Final Net Summary Card */}
                          <div className={`p-6 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 ${
                            netSettlementVal >= 0 
                              ? 'border-success/30 bg-gradient-to-r from-success/10 to-transparent' 
                              : 'border-destructive/30 bg-gradient-to-r from-destructive/10 to-transparent'
                          }`}>
                            <div className="space-y-1">
                              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Net Settlement Amount</p>
                              <h3 className={`text-3xl font-extrabold ${netSettlementVal >= 0 ? 'text-success' : 'text-destructive'}`}>
                                {formatCurrency(netSettlementVal)}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {netSettlementVal >= 0 
                                  ? 'This amount is payable to the employee.' 
                                  : 'This amount is recoverable from the employee.'}
                              </p>
                            </div>
                            
                            {!selectedRecord.settlement_done && isAdmin && (
                              <Button 
                                size="lg" 
                                className="font-semibold px-6 shadow-md transition-all duration-200 hover:scale-102"
                                onClick={() => handleSaveSettlement(selectedRecord.id)} 
                                disabled={updateMutation.isPending}
                              >
                                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Finalize & Process Settlement
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
