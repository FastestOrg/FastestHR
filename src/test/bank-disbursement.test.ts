import { describe, it, expect } from 'vitest';
import {
  generateBankDisbursementFile,
  BankDisbursementRecord,
} from '@/lib/payroll/bankDisbursementExport';

const mockRecords: BankDisbursementRecord[] = [
  {
    employeeId: 'emp-001',
    employeeName: 'Sarah Connor',
    accountNumber: '1234567890',
    routingOrIfsc: 'HDFC0001234',
    bankName: 'HDFC Bank',
    netSalary: 45000.5,
    currency: 'INR',
    paymentReference: 'SAL-001',
  },
  {
    employeeId: 'emp-002',
    employeeName: '=CMD|calc.exe!A0', // Test formula injection attempt
    accountNumber: '9876543210',
    routingOrIfsc: '021000021',
    bankName: 'Chase Bank',
    netSalary: 5200.0,
    currency: 'USD',
    paymentReference: 'SAL-002',
  },
];

describe('generateBankDisbursementFile', () => {
  it('generates India NEFT format with sanitized CSV cells and correct columns', () => {
    const file = generateBankDisbursementFile({
      format: 'india_neft',
      records: mockRecords,
      companyName: 'Acme Corp',
      paymentDate: '2026-10-31',
    });

    expect(file.filename).toBe('Acme_Corp_NEFT_Disbursement_2026-10-31.csv');
    expect(file.mimeType).toBe('text/csv;charset=utf-8;');

    const lines = file.content.split('\n');
    expect(lines[0]).toBe(
      'Transaction Type,Beneficiary Account No,Beneficiary Name,IFSC Code,Amount,Payment Date,Remarks'
    );

    // Row 1
    expect(lines[1]).toContain('NEFT');
    expect(lines[1]).toContain('1234567890');
    expect(lines[1]).toContain('Sarah Connor');
    expect(lines[1]).toContain('HDFC0001234');
    expect(lines[1]).toContain('45000.50');

    // Row 2: Formula injection attack sanitized with prepended single quote
    expect(lines[2]).toContain("\"'=CMD|calc.exe!A0\"");
  });

  it('generates US ACH NACHA format', () => {
    const file = generateBankDisbursementFile({
      format: 'us_ach',
      records: mockRecords,
      companyName: 'Acme US',
      paymentDate: '2026-10-31',
    });

    expect(file.filename).toBe('Acme_US_ACH_Disbursement_2026-10-31.csv');
    const lines = file.content.split('\n');
    expect(lines[0]).toBe(
      'Employee ID,Employee Name,Routing Transit Number,Bank Account Number,Account Type,Amount (USD),Payment Description,Effective Date'
    );
    expect(lines[1]).toContain('emp-001');
    expect(lines[1]).toContain('Checking');
  });

  it('generates European SEPA format', () => {
    const file = generateBankDisbursementFile({
      format: 'sepa_eu',
      records: mockRecords,
      companyName: 'Acme EU',
      paymentDate: '2026-10-31',
    });

    expect(file.filename).toBe('Acme_EU_SEPA_Disbursement_2026-10-31.csv');
    const lines = file.content.split('\n');
    expect(lines[0]).toBe(
      'Beneficiary Name,IBAN,BIC_SWIFT,Amount (EUR),Currency,Remittance Information,Requested Execution Date'
    );
    expect(lines[1]).toContain('EUR');
  });

  it('generates Universal CSV format', () => {
    const file = generateBankDisbursementFile({
      format: 'generic_csv',
      records: mockRecords,
      companyName: 'Acme Global',
      paymentDate: '2026-10-31',
    });

    expect(file.filename).toBe('Acme_Global_Payroll_Batch_2026-10-31.csv');
    const lines = file.content.split('\n');
    expect(lines[0]).toBe(
      'Employee Name,Account Number,Routing / IFSC / Sort Code,Bank Name,Net Amount,Currency,Payment Reference,Payment Date'
    );
  });
});
