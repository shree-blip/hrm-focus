/**
 * Payslip PDF Generator
 *
 * Generates professional payslip PDFs using jsPDF and uploads them to
 * Supabase Storage. Each payslip is linked to a specific payroll_run_id
 * so it can be regenerated or replaced when payroll is re-run.
 */
import jsPDF from "jspdf";
import { format } from "date-fns";
import { getDeductionRates } from "@/lib/payrollHours";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PayslipEmployeeData {
  employee_id: string;
  user_id: string;
  employee_name: string;
  department: string;
  hourly_rate: number;
  days_worked: number;
  actual_hours: number;
  payable_hours: number;
  extra_hours: number;
  bank_hours_used: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  gross_pay: number;
  income_tax: number;
  social_security: number;
  provident_fund: number;
  loan_emi: number;
  deductions: number;
  net_pay: number;
}

export interface PayslipRunContext {
  payroll_run_id: string;
  period_start: string; // YYYY-MM-DD
  period_end: string;   // YYYY-MM-DD
  region: string;
  total_working_days: number;
  required_hours: number;
  company_name: string;
}

export interface PayslipGenerationResult {
  employee_id: string;
  user_id: string;
  employee_name: string;
  blob: Blob;
  fileName: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmtCurrency = (value: number, region: string) => {
  const symbol = region === "US" ? "$" : "Rs.";
  return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtHours = (h: number) => `${h.toFixed(1)}h`;

/* ------------------------------------------------------------------ */
/*  PDF generation for a single employee                              */
/* ------------------------------------------------------------------ */

export function generatePayslipPDF(
  emp: PayslipEmployeeData,
  ctx: PayslipRunContext,
): PayslipGenerationResult {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const periodLabel = `${format(new Date(ctx.period_start + "T00:00:00"), "MMM d, yyyy")} – ${format(new Date(ctx.period_end + "T00:00:00"), "MMM d, yyyy")}`;
  const periodMonth = format(new Date(ctx.period_start + "T00:00:00"), "MMMM yyyy");

  // ── Header ──
  doc.setFillColor(17, 24, 39); // gray-900
  doc.rect(0, 0, pageWidth, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(ctx.company_name, margin, 16);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("PAYSLIP", margin, 24);
  doc.text(periodLabel, margin, 30);

  doc.setFontSize(9);
  doc.text(`Payroll Run: ${ctx.payroll_run_id.substring(0, 8)}...`, pageWidth - margin, 30, { align: "right" });
  doc.text(`Generated: ${format(new Date(), "MMM d, yyyy")}`, pageWidth - margin, 24, { align: "right" });

  y = 46;
  doc.setTextColor(0, 0, 0);

  // ── Employee Info ──
  doc.setFillColor(243, 244, 246); // gray-100
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Employee", margin + 4, y + 7);
  doc.setFont("helvetica", "normal");
  doc.text(emp.employee_name, margin + 4, y + 14);

  doc.setFont("helvetica", "bold");
  doc.text("Department", margin + contentWidth / 3, y + 7);
  doc.setFont("helvetica", "normal");
  doc.text(emp.department || "N/A", margin + contentWidth / 3, y + 14);

  doc.setFont("helvetica", "bold");
  doc.text("Region", margin + (contentWidth * 2) / 3, y + 7);
  doc.setFont("helvetica", "normal");
  doc.text(ctx.region, margin + (contentWidth * 2) / 3, y + 14);

  y += 30;

  // ── Attendance & Hours Section ──
  const drawSectionHeader = (title: string) => {
    doc.setFillColor(59, 130, 246); // blue-500
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 10;
  };

  const drawRow = (label: string, value: string, indent = 0, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.text(label, margin + 4 + indent, y);
    doc.text(value, pageWidth - margin - 4, y, { align: "right" });

    // Light separator
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setLineWidth(0.2);
    doc.line(margin, y + 2, pageWidth - margin, y + 2);
    y += 6;
  };

  drawSectionHeader("ATTENDANCE & HOURS");

  drawRow("Total Working Days (Period)", String(ctx.total_working_days));
  drawRow("Days Worked (Attendance)", String(emp.days_worked));
  drawRow("Paid Leave Days", String(emp.paid_leave_days));
  drawRow("Unpaid Leave Days", String(emp.unpaid_leave_days));

  y += 2;
  drawRow("Required Hours", fmtHours(ctx.required_hours));
  drawRow("Actual Hours Worked", fmtHours(emp.actual_hours));
  drawRow("Payable Hours", fmtHours(emp.payable_hours));
  drawRow("Extra Hours", fmtHours(emp.extra_hours));
  drawRow("Bank Hours Used", fmtHours(emp.bank_hours_used));
  drawRow("Hourly Rate", fmtCurrency(emp.hourly_rate, ctx.region));

  y += 4;

  // ── Earnings ──
  drawSectionHeader("EARNINGS");

  drawRow("Payable Hours × Hourly Rate", `${fmtHours(emp.payable_hours)} × ${fmtCurrency(emp.hourly_rate, ctx.region)}`);
  drawRow("Gross Pay", fmtCurrency(emp.gross_pay, ctx.region), 0, true);

  y += 4;

  // ── Deductions ──
  drawSectionHeader("DEDUCTIONS");

  const rates = getDeductionRates(ctx.region);
  drawRow(`Income Tax (${(rates.incomeTaxRate * 100).toFixed(1)}%)`, fmtCurrency(emp.income_tax, ctx.region));
  drawRow(`Social Security (${(rates.socialSecurityRate * 100).toFixed(2)}%)`, fmtCurrency(emp.social_security, ctx.region));
  drawRow(`Provident Fund (${(rates.providentFundRate * 100).toFixed(2)}%)`, fmtCurrency(emp.provident_fund, ctx.region));

  if (emp.loan_emi > 0) {
    drawRow("Loan EMI Deduction", fmtCurrency(emp.loan_emi, ctx.region));
  }

  const totalDedWithEmi = emp.income_tax + emp.social_security + emp.provident_fund + emp.loan_emi;
  drawRow("Total Deductions", fmtCurrency(totalDedWithEmi, ctx.region), 0, true);

  y += 6;

  // ── Net Pay (large highlighted box) ──
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("NET PAY", margin + 4, y + 10);
  doc.setFontSize(14);
  doc.text(fmtCurrency(emp.net_pay, ctx.region), pageWidth - margin - 4, y + 10, { align: "right" });

  y += 24;

  // ── Calculation Summary (auditable) ──
  doc.setTextColor(0, 0, 0);
  drawSectionHeader("CALCULATION SUMMARY");

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128); // gray-500

  const formulaLines = [
    `Gross Pay = Payable Hours × Hourly Rate = ${emp.payable_hours.toFixed(1)} × ${emp.hourly_rate.toFixed(4)} = ${fmtCurrency(emp.gross_pay, ctx.region)}`,
    `Income Tax = Gross Pay × ${(rates.incomeTaxRate * 100).toFixed(1)}% = ${fmtCurrency(emp.gross_pay, ctx.region)} × ${(rates.incomeTaxRate * 100).toFixed(1)}% = ${fmtCurrency(emp.income_tax, ctx.region)}`,
    `Social Security = Gross Pay × ${(rates.socialSecurityRate * 100).toFixed(2)}% = ${fmtCurrency(emp.gross_pay, ctx.region)} × ${(rates.socialSecurityRate * 100).toFixed(2)}% = ${fmtCurrency(emp.social_security, ctx.region)}`,
    `Provident Fund = Gross Pay × ${(rates.providentFundRate * 100).toFixed(2)}% = ${fmtCurrency(emp.gross_pay, ctx.region)} × ${(rates.providentFundRate * 100).toFixed(2)}% = ${fmtCurrency(emp.provident_fund, ctx.region)}`,
    emp.loan_emi > 0
      ? `Loan EMI = ${fmtCurrency(emp.loan_emi, ctx.region)} (per active loan schedule)`
      : null,
    `Total Deductions = ${fmtCurrency(emp.income_tax, ctx.region)} + ${fmtCurrency(emp.social_security, ctx.region)} + ${fmtCurrency(emp.provident_fund, ctx.region)}${emp.loan_emi > 0 ? ` + ${fmtCurrency(emp.loan_emi, ctx.region)}` : ""} = ${fmtCurrency(totalDedWithEmi, ctx.region)}`,
    `Net Pay = Gross Pay − Total Deductions = ${fmtCurrency(emp.gross_pay, ctx.region)} − ${fmtCurrency(totalDedWithEmi, ctx.region)} = ${fmtCurrency(emp.net_pay, ctx.region)}`,
  ].filter(Boolean) as string[];

  formulaLines.forEach((line) => {
    doc.text(line, margin + 4, y);
    y += 4.5;
  });

  y += 4;

  // ── Footer ──
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(
    "This is a computer-generated payslip. Values match the payroll run data exactly.",
    pageWidth / 2,
    y,
    { align: "center" },
  );
  doc.text(
    `${ctx.company_name} • ${periodMonth} Payroll • Run ID: ${ctx.payroll_run_id}`,
    pageWidth / 2,
    y + 4,
    { align: "center" },
  );

  // Build filename
  const safeName = emp.employee_name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
  const monthStr = format(new Date(ctx.period_start + "T00:00:00"), "yyyy-MM");
  const fileName = `${safeName}_${monthStr}.pdf`;

  return {
    employee_id: emp.employee_id,
    user_id: emp.user_id,
    employee_name: emp.employee_name,
    blob: doc.output("blob"),
    fileName,
  };
}

/* ------------------------------------------------------------------ */
/*  Batch generation for all employees in a run                        */
/* ------------------------------------------------------------------ */

export interface BatchPayslipProgress {
  total: number;
  completed: number;
  current: string; // employee name being processed
}

export async function generateAllPayslipPDFs(
  employees: PayslipEmployeeData[],
  ctx: PayslipRunContext,
  onProgress?: (progress: BatchPayslipProgress) => void,
): Promise<PayslipGenerationResult[]> {
  const results: PayslipGenerationResult[] = [];

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    onProgress?.({
      total: employees.length,
      completed: i,
      current: emp.employee_name,
    });

    // Small delay to avoid blocking the UI thread completely
    if (i > 0 && i % 5 === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }

    const result = generatePayslipPDF(emp, ctx);
    results.push(result);
  }

  onProgress?.({
    total: employees.length,
    completed: employees.length,
    current: "Done",
  });

  return results;
}
