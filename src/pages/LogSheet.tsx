import { useState, useEffect } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditHistoryDialog } from "@/components/logsheet/EditHistoryDialog";
import { AddClientDialog } from "@/components/logsheet/AddClientDialog";
import { ClientAlertPopup } from "@/components/logsheet/ClientAlertPopup";
import { TeamRealtimeDashboard } from "@/components/logsheet/TeamRealtimeDashboard";
import { ClientReportDownload } from "@/components/logsheet/ClientReportDownload";
import { useWorkLogs, WorkLogInput } from "@/hooks/useWorkLogs";
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

export default function LogSheet() {
  const { logs, teamLogs, loading, selectedDate, setSelectedDate, addLog, updateLog, deleteLog } = useWorkLogs();
  const { clients, loading: clientsLoading } = useClients();
  const { fetchAlertsForClient } = useClientAlerts();
  const { isManager, isVP } = useAuth();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<string | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedLogForHistory, setSelectedLogForHistory] = useState<{ id: string; task: string } | null>(null);
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);

  // Client alerts state
  const [clientAlerts, setClientAlerts] = useState<ClientAlert[]>([]);
  const [alertClientName, setAlertClientName] = useState<string>("");

  const [formData, setFormData] = useState<WorkLogInput>({
    task_description: "",
    time_spent_minutes: 0,
    notes: "",
    client_id: "",
    department: "",
    start_time: "",
    end_time: "",
    status: "completed",
  });

  // Calculate time spent from start and end times
  const calculateTimeSpent = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    // Handle case where end time is after midnight (next day)
    if (endMinutes < startMinutes) {
      return (24 * 60 - startMinutes) + endMinutes;
    }
    return endMinutes - startMinutes;
  };

  const calculatedTimeSpent = calculateTimeSpent(formData.start_time || "", formData.end_time || "");

  const resetForm = () => {
    setFormData({
      task_description: "",
      time_spent_minutes: 0,
      notes: "",
      client_id: "",
      department: "",
      start_time: "",
      end_time: "",
      status: "completed",
    });
    setEditingLog(null);
  };

  const handleClientChange = async (clientId: string) => {
    setFormData({ ...formData, client_id: clientId });

    if (clientId && clientId !== "add-new") {
      const alerts = await fetchAlertsForClient(clientId);
      if (alerts.length > 0) {
        const client = clients.find((c) => c.id === clientId);
        setAlertClientName(client?.name || "");
        setClientAlerts(alerts);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: WorkLogInput = {
      ...formData,
      time_spent_minutes: calculatedTimeSpent,
      client_id: formData.client_id || undefined,
      department: formData.department || undefined,
      start_time: formData.start_time || undefined,
      end_time: formData.end_time || undefined,
    };

    if (editingLog) {
      await updateLog(editingLog, payload);
    } else {
      await addLog(payload);
    }

    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleEdit = (log: any) => {
    setFormData({
      task_description: log.task_description,
      time_spent_minutes: log.time_spent_minutes,
      notes: log.notes || "",
      client_id: log.client_id || "",
      department: log.department || "",
      start_time: log.start_time || "",
      end_time: log.end_time || "",
      status: log.status || "completed",
    });
    setEditingLog(log.id);
    setIsAddDialogOpen(true);
  };

  const formatTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const totalTimeToday = logs.reduce((sum, log) => sum + log.time_spent_minutes, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Log Sheet</h1>
            <p className="text-muted-foreground">Track your daily work activities</p>
          </div>
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "PPP")}
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

            <Dialog
              open={isAddDialogOpen}
              onOpenChange={(open) => {
                setIsAddDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Log
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingLog ? "Edit Work Log" : "Add Work Log"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Client Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="client">Client</Label>
                    <Select
                      value={formData.client_id}
                      onValueChange={(value) => {
                        if (value === "add-new") {
                          setAddClientDialogOpen(true);
                        } else {
                          handleClientChange(value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select client (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No client</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="add-new" className="text-primary font-medium">
                          <span className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Add New Client
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Department Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
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

                  {/* Task Description */}
                  <div className="space-y-2">
                    <Label htmlFor="task">Task Description *</Label>
                    <Textarea
                      id="task"
                      placeholder="What did you work on?"
                      value={formData.task_description}
                      onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
                      required
                      rows={3}
                    />
                  </div>

                  {/* Time Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Calculated Time Display */}
                  {formData.start_time && formData.end_time && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">
                          Time Spent: {formatTime(calculatedTimeSpent)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Status */}
                  <div className="space-y-2">
                    <Label>Status</Label>
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

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any additional notes..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
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
                    <Button type="submit" disabled={!formData.task_description || !formData.start_time || !formData.end_time}>
                      {editingLog ? "Update" : "Add"} Log
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Card */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Time Logged Today</p>
                <p className="text-3xl font-bold text-foreground">{formatTime(totalTimeToday)}</p>
              </div>
              <Badge variant="outline" className="ml-auto">
                {logs.length} {logs.length === 1 ? "entry" : "entries"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Main Tabs */}
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

          {/* My Logs Tab */}
          <TabsContent value="my-logs">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">My Work Logs - {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No work logs for this date</p>
                    <p className="text-sm">Click "Add Log" to start tracking</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Task Description</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {log.client?.name ? (
                              <Badge variant="outline" className="gap-1">
                                <Briefcase className="h-3 w-3" />
                                {log.client.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-xs">
                            <p className="truncate">{log.task_description}</p>
                            {log.department && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Building2 className="h-3 w-3" />
                                {log.department}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{formatTime(log.time_spent_minutes)}</Badge>
                            {log.start_time && log.end_time && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {log.start_time} - {log.end_time}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={log.status === "in_progress" ? "default" : "outline"}
                              className={cn(
                                log.status === "in_progress" && "bg-green-500",
                                log.status === "on_hold" && "bg-yellow-500"
                              )}
                            >
                              {log.status === "in_progress"
                                ? "In Progress"
                                : log.status === "on_hold"
                                ? "On Hold"
                                : "Completed"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedLogForHistory({ id: log.id, task: log.task_description });
                                  setHistoryDialogOpen(true);
                                }}
                                title="View edit history"
                              >
                                <History className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(log)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteLog(log.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Live Dashboard */}
          {(isManager || isVP) && (
            <TabsContent value="team-live">
              <TeamRealtimeDashboard />
            </TabsContent>
          )}

          {/* Team Logs Tab */}
          {(isManager || isVP) && (
            <TabsContent value="team-logs">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Team Work Logs - {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : teamLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No team logs for this date</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Task Description</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[60px]">History</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">
                              {log.employee?.first_name} {log.employee?.last_name}
                              {log.employee?.department && (
                                <p className="text-xs text-muted-foreground">{log.employee.department}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              {log.client?.name ? (
                                <Badge variant="outline">{log.client.name}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <p className="truncate">{log.task_description}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{formatTime(log.time_spent_minutes)}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={log.status === "in_progress" ? "default" : "outline"}
                                className={cn(log.status === "in_progress" && "bg-green-500")}
                              >
                                {log.status === "in_progress" ? "Active" : log.status || "Completed"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedLogForHistory({ id: log.id, task: log.task_description });
                                  setHistoryDialogOpen(true);
                                }}
                                title="View edit history"
                              >
                                <History className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Reports Tab */}
          {(isManager || isVP) && (
            <TabsContent value="reports">
              <ClientReportDownload />
            </TabsContent>
          )}
        </Tabs>

        {/* Edit History Dialog */}
        {selectedLogForHistory && (
          <EditHistoryDialog
            open={historyDialogOpen}
            onOpenChange={setHistoryDialogOpen}
            workLogId={selectedLogForHistory.id}
            taskDescription={selectedLogForHistory.task}
          />
        )}

        {/* Add Client Dialog */}
        <AddClientDialog
          open={addClientDialogOpen}
          onOpenChange={setAddClientDialogOpen}
          onClientAdded={(clientId) => {
            setFormData({ ...formData, client_id: clientId });
          }}
        />

        {/* Client Alerts Popup */}
        <ClientAlertPopup
          alerts={clientAlerts}
          clientName={alertClientName}
          onDismiss={() => setClientAlerts([])}
        />
      </div>
    </DashboardLayout>
  );
}
