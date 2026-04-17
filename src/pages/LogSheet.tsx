import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EditHistoryDialog } from "@/components/logsheet/EditHistoryDialog";
import { AddClientDialog } from "@/components/logsheet/AddClientDialog";
import { ClientAlertPopup } from "@/components/logsheet/ClientAlertPopup";
import { TeamRealtimeDashboard } from "@/components/logsheet/TeamRealtimeDashboard";
import { TeamLogsFilters } from "@/components/logsheet/TeamLogsFilters";
import { ClientReportDownload } from "@/components/logsheet/ClientReportDownload";
import { useWorkLogs, WorkLogInput, calcMinutesBetween } from "@/hooks/useWorkLogs";
import { useClients } from "@/hooks/useClients";
import { useClientAlerts, ClientAlert } from "@/hooks/useClientAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useAuth } from "@/contexts/AuthContext";
import { format, addDays } from "date-fns";
import {
  CalendarIcon,
  Plus,
  Clock,
  Pencil,
  Trash2,
  Users,
  FileText,
  History,
  Download,
  Activity,
  Briefcase,
  Building2,
  Check,
  ChevronsUpDown,
  X,
  Save,
  Timer,
  PlayCircle,
  PauseCircle,
  StopCircle,
  StickyNote,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── CSV Export ──────────────────────────────────────────────────────────────
function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportLogsToCsv(logs: any[], fileName: string): void {
  const headers = [
    "Date",
    "Task Description",
    "Client",
    "Client ID",
    "Department",
    "Start Time",
    "End Time",
    "Duration",
    "Status",
    "Notes",
  ];

  const rows = logs.map((log) => [
    escapeCsv(log.log_date || ""),
    escapeCsv(log.task_description),
    escapeCsv(log.client?.name || ""),
    escapeCsv(log.client?.client_id || ""),
    escapeCsv((log.department || "").replace(/_/g, " ")),
    escapeCsv(log.start_time || ""),
    escapeCsv(log.end_time || ""),
    escapeCsv(formatTime(log.time_spent_minutes)),
    escapeCsv(log.status || ""),
    escapeCsv(log.notes || ""),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
  { label: "Finance", value: "Finance" },
  { label: "Operations", value: "Operations" },
  { label: "Design", value: "Design" },
  { label: "Engineering", value: "Engineering" },
  { label: "Human Resources", value: "Human Resources" },
  { label: "Customer Support", value: "Customer Support" },
  { label: "Legal", value: "Legal" },
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

import { formatTime12h, getCurrentTime24h, formatDuration } from "@/lib/timeFormat";

/** Get current time as HH:mm */
const getCurrentTime = getCurrentTime24h;

/** Format total minutes to human readable */
const formatTime = formatDuration;

// ─── Department Select (collapsible nested dropdown) ────────────────────────
interface DepartmentSelectProps {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

function DepartmentSelect({ value, onChange, compact = false }: DepartmentSelectProps) {
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
          <span className="truncate">{displayLabel || "Select department"}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0" align="start">
        <div className="max-h-[200px] overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
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
                        // Toggle expand when clicking a parent with children
                        toggleGroup(dept.value);
                      }
                    }}
                  >
                    <Check className={cn("h-4 w-4 shrink-0", value === dept.value ? "opacity-100" : "opacity-0")} />
                    <span className={cn(hasChildren && "font-medium")}>{dept.label}</span>
                  </button>

                  {/* Expand/collapse chevron for groups */}
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

// ─── Client Combobox (reusable for both add-dialog and inline edit) ─────────
interface ClientComboboxProps {
  clients: any[];
  value: string;
  onChange: (clientId: string) => void;
  onAddNew: () => void;
  canAddClient?: boolean;
  compact?: boolean;
}

function ClientCombobox({
  clients,
  value,
  onChange,
  onAddNew,
  canAddClient = false,
  compact = false,
}: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return clients;
    const q = query.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.client_id && c.client_id.toLowerCase().includes(q)),
    );
  }, [clients, query]);

  const display = useMemo(() => {
    if (!value) return null;
    const c = clients.find((cl) => cl.id === value);
    if (!c) return null;
    return c.client_id ? `${c.name} (${c.client_id})` : c.name;
  }, [value, clients]);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "justify-between font-normal flex-1",
              compact ? "h-9 text-sm" : "",
              !display && "text-muted-foreground",
            )}
          >
            <span className="truncate">{display || "Select client..."}</span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search name or ID..." value={query} onValueChange={setQuery} />
            <div className="max-h-[200px] overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
              <CommandList className="max-h-none overflow-visible">
                <CommandEmpty>
                  <div className="py-3 text-center text-sm">
                    <p className="text-muted-foreground">No clients found</p>
                    {canAddClient && (
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-1 text-primary"
                        onClick={() => {
                          onAddNew();
                          setOpen(false);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add New Client
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__none__"
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                    <span className="text-muted-foreground italic">No client</span>
                  </CommandItem>
                  {filtered.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={client.id}
                      onSelect={() => {
                        onChange(client.id);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === client.id ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{client.name}</span>
                        {client.client_id && (
                          <span className="text-xs text-muted-foreground">ID: {client.client_id}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {canAddClient && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("shrink-0", compact ? "h-9 w-9" : "h-10 w-10")}
          onClick={onAddNew}
          title="Add New Client"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LogSheet() {
  const {
    logs,
    teamLogs,
    loading,
    selectedDate,
    setSelectedDate,
    userDepartment,
    addLog,
    updateLog,
    quickUpdate,
    deleteLog,
    pauseLog,
    resumeLog,
  } = useWorkLogs();
  const { clients, loading: clientsLoading, refetch: refetchClients } = useClients();
  const { fetchAlertsForClient } = useClientAlerts();
  const { isManager, isVP, isLineManager, isAdmin } = useAuth();

  // Check if user can add clients (line_manager, manager, vp, admin only - not employees)
  const canAddClient = true;
  const [activeMainTab, setActiveMainTab] = usePersistentState("logsheet:activeMainTab", "my-logs");

  // ── Dialog / overlay state ────────────────────────────────────────────
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<string | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedLogForHistory, setSelectedLogForHistory] = useState<{
    id: string;
    task: string;
  } | null>(null);
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);

  // ── Export state ──────────────────────────────────────────────────────
  const [isExportPopoverOpen, setIsExportPopoverOpen] = useState(false);
  const [exportRangeFrom, setExportRangeFrom] = useState<Date>(new Date());
  const [exportRangeTo, setExportRangeTo] = useState<Date>(new Date());

  // ── Inline edit state ─────────────────────────────────────────────────
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineData, setInlineData] = useState({
    task_description: "",
    start_time: "",
    end_time: "",
    status: "completed",
    notes: "",
    client_id: "",
    department: "",
  });

  // Expanded rows (to show notes)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // ── Client alerts state ───────────────────────────────────────────────
  const [clientAlerts, setClientAlerts] = useState<ClientAlert[]>([]);
  const [alertClientName, setAlertClientName] = useState("");

  // ── Form data for add/edit dialog ─────────────────────────────────────
  const [formData, setFormData] = useState<WorkLogInput>({
    task_description: "",
    time_spent_minutes: 0,
    notes: "",
    client_id: "",
    department: "",
    start_time: "",
    end_time: "",
    status: "in_progress",
  });

  const calculatedTimeSpent = calcMinutesBetween(formData.start_time || "", formData.end_time || "");

  // ── Helpers ───────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormData({
      task_description: "",
      time_spent_minutes: 0,
      notes: "",
      client_id: "",
      department: userDepartment || "",
      start_time: "",
      end_time: "",
      status: "in_progress",
    });
    setEditingLog(null);
  };

  const handleOpenAddDialog = () => {
    setFormData({
      task_description: "",
      time_spent_minutes: 0,
      notes: "",
      client_id: "",
      department: userDepartment || "",
      start_time: getCurrentTime(),
      end_time: "",
      status: "in_progress",
    });
    setEditingLog(null);
    setIsAddDialogOpen(true);
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Client select handler (alerts) ────────────────────────────────────
  const handleClientSelectWithAlerts = async (clientId: string) => {
    if (clientId) {
      const alerts = await fetchAlertsForClient(clientId);
      if (alerts.length > 0) {
        const client = clients.find((c) => c.id === clientId);
        setAlertClientName(client?.name || "");
        setClientAlerts(alerts);
      }
    }
  };

  // ── Submit add/edit dialog ────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: WorkLogInput = {
      ...formData,
      time_spent_minutes: calculatedTimeSpent,
      client_id: formData.client_id || undefined,
      department: formData.department || undefined,
      start_time: formData.start_time || undefined,
      end_time: formData.end_time || undefined,
      status: !formData.end_time ? "in_progress" : formData.status || "completed",
    };
    if (editingLog) {
      await updateLog(editingLog, payload);
    } else {
      await addLog(payload);
    }
    resetForm();
    setIsAddDialogOpen(false);
  };

  // ── Full edit (opens dialog pre-filled) ───────────────────────────────
  const handleFullEdit = (log: any) => {
    setFormData({
      task_description: log.task_description,
      time_spent_minutes: log.time_spent_minutes,
      notes: log.notes || "",
      client_id: log.client_id || "",
      department: log.department || userDepartment || "",
      start_time: log.start_time || "",
      end_time: log.end_time || "",
      status: log.status || "completed",
    });
    setEditingLog(log.id);
    setIsAddDialogOpen(true);
  };

  // ── Inline edit handlers ──────────────────────────────────────────────
  const startInlineEdit = (log: any) => {
    setInlineEditId(log.id);
    setInlineData({
      task_description: log.task_description,
      start_time: log.start_time || "",
      end_time: log.end_time || "",
      status: log.status || "completed",
      notes: log.notes || "",
      client_id: log.client_id || "",
      department: log.department || "",
    });
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
  };

  const saveInlineEdit = async () => {
    if (!inlineEditId) return;
    const finalStatus = inlineData.end_time && inlineData.status !== "completed" ? "completed" : inlineData.status;
    // Auto-set end time when completing
    const finalEndTime = finalStatus === "completed" && !inlineData.end_time ? getCurrentTime() : inlineData.end_time;
    await quickUpdate(inlineEditId, {
      task_description: inlineData.task_description,
      start_time: inlineData.start_time,
      end_time: finalEndTime || undefined,
      status: finalStatus,
      notes: inlineData.notes,
      client_id: inlineData.client_id,
      department: inlineData.department,
    });
    cancelInlineEdit();
  };

  const handleEndNow = async (logId: string) => {
    await quickUpdate(logId, {
      end_time: getCurrentTime(),
      status: "completed",
    });
  };

  // ── Export CSV handler ────────────────────────────────────────────────
  const handleExportCsv = () => {
    const isSameDay = format(exportRangeFrom, "yyyy-MM-dd") === format(exportRangeTo, "yyyy-MM-dd");
    const fileName = isSameDay
      ? `my-logs-${format(exportRangeFrom, "yyyy-MM-dd")}`
      : `my-logs-${format(exportRangeFrom, "yyyy-MM-dd")}-to-${format(exportRangeTo, "yyyy-MM-dd")}`;
    exportLogsToCsv(logs, fileName);
    setIsExportPopoverOpen(false);
  };

  // ── Computed ──────────────────────────────────────────────────────────
  const totalTimeToday = logs.reduce((sum, log) => sum + log.time_spent_minutes, 0);
  const completedCount = logs.filter((l) => l.status === "completed").length;
  const inProgressCount = logs.filter((l) => l.status === "in_progress").length;
  const onHoldCount = logs.filter((l) => l.status === "on_hold").length;

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* ────────── HEADER ────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Log Sheet</h1>
            <p className="text-sm text-muted-foreground">Track your daily work activities</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(selectedDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Add Log Button */}
            <Button size="sm" className="gap-2" onClick={handleOpenAddDialog}>
              <Plus className="h-4 w-4" />
              Add Log
            </Button>
          </div>
        </div>

        {/* ────────── STAT CARDS ────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Time</p>
                <p className="text-xl font-bold">{formatTime(totalTimeToday)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-500/10">
                <Timer className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">In Progress</p>
                <p className="text-xl font-bold">{inProgressCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <Check className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Completed</p>
                <p className="text-xl font-bold">{completedCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-yellow-500/10">
                <FileText className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Logs</p>
                <p className="text-xl font-bold">{logs.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ────────── MAIN TABS ────────── */}
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="my-logs" className="gap-2">
              <FileText className="h-4 w-4" />
              My Logs
            </TabsTrigger>
            {(isManager || isVP || isLineManager) && (
              <>
                <TabsTrigger value="team-live" className="gap-2">
                  <Activity className="h-4 w-4" />
                  Team Live
                </TabsTrigger>
                <TabsTrigger value="team-logs" className="gap-2">
                  <Users className="h-4 w-4" />
                  Team Logs
                </TabsTrigger>
                <TabsTrigger value="reports" className="gap-2">
                  <Download className="h-4 w-4" />
                  Reports
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* ══════════ MY LOGS TAB ══════════ */}
          <TabsContent value="my-logs">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">{format(selectedDate, "EEEE, MMMM d, yyyy")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">No logs yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Click "Add Log" to start tracking your work</p>
                    <Button size="sm" className="mt-4 gap-2" onClick={handleOpenAddDialog}>
                      <Plus className="h-4 w-4" />
                      Add Your First Log
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {logs.map((log) => {
                      const isEditing = inlineEditId === log.id;
                      const isExpanded = expandedRows.has(log.id);
                      const isActive = log.status === "in_progress";
                      const isOnHold = log.status === "on_hold";
                      const isCompleted = log.status === "completed";

                      if (isEditing) {
                        /* ════════════ INLINE EDIT MODE ════════════ */
                        return (
                          <div key={log.id} className="p-4 bg-muted/40 space-y-4">
                            {/* Header row */}
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-primary">Editing Log</span>
                              <div className="flex items-center gap-1.5">
                                <Button size="sm" variant="default" className="gap-1.5 h-8" onClick={saveInlineEdit}>
                                  <Save className="h-3.5 w-3.5" />
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" className="gap-1.5 h-8" onClick={cancelInlineEdit}>
                                  <X className="h-3.5 w-3.5" />
                                  Cancel
                                </Button>
                              </div>
                            </div>

                            {/* Client + Department row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Client</Label>
                                <ClientCombobox
                                  clients={clients}
                                  value={inlineData.client_id}
                                  onChange={(id) => {
                                    setInlineData({
                                      ...inlineData,
                                      client_id: id,
                                    });
                                    if (id) handleClientSelectWithAlerts(id);
                                  }}
                                  onAddNew={() => setAddClientDialogOpen(true)}
                                  canAddClient={canAddClient}
                                  compact
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Department</Label>
                                <DepartmentSelect
                                  value={inlineData.department}
                                  onChange={(v) => setInlineData({ ...inlineData, department: v })}
                                  compact
                                />
                              </div>
                            </div>

                            {/* Task */}
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-muted-foreground">Task Description</Label>
                              <Textarea
                                value={inlineData.task_description}
                                onChange={(e) =>
                                  setInlineData({
                                    ...inlineData,
                                    task_description: e.target.value,
                                  })
                                }
                                rows={2}
                                className="text-sm resize-none"
                              />
                            </div>

                            {/* Time + Status row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Start Time</Label>
                                <Input
                                  type="time"
                                  value={inlineData.start_time}
                                  onChange={(e) =>
                                    setInlineData({
                                      ...inlineData,
                                      start_time: e.target.value,
                                    })
                                  }
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">End Time</Label>
                                <Input
                                  type="time"
                                  value={inlineData.end_time}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setInlineData({
                                      ...inlineData,
                                      end_time: val,
                                      ...(val ? { status: "completed" } : {}),
                                    });
                                  }}
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Duration</Label>
                                <div className="h-9 px-3 flex items-center rounded-md border bg-muted/50 text-sm font-medium">
                                  {inlineData.start_time && inlineData.end_time
                                    ? formatTime(calcMinutesBetween(inlineData.start_time, inlineData.end_time))
                                    : "—"}
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                                <Select
                                  value={inlineData.status}
                                  onValueChange={(v) => setInlineData({ ...inlineData, status: v })}
                                >
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="on_hold">On Hold</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
                              <Textarea
                                placeholder="Add notes..."
                                value={inlineData.notes}
                                onChange={(e) =>
                                  setInlineData({
                                    ...inlineData,
                                    notes: e.target.value,
                                  })
                                }
                                rows={2}
                                className="text-sm resize-none"
                              />
                            </div>
                          </div>
                        );
                      }

                      /* ════════════ NORMAL DISPLAY ROW ════════════ */
                      return (
                        <div key={log.id} className={cn("group", isActive && "bg-green-50/50 dark:bg-green-950/10")}>
                          {/* Main row */}
                          <div className="p-4 flex items-start gap-3">
                            {/* Status indicator */}
                            <div className="pt-0.5 flex-shrink-0">
                              {isActive ? (
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                              ) : isOnHold ? (
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              {/* Task + badges */}
                              <div className="flex items-start gap-2 flex-wrap">
                                <p className="font-medium text-sm text-foreground leading-snug">
                                  {log.task_description}
                                </p>
                              </div>

                              {/* Meta row: client, department, notes indicator */}
                              <div className="flex items-center gap-2 flex-wrap text-xs">
                                {log.client?.name && (
                                  <Badge variant="outline" className="gap-1 text-xs py-0 h-5 font-normal">
                                    <Briefcase className="h-3 w-3" />
                                    {log.client.name}
                                    {log.client.client_id && (
                                      <span className="text-muted-foreground ml-0.5">({log.client.client_id})</span>
                                    )}
                                  </Badge>
                                )}
                                {log.department && (
                                  <Badge variant="secondary" className="gap-1 text-xs py-0 h-5 font-normal">
                                    <Building2 className="h-3 w-3" />
                                    {getDepartmentDisplayLabel(log.department) || log.department}
                                  </Badge>
                                )}
                                {log.notes && (
                                  <button
                                    onClick={() => toggleRow(log.id)}
                                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <StickyNote className="h-3 w-3" />
                                    <span>Notes</span>
                                    {isExpanded ? (
                                      <ChevronUp className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                  </button>
                                )}
                              </div>

                              {/* Expanded notes */}
                              {isExpanded && log.notes && (
                                <div className="mt-2 p-2.5 rounded-md bg-muted/50 border text-sm text-muted-foreground whitespace-pre-wrap">
                                  {log.notes}
                                </div>
                              )}
                            </div>

                            {/* Right side: time + actions */}
                            <div className="flex-shrink-0 flex flex-col items-end gap-2">
                              {/* Time badge */}
                              <div className="text-right">
                                <div className="flex items-center gap-1.5">
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      "font-mono text-xs tabular-nums",
                                      isActive &&
                                        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                    )}
                                  >
                                    {log.time_spent_minutes > 0 ? formatTime(log.time_spent_minutes) : "—"}
                                  </Badge>
                                </div>
                                {log.start_time && (
                                  <p className="text-[11px] text-muted-foreground mt-1 font-mono tabular-nums">
                                    {formatTime12h(log.start_time)}
                                    {log.end_time ? (
                                      <>
                                        <span className="mx-0.5">→</span>
                                        {formatTime12h(log.end_time)}
                                      </>
                                    ) : isOnHold ? (
                                      <span className="text-yellow-600 ml-1">paused</span>
                                    ) : (
                                      <span className="text-green-600 ml-1">ongoing</span>
                                    )}
                                  </p>
                                )}
                                {(log as any).total_pause_minutes > 0 && (
                                  <p className="text-[10px] text-yellow-600 mt-0.5">
                                    ⏸ {formatTime((log as any).total_pause_minutes)} paused
                                  </p>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Pause button for active logs */}
                                {isActive && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1 text-xs px-2 border-yellow-200 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700 dark:border-yellow-800 dark:hover:bg-yellow-950"
                                    onClick={() => pauseLog(log.id)}
                                    title="Pause this log"
                                  >
                                    <PauseCircle className="h-3 w-3" />
                                    Hold
                                  </Button>
                                )}
                                {/* Resume button for on-hold logs */}
                                {isOnHold && !isCompleted && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1 text-xs px-2 border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:hover:bg-green-950"
                                    onClick={() => resumeLog(log.id)}
                                    title="Resume this log"
                                  >
                                    <PlayCircle className="h-3 w-3" />
                                    Resume
                                  </Button>
                                )}
                                {/* End Now for active logs */}
                                {isActive && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1 text-xs px-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950"
                                    onClick={() => handleEndNow(log.id)}
                                  >
                                    <StopCircle className="h-3 w-3" />
                                    End Now
                                  </Button>
                                )}
                                {/* Edit button - always available */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => startInlineEdit(log)}
                                  title="Quick edit"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setSelectedLogForHistory({
                                      id: log.id,
                                      task: log.task_description,
                                    });
                                    setHistoryDialogOpen(true);
                                  }}
                                  title="Edit history"
                                >
                                  <History className="h-3.5 w-3.5" />
                                </Button>
                                {/* Delete button - always available */}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete">
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete this log?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete the work log. This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteLog(log.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════ TEAM LIVE ══════════ */}
          {(isManager || isVP || isLineManager) && (
            <TabsContent value="team-live">
              <TeamRealtimeDashboard />
            </TabsContent>
          )}

          {/* ══════════ TEAM LOGS ══════════ */}

          {(isManager || isVP || isLineManager) && (
            <TabsContent value="team-logs">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    Team Logs — {format(selectedDate, "MMMM d, yyyy")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* ── Filters ── */}
                  <TeamLogsFilters
                    teamLogs={teamLogs}
                    clients={clients}
                    loading={loading}
                    getDepartmentDisplayLabel={getDepartmentDisplayLabel}
                    formatTime={formatTime}
                    formatTime12h={formatTime12h}
                    onViewHistory={(log) => {
                      setSelectedLogForHistory({
                        id: log.id,
                        task: log.task_description,
                      });
                      setHistoryDialogOpen(true);
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ══════════ REPORTS ══════════ */}
          {(isManager || isVP || isLineManager) && (
            <TabsContent value="reports">
              <ClientReportDownload />
            </TabsContent>
          )}
        </Tabs>

        {/* ────────── ADD / EDIT DIALOG ────────── */}
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              resetForm();
            }
          }}
        >
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">{editingLog ? "Edit Work Log" : "New Work Log"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Client */}
              <div className="space-y-1.5">
                <Label className="text-sm">Client </Label>
                <ClientCombobox
                  clients={clients}
                  value={formData.client_id || ""}
                  onChange={(id) => {
                    setFormData({ ...formData, client_id: id });
                    if (id) handleClientSelectWithAlerts(id);
                  }}
                  onAddNew={() => setAddClientDialogOpen(true)}
                  canAddClient={canAddClient}
                />
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Work Department
                  {userDepartment && !editingLog && (
                    <span className="text-xs text-muted-foreground ml-1.5">(auto-filled from profile)</span>
                  )}
                </Label>
                <DepartmentSelect
                  value={formData.department || ""}
                  onChange={(value) => setFormData({ ...formData, department: value })}
                />
              </div>

              <Separator />

              {/* Task */}
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Task Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  placeholder="What are you working on?"
                  value={formData.task_description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      task_description: e.target.value,
                    })
                  }
                  required
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    Start Time <span className="text-destructive">*</span>
                    {!editingLog && <span className="text-xs text-muted-foreground ml-1">(auto-set to now)</span>}
                  </Label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    End Time
                    <span className="text-xs text-muted-foreground ml-1">(optional)</span>
                  </Label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, end_time: val, ...(val ? { status: "completed" } : {}) });
                    }}
                  />
                </div>
              </div>

              {/* In-progress banner */}
              {!formData.end_time && formData.start_time && !editingLog && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                  <PlayCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Log will start as <strong>In Progress</strong>. Add end time later from the list.
                  </p>
                </div>
              )}

              {/* Calculated time */}
              {formData.start_time && formData.end_time && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                  <p className="text-sm font-medium">
                    Duration: <span className="text-primary">{formatTime(calculatedTimeSpent)}</span>
                  </p>
                </div>
              )}

              {/* Status (only if end time set) */}
              {formData.end_time && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-sm">Notes (optional)</Label>
                <Textarea
                  placeholder="Any additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="resize-none"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!formData.task_description || !formData.start_time}>
                  {editingLog ? (
                    "Update Log"
                  ) : formData.end_time ? (
                    <>
                      <Check className="h-4 w-4 mr-1.5" />
                      Add Log
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4 mr-1.5" />
                      Start Log
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ────────── EDIT HISTORY DIALOG ────────── */}
        {selectedLogForHistory && (
          <EditHistoryDialog
            open={historyDialogOpen}
            onOpenChange={setHistoryDialogOpen}
            workLogId={selectedLogForHistory.id}
            taskDescription={selectedLogForHistory.task}
          />
        )}

        {/* ────────── ADD CLIENT DIALOG ────────── */}
        <AddClientDialog
          open={addClientDialogOpen}
          onOpenChange={setAddClientDialogOpen}
          onClientAdded={async (clientId) => {
            await refetchClients();
            // Update whichever form is active
            if (inlineEditId) {
              setInlineData((prev) => ({ ...prev, client_id: clientId }));
            } else {
              setFormData((prev) => ({ ...prev, client_id: clientId }));
            }
          }}
        />

        {/* ────────── CLIENT ALERTS ────────── */}
        <ClientAlertPopup alerts={clientAlerts} clientName={alertClientName} onDismiss={() => setClientAlerts([])} />
      </div>
    </DashboardLayout>
  );
}
