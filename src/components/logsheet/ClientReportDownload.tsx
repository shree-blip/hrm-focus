import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  CalendarIcon,
  Download,
  FileText,
  Loader2,
  Check,
  ChevronsUpDown,
  Briefcase,
  User,
  X,
  FileSpreadsheet,
  Building2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportLog {
  id: string;
  log_date: string;
  task_description: string;
  time_spent_minutes: number;
  notes: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  department: string | null;
  employee?: {
    first_name: string;
    last_name: string;
    department: string | null;
  };
  client?: {
    name: string;
    client_id: string | null;
  };
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  employee_id: string | null;
  email: string | null;
}

// ─── Nested Department Data ─────────────────────────────────────────────────
interface DepartmentItem {
  label: string;
  value: string;
  children?: { label: string; value: string }[];
}

const DEPARTMENTS: DepartmentItem[] = [
  {
    label: "Tax",
    value: "Tax",
    children: [
      { label: "Tax", value: "Tax" },
      { label: "Tax Preparation", value: "Tax_Preparation" },
      { label: "Tax Return Review", value: "Tax_Return_Review" },
      { label: "Tax Return Walk Through", value: "Tax_Return_Walk_Through" },
      { label: "Tax Return Compliance", value: "Tax_Return_Compliance" },
      { label: "TR Compliance", value: "TR_Compliance" },
      { label: "TR Closure", value: "TR_Closure" },
      { label: "TR Invoicing", value: "TR_Invoicing" },
    ],
  },
  {
    label: "Payroll",
    value: "Payroll",
    children: [
      { label: "Payroll", value: "Payroll_" },
      { label: "Payroll Preparation", value: "Payroll_Preparation" },
      { label: "Payroll Notice Resolution", value: "Payroll_Notice_Resolution" },
      { label: "Payroll Documentation", value: "Payroll_Documentation" },
    ],
  },
  {
    label: "Accounting",
    value: "Accounting",
    children: [
      { label: "Accounting", value: "Accounting" },
      { label: "Daily Bookkeeping", value: "Daily_Bookkeeping" },
      { label: "Month End Closing", value: "Month_End_Closing" },
      { label: "Book Review", value: "Book_Review" },
      { label: "Book Discussion with Client", value: "Book_Discussion_with_Client" },
      { label: "Sales Tax Preparation & Filing", value: "Sales_Tax_Preparation_Filing" },
      { label: "Sales Tax Notice Resolution", value: "Sales_Tax_Notice_Resolution" },
    ],
  },

  { label: "Marketing", value: "Marketing" },
  { label: "Sales", value: "Sales" },
  { label: "Human Resources", value: "Human Resources" },
  { label: "Finance", value: "Finance" },
  { label: "Operations", value: "Operations" },
  { label: "Design", value: "Design" },
  { label: "Customer Support", value: "Customer Support" },
  { label: "Legal", value: "Legal" },
  { label: "Engineering", value: "Engineering" },
  { label: "Product", value: "Product" },
  { label: "Other", value: "Other" },
];

// Helper: find display label for a department value
function getDepartmentDisplayLabel(value: string): string | null {
  for (const dept of DEPARTMENTS) {
    if (dept.value === value) return dept.label;
    if (dept.children) {
      const child = dept.children.find((c) => c.value === value);
      if (child) return `${dept.label} → ${child.label}`;
    }
  }
  return null;
}

// ─── Department Select (collapsible nested dropdown) ────────────────────────
interface DepartmentSelectProps {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  placeholder?: string;
}

