/**
 * Statutory Compliance and Progressive Tax localization formulas.
 * Supports USA (FICA + Progressive Federal Slabs) and IND (New Tax Regime vs Old Tax Regime + EPF/ESI).
 */

export interface TaxBreakdown {
  grossMonthly: number;
  grossAnnual: number;
  taxableIncome: number;
  incomeTaxMonthly: number;
  incomeTaxAnnual: number;
  statutoryDeductionsMonthly: number;
  netTakeHomeMonthly: number;
  details: Record<string, any>;
}

/**
 * Calculates progressive tax based on brackets
 */
function calculateProgressiveTax(taxableIncome: number, brackets: { limit: number | null; rate: number }[]): number {
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
export function calculateUSTaxes(monthlyGross: number, declarations: any = {}): TaxBreakdown {
  const grossAnnual = monthlyGross * 12;
  
  // US Standard Deduction (2026 estimate: ~$15,000 for single)
  const standardDeduction = 15000;
  const itemizedDeductions = Number(declarations.pre_tax_deductions || 0);
  const taxableIncome = Math.max(0, grossAnnual - standardDeduction - itemizedDeductions);

  // Progressive US Federal Brackets (2026 Single Filer estimate)
  const brackets = [
    { limit: 11600, rate: 0.10 },
    { limit: 47150, rate: 0.12 },
    { limit: 100525, rate: 0.22 },
    { limit: 191950, rate: 0.24 },
    { limit: 243725, rate: 0.32 },
    { limit: 609350, rate: 0.35 },
    { limit: null, rate: 0.37 }
  ];

  const federalTaxAnnual = calculateProgressiveTax(taxableIncome, brackets);
  const federalTaxMonthly = federalTaxAnnual / 12;

  // FICA Social Security (6.2% up to $168,600 cap) and Medicare (1.45%)
  const socialSecurityRate = 0.062;
  const medicareRate = 0.0145;

  const ssMonthly = Math.min(monthlyGross, 168600 / 12) * socialSecurityRate;
  const medicareMonthly = monthlyGross * medicareRate;
  const statutoryMonthly = ssMonthly + medicareMonthly;

  const netMonthly = monthlyGross - federalTaxMonthly - statutoryMonthly;

  return {
    grossMonthly: monthlyGross,
    grossAnnual,
    taxableIncome,
    incomeTaxMonthly: federalTaxMonthly,
    incomeTaxAnnual: federalTaxAnnual,
    statutoryDeductionsMonthly: statutoryMonthly,
    netTakeHomeMonthly: netMonthly,
    details: {
      standardDeduction,
      taxableIncome,
      federalTaxAnnual,
      socialSecurityMonthly: ssMonthly,
      medicareMonthly,
      statutoryMonthly
    }
  };
}

/**
 * India Tax Calculations (Regime choice + EPF + Progressive slabs)
 */
export function calculateIndiaTaxes(monthlyGross: number, declarations: any = {}): TaxBreakdown {
  const grossAnnual = monthlyGross * 12;
  
  // Standard Deduction (₹50,000 / ₹75,000 for standard)
  const standardDeduction = 75000;
  
  const regime = declarations.regime || 'new'; // 'new' or 'old'
  
  // India EPF Employee contribution (12% of basic, basic assumed 50% of gross)
  const basicSalaryMonthly = monthlyGross * 0.50;
  const epfMonthly = basicSalaryMonthly * 0.12;

  let taxableIncome = grossAnnual - standardDeduction;

  let brackets = [];
  
  if (regime === 'old') {
    // Deductions under 80C, 80D, HRA for Old regime
    const section80C = Math.min(150000, Number(declarations.section_80c || 0) + (epfMonthly * 12));
    const section80D = Math.min(25000, Number(declarations.section_80d || 0));
    const hraExemption = Number(declarations.hra_exemption || 0);

    taxableIncome = Math.max(0, taxableIncome - section80C - section80D - hraExemption);

    // Old Regime Brackets
    brackets = [
      { limit: 250000, rate: 0.00 },
      { limit: 500000, rate: 0.05 },
      { limit: 1000000, rate: 0.20 },
      { limit: null, rate: 0.30 }
    ];
  } else {
    // New regime has higher standard deduction, but no 80C/80D/HRA deductions.
    brackets = [
      { limit: 300000, rate: 0.00 },
      { limit: 600000, rate: 0.05 },
      { limit: 900000, rate: 0.10 },
      { limit: 1200000, rate: 0.15 },
      { limit: 1500000, rate: 0.20 },
      { limit: null, rate: 0.30 }
    ];
  }

  let taxAnnual = calculateProgressiveTax(taxableIncome, brackets);

  // Health and Education Cess (4% on income tax)
  const cess = taxAnnual * 0.04;
  taxAnnual += cess;

  const taxMonthly = taxAnnual / 12;
  const statutoryMonthly = epfMonthly;

  const netMonthly = monthlyGross - taxMonthly - statutoryMonthly;

  return {
    grossMonthly: monthlyGross,
    grossAnnual,
    taxableIncome,
    incomeTaxMonthly: taxMonthly,
    incomeTaxAnnual: taxAnnual,
    statutoryDeductionsMonthly: statutoryMonthly,
    netTakeHomeMonthly: netMonthly,
    details: {
      regime,
      standardDeduction,
      epfMonthly,
      cess,
      taxableIncome,
      taxAnnual
    }
  };
}

/**
 * Universal dispatcher for multi-jurisdictional payroll calculation
 */
export function calculatePayrollTaxAndNet(
  jurisdiction: string,
  monthlyGross: number,
  declarations: any = {}
): TaxBreakdown {
  if (jurisdiction === 'IND') {
    return calculateIndiaTaxes(monthlyGross, declarations);
  }
  
  // Default is USA
  return calculateUSTaxes(monthlyGross, declarations);
}
