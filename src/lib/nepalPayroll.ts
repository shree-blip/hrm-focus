/**
 * Nepal Payroll Calculation Engine
 * Implements full salary breakdown with SSF, TDS tax slabs, gender rebate, 
 * Dashain bonus, and optional insurance deduction.
 */

export interface NepalPayrollInput {
  annualSalary: number;        // Total annual salary (CTC)
  gender: "male" | "female" | null;
  insurancePremium: number;    // Optional annual insurance premium
  includeDashainBonus: boolean; // Whether to include Dashain bonus
}

export interface NepalPayrollBreakdown {
  // Monthly Breakdown
  monthlyGross: number;
  monthlyBasicSalary: number;     // 60% of gross
  monthlyAllowance: number;       // 40% of gross

  // Annual Figures
  annualGross: number;            // monthly × 12
  dashainBonus: number;           // 1 month basic salary (optional)
  annualAssessableIncome: number; // annualGross + dashainBonus

  // SSF
  employeeSSF: number;            // 11% of basic salary (annual)
  employerSSF: number;            // 20% of basic salary (annual)
  totalSSF: number;               // 31% of basic salary (annual)

  // Deductions before tax
  insuranceDeduction: number;
  totalDeductionsBeforeTax: number; // employeeSSF + insurance

  // Tax Calculation
  taxableIncome: number;
  taxSlab1: number;               // 1% on first 500,000
  taxSlab2: number;               // 10% on excess over 500,000
  totalTDS: number;
  genderRebate: number;           // 10% of TDS for female
  netTDS: number;                 // TDS after rebate

  // Monthly deductions
  monthlyEmployeeSSF: number;
  monthlyTDS: number;
  monthlyInsurance: number;
  monthlyTotalDeductions: number;

  // Final
  monthlyNetSalary: number;
  annualNetSalary: number;
}

export function calculateNepalPayroll(input: NepalPayrollInput): NepalPayrollBreakdown {
  const { annualSalary, gender, insurancePremium, includeDashainBonus } = input;

  // Monthly Gross
  const monthlyGross = annualSalary / 12;
  const monthlyBasicSalary = monthlyGross * 0.6;
  const monthlyAllowance = monthlyGross * 0.4;

  // Annual Gross
  const annualGross = annualSalary;

  // Dashain Bonus (one month basic salary)
  const dashainBonus = includeDashainBonus ? monthlyBasicSalary : 0;

  // Annual Assessable Income
  const annualAssessableIncome = annualGross + dashainBonus;

  // SSF Calculations (based on annual basic salary)
  const annualBasicSalary = monthlyBasicSalary * 12;
  const employeeSSF = annualBasicSalary * 0.11;
  const employerSSF = annualBasicSalary * 0.20;
  const totalSSF = employeeSSF + employerSSF;

  // Insurance deduction
  const insuranceDeduction = insurancePremium || 0;

  // Total deductions before tax
  const totalDeductionsBeforeTax = employeeSSF + insuranceDeduction;

  // Taxable Income
  const taxableIncome = Math.max(0, annualAssessableIncome - totalDeductionsBeforeTax);

  // TDS Tax Brackets (Nepal)
  let taxSlab1 = 0;
  let taxSlab2 = 0;

  if (taxableIncome > 0) {
    // Slab 1: 1% on first 500,000
    const slab1Amount = Math.min(taxableIncome, 500000);
    taxSlab1 = slab1Amount * 0.01;

    // Slab 2: 10% on amount exceeding 500,000
    if (taxableIncome > 500000) {
      const slab2Amount = taxableIncome - 500000;
      taxSlab2 = slab2Amount * 0.10;
    }
  }

  const totalTDS = taxSlab1 + taxSlab2;

  // Gender Rebate: 10% of total TDS for female employees
  const genderRebate = gender === "female" ? totalTDS * 0.10 : 0;
  const netTDS = totalTDS - genderRebate;

  // Monthly deductions
  const monthlyEmployeeSSF = employeeSSF / 12;
  const monthlyTDS = netTDS / 12;
  const monthlyInsurance = insuranceDeduction / 12;
  const monthlyTotalDeductions = monthlyEmployeeSSF + monthlyTDS + monthlyInsurance;

  // Final net salary
  const monthlyNetSalary = monthlyGross - monthlyTotalDeductions;
  const annualNetSalary = monthlyNetSalary * 12;

  return {
    monthlyGross,
    monthlyBasicSalary,
    monthlyAllowance,
    annualGross,
    dashainBonus,
    annualAssessableIncome,
    employeeSSF,
    employerSSF,
    totalSSF,
    insuranceDeduction,
    totalDeductionsBeforeTax,
    taxableIncome,
    taxSlab1,
    taxSlab2,
    totalTDS,
    genderRebate,
    netTDS,
    monthlyEmployeeSSF,
    monthlyTDS,
    monthlyInsurance,
    monthlyTotalDeductions,
    monthlyNetSalary,
    annualNetSalary,
  };
}

export function formatNPR(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
