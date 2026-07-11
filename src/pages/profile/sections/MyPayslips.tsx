import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { FileText, Download, DollarSign, Calendar, Loader2 } from 'lucide-react';
import { generateAndDownloadPayslipPDF } from '@/lib/pdf-generator';
import { getCurrencySymbol, formatAmount } from '@/lib/utils';

interface MyPayslipsProps {
  employee: any;
}

export default function MyPayslips({ employee }: MyPayslipsProps) {
  const queryClient = useQueryClient();
  const [downloadingSlipId, setDownloadingSlipId] = useState<string | null>(null);

  // Fetch company details for currency/name
  const { data: companyProfile } = useQuery({
    queryKey: ['company-profile-payslips', employee.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('name, currency')
        .eq('id', employee.company_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!employee.company_id,
  });

  const currencySymbol = getCurrencySymbol(companyProfile?.currency);

  // Fetch all payslips generated for this employee
  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ['my-payslips-archive', employee.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payslips')
        .select('*, payroll_runs(period_start, period_end, status)')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee.id,
  });

  const handleDownload = async (slip: any) => {
    setDownloadingSlipId(slip.id);
    try {
      await generateAndDownloadPayslipPDF({
        companyName: companyProfile?.name || 'FastestHR Company',
        employeeName: `${employee.first_name} ${employee.last_name}`,
        employeeEmail: employee.work_email || employee.personal_email || '',
        employeeCode: employee.employee_code || undefined,
        department: employee.departments?.name || undefined,
        designation: employee.designations?.title || employee.designations?.name || undefined,
        periodStart: slip.payroll_runs?.period_start || '',
        periodEnd: slip.payroll_runs?.period_end || '',
        slip,
        currency: companyProfile?.currency || 'USD',
      });
      toast.success('Payslip downloaded successfully');
      queryClient.invalidateQueries({ queryKey: ['my-payslips-archive'] });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download payslip');
    } finally {
      setDownloadingSlipId(null);
    }
  };

  const statusColor: Record<string, string> = {
    draft: 'border-muted text-muted-foreground bg-muted/5',
    processing: 'border-warning text-warning bg-warning/10',
    review: 'border-info text-info bg-info/10',
    finalized: 'border-success text-success bg-success/10',
    paid: 'border-success text-success bg-success/10',
  };

  return (
    <Card className="overflow-hidden border-border/40 shadow-sm animate-in fade-in duration-500">
      <CardHeader className="border-b border-border/10 bg-muted/20 pb-4">
        <CardTitle className="text-foreground font-semibold text-base flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Payslip Directory
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Access all your official monthly payslips, pre-tax breakdowns, and deductions.
        </p>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : payslips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500 gap-4">
            <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-foreground font-semibold">No payslips generated yet</p>
              <p className="text-muted-foreground text-xs mt-1 max-w-xs">
                Once your payroll cycles are processed and finalized by the HR department, they will be listed here.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {payslips.map((slip: any) => {
              const isDownloading = downloadingSlipId === slip.id;
              const hasOT = slip.breakdown?.overtime_payout > 0;
              const hasPenalty = slip.breakdown?.attendance_penalty > 0;

              return (
                <div
                  key={slip.id}
                  className="flex flex-col justify-between p-4 rounded-xl border border-border/40 bg-background/40 hover:border-primary/20 hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          {slip.payroll_runs?.period_start} — {slip.payroll_runs?.period_end}
                        </h4>
                        <Badge
                          variant="outline"
                          className={`uppercase text-[8px] font-semibold mt-1.5 ${
                            statusColor[slip.payroll_runs?.status] || 'border-muted text-muted-foreground'
                          }`}
                        >
                          {slip.payroll_runs?.status || 'processed'}
                        </Badge>
                      </div>
                      <span className="text-lg font-bold text-emerald-500 font-mono">
                        {currencySymbol}
                        {formatAmount(slip.net_salary || 0, companyProfile?.currency)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-muted/10 p-2.5 rounded-lg border border-border/10 text-xs font-mono">
                      <div>
                        <span className="text-[9px] text-muted-foreground block uppercase">Gross Salary</span>
                        <span className="font-medium text-foreground">
                          {currencySymbol}
                          {formatAmount(slip.gross_salary || 0, companyProfile?.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block uppercase">Deductions</span>
                        <span className="font-medium text-destructive">
                          {currencySymbol}
                          {formatAmount(slip.total_deductions || 0, companyProfile?.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Show breakdown warnings if applicable */}
                    {(hasOT || hasPenalty) && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {hasOT && (
                          <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-none">
                            OT: +{currencySymbol}{formatAmount(slip.breakdown.overtime_payout, companyProfile?.currency)}
                          </Badge>
                        )}
                        {hasPenalty && (
                          <Badge variant="secondary" className="text-[9px] bg-destructive/10 text-destructive border-none">
                            Late Penalty: -{currencySymbol}{formatAmount(slip.breakdown.attendance_penalty, companyProfile?.currency)}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-border/10 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isDownloading}
                      onClick={() => handleDownload(slip)}
                      className="h-8 flex-1 text-xs font-semibold rounded-lg shadow-sm transition-all gap-1.5"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Preparing...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Payslip</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
