import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, DollarSign, FileText, Activity, Plus, Percent, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const DEFAULT_COMPENSATION: CompensationStructure = {
  basic_pay: 50,
  dearness_allowance: 10,
  house_rental: 20,
  conveyance_allowance: 5,
  special_allowance: 10,
  medical_insurance: 5,
};

interface CompensationStructure {
  basic_pay: number;
  dearness_allowance: number;
  house_rental: number;
  conveyance_allowance: number;
  special_allowance: number;
  medical_insurance: number;
}

const COMP_LABELS: { key: keyof CompensationStructure; label: string; variable: string }[] = [
  { key: 'basic_pay', label: 'Basic Pay', variable: '{{Basic Pay Percent}}' },
  { key: 'dearness_allowance', label: 'Dearness Allowance', variable: '{{DA Percent}}' },
  { key: 'house_rental', label: 'House Rental Allowance', variable: '{{HRA Percent}}' },
  { key: 'conveyance_allowance', label: 'Conveyance Allowance', variable: '{{Conveyance Percent}}' },
  { key: 'special_allowance', label: 'Special Allowance', variable: '{{Special Allowance Percent}}' },
  { key: 'medical_insurance', label: 'Medical Insurance', variable: '{{Medical Insurance Percent}}' },
];

// ⚡ Bolt: Hoisted static object configuration outside of component body
// to prevent unnecessary memory reallocation on every render.
const statusColor: Record<string, string> = {
  draft: 'border-muted text-muted-foreground',
  processing: 'border-warning text-warning bg-warning/10',
  review: 'border-info text-info bg-info/10',
  finalized: 'border-success text-success bg-success/10',
  paid: 'border-info text-info bg-info/10',
};

