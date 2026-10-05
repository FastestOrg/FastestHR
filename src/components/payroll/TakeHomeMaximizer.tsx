import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatAmount } from '@/lib/utils';
import { calculatePayrollTaxAndNet, getComplianceSlabs, CURRENT_FISCAL_YEAR } from '@/utils/compliance-formulas';
import {
  Sparkles, TrendingUp, ShieldCheck, DollarSign, Landmark,
  ArrowRight, CheckCircle2, AlertCircle, Info, Calculator
} from 'lucide-react';

export interface TakeHomeMaximizerProps {
  initialSalary?: number;
  jurisdiction?: 'IND' | 'USA';
  currencySymbol?: string;
  onApplyDeclaration?: (declaration: any) => void;
}

export function TakeHomeMaximizer({
  initialSalary = 75000,
  jurisdiction = 'IND',
  currencySymbol = '₹',
  onApplyDeclaration,
}: TakeHomeMaximizerProps) {
  // Monthly Gross
  const [monthlyGross, setMonthlyGross] = useState<number>(initialSalary);

  // Allowances & Deductions
  const [basicPercent, setBasicPercent] = useState<number>(50);
  const [section80C, setSection80C] = useState<number>(150000);
  const [section80D, setSection80D] = useState<number>(25000);
  const [npsContribution, setNpsContribution] = useState<number>(50000);
  const [hraRentAnnual, setHraRentAnnual] = useState<number>(180000);
  const [fuelMealAllowanceMonthly, setFuelMealAllowanceMonthly] = useState<number>(3000);

  const annualGross = monthlyGross * 12;

  // Real-time calculations for both Old and New Tax Regimes (FY 2025-26)
  const oldRegimeResult = useMemo(() => {
    if (jurisdiction === 'USA') {
      return calculatePayrollTaxAndNet('USA', monthlyGross, { pre_tax_deductions: (fuelMealAllowanceMonthly * 12) / 12 });
    }

    // India Old Regime calculation
    // HRA Exemption estimate = Min of (Rent - 10% of basic, 50% of basic, HRA received)
    const annualBasic = annualGross * (basicPercent / 100);
    const tenPercentBasic = annualBasic * 0.10;
    const estimatedHRAExemption = Math.max(0, Math.min(hraRentAnnual - tenPercentBasic, annualBasic * 0.40));

    const totalOldDeductions = Math.min(150000, section80C) +
      Math.min(25000, section80D) +
      Math.min(50000, npsContribution) +
      estimatedHRAExemption;

    return calculatePayrollTaxAndNet('IND', monthlyGross, {
      regime: 'old',
      fiscal_year: CURRENT_FISCAL_YEAR,
      section_80c: Math.min(150000, section80C),
      section_80d: Math.min(25000, section80D),
      hra_exemption: estimatedHRAExemption,
      pre_tax_deductions: npsContribution,
    });
  }, [monthlyGross, annualGross, basicPercent, section80C, section80D, npsContribution, hraRentAnnual, fuelMealAllowanceMonthly, jurisdiction]);

  const newRegimeResult = useMemo(() => {
    if (jurisdiction === 'USA') {
      return calculatePayrollTaxAndNet('USA', monthlyGross, {});
    }

    return calculatePayrollTaxAndNet('IND', monthlyGross, {
      regime: 'new',
      fiscal_year: CURRENT_FISCAL_YEAR,
    });
  }, [monthlyGross, jurisdiction]);

  // Comparison metrics
  const oldNetMonthly = oldRegimeResult.netTakeHomeMonthly;
  const newNetMonthly = newRegimeResult.netTakeHomeMonthly;
  const differenceMonthly = Math.abs(newNetMonthly - oldNetMonthly);
  const isNewBetter = newNetMonthly >= oldNetMonthly;
  const recommendedRegime = isNewBetter ? 'new' : 'old';

  return (
    <Card className="border border-border/80 shadow-sm bg-card/60 backdrop-blur-sm overflow-hidden">
      <CardHeader className="bg-muted/20 border-b border-border/60 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                FastestHR Take-Home Maximizer
                <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 text-[10px]">
                  FY 2025–26 Simulator
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Simulate tax regimes, flexi-allowances, and maximize your monthly in-hand cash
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`px-2.5 py-1 text-xs font-semibold ${
                isNewBetter ? 'border-success text-success bg-success/5' : 'border-info text-info bg-info/5'
              }`}
            >
              Recommended: {isNewBetter ? 'New Tax Regime' : 'Old Tax Regime'} (+{currencySymbol}{formatAmount(differenceMonthly)}/mo)
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Base Gross Salary Input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border/60">
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Monthly Gross Salary</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-semibold">{currencySymbol}</span>
              <Input
                type="number"
                className="pl-8 font-semibold text-base h-10"
                value={monthlyGross}
                onChange={(e) => setMonthlyGross(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Annual CTC Equivalent</Label>
            <p className="mt-2 text-xl font-bold text-foreground">
              {currencySymbol}{formatAmount(annualGross)} <span className="text-xs font-normal text-muted-foreground">/ year</span>
            </p>
          </div>
        </div>

        {/* Side-by-Side Regime Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* New Regime Card */}
          <Card className={`relative transition-all border-2 ${isNewBetter ? 'border-success shadow-md shadow-success/5' : 'border-border/60'}`}>
            {isNewBetter && (
              <div className="absolute -top-3 right-4 bg-success text-success-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <CheckCircle2 className="h-3 w-3" /> BEST IN-HAND CASH
              </div>
            )}
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-foreground">New Tax Regime</h3>
                  <p className="text-xs text-muted-foreground">Default 2025-26 • ₹75,000 Standard Deduction</p>
                </div>
                <Badge variant="outline" className="text-xs">No Proofs Required</Badge>
              </div>

              <div className="space-y-2 pt-2 border-t text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross Monthly</span>
                  <span className="font-mono">{currencySymbol}{formatAmount(monthlyGross)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Standard Deduction (Annual)</span>
                  <span className="font-mono text-success">₹75,000</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Monthly Income Tax (TDS)</span>
                  <span className="font-mono text-destructive">
                    {currencySymbol}{formatAmount(newRegimeResult.incomeTaxMonthly)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Statutory (EPF/ESI)</span>
                  <span className="font-mono">
                    {currencySymbol}{formatAmount(newRegimeResult.statutoryDeductionsMonthly)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Net In-Hand (Monthly)</p>
                  <p className="text-2xl font-bold text-foreground">
                    {currencySymbol}{formatAmount(newNetMonthly)}
                  </p>
                </div>
                {onApplyDeclaration && (
                  <Button
                    size="sm"
                    variant={isNewBetter ? 'default' : 'outline'}
                    className="text-xs h-8"
                    onClick={() => onApplyDeclaration({ regime: 'new' })}
                  >
                    Select New Regime
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Old Regime Card */}
          <Card className={`relative transition-all border-2 ${!isNewBetter ? 'border-info shadow-md shadow-info/5' : 'border-border/60'}`}>
            {!isNewBetter && (
              <div className="absolute -top-3 right-4 bg-info text-info-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <CheckCircle2 className="h-3 w-3" /> BEST WITH DEDUCTIONS
              </div>
            )}
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-foreground">Old Tax Regime</h3>
                  <p className="text-xs text-muted-foreground">80C, 80D, HRA & NPS Deductions Eligible</p>
                </div>
                <Badge variant="outline" className="text-xs">Proofs Mandatory</Badge>
              </div>

              <div className="space-y-2 pt-2 border-t text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross Monthly</span>
                  <span className="font-mono">{currencySymbol}{formatAmount(monthlyGross)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Declared Deductions (Annual)</span>
                  <span className="font-mono text-success">
                    {currencySymbol}{formatAmount(section80C + section80D + npsContribution)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Monthly Income Tax (TDS)</span>
                  <span className="font-mono text-destructive">
                    {currencySymbol}{formatAmount(oldRegimeResult.incomeTaxMonthly)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Statutory (EPF/ESI)</span>
                  <span className="font-mono">
                    {currencySymbol}{formatAmount(oldRegimeResult.statutoryDeductionsMonthly)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Net In-Hand (Monthly)</p>
                  <p className="text-2xl font-bold text-foreground">
                    {currencySymbol}{formatAmount(oldNetMonthly)}
                  </p>
                </div>
                {onApplyDeclaration && (
                  <Button
                    size="sm"
                    variant={!isNewBetter ? 'default' : 'outline'}
                    className="text-xs h-8"
                    onClick={() => onApplyDeclaration({
                      regime: 'old',
                      section_80c: section80C,
                      section_80d: section80D,
                      pre_tax_deductions: npsContribution,
                    })}
                  >
                    Select Old Regime
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Interactive Sliders for Old Regime Optimization */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm text-foreground">Fine-Tune Allowances & Tax Shields</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Section 80C */}
            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/10 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium">Section 80C (EPF, PPF, ELSS)</span>
                <span className="font-mono font-semibold text-primary">{currencySymbol}{formatAmount(section80C)}</span>
              </div>
              <Slider
                value={[section80C]}
                min={0}
                max={150000}
                step={5000}
                onValueChange={(val) => setSection80C(val[0])}
              />
              <p className="text-[10px] text-muted-foreground">Max limit: ₹1,50,000 / year</p>
            </div>

            {/* Section 80D */}
            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/10 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium">Section 80D (Health Insurance)</span>
                <span className="font-mono font-semibold text-primary">{currencySymbol}{formatAmount(section80D)}</span>
              </div>
              <Slider
                value={[section80D]}
                min={0}
                max={50000}
                step={2500}
                onValueChange={(val) => setSection80D(val[0])}
              />
              <p className="text-[10px] text-muted-foreground">Self/Family (₹25k) + Senior Parents (₹50k)</p>
            </div>

            {/* NPS Section 80CCD(1B) */}
            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/10 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium">NPS 80CCD(1B) Additional Shield</span>
                <span className="font-mono font-semibold text-primary">{currencySymbol}{formatAmount(npsContribution)}</span>
              </div>
              <Slider
                value={[npsContribution]}
                min={0}
                max={50000}
                step={5000}
                onValueChange={(val) => setNpsContribution(val[0])}
              />
              <p className="text-[10px] text-muted-foreground">Additional ₹50,000 tax deduction above 80C</p>
            </div>

            {/* Annual Rent for HRA */}
            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/10 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium">Annual House Rent Paid (HRA Exemption)</span>
                <span className="font-mono font-semibold text-primary">{currencySymbol}{formatAmount(hraRentAnnual)}</span>
              </div>
              <Slider
                value={[hraRentAnnual]}
                min={0}
                max={600000}
                step={10000}
                onValueChange={(val) => setHraRentAnnual(val[0])}
              />
              <p className="text-[10px] text-muted-foreground">Requires rent receipts and landlord PAN if &gt; ₹1L</p>
            </div>
          </div>
        </div>

        {/* AI Tax Optimization Tips */}
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> FastestAI Tax Advisory Notes
          </div>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {annualGross <= 1200000 ? (
              <li>
                Under the New Tax Regime with ₹75,000 standard deduction, incomes up to ₹7,75,000 enjoy zero tax liability under Section 87A rebate!
              </li>
            ) : null}
            {npsContribution < 50000 ? (
              <li>
                Maximizing NPS under Section 80CCD(1B) by an extra ₹{formatAmount(50000 - npsContribution)} can legally save you up to ₹{formatAmount((50000 - npsContribution) * 0.312)} in taxes under Old Regime.
              </li>
            ) : null}
            <li>
              You can switch between Old and New regimes annually during the tax declaration window before payroll processing.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
