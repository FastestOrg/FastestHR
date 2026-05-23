import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, DollarSign, FileText, Activity, Plus, Percent, Save, AlertTriangle, CheckCircle2, ShieldCheck, Clock, ExternalLink, XCircle, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getCurrencySymbol, formatAmount } from '@/lib/utils';
import { calculatePayrollTaxAndNet } from '@/utils/compliance-formulas';
import { generateAndDownloadPayslipPDF } from '@/lib/pdf-generator';

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

const getWeekdays = (start: Date, end: Date) => {
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

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

  const { data: employee } = useQuery({
    queryKey: ['my-employee', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data } = await supabase
        .from('employees')
        .select('id, company_id, first_name, last_name, work_email, personal_email, employee_code, departments(name), designations(name)')
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  const companyIdToUse = profile?.company_id || employee?.company_id;

  const { data: companyProfile } = useQuery({
    queryKey: ['company-profile', companyIdToUse],
    queryFn: async () => {
      if (!companyIdToUse) return null;
      const { data } = await supabase
        .from('companies')
        .select('name, currency')
        .eq('id', companyIdToUse)
        .single();
      return data;
    },
    enabled: !!companyIdToUse,
  });

  const currencySymbol = getCurrencySymbol(companyProfile?.currency);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  // Phase 4: Tax Audit panel states
  const [activeTab, setActiveTab] = useState<'payroll' | 'tax-audit'>('payroll');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');

  // Query all employees with their tax declarations for statutory auditing
  const { data: auditEmployees = [], isLoading: loadingAudit } = useQuery({
    queryKey: ['audit-employees', companyIdToUse],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, tax_jurisdiction, tax_declaration')
        .eq('company_id', companyIdToUse!)
        .is('deleted_at', null);
      return data || [];
    },
    enabled: isAdmin && !!companyIdToUse,
  });

  const { data: employeesWithSalary = [], isLoading: loadingVerifySalary } = useQuery({
    queryKey: ['verify-employees-salary', companyIdToUse],
    queryFn: async () => {
      if (!companyIdToUse) return [];
      
      const { data: activeEmployees, error: empError } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code')
        .eq('company_id', companyIdToUse)
        .is('deleted_at', null);

      if (empError) throw empError;
      if (!activeEmployees || activeEmployees.length === 0) return [];

      const { data: structures, error: structError } = await supabase
        .from('salary_structures')
        .select('employee_id');

      if (structError) throw structError;

      const structuredEmpIds = new Set(structures?.map(s => s.employee_id) || []);
      const missing = activeEmployees.filter(emp => !structuredEmpIds.has(emp.id));
      return missing;
    },
    enabled: isAdmin && !!companyIdToUse && dialogOpen,
  });

  // Verify/Reject Tax Exemption declaration mutation
  const verifyTaxMutation = useMutation({
    mutationFn: async ({ employeeId, status, declaration, rejectionReason }: { employeeId: string; status: 'verified' | 'rejected'; declaration: any; rejectionReason?: string }) => {
      const updatedDeclaration = { 
        ...declaration, 
        status, 
        rejection_reason: status === 'rejected' ? (rejectionReason || 'Rejected by HR') : null 
      };
      const { error } = await supabase
        .from('employees')
        .update({ tax_declaration: updatedDeclaration })
        .eq('id', employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-employees'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast.success('Tax declaration status updated successfully');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update status'),
  });

  const { data: payrollRuns = [], isLoading: loadingRuns } = useQuery({
    queryKey: ['payroll-runs', companyIdToUse],
    queryFn: async () => {
      const { data } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('company_id', companyIdToUse!)
        .order('period_end', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: isAdmin && !!companyIdToUse,
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
      
      const { data, error } = await supabase.rpc('process_payroll_run', {
        p_company_id: profile!.company_id!,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_processed_by: profile!.id
      });
      
      if (error) throw error;
      return data;
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
        {isAdmin && activeTab === 'payroll' && (
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

                {employeesWithSalary.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 space-y-1.5 animate-in fade-in duration-300">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
                      <span>Payroll Safeguard: Missing Salary Structures</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      We detected that <strong>{employeesWithSalary.length} active employee(s)</strong> do not have a salary structure configured. They will be skipped during payroll processing.
                    </p>
                    <div className="max-h-[80px] overflow-y-auto border border-border/20 rounded bg-background/50 p-1.5 space-y-1 mt-1 text-[10px] font-mono">
                      {employeesWithSalary.map((emp: any) => (
                        <div key={emp.id} className="flex justify-between items-center text-muted-foreground">
                          <span>{emp.first_name} {emp.last_name}</span>
                          <span className="text-[9px] bg-muted px-1.5 py-0.2 rounded font-semibold text-foreground uppercase tracking-wider">{emp.employee_code || 'No Code'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

      {/* Phase 4: Dynamic Admin Tab Selector */}
      {isAdmin && (
        <div className="flex space-x-1 bg-background/50 backdrop-blur-md p-1 rounded-xl border border-border/40 w-fit">
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'payroll' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Payroll Processing
          </button>
          <button
            onClick={() => setActiveTab('tax-audit')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'tax-audit' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Statutory & Tax Audit
          </button>
        </div>
      )}

      {isAdmin && activeTab === 'tax-audit' ? (
        <Card className="border border-border/40 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <CardHeader className="bg-muted/10 pb-4 border-b border-border/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 animate-pulse" /> Statutory Tax Audit & Exemptions
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Review, verify, or reject employee pre-tax exemptions and supporting files.</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search employee..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="pl-9 h-8 text-xs border-border/50 bg-background/50 focus-visible:ring-primary"
                  />
                </div>
                <Select value={auditFilter} onValueChange={(val: any) => setAuditFilter(val)}>
                  <SelectTrigger className="h-8 w-[120px] text-xs border-border/50 bg-background/50">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {loadingAudit ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : (() => {
              const filtered = auditEmployees.filter((emp: any) => {
                const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
                const matchesSearch = fullName.includes(auditSearch.toLowerCase());
                const declStatus = emp.tax_declaration?.status || 'pending';
                const hasDeclaration = Object.keys(emp.tax_declaration || {}).length > 0;
                
                if (auditFilter === 'all') return matchesSearch;
                return matchesSearch && declStatus === auditFilter && hasDeclaration;
              });

              if (filtered.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertTriangle className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-semibold text-muted-foreground">No statutory declarations found</p>
                    <p className="text-xs text-muted-foreground/60 max-w-xs mt-1">Employees can submit pre-tax declarations and documents inside their Profile settings.</p>
                  </div>
                );
              }

              return (
                <div className="grid gap-4 md:grid-cols-2">
                  {filtered.map((emp: any) => {
                    const decl = emp.tax_declaration || {};
                    const hasDecl = Object.keys(decl).length > 0;
                    const declStatus = decl.status || 'pending';
                    const isInd = emp.tax_jurisdiction === 'IND';

                    return (
                      <div key={emp.id} className="p-4 rounded-xl border border-border/50 bg-background/30 hover:shadow-md transition-all space-y-4 flex flex-col justify-between group relative overflow-hidden">
                        {/* Glow indicator based on status */}
                        <div className={`absolute top-0 left-0 w-1 h-full ${
                          declStatus === 'verified' ? 'bg-emerald-500' :
                          declStatus === 'rejected' ? 'bg-destructive' : 'bg-amber-500'
                        }`} />

                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-sm text-foreground">{emp.first_name} {emp.last_name}</h4>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                                {isInd ? '🇮🇳 India Tax Jurisdiction' : '🇺🇸 USA Tax Jurisdiction'}
                              </p>
                            </div>
                            <Badge variant="outline" className={`uppercase text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                              declStatus === 'verified' ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10' :
                              declStatus === 'rejected' ? 'border-destructive/30 text-destructive bg-destructive/10 animate-pulse' :
                              'border-amber-500/30 text-amber-700 bg-amber-500/10'
                            }`}>
                              {declStatus === 'verified' ? <ShieldCheck className="w-2.5 h-2.5 mr-1 inline" /> :
                               declStatus === 'rejected' ? <XCircle className="w-2.5 h-2.5 mr-1 inline" /> :
                               <Clock className="w-2.5 h-2.5 mr-1 inline animate-spin" />}
                              {declStatus}
                            </Badge>
                          </div>

                          {!hasDecl ? (
                            <p className="text-xs text-muted-foreground italic bg-muted/20 p-2.5 rounded-lg border border-border/10">No declarations submitted yet.</p>
                          ) : (
                            <div className="space-y-2 text-xs">
                              {isInd ? (
                                <div className="grid grid-cols-2 gap-2 bg-background/50 p-2.5 rounded-lg border border-border/10">
                                  <div>
                                    <span className="text-[10px] text-muted-foreground block uppercase font-mono">Regime</span>
                                    <span className="font-medium capitalize">{decl.regime || 'new'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-muted-foreground block uppercase font-mono">Section 80C</span>
                                    <span className="font-semibold text-foreground">₹{(decl.section_80c || 0).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-muted-foreground block uppercase font-mono">Section 80D</span>
                                    <span className="font-semibold text-foreground">₹{(decl.section_80d || 0).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-muted-foreground block uppercase font-mono">HRA Exemption</span>
                                    <span className="font-semibold text-foreground">₹{(decl.hra_exemption || 0).toLocaleString()}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-background/50 p-2.5 rounded-lg border border-border/10">
                                  <span className="text-[10px] text-muted-foreground block uppercase font-mono">Pre-Tax Deductions</span>
                                  <span className="font-semibold text-foreground">${(decl.pre_tax_deductions || 0).toLocaleString()}</span>
                                </div>
                              )}

                              {/* Proof link */}
                              <div className="pt-2 border-t border-border/10">
                                <span className="text-[10px] text-muted-foreground block uppercase mb-1 font-mono">Supporting Document</span>
                                {decl.proof_url ? (
                                  <a
                                    href={decl.proof_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-1 font-medium transition-all"
                                  >
                                    View Proof Attachment <ExternalLink className="w-3 h-3 text-primary" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground italic flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> No attachment link provided
                                  </span>
                                )}
                              </div>
                              {declStatus === 'rejected' && decl.rejection_reason && (
                                <div className="mt-2 text-[10px] text-destructive bg-destructive/5 p-2 rounded border border-destructive/10 leading-relaxed">
                                  <strong>Rejection Reason:</strong> "{decl.rejection_reason}"
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        {hasDecl && declStatus !== 'verified' && (
                          <div className="flex gap-2 pt-4 border-t border-border/10 mt-3">
                            <Button
                              size="sm"
                              onClick={() => verifyTaxMutation.mutate({ employeeId: emp.id, status: 'verified', declaration: decl })}
                              disabled={verifyTaxMutation.isPending}
                              className="h-8 flex-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verify & Lock
                            </Button>
                             {declStatus !== 'rejected' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const reason = prompt("Please enter the reason for rejecting this tax declaration:");
                                  if (reason !== null && reason.trim() !== "") {
                                    verifyTaxMutation.mutate({ employeeId: emp.id, status: 'rejected', declaration: decl, rejectionReason: reason });
                                  } else if (reason !== null) {
                                    toast.error("Rejection reason is required.");
                                  }
                                }}
                                disabled={verifyTaxMutation.isPending}
                                className="h-8 flex-1 text-xs font-semibold border-destructive text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                              </Button>
                            )}
                          </div>
                        )}

                        {declStatus === 'verified' && (
                          <div className="flex items-center justify-center p-2 mt-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-[10px] text-emerald-700 font-semibold gap-1 shrink-0">
                            <ShieldCheck className="w-3.5 h-3.5" /> Exemption Verified & locked into payroll.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      ) : (
        <>
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
                              Gross: {currencySymbol}{formatAmount(run.total_gross || 0, companyProfile?.currency)} · Net: {currencySymbol}{formatAmount(run.total_net || 0, companyProfile?.currency)}
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
                        {currencySymbol}{formatAmount(salaryStructure.gross_salary || 0, companyProfile?.currency)}<span className="text-lg text-muted-foreground">/yr</span>
                      </h3>
                      <p className="text-sm text-muted-foreground">Effective from {salaryStructure.effective_from || 'N/A'}</p>
                    </div>
                    {Array.isArray(salaryStructure.components) && (salaryStructure.components as any[]).map((comp: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-2.5 bg-background/50 rounded-xl border border-border/50 text-sm">
                        <span className="text-muted-foreground">{comp.name || comp.label}</span>
                        <span className="font-semibold">{currencySymbol}{formatAmount(comp.amount || 0, companyProfile?.currency)}</span>
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
                            <span className="text-xs text-muted-foreground">Net: {currencySymbol}{formatAmount(slip.net_salary || 0, companyProfile?.currency)}</span>
                            {slip.breakdown?.overtime_payout > 0 && (
                              <span className="text-[10px] text-success bg-success/10 border border-success/30 px-1.5 py-0.5 rounded font-medium">
                                OT: {slip.breakdown.overtime_hours} hrs (+{currencySymbol}{formatAmount(slip.breakdown.overtime_payout, companyProfile?.currency)})
                              </span>
                            )}
                            {slip.breakdown?.attendance_penalty > 0 && (
                              <span className="text-[10px] text-destructive bg-destructive/10 border border-destructive/30 px-1.5 py-0.5 rounded font-medium">
                                Lates: {slip.breakdown.late_count} (-{currencySymbol}{formatAmount(slip.breakdown.attendance_penalty, companyProfile?.currency)})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end w-full sm:w-auto border-t border-border/10 pt-2 sm:pt-0 sm:border-none">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-primary hover:bg-primary/20 h-8 w-8 rounded-lg"
                            aria-label="Download payslip"
                            onClick={async () => {
                              try {
                                if (!employee) {
                                  toast.error("Employee details not found");
                                  return;
                                }
                                await generateAndDownloadPayslipPDF({
                                  companyName: companyProfile?.name || "FastestHR Company",
                                  employeeName: `${employee.first_name} ${employee.last_name}`,
                                  employeeEmail: employee.work_email || employee.personal_email || "",
                                  employeeCode: employee.employee_code || undefined,
                                  department: (employee.departments as any)?.name || undefined,
                                  designation: (employee.designations as any)?.name || undefined,
                                  periodStart: slip.payroll_runs?.period_start || "",
                                  periodEnd: slip.payroll_runs?.period_end || "",
                                  slip,
                                  currency: companyProfile?.currency || "USD"
                                });
                                queryClient.invalidateQueries({ queryKey: ['payslips'] });
                                toast.success("Payslip PDF downloaded successfully");
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to download payslip PDF");
                              }
                            }}
                          >
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
                      <CheckCircle2 className="w-3.5 h-3.5" />
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
        </>
      )}
    </div>
  );
}

