import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search, X, History, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkLog {
  id: string;
  task_description: string;
  time_spent_minutes: number;
  status: string | null;
  start_time: string | null;
  end_time: string | null;
  department: string | null;
  employee?: {
    first_name: string;
    last_name: string;
    department: string | null;
  } | null;
  client?: {
    name: string;
    client_id: string | null;
  } | null;
}

interface TeamLogsFiltersProps {
  teamLogs: WorkLog[];
  clients: { id: string; name: string; client_id: string | null }[];
  loading: boolean;
  getDepartmentDisplayLabel: (value: string) => string | null;
  formatTime: (minutes: number) => string;
  formatTime12h: (time: string) => string;
  onViewHistory: (log: WorkLog) => void;
}

export function TeamLogsFilters({
  teamLogs,
  clients,
  loading,
  getDepartmentDisplayLabel,
  formatTime,
  formatTime12h,
  onViewHistory,
}: TeamLogsFiltersProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Derive unique employees from logs
  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, string>();
    teamLogs.forEach((log) => {
      if (log.employee) {
        const name = `${log.employee.first_name} ${log.employee.last_name}`;
        map.set(name, name);
      }
    });
    return Array.from(map.keys()).sort();
  }, [teamLogs]);

  // Derive unique departments from logs
  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    teamLogs.forEach((log) => {
      if (log.department) set.add(log.department);
      if (log.employee?.department) set.add(log.employee.department);
    });
    return Array.from(set).sort();
  }, [teamLogs]);

  // Derive unique clients from logs
  const uniqueClients = useMemo(() => {
    const map = new Map<string, string>();
    teamLogs.forEach((log) => {
      if (log.client?.name) {
        map.set(log.client.name, log.client.name);
      }
    });
    return Array.from(map.keys()).sort();
  }, [teamLogs]);

  const hasActiveFilters = searchQuery || filterEmployee !== "all" || filterClient !== "all" || filterDepartment !== "all" || filterStatus !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setFilterEmployee("all");
    setFilterClient("all");
    setFilterDepartment("all");
    setFilterStatus("all");
  };

  const filteredLogs = useMemo(() => {
    return teamLogs.filter((log) => {
      // Search query - matches task, employee name, client name
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const employeeName = `${log.employee?.first_name || ""} ${log.employee?.last_name || ""}`.toLowerCase();
        const clientName = (log.client?.name || "").toLowerCase();
        const task = (log.task_description || "").toLowerCase();
        if (!employeeName.includes(q) && !clientName.includes(q) && !task.includes(q)) {
          return false;
        }
      }

      // Employee filter
      if (filterEmployee !== "all") {
        const name = `${log.employee?.first_name} ${log.employee?.last_name}`;
        if (name !== filterEmployee) return false;
      }

      // Client filter
      if (filterClient !== "all") {
        if ((log.client?.name || "") !== filterClient) return false;
      }

      // Department filter
      if (filterDepartment !== "all") {
        const dept = log.department || log.employee?.department || "";
        if (dept !== filterDepartment) return false;
      }

      // Status filter
      if (filterStatus !== "all") {
        if ((log.status || "completed") !== filterStatus) return false;
      }

      return true;
    });
  }, [teamLogs, searchQuery, filterEmployee, filterClient, filterDepartment, filterStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (teamLogs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">No team logs for this date</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search task, employee, client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>

        {/* Employee Filter */}
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="h-9 w-[160px] text-sm">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {uniqueEmployees.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Client Filter */}
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="h-9 w-[150px] text-sm">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {uniqueClients.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Department Filter */}
        <Select value={filterDepartment} onValueChange={setFilterDepartment}>
          <SelectTrigger className="h-9 w-[160px] text-sm">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {uniqueDepartments.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {getDepartmentDisplayLabel(dept) || dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-[120px] text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in_progress">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Done</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      {hasActiveFilters && (
        <p className="text-xs text-muted-foreground">
          Showing {filteredLogs.length} of {teamLogs.length} logs
        </p>
      )}

      {/* Table */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No logs match your filters</p>
          <Button variant="link" size="sm" onClick={clearFilters}>Clear filters</Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Task Department</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">
                        {log.employee?.first_name} {log.employee?.last_name}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.employee?.department ? (
                      <span className="text-sm">{log.employee.department}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
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
                  <TableCell>
                    {log.department ? (
                      <Badge variant="secondary" className="font-normal text-xs py-0 h-5">
                        {getDepartmentDisplayLabel(log.department) || log.department}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[250px]">
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
                      onClick={() => onViewHistory(log)}
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
    </div>
  );
}
