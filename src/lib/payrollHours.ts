/**
 * Payroll Hours Calculation Utilities
 *
 * Calculates Required Hours for a payroll month or custom date range,
 * considering:
 *   – Different month lengths (28/29/30/31 days)
 *   – 2 weekly off days (Saturday & Sunday)
 *   – 8 working hours per workday
 *
 * The "loop each date" approach is used everywhere because it is the most
 * accurate — it handles partial-week edges automatically.
 */

/**
 * Return the number of workdays between `start` and `end` (inclusive).
 * Off days = Saturday (6) and Sunday (0).
 */
export function countWorkDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const endClean = new Date(end);
  endClean.setHours(0, 0, 0, 0);

  while (d <= endClean) {
    const dow = d.getDay(); // 0 = Sunday, 6 = Saturday
    if (dow !== 0 && dow !== 6) {
      count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Hours per workday — single source of truth. */
export const HOURS_PER_DAY = 8;

export interface WorkingHoursResult {
  /** Number of working days in the range */
  workDays: number;
  /** Required hours = workDays × 8 */
  requiredHours: number;
}

/**
 * Calculate working hours for an arbitrary date range.
 *
 * @param start  Start date (inclusive)
 * @param end    End date (inclusive)
 * @returns      { workDays, requiredHours }
 */
export function calculateWorkingHours(
  start: Date | string,
  end: Date | string,
): WorkingHoursResult {
  const s = typeof start === "string" ? new Date(start + (start.includes("T") ? "" : "T00:00:00")) : new Date(start);
  const e = typeof end === "string" ? new Date(end + (end.includes("T") ? "" : "T00:00:00")) : new Date(end);

  const workDays = countWorkDays(s, e);
  return {
    workDays,
    requiredHours: workDays * HOURS_PER_DAY,
  };
}

/**
 * Calculate working hours for the full calendar month that contains `date`.
 *
 * @param date  Any date inside the target month
 * @returns     { workDays, requiredHours } for the whole month
 */
export function calculateMonthlyWorkingHours(date: Date | string): WorkingHoursResult {
  const d = typeof date === "string" ? new Date(date + (date.includes("T") ? "" : "T00:00:00")) : new Date(date);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0); // last day
  return calculateWorkingHours(monthStart, monthEnd);
}

/**
 * Derive hourly rate from a monthly salary and the required monthly hours.
 *
 * @param monthlySalary  Gross monthly salary
 * @param requiredMonthlyHours  Total required hours in that month
 */
export function hourlyRateFromSalary(
  monthlySalary: number,
  requiredMonthlyHours: number,
): number {
  if (requiredMonthlyHours <= 0) return 0;
  return monthlySalary / requiredMonthlyHours;
}

/* ------------------------------------------------------------------ */
/*  Deduction Rates & Calculation                                      */
/* ------------------------------------------------------------------ */

export interface DeductionRates {
  incomeTaxRate: number;
  socialSecurityRate: number;
  providentFundRate: number;
}

/**
 * Return the system-defined deduction rates for a region.
 *
 * US:    Income Tax  = federal (22%) + state (5%)  = 27%
 *        Social Sec  = FICA (7.65%)
 *        Prov. Fund  = Medicare (1.45%)
 *
 * Nepal: Income Tax  = 15%
 *        Social Sec  = 11%
 *        Prov. Fund  = 10%
 */
export function getDeductionRates(region: string): DeductionRates {
  if (region === "US") {
    return {
      incomeTaxRate: 0.22 + 0.05,   // federal + state
      socialSecurityRate: 0.0765,     // FICA
      providentFundRate: 0.0145,      // Medicare
    };
  }
  // Nepal (default)
  return {
    incomeTaxRate: 0.15,
    socialSecurityRate: 0.11,
    providentFundRate: 0.10,
  };
}

export interface DeductionBreakdown {
  incomeTax: number;
  socialSecurity: number;
  providentFund: number;
  totalDeductions: number;
}

/**
 * Calculate itemised deductions for a given gross pay and region.
 * All values rounded to 2 decimal places.
 */
export function calculateDeductions(
  grossPay: number,
  region: string,
): DeductionBreakdown {
  const rates = getDeductionRates(region);
  const incomeTax = Math.round(grossPay * rates.incomeTaxRate * 100) / 100;
  const socialSecurity = Math.round(grossPay * rates.socialSecurityRate * 100) / 100;
  const providentFund = Math.round(grossPay * rates.providentFundRate * 100) / 100;
  return {
    incomeTax,
    socialSecurity,
    providentFund,
    totalDeductions: Math.round((incomeTax + socialSecurity + providentFund) * 100) / 100,
  };
}
