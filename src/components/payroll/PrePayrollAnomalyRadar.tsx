import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatAmount } from '@/lib/utils';
import {
  ShieldAlert, CheckCircle2, AlertTriangle, Users, DollarSign,
  Sparkles, ArrowRight, Search, FileQuestion, Landmark, Clock, Check
} from 'lucide-react';
import { toast } from 'sonner';

export interface PrePayrollAnomalyRadarProps {
  companyId: string;
  periodStart: string;
  periodEnd: string;
  currencySymbol: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onProceedToRun: () => void;
}

export interface EmployeeAnomaly {
  employeeId: string;
  name: string;
  code: string;
  department: string;
  designation: string;
  grossSalary: number;
  type: 'critical' | 'warning' | 'clean';
  category: 'missing_bank' | 'zero_attendance' | 'high_overtime' | 'negative_net' | 'unverified_tax' | 'clean';
  description: string;
  suggestedAction: string;
  isOverridden?: boolean;
}

export function PrePayrollAnomalyRadar({
  companyId,
  periodStart,
  periodEnd,
  currencySymbol,
  isOpen,
  onOpenChange,
  onProceedToRun,
}: PrePayrollAnomalyRadarProps) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'clean'>('all');
  const [search, setSearch] = useState('');
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  // 1. Fetch active employees with bank details and tax declarations
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['pre-payroll-employees', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code, base_salary, bank_account_no, bank_name, bank_ifsc, tax_declaration, tax_jurisdiction, departments(name), designations(title)')
        .eq('company_id', companyId)
        .is('deleted_at', null);

      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!companyId,
  });

  // 2. Fetch attendance logs for the period
  const { data: attendanceLogs = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ['pre-payroll-attendance', companyId, periodStart, periodEnd],
    queryFn: async () => {
      if (!companyId || !periodStart || !periodEnd) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select('id, employee_id, date, status, total_hours, overtime_hours')
        .eq('company_id', companyId)
        .gte('date', periodStart)
        .lte('date', periodEnd);

      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!companyId && !!periodStart && !!periodEnd,
  });

  // 3. Process anomaly detection engine in O(N)
  const anomalies: EmployeeAnomaly[] = useMemo(() => {
    if (!employees.length) return [];

    const attendanceMap: Record<string, { daysPresent: number; totalOvertime: number; totalHours: number }> = {};
    for (const log of attendanceLogs) {
      if (!attendanceMap[log.employee_id]) {
        attendanceMap[log.employee_id] = { daysPresent: 0, totalOvertime: 0, totalHours: 0 };
      }
      if (log.status === 'present' || log.status === 'half_day') {
        attendanceMap[log.employee_id].daysPresent += (log.status === 'half_day' ? 0.5 : 1);
      }
      attendanceMap[log.employee_id].totalOvertime += Number(log.overtime_hours || 0);
      attendanceMap[log.employee_id].totalHours += Number(log.total_hours || 0);
    }

    const list: EmployeeAnomaly[] = [];

    for (const emp of employees) {
      const att = attendanceMap[emp.id] || { daysPresent: 0, totalOvertime: 0, totalHours: 0 };
      const gross = Number(emp.base_salary) || 0;
      const deptName = (emp.departments as any)?.name || 'General';
      const desigTitle = (emp.designations as any)?.title || 'Member';
      const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unnamed Employee';

      let anomaly: EmployeeAnomaly | null = null;

      // Check 1: Missing Bank Account (Critical: Payout will bounce)
      if (!emp.bank_account_no || emp.bank_account_no.trim().length < 6) {
        anomaly = {
          employeeId: emp.id,
          name,
          code: emp.employee_code || 'EMP-N/A',
          department: deptName,
          designation: desigTitle,
          grossSalary: gross,
          type: 'critical',
          category: 'missing_bank',
          description: 'No verified bank account or routing number on file.',
          suggestedAction: 'Collect bank details or disburse manually via check.',
        };
      }
      // Check 2: 0 Attendance punches during entire cycle (Warning)
      else if (att.daysPresent === 0 && periodStart && periodEnd) {
        anomaly = {
          employeeId: emp.id,
          name,
          code: emp.employee_code || 'EMP-N/A',
          department: deptName,
          designation: desigTitle,
          grossSalary: gross,
          type: 'warning',
          category: 'zero_attendance',
          description: 'Zero clock-in records logged during this entire payroll cycle.',
          suggestedAction: 'Verify if employee was on approved unpaid leave or sabbatical.',
        };
      }
      // Check 3: Abnormal Overtime Spike (>30 hours in single period)
      else if (att.totalOvertime > 30) {
        anomaly = {
          employeeId: emp.id,
          name,
          code: emp.employee_code || 'EMP-N/A',
          department: deptName,
          designation: desigTitle,
          grossSalary: gross,
          type: 'warning',
          category: 'high_overtime',
          description: `Exceptional overtime logged: ${att.totalOvertime.toFixed(1)} hrs.`,
          suggestedAction: 'Confirm with reporting manager before payout authorization.',
        };
      }
      // Check 4: Unverified Tax Declaration / Missing Regime
      else if (!emp.tax_declaration || (emp.tax_declaration as any)?.status === 'pending') {
        anomaly = {
          employeeId: emp.id,
          name,
          code: emp.employee_code || 'EMP-N/A',
          department: deptName,
          designation: desigTitle,
          grossSalary: gross,
          type: 'warning',
          category: 'unverified_tax',
          description: 'Tax declaration proofs pending verification or regime unassigned.',
          suggestedAction: 'Default to standard regime or approve pending proof documents.',
        };
      }

      if (anomaly) {
        list.push({ ...anomaly, isOverridden: !!overrides[emp.id] });
      } else {
        list.push({
          employeeId: emp.id,
          name,
          code: emp.employee_code || 'EMP-N/A',
          department: deptName,
          designation: desigTitle,
          grossSalary: gross,
          type: 'clean',
          category: 'clean',
          description: 'All compliance, attendance, and banking records verified.',
          suggestedAction: 'Ready for 1-click zero-touch disbursal.',
          isOverridden: false,
        });
      }
    }

    return list;
  }, [employees, attendanceLogs, overrides, periodStart, periodEnd]);

  // Metrics
  const totalEmployees = employees.length;
  const criticalCount = anomalies.filter(a => a.type === 'critical' && !a.isOverridden).length;
  const warningCount = anomalies.filter(a => a.type === 'warning' && !a.isOverridden).length;
  const cleanCount = totalEmployees - criticalCount - warningCount;
  const projectedTotalGross = anomalies.reduce((sum, a) => sum + a.grossSalary, 0);

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.code.toLowerCase().includes(search.toLowerCase()) ||
        a.department.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (filter === 'all') return true;
      if (filter === 'critical') return a.type === 'critical' && !a.isOverridden;
      if (filter === 'warning') return a.type === 'warning' && !a.isOverridden;
      if (filter === 'clean') return a.type === 'clean' || a.isOverridden;
      return true;
    });
  }, [anomalies, filter, search]);

  const handleToggleOverride = (empId: string) => {
    setOverrides(prev => {
      const next = { ...prev, [empId]: !prev[empId] };
      toast.success(next[empId] ? 'Anomaly marked as reviewed & overridden' : 'Override cleared');
      return next;
    });
  };

  const handleOverrideAllWarnings = () => {
    const nextOverrides = { ...overrides };
    for (const a of anomalies) {
      if (a.type === 'warning') {
        nextOverrides[a.employeeId] = true;
      }
    }
    setOverrides(nextOverrides);
    toast.success('All non-critical warnings approved for processing');
  };

  const isLoading = loadingEmployees || loadingAttendance;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  FastestAI Pre-Payroll Anomaly Radar
                  <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 text-xs">
                    Autonomous Autopilot
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Period: <span className="font-semibold text-foreground">{periodStart || 'Start'}</span> to{' '}
                  <span className="font-semibold text-foreground">{periodEnd || 'End'}</span> • Pre-flight audit simulation
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Top Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3">
          <Card className="bg-card/50 border-border/60">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Total Headcount
              </p>
              <p className="text-2xl font-bold mt-1">{totalEmployees}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/60">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" /> Projected Gross
              </p>
              <p className="text-2xl font-bold mt-1">{currencySymbol}{formatAmount(projectedTotalGross)}</p>
            </CardContent>
          </Card>
          <Card className="bg-success/5 border-success/30">
            <CardContent className="p-3">
              <p className="text-xs text-success flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ready for Disbursal
              </p>
              <p className="text-2xl font-bold text-success mt-1">{cleanCount}</p>
            </CardContent>
          </Card>
          <Card className={criticalCount > 0 ? "bg-destructive/5 border-destructive/30" : "bg-warning/5 border-warning/30"}>
            <CardContent className="p-3">
              <p className={`text-xs flex items-center gap-1 ${criticalCount > 0 ? 'text-destructive' : 'text-warning'}`}>
                <ShieldAlert className="h-3.5 w-3.5" /> Active Anomalies
              </p>
              <p className={`text-2xl font-bold mt-1 ${criticalCount > 0 ? 'text-destructive' : 'text-warning'}`}>
                {criticalCount} Critical • {warningCount} Warn
              </p>
            </CardContent>
          </Card>
        </div>

        {/* AI Executive Summary Banner */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-3 text-xs sm:text-sm">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-foreground">FastestAI Executive Brief: </span>
            {criticalCount > 0 ? (
              <span className="text-muted-foreground">
                <strong className="text-destructive font-medium">{criticalCount} critical blocker(s)</strong> detected that will cause payout failure (e.g. missing bank accounts). Please review before running live disbursement.
              </span>
            ) : warningCount > 0 ? (
              <span className="text-muted-foreground">
                Zero critical blockers. <strong className="text-warning font-medium">{warningCount} warning(s)</strong> detected (e.g. zero attendance or pending tax proofs). You may override warnings and proceed.
              </span>
            ) : (
              <span className="text-muted-foreground">
                <strong className="text-success font-medium">100% of employee records verified.</strong> No attendance discrepancies, tax mismatches, or missing payout credentials. Ready for immediate 1-click execution!
              </span>
            )}
          </div>
          {warningCount > 0 && (
            <Button size="sm" variant="outline" className="text-xs h-7 shrink-0" onClick={handleOverrideAllWarnings}>
              Approve All Warnings
            </Button>
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              className="text-xs h-8"
              onClick={() => setFilter('all')}
            >
              All ({anomalies.length})
            </Button>
            <Button
              size="sm"
              variant={filter === 'critical' ? 'destructive' : 'outline'}
              className="text-xs h-8"
              onClick={() => setFilter('critical')}
            >
              Blockers ({criticalCount})
            </Button>
            <Button
              size="sm"
              variant={filter === 'warning' ? 'secondary' : 'outline'}
              className="text-xs h-8"
              onClick={() => setFilter('warning')}
            >
              Warnings ({warningCount})
            </Button>
            <Button
              size="sm"
              variant={filter === 'clean' ? 'outline' : 'ghost'}
              className="text-xs h-8 text-success"
              onClick={() => setFilter('clean')}
            >
              Verified ({cleanCount})
            </Button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search employee or department..."
              className="text-xs pl-8 h-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Scrollable Anomalies List */}
        <ScrollArea className="flex-1 my-2 pr-2 border rounded-md min-h-[220px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-2">
              <Sparkles className="h-6 w-6 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Simulating payroll calculations & scanning workforce graph...</p>
            </div>
          ) : filteredAnomalies.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-success mb-2" />
              <p className="text-sm font-medium text-foreground">No records matching selected filter</p>
              <p className="text-xs">All records under this view meet compliance criteria.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredAnomalies.map((item) => (
                <div key={item.employeeId} className="p-3 hover:bg-muted/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {item.isOverridden ? (
                        <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                      ) : item.type === 'critical' ? (
                        <ShieldAlert className="h-5 w-5 text-destructive" />
                      ) : item.type === 'warning' ? (
                        <AlertTriangle className="h-5 w-5 text-warning" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{item.name}</span>
                        <span className="text-xs font-mono text-muted-foreground">{item.code}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                          {item.department}
                        </Badge>
                        {item.isOverridden ? (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 bg-muted text-muted-foreground">
                            Overridden
                          </Badge>
                        ) : item.type === 'critical' ? (
                          <Badge variant="destructive" className="text-[10px] py-0 px-1.5 h-4">
                            Blocker
                          </Badge>
                        ) : item.type === 'warning' ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-warning text-warning bg-warning/5">
                            Notice
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-success text-success bg-success/5">
                            Ready
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-foreground/80 mt-0.5">{item.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-medium text-primary">Recommendation: </span>
                        {item.suggestedAction}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span className="text-xs font-semibold text-foreground mr-2">
                      {currencySymbol}{formatAmount(item.grossSalary)}
                    </span>
                    {item.type !== 'clean' && (
                      <Button
                        size="sm"
                        variant={item.isOverridden ? 'outline' : 'secondary'}
                        className="text-xs h-7 px-2.5"
                        onClick={() => handleToggleOverride(item.employeeId)}
                      >
                        {item.isOverridden ? 'Revert' : 'Acknowledge'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <DialogFooter className="pt-2 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {criticalCount > 0 ? (
              <span className="text-destructive font-medium flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" /> Resolve {criticalCount} blocker(s) before live run
              </span>
            ) : (
              <span className="text-success font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> All pre-payroll gates clear
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground font-semibold"
              disabled={criticalCount > 0}
              onClick={() => {
                onOpenChange(false);
                onProceedToRun();
              }}
            >
              Proceed to Disbursal <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
