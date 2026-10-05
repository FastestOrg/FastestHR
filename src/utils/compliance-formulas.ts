/**
 * Statutory Compliance and Progressive Tax localization formulas.
 * Supports USA (FICA + Progressive Federal Slabs) and IND (New Tax Regime vs Old Tax Regime + EPF/ESI).
 * Includes multi-year fiscal compliance versioning (FY 2023-24, FY 2024-25, FY 2025-26).
 */

export type FiscalYear = 'FY2023_2024' | 'FY2024_2025' | 'FY2025_2026';
export const CURRENT_FISCAL_YEAR: FiscalYear = 'FY2025_2026';

export interface TaxBreakdown {
  grossMonthly: number;
  grossAnnual: number;
  taxableIncome: number;
  incomeTaxMonthly: number;
  incomeTaxAnnual: number;
  statutoryDeductionsMonthly: number;
  netTakeHomeMonthly: number;
  details: Record<string, unknown>;
}

export interface TaxDeclarations {
  regime?: 'new' | 'old';
  fiscal_year?: FiscalYear;
  section_80c?: number;
  section_80d?: number;
  hra_exemption?: number;
  pre_tax_deductions?: number;
  [key: string]: unknown;
}

export interface TaxBracket {
  limit: number | null;
  rate: number;
}

export interface StatutorySlabs {
  jurisdiction: 'USA' | 'IND';
  fiscalYear: FiscalYear;
  standardDeduction: number;
  brackets: TaxBracket[];
  socialSecurityWageCap?: number;
  socialSecurityRate?: number;
  medicareRate?: number;
  additionalMedicareThreshold?: number;
  additionalMedicareRate?: number;
  rebate87ALimit?: number;
  cessRate?: number;
  regime?: 'new' | 'old';
}

/**
 * Returns versioned compliance slabs for statutory audits and calculations.
 */
export function getComplianceSlabs(
  jurisdiction: string,
  fiscalYear: FiscalYear = CURRENT_FISCAL_YEAR,
  regime: 'new' | 'old' = 'new'
): StatutorySlabs {
  const fy = fiscalYear || CURRENT_FISCAL_YEAR;

  if (jurisdiction === 'IND') {
    const isNew = regime === 'new';
    // Standard deduction: FY23-24 = 50k (both). FY24-25 / FY25-26 = 75k (new) / 50k (old).
    const standardDeduction = isNew ? (fy === 'FY2023_2024' ? 50000 : 75000) : 50000;

    const brackets: TaxBracket[] = isNew
      ? [
          { limit: 300000, rate: 0.00 },
          { limit: 600000, rate: 0.05 },
          { limit: 900000, rate: 0.10 },
          { limit: 1200000, rate: 0.15 },
          { limit: 1500000, rate: 0.20 },
          { limit: null, rate: 0.30 },
        ]
      : [
          { limit: 250000, rate: 0.00 },
          { limit: 500000, rate: 0.05 },
          { limit: 1000000, rate: 0.20 },
          { limit: null, rate: 0.30 },
        ];

    return {
      jurisdiction: 'IND',
      fiscalYear: fy,
      regime,
      standardDeduction,
      brackets,
      rebate87ALimit: isNew ? 700000 : 500000,
      cessRate: 0.04,
    };
  }

  // USA Slabs
  let standardDeduction = 15000;
  let socialSecurityWageCap = 168600;

  if (fy === 'FY2023_2024') {
    standardDeduction = 13850;
    socialSecurityWageCap = 160200;
  } else if (fy === 'FY2024_2025') {
    standardDeduction = 14600;
    socialSecurityWageCap = 168600;
  }

  const brackets: TaxBracket[] = [
    { limit: 11600, rate: 0.10 },
    { limit: 47150, rate: 0.12 },
    { limit: 100525, rate: 0.22 },
    { limit: 191950, rate: 0.24 },
    { limit: 243725, rate: 0.32 },
    { limit: 609350, rate: 0.35 },
    { limit: null, rate: 0.37 },
  ];

  return {
    jurisdiction: 'USA',
    fiscalYear: fy,
    standardDeduction,
    brackets,
    socialSecurityWageCap,
    socialSecurityRate: 0.062,
    medicareRate: 0.0145,
    additionalMedicareThreshold: 200000,
    additionalMedicareRate: 0.009,
  };
}

