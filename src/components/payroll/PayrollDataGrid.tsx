import { useMemo, useCallback, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Table2, FileDown } from "lucide-react";
import { format } from "date-fns";
import { exportPayrollCSV, mapDetailToExportRow } from "@/lib/payrollCsvExport";
import { calculateWorkingHours, calculateMonthlyWorkingHours } from "@/lib/payrollHours";
import type { PayslipRecord } from "@/hooks/usePayslips";
import "@/styles/ag-grid-theme.css";

ModuleRegistry.registerModules([AllCommunityModule]);

export interface PayrollRow {
  employee_name: string;
  department: string;
  hourly_rate: number;
  total_working_days: number;
  days_worked: number;
  required_hours: number;
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

interface PayrollDataGridProps {
  rows: PayrollRow[];
  region: string;
  periodStart: string;
  periodEnd: string;
  payslipRecords?: PayslipRecord[];
  onDownloadPayslip?: (filePath: string, fileName: string) => void;
  onDownloadAllPayslips?: () => void;
}

export function PayrollDataGrid({ rows, region, periodStart, periodEnd, payslipRecords, onDownloadPayslip, onDownloadAllPayslips }: PayrollDataGridProps) {
  const gridRef = useRef<GridApi | null>(null);
  const currencySymbol = region === "US" ? "$" : "₨";

  const currencyFormatter = useCallback(
    (params: { value: number | null }) => {
      if (params.value == null) return "-";
      return `${currencySymbol}${params.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
    [currencySymbol]
  );

  const hoursFormatter = useCallback(
    (params: { value: number | null }) => {
      if (params.value == null) return "-";
      return `${params.value.toFixed(1)}h`;
    },
    []
  );

  // Build a lookup from employee_name → payslip record for fast access
  const payslipByName = useMemo(() => {
    if (!payslipRecords || payslipRecords.length === 0) return new Map<string, PayslipRecord>();
    const map = new Map<string, PayslipRecord>();
    for (const rec of payslipRecords) {
      // file_name is like "John_Doe_2025-06.pdf" – extract from record
      // We match by normalising: strip file extension & date suffix, compare loosely
      // Better: link by employee_id but we only have employee_name in PayrollRow
      // So use file_name stem: replace underscores with spaces and strip date/ext
      const stem = rec.file_name.replace(/\.pdf$/i, "").replace(/_\d{4}-\d{2}$/, "").replace(/_/g, " ");
      map.set(stem.toLowerCase(), rec);
    }
    return map;
  }, [payslipRecords]);

  const columnDefs = useMemo<ColDef<PayrollRow>[]>(
    () => {
      const cols: ColDef<PayrollRow>[] = [
        { field: "employee_name", headerName: "Employee", pinned: "left", minWidth: 180, filter: "agTextColumnFilter" },
        { field: "department", headerName: "Dept", minWidth: 120, filter: "agTextColumnFilter" },
        { field: "hourly_rate", headerName: "Hourly Rate", minWidth: 110, valueFormatter: currencyFormatter },
        { field: "total_working_days", headerName: "Working Days", minWidth: 115 },
        { field: "days_worked", headerName: "Days Worked", minWidth: 115 },
        { field: "required_hours", headerName: "Required Hrs", minWidth: 120, valueFormatter: hoursFormatter },
        { field: "actual_hours", headerName: "Actual Hrs", minWidth: 110, valueFormatter: hoursFormatter },
        { field: "payable_hours", headerName: "Payable Hrs", minWidth: 115, valueFormatter: hoursFormatter },
        { field: "extra_hours", headerName: "Extra Hrs", minWidth: 100, valueFormatter: hoursFormatter },
        { field: "bank_hours_used", headerName: "Bank Used", minWidth: 105, valueFormatter: hoursFormatter },
        { field: "paid_leave_days", headerName: "Paid Leave", minWidth: 105 },
        { field: "unpaid_leave_days", headerName: "Unpaid Leave", minWidth: 115 },
        { field: "gross_pay", headerName: "Gross Pay", minWidth: 120, valueFormatter: currencyFormatter },
        { field: "income_tax", headerName: "Income Tax", minWidth: 115, valueFormatter: currencyFormatter },
        { field: "social_security", headerName: "Social Sec.", minWidth: 115, valueFormatter: currencyFormatter },
        { field: "provident_fund", headerName: "Prov. Fund", minWidth: 115, valueFormatter: currencyFormatter },
        { field: "loan_emi", headerName: "Loan EMI", minWidth: 110, valueFormatter: currencyFormatter },
        { field: "deductions", headerName: "Total Ded.", minWidth: 115, valueFormatter: currencyFormatter },
        { field: "net_pay", headerName: "Net Pay", pinned: "right", minWidth: 120, valueFormatter: currencyFormatter,
          cellStyle: { fontWeight: 600 },
        },
      ];

      // Add per-employee payslip download column when payslip records exist
      if (payslipRecords && payslipRecords.length > 0 && onDownloadPayslip) {
        cols.push({
          headerName: "Payslip",
          pinned: "right",
          minWidth: 90,
          maxWidth: 90,
          sortable: false,
          filter: false,
          resizable: false,
          cellRenderer: (params: ICellRendererParams<PayrollRow>) => {
            const name = params.data?.employee_name;
            if (!name) return null;
            const rec = payslipByName.get(name.toLowerCase());
            if (!rec) return null;
            return (
              <button
                className="inline-flex items-center justify-center gap-1 text-primary hover:text-primary/80 transition-colors text-xs font-medium h-full"
                title={`Download payslip for ${name}`}
                onClick={() => onDownloadPayslip(rec.file_path, rec.file_name)}
              >
                <FileDown className="h-3.5 w-3.5" />
                PDF
              </button>
            );
          },
        });
      }

      return cols;
    },
    [currencyFormatter, hoursFormatter, payslipRecords, payslipByName, onDownloadPayslip]
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
    }),
    []
  );

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridRef.current = params.api;
    params.api.sizeColumnsToFit();
  }, []);

  const handleDownloadCSV = useCallback(() => {
    // Recalculate required hours from the period dates for CSV accuracy
    const { workDays, requiredHours: rangeReqHours } = calculateWorkingHours(periodStart, periodEnd);
    const { requiredHours: monthlyReqHours } = calculateMonthlyWorkingHours(periodStart);

    const exportRows = rows.map((r) =>
      mapDetailToExportRow({
        employee_name: r.employee_name,
        department: r.department,
        hourly_rate: r.hourly_rate,
        days_worked: r.days_worked,
        actual_hours: r.actual_hours,
        payable_hours: r.payable_hours,
        extra_hours: r.extra_hours,
        bank_hours_used: r.bank_hours_used,
        paid_leave_days: r.paid_leave_days,
        unpaid_leave_days: r.unpaid_leave_days,
        gross_pay: r.gross_pay,
        income_tax: r.income_tax,
        social_security: r.social_security,
        provident_fund: r.provident_fund,
        loan_emi: r.loan_emi,
        deductions: r.deductions,
        net_pay: r.net_pay,
      }, rangeReqHours, monthlyReqHours, workDays, region)
    );
    exportPayrollCSV(exportRows, region, periodStart);
  }, [rows, periodStart, periodEnd, region]);

  return (
    <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Table2 className="h-5 w-5 text-primary" />
          Payroll Details — {format(new Date(periodStart + "T00:00:00"), "MMM d")} – {format(new Date(periodEnd + "T00:00:00"), "MMM d, yyyy")}
        </CardTitle>
        <div className="flex items-center gap-2">
          {payslipRecords && payslipRecords.length > 0 && onDownloadAllPayslips && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onDownloadAllPayslips}>
              <FileDown className="h-3.5 w-3.5" />
              All Payslips (ZIP)
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadCSV}>
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="ag-theme-alpine w-full"
          style={{ height: Math.min(600, 56 + rows.length * 42) }}
        >
          <AgGridReact<PayrollRow>
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            animateRows
            domLayout="normal"
            suppressCellFocus
          />
        </div>
      </CardContent>
    </Card>
  );
}