function DepartmentSelect({
  value,
  onChange,
  compact = false,
  placeholder = "All departments",
}: DepartmentSelectProps) {
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupValue: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(groupValue) ? next.delete(groupValue) : next.add(groupValue);
      return next;
    });
  };

  const displayLabel = useMemo(() => getDepartmentDisplayLabel(value), [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "w-full justify-between font-normal",
            compact ? "h-9 text-sm" : "",
            !displayLabel && "text-muted-foreground",
          )}
        >
          <span className="truncate">{displayLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0" align="start">
        <div className="max-h-[400px] overflow-y-auto p-1">
          {DEPARTMENTS.map((dept) => {
            const hasChildren = dept.children && dept.children.length > 0;
            const isExpanded = expandedGroups.has(dept.value);

            return (
              <div key={dept.value}>
                {/* Parent row */}
                <div className="flex items-center">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                      value === dept.value && "bg-accent",
                    )}
                    onClick={() => {
                      if (!hasChildren) {
                        onChange(dept.value);
                        setOpen(false);
                      } else {
                        toggleGroup(dept.value);
                      }
                    }}
                  >
                    <Check className={cn("h-4 w-4 shrink-0", value === dept.value ? "opacity-100" : "opacity-0")} />
                    <span className={cn(hasChildren && "font-medium")}>{dept.label}</span>
                  </button>

                  {hasChildren && (
                    <button
                      type="button"
                      className="p-1.5 rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroup(dept.value);
                      }}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  )}
                </div>

                {/* Children (collapsible) */}
                {hasChildren && isExpanded && (
                  <div className="ml-4 border-l pl-1 my-0.5">
                    {dept.children!.map((child) => (
                      <button
                        key={child.value}
                        type="button"
                        className={cn(
                          "w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                          value === child.value && "bg-accent",
                        )}
                        onClick={() => {
                          onChange(child.value);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn("h-4 w-4 shrink-0", value === child.value ? "opacity-100" : "opacity-0")}
                        />
                        <span>{child.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper to format minutes as hours and minutes
const formatTime = (totalMinutes: number) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// Helper to format minutes as decimal hours (e.g., 90 minutes = 1.50 hours)
const formatDecimalHours = (totalMinutes: number) => {
  return (totalMinutes / 60).toFixed(2);
};

export function ClientReportDownload() {
  const { clients, loading: clientsLoading } = useClients();
  const { toast } = useToast();

  // Employee data state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);

  // Client search state
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("");

  // Employee search state
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");

  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [reportLogs, setReportLogs] = useState<ReportLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data, error } = await supabase
          .from("employees")
          .select("id, first_name, last_name, department, employee_id, email")
          .order("first_name", { ascending: true });

        if (error) throw error;
        setEmployees(data || []);
      } catch (error) {
        console.error("Error fetching employees:", error);
      } finally {
        setEmployeesLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  // Filter clients based on search query
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients;
    const query = clientSearchQuery.toLowerCase();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        (client.client_id && client.client_id.toLowerCase().includes(query)),
    );
  }, [clients, clientSearchQuery]);

  // Filter employees based on search query
  const filteredEmployees = useMemo(() => {
    if (!employeeSearchQuery.trim()) return employees;
    const query = employeeSearchQuery.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.first_name.toLowerCase().includes(query) ||
        emp.last_name.toLowerCase().includes(query) ||
        `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(query) ||
        (emp.employee_id && emp.employee_id.toLowerCase().includes(query)) ||
        (emp.email && emp.email.toLowerCase().includes(query)),
    );
  }, [employees, employeeSearchQuery]);

  // Get selected client object
  const selectedClientObj = useMemo(() => {
    if (!selectedClient) return null;
    return clients.find((c) => c.id === selectedClient);
  }, [selectedClient, clients]);

  // Get selected employee object
  const selectedEmployeeObj = useMemo(() => {
    if (!selectedEmployee) return null;
    return employees.find((e) => e.id === selectedEmployee);
  }, [selectedEmployee, employees]);

  // Get selected client display text
  const selectedClientDisplay = selectedClientObj
    ? selectedClientObj.client_id
      ? `${selectedClientObj.name} (${selectedClientObj.client_id})`
      : selectedClientObj.name
    : null;

  // Get selected employee display text
  const selectedEmployeeDisplay = selectedEmployeeObj
    ? selectedEmployeeObj.employee_id
      ? `${selectedEmployeeObj.first_name} ${selectedEmployeeObj.last_name} (${selectedEmployeeObj.employee_id})`
      : `${selectedEmployeeObj.first_name} ${selectedEmployeeObj.last_name}`
    : null;

  // Calculate time spent by each employee — uses log.department (work log dept)
  const employeeTimeSummary = useMemo(() => {
    const summary: Record<string, { name: string; department: string; totalMinutes: number }> = {};

    reportLogs.forEach((log) => {
      const employeeName = log.employee ? `${log.employee.first_name} ${log.employee.last_name}` : "Unassigned";
      // USE log.department (work log department), NOT log.employee.department (profile)
      const deptValue = log.department || log.employee?.department || "N/A";
      const department = getDepartmentDisplayLabel(deptValue) || deptValue;
      const key = employeeName;

      if (!summary[key]) {
        summary[key] = { name: employeeName, department, totalMinutes: 0 };
      }
      summary[key].totalMinutes += log.time_spent_minutes;
    });

    return Object.values(summary).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [reportLogs]);

  // Calculate time spent by each client (for employee reports)
  const clientTimeSummary = useMemo(() => {
    const summary: Record<string, { name: string; clientId: string | null; totalMinutes: number }> = {};

    reportLogs.forEach((log) => {
      const clientName = log.client?.name || "No Client";
      const clientId = log.client?.client_id || null;
      const key = clientName;

      if (!summary[key]) {
        summary[key] = { name: clientName, clientId, totalMinutes: 0 };
      }
      summary[key].totalMinutes += log.time_spent_minutes;
    });

    return Object.values(summary).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [reportLogs]);

  // Calculate time spent by each department — uses log.department (work log dept)
  const departmentTimeSummary = useMemo(() => {
    const summary: Record<string, { name: string; rawValue: string; totalMinutes: number }> = {};

    reportLogs.forEach((log) => {
      const deptRaw = log.department || "No Department";
      const deptDisplay = getDepartmentDisplayLabel(deptRaw) || deptRaw;
      if (!summary[deptRaw]) {
        summary[deptRaw] = { name: deptDisplay, rawValue: deptRaw, totalMinutes: 0 };
      }
      summary[deptRaw].totalMinutes += log.time_spent_minutes;
    });

    return Object.values(summary).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [reportLogs]);

  const handleClientSelect = (clientId: string) => {
    setSelectedClient(clientId);
    setClientSearchOpen(false);
    setClientSearchQuery("");
  };

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    setEmployeeSearchOpen(false);
    setEmployeeSearchQuery("");
  };

  const clearClient = () => {
    setSelectedClient("");
  };

  const clearEmployee = () => {
    setSelectedEmployee("");
  };

  const clearDepartment = () => {
    setSelectedDepartment("");
  };

  const fetchReport = async () => {
    setLoading(true);
    setHasSearched(true);

    try {
      let query = supabase
        .from("work_logs")
        .select(
          `
          id,
          log_date,
          task_description,
          time_spent_minutes,
          notes,
          start_time,
          end_time,
          status,
          department,
          employee:employees(first_name, last_name, department),
          client:clients(name, client_id)
        `,
        )
        .gte("log_date", format(startDate, "yyyy-MM-dd"))
        .lte("log_date", format(endDate, "yyyy-MM-dd"))
        .order("log_date", { ascending: false });

      // Apply filters only if selected
      if (selectedClient) {
        query = query.eq("client_id", selectedClient);
      }
      if (selectedEmployee) {
        query = query.eq("employee_id", selectedEmployee);
      }
      if (selectedDepartment) {
        query = query.eq("department", selectedDepartment);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReportLogs((data as ReportLog[]) || []);
    } catch (error: any) {
      console.error("Error fetching report:", error);
      toast({
        title: "Error",
        description: "Failed to fetch report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (reportLogs.length === 0) return;

    const clientName = selectedClientObj?.name || "All Clients";
    const clientCode = selectedClientObj?.client_id || "";
    const employeeName = selectedEmployeeObj
      ? `${selectedEmployeeObj.first_name} ${selectedEmployeeObj.last_name}`
      : "All Employees";
    const employeeCode = selectedEmployeeObj?.employee_id || "";
    const totalMinutes = reportLogs.reduce((sum, log) => sum + log.time_spent_minutes, 0);

    // Determine report type for header
    const isAllReport = !selectedClient && !selectedEmployee && !selectedDepartment;
    const reportTitle = isAllReport ? "COMPLETE WORK LOG REPORT - ALL CLIENTS & EMPLOYEES" : "WORK LOG REPORT";

    // Build CSV content with sections
    const csvLines: string[] = [];

    // ===== SECTION 1: Report Header =====
    csvLines.push(reportTitle);
    csvLines.push("");

    // Client info
    if (selectedClient) {
      csvLines.push(`Client Name,${clientName}`);
      if (clientCode) {
        csvLines.push(`Client ID,${clientCode}`);
      }
    } else {
      csvLines.push("Client Filter,All Clients");
    }

    // Employee info
    if (selectedEmployee) {
      csvLines.push(`Employee Name,${employeeName}`);
      if (employeeCode) {
        csvLines.push(`Employee ID,${employeeCode}`);
      }
    } else {
      csvLines.push("Employee Filter,All Employees");
    }

    // Department info
    if (selectedDepartment) {
      const deptDisplay = getDepartmentDisplayLabel(selectedDepartment) || selectedDepartment;
      csvLines.push(`Department Filter,${deptDisplay}`);
    } else {
      csvLines.push("Department Filter,All Departments");
    }

    csvLines.push(`Report Period,${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`);
    csvLines.push(`Generated On,${format(new Date(), "yyyy-MM-dd HH:mm")}`);
    csvLines.push("");

    // ===== SECTION 2: Summary Statistics =====
    csvLines.push("SUMMARY");
    csvLines.push("");
    csvLines.push(`Total Entries,${reportLogs.length}`);
    csvLines.push(`Total Time,${formatTime(totalMinutes)} (${formatDecimalHours(totalMinutes)} hours)`);
    if (!selectedClient) {
      csvLines.push(`Total Clients,${clientTimeSummary.length}`);
    }
    if (!selectedEmployee) {
      csvLines.push(`Total Employees,${employeeTimeSummary.length}`);
    }
    if (!selectedDepartment) {
      csvLines.push(`Total Departments,${departmentTimeSummary.length}`);
    }
    csvLines.push("");

    // ===== SECTION 3: Time by Client (if not filtering by single client) =====
    if (!selectedClient && clientTimeSummary.length > 0) {
      csvLines.push("TIME BY CLIENT");
      csvLines.push("");
      csvLines.push("Client Name,Client ID,Total Time,Hours (Decimal)");

      clientTimeSummary.forEach((client) => {
        csvLines.push(
          `"${client.name}","${client.clientId || "N/A"}","${formatTime(client.totalMinutes)}",${formatDecimalHours(client.totalMinutes)}`,
        );
      });

      csvLines.push(`"TOTAL","","${formatTime(totalMinutes)}",${formatDecimalHours(totalMinutes)}`);
      csvLines.push("");
    }

    // ===== SECTION 4: Time by Employee (if not filtering by single employee) =====
    if (!selectedEmployee && employeeTimeSummary.length > 0) {
      csvLines.push("TIME BY EMPLOYEE");
      csvLines.push("");
      csvLines.push("Employee Name,Department,Total Time,Hours (Decimal)");

      employeeTimeSummary.forEach((emp) => {
        csvLines.push(
          `"${emp.name}","${emp.department}","${formatTime(emp.totalMinutes)}",${formatDecimalHours(emp.totalMinutes)}`,
        );
      });

      csvLines.push(`"TOTAL","","${formatTime(totalMinutes)}",${formatDecimalHours(totalMinutes)}`);
      csvLines.push("");
    }

    // ===== SECTION 4b: Time by Department =====
    if (!selectedDepartment && departmentTimeSummary.length > 0) {
      csvLines.push("TIME BY DEPARTMENT");
      csvLines.push("");
      csvLines.push("Department,Total Time,Hours (Decimal)");

      departmentTimeSummary.forEach((dept) => {
        csvLines.push(`"${dept.name}","${formatTime(dept.totalMinutes)}",${formatDecimalHours(dept.totalMinutes)}`);
      });

      csvLines.push(`"TOTAL","${formatTime(totalMinutes)}",${formatDecimalHours(totalMinutes)}`);
      csvLines.push("");
    }

    // ===== SECTION 5: Detailed Log Entries =====
    csvLines.push("DETAILED LOG ENTRIES");
    csvLines.push("");

    const detailHeaders = [
      "Date",
      "Employee",
      "Department",
      "Client",
      "Client ID",
      "Task",
      "Time Spent",
      "Hours (Decimal)",
      "Start Time",
      "End Time",
      "Status",
      "Notes",
    ];
    csvLines.push(detailHeaders.join(","));

    reportLogs.forEach((log) => {
      const deptDisplay = log.department ? getDepartmentDisplayLabel(log.department) || log.department : "N/A";
      const row = [
        format(new Date(log.log_date), "yyyy-MM-dd"),
        log.employee ? `"${log.employee.first_name} ${log.employee.last_name}"` : "N/A",
        `"${deptDisplay}"`,
        log.client?.name ? `"${log.client.name}"` : "N/A",
        log.client?.client_id || "N/A",
        `"${log.task_description.replace(/"/g, '""')}"`,
        formatTime(log.time_spent_minutes),
        formatDecimalHours(log.time_spent_minutes),
        log.start_time || "",
        log.end_time || "",
        log.status || "completed",
        `"${(log.notes || "").replace(/"/g, '""')}"`,
      ];
      csvLines.push(row.join(","));
    });

    // Create and download the file
    const csvContent = csvLines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    // Generate filename based on filters
    let fileName = "work_logs";
    if (selectedClient) {
      fileName += `_${clientName.replace(/\s+/g, "_")}`;
      if (clientCode) fileName += `_${clientCode}`;
    } else {
      fileName += "_all_clients";
    }
    if (selectedEmployee) {
      fileName += `_${employeeName.replace(/\s+/g, "_")}`;
      if (employeeCode) fileName += `_${employeeCode}`;
    } else {
      fileName += "_all_employees";
    }
    if (selectedDepartment) {
      const deptLabel = getDepartmentDisplayLabel(selectedDepartment) || selectedDepartment;
      fileName += `_${deptLabel.replace(/[→\s]+/g, "_")}`;
    }
    fileName += `_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.csv`;

    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Download Started",
      description: "Your report is being downloaded",
    });
  };

  const totalHours = reportLogs.reduce((sum, log) => sum + log.time_spent_minutes, 0);

  // Determine report type label
  const getReportTypeLabel = () => {
    if (!selectedClient && !selectedEmployee && !selectedDepartment) return "All Data";
    const parts: string[] = [];
    if (selectedClient) parts.push("Client");
    if (selectedEmployee) parts.push("Employee");
    if (selectedDepartment) parts.push("Department");
    return parts.join(" & ");
  };

  // Check if it's an "all data" report
  const isAllDataReport = !selectedClient && !selectedEmployee && !selectedDepartment;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Work Log Report Download
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Searchable Client Selection */}
          <div className="space-y-2">
            <Label>Client</Label>
            <div className="relative">
              <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientSearchOpen}
                    className="w-full justify-between font-normal pr-8"
                  >
                    <span className="truncate">{selectedClientDisplay || "All clients"}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search by name or client ID..."
                      value={clientSearchQuery}
                      onValueChange={setClientSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          No clients found matching "{clientSearchQuery}"
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredClients.map((client) => (
                          <CommandItem key={client.id} value={client.id} onSelect={() => handleClientSelect(client.id)}>
                            <Check
                              className={cn("mr-2 h-4 w-4", selectedClient === client.id ? "opacity-100" : "opacity-0")}
                            />
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium">{client.name}</span>
                              </div>
                              {client.client_id && (
                                <span className="text-xs text-muted-foreground ml-5">ID: {client.client_id}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedClient && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                  onClick={clearClient}
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
              )}
            </div>
          </div>

          {/* Searchable Employee Selection */}
          <div className="space-y-2">
            <Label>Employee</Label>
            <div className="relative">
              <Popover open={employeeSearchOpen} onOpenChange={setEmployeeSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={employeeSearchOpen}
                    className="w-full justify-between font-normal pr-8"
                  >
                    <span className="truncate">{selectedEmployeeDisplay || "All employees"}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search by name, ID, or email..."
                      value={employeeSearchQuery}
                      onValueChange={setEmployeeSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          No employees found matching "{employeeSearchQuery}"
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredEmployees.map((emp) => (
                          <CommandItem key={emp.id} value={emp.id} onSelect={() => handleEmployeeSelect(emp.id)}>
                            <Check
                              className={cn("mr-2 h-4 w-4", selectedEmployee === emp.id ? "opacity-100" : "opacity-0")}
                            />
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium">
                                  {emp.first_name} {emp.last_name}
                                </span>
                              </div>
                              <div className="flex gap-2 ml-5">
                                {emp.employee_id && (
                                  <span className="text-xs text-muted-foreground">ID: {emp.employee_id}</span>
                                )}
                                {emp.department && (
                                  <span className="text-xs text-muted-foreground">• {emp.department}</span>
                                )}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedEmployee && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                  onClick={clearEmployee}
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
              )}
            </div>
          </div>

          {/* Department Filter — now nested dropdown */}
          <div className="space-y-2">
            <Label>Department</Label>
            <div className="relative">
              <DepartmentSelect
                value={selectedDepartment}
                onChange={setSelectedDepartment}
                placeholder="All departments"
              />
              {selectedDepartment && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-8 top-0 h-full px-2 hover:bg-transparent z-10"
                  onClick={clearDepartment}
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(endDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={(date) => date && setEndDate(date)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-end gap-2">
            <Button onClick={fetchReport} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generate Report
            </Button>
          </div>
        </div>

        {/* Helper text */}
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isAllDataReport
              ? "Generate a complete report for all clients and employees within the selected date range."
              : "Filter by client, employee, department, or any combination. Leave filters empty for a complete report."}
          </p>
        </div>

        {/* Results */}
        {hasSearched && (
          <>
            {/* Summary */}
            {reportLogs.length > 0 && (
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex flex-wrap items-center gap-6">
                  <Badge
                    variant={isAllDataReport ? "default" : "outline"}
                    className={cn("text-xs", isAllDataReport && "bg-primary")}
                  >
                    {getReportTypeLabel()} Report
                  </Badge>
                  {selectedClientObj && (
                    <div>
                      <p className="text-sm text-muted-foreground">Client</p>
                      <p className="font-semibold">
                        {selectedClientObj.name}
                        {selectedClientObj.client_id && (
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            ({selectedClientObj.client_id})
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  {selectedEmployeeObj && (
                    <div>
                      <p className="text-sm text-muted-foreground">Employee</p>
                      <p className="font-semibold">
                        {selectedEmployeeObj.first_name} {selectedEmployeeObj.last_name}
                        {selectedEmployeeObj.employee_id && (
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            ({selectedEmployeeObj.employee_id})
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  {selectedDepartment && (
                    <div>
                      <p className="text-sm text-muted-foreground">Department</p>
                      <p className="font-semibold">
                        {getDepartmentDisplayLabel(selectedDepartment) || selectedDepartment}
                      </p>
                    </div>
                  )}
                  {!selectedClient && (
                    <div>
                      <p className="text-sm text-muted-foreground">Total Clients</p>
                      <p className="text-2xl font-bold">{clientTimeSummary.length}</p>
                    </div>
                  )}
                  {!selectedEmployee && (
                    <div>
                      <p className="text-sm text-muted-foreground">Total Employees</p>
                      <p className="text-2xl font-bold">{employeeTimeSummary.length}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Total Entries</p>
                    <p className="text-2xl font-bold">{reportLogs.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Time</p>
                    <p className="text-2xl font-bold">{formatTime(totalHours)}</p>
                  </div>
                </div>
                <Button onClick={downloadCSV} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </div>
            )}

            {/* Time by Client Summary */}
            {reportLogs.length > 0 && !selectedClient && clientTimeSummary.length > 0 && (
              <div className="p-4 border rounded-lg bg-card">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Time by Client ({clientTimeSummary.length} clients)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                  {clientTimeSummary.map((client) => (
                    <div key={client.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                      <div>
                        <p className="font-medium text-sm">{client.name}</p>
                        {client.clientId && <p className="text-xs text-muted-foreground">ID: {client.clientId}</p>}
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {formatTime(client.totalMinutes)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Time by Employee Summary */}
            {reportLogs.length > 0 && !selectedEmployee && employeeTimeSummary.length > 0 && (
              <div className="p-4 border rounded-lg bg-card">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Time by Employee ({employeeTimeSummary.length} employees)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                  {employeeTimeSummary.map((emp) => (
                    <div key={emp.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                      <div>
                        <p className="font-medium text-sm">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">{emp.department}</p>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {formatTime(emp.totalMinutes)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Time by Department Summary */}
            {reportLogs.length > 0 && !selectedDepartment && departmentTimeSummary.length > 0 && (
              <div className="p-4 border rounded-lg bg-card">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Time by Department ({departmentTimeSummary.length} departments)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                  {departmentTimeSummary.map((dept) => (
                    <div key={dept.rawValue} className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                      <p className="font-medium text-sm">{dept.name}</p>
                      <Badge variant="secondary" className="ml-2">
                        {formatTime(dept.totalMinutes)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TABLE — 7 headers, 7 cells, using log.department
                Same pattern as Team Logs tab in LogSheet.tsx
            ═══════════════════════════════════════════════════════════ */}
            {reportLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No logs found for the selected filters in the date range</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportLogs.slice(0, 15).map((log) => (
                      <TableRow key={log.id}>
                        {/* 1. Date */}
                        <TableCell>{format(new Date(log.log_date), "MMM d, yyyy")}</TableCell>
                        {/* 2. Employee name */}
                        <TableCell>
                          {log.employee ? `${log.employee.first_name} ${log.employee.last_name}` : "N/A"}
                        </TableCell>
                        {/* 3. Department — from work_logs.department with friendly label */}
                        <TableCell>
                          {log.department ? (
                            <Badge variant="secondary" className="font-normal text-xs">
                              {getDepartmentDisplayLabel(log.department) || log.department}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        {/* 4. Client */}
                        <TableCell>
                          {log.client?.name ? (
                            <div className="flex flex-col">
                              <span>{log.client.name}</span>
                              {log.client.client_id && (
                                <span className="text-xs text-muted-foreground">{log.client.client_id}</span>
                              )}
                            </div>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                        {/* 5. Task */}
                        <TableCell className="max-w-xs">
                          <p className="truncate">{log.task_description}</p>
                        </TableCell>
                        {/* 6. Time */}
                        <TableCell>
                          <Badge variant="secondary">{formatTime(log.time_spent_minutes)}</Badge>
                        </TableCell>
                        {/* 7. Status */}
                        <TableCell>
                          <Badge variant={log.status === "in_progress" ? "default" : "outline"}>
                            {log.status || "completed"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {reportLogs.length > 15 && (
                  <div className="p-3 text-center text-sm text-muted-foreground bg-muted/30">
                    Showing 15 of {reportLogs.length} entries. Download CSV for full report.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