/**
 * Calculates progressive tax based on brackets
 */
function calculateProgressiveTax(taxableIncome: number, brackets: TaxBracket[]): number {
  let tax = 0;
  let previousLimit = 0;

  for (const bracket of brackets) {
    const limit = bracket.limit;
    const rate = bracket.rate;

    if (limit === null || taxableIncome <= limit) {
      tax += (taxableIncome - previousLimit) * rate;
      break;
    } else {
      tax += (limit - previousLimit) * rate;
      previousLimit = limit;
    }
  }

  return Math.max(0, tax);
}

/**
 * US Tax Calculations (Federal Income Tax + FICA)
 */
export function calculateUSTaxes(
  monthlyGross: number,
  declarations: TaxDeclarations = {},
  overrideFiscalYear?: FiscalYear
): TaxBreakdown {
  // Sanitize input to prevent NaN or negative numbers
  const sanitizedMonthlyGross = typeof monthlyGross === 'number' && !isNaN(monthlyGross) ? Math.max(0, monthlyGross) : 0;
  const grossAnnual = sanitizedMonthlyGross * 12;

  const safeDeclarations = declarations && typeof declarations === 'object' ? declarations : {};
  const fiscalYear: FiscalYear = overrideFiscalYear || safeDeclarations.fiscal_year || CURRENT_FISCAL_YEAR;
  const slabs = getComplianceSlabs('USA', fiscalYear);

  const standardDeduction = slabs.standardDeduction;
  const itemizedDeductions = Math.max(0, Number(safeDeclarations.pre_tax_deductions || 0));
  const taxableIncome = Math.max(0, grossAnnual - standardDeduction - itemizedDeductions);

  const federalTaxAnnual = calculateProgressiveTax(taxableIncome, slabs.brackets);
  const federalTaxMonthly = federalTaxAnnual / 12;

  // FICA Social Security
  const socialSecurityRate = slabs.socialSecurityRate ?? 0.062;
  const ssCap = slabs.socialSecurityWageCap ?? 168600;
  const ssAnnual = Math.min(grossAnnual, ssCap) * socialSecurityRate;
  const ssMonthly = ssAnnual / 12;

  // FICA Medicare
  const baseMedicareRate = slabs.medicareRate ?? 0.0145;
  const additionalThreshold = slabs.additionalMedicareThreshold ?? 200000;
  const additionalRate = slabs.additionalMedicareRate ?? 0.009;

  const baseMedicareAnnual = grossAnnual * baseMedicareRate;
  const additionalMedicareAnnual = grossAnnual > additionalThreshold ? (grossAnnual - additionalThreshold) * additionalRate : 0;
  const medicareMonthly = (baseMedicareAnnual + additionalMedicareAnnual) / 12;

  const statutoryMonthly = ssMonthly + medicareMonthly;
  const netMonthly = Math.max(0, sanitizedMonthlyGross - federalTaxMonthly - statutoryMonthly);

  return {
    grossMonthly: sanitizedMonthlyGross,
    grossAnnual,
    taxableIncome,
    incomeTaxMonthly: federalTaxMonthly,
    incomeTaxAnnual: federalTaxAnnual,
    statutoryDeductionsMonthly: statutoryMonthly,
    netTakeHomeMonthly: netMonthly,
    details: {
      fiscalYear,
      standardDeduction,
      taxableIncome,
      federalTaxAnnual,
      socialSecurityMonthly: ssMonthly,
      medicareMonthly,
      statutoryMonthly,
      additionalMedicareAnnual,
    },
  };
}

/**
 * India Tax Calculations (Regime choice + EPF + Progressive slabs)
 */
