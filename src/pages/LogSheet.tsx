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
import { ClientReportDownload } from "@/components/logsheet/ClientReportDownload";
import { useWorkLogs, WorkLogInput, calcMinutesBetween } from "@/hooks/useWorkLogs";
import { useClients } from "@/hooks/useClients";
import { useClientAlerts, ClientAlert } from "@/hooks/useClientAlerts";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
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
  StopCircle,
  StickyNote,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEPARTMENTS = [
  "Engineering",
  "Marketing",
  "Sales",
  "Human Resources",
  "Finance",
  "Operations",
  "Design",
  "Customer Support",
  "Legal",
  "Product",
];

import { formatTime12h, getCurrentTime24h, formatDuration } from "@/lib/timeFormat";

/** Get current time as HH:mm */
const getCurrentTime = getCurrentTime24h;

/** Format total minutes to human readable */
const formatTime = formatDuration;

// ─── Client Combobox (reusable for both add-dialog and inline edit) ─────────
interface ClientComboboxProps {
  clients: any[];
  value: string;
  onChange: (clientId: string) => void;
  onAddNew: () => void;
  compact?: boolean;
}

function ClientCombobox({ clients, value, onChange, onAddNew, compact = false }: ClientComboboxProps) {
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between font-normal",
            compact ? "h-9 text-sm w-full" : "w-full",
            !display && "text-muted-foreground",
          )}
        >
          <span className="truncate">{display || "Select client..."}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search name or ID..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              <div className="py-3 text-center text-sm">
                <p className="text-muted-foreground">No clients found</p>
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
                    {client.client_id && <span className="text-xs text-muted-foreground">ID: {client.client_id}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__add_new__"
                onSelect={() => {
                  onAddNew();
                  setOpen(false);
                }}
                className="text-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Client
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
  } = useWorkLogs();
  const { clients, loading: clientsLoading, refetch: refetchClients } = useClients();
  const { fetchAlertsForClient } = useClientAlerts();
  const { isManager, isVP } = useAuth();

  // ── Dialog / overlay state ────────────────────────────────────────────
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<string | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedLogForHistory, setSelectedLogForHistory] = useState<{ id: string; task: string } | null>(null);
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);

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
    const finalStatus = inlineData.end_time && inlineData.status === "in_progress" ? "completed" : inlineData.status;
    await quickUpdate(inlineEditId, {
      task_description: inlineData.task_description,
      start_time: inlineData.start_time,
      end_time: inlineData.end_time || undefined,
      status: finalStatus,
      notes: inlineData.notes,
      client_id: inlineData.client_id,
      department: inlineData.department,
    });
    cancelInlineEdit();
  };

  const handleEndNow = async (logId: string) => {
    await quickUpdate(logId, { end_time: getCurrentTime(), status: "completed" });
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
        <Tabs defaultValue="my-logs" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="my-logs" className="gap-2">
              <FileText className="h-4 w-4" />
              My Logs
            </TabsTrigger>
            {(isManager || isVP) && (
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
                      const isActive = log.status === "in_progress" && !log.end_time;

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
                                    setInlineData({ ...inlineData, client_id: id });
                                    if (id) handleClientSelectWithAlerts(id);
                                  }}
                                  onAddNew={() => setAddClientDialogOpen(true)}
                                  compact
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Department</Label>
                                <Select
                                  value={inlineData.department}
                                  onValueChange={(v) => setInlineData({ ...inlineData, department: v })}
                                >
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Department" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DEPARTMENTS.map((d) => (
                                      <SelectItem key={d} value={d}>
                                        {d}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Task */}
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-muted-foreground">Task Description</Label>
                              <Textarea
                                value={inlineData.task_description}
                                onChange={(e) => setInlineData({ ...inlineData, task_description: e.target.value })}
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
                                  onChange={(e) => setInlineData({ ...inlineData, start_time: e.target.value })}
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">End Time</Label>
                                <Input
                                  type="time"
                                  value={inlineData.end_time}
                                  onChange={(e) => setInlineData({ ...inlineData, end_time: e.target.value })}
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
                                onChange={(e) => setInlineData({ ...inlineData, notes: e.target.value })}
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
                              ) : log.status === "on_hold" ? (
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
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
                                    {log.department}
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
                                    ) : (
                                      <span className="text-green-600 ml-1">ongoing</span>
                                    )}
                                  </p>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                    setSelectedLogForHistory({ id: log.id, task: log.task_description });
                                    setHistoryDialogOpen(true);
                                  }}
                                  title="Edit history"
                                >
                                  <History className="h-3.5 w-3.5" />
                                </Button>
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
          {(isManager || isVP) && (
            <TabsContent value="team-live">
              <TeamRealtimeDashboard />
            </TabsContent>
          )}

          {/* ══════════ TEAM LOGS ══════════ */}
          {(isManager || isVP) && (
            <TabsContent value="team-logs">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    Team Logs — {format(selectedDate, "MMMM d, yyyy")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  ) : teamLogs.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">No team logs for this date</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Task</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">
                                    {log.employee?.first_name} {log.employee?.last_name}
                                  </p>
                                  {log.employee?.department && (
                                    <p className="text-xs text-muted-foreground">{log.employee.department}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {log.client?.name ? (
                                  <div>
                                    <Badge variant="outline" className="text-xs py-0 h-5 font-normal">
                                      {log.client.name}
                                    </Badge>
                                    {log.client.client_id && (
                                      <p className="text-[11px] text-muted-foreground mt-0.5">
                                        ID: {log.client.client_id}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell className="max-w-[200px]">
                                <p className="text-sm truncate">{log.task_description}</p>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {formatTime(log.time_spent_minutes)}
                                </Badge>
                                {log.start_time && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                                    {formatTime12h(log.start_time)}
                                    {log.end_time ? ` → ${formatTime12h(log.end_time)}` : " ongoing"}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={log.status === "in_progress" ? "default" : "outline"}
                                  className={cn(
                                    "text-xs",
                                    log.status === "in_progress" && "bg-green-500",
                                    log.status === "on_hold" && "bg-yellow-500 text-yellow-950",
                                  )}
                                >
                                  {log.status === "in_progress"
                                    ? "Active"
                                    : log.status === "on_hold"
                                      ? "On Hold"
                                      : "Done"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setSelectedLogForHistory({ id: log.id, task: log.task_description });
                                    setHistoryDialogOpen(true);
                                  }}
                                  title="Edit history"
                                >
                                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ══════════ REPORTS ══════════ */}
          {(isManager || isVP) && (
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
                <Label className="text-sm">Client (optional)</Label>
                <ClientCombobox
                  clients={clients}
                  value={formData.client_id || ""}
                  onChange={(id) => {
                    setFormData({ ...formData, client_id: id });
                    if (id) handleClientSelectWithAlerts(id);
                  }}
                  onAddNew={() => setAddClientDialogOpen(true)}
                />
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Department
                  {userDepartment && !editingLog && (
                    <span className="text-xs text-muted-foreground ml-1.5">(auto-filled from profile)</span>
                  )}
                </Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => setFormData({ ...formData, department: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
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
