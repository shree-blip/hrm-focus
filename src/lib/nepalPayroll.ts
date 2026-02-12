/**
 * Nepal Payroll Calculation Engine
 * Implements full salary breakdown with SSF, TDS tax slabs, gender rebate,
 * Dashain bonus, and optional insurance deduction.
 *
 * IMPORTANT NOTES:
 * 1. The annual salary input is CTC (Cost to Company) which INCLUDES employer's 20% SSF
 * 2. We back-calculate the actual employee gross from CTC
 * 3. The 1% "Social Security Tax" on first Rs. 5 Lakh is covered by SSF
 * 4. TDS (Income Tax) only applies to taxable income EXCEEDING Rs. 5,00,000
 *
 * UPDATED AS PER REQUIREMENT:
 * - Insurance premium is treated as an ANNUAL TAX DEDUCTION only (reduces taxable income / TDS)
 * - Insurance is NOT deducted from monthly net salary payout
 * - Dashain bonus is shown as a ONE-TIME payout (Dashain month net)
 */

export interface NepalPayrollInput {
  annualSalary: number; // Total annual CTC (includes employer SSF)
  gender: "male" | "female" | null;
  insurancePremium: number; // Optional annual insurance premium
  includeDashainBonus: boolean; // Whether to include Dashain bonus
}

export interface NepalPayrollBreakdown {
  // CTC Breakdown
  monthlyCTC: number; // CTC / 12 (what company pays total)
  monthlyGross: number; // Actual employee gross (CTC - employer SSF)
  monthlyBasicSalary: number; // 60% of gross
  monthlyAllowance: number; // 40% of gross

  // Annual Figures
  annualCTC: number; // Input salary (includes employer SSF)
  annualGross: number; // Actual employee annual gross
  dashainBonus: number; // 1 month basic salary (optional)
  annualAssessableIncome: number; // annualCTC + dashainBonus (for tax calculation)

  // SSF
  employeeSSF: number; // 11% of basic salary (annual)
  employerSSF: number; // 20% of basic salary (annual) - already in CTC
  totalSSF: number; // 31% of basic salary (annual)
  monthlyEmployeeSSF: number; // Monthly employee SSF deduction
  monthlyEmployerSSF: number; // Monthly employer SSF (for reference)

  // Deductions before tax
  insuranceDeduction: number;
  totalDeductionsBeforeTax: number; // totalSSF + insuranceDeduction

  // Tax Calculation
  taxableIncome: number;
  taxExemptAmount: number; // Rs. 5,00,000 (covered by SSF as social security tax)
  taxableAboveExemption: number; // Amount exceeding 5 lakh that is subject to TDS
  taxSlab1: number; // 10% on Rs. 5,00,001 - 7,00,000
  taxSlab2: number; // 20% on Rs. 7,00,001 - 10,00,000
  taxSlab3: number; // 30% on Rs. 10,00,001 - 20,00,000
  taxSlab4: number; // 36% on Rs. 20,00,001 - 50,00,000
  taxSlab5: number; // 39% on above Rs. 50,00,000
  totalTDS: number;
  genderRebate: number; // 10% of TDS for female
  netTDS: number; // TDS after rebate

  // Monthly deductions (from employee payout)
  monthlyTDS: number;
  monthlyInsurance: number; // will be 0 (not deducted from payout)
  monthlyTotalDeductions: number;

  // Final
  monthlyNetSalary: number;
  annualNetSalary: number;

  // Dashain month (one-time display)
  dashainMonthNetSalary: number; // monthlyNetSalary + dashainBonus
}

// Tax slabs for Nepal FY 2081/82 (Single/Unmarried)
// NOTE: The 1% on first 5 Lakh is Social Security Tax, covered by SSF contribution
// TDS (Income Tax) starts from amount EXCEEDING Rs. 5,00,000
const TAX_SLABS = [
  { min: 500000, max: 700000, rate: 0.1 }, // 10% on 5L - 7L
  { min: 700000, max: 1000000, rate: 0.2 }, // 20% on 7L - 10L
  { min: 1000000, max: 2000000, rate: 0.3 }, // 30% on 10L - 20L
  { min: 2000000, max: 5000000, rate: 0.36 }, // 36% on 20L - 50L
  { min: 5000000, max: Infinity, rate: 0.39 }, // 39% above 50L
];

const TAX_EXEMPT_AMOUNT = 500000; // First 5 lakh is exempt (covered by SSF as social security)
const FEMALE_REBATE_RATE = 0.1; // 10% rebate for female taxpayers