export default function Payroll() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = profile?.platform_role === 'company_admin' || profile?.platform_role === 'super_admin';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const { data: payrollRuns = [], isLoading: loadingRuns } = useQuery({
    queryKey: ['payroll-runs', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('period_end', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: isAdmin && !!profile?.company_id,
  });

  const { data: employee } = useQuery({
    queryKey: ['my-employee', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data } = await supabase.from('employees').select('id, company_id').eq('user_id', profile.id).is('deleted_at', null).maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: payslips = [], isLoading: loadingPayslips } = useQuery({
    queryKey: ['payslips', employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('payslips')
        .select('*, payroll_runs(period_start, period_end, status)')
        .eq('employee_id', employee!.id)
        .order('created_at', { ascending: false })
        .limit(12);
      return data || [];
    },
    enabled: !!employee?.id,
  });

  const { data: salaryStructure } = useQuery({
    queryKey: ['salary-structure', employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('salary_structures')
        .select('*')
        .eq('employee_id', employee!.id)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!employee?.id,
  });

  const runPayrollMutation = useMutation({
    mutationFn: async () => {
      if (!periodStart || !periodEnd) throw new Error('Select period dates');
      // Create payroll run
      const { data: run, error: runError } = await supabase.from('payroll_runs').insert([{
        company_id: profile!.company_id!,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'processing' as any,
        processed_by: profile!.id,
      }]).select().single();
      if (runError) throw runError;

      // Get all employees with salary structures
      const { data: structures } = await supabase
        .from('salary_structures')
        .select('*, employees(id, first_name, last_name)')
        .eq('company_id', profile!.company_id!);

      if (structures && structures.length > 0) {
        const payslipInserts = structures.map((s: any) => ({
          payroll_run_id: run.id,
          employee_id: s.employee_id,
          company_id: profile!.company_id!,
          gross_salary: s.gross_salary || 0,
          total_deductions: Math.round((s.gross_salary || 0) * 0.2 * 100) / 100,
          net_salary: Math.round((s.gross_salary || 0) * 0.8 * 100) / 100,
          working_days: 22,
          paid_days: 22,
          breakdown: { components: s.components || [] },
        }));

        const { error: slipError } = await supabase.from('payslips').insert(payslipInserts);
        if (slipError) throw slipError;

        // Update run totals
        const totalGross = payslipInserts.reduce((s, p) => s + p.gross_salary, 0);
        const totalDed = payslipInserts.reduce((s, p) => s + p.total_deductions, 0);
        const totalNet = payslipInserts.reduce((s, p) => s + p.net_salary, 0);
        await supabase.from('payroll_runs').update({
          total_gross: totalGross,
          total_deductions: totalDed,
          total_net: totalNet,
          status: 'finalized' as any,
          finalized_at: new Date().toISOString(),
        }).eq('id', run.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['payslips'] });
      toast.success('Payroll processed successfully');
      setDialogOpen(false);
      setPeriodStart('');
      setPeriodEnd('');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to run payroll'),
  });

  // ── Compensation Structure ──
  const [compStructure, setCompStructure] = useState<CompensationStructure>({ ...DEFAULT_COMPENSATION });

  const { data: companyCompStructure, isLoading: loadingCompStructure } = useQuery({
    queryKey: ['compensation-structure', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('compensation_structure')
        .eq('id', profile!.company_id!)
        .single();
      return (data as any)?.compensation_structure as CompensationStructure | null;
    },
    enabled: isAdmin && !!profile?.company_id,
  });

  useEffect(() => {
    if (companyCompStructure) {
      setCompStructure({ ...DEFAULT_COMPENSATION, ...companyCompStructure });
    }
  }, [companyCompStructure]);

  const compTotal = Object.values(compStructure).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const isCompValid = Math.abs(compTotal - 100) < 0.01;

  const saveCompMutation = useMutation({
    mutationFn: async () => {
      if (!isCompValid) throw new Error('Total must equal 100%');
      const { error } = await supabase.from('companies').update({
        compensation_structure: compStructure,
      } as any).eq('id', profile!.company_id!).select('id');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compensation-structure'] });
      toast.success('Compensation structure saved');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to save'),
  });

  const handleCompChange = (key: keyof CompensationStructure, value: string) => {
    setCompStructure(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Engine</h1>
          <p className="text-muted-foreground mt-1">Salary processing & payslips</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto gap-2 border-primary text-primary hover:bg-primary/10 h-9 px-3">
                <Activity className="h-4 w-4" /> Run Payroll Cycle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Run Payroll Cycle</DialogTitle>
                <DialogDescription>Process salaries for a payroll period. This will generate payslips for all employees with salary structures.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Period Start</Label>
                    <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Period End</Label>
                    <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => runPayrollMutation.mutate()} disabled={runPayrollMutation.isPending || !periodStart || !periodEnd}>
                  {runPayrollMutation.isPending ? 'Processing...' : 'Run Payroll'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" /> {isAdmin ? 'Recent Payroll Runs' : 'My Salary Structure'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isAdmin ? (
              loadingRuns ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : payrollRuns.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <DollarSign className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No payroll runs yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payrollRuns.map((run: any) => (
                    <div key={run.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-background/40 border border-border/50 gap-3">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{run.period_start} — {run.period_end}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Gross: ${(run.total_gross || 0).toLocaleString()} · Net: ${(run.total_net || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 justify-end w-full sm:w-auto border-t border-border/10 pt-2 sm:pt-0 sm:border-none">
                        <Badge variant="outline" className={`uppercase text-[9px] ${statusColor[run.status] || ''}`}>
                          {run.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : salaryStructure ? (
              <div className="space-y-4">
                <div className="mb-4">
                  <h3 className="text-3xl font-bold text-primary mb-1">
                    ${(salaryStructure.gross_salary || 0).toLocaleString()}<span className="text-lg text-muted-foreground">/yr</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">Effective from {salaryStructure.effective_from || 'N/A'}</p>
                </div>
                {Array.isArray(salaryStructure.components) && (salaryStructure.components as any[]).map((comp: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-2.5 bg-background/50 rounded-xl border border-border/50 text-sm">
                    <span className="text-muted-foreground">{comp.name || comp.label}</span>
                    <span className="font-semibold">${(comp.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8">
                <DollarSign className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No salary structure configured</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> Payslip Archive
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPayslips ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : payslips.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <FileText className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No payslips generated yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {payslips.map((slip: any) => (
                  <div key={slip.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-background/40 hover:bg-primary/5 border border-border/50 transition-colors gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-primary text-sm">
                        {slip.payroll_runs?.period_start} — {slip.payroll_runs?.period_end}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <Badge variant="outline" className="border-success text-success bg-success/10 text-[9px] uppercase px-1 py-0">
                          {slip.payroll_runs?.status || 'processed'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Net: ${(slip.net_salary || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex justify-end w-full sm:w-auto border-t border-border/10 pt-2 sm:pt-0 sm:border-none">
                      <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/20 h-8 w-8 rounded-lg" aria-label="Download payslip">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Compensation Structure (Admin Only) ── */}
      {isAdmin && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="w-5 h-5" /> Compensation Structure
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Define the percentage split of CTC across salary components. These are also available as variables in Offer Letter templates.
                </p>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t border-border/10 pt-3 sm:pt-0 sm:border-none">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors ${isCompValid ? 'bg-success/10 text-success border border-success/30' : 'bg-destructive/10 text-destructive border border-destructive/30'}`}>
                  {isCompValid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {compTotal.toFixed(1)}%
                </div>
                <Button
                  onClick={() => saveCompMutation.mutate()}
                  disabled={!isCompValid || saveCompMutation.isPending}
                  className="gap-2 text-xs sm:text-sm h-9 px-3.5"
                  size="sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saveCompMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingCompStructure ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <>
                {!isCompValid && (
                  <div className="flex items-center gap-2 p-3 mb-4 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Total must equal exactly <strong>100%</strong> to save. Currently at <strong>{compTotal.toFixed(1)}%</strong> — adjust by <strong>{(100 - compTotal).toFixed(1)}%</strong>.</span>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {COMP_LABELS.map(({ key, label, variable }) => (
                    <div key={key} className="p-4 rounded-lg border border-border/50 bg-background/50 space-y-2 hover:border-primary/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">{label}</label>
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-mono">
                          {variable}
                        </span>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={compStructure[key]}
                          onChange={(e) => handleCompChange(key, e.target.value)}
                          className="pr-8 h-10 text-lg font-semibold"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
                      </div>
                      {/* Visual bar */}
                      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all duration-300"
                          style={{ width: `${Math.min(compStructure[key], 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary bar */}
                <div className="mt-6 p-4 rounded-lg border border-border/50 bg-background/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Allocation</span>
                    <span className={`text-sm font-bold ${isCompValid ? 'text-success' : 'text-destructive'}`}>
                      {compTotal.toFixed(1)}% / 100%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted/20 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isCompValid ? 'bg-success/70' : compTotal > 100 ? 'bg-destructive/70' : 'bg-warning/70'}`}
                      style={{ width: `${Math.min(compTotal, 100)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                    {COMP_LABELS.map(({ key, label }) => (
                      <span key={key} className="text-[11px] text-muted-foreground">
                        {label}: <strong className="text-foreground">{compStructure[key]}%</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

