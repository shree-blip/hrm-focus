import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useClients, Client } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon, Download, FileText, Loader2, Check, ChevronsUpDown, Briefcase } from "lucide-react";
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
  employee?: {
    first_name: string;
    last_name: string;
    department: string | null;
  };
}

export function ClientReportDownload() {
  const { clients, loading: clientsLoading } = useClients();
  const { toast } = useToast();

  // Client search state
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("");

  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [reportLogs, setReportLogs] = useState<ReportLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filter clients based on search query (searches both name and client_id)
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients;
    const query = clientSearchQuery.toLowerCase();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        (client.client_id && client.client_id.toLowerCase().includes(query)),
    );
  }, [clients, clientSearchQuery]);

  // Get selected client object
  const selectedClientObj = useMemo(() => {
    if (!selectedClient) return null;
    return clients.find((c) => c.id === selectedClient);
  }, [selectedClient, clients]);

  // Get selected client display text
  const selectedClientDisplay = selectedClientObj
    ? selectedClientObj.client_id
      ? `${selectedClientObj.name} (${selectedClientObj.client_id})`
      : selectedClientObj.name
    : null;

  const handleClientSelect = (clientId: string) => {
    setSelectedClient(clientId);
    setClientSearchOpen(false);
    setClientSearchQuery("");
  };

  const formatTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const fetchReport = async () => {
    if (!selectedClient) {
      toast({
        title: "Select a client",
        description: "Please select a client to generate the report",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase
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
          employee:employees(first_name, last_name, department)
        `,
        )
        .eq("client_id", selectedClient)
        .gte("log_date", format(startDate, "yyyy-MM-dd"))
        .lte("log_date", format(endDate, "yyyy-MM-dd"))
        .order("log_date", { ascending: false });

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

    const clientName = selectedClientObj?.name || "Unknown";
    const clientCode = selectedClientObj?.client_id || "";
    const headers = [
      "Date",
      "Employee",
      "Department",
      "Task",
      "Time Spent",
      "Start Time",
      "End Time",
      "Status",
      "Notes",
    ];
    const rows = reportLogs.map((log) => [
      format(new Date(log.log_date), "yyyy-MM-dd"),
      log.employee ? `${log.employee.first_name} ${log.employee.last_name}` : "N/A",
      log.employee?.department || "N/A",
      `"${log.task_description.replace(/"/g, '""')}"`,
      formatTime(log.time_spent_minutes),
      log.start_time || "",
      log.end_time || "",
      log.status || "completed",
      `"${(log.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fileName = clientCode
      ? `${clientName}_${clientCode}_work_logs_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.csv`
      : `${clientName}_work_logs_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.csv`;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Download Started",
      description: "Your report is being downloaded",
    });
  };

  const totalHours = reportLogs.reduce((sum, log) => sum + log.time_spent_minutes, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Client Report Download
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Searchable Client Selection */}
          <div className="space-y-2">
            <Label>Client *</Label>
            <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientSearchOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedClientDisplay || "Select client"}
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
            <Button onClick={fetchReport} disabled={loading || !selectedClient} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generate Report
            </Button>
          </div>
        </div>

        {/* Results */}
        {hasSearched && (
          <>
            {/* Summary */}
            {reportLogs.length > 0 && (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="text-lg font-semibold">
                      {selectedClientObj?.name}
                      {selectedClientObj?.client_id && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          ({selectedClientObj.client_id})
                        </span>
                      )}
                    </p>
                  </div>
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

            {/* Table */}
            {reportLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No logs found for this client in the selected date range</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportLogs.slice(0, 10).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{format(new Date(log.log_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          {log.employee ? `${log.employee.first_name} ${log.employee.last_name}` : "N/A"}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="truncate">{log.task_description}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{formatTime(log.time_spent_minutes)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status === "in_progress" ? "default" : "outline"}>
                            {log.status || "completed"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {reportLogs.length > 10 && (
                  <div className="p-3 text-center text-sm text-muted-foreground bg-muted/30">
                    Showing 10 of {reportLogs.length} entries. Download CSV for full report.
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
