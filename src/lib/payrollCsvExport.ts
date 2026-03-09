import Papa from "papaparse";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import { calculateDeductions } from "@/lib/payrollHours";

export interface PayrollExportRow {
  "Employee Name": string;
  Department: string;
  "Hourly Rate": number;
  "Total Working Days": number;
  "Required Hours": number;
  "Actual Hours": number;
  "Payable Hours": number;
  "Extra Hours": number;
  "Bank Hours Used": number;
  "Gross Pay": number;
  "Income Tax": number;
  "Social Security": number;
  "Provident Fund": number;
  "Total Deductions": number;
  "Net Pay": number;
}

export function exportPayrollCSV(
  rows: PayrollExportRow[],
  region: string,
  periodStart: string
) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const fileName = `payroll-${format(new Date(periodStart + "T00:00:00"), "yyyy-MM")}-${region}.csv`;
  saveAs(blob, fileName);
}

/**
 * Map a payroll_run_details record to a CSV export row.
 *
 * @param d                      Raw detail row from Supabase
 * @param standardHoursInRange   Required hours for the pay-period date range
 * @param monthlyRequiredHours   Required hours for the full calendar month
 *                               (used to re-derive hourly rate when the stored
 *                                hourly_rate is missing / zero)
 */
export function mapDetailToExportRow(
  d: any,
  standardHoursInRange?: number,
  monthlyRequiredHours?: number,
  totalWorkingDays?: number,
  region?: string,
): PayrollExportRow {
  // Use stored hourly_rate when available; otherwise re-derive from gross_pay
  let hourlyRate = d.hourly_rate || 0;
  if (!hourlyRate && d.gross_pay && d.payable_hours && d.payable_hours > 0) {
    hourlyRate = Math.round((d.gross_pay / d.payable_hours) * 100) / 100;
  }

  const requiredHours = standardHoursInRange ?? 0;
  const grossPay = d.gross_pay || 0;

  // Recalculate deductions from system formulas when region is available;
  // otherwise fall back to stored values (backward compat for old runs).
  let incomeTax: number;
  let socialSecurity: number;
  let providentFund: number;
  let totalDed: number;

  if (region) {
    const ded = calculateDeductions(grossPay, region);
    incomeTax = ded.incomeTax;
    socialSecurity = ded.socialSecurity;
    providentFund = ded.providentFund;
    totalDed = ded.totalDeductions;
  } else {
    incomeTax = d.income_tax ?? 0;
    socialSecurity = d.social_security ?? 0;
    providentFund = d.provident_fund ?? 0;
    totalDed = d.deductions || (incomeTax + socialSecurity + providentFund);
  }

  return {
    "Employee Name": d.employee_name,
    Department: d.department || "",
    "Hourly Rate": hourlyRate,
    "Total Working Days": totalWorkingDays ?? (requiredHours > 0 ? requiredHours / 8 : 0),
    "Required Hours": requiredHours,
    "Actual Hours": d.actual_hours || 0,
    "Payable Hours": d.payable_hours || 0,
    "Extra Hours": d.extra_hours || 0,
    "Bank Hours Used": d.bank_hours_used || 0,
    "Gross Pay": grossPay,
    "Income Tax": incomeTax,
    "Social Security": socialSecurity,
    "Provident Fund": providentFund,
    "Total Deductions": totalDed,
    "Net Pay": d.net_pay || (grossPay - totalDed),
  };
}