export function calculateNepalPayroll(input: NepalPayrollInput): NepalPayrollBreakdown {
  const { annualSalary, gender, insurancePremium, includeDashainBonus } = input;

  // Annual CTC (what company pays - includes employer SSF)
  const annualCTC = annualSalary;
  const monthlyCTC = annualCTC / 12;

  // Back-calculate actual employee gross from CTC
  // CTC = Gross + Employer SSF
  // Employer SSF = 20% of Basic = 20% of (60% of Gross) = 12% of Gross
  // CTC = Gross + 0.12 * Gross = 1.12 * Gross
  // Gross = CTC / 1.12
  const monthlyGross = monthlyCTC / 1.12;
  const monthlyBasicSalary = monthlyGross * 0.6;
  const monthlyAllowance = monthlyGross * 0.4;

  // Annual Gross (actual employee salary without employer SSF)
  const annualGross = monthlyGross * 12;

  // SSF Calculations (based on basic salary)
  const annualBasicSalary = monthlyBasicSalary * 12;
  const employeeSSF = annualBasicSalary * 0.11; // 11% employee contribution
  const employerSSF = annualBasicSalary * 0.2; // 20% employer contribution (already in CTC)
  const totalSSF = employeeSSF + employerSSF; // 31% total
  const monthlyEmployeeSSF = employeeSSF / 12;
  const monthlyEmployerSSF = employerSSF / 12;

  // Dashain Bonus (one month basic salary) - paid once in Dashain month
  const dashainBonus = includeDashainBonus ? monthlyBasicSalary : 0;

  // Annual Assessable Income (CTC + Dashain bonus for tax calculation)
  // Using CTC because employer SSF is taxable benefit
  const annualAssessableIncome = annualCTC + dashainBonus;

  // Insurance deduction (max Rs. 40,000 allowed) - TAX DEDUCTION ONLY
  const insuranceDeduction = Math.min(insurancePremium || 0, 40000);

  // Total deductions before tax (SSF 31% + insurance)
  const totalDeductionsBeforeTax = totalSSF + insuranceDeduction;

  // Taxable Income = Assessable Income - Deductions
  const taxableIncome = Math.max(0, annualAssessableIncome - totalDeductionsBeforeTax);

  // Calculate TDS - ONLY on amount exceeding Rs. 5,00,000
  const taxExemptAmount = TAX_EXEMPT_AMOUNT;
  const taxableAboveExemption = Math.max(0, taxableIncome - taxExemptAmount);

  let taxSlab1 = 0;
  let taxSlab2 = 0;
  let taxSlab3 = 0;
  let taxSlab4 = 0;
  let taxSlab5 = 0;
  let totalTDS = 0;

  if (taxableIncome > TAX_EXEMPT_AMOUNT) {
    for (let i = 0; i < TAX_SLABS.length; i++) {
      const slab = TAX_SLABS[i];

      if (taxableIncome <= slab.min) break;

      const taxableInSlab = Math.min(taxableIncome, slab.max) - slab.min;

      if (taxableInSlab > 0) {
        const taxInSlab = taxableInSlab * slab.rate;
        totalTDS += taxInSlab;

        switch (i) {
          case 0:
            taxSlab1 = taxInSlab;
            break;
          case 1:
            taxSlab2 = taxInSlab;
            break;
          case 2:
            taxSlab3 = taxInSlab;
            break;
          case 3:
            taxSlab4 = taxInSlab;
            break;
          case 4:
            taxSlab5 = taxInSlab;
            break;
        }
      }
    }
  }

  // Gender Rebate: 10% of total TDS for female employees
  const genderRebate = gender === "female" ? totalTDS * FEMALE_REBATE_RATE : 0;
  const netTDS = totalTDS - genderRebate;

  // Monthly deductions (from employee payout)
  const monthlyTDS = netTDS / 12;

  // UPDATED: Insurance is NOT deducted from monthly payout
  const monthlyInsurance = 0;

  // UPDATED: Only SSF(11%) + TDS are deducted from monthly gross payout
  const monthlyTotalDeductions = monthlyEmployeeSSF + monthlyTDS;

  // Final net salary (what employee actually receives monthly)
  const monthlyNetSalary = monthlyGross - monthlyTotalDeductions;
  const annualNetSalary = monthlyNetSalary * 12;

  // Dashain month payout (one-time): add bonus on top of regular net salary
  const dashainMonthNetSalary = monthlyNetSalary + dashainBonus;

  return {
    // CTC Breakdown
    monthlyCTC,
    monthlyGross,
    monthlyBasicSalary,
    monthlyAllowance,

    // Annual
    annualCTC,
    annualGross,
    dashainBonus,
    annualAssessableIncome,

    // SSF
    employeeSSF,
    employerSSF,
    totalSSF,
    monthlyEmployeeSSF,
    monthlyEmployerSSF,

    // Deductions
    insuranceDeduction,
    totalDeductionsBeforeTax,

    // Tax
    taxableIncome,
    taxExemptAmount,
    taxableAboveExemption,
    taxSlab1,
    taxSlab2,
    taxSlab3,
    taxSlab4,
    taxSlab5,
    totalTDS,
    genderRebate,
    netTDS,

    // Monthly
    monthlyTDS,
    monthlyInsurance,
    monthlyTotalDeductions,
    monthlyNetSalary,
    annualNetSalary,

    // Dashain month
    dashainMonthNetSalary,
  };
}

export function formatNPR(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
