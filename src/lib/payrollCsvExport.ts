import Papa from "papaparse";
import { saveAs } from "file-saver";
import { format } from "date-fns";

export interface PayrollExportRow {
  "Employee Name": string;
  Department: string;
  "Hourly Rate": number;
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

export function mapDetailToExportRow(d: any, standardHoursInRange?: number): PayrollExportRow {
  const incomeTax = d.income_tax ?? 0;
  const socialSecurity = d.social_security ?? 0;
  const providentFund = d.provident_fund ?? 0;
  const totalDed = d.deductions || (incomeTax + socialSecurity + providentFund);

  return {
    "Employee Name": d.employee_name,
    Department: d.department || "",
    "Hourly Rate": d.hourly_rate || 0,
    "Required Hours": standardHoursInRange ?? (d.payable_hours || 0),
    "Actual Hours": d.actual_hours || 0,
    "Payable Hours": d.payable_hours || 0,
    "Extra Hours": d.extra_hours || 0,
    "Bank Hours Used": d.bank_hours_used || 0,
    "Gross Pay": d.gross_pay || 0,
    "Income Tax": incomeTax,
    "Social Security": socialSecurity,
    "Provident Fund": providentFund,
    "Total Deductions": totalDed,
    "Net Pay": d.net_pay || 0,
  };
}
