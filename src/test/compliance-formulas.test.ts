import { describe, it, expect } from "vitest";
import { calculateIndiaTaxes, calculateUSTaxes, calculatePayrollTaxAndNet } from "../utils/compliance-formulas";

describe("Compliance Formulas - Statutory Tax & Payroll Calculations", () => {
  describe("India Income Tax (IND) - New Tax Regime & 87A Rebate", () => {
    it("should apply 100% tax rebate (Section 87A) for New Regime taxable income <= ₹7,00,000", () => {
      // Monthly gross: ₹60,000 => Annual Gross: ₹7,20,000
      // Standard deduction for New Regime is ₹75,000
      // Taxable income = ₹7,20,000 - ₹75,000 = ₹6,45,000 (<= ₹7,00,000)
      const res = calculateIndiaTaxes(60000, { regime: "new" });

      expect(res.grossAnnual).toBe(720000);
      expect(res.taxableIncome).toBe(645000);
      expect(res.incomeTaxAnnual).toBe(0);
      expect(res.incomeTaxMonthly).toBe(0);
      expect(res.details.rebate87A).toBeGreaterThan(0);
      expect(res.details.cess).toBe(0);
    });

    it("should calculate correct progressive tax and apply Marginal Relief for New Regime when slightly above ₹7,00,000", () => {
      // Annual Gross: ₹7,90,000 => Taxable Income = ₹7,90,000 - ₹75,000 = ₹7,15,000 (just above ₹7,00,000)
      // Normal tax:
      // - Up to 3,00,000: 0% = 0
      // - 3,00,000 to 6,00,000: 5% on 3L = 15,000
      // - 6,00,000 to 7,15,000: 10% on 1.15L = 11,500
      // Total progressive tax before relief: ₹26,500
      // Marginal Relief Caps tax at: taxableIncome - 7,00,000 = ₹15,000
      // Since normal tax (26,500) > excess (15,000), tax is capped at ₹15,000.
      // Health & Education Cess (4% of 15,000) = ₹600.
      // Total tax annual = 15,000 + 600 = ₹15,600.
      const monthly = 790000 / 12;
      const res = calculateIndiaTaxes(monthly, { regime: "new" });

      expect(res.taxableIncome).toBe(715000);
      expect(res.incomeTaxAnnual).toBeCloseTo(15600, 1);
      expect(res.details.cess).toBeCloseTo(600, 1);
      expect(res.details.rebate87A).toBeCloseTo(11500, 1); // 26,500 - 15,000 = 11,500
    });

    it("should calculate progressive tax normally for New Regime when well above ₹7,00,000", () => {
      // Annual Gross: ₹12,75,000 => Taxable Income = ₹12,00,000
      // Brackets:
      // - Up to 3L: 0% = 0
      // - 3L to 6L (5% on 3L) = 15,000
      // - 6L to 9L (10% on 3L) = 30,000
      // - 9L to 12L (15% on 3L) = 45,000
      // Total progressive tax = 15,000 + 30,000 + 45,000 = ₹90,000
      // No Section 87A rebate applies since taxable income (12L) > 7L
      // Cess: 4% of ₹90,000 = ₹3,600
      // Total annual tax = 90,000 + 3,600 = ₹93,600.
      const monthly = 1275000 / 12;
      const res = calculateIndiaTaxes(monthly, { regime: "new" });

      expect(res.taxableIncome).toBe(1200000);
      expect(res.incomeTaxAnnual).toBeCloseTo(93600, 1);
      expect(res.details.rebate87A).toBe(0);
      expect(res.details.cess).toBe(3600);
    });
  });

  describe("India Income Tax (IND) - Old Tax Regime & Deductions", () => {
    it("should apply Section 87A rebate (up to ₹12,500) for Old Regime taxable income <= ₹5,00,000", () => {
      // Monthly gross: ₹40,000 => Annual Gross: ₹4,80,000
      // Standard deduction for Old Regime is ₹50,000
      // Taxable income = ₹4,80,000 - ₹50,000 = ₹4,30,000
      // Normal tax:
      // - Up to 2.5L: 0% = 0
      // - 2.5L to 4.3L (5% on 1.8L) = 9,000
      // Since taxable income (4.3L) <= 5L, rebate of 100% applies, making tax ₹0.
      const res = calculateIndiaTaxes(40000, { regime: "old" });

      expect(res.details.standardDeduction).toBe(50000);
      expect(res.taxableIncome).toBe(401200);
      expect(res.incomeTaxAnnual).toBe(0);
    });

    it("should apply custom declarations (80C, 80D, HRA) and calculate old regime tax properly", () => {
      // Gross Monthly: ₹1,00,000 => Annual Gross: ₹12,00,000
      // Standard Deduction: ₹50,000
      // EPF: basic = 50% of 1L = 50,000/mo. EPF monthly = 12% of 50k = 6,000 => EPF annual = ₹72,000
      // Declarations: 80C = 1,00,000 (total Section 80C will be capped at 1,50,000: 100,000 declared + 72,000 EPF is capped at 1,50,000)
      // 80D: 20,000
      // HRA Exemption: 80,000
      // Taxable Income = 12,00,000 - 50,000 (standard deduction) - 1,50,000 (80C) - 20,000 (80D) - 80,000 (HRA) = ₹9,00,000
      // Progressive tax:
      // - Up to 2.5L: 0% = 0
      // - 2.5L to 5L (5% on 2.5L) = 12,500
      // - 5L to 9L (20% on 4L) = 80,000
      // Total tax = 12,500 + 80,000 = 92,500.
      // Cess = 4% of 92,500 = 3,700.
      // Total annual tax = 96,200.
      const res = calculateIndiaTaxes(100000, {
        regime: "old",
        section_80c: 100000,
        section_80d: 20000,
        hra_exemption: 80000
      });

      expect(res.taxableIncome).toBe(900000);
      expect(res.incomeTaxAnnual).toBeCloseTo(96200, 1);
    });
  });

  describe("US Income Tax & FICA (USA)", () => {
    it("should limit Social Security deduction to the statutory cap ($168,600)", () => {
      // Annual Gross: $240,000 ($20,000 per month)
      // SS Cap: $168,600 => Max SS is 168600 * 6.2% = $10,453.2
      // Medicare is 1.45% of $240,000 = $3,480. Additional Medicare (exceeding 200k) is (240k - 200k) * 0.9% = $360.
      // Total Medicare annual = $3,840 => Monthly = $320
      // Total FICA = $10,453.2 (SS) + $3,840 (Medicare) = $14,293.2 => Monthly FICA = $1,191.10
      const res = calculateUSTaxes(20000);

      expect(res.details.socialSecurityMonthly).toBeCloseTo(10453.2 / 12, 1);
      expect(res.details.medicareMonthly).toBeCloseTo(3840 / 12, 1);
      expect(res.statutoryDeductionsMonthly).toBeCloseTo(14293.2 / 12, 1);
    });

    it("should calculate US progressive tax brackets and standard deduction properly", () => {
      // Monthly gross: $10,000 => Annual Gross: $120,000
      // Standard deduction: $15,000
      // Taxable income: $105,000
      // Tax calculation:
      // - Up to 11,600: 10% = 1,160
      // - 11,600 to 47,150: 12% on 35,550 = 4,266
      // - 47,150 to 100,525: 22% on 53,375 = 11,742.50
      // - 100,525 to 105,000: 24% on 4,475 = 1,074
      // Total Federal Tax = 1,160 + 4,266 + 11,742.50 + 1,074 = $18,242.50
      const res = calculateUSTaxes(10000);

      expect(res.taxableIncome).toBe(105000);
      expect(res.incomeTaxAnnual).toBeCloseTo(18242.50, 1);
    });

    it("should apply Additional Medicare Tax for earners exceeding $200,000", () => {
      // Monthly gross: $25,000 => Annual Gross: $300,000
      // Standard Medicare: $300,000 * 1.45% = $4,350
      // Additional Medicare (exceeding 200k): $100,000 * 0.9% = $900
      // Total Medicare annual = $5,250 => Monthly Medicare = $437.50
      const res = calculateUSTaxes(25000);

      expect(res.details.additionalMedicareAnnual).toBeCloseTo(900, 1);
      expect(res.details.medicareMonthly).toBe(437.50);
    });
  });

  describe("Safety, Guards and Universal Dispatcher", () => {
    it("should gracefully handle negative monthly gross income values and return 0", () => {
      const indRes = calculateIndiaTaxes(-1000);
      expect(indRes.grossMonthly).toBe(0);
      expect(indRes.grossAnnual).toBe(0);
      expect(indRes.incomeTaxAnnual).toBe(0);

      const usRes = calculateUSTaxes(-500);
      expect(usRes.grossMonthly).toBe(0);
      expect(usRes.grossAnnual).toBe(0);
      expect(usRes.incomeTaxAnnual).toBe(0);
    });

    it("should gracefully handle NaN, undefined, or string inputs in monthly gross", () => {
      const res = calculatePayrollTaxAndNet("IND", "invalid-gross" as unknown as number);
      expect(res.grossMonthly).toBe(0);
      expect(res.incomeTaxAnnual).toBe(0);
    });

    it("should dispatch correctly based on jurisdiction input", () => {
      const indRes = calculatePayrollTaxAndNet("IND", 50000, { regime: "new" });
      const usRes = calculatePayrollTaxAndNet("USA", 5000);

      expect(indRes.details.regime).toBeDefined();
      expect(usRes.details.additionalMedicareAnnual).toBeDefined();
    });
  });
});
