import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClients } from "@/hooks/useClients";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon, Download, Search, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ReportLog {
  id: string;
  log_date: string;
  task_description: string;
  time_spent_minutes: number;
  notes: string | null;
  department: string | null;
  employee?: {
    first_name: string;
    last_name: string;
    department: string | null;
  };
  client?: {
    name: string;
  };
}

export function ClientSummaryReport() {
  const { user, isManager, isVP } = useAuth();
  const { clients } = useClients();
  const { toast } = useToast();
  
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [logs, setLogs] = useState<ReportLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchReport = async () => {
    if (!user) return;

    setLoading(true);
    setHasSearched(true);

    try {
      let query = supabase
        .from("work_logs")
        .select(`
          id,
          log_date,
          task_description,
          time_spent_minutes,
          notes,
          department,
          employee:employees(first_name, last_name, department),
          client:clients(name)
        `)
        .gte("log_date", format(startDate, "yyyy-MM-dd"))
        .lte("log_date", format(endDate, "yyyy-MM-dd"))
        .order("log_date", { ascending: false });

      if (selectedClient !== "all") {
        query = query.eq("client_id", selectedClient);
      }

      // If not manager/VP, only show own logs
      if (!isManager && !isVP) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs((data as ReportLog[]) || []);
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

  const formatTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const summary = useMemo(() => {
    const totalMinutes = logs.reduce((sum, log) => sum + log.time_spent_minutes, 0);
    const byClient: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};

    logs.forEach(log => {
      const clientName = log.client?.name || "No Client";
      const deptName = log.department || log.employee?.department || "No Department";
      
      byClient[clientName] = (byClient[clientName] || 0) + log.time_spent_minutes;
      byDepartment[deptName] = (byDepartment[deptName] || 0) + log.time_spent_minutes;
    });

    return { totalMinutes, byClient, byDepartment };
  }, [logs]);

  const exportToCSV = () => {
    if (logs.length === 0) {
      toast({
        title: "No Data",
        description: "No logs to export",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Date",
      "Employee",
      "Client",
      "Department",
      "Task Description",
      "Time (Hours)",
      "Time (Minutes)",
      "Notes"
    ];

    const rows = logs.map(log => [
      format(new Date(log.log_date), "yyyy-MM-dd"),
      log.employee ? `${log.employee.first_name} ${log.employee.last_name}` : "N/A",
      log.client?.name || "No Client",
      log.department || log.employee?.department || "N/A",
      `"${(log.task_description || "").replace(/"/g, '""')}"`,
      (log.time_spent_minutes / 60).toFixed(2),
      log.time_spent_minutes.toString(),
      `"${(log.notes || "").replace(/"/g, '""')}"`
    ]);

    // Add summary rows
    rows.push([]);
    rows.push(["--- SUMMARY ---"]);
    rows.push(["Total Time", "", "", "", "", (summary.totalMinutes / 60).toFixed(2), summary.totalMinutes.toString()]);
    rows.push([]);
    rows.push(["--- BY CLIENT ---"]);
    Object.entries(summary.byClient).forEach(([client, mins]) => {
      rows.push([client, "", "", "", "", (mins / 60).toFixed(2), mins.toString()]);
    });
    rows.push([]);
    rows.push(["--- BY DEPARTMENT ---"]);
    Object.entries(summary.byDepartment).forEach(([dept, mins]) => {
      rows.push([dept, "", "", "", "", (mins / 60).toFixed(2), mins.toString()]);
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `client-summary-report-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.csv`;
    link.click();

    toast({
      title: "Success",
      description: "Report exported successfully",
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Client Summary Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <PopoverContent className="w-auto p-0" align="start">
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
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="invisible">Actions</Label>
              <div className="flex gap-2">
                <Button onClick={fetchReport} disabled={loading} className="flex-1">
                  <Search className="h-4 w-4 mr-2" />
                  {loading ? "Searching..." : "Search"}
                </Button>
                <Button variant="outline" onClick={exportToCSV} disabled={logs.length === 0}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {hasSearched && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Time</div>
              <div className="text-2xl font-bold">{formatTime(summary.totalMinutes)}</div>
              <div className="text-xs text-muted-foreground">{logs.length} entries</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Clients</div>
              <div className="text-2xl font-bold">{Object.keys(summary.byClient).length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Departments</div>
              <div className="text-2xl font-bold">{Object.keys(summary.byDepartment).length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Work Log Details</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No work logs found for the selected filters</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{format(new Date(log.log_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        {log.employee ? `${log.employee.first_name} ${log.employee.last_name}` : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.client?.name || "No Client"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {log.department || log.employee?.department || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate">{log.task_description}</p>
                      </TableCell>
                      <TableCell>
                        <Badge>{formatTime(log.time_spent_minutes)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
