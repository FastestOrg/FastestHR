import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { formatAmount } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Zap, DollarSign, ShieldCheck, CheckCircle2, AlertCircle,
  Building2, ArrowRight, Clock, Sparkles
} from 'lucide-react';

export interface EarnedWageAccessDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  monthlySalary: number;
  currencySymbol: string;
  bankAccountMasked?: string;
  bankName?: string;
  onRequestDisbursal?: (amount: number) => Promise<void>;
}

export function EarnedWageAccessDialog({
  isOpen,
  onOpenChange,
  employeeName,
  monthlySalary = 60000,
  currencySymbol = '₹',
  bankAccountMasked = '•••• 4892',
  bankName = 'HDFC Bank',
  onRequestDisbursal,
}: EarnedWageAccessDialogProps) {
  // Current calendar day in the month
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  // Accrued earnings based on elapsed days in active cycle
  const dailyRate = monthlySalary / daysInMonth;
  const accruedEarnings = Math.round(dailyRate * Math.min(currentDay, daysInMonth));
  const maxEligibleAdvance = Math.round(accruedEarnings * 0.5); // 50% safety cap

  const [requestedAmount, setRequestedAmount] = useState<number>(Math.min(5000, maxEligibleAdvance));
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleWithdraw = async () => {
    if (requestedAmount <= 0) {
      toast.error('Please select an amount greater than 0');
      return;
    }
    if (requestedAmount > maxEligibleAdvance) {
      toast.error(`Maximum eligible advance is ${currencySymbol}${formatAmount(maxEligibleAdvance)}`);
      return;
    }

    setSubmitting(true);
    try {
      if (onRequestDisbursal) {
        await onRequestDisbursal(requestedAmount);
      } else {
        // Simulate immediate API settlement
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      setIsSuccess(true);
      toast.success(`Earned Wage Access request of ${currencySymbol}${formatAmount(requestedAmount)} initiated!`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to process advance request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSuccess(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                Instant Earned Wage Access (EWA)
                <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/5 text-[10px]">
                  0% Interest
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Access your already-earned salary for mid-month emergencies with zero debt
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-success/10 text-success flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Disbursal Initiated!</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {currencySymbol}{formatAmount(requestedAmount)} has been routed to your linked account ({bankAccountMasked}).
              </p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground w-full">
              This amount will be automatically reconciled and deducted from your regular monthly payslip.
            </div>
            <Button className="w-full" onClick={handleReset}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-5 py-3">
            {/* Accrual Card */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-muted/30 border-border/60">
                <CardContent className="p-3.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Days Elapsed
                  </p>
                  <p className="text-xl font-bold mt-1">
                    Day {currentDay} <span className="text-xs font-normal text-muted-foreground">of {daysInMonth}</span>
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3.5">
                  <p className="text-xs text-primary font-medium flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> Accrued Earnings
                  </p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {currencySymbol}{formatAmount(accruedEarnings)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Withdrawal Slider */}
            <div className="space-y-3 p-4 rounded-xl border border-border/80 bg-card/60">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-foreground">Withdrawal Amount</span>
                <span className="text-lg font-mono font-bold text-primary">
                  {currencySymbol}{formatAmount(requestedAmount)}
                </span>
              </div>

              <Slider
                value={[requestedAmount]}
                min={1000}
                max={Math.max(1000, maxEligibleAdvance)}
                step={500}
                onValueChange={(val) => setRequestedAmount(val[0])}
                disabled={maxEligibleAdvance < 1000}
              />

              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Min: {currencySymbol}1,000</span>
                <span>Max Available (50% cap): {currencySymbol}{formatAmount(maxEligibleAdvance)}</span>
              </div>
            </div>

            {/* Payout Destination */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20 text-xs">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-foreground">{bankName}</p>
                  <p className="text-muted-foreground font-mono text-[11px]">{bankAccountMasked}</p>
                </div>
              </div>
              <Badge variant="outline" className="border-success/30 text-success text-[10px] bg-success/5">
                Verified Direct Payout
              </Badge>
            </div>

            {/* Explainer Note */}
            <div className="p-3 rounded-lg bg-muted/40 text-[11px] text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Zero Balance-Sheet Risk
              </div>
              <p>
                Earned Wage Access is not a loan or credit card. It is your earned salary disbursed early. 0% interest, no credit score impact, and automated end-of-month reconciliation.
              </p>
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                disabled={submitting || maxEligibleAdvance < 1000}
                onClick={handleWithdraw}
              >
                {submitting ? 'Processing...' : (
                  <>Disburse {currencySymbol}{formatAmount(requestedAmount)} <ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
