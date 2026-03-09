import { useMemo, useCallback, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridReadyEvent,
  type GridApi,
} from "ag-grid-community";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Table2 } from "lucide-react";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import { format } from "date-fns";

ModuleRegistry.registerModules([AllCommunityModule]);

export interface PayrollRow {
  employee_name: string;
  department: string;
  hourly_rate: number;
  required_hours: number;
  actual_hours: number;
  payable_hours: number;
  extra_hours: number;
  bank_hours_used: number;
  gross_pay: number;
  income_tax: number;
  social_security: number;
  provident_fund: number;
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
      { field: "hourly_rate", headerName: "Hourly Rate", minWidth: 110, valueFormatter: currencyFormatter, type: "numericColumn" },
      { field: "required_hours", headerName: "Required Hrs", minWidth: 120, valueFormatter: hoursFormatter, type: "numericColumn" },
      { field: "actual_hours", headerName: "Actual Hrs", minWidth: 110, valueFormatter: hoursFormatter, type: "numericColumn" },
      { field: "payable_hours", headerName: "Payable Hrs", minWidth: 115, valueFormatter: hoursFormatter, type: "numericColumn" },
      { field: "extra_hours", headerName: "Extra Hrs", minWidth: 100, valueFormatter: hoursFormatter, type: "numericColumn" },
      { field: "bank_hours_used", headerName: "Bank Used", minWidth: 105, valueFormatter: hoursFormatter, type: "numericColumn" },
      { field: "gross_pay", headerName: "Gross Pay", minWidth: 120, valueFormatter: currencyFormatter, type: "numericColumn" },
      { field: "income_tax", headerName: "Income Tax", minWidth: 115, valueFormatter: currencyFormatter, type: "numericColumn" },
      { field: "social_security", headerName: "Social Sec.", minWidth: 115, valueFormatter: currencyFormatter, type: "numericColumn" },
      { field: "provident_fund", headerName: "Prov. Fund", minWidth: 115, valueFormatter: currencyFormatter, type: "numericColumn" },
      { field: "deductions", headerName: "Total Ded.", minWidth: 115, valueFormatter: currencyFormatter, type: "numericColumn" },
      { field: "net_pay", headerName: "Net Pay", pinned: "right", minWidth: 120, valueFormatter: currencyFormatter, type: "numericColumn",
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
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const fileName = `payroll-${format(new Date(periodStart + "T00:00:00"), "yyyy-MM")}-${region}.csv`;
    saveAs(blob, fileName);
  }, [rows, periodStart, region]);

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