export function calculateIndiaTaxes(
  monthlyGross: number,
  declarations: TaxDeclarations = {},
  overrideFiscalYear?: FiscalYear
): TaxBreakdown {
  // Sanitize input to prevent NaN or negative numbers
  const sanitizedMonthlyGross = typeof monthlyGross === 'number' && !isNaN(monthlyGross) ? Math.max(0, monthlyGross) : 0;
  const grossAnnual = sanitizedMonthlyGross * 12;

  const safeDeclarations = declarations && typeof declarations === 'object' ? declarations : {};
  const regime: 'new' | 'old' = safeDeclarations.regime || 'new';
  const fiscalYear: FiscalYear = overrideFiscalYear || safeDeclarations.fiscal_year || CURRENT_FISCAL_YEAR;
  const slabs = getComplianceSlabs('IND', fiscalYear, regime);

  const standardDeduction = slabs.standardDeduction;

  // India EPF Employee contribution (12% of basic, basic assumed 50% of gross)
  const basicSalaryMonthly = sanitizedMonthlyGross * 0.50;
  const epfMonthly = basicSalaryMonthly * 0.12;

  let taxableIncome = Math.max(0, grossAnnual - standardDeduction);

  if (regime === 'old') {
    // Deductions under 80C, 80D, HRA for Old regime
    const section80C = Math.min(150000, Math.max(0, Number(safeDeclarations.section_80c || 0)) + (epfMonthly * 12));
    const section80D = Math.min(25000, Math.max(0, Number(safeDeclarations.section_80d || 0)));
    const hraExemption = Math.max(0, Number(safeDeclarations.hra_exemption || 0));

    taxableIncome = Math.max(0, taxableIncome - section80C - section80D - hraExemption);
  }

  let taxAnnual = calculateProgressiveTax(taxableIncome, slabs.brackets);

  // Apply Section 87A Tax Rebate
  let rebate87A = 0;
  if (regime === 'new') {
    const rebateLimit = slabs.rebate87ALimit ?? 700000;
    if (taxableIncome <= rebateLimit) {
      rebate87A = taxAnnual;
      taxAnnual = 0;
    } else {
      // New Regime Section 87A Marginal Relief:
      // Tax payable cannot exceed the amount by which taxable income exceeds ₹7,00,000
      const excessIncome = taxableIncome - rebateLimit;
      if (taxAnnual > excessIncome) {
        rebate87A = taxAnnual - excessIncome;
        taxAnnual = excessIncome;
      }
    }
  } else {
    // Old Regime: Tax rebate up to ₹12,500 if taxable income does not exceed ₹5,00,000
    if (taxableIncome <= 500000) {
      rebate87A = taxAnnual;
      taxAnnual = 0;
    }
  }

  // Health and Education Cess (4% on income tax after rebate/marginal relief)
  const cessRate = slabs.cessRate ?? 0.04;
  const cess = taxAnnual * cessRate;
  taxAnnual += cess;

  const taxMonthly = taxAnnual / 12;
  const statutoryMonthly = epfMonthly;

  const netMonthly = Math.max(0, sanitizedMonthlyGross - taxMonthly - statutoryMonthly);

  return {
    grossMonthly: sanitizedMonthlyGross,
    grossAnnual,
    taxableIncome,
    incomeTaxMonthly: taxMonthly,
    incomeTaxAnnual: taxAnnual,
    statutoryDeductionsMonthly: statutoryMonthly,
    netTakeHomeMonthly: netMonthly,
    details: {
      fiscalYear,
      regime,
      standardDeduction,
      epfMonthly,
      rebate87A,
      cess,
      taxableIncome,
      taxAnnual,
    },
  };
}

/**
 * Universal dispatcher for multi-jurisdictional payroll calculation
 */
export function calculatePayrollTaxAndNet(
  jurisdiction: string,
  monthlyGross: number,
  declarations: TaxDeclarations = {},
  overrideFiscalYear?: FiscalYear
): TaxBreakdown {
  if (jurisdiction === 'IND') {
    return calculateIndiaTaxes(monthlyGross, declarations, overrideFiscalYear);
  }

  // Default is USA
  return calculateUSTaxes(monthlyGross, declarations, overrideFiscalYear);
}
