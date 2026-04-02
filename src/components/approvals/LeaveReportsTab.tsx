import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEmployees } from "@/hooks/useEmployees";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Download,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ClipboardList,
  Search,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from "lucide-react";

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

interface EmployeeLeaveBalance {
  userId: string;
  employeeName: string;
  department: string;
  totalDays: number;
  usedDays: number;
}

export const LeaveReportsTab = ({ requests }: LeaveReportsTabProps) => {
  const now = new Date();
  const { employees } = useEmployees();
  const [filterDateFrom, setFilterDateFrom] = useState<string>(format(startOfMonth(now), "yyyy-MM-dd"));
  const [filterDateTo, setFilterDateTo] = useState<string>(format(endOfMonth(now), "yyyy-MM-dd"));
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterLeaveType, setFilterLeaveType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Right panel state
  const [balanceSearch, setBalanceSearch] = useState("");
  const [selectedBalanceEmployee, setSelectedBalanceEmployee] = useState<string | null>(null);
  const [employeeBalances, setEmployeeBalances] = useState<EmployeeLeaveBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Collapsible rejection reasons
  const [expandedRejections, setExpandedRejections] = useState<Set<string>>(new Set());

  // ─── Fetch employee leave balances (scoped to visible team via requests prop) ───
  const fetchEmployeeBalances = useCallback(async () => {
    setLoadingBalances(true);
    try {
      // Derive visible user IDs from the already role-scoped requests
      const visibleUserIds = [...new Set(requests.map((r) => r.user_id))];
      if (visibleUserIds.length === 0) {
        setEmployeeBalances([]);
        setLoadingBalances(false);
        return;
      }

      const currentYear = new Date().getFullYear();
      const { data: allBalances } = await supabase
        .from("leave_balances")
        .select("user_id, leave_type, total_days, used_days")
        .eq("year", currentYear)
        .in("user_id", visibleUserIds);

      if (!allBalances || allBalances.length === 0) {
        setEmployeeBalances([]);
        setLoadingBalances(false);
        return;
      }

      // Sum all leave types per user
      const userMap = new Map<string, { totalDays: number; usedDays: number }>();
      allBalances.forEach((b) => {
        if (!userMap.has(b.user_id)) {
          userMap.set(b.user_id, { totalDays: 0, usedDays: 0 });
        }
        const entry = userMap.get(b.user_id)!;
        entry.totalDays += Number(b.total_days);
        entry.usedDays += Number(b.used_days);
      });

      const userIdToEmp = new Map<string, { name: string; dept: string }>();
      employees.forEach((emp) => {
        if (emp.user_id) {
          userIdToEmp.set(emp.user_id, {
            name: `${emp.first_name} ${emp.last_name}`,
            dept: emp.department || "—",
          });
        }
      });

      const result: EmployeeLeaveBalance[] = [];
      userMap.forEach((val, userId) => {
        const emp = userIdToEmp.get(userId);
        if (!emp) return;
        result.push({
          userId,
          employeeName: emp.name,
          department: emp.dept,
          totalDays: val.totalDays,
          usedDays: val.usedDays,
        });
      });
      result.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
      setEmployeeBalances(result);
    } catch (err) {
      console.error("Failed to fetch employee balances:", err);
    }
    setLoadingBalances(false);
  }, [employees, requests]);

  useEffect(() => {
    if (employees.length > 0 && requests.length > 0) fetchEmployeeBalances();
  }, [employees.length, requests.length, fetchEmployeeBalances]);

  // ─── Filters ───
  const filtered = useMemo(() => {
    const rangeStart = filterDateFrom ? parseISO(filterDateFrom) : null;
    const rangeEnd = filterDateTo ? parseISO(filterDateTo) : null;

    return requests.filter((r) => {
      if (rangeStart || rangeEnd) {
        const start = parseISO(r.start_date);
        if (rangeStart && start < rangeStart) return false;
        if (rangeEnd && start > rangeEnd) return false;
      }
      if (filterEmployee !== "all" && r.user_id !== filterEmployee) return false;
      if (filterLeaveType !== "all" && r.leave_type !== filterLeaveType) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (selectedBalanceEmployee && r.user_id !== selectedBalanceEmployee) return false;
      return true;
    });
  }, [requests, filterDateFrom, filterDateTo, filterEmployee, filterLeaveType, filterStatus, selectedBalanceEmployee]);

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

  // Company-wide stats
  const companyStats = useMemo(() => {
    if (employeeBalances.length === 0) return { avgUsed: 0, mostCommon: "Annual Leave" };
    const totalUsed = employeeBalances.reduce((sum, e) => sum + e.usedDays, 0);
    const avgUsed = Math.round((totalUsed / employeeBalances.length) * 10) / 10;
    const typeCounts = new Map<string, number>();
    requests.forEach((r) => {
      if (r.status === "approved") typeCounts.set(r.leave_type, (typeCounts.get(r.leave_type) || 0) + 1);
    });
    let mostCommon = "Annual Leave";
    let maxCount = 0;
    typeCounts.forEach((count, type) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = type;
      }
    });
    return { avgUsed, mostCommon };
  }, [employeeBalances, requests]);

  // Filtered balance list
  const filteredBalances = useMemo(() => {
    if (!balanceSearch.trim()) return employeeBalances;
    const q = balanceSearch.toLowerCase();
    return employeeBalances.filter(
      (e) => e.employeeName.toLowerCase().includes(q) || e.department.toLowerCase().includes(q),
    );
  }, [employeeBalances, balanceSearch]);

  // ─── CSV export ───
  const exportCSV = () => {
    if (filtered.length === 0) return;
    const cleanText = (text: string | null): string => {
      if (!text) return "";
      return text
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
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
    const rangeLabel = filterDateFrom && filterDateTo ? `${filterDateFrom}-to-${filterDateTo}` : "all";
    a.download = `leave-reports-${rangeLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Helpers ───
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "approved":
        return {
          color: "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
          border: "border-l-green-500",
          label: "Approved",
        };
      case "pending":
        return {
          color: "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
          border: "border-l-amber-500",
          label: "Pending",
        };
      case "rejected":
        return {
          color: "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
          border: "border-l-red-500",
          label: "Rejected",
        };
      default:
        return { color: "border-gray-500 bg-gray-50 text-gray-700", border: "border-l-gray-500", label: status };
    }
  };

  const getLeaveTypeBadge = (type: string) => {
    if (type.includes("Annual")) return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
    if (type.includes("Sick")) return "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400";
    if (type.includes("Personal")) return "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400";
    if (type.includes("Wedding") || type.includes("Maternity") || type.includes("Paternity"))
      return "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400";
    return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();

  const getAvatarGradient = (name: string) => {
    const colors = [
      "from-teal-500 to-emerald-500",
      "from-blue-500 to-indigo-500",
      "from-purple-500 to-pink-500",
      "from-amber-500 to-orange-500",
      "from-cyan-500 to-blue-500",
      "from-rose-500 to-red-500",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const toggleRejection = (id: string) => {
    setExpandedRejections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Requests",
            value: stats.total,
            icon: ClipboardList,
            bg: "bg-blue-50 dark:bg-blue-950/20",
            iconBg: "bg-blue-100 dark:bg-blue-900/40",
            iconColor: "text-blue-600 dark:text-blue-400",
            borderColor: "border-l-blue-500",
          },
          {
            label: "Approved",
            value: stats.approved,
            icon: CheckCircle2,
            bg: "bg-green-50 dark:bg-green-950/20",
            iconBg: "bg-green-100 dark:bg-green-900/40",
            iconColor: "text-green-600 dark:text-green-400",
            borderColor: "border-l-green-500",
          },
          {
            label: "Pending",
            value: stats.pending,
            icon: Clock,
            bg: "bg-amber-50 dark:bg-amber-950/20",
            iconBg: "bg-amber-100 dark:bg-amber-900/40",
            iconColor: "text-amber-600 dark:text-amber-400",
            borderColor: "border-l-amber-500",
          },
          {
            label: "Rejected",
            value: stats.rejected,
            icon: XCircle,
            bg: "bg-red-50 dark:bg-red-950/20",
            iconBg: "bg-red-100 dark:bg-red-900/40",
            iconColor: "text-red-600 dark:text-red-400",
            borderColor: "border-l-red-500",
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            className={cn(
              "border-l-4 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200",
              stat.borderColor,
              stat.bg,
            )}
          >
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className={cn("text-3xl font-bold", stat.iconColor)}>{stat.value}</p>
                <p className="text-xs font-medium text-muted-foreground mt-1">{stat.label}</p>
              </div>
              <div className={cn("p-3 rounded-xl", stat.iconBg)}>
                <stat.icon className={cn("h-5 w-5", stat.iconColor)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Two-column Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* ─── Left: Leave Records ─── */}
        <div className="space-y-4">
          {/* Filter Bar */}
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => {
                      setFilterDateFrom(e.target.value);
                      if (e.target.value && filterDateTo && e.target.value > filterDateTo) {
                        setFilterDateTo(e.target.value);
                      }
                    }}
                    className="w-[150px] rounded-lg border-border/60 h-9 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => {
                      setFilterDateTo(e.target.value);
                      if (e.target.value && filterDateFrom && e.target.value < filterDateFrom) {
                        setFilterDateFrom(e.target.value);
                      }
                    }}
                    className="w-[150px] rounded-lg border-border/60 h-9 text-sm"
                  />
                </div>

                <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                  <SelectTrigger className="w-[180px] rounded-lg border-border/60 h-9 text-sm">
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
                  <SelectTrigger className="w-[170px] rounded-lg border-border/60 h-9 text-sm">
                    <SelectValue placeholder="All Leave Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Leave Types</SelectItem>
                    {uniqueLeaveTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px] rounded-lg border-border/60 h-9 text-sm">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 rounded-lg h-9 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setFilterDateFrom(format(startOfMonth(now), "yyyy-MM-dd"));
                    setFilterDateTo(format(endOfMonth(now), "yyyy-MM-dd"));
                    setFilterEmployee("all");
                    setFilterLeaveType("all");
                    setFilterStatus("all");
                    setSelectedBalanceEmployee(null);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto gap-2 rounded-lg h-9 text-sm"
                  onClick={exportCSV}
                  disabled={filtered.length === 0}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>

              {selectedBalanceEmployee && (
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1.5 pl-2.5 pr-1 py-1 rounded-full">
                    Filtered: {employeeBalances.find((e) => e.userId === selectedBalanceEmployee)?.employeeName}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-1 rounded-full hover:bg-muted"
                      onClick={() => setSelectedBalanceEmployee(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Record Cards */}
          {filtered.length === 0 ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Calendar className="h-14 w-14 mb-4 opacity-30" />
                <p className="font-medium text-base">No leave records found</p>
                <p className="text-sm mt-1">Try adjusting your filters to see more results</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-lg"
                  onClick={() => {
                    setFilterDateFrom(format(startOfMonth(now), "yyyy-MM-dd"));
                    setFilterDateTo(format(endOfMonth(now), "yyyy-MM-dd"));
                    setFilterEmployee("all");
                    setFilterLeaveType("all");
                    setFilterStatus("all");
                    setSelectedBalanceEmployee(null);
                  }}
                >
                  Reset Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((r, idx) => {
                const statusCfg = getStatusConfig(r.status || "pending");
                const employeeName = r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : "Unknown";
                const initials = r.profile ? getInitials(r.profile.first_name, r.profile.last_name) : "??";
                const isRejected = r.status === "rejected";
                const isExpanded = expandedRejections.has(r.id);

                return (
                  <Card
                    key={r.id}
                    className={cn(
                      "rounded-xl shadow-sm border-l-4 hover:shadow-md hover:scale-[1.005] transition-all duration-200",
                      statusCfg.border,
                    )}
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3.5">
                        <Avatar className="h-10 w-10 shrink-0 shadow-sm">
                          <AvatarFallback
                            className={cn(
                              "bg-gradient-to-br text-white font-semibold text-sm",
                              getAvatarGradient(employeeName),
                            )}
                          >
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground">{employeeName}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge
                                  className={cn(
                                    "text-[11px] px-2 py-0 font-medium border-0 rounded-md",
                                    getLeaveTypeBadge(r.leave_type),
                                  )}
                                >
                                  {r.leave_type}
                                  {r.is_half_day
                                    ? ` (Half - ${r.half_day_period === "first_half" ? "1st" : "2nd"})`
                                    : ""}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(r.start_date), "MMM d")} –{" "}
                                  {format(new Date(r.end_date), "MMM d, yyyy")}
                                </span>
                              </div>
                              {r.reason && (
                                <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-2">"{r.reason}"</p>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <Badge
                                variant="outline"
                                className={cn("text-[11px] px-2.5 py-0.5 font-semibold rounded-full", statusCfg.color)}
                              >
                                {statusCfg.label}
                              </Badge>
                              <span className="text-sm font-bold text-foreground">
                                {r.days} {r.days === 1 ? "day" : "days"}
                              </span>
                            </div>
                          </div>

                          {isRejected && r.rejection_reason && (
                            <div className="mt-2.5">
                              <button
                                className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:underline"
                                onClick={() => toggleRejection(r.id)}
                              >
                                <MessageSquare className="h-3 w-3" />
                                Rejection Reason
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                              {isExpanded && (
                                <div className="mt-1.5 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40">
                                  <p className="text-xs text-red-700 dark:text-red-400">{r.rejection_reason}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Right: Employee Leave Balance Panel ─── */}
        <div className="space-y-4">
          <Card className="rounded-xl shadow-sm sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                Employee Leave Balance
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={balanceSearch}
                  onChange={(e) => setBalanceSearch(e.target.value)}
                  className="pl-9 h-8 text-sm rounded-lg"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              {loadingBalances ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredBalances.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No employees found</p>
              ) : (
                <ScrollArea className="h-[400px] pr-2">
                  <div className="space-y-2">
                    {filteredBalances.map((emp) => {
                      const remaining = Math.max(0, emp.totalDays - emp.usedDays);
                      const usedPercent = emp.totalDays > 0 ? Math.min(100, (emp.usedDays / emp.totalDays) * 100) : 0;
                      const isSelected = selectedBalanceEmployee === emp.userId;

                      return (
                        <div
                          key={emp.userId}
                          className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-all duration-150 hover:shadow-sm",
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border/60 hover:border-border",
                          )}
                          onClick={() => setSelectedBalanceEmployee(isSelected ? null : emp.userId)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-medium text-foreground leading-none">{emp.employeeName}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{emp.department}</p>
                            </div>
                          </div>

                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300"
                              style={{ width: `${100 - usedPercent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                              Used: <span className="font-semibold text-foreground">{emp.usedDays}</span>
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                              Remaining: <span className="font-semibold text-foreground">{remaining}</span>
                            </span>
                            <span className="text-[11px] text-muted-foreground">Total: {emp.totalDays}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              {/* Company-wide summary */}
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border/60">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Company Overview
                </p>
                <div className="space-y-1">
                  <p className="text-xs text-foreground">
                    Average leaves taken: <span className="font-semibold">{companyStats.avgUsed} days</span>
                  </p>
                  <p className="text-xs text-foreground">
                    Most common type: <span className="font-semibold">{companyStats.mostCommon}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
