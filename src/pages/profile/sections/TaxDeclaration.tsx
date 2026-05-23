import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProfileSectionCard } from '../components/ProfileSectionCard';
import { Landmark, ArrowRight, ShieldCheck, DollarSign, Receipt, Info, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { calculatePayrollTaxAndNet } from '@/utils/compliance-formulas';

interface TaxDeclarationProps {
  employee: any;
  refetch: () => void;
}

export default function TaxDeclaration({ employee, refetch }: TaxDeclarationProps) {
  const currentDeclaration = employee.tax_declaration || {};

  // Form States
  const [jurisdiction, setJurisdiction] = useState<string>(employee.tax_jurisdiction || 'USA');
  const [regime, setRegime] = useState<string>(currentDeclaration.regime || 'new');
  const [section80c, setSection80c] = useState<string>(currentDeclaration.section_80c || '0');
  const [section80d, setSection80d] = useState<string>(currentDeclaration.section_80d || '0');
  const [hraExemption, setHraExemption] = useState<string>(currentDeclaration.hra_exemption || '0');
  const [preTaxDeductions, setPreTaxDeductions] = useState<string>(currentDeclaration.pre_tax_deductions || '0');
  const [proofUrl, setProofUrl] = useState<string>(currentDeclaration.proof_url || '');

  const status = currentDeclaration.status || 'pending';

  // Real-time dynamic payroll projections
  const [projections, setProjections] = useState<any>(null);
  const baseSalary = employee.base_salary ? parseFloat(employee.base_salary) : 5000;

  useEffect(() => {
    const decls = jurisdiction === 'IND' 
      ? { regime, section_80c: parseFloat(section80c) || 0, section_80d: parseFloat(section80d) || 0, hra_exemption: parseFloat(hraExemption) || 0 }
      : { pre_tax_deductions: parseFloat(preTaxDeductions) || 0 };
    
    const result = calculatePayrollTaxAndNet(jurisdiction, baseSalary, decls);
    setProjections(result);
  }, [jurisdiction, regime, section80c, section80d, hraExemption, preTaxDeductions, baseSalary]);

  const handleSave = async () => {
    if (status === 'verified') {
      toast.error('Verified declarations cannot be edited.');
      return;
    }

    if (jurisdiction === 'IND' && regime === 'old') {
      const s80cVal = parseFloat(section80c) || 0;
      const s80dVal = parseFloat(section80d) || 0;

      if (s80cVal > 150000) {
        toast.error('Section 80C declaration cannot exceed legal limit of ₹1,50,000.');
        return;
      }
      if (s80dVal > 25000) {
        toast.error('Section 80D declaration cannot exceed legal limit of ₹25,000.');
        return;
      }
    }

    const declData = jurisdiction === 'IND'
      ? { 
          regime, 
          section_80c: parseFloat(section80c) || 0, 
          section_80d: parseFloat(section80d) || 0, 
          hra_exemption: parseFloat(hraExemption) || 0,
          proof_url: proofUrl,
          status: 'pending' // Reset to pending when edited and saved
        }
      : { 
          pre_tax_deductions: parseFloat(preTaxDeductions) || 0,
          proof_url: proofUrl,
          status: 'pending' // Reset to pending when edited and saved
        };

    const { error } = await supabase
      .from('employees')
      .update({
        tax_jurisdiction: jurisdiction,
        tax_declaration: declData
      })
      .eq('id', employee.id);

    if (error) {
      toast.error(error.message);
      throw error;
    }

    toast.success('Tax declaration settings updated and submitted for review');
    refetch();
  };

  const currencySymbol = jurisdiction === 'IND' ? '₹' : '$';

  return (
    <ProfileSectionCard
      title="Statutory Tax Declarations & Projections"
      icon={<Landmark className="h-4 w-4 text-primary/70" />}
      onSave={handleSave}
      readOnly={status === 'verified'}
    >
      {(editing) => (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Status Banner */}
          <div>
            {status === 'verified' && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 flex gap-3 items-center">
                <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 animate-pulse" />
                <div>
                  <strong>Verification Status: Verified by HR</strong>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">Your tax declarations and proofs have been audited and approved. Editing is locked for this cycle.</p>
                </div>
              </div>
            )}
            {status === 'rejected' && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex gap-3 items-center">
                <AlertTriangle className="w-5 h-5 shrink-0 text-destructive animate-bounce" />
                <div>
                  <strong>Verification Status: Rejected by HR</strong>
                  <p className="text-destructive/80 mt-0.5 text-[11px]">Your submitted proof or amounts were not accepted. Please correct the values, provide valid proof, and resubmit.</p>
                  {currentDeclaration.rejection_reason && (
                    <div className="mt-2 p-2 bg-destructive/15 rounded border border-destructive/20 text-[11px] font-semibold text-destructive">
                      Rejection Reason: "{currentDeclaration.rejection_reason}"
                    </div>
                  )}
                </div>
              </div>
            )}
            {status === 'pending' && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 flex gap-3 items-center">
                <Info className="w-5 h-5 shrink-0 text-amber-600 animate-pulse" />
                <div>
                  <strong>Verification Status: Pending Verification</strong>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">Your declarations are awaiting HR audit. You can edit them until verified by HR.</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            
            {/* Declaration Inputs */}
            <div className="lg:col-span-7 space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Tax Jurisdiction</Label>
                  {editing ? (
                    <Select value={jurisdiction} onValueChange={(val) => setJurisdiction(val)}>
                      <SelectTrigger className="h-10 border-border/50 bg-background/50">
                        <SelectValue placeholder="Select Jurisdiction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USA">United States (Federal + FICA)</SelectItem>
                        <SelectItem value="IND">India (Income Tax + EPF)</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm font-semibold py-2">
                      {jurisdiction === 'IND' ? '🇮🇳 India Jurisdiction' : '🇺🇸 USA Jurisdiction'}
                    </p>
                  )}
                </div>

                {jurisdiction === 'IND' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Tax Regime</Label>
                    {editing ? (
                      <Select value={regime} onValueChange={(val) => setRegime(val)}>
                        <SelectTrigger className="h-10 border-border/50 bg-background/50">
                          <SelectValue placeholder="Select Regime" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New Regime (Lower Slabs, No Deductions)</SelectItem>
                          <SelectItem value="old">Old Regime (HRA, 80C, 80D Allowed)</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-semibold py-2 capitalize">
                        {regime} Tax Regime
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Jurisdiction Specific Fields */}
              {jurisdiction === 'IND' ? (
                <div className="space-y-4 border-t border-border/40 pt-4">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <Receipt className="w-3.5 h-3.5 text-primary" /> Tax-Saving Declarations (80C / HRA)
                  </h4>
                  
                  {regime === 'new' ? (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary leading-relaxed flex gap-2">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>New Regime Active:</strong> Standard savings deductions (like 80C or HRA) do not apply to the simplified regime. Standard Deduction of ₹75,000 is applied automatically.
                      </div>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="sec80c" className="text-xs font-medium">Section 80C (EPF, PPF, L.I.)</Label>
                        <Input
                          id="sec80c"
                          type="number"
                          disabled={!editing}
                          value={section80c}
                          onChange={(e) => setSection80c(e.target.value)}
                          className={`h-10 border-border/50 bg-background/50 ${parseFloat(section80c) > 150000 ? 'border-destructive/50 ring-1 ring-destructive/30' : ''}`}
                          placeholder="₹ Max 1,50,000"
                        />
                        {parseFloat(section80c) > 150000 && (
                          <p className="text-[10px] text-destructive font-semibold mt-0.5 animate-pulse">Exceeds legal limit of ₹1,50,000</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="sec80d" className="text-xs font-medium">Section 80D (Health Ins.)</Label>
                        <Input
                          id="sec80d"
                          type="number"
                          disabled={!editing}
                          value={section80d}
                          onChange={(e) => setSection80d(e.target.value)}
                          className={`h-10 border-border/50 bg-background/50 ${parseFloat(section80d) > 25000 ? 'border-destructive/50 ring-1 ring-destructive/30' : ''}`}
                          placeholder="₹ Max 25,000"
                        />
                        {parseFloat(section80d) > 25000 && (
                          <p className="text-[10px] text-destructive font-semibold mt-0.5 animate-pulse">Exceeds legal limit of ₹25,000</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hra" className="text-xs font-medium">HRA Exemption Amount</Label>
                        <Input
                          id="hra"
                          type="number"
                          disabled={!editing}
                          value={hraExemption}
                          onChange={(e) => setHraExemption(e.target.value)}
                          className="h-10 border-border/50 bg-background/50"
                          placeholder="₹ Annual HRA"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // US Specific Deductions
                <div className="space-y-4 border-t border-border/40 pt-4">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <Receipt className="w-3.5 h-3.5 text-primary" /> Pre-Tax Deductions & Benefits
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="pretax" className="text-xs font-medium">Pre-Tax Allocations (401k, HSA, Medical)</Label>
                      <Input
                        id="pretax"
                        type="number"
                        disabled={!editing}
                        value={preTaxDeductions}
                        onChange={(e) => setPreTaxDeductions(e.target.value)}
                        className="h-10 border-border/50 bg-background/50"
                        placeholder="$ Annual Pre-Tax"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Supporting Proof Link */}
              <div className="space-y-1.5 border-t border-border/40 pt-4">
                <Label htmlFor="proofUrl" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Supporting Proof Link (Google Drive / Dropbox / Cloud Storage URL)</Label>
                {editing ? (
                  <Input
                    id="proofUrl"
                    type="url"
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    className="h-10 border-border/50 bg-background/50 animate-in slide-in-from-top-2 duration-300"
                    placeholder="https://drive.google.com/..."
                  />
                ) : (
                  proofUrl ? (
                    <p className="text-sm font-semibold py-2">
                      <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-focus hover:underline flex items-center gap-1.5 transition-colors">
                        <ArrowRight className="w-3.5 h-3.5" /> View Submitted Proof Document
                      </a>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic py-2">No proof document uploaded yet.</p>
                  )
                )}
              </div>
            </div>

            {/* Projections Panel */}
            <div className="lg:col-span-5">
              <Card className="border border-primary/20 bg-primary/5 shadow-inner overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <CardContent className="p-6 space-y-6">
                  <div>
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" /> Real-time Projections
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Estimated deductions based on base monthly pay of {currencySymbol}{baseSalary.toLocaleString()}</p>
                  </div>

                  {projections && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="p-3.5 bg-background border border-border/40 rounded-xl">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Monthly Gross</p>
                          <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">{currencySymbol}{projections.grossMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="p-3.5 bg-background border border-border/40 rounded-xl">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Est. Net Take-Home</p>
                          <p className="text-lg font-bold text-emerald-600 mt-0.5 tabular-nums">{currencySymbol}{projections.netTakeHomeMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-primary/10">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Estimated Income Tax (Monthly)</span>
                          <span className="font-semibold text-destructive/80 tabular-nums">-{currencySymbol}{projections.incomeTaxMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">{jurisdiction === 'IND' ? 'EPF Contribution (Monthly)' : 'FICA (Social Security & Medicare)'}</span>
                          <span className="font-semibold text-destructive/80 tabular-nums">-{currencySymbol}{projections.statutoryDeductionsMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-semibold border-t border-dashed border-border/30 pt-2 text-foreground">
                          <span>Total Monthly Deductions</span>
                          <span className="tabular-nums">-{currencySymbol}{(projections.incomeTaxMonthly + projections.statutoryDeductionsMonthly).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-700 flex gap-1.5 items-center">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>Compliant progressive tax projections applied successfully.</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      )}
    </ProfileSectionCard>
  );
}
