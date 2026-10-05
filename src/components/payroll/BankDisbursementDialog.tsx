import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2,
  Download,
  DollarSign,
  FileSpreadsheet,
  CheckCircle2,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import {
  BankFormat,
  BankDisbursementRecord,
  generateBankDisbursementFile,
  downloadBankDisbursementFile,
} from '@/lib/payroll/bankDisbursementExport';
import { toast } from 'sonner';

interface BankDisbursementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName?: string;
  currency?: string;
  payslips: any[];
}

export function BankDisbursementDialog({
  open,
  onOpenChange,
  companyName = 'Company',
  currency = 'USD',
  payslips = [],
}: BankDisbursementDialogProps) {
  const [format, setFormat] = useState<BankFormat>('generic_csv');

  const totalDisbursement = payslips.reduce((sum, p) => sum + (Number(p.net_salary) || 0), 0);

  const handleExport = () => {
    if (payslips.length === 0) {
      toast.error('No payslips available in current cycle to export');
      return;
    }

    const records: BankDisbursementRecord[] = payslips.map((p) => {
      const emp = p.employees;
      const fullName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : 'Employee';
      return {
        employeeId: p.employee_id || emp?.id || 'EMP',
        employeeName: fullName,
        accountNumber: emp?.bank_account_number || emp?.account_number || 'A/C PENDING',
        routingOrIfsc: emp?.bank_ifsc || emp?.routing_number || 'ROUTING PENDING',
        bankName: emp?.bank_name || 'Corporate Bank',
        netSalary: Number(p.net_salary) || 0,
        currency: currency,
        paymentReference: p.id ? p.id.slice(0, 8) : 'REF',
      };
    });

    const file = generateBankDisbursementFile({
      format,
      records,
      companyName,
    });

    downloadBankDisbursementFile(file);
    toast.success(`Generated bank disbursement file: ${file.filename}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-border/80 shadow-2xl p-6">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2 text-primary">
            <Building2 className="w-5 h-5" />
            <DialogTitle className="text-xl font-bold tracking-tight">
              Bank Disbursement Export
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Generate 1-click batch payout files formatted for corporate banking portals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-3">
          {/* Summary Card */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Total Batch Disbursement
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-0.5">
                {currency} {totalDisbursement.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {payslips.length} employee payslips queued for payout
              </p>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10 text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
            </Badge>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select Corporate Bank File Format
            </Label>
            <Select value={format} onValueChange={(val) => setFormat(val as BankFormat)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Choose bank format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="india_neft">
                  🇮🇳 India — NEFT / RTGS (HDFC / ICICI / SBI Batch Format)
                </SelectItem>
                <SelectItem value="us_ach">
                  🇺🇸 United States — NACHA / ACH Direct Deposit
                </SelectItem>
                <SelectItem value="sepa_eu">
                  🇪🇺 European Union / UK — SEPA Credit Transfer (IBAN/BIC)
                </SelectItem>
                <SelectItem value="generic_csv">
                  🌐 Global Universal — Standardized Multi-Currency CSV
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>CWE-1236 Formula Sanitization Protected</span>
            </div>
            <p className="text-[11px] text-muted-foreground/90">
              All employee names and references are sanitized against spreadsheet formula injection attacks.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:flex-1">
            Cancel
          </Button>
          <Button onClick={handleExport} className="w-full sm:flex-1 gap-2 shadow-sm font-semibold">
            <Download className="w-4 h-4" /> Download Batch File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
