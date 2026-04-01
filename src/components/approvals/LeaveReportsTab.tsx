import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Download, FileText, Calendar, Clock, CheckCircle2, XCircle, MessageSquare } from "lucide-react";

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string | null;
  reason: string | null;
  rejection_reason: string | null;
  is_half_day?: boolean;
  half_day_period?: string | null;
  profile?: { first_name: string; last_name: string; email?: string } | null;
}

interface LeaveReportsTabProps {
  requests: LeaveRequest[];
}

const MONTHS = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

const getStatusBadge = (status: string) => {
  const config: Record<string, { color: string; label: string }> = {
    pending: { color: "border-warning text-warning bg-warning/10", label: "Pending" },
    approved: { color: "border-success text-success bg-success/10", label: "Approved" },
    rejected: { color: "border-destructive text-destructive bg-destructive/10", label: "Rejected" },
  };
  const c = config[status] || config.pending;
  return (
    <Badge variant="outline" className={c.color}>
      {c.label}
    </Badge>
  );
};

export const LeaveReportsTab = ({ requests }: LeaveReportsTabProps) => {
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState<string>(String(now.getMonth()));
  const [filterYear] = useState<number>(now.getFullYear());
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterLeaveType, setFilterLeaveType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Filter by month
  const filtered = useMemo(() => {
    const month = parseInt(filterMonth);
    const monthStart = startOfMonth(new Date(filterYear, month));
    const monthEnd = endOfMonth(new Date(filterYear, month));

    return requests.filter((r) => {
      const start = parseISO(r.start_date);
      if (start < monthStart || start > monthEnd) return false;
      if (filterEmployee !== "all" && r.user_id !== filterEmployee) return false;
      if (filterLeaveType !== "all" && r.leave_type !== filterLeaveType) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      return true;
    });
  }, [requests, filterMonth, filterYear, filterEmployee, filterLeaveType, filterStatus]);

  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach((r) => {
      if (r.profile) map.set(r.user_id, `${r.profile.first_name} ${r.profile.last_name}`);
    });
    return Array.from(map.entries());
  }, [requests]);

  const uniqueLeaveTypes = useMemo(() => [...new Set(requests.map((r) => r.leave_type))], [requests]);

  const stats = useMemo(
    () => ({
      total: filtered.length,
      approved: filtered.filter((r) => r.status === "approved").length,
      pending: filtered.filter((r) => r.status === "pending").length,
      rejected: filtered.filter((r) => r.status === "rejected").length,
    }),
    [filtered],
  );

  const exportCSV = () => {
    if (filtered.length === 0) return;

    const cleanText = (text: string | null): string => {
      if (!text) return "";
      return text
        .replace(/[\r\n]+/g, " ") // remove line breaks
        .replace(/\s+/g, " ") // collapse multiple spaces
        .trim();
    };

    const header = [
      "Employee",
      "Leave Type",
      "Start Date",
      "End Date",
      "Days",
      "Half Day",
      "Status",
      "Reason",
      "Rejection Reason",
    ];
    const rows = filtered.map((r) => [
      r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : "Unknown",
      r.leave_type,
      r.start_date,
      r.end_date,
      r.days,
      r.is_half_day ? `Yes (${r.half_day_period || ""})` : "No",
      r.status || "",
      cleanText(r.reason),
      cleanText(r.rejection_reason),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave-reports-${MONTHS[parseInt(filterMonth)].label}-${filterYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-3xl font-display font-bold">{stats.total}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <p className="text-3xl font-display font-bold text-success">{stats.approved}</p>
              </div>
              <div className="p-3 rounded-full bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-3xl font-display font-bold text-warning">{stats.pending}</p>
              </div>
              <div className="p-3 rounded-full bg-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                <p className="text-3xl font-display font-bold text-destructive">{stats.rejected}</p>
              </div>
              <div className="p-3 rounded-full bg-destructive/10">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Leave Records
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-2" onClick={exportCSV}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 pb-4 border-b border-border">
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {uniqueEmployees.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterLeaveType} onValueChange={setFilterLeaveType}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leave Types</SelectItem>
                {uniqueLeaveTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No leave records found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => {
                const name = r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : "Unknown";
                const initials = r.profile ? `${r.profile.first_name[0]}${r.profile.last_name[0]}` : "??";
                return (
                  <div
                    key={r.id}
                    className="flex items-start gap-4 p-4 rounded-xl bg-accent/30 border border-border hover:border-primary/20 transition-all"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium">{name}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {r.leave_type}
                            {r.is_half_day
                              ? ` (Half Day - ${r.half_day_period === "first_half" ? "1st Half" : "2nd Half"})`
                              : ""}{" "}
                            • {format(new Date(r.start_date), "MMM d, yyyy")} -{" "}
                            {format(new Date(r.end_date), "MMM d, yyyy")}
                          </p>
                          {r.reason && <p className="text-sm text-muted-foreground mt-1 italic">"{r.reason}"</p>}
                          {r.rejection_reason && (
                            <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                              <MessageSquare className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                              <p className="text-sm text-destructive">
                                <span className="font-medium">Reason:</span> {r.rejection_reason}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(r.status || "pending")}
                          <span className="text-sm font-medium">
                            {r.days} {r.days === 1 ? "day" : "days"}
                          </span>
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
    </div>
  );
};
