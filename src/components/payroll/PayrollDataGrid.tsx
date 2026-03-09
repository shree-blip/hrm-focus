import { useMemo, useCallback, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridReadyEvent, GridApi } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Table2 } from "lucide-react";
import { format } from "date-fns";
import { exportPayrollCSV, mapDetailToExportRow } from "@/lib/payrollCsvExport";
import { calculateWorkingHours, calculateMonthlyWorkingHours } from "@/lib/payrollHours";
import "@/styles/ag-grid-theme.css";

ModuleRegistry.registerModules([AllCommunityModule]);

export interface PayrollRow {
  employee_name: string;
  department: string;
  hourly_rate: number;
  total_working_days: number;
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
}

export function PayrollDataGrid({ rows, region, periodStart, periodEnd }: PayrollDataGridProps) {
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

  const columnDefs = useMemo<ColDef<PayrollRow>[]>(
    () => [
      { field: "employee_name", headerName: "Employee", pinned: "left", minWidth: 180, filter: "agTextColumnFilter" },
      { field: "department", headerName: "Dept", minWidth: 120, filter: "agTextColumnFilter" },
      { field: "hourly_rate", headerName: "Hourly Rate", minWidth: 110, valueFormatter: currencyFormatter },
      { field: "total_working_days", headerName: "Working Days", minWidth: 115 },
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
    ],
    [currencyFormatter, hoursFormatter]
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
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadCSV}>
          <Download className="h-3.5 w-3.5" />
          Download CSV
        </Button>
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
