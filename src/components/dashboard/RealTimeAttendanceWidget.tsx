import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
// Add Download to your lucide-react import
import { cn } from "@/lib/utils";
import {
  format,
  formatDistanceToNow,
} from "date-fns";
import {
  Users,
  Briefcase,
  Coffee,
  Pause,
  LogOut,
  RefreshCw,
  Clock,
  Activity,
  Circle,
  X,
  Download,
  Loader2,
} from "lucide-react";

// Types
type Status = "IN" | "OUT" | "BRS" | "BRE" | "PAUSE" | "CONT" | "—";
type FilterType = "all" | "working" | "break" | "paused" | "out" | "wfo" | "wfh";

interface Employee {
  id: string;
  name: string;
  department: string | null;
  status: Status;
  lastAction: string | null;
  avatar: string | null;
  workMode: "wfo" | "wfh" | null;
}

interface Event {
  id: string;
  name: string;
  type: Status;
  time: string;
}

// Status config
const STATUS: Record<Status, { color: string; bg: string; icon: React.ElementType }> = {
  IN: {
    color: "text-emerald-600",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    icon: Briefcase,
  },
  OUT: {
    color: "text-slate-500",
    bg: "bg-slate-100 dark:bg-slate-800",
    icon: LogOut,
  },
  BRS: {
    color: "text-amber-600",
    bg: "bg-amber-100 dark:bg-amber-900/40",
    icon: Coffee,
  },
  BRE: {
    color: "text-teal-600",
    bg: "bg-teal-100 dark:bg-teal-900/40",
    icon: Briefcase,
  },
  PAUSE: {
    color: "text-blue-600",
    bg: "bg-blue-100 dark:bg-blue-900/40",
    icon: Pause,
  },
  CONT: {
    color: "text-cyan-600",
    bg: "bg-cyan-100 dark:bg-cyan-900/40",
    icon: Briefcase,
  },
  "—": {
    color: "text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-800",
    icon: Circle,
  },
};

// Event labels
const EVENT_LABELS: Record<Status, string> = {
  IN: "Clocked In",
  OUT: "Clocked Out",
  BRS: "On Break",
  BRE: "Resumed",
  PAUSE: "Paused",
  CONT: "Continued",
  "—": "Not Started",
};

