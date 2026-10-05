import { sanitizeCsvCell } from '@/lib/csv-parser';

export type BankFormat = 'india_neft' | 'us_ach' | 'sepa_eu' | 'generic_csv';

export interface BankDisbursementRecord {
  employeeId: string;
  employeeName: string;
  accountNumber?: string;
  routingOrIfsc?: string;
  bankName?: string;
  netSalary: number;
  currency: string;
  paymentReference: string;
}

/**
 * Generates formatted banking batch disbursement files
 * for automated multi-country salary payouts.
 */
export function generateBankDisbursementFile({
  format,
  records,
  companyName = 'Company',
  paymentDate = new Date().toISOString().split('T')[0],
}: {
  format: BankFormat;
  records: BankDisbursementRecord[];
  companyName?: string;
  paymentDate?: string;
}): { filename: string; content: string; mimeType: string } {
  const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9]/g, '_');

  switch (format) {
    case 'india_neft': {
      // Standard HDFC / ICICI / SBI Corporate NEFT/RTGS Batch Format
      const headers = [
        'Transaction Type',
        'Beneficiary Account No',
        'Beneficiary Name',
        'IFSC Code',
        'Amount',
        'Payment Date',
        'Remarks',
      ];

      const rows = records.map((rec) => [
        'NEFT',
        sanitizeCsvCell(rec.accountNumber || 'PENDING_ACC'),
        sanitizeCsvCell(rec.employeeName),
        sanitizeCsvCell(rec.routingOrIfsc || 'HDFC0000001'),
        rec.netSalary.toFixed(2),
        paymentDate,
        sanitizeCsvCell(`Salary_${paymentDate}_${rec.paymentReference}`),
      ]);

      const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return {
        filename: `${cleanCompanyName}_NEFT_Disbursement_${paymentDate}.csv`,
        content,
        mimeType: 'text/csv;charset=utf-8;',
      };
    }

    case 'us_ach': {
      // US ACH / NACHA Direct Deposit Format
      const headers = [
        'Employee ID',
        'Employee Name',
        'Routing Transit Number',
        'Bank Account Number',
        'Account Type',
        'Amount (USD)',
        'Payment Description',
        'Effective Date',
      ];

      const rows = records.map((rec) => [
        sanitizeCsvCell(rec.employeeId),
        sanitizeCsvCell(rec.employeeName),
        sanitizeCsvCell(rec.routingOrIfsc || '021000021'),
        sanitizeCsvCell(rec.accountNumber || '000000000'),
        'Checking',
        rec.netSalary.toFixed(2),
        sanitizeCsvCell(`SALARY ${companyName.toUpperCase().slice(0, 10)}`),
        paymentDate,
      ]);

      const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return {
        filename: `${cleanCompanyName}_ACH_Disbursement_${paymentDate}.csv`,
        content,
        mimeType: 'text/csv;charset=utf-8;',
      };
    }

    case 'sepa_eu': {
      // SEPA European Union / UK IBAN Credit Transfer
      const headers = [
        'Beneficiary Name',
        'IBAN',
        'BIC_SWIFT',
        'Amount (EUR)',
        'Currency',
        'Remittance Information',
        'Requested Execution Date',
      ];

      const rows = records.map((rec) => [
        sanitizeCsvCell(rec.employeeName),
        sanitizeCsvCell(rec.accountNumber || 'DE89370400440532013000'),
        sanitizeCsvCell(rec.routingOrIfsc || 'DBEUMM2LXXX'),
        rec.netSalary.toFixed(2),
        'EUR',
        sanitizeCsvCell(`Monthly Payroll - ${paymentDate}`),
        paymentDate,
      ]);

      const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return {
        filename: `${cleanCompanyName}_SEPA_Disbursement_${paymentDate}.csv`,
        content,
        mimeType: 'text/csv;charset=utf-8;',
      };
    }

    case 'generic_csv':
    default: {
      const headers = [
        'Employee Name',
        'Account Number',
        'Routing / IFSC / Sort Code',
        'Bank Name',
        'Net Amount',
        'Currency',
        'Payment Reference',
        'Payment Date',
      ];

      const rows = records.map((rec) => [
        sanitizeCsvCell(rec.employeeName),
        sanitizeCsvCell(rec.accountNumber || 'N/A'),
        sanitizeCsvCell(rec.routingOrIfsc || 'N/A'),
        sanitizeCsvCell(rec.bankName || 'Standard Bank'),
        rec.netSalary.toFixed(2),
        rec.currency,
        sanitizeCsvCell(rec.paymentReference),
        paymentDate,
      ]);

      const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return {
        filename: `${cleanCompanyName}_Payroll_Batch_${paymentDate}.csv`,
        content,
        mimeType: 'text/csv;charset=utf-8;',
      };
    }
  }
}

/**
 * Triggers a browser download of the generated disbursement batch file.
 */
export function downloadBankDisbursementFile(fileData: {
  filename: string;
  content: string;
  mimeType: string;
}): void {
  const blob = new Blob([fileData.content], { type: fileData.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileData.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
