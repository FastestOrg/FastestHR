import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Percent, Gift, DollarSign, Plus, Trash2, Clock } from 'lucide-react';

export default function PayrollSettings() {
  const { profile } = useAuthStore();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();

  const [taxSlabs, setTaxSlabs] = useState([
    { from: 0, to: 250000, rate: 0 },
    { from: 250001, to: 500000, rate: 5 },
    { from: 500001, to: 1000000, rate: 20 },
    { from: 1000001, to: 9999999, rate: 30 },
  ]);
  
  const [bonusTypes, setBonusTypes] = useState([
    { name: 'Performance Bonus', type: 'percentage', value: 10 },
    { name: 'Festival Bonus', type: 'fixed', value: 5000 },
    { name: 'Referral Bonus', type: 'fixed', value: 10000 },
  ]);
  const [newBonus, setNewBonus] = useState({ name: '', type: 'fixed', value: '' });

  // Overtime & Penalty Settings state
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.5);
  const [overtimeThresholdMins, setOvertimeThresholdMins] = useState(0);
  const [lateGracePeriodMins, setLateGracePeriodMins] = useState(15);
  const [lateTrigger, setLateTrigger] = useState(3);
  const [deductionUnit, setDeductionUnit] = useState('half_day');

  // Fetch persistent company payroll configuration
  const { data: company, isLoading: loadingConfig } = useQuery({
    queryKey: ['company-payroll-settings', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('compensation_structure, payroll_settings')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Load from database if exists
  useEffect(() => {
    if (company?.compensation_structure) {
      const comp = company.compensation_structure as any;
      if (Array.isArray(comp.tax_slabs)) {
        setTaxSlabs(comp.tax_slabs);
      }
      if (Array.isArray(comp.bonus_types)) {
        setBonusTypes(comp.bonus_types);
      }
    }
    if (company?.payroll_settings) {
      const ps = company.payroll_settings as any;
      setOvertimeMultiplier(ps.overtime_multiplier ?? 1.5);
      setOvertimeThresholdMins(ps.overtime_threshold_mins ?? 0);
      setLateGracePeriodMins(ps.late_grace_period_mins ?? 15);
      if (ps.late_penalty_rule) {
        setLateTrigger(ps.late_penalty_rule.frequency_trigger ?? 3);
        setDeductionUnit(ps.late_penalty_rule.deduction_unit ?? 'half_day');
      }
    }
  }, [company]);

  // Mutation to save settings
  const saveMutation = useMutation({
    mutationFn: async ({ updatedSlabs, updatedBonuses, updatedPayrollSettings }: { updatedSlabs?: typeof taxSlabs, updatedBonuses?: typeof bonusTypes, updatedPayrollSettings?: any }) => {
      if (!companyId) throw new Error("No company ID provided.");
      
      const { data: current, error: fetchErr } = await supabase
        .from('companies')
        .select('compensation_structure, payroll_settings')
        .eq('id', companyId)
        .single();
      
      if (fetchErr) throw fetchErr;

      const currentComp = (current?.compensation_structure || {}) as any;
      
      const newComp = {
        ...currentComp,
        tax_slabs: updatedSlabs !== undefined ? updatedSlabs : taxSlabs,
        bonus_types: updatedBonuses !== undefined ? updatedBonuses : bonusTypes,
      };

      const newSettings = updatedPayrollSettings !== undefined ? updatedPayrollSettings : {
        overtime_multiplier: overtimeMultiplier,
        overtime_threshold_mins: overtimeThresholdMins,
        late_grace_period_mins: lateGracePeriodMins,
        late_penalty_rule: {
          frequency_trigger: lateTrigger,
          deduction_unit: deductionUnit
        }
      };

      const { error } = await supabase
        .from('companies')
        .update({
          compensation_structure: newComp as any,
          payroll_settings: newSettings as any
        })
        .eq('id', companyId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-payroll-settings', companyId] });
      queryClient.invalidateQueries({ queryKey: ['compensation-structure'] });
      toast.success('Payroll configurations saved successfully');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to save payroll configurations'));
    }
  });

  const addSlab = () => {
    const last = taxSlabs[taxSlabs.length - 1];
    setTaxSlabs([...taxSlabs, { from: last.to + 1, to: last.to + 500000, rate: 0 }]);
  };

  const addBonus = () => {
    if (!newBonus.name.trim()) { toast.error('Name required'); return; }
    const updated = [...bonusTypes, { name: newBonus.name, type: newBonus.type, value: parseFloat(newBonus.value as string) || 0 }];
    setBonusTypes(updated);
    setNewBonus({ name: '', type: 'fixed', value: '' });
    saveMutation.mutate({ updatedBonuses: updated });
  };

  const deleteBonus = (index: number) => {
    const updated = bonusTypes.filter((_, j) => j !== index);
    setBonusTypes(updated);
    saveMutation.mutate({ updatedBonuses: updated });
  };

  if (loadingConfig) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Payroll Config</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure compensation matrices, tax bands, allowances, and attendance penalties.</p>
      </div>

      <Card className="border-border/50 bg-card">
        <CardContent className="space-y-8 pt-6">
          {/* Tax Slabs */}
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-xs"><Percent className="w-4 h-4 text-primary" /> Tax Slabs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure income tax brackets for payroll deductions</p>
              </div>
              <Button variant="outline" size="sm" onClick={addSlab} className="gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Slab
              </Button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">
                <span>From</span>
                <span>To</span>
                <span>Rate (%)</span>
                <span></span>
              </div>
              {taxSlabs.map((slab, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 items-center">
                  <Input type="number" value={slab.from} onChange={(e) => { const n = [...taxSlabs]; n[i].from = parseInt(e.target.value) || 0; setTaxSlabs(n); }} className="h-9 text-sm bg-background/50 border-border/50" />
                  <Input type="number" value={slab.to} onChange={(e) => { const n = [...taxSlabs]; n[i].to = parseInt(e.target.value) || 0; setTaxSlabs(n); }} className="h-9 text-sm bg-background/50 border-border/50" />
                  <Input type="number" value={slab.rate} onChange={(e) => { const n = [...taxSlabs]; n[i].rate = parseFloat(e.target.value) || 0; setTaxSlabs(n); }} className="h-9 text-sm bg-background/50 border-border/50" />
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive/50 hover:text-destructive hover:bg-destructive/10" onClick={() => setTaxSlabs(taxSlabs.filter((_, j) => j !== i))} disabled={taxSlabs.length <= 1} aria-label="Delete tax slab">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button 
              size="sm" 
              className="mt-3 font-semibold text-xs h-8" 
              onClick={() => saveMutation.mutate({ updatedSlabs: taxSlabs })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Tax Config'}
            </Button>
          </div>

          {/* Bonus / Incentive Types */}
          <div className="border-t border-border/50 pt-6">
            <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-xs"><Gift className="w-4 h-4 text-primary" /> Bonus & Incentive Types</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Define standard bonus and performance categories</p>
              </div>
            </div>
            <div className="space-y-3 mb-4">
              {bonusTypes.map((b, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 rounded-lg border border-border/50 bg-background/30">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{b.type === 'percentage' ? `${b.value}% of gross salary` : `Fixed amount: ${b.value}`}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-[10px] uppercase font-semibold">{b.type}</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/10" onClick={() => deleteBonus(i)} aria-label="Delete bonus type">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 items-end bg-background/20 p-4 rounded-xl border border-border/50">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Bonus Name</Label>
                <Input placeholder="e.g. Festival Bonus" value={newBonus.name} onChange={(e) => setNewBonus(f => ({ ...f, name: e.target.value }))} className="h-9 bg-background/50 border-border/50" />
              </div>
              <div className="w-28 space-y-1">
                <Label className="text-xs">Type</Label>
                <select value={newBonus.type} onChange={(e) => setNewBonus(f => ({ ...f, type: e.target.value }))} className="flex h-9 w-full rounded-md border border-border/50 bg-background/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">Value</Label>
                <Input type="number" placeholder="0" value={newBonus.value} onChange={(e) => setNewBonus(f => ({ ...f, value: e.target.value }))} className="h-9 bg-background/50 border-border/50" />
              </div>
              <Button size="sm" className="h-9 w-9 p-0 flex items-center justify-center shrink-0" onClick={addBonus} disabled={saveMutation.isPending}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Overtime & Attendance Penalty Policy */}
          <div className="border-t border-border/50 pt-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-xs">
                <Clock className="w-4 h-4 text-primary" /> Overtime & Penalty Policies
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure automated overtime multipliers and late clock-in penalty deductions.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 bg-background/20 p-5 rounded-xl border border-border/50">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5 border-b border-border/30 pb-1.5">Overtime Calculations</h4>
                <div className="space-y-2">
                  <Label className="text-xs">Overtime Payout Multiplier</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={overtimeMultiplier}
                      onChange={(e) => setOvertimeMultiplier(parseFloat(e.target.value) || 1.0)}
                      className="h-9 w-24 bg-background border-border/50 focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground">x of base hourly pay</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Overtime Threshold (Minutes)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={overtimeThresholdMins}
                      onChange={(e) => setOvertimeThresholdMins(parseInt(e.target.value) || 0)}
                      className="h-9 w-24 bg-background border-border/50 focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground">mins grace before OT starts accruing</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5 border-b border-border/30 pb-1.5">Late Clock-In Penalty</h4>
                <div className="space-y-2">
                  <Label className="text-xs">Late Grace Period (Minutes)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={lateGracePeriodMins}
                      onChange={(e) => setLateGracePeriodMins(parseInt(e.target.value) || 0)}
                      className="h-9 w-24 bg-background border-border/50 focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground">mins allowed late clock-in without penalty</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Deduction Penalty Rule</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs">Deduct</span>
                    <select
                      value={deductionUnit}
                      onChange={(e) => setDeductionUnit(e.target.value)}
                      className="h-9 rounded-md border border-border/50 bg-background px-2.5 py-1 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="half_day">Half Day Pay</option>
                      <option value="full_day">Full Day Pay</option>
                    </select>
                    <span className="text-xs">for every</span>
                    <Input
                      type="number"
                      value={lateTrigger}
                      onChange={(e) => setLateTrigger(parseInt(e.target.value) || 3)}
                      className="h-9 w-16 text-center bg-background border-border/50 focus:border-primary"
                    />
                    <span className="text-xs">Late Clock-Ins</span>
                  </div>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              className="mt-4 font-semibold h-9 px-4"
              onClick={() => saveMutation.mutate({})}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Policies'}
            </Button>
          </div>

          {/* Salary Components */}
          <div className="border-t border-border/50 pt-6">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 uppercase tracking-wider text-xs"><DollarSign className="w-4 h-4 text-primary" /> Default Salary Components</h3>
            <p className="text-xs text-muted-foreground mb-4">These components are used automatically when generating salary structures for employees</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {['Basic Pay', 'House Rent Allowance (HRA)', 'Conveyance Allowance', 'Medical Allowance', 'Special Allowance', 'PF Employee Contribution', 'PF Employer Contribution', 'Professional Tax'].map(comp => (
                <div key={comp} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/30 text-sm font-medium">
                  <span className="text-foreground">{comp}</span>
                  <Badge variant="outline" className="text-[9px] uppercase tracking-wider">Default</Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