// Filter labels
const FILTER_LABELS: Record<FilterType, string> = {
  all: "All Employees",
  working: "Currently Working",
  break: "On Break",
  paused: "Paused",
  out: "Clocked Out",
  wfo: "Work From Office",
  wfh: "Work From Home",
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

export function RealTimeAttendanceWidget() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    working: 0,
    break: 0,
    paused: 0,
    out: 0,
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType | null>(null);
  const [nptTime, setNptTime] = useState("");
  const [pstTime, setPstTime] = useState("");
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false); // Add this new state

  // Live clock for NPT and PST
  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setNptTime(
        now.toLocaleTimeString("en-US", {
          timeZone: "Asia/Kathmandu",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      );
      setPstTime(
        now.toLocaleTimeString("en-US", {
          timeZone: "America/Los_Angeles",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      );
    };
    updateClocks();
    const clockInterval = setInterval(updateClocks, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Map from user_id to employee id for realtime matching
  const [userToEmpMap, setUserToEmpMap] = useState<Map<string, string>>(new Map());

  const fetchData = useCallback(async () => {
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)).toISOString();
    const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

    // Fetch employees - include active and probation status
    const { data: emps } = await supabase
      .from("employees")
      .select("id, first_name, last_name, department, profile_id, profiles:profile_id(user_id, avatar_url)")
      .in("status", ["active", "probation"]);

    // Fetch today's logs (UTC-based)
    const { data: todayLogs } = await supabase
      .from("attendance_logs")
      .select("*")
      .gte("clock_in", dayStart)
      .lte("clock_in", dayEnd)
      .order("clock_in", { ascending: false });

    // Also fetch any still-clocked-in logs from previous days (survive midnight)
    const { data: activeLogs } = await supabase
      .from("attendance_logs")
      .select("*")
      .lt("clock_in", dayStart)
      .is("clock_out", null)
      .order("clock_in", { ascending: false });

    // Merge and deduplicate by id
    const allLogsMap = new Map<string, any>();
    [...(todayLogs || []), ...(activeLogs || [])].forEach((log) => {
      if (!allLogsMap.has(log.id)) allLogsMap.set(log.id, log);
    });
    const logs = Array.from(allLogsMap.values());

    // Build user_id → employee_id map
    const uToE = new Map<string, string>();
    (emps || []).forEach((e: any) => {
      const userId = e.profiles?.user_id;
      if (userId) uToE.set(userId, e.id);
    });
    setUserToEmpMap(uToE);

    // Map logs by employee/user
    const logMap = new Map<string, any>();
    const userLogMap = new Map<string, any>();
    logs?.forEach((log) => {
      if (log.employee_id && !logMap.has(log.employee_id)) logMap.set(log.employee_id, log);
      if (log.user_id && !userLogMap.has(log.user_id)) userLogMap.set(log.user_id, log);
    });

    // Build employee states
    const empList: Employee[] = (emps || []).map((e: any) => {
      const userId = e.profiles?.user_id;
      const log = logMap.get(e.id) || userLogMap.get(userId);

      let status: Status = "—";
      if (log) {
        if (log.clock_out) status = "OUT";
        else if (log.pause_start && !log.pause_end) status = "PAUSE";
        else if (log.break_start && !log.break_end) status = "BRS";
        else status = "IN";
      }

      const times = log
        ? [log.clock_out, log.pause_end, log.pause_start, log.break_end, log.break_start, log.clock_in].filter(Boolean)
        : [];
      const lastAction = times.length > 0 ? times.reduce((a, b) => (new Date(b) > new Date(a) ? b : a)) : null;

      return {
        id: e.id,
        name: `${e.first_name} ${e.last_name}`.trim(),
        department: e.department,
        status,
        lastAction,
        avatar: e.profiles?.avatar_url || null,
        workMode: log?.work_mode || null,
      };
    });

    empList.sort((a, b) => {
      if (!a.lastAction && !b.lastAction) return 0;
      if (!a.lastAction) return 1;
      if (!b.lastAction) return -1;
      return new Date(b.lastAction).getTime() - new Date(a.lastAction).getTime();
    });

    setEmployees(empList);

    // Calculate summary
    const working = empList.filter((e) => ["IN", "BRE", "CONT"].includes(e.status)).length;
    const onBreak = empList.filter((e) => e.status === "BRS").length;
    const paused = empList.filter((e) => e.status === "PAUSE").length;
    const out = empList.filter((e) => e.status === "OUT").length;

    setSummary({ total: empList.length, working, break: onBreak, paused, out });

    // Build events - create maps for both employee_id and user_id lookup
    const empMap = new Map((emps || []).map((e: any) => [e.id, e]));
    const userEmpMap = new Map((emps || []).map((e: any) => [e.profiles?.user_id, e]));
    
    // Also create a reverse lookup: user_id -> employee for logs that only have user_id
    const evts: Event[] = [];

    logs?.forEach((log) => {
      // Try to find employee by employee_id first, then by user_id
      let emp = empMap.get(log.employee_id);
      if (!emp && log.user_id) {
        emp = userEmpMap.get(log.user_id);
      }
      // If still not found, try to find by matching user_id in the uToE map
      if (!emp && log.user_id && uToE.has(log.user_id)) {
        emp = empMap.get(uToE.get(log.user_id));
      }
      const name = emp ? `${emp.first_name} ${emp.last_name}`.trim() : "Unknown";

      if (log.clock_in) evts.push({ id: `${log.id}-in`, name, type: "IN", time: log.clock_in });
      if (log.break_start)
        evts.push({
          id: `${log.id}-brs`,
          name,
          type: "BRS",
          time: log.break_start,
        });
      if (log.break_end)
        evts.push({
          id: `${log.id}-bre`,
          name,
          type: "BRE",
          time: log.break_end,
        });
      if (log.pause_start)
        evts.push({
          id: `${log.id}-pause`,
          name,
          type: "PAUSE",
          time: log.pause_start,
        });
      if (log.pause_end)
        evts.push({
          id: `${log.id}-cont`,
          name,
          type: "CONT",
          time: log.pause_end,
        });
      if (log.clock_out)
        evts.push({
          id: `${log.id}-out`,
          name,
          type: "OUT",
          time: log.clock_out,
        });
    });

    evts.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setEvents(evts.slice(0, 20));
    setDailyLogs(logs || []); // Add this line to store the raw logs
    setLoading(false);
  }, []);

  // Process realtime payload locally for instant updates
  const handleRealtimeChange = useCallback(
    (payload: any) => {
      const log = payload.new || payload.old;
      if (!log) {
        fetchData();
        return;
      }

      // Resolve the employee_id from the log — either directly or via user_id map
      const resolvedEmpId = log.employee_id || userToEmpMap.get(log.user_id);

      if (!resolvedEmpId) {
        // Can't match to an employee, do a full refetch
        fetchData();
        return;
      }
      // Add this block to update the detailed logs array
      setDailyLogs((prevLogs) => {
        const exists = prevLogs.find((l) => l.id === log.id);
        if (exists) {
          return prevLogs.map((l) => (l.id === log.id ? log : l));
        }
        return [log, ...prevLogs];
      });

      setEmployees((prev) => {
        const updated = prev.map((emp) => {
          if (emp.id !== resolvedEmpId) return emp;

          let status: Status = "—";
          if (log.clock_out) status = "OUT";
          else if (log.pause_start && !log.pause_end) status = "PAUSE";
          else if (log.break_start && !log.break_end) status = "BRS";
          else if (log.clock_in) status = "IN";

          const times = [
            log.clock_out,
            log.pause_end,
            log.pause_start,
            log.break_end,
            log.break_start,
            log.clock_in,
          ].filter(Boolean);
          const lastAction =
            times.length > 0
              ? times.reduce((a: string, b: string) => (new Date(b) > new Date(a) ? b : a))
              : emp.lastAction;

          return { ...emp, status, lastAction };
        });

        updated.sort((a, b) => {
          if (!a.lastAction && !b.lastAction) return 0;
          if (!a.lastAction) return 1;
          if (!b.lastAction) return -1;
          return new Date(b.lastAction).getTime() - new Date(a.lastAction).getTime();
        });

        // Update summary
        const working = updated.filter((e) => ["IN", "BRE", "CONT"].includes(e.status)).length;
        const onBreak = updated.filter((e) => e.status === "BRS").length;
        const paused = updated.filter((e) => e.status === "PAUSE").length;
        const out = updated.filter((e) => e.status === "OUT").length;
        setSummary({
          total: updated.length,
          working,
          break: onBreak,
          paused,
          out,
        });

        // Update events
        const evtName = updated.find((e) => e.id === resolvedEmpId)?.name || "Unknown";
        setEvents((prevEvts) => {
          const newEvts = [...prevEvts];
          const addEvt = (type: Status, time: string) => {
            const id = `${log.id}-${type.toLowerCase()}`;
            if (!newEvts.find((e) => e.id === id)) {
              newEvts.unshift({ id, name: evtName, type, time });
            }
          };
          if (log.clock_in) addEvt("IN", log.clock_in);
          if (log.break_start) addEvt("BRS", log.break_start);
          if (log.break_end) addEvt("BRE", log.break_end);
          if (log.pause_start) addEvt("PAUSE", log.pause_start);
          if (log.pause_end) addEvt("CONT", log.pause_end);
          if (log.clock_out) addEvt("OUT", log.clock_out);
          newEvts.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
          return newEvts.slice(0, 20);
        });

        return updated;
      });
    },
    [fetchData, userToEmpMap],
  );

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("live-attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, handleRealtimeChange)
      .subscribe();
    const interval = setInterval(fetchData, 60000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchData, handleRealtimeChange]);

  // Filter employees based on active filter
  const filteredEmployees = employees.filter((emp) => {
    if (!activeFilter || activeFilter === "all") return true;
    if (activeFilter === "working") return ["IN", "BRE", "CONT"].includes(emp.status);
    if (activeFilter === "break") return emp.status === "BRS";
    if (activeFilter === "paused") return emp.status === "PAUSE";
    if (activeFilter === "out") return emp.status === "OUT";
    if (activeFilter === "wfo")
      return ["IN", "BRE", "CONT", "PAUSE", "BRS"].includes(emp.status) && emp.workMode !== "wfh";
    if (activeFilter === "wfh")
      return ["IN", "BRE", "CONT", "PAUSE", "BRS"].includes(emp.status) && emp.workMode === "wfh";
    return true;
  });

  // Handle card click
  const handleFilterClick = (filter: FilterType) => {
    setActiveFilter(activeFilter === filter ? null : filter);
  };

  const exportHistoricalCSV = async (timeframe: "today" | "week" | "month") => {
    setIsExporting(true);
    try {
      const now = new Date();
      let start: Date, end: Date;

      // Determine date range in UTC
      const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
      if (timeframe === "today") {
        start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
        end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
      } else if (timeframe === "week") {
        const utcDay = now.getUTCDay();
        const diff = utcDay === 0 ? -6 : 1 - utcDay;
        start = new Date(Date.UTC(y, m, d + diff, 0, 0, 0, 0));
        end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
      } else {
        start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
        end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
      }

      const { data: historicalLogs, error } = await supabase
        .from("attendance_logs")
        .select("*")
        .gte("clock_in", start!.toISOString())
        .lte("clock_in", end!.toISOString())
        .order("clock_in", { ascending: false })
        .limit(10000);

      if (error) throw error;

      if (!historicalLogs || historicalLogs.length === 0) {
        alert(`No data found for this ${timeframe}.`);
        return;
      }

      // 1. Updated Headers to include Durations and Net Hours
      const headers = [
        "Date",
        "Employee Name",
        "Department",
        "Work Mode",
        "Clock In",
        "Clock Out",
        "Break Start",
        "Break End",
        "Break Dur",
        "Pause Start",
        "Pause End",
        "Pause Dur",
        "Net Hours",
      ];

      // Helper 1: Format time exactly like your second screenshot (e.g. 09:34 AM)
      const formatTimeOnly = (isoString?: string | null) => (isoString ? format(new Date(isoString), "hh:mm a") : "-");

      // Helper 2: Calculate duration in minutes between two timestamps
      const calculateDurationMinutes = (startTime?: string | null, endTime?: string | null) => {
        if (!startTime || !endTime) return 0;
        return Math.max(0, (new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60));
      };

      // Helper 3: Format minutes into "1h 15m" or just "16m"
      const formatDurationText = (minutes: number): string => {
        if (minutes <= 0) return "-";
        if (minutes < 60) return `${Math.round(minutes)}m`;
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      };

      // 2. Map raw logs to CSV format with the new logic
      const csvRows = historicalLogs.map((log) => {
        const empId = log.employee_id || userToEmpMap.get(log.user_id);
        const emp = employees.find((e) => e.id === empId);

        const dateObj = new Date(log.clock_in);
        const logDate = format(dateObj, "yyyy-MM-dd");
        const name = emp ? emp.name : "Unknown";
        const dept = emp ? emp.department : "No Dept";
        const mode = log.work_mode ? log.work_mode.toUpperCase() : "N/A";

        // Calculate Break and Pause minutes (fallback to calculating if not saved in DB)
        const breakMinutes = log.total_break_minutes || calculateDurationMinutes(log.break_start, log.break_end);
        const pauseMinutes = log.total_pause_minutes || calculateDurationMinutes(log.pause_start, log.pause_end);

        // Calculate Net Hours Worked
        const clockOutDate = log.clock_out ? new Date(log.clock_out) : null;
        let netHours = "-";

        // If they haven't clocked out, it uses current time to show "Live" hours worked
        const endTime = clockOutDate || new Date();
        const diffMs = endTime.getTime() - dateObj.getTime();
        const netWorkMs = diffMs - (breakMinutes + pauseMinutes) * 60 * 1000;

        // Format as decimal hours (e.g. 5.90h)
        netHours = `${(Math.max(0, netWorkMs) / (1000 * 60 * 60)).toFixed(2)}h`;

        return [
          `"${logDate}"`,
          `"${name}"`,
          `"${dept}"`,
          `"${mode}"`,
          `"${formatTimeOnly(log.clock_in)}"`,
          `"${formatTimeOnly(log.clock_out)}"`,
          `"${formatTimeOnly(log.break_start)}"`,
          `"${formatTimeOnly(log.break_end)}"`,
          `"${formatDurationText(breakMinutes)}"`,
          `"${formatTimeOnly(log.pause_start)}"`,
          `"${formatTimeOnly(log.pause_end)}"`,
          `"${formatDurationText(pauseMinutes)}"`,
          `"${netHours}"`,
        ].join(",");
      });

      // 3. Combine headers and data
      const csvString = ["\uFEFF" + headers.join(","), ...csvRows].join("\n");

      // 4. Trigger download
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const fileName = `attendance_${timeframe}_${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.setAttribute("download", fileName);

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export data:", err);
      alert("Something went wrong while exporting data.");
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Live Attendance
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 ml-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Live</span>
            </div>
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Native Dropdown visually styled like a Shadcn element */}
            <div className="relative hidden sm:block">
              <select
                disabled={isExporting}
                onChange={(e) => {
                  if (e.target.value) {
                    exportHistoricalCSV(e.target.value as "today" | "week" | "month");
                    e.target.value = ""; // Reset dropdown after selection
                  }
                }}
                className="appearance-none bg-transparent border rounded-md h-8 pl-8 pr-8 text-xs font-medium cursor-pointer hover:bg-muted/50 disabled:opacity-50"
              >
                <option value="" disabled selected>
                  Export CSV
                </option>
                <option value="today">Today's Data</option>
                <option value="week">This Week's Data</option>
                <option value="month">This Month's Data</option>
              </select>

              {/* Icon positioning inside the select */}
              <div className="absolute left-2.5 top-2 pointer-events-none">
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={fetchData} className="h-8 w-8" title="Refresh data">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Clickable Summary Stats */}
        <div className="grid grid-cols-5 gap-2">
          {[
            {
              key: "all" as FilterType,
              label: "Total",
              value: summary.total,
              icon: Users,
              color: "text-slate-600",
              bg: "bg-slate-100 dark:bg-slate-800",
              activeBg: "bg-slate-200 dark:bg-slate-700 ring-2 ring-slate-400",
            },
            {
              key: "working" as FilterType,
              label: "Working",
              value: summary.working,
              icon: Briefcase,
              color: "text-emerald-600",
              bg: "bg-emerald-100 dark:bg-emerald-900/40",
              activeBg: "bg-emerald-200 dark:bg-emerald-800 ring-2 ring-emerald-500",
              pulse: true,
            },
            {
              key: "break" as FilterType,
              label: "Break",
              value: summary.break,
              icon: Coffee,
              color: "text-amber-600",
              bg: "bg-amber-100 dark:bg-amber-900/40",
              activeBg: "bg-amber-200 dark:bg-amber-800 ring-2 ring-amber-500",
            },
            {
              key: "paused" as FilterType,
              label: "Paused",
              value: summary.paused,
              icon: Pause,
              color: "text-blue-600",
              bg: "bg-blue-100 dark:bg-blue-900/40",
              activeBg: "bg-blue-200 dark:bg-blue-800 ring-2 ring-blue-500",
            },
            {
              key: "out" as FilterType,
              label: "Out",
              value: summary.out,
              icon: LogOut,
              color: "text-slate-500",
              bg: "bg-slate-100 dark:bg-slate-800",
              activeBg: "bg-slate-200 dark:bg-slate-700 ring-2 ring-slate-400",
            },
          ].map(({ key, label, value, icon: Icon, color, bg, activeBg, pulse }) => (
            <button
              key={key}
              onClick={() => handleFilterClick(key)}
              className={cn(
                "rounded-lg p-2 text-center transition-all cursor-pointer hover:scale-105",
                activeFilter === key ? activeBg : bg,
              )}
            >
              <Icon className={cn("h-4 w-4 mx-auto mb-1", color, pulse && !activeFilter && "animate-pulse")} />
              <p className={cn("text-lg font-bold", color)}>{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </button>
          ))}
        </div>

        {/* Filtered Employee List */}
        {activeFilter && (
          <div className="border rounded-lg">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
              <span className="text-sm font-medium">{FILTER_LABELS[activeFilter]}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setActiveFilter(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="h-[180px]">
              {filteredEmployees.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">No employees</div>
              ) : (
                <div className="divide-y">
                  {filteredEmployees.map((emp) => {
                    const cfg = STATUS[emp.status];
                    const Icon = cfg.icon;
                    return (
                      <div key={emp.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={emp.avatar || undefined} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(emp.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{emp.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {emp.department || "No Dept"} •{" "}
                            {emp.lastAction
                              ? formatDistanceToNow(new Date(emp.lastAction), {
                                  addSuffix: true,
                                })
                              : "—"}
                          </p>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] gap-1", cfg.bg, cfg.color)}>
                          <Icon className="h-3 w-3" />
                          {emp.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
        {/* WFO / WFH Quick Filters */}
        <div className="flex gap-2">
          <Button
            variant={activeFilter === "wfo" ? "default" : "outline"}
            size="sm"
            className="flex-1 gap-2"
            onClick={() => handleFilterClick("wfo")}
          >
            <Briefcase className="h-4 w-4" />
            WFO ({employees.filter((e) => ["IN", "BRE", "CONT"].includes(e.status) && e.workMode !== "wfh").length})
          </Button>
          <Button
            variant={activeFilter === "wfh" ? "default" : "outline"}
            size="sm"
            className="flex-1 gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
            onClick={() => handleFilterClick("wfh")}
          >
            <Users className="h-4 w-4" />
            WFH (
            {
              employees.filter((e) => ["IN", "BRE", "CONT", "PAUSE", "BRS"].includes(e.status) && e.workMode === "wfh")
                .length
            }
            )
          </Button>
        </div>
        {/* Activity Feed - Show when no filter active */}
        {!activeFilter && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Recent Activity</span>
            </div>
            <ScrollArea className="h-[180px]">
              <div className="space-y-1">
                {events.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No activity today</p>
                  </div>
                ) : (
                  events.map((evt) => {
                    const cfg = STATUS[evt.type];
                    const Icon = cfg.icon;
                    return (
                      <div key={evt.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50">
                        <div className={cn("p-1.5 rounded", cfg.bg)}>
                          <Icon className={cn("h-3 w-3", cfg.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{evt.name}</span>
                            <span className="text-xs text-muted-foreground">{EVENT_LABELS[evt.type]}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(evt.time), "hh:mm a")} •{" "}
                            {formatDistanceToNow(new Date(evt.time), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] px-1.5", cfg.bg, cfg.color)}>
                          {evt.type}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
