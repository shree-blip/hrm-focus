import { useState, useMemo, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp,
  Award,
  Target,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Minus,
  Loader2,
  Plus,
  Flame,
  Calendar,
  BarChart3,
  Activity,
  FileText,
  BookOpen,
  Zap,
  Shield,
  Timer,
  Coffee,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useEmployees } from "@/hooks/useEmployees";
import { useTeamPresence } from "@/hooks/useTeamPresence";
import { usePerformanceReviews } from "@/hooks/usePerformanceReviews";
import { useAuth } from "@/contexts/AuthContext";

import { GiveFeedbackDialog } from "@/components/performance/GiveFeedbackDialog";
import { SetGoalDialog } from "@/components/performance/SetGoalDialog";
import { GoalsList } from "@/components/performance/GoalsList";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const STANDARD_HOURS_PER_DAY = 7.5;
const STANDARD_WORKING_DAYS = 21;
const MONTHLY_TARGET_HOURS = STANDARD_HOURS_PER_DAY * STANDARD_WORKING_DAYS; // 157.5h
const MIN_LOGSHEETS_PER_DAY = 3;
const ACCEPTABLE_BREAK_MINUTES = 45;
const MIN_LOG_MINUTES = 15; // entries under 15min are "low effort"

type PeriodType = "this-week" | "this-month" | "last-month" | "this-quarter" | "this-year";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "this-quarter", label: "This Quarter" },
  { value: "this-year", label: "This Year" },
];

// ═══════════════════════════════════════════════════════════════
// DATE RANGE HELPER
// ═══════════════════════════════════════════════════════════════
function getDateRange(period: PeriodType) {
  const now = new Date();
  const y = now.getFullYear(),
    m = now.getMonth();
  switch (period) {
    case "this-week": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(y, m, diff);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end, workingDays: 5 };
    }
    case "this-month":
      return {
        start: new Date(y, m, 1),
        end: new Date(y, m + 1, 0, 23, 59, 59, 999),
        workingDays: STANDARD_WORKING_DAYS,
      };
    case "last-month":
      return {
        start: new Date(y, m - 1, 1),
        end: new Date(y, m, 0, 23, 59, 59, 999),
        workingDays: STANDARD_WORKING_DAYS,
      };
    case "this-quarter": {
      const qs = Math.floor(m / 3) * 3;
      return {
        start: new Date(y, qs, 1),
        end: new Date(y, qs + 3, 0, 23, 59, 59, 999),
        workingDays: STANDARD_WORKING_DAYS * 3,
      };
    }
    case "this-year":
      return {
        start: new Date(y, 0, 1),
        end: new Date(y, 11, 31, 23, 59, 59, 999),
        workingDays: STANDARD_WORKING_DAYS * 12,
      };
    default:
      return {
        start: new Date(y, m, 1),
        end: new Date(y, m + 1, 0, 23, 59, 59, 999),
        workingDays: STANDARD_WORKING_DAYS,
      };
  }
}

function getWorkingDaysInRange(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════
// SCORING ENGINE v3.0 — 6 Dimensions
// ═══════════════════════════════════════════════════════════════
interface EmployeeMetrics {
  employeeId: string;
  employeeName: string;
  initials: string;
  department: string;
  jobTitle: string;
  userId: string;
  profileId: string | null;

  // Raw data
  totalHoursWorked: number;
  totalBreakMinutes: number;
  totalPauseMinutes: number;
  daysAttended: number;
  dailyHours: number[]; // hours per day for consistency calc
  totalLogsheetEntries: number;
  daysWithEnoughLogs: number; // days with 3+ entries
  avgMinutesPerLog: number;
  leaveDaysTaken: number;

  // Adjusted targets
  adjustedWorkingDays: number;
  adjustedTargetHours: number;

  // 6 dimension scores (0-100 each)
  productiveHoursScore: number; // 30%
  logsheetComplianceScore: number; // 25%
  attendanceScore: number; // 15%
  breakDisciplineScore: number; // 10%
  logsheetQualityScore: number; // 10%
  consistencyScore: number; // 10%

  // Final
  performanceScore: number;
  status: "top" | "good" | "needs-improvement" | "underutilized" | "overloaded";
  trend: "up" | "down" | "same";
  alerts: string[];
}

function computeScore(m: Omit<EmployeeMetrics, "performanceScore" | "status" | "trend" | "alerts">) {
  const score = Math.round(
    m.productiveHoursScore * 0.3 +
      m.logsheetComplianceScore * 0.25 +
      m.attendanceScore * 0.15 +
      m.breakDisciplineScore * 0.1 +
      m.logsheetQualityScore * 0.1 +
      m.consistencyScore * 0.1,
  );

  const avgDailyHours = m.daysAttended > 0 ? m.totalHoursWorked / m.daysAttended : 0;

  let status: EmployeeMetrics["status"];
  if (avgDailyHours > 9) status = "overloaded";
  else if (score >= 85) status = "top";
  else if (score >= 70) status = "good";
  else if (avgDailyHours < 5 && m.daysAttended > 0) status = "underutilized";
  else status = "needs-improvement";

  const trend: EmployeeMetrics["trend"] = score >= 70 ? "up" : score >= 50 ? "same" : "down";

  const alerts: string[] = [];
  if (avgDailyHours > 9) alerts.push(`Avg ${avgDailyHours.toFixed(1)}h/day — burnout risk`);
  if (avgDailyHours < 5 && m.daysAttended > 3) alerts.push(`Only ${avgDailyHours.toFixed(1)}h/day avg — underutilized`);
  if (m.logsheetComplianceScore < 50 && m.daysAttended > 0) alerts.push("Logsheet compliance below 50%");
  if (m.totalLogsheetEntries === 0 && m.daysAttended > 0) alerts.push("No logsheets filed this period");
  if (m.breakDisciplineScore < 50) alerts.push("Excessive break time");
  if (m.attendanceScore < 60 && m.adjustedWorkingDays > 5) alerts.push("Low attendance rate");
  if (m.productiveHoursScore < 50)
    alerts.push(`Only ${m.totalHoursWorked.toFixed(1)}h of ${m.adjustedTargetHours.toFixed(0)}h target`);

  return { performanceScore: Math.min(100, Math.max(0, score)), status, trend, alerts };
}

// ═══════════════════════════════════════════════════════════════
// STATUS CONFIG
// ═══════════════════════════════════════════════════════════════
const STATUS_CONFIG = {
  top: { label: "Top Performer", className: "bg-green-500/15 text-green-500 border-green-500/30", icon: "⭐" },
  good: { label: "Performing Well", className: "bg-blue-500/15 text-blue-500 border-blue-500/30", icon: "✓" },
  "needs-improvement": {
    label: "Needs Improvement",
    className: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    icon: "⚠",
  },
  underutilized: { label: "Underutilized", className: "bg-gray-400/15 text-gray-400 border-gray-400/30", icon: "↓" },
  overloaded: { label: "Overloaded", className: "bg-red-500/15 text-red-500 border-red-500/30", icon: "🔥" },
};

// ═══════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════
function ScoreBadge({ score, size = "default" }: { score: number; size?: "default" | "lg" }) {
  const c =
    score >= 85
      ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-800"
      : score >= 70
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800"
        : score >= 50
          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
          : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800";
  return <Badge className={`${c} font-mono border ${size === "lg" ? "text-lg px-3 py-1" : ""}`}>{score}</Badge>;
}

function KPICard({
  title,
  value,
  subtitle,
  icon,
  iconBg,
  delay = 0,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  delay?: number;
}) {
  return (
    <Card
      className="animate-slide-up opacity-0"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-display font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={`h-12 w-12 rounded-xl ${iconBg} flex items-center justify-center`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DimensionBar({
  label,
  value,
  weight,
  detail,
  icon,
}: {
  label: string;
  value: number;
  weight: string;
  detail: string;
  icon: React.ReactNode;
}) {
  const color =
    value >= 85 ? "text-green-500" : value >= 70 ? "text-blue-500" : value >= 50 ? "text-amber-500" : "text-red-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium flex items-center gap-1.5">
          {icon}
          {label} <span className="text-muted-foreground font-normal">({weight})</span>
        </span>
        <span className={`font-mono font-bold ${color}`}>{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const PerformanceMetrics = () => {
  const { isManager, isVP, isAdmin, user, isLineManager, isSupervisor } = useAuth();
  const canManage = isManager || isVP || isAdmin;
  const isTeamView = canManage || isLineManager || isSupervisor;
  const isEmployeeView = !isTeamView;

  const [period, setPeriod] = useState<PeriodType>("this-month");
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<EmployeeMetrics[]>([]);
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const { employees, loading: empLoading } = useEmployees();
  const { getStatus: getPresenceStatus, getOnlineCount } = useTeamPresence();
  const { goals, loading: goalsLoading, createGoal, updateGoal, deleteGoal, createFeedback } = usePerformanceReviews();

  const activeEmployees = useMemo(() => employees.filter((e) => e.status === "active"), [employees]);

  const activeEmployeesForDialog = useMemo(
    () => activeEmployees.map((e) => ({ id: e.id, first_name: e.first_name, last_name: e.last_name })),
    [activeEmployees],
  );

  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  // ═══════════════════════════════════════
  // FETCH & COMPUTE ALL METRICS
  // ═══════════════════════════════════════
  const fetchMetrics = useCallback(async () => {
    if (!user || activeEmployees.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const { start, end, workingDays } = getDateRange(period);
      const startISO = start.toISOString();
      const endISO = end.toISOString();
      const startDate = start.toISOString().split("T")[0];
      const endDate = end.toISOString().split("T")[0];

      // Build profile → user mapping
      const profileIds = activeEmployees.map((e) => e.profile_id).filter(Boolean) as string[];
      const { data: profiles } = await supabase.from("profiles").select("id, user_id").in("id", profileIds);
      const profileToUser = new Map(profiles?.map((p) => [p.id, p.user_id]) || []);
      const userToProfile = new Map(profiles?.map((p) => [p.user_id, p.id]) || []);

      // Determine which employees to show based on role
      let visibleEmployees = activeEmployees;
      if (isEmployeeView) {
        visibleEmployees = activeEmployees.filter((e) => {
          const uid = e.profile_id ? profileToUser.get(e.profile_id) : null;
          return uid === user.id;
        });
      } else if (!isVP && !isAdmin) {
        // Line manager / supervisor — would need team resolver
        // For now show all active — your useTeamAttendance already handles scoping
      }

      const userIds = visibleEmployees
        .map((e) => (e.profile_id ? profileToUser.get(e.profile_id) : null))
        .filter(Boolean) as string[];

      if (userIds.length === 0) {
        setMetrics([]);
        setLoading(false);
        return;
      }

      // ── FETCH: Attendance logs ──
      const { data: attLogs } = await supabase
        .from("attendance_logs")
        .select("user_id, clock_in, clock_out, total_break_minutes, total_pause_minutes")
        .in("user_id", userIds)
        .gte("clock_in", startISO)
        .lte("clock_in", endISO);

      // ── FETCH: Work logs (logsheets) ──
      const { data: workLogs } = await supabase
        .from("work_logs")
        .select("user_id, log_date, time_spent_minutes, task_description")
        .in("user_id", userIds)
        .gte("log_date", startDate)
        .lte("log_date", endDate);

      // ── FETCH: Approved leave in period ──
      const { data: leaveData } = await supabase
        .from("leave_requests")
        .select("user_id, days, start_date, end_date")
        .in("user_id", userIds)
        .eq("status", "approved")
        .or(`start_date.lte.${endDate},end_date.gte.${startDate}`);

      // ── COMPUTE per employee ──
      const results: EmployeeMetrics[] = visibleEmployees.map((emp) => {
        const uid = emp.profile_id ? profileToUser.get(emp.profile_id) || "" : "";
        const name = `${emp.first_name} ${emp.last_name}`.trim();
        const initials = `${emp.first_name?.charAt(0) || ""}${emp.last_name?.charAt(0) || ""}`.toUpperCase();

        // === LEAVE ===
        const empLeaves = leaveData?.filter((l) => l.user_id === uid) || [];
        const leaveDaysTaken = empLeaves.reduce((s, l) => s + (l.days || 0), 0);

        // Adjusted targets
        const adjustedWorkingDays = Math.max(1, workingDays - leaveDaysTaken);
        const adjustedTargetHours = adjustedWorkingDays * STANDARD_HOURS_PER_DAY;

        // === ATTENDANCE ===
        const empAtt = attLogs?.filter((l) => l.user_id === uid && l.clock_out) || [];
        const attendedDays = new Set<string>();
        const dailyHoursMap = new Map<string, number>();
        let totalHoursWorked = 0;
        let totalBreakMinutes = 0;
        let totalPauseMinutes = 0;

        empAtt.forEach((log) => {
          const cin = new Date(log.clock_in);
          const cout = new Date(log.clock_out!);
          const brk = log.total_break_minutes || 0;
          const pause = log.total_pause_minutes || 0;
          const hrs = Math.max(0, (cout.getTime() - cin.getTime() - (brk + pause) * 60000) / 3600000);

          const dayKey = cin.toISOString().split("T")[0];
          attendedDays.add(dayKey);
          dailyHoursMap.set(dayKey, (dailyHoursMap.get(dayKey) || 0) + hrs);
          totalHoursWorked += hrs;
          totalBreakMinutes += brk;
          totalPauseMinutes += pause;
        });

        const daysAttended = attendedDays.size;
        const dailyHours = Array.from(dailyHoursMap.values());

        // === LOGSHEETS (WORK_LOGS) ===
        const empLogs = workLogs?.filter((l) => l.user_id === uid) || [];
        const totalLogsheetEntries = empLogs.length;

        // Count days with 3+ entries
        const logsByDay = new Map<string, number>();
        let totalLogMinutes = 0;
        empLogs.forEach((l) => {
          logsByDay.set(l.log_date, (logsByDay.get(l.log_date) || 0) + 1);
          totalLogMinutes += l.time_spent_minutes || 0;
        });
        const daysWithEnoughLogs = Array.from(logsByDay.values()).filter((c) => c >= MIN_LOGSHEETS_PER_DAY).length;
        const avgMinutesPerLog = totalLogsheetEntries > 0 ? totalLogMinutes / totalLogsheetEntries : 0;

        // === DIMENSION 1: Productive Hours (30%) ===
        const productiveHoursScore =
          adjustedTargetHours > 0 ? Math.min(100, Math.round((totalHoursWorked / adjustedTargetHours) * 100)) : 0;

        // === DIMENSION 2: Logsheet Compliance (25%) ===
        const logsheetComplianceScore =
          adjustedWorkingDays > 0 ? Math.min(100, Math.round((daysWithEnoughLogs / adjustedWorkingDays) * 100)) : 0;

        // === DIMENSION 3: Attendance (15%) ===
        const attendanceScore =
          adjustedWorkingDays > 0 ? Math.min(100, Math.round((daysAttended / adjustedWorkingDays) * 100)) : 0;

        // === DIMENSION 4: Break Discipline (10%) ===
        let breakDisciplineScore = 100;
        if (daysAttended > 0) {
          const avgBreakPerDay = totalBreakMinutes / daysAttended;
          if (avgBreakPerDay > ACCEPTABLE_BREAK_MINUTES) {
            const excess = avgBreakPerDay - ACCEPTABLE_BREAK_MINUTES;
            breakDisciplineScore = Math.max(0, Math.round(100 - (excess / 15) * 15));
          }
        }

        // === DIMENSION 5: Logsheet Quality (10%) ===
        let logsheetQualityScore = 0;
        if (totalLogsheetEntries > 0) {
          // Penalize if average log is under 15min (low-effort padding)
          if (avgMinutesPerLog >= 30) logsheetQualityScore = 100;
          else if (avgMinutesPerLog >= MIN_LOG_MINUTES)
            logsheetQualityScore = Math.round((avgMinutesPerLog / 30) * 100);
          else logsheetQualityScore = Math.max(0, Math.round((avgMinutesPerLog / MIN_LOG_MINUTES) * 50));
        }

        // === DIMENSION 6: Consistency (10%) ===
        let consistencyScore = 100;
        if (dailyHours.length >= 3) {
          const mean = dailyHours.reduce((a, b) => a + b, 0) / dailyHours.length;
          const variance = dailyHours.reduce((a, h) => a + Math.pow(h - mean, 2), 0) / dailyHours.length;
          const stdDev = Math.sqrt(variance);
          // Lower stdDev = more consistent. StdDev of 0 = 100, stdDev >= 3 = 0
          consistencyScore = Math.max(0, Math.round(100 - (stdDev / 3) * 100));
        } else if (dailyHours.length === 0) {
          consistencyScore = 0;
        }

        const base = {
          employeeId: emp.id,
          employeeName: name,
          initials,
          department: emp.department || "—",
          jobTitle: emp.job_title || "Employee",
          userId: uid,
          profileId: emp.profile_id,
          totalHoursWorked: Math.round(totalHoursWorked * 10) / 10,
          totalBreakMinutes,
          totalPauseMinutes,
          daysAttended,
          dailyHours,
          totalLogsheetEntries,
          daysWithEnoughLogs,
          avgMinutesPerLog: Math.round(avgMinutesPerLog),
          leaveDaysTaken,
          adjustedWorkingDays,
          adjustedTargetHours: Math.round(adjustedTargetHours * 10) / 10,
          productiveHoursScore,
          logsheetComplianceScore,
          attendanceScore,
          breakDisciplineScore,
          logsheetQualityScore,
          consistencyScore,
        };

        return { ...base, ...computeScore(base) };
      });

      results.sort((a, b) => b.performanceScore - a.performanceScore);
      setMetrics(results);
    } catch (err) {
      console.error("Performance metrics fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, activeEmployees, period, isEmployeeView, isVP, isAdmin]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // ═══════════════════════════════════════
  // DERIVED DATA
  // ═══════════════════════════════════════
  const departments = useMemo(() => {
    const d = new Set(metrics.map((m) => m.department).filter((d) => d !== "—"));
    return Array.from(d).sort();
  }, [metrics]);

  const filtered = useMemo(() => {
    if (selectedDept === "All") return metrics;
    return metrics.filter((m) => m.department === selectedDept);
  }, [metrics, selectedDept]);

  const deptStats = useMemo(
    () =>
      departments
        .map((dept) => {
          const members = metrics.filter((m) => m.department === dept);
          if (!members.length) return null;
          return {
            name: dept,
            count: members.length,
            avgScore: Math.round(members.reduce((s, m) => s + m.performanceScore, 0) / members.length),
            avgUtil: Math.round(members.reduce((s, m) => s + m.productiveHoursScore, 0) / members.length),
            avgLogsheet: Math.round(members.reduce((s, m) => s + m.logsheetComplianceScore, 0) / members.length),
            totalAlerts: members.reduce((s, m) => s + m.alerts.length, 0),
            topCount: members.filter((m) => m.status === "top").length,
            onlineCount: members.filter((m) => {
              const e = activeEmployees.find((e) => e.id === m.employeeId);
              return e ? getPresenceStatus(e.id) === "online" : false;
            }).length,
          };
        })
        .filter(Boolean),
    [departments, metrics, activeEmployees, getPresenceStatus],
  );

  // Company KPIs
  const kpis = useMemo(() => {
    if (metrics.length === 0)
      return {
        avgScore: 0,
        avgHours: 0,
        avgLogsheet: 0,
        topPerformers: 0,
        needsAttention: 0,
        totalAlerts: 0,
        totalLogEntries: 0,
        total: 0,
      };
    const n = metrics.length;
    return {
      avgScore: Math.round(metrics.reduce((s, m) => s + m.performanceScore, 0) / n),
      avgHours: Math.round((metrics.reduce((s, m) => s + m.totalHoursWorked, 0) / n) * 10) / 10,
      avgLogsheet: Math.round(metrics.reduce((s, m) => s + m.logsheetComplianceScore, 0) / n),
      topPerformers: metrics.filter((m) => m.status === "top").length,
      needsAttention: metrics.filter((m) => m.performanceScore < 50).length,
      totalAlerts: metrics.reduce((s, m) => s + m.alerts.length, 0),
      totalLogEntries: metrics.reduce((s, m) => s + m.totalLogsheetEntries, 0),
      total: n,
    };
  }, [metrics]);

  // Selected employee
  const selected = selectedEmployeeId ? metrics.find((m) => m.employeeId === selectedEmployeeId) : null;
  const empGoals = selected ? goals.filter((g) => g.employee_id === selected.employeeId) : [];

  // Radar data
  const radarData = useMemo(() => {
    const source = selected ? [selected] : filtered;
    if (!source.length) return [];
    const avg = (fn: (s: (typeof source)[0]) => number) =>
      Math.round(source.reduce((a, s) => a + fn(s), 0) / source.length);
    return [
      { metric: "Productive Hrs", value: avg((s) => s.productiveHoursScore) },
      { metric: "Logsheets", value: avg((s) => s.logsheetComplianceScore) },
      { metric: "Attendance", value: avg((s) => s.attendanceScore) },
      { metric: "Break Discipline", value: avg((s) => s.breakDisciplineScore) },
      { metric: "Log Quality", value: avg((s) => s.logsheetQualityScore) },
      { metric: "Consistency", value: avg((s) => s.consistencyScore) },
    ];
  }, [filtered, selected]);

  const barData = useMemo(
    () =>
      filtered.slice(0, 12).map((m) => ({
        name: m.employeeName.split(" ")[0],
        score: m.performanceScore,
        hours: m.productiveHoursScore,
        logs: m.logsheetComplianceScore,
      })),
    [filtered],
  );

  const isLoading = loading || empLoading || goalsLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // ═══════════════════════════════════════
  // EMPLOYEE DETAIL VIEW
  // ═══════════════════════════════════════
  if (selected) {
    const s = selected;
    const cfg = STATUS_CONFIG[s.status];
    const emp = activeEmployees.find((e) => e.id === s.employeeId);
    const presence = emp ? getPresenceStatus(emp.id) : "offline";
    const avgDailyHrs = s.daysAttended > 0 ? (s.totalHoursWorked / s.daysAttended).toFixed(1) : "0";
    const avgBreakPerDay = s.daysAttended > 0 ? Math.round(s.totalBreakMinutes / s.daysAttended) : 0;

    return (
      <DashboardLayout>
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => setSelectedEmployeeId(null)}>
          ← Back to Dashboard
        </Button>

        {/* Profile */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-5 flex-wrap">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">{s.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-display font-bold">{s.employeeName}</h2>
                <p className="text-sm text-muted-foreground">
                  {s.jobTitle} · {s.department}
                </p>
              </div>
              <ScoreBadge score={s.performanceScore} size="lg" />
              <Badge className={`${cfg.className} border`}>
                {cfg.icon} {cfg.label}
              </Badge>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${presence === "online" ? "bg-green-500 shadow-[0_0_6px_hsl(142,76%,36%)]" : presence === "break" ? "bg-amber-500" : "bg-gray-400"}`}
                />
                <span className="text-xs text-muted-foreground capitalize">{presence}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <KPICard
            title="Total Hours"
            value={`${s.totalHoursWorked}h`}
            subtitle={`of ${s.adjustedTargetHours}h target`}
            icon={<Clock className="h-5 w-5 text-primary" />}
            iconBg="bg-primary/10"
            delay={100}
          />
          <KPICard
            title="Avg Daily"
            value={`${avgDailyHrs}h`}
            subtitle={`${s.daysAttended} days worked`}
            icon={<Activity className="h-5 w-5 text-green-500" />}
            iconBg="bg-green-500/10"
            delay={130}
          />
          <KPICard
            title="Logsheets"
            value={s.totalLogsheetEntries.toString()}
            subtitle={`${s.daysWithEnoughLogs}/${s.adjustedWorkingDays} days compliant`}
            icon={<BookOpen className="h-5 w-5 text-blue-500" />}
            iconBg="bg-blue-500/10"
            delay={160}
          />
          <KPICard
            title="Attendance"
            value={`${s.daysAttended}/${s.adjustedWorkingDays}`}
            subtitle={`${s.attendanceScore}% rate`}
            icon={<CheckCircle2 className="h-5 w-5 text-amber-500" />}
            iconBg="bg-amber-500/10"
            delay={190}
          />
          <KPICard
            title="Avg Break"
            value={`${avgBreakPerDay}m`}
            subtitle={`${ACCEPTABLE_BREAK_MINUTES}m standard`}
            icon={<Coffee className="h-5 w-5 text-orange-500" />}
            iconBg="bg-orange-500/10"
            delay={220}
          />
          <KPICard
            title="Leave Taken"
            value={`${s.leaveDaysTaken}d`}
            subtitle="Approved leave"
            icon={<Calendar className="h-5 w-5 text-purple-500" />}
            iconBg="bg-purple-500/10"
            delay={250}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 6-Dimension Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" /> Performance Score Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <DimensionBar
                label="Productive Hours"
                value={s.productiveHoursScore}
                weight="30%"
                detail={`${s.totalHoursWorked}h worked / ${s.adjustedTargetHours}h target (leave-adjusted)`}
                icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
              />
              <DimensionBar
                label="Logsheet Compliance"
                value={s.logsheetComplianceScore}
                weight="25%"
                detail={`${s.daysWithEnoughLogs} of ${s.adjustedWorkingDays} days with 3+ logsheet entries`}
                icon={<BookOpen className="h-3.5 w-3.5 text-muted-foreground" />}
              />
              <DimensionBar
                label="Attendance"
                value={s.attendanceScore}
                weight="15%"
                detail={`${s.daysAttended} of ${s.adjustedWorkingDays} expected working days`}
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />}
              />
              <DimensionBar
                label="Break Discipline"
                value={s.breakDisciplineScore}
                weight="10%"
                detail={`Avg ${avgBreakPerDay}min/day (${ACCEPTABLE_BREAK_MINUTES}min standard)`}
                icon={<Coffee className="h-3.5 w-3.5 text-muted-foreground" />}
              />
              <DimensionBar
                label="Logsheet Quality"
                value={s.logsheetQualityScore}
                weight="10%"
                detail={`Avg ${s.avgMinutesPerLog}min per entry (${MIN_LOG_MINUTES}min minimum)`}
                icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
              />
              <DimensionBar
                label="Consistency"
                value={s.consistencyScore}
                weight="10%"
                detail="Lower daily hours variance = higher score"
                icon={<Shield className="h-3.5 w-3.5 text-muted-foreground" />}
              />
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-display font-bold">Final Score</span>
                  <ScoreBadge score={s.performanceScore} size="lg" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Radar */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Performance Radar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Score"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {s.alerts.length > 0 && (
          <Card className="mb-6 border-red-500/20">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" /> Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {s.alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                  <span>🚨</span>
                  <span className="text-sm text-red-500 dark:text-red-400">{a}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Goals */}
        {empGoals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <GoalsList
                goals={empGoals}
                onUpdateProgress={(id, p) => updateGoal(id, { progress: p })}
                onComplete={(id) => updateGoal(id, { status: "completed", progress: 100 })}
                onCancel={(id) => updateGoal(id, { status: "cancelled" })}
                onDelete={deleteGoal}
                canManage={canManage}
              />
            </CardContent>
          </Card>
        )}
      </DashboardLayout>
    );
  }

  // ═══════════════════════════════════════
  // MAIN DASHBOARD
  // ═══════════════════════════════════════
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold">
            {isEmployeeView ? "My Performance" : "Performance Command Center"}
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            {isEmployeeView ? (
              "Your 6-dimension performance metrics"
            ) : (
              <>
                Real-time intelligence · {metrics.length} employees{" "}
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_hsl(142,76%,36%)]" />
                  {getOnlineCount()} online
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setShowGoalDialog(true)}>
              <Target className="h-4 w-4 mr-1" /> Goal
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowFeedbackDialog(true)}>
            <FileText className="h-4 w-4 mr-1" /> Feedback
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {isEmployeeView && metrics[0] ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            delay={100}
            title="My Score"
            value={metrics[0].performanceScore.toString()}
            subtitle="6-dimension composite"
            icon={<Award className="h-5 w-5 text-primary" />}
            iconBg="bg-primary/10"
          />
          <KPICard
            delay={130}
            title="Hours Worked"
            value={`${metrics[0].totalHoursWorked}h`}
            subtitle={`of ${metrics[0].adjustedTargetHours}h target`}
            icon={<Clock className="h-5 w-5 text-green-500" />}
            iconBg="bg-green-500/10"
          />
          <KPICard
            delay={160}
            title="Logsheet Days"
            value={`${metrics[0].daysWithEnoughLogs}/${metrics[0].adjustedWorkingDays}`}
            subtitle={`${metrics[0].totalLogsheetEntries} total entries`}
            icon={<BookOpen className="h-5 w-5 text-blue-500" />}
            iconBg="bg-blue-500/10"
          />
          <KPICard
            delay={190}
            title="Attendance"
            value={`${metrics[0].daysAttended} days`}
            subtitle={`${metrics[0].attendanceScore}% rate`}
            icon={<CheckCircle2 className="h-5 w-5 text-amber-500" />}
            iconBg="bg-amber-500/10"
          />
        </div>
      ) : !isEmployeeView ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <KPICard
            delay={100}
            title="Avg Score"
            value={kpis.avgScore.toString()}
            subtitle="6-dimension composite"
            icon={<Award className="h-5 w-5 text-primary" />}
            iconBg="bg-primary/10"
          />
          <KPICard
            delay={120}
            title="Avg Hours"
            value={`${kpis.avgHours}h`}
            subtitle={`of ${MONTHLY_TARGET_HOURS}h target`}
            icon={<Clock className="h-5 w-5 text-green-500" />}
            iconBg="bg-green-500/10"
          />
          <KPICard
            delay={140}
            title="Logsheet Rate"
            value={`${kpis.avgLogsheet}%`}
            subtitle={`${kpis.totalLogEntries} total entries`}
            icon={<BookOpen className="h-5 w-5 text-blue-500" />}
            iconBg="bg-blue-500/10"
          />
          <KPICard
            delay={160}
            title="Top Performers"
            value={kpis.topPerformers.toString()}
            subtitle={`Score ≥ 85 of ${kpis.total}`}
            icon={<Award className="h-5 w-5 text-yellow-500" />}
            iconBg="bg-yellow-500/10"
          />
          <KPICard
            delay={180}
            title="Needs Attention"
            value={kpis.needsAttention.toString()}
            subtitle="Score below 50"
            icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
            iconBg="bg-red-500/10"
          />
          <KPICard
            delay={200}
            title="Active Alerts"
            value={kpis.totalAlerts.toString()}
            subtitle="Across all teams"
            icon={<Flame className="h-5 w-5 text-amber-500" />}
            iconBg="bg-amber-500/10"
          />
        </div>
      ) : null}

      {/* Department Filter */}
      {!isEmployeeView && departments.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-4">
          <Button
            size="sm"
            variant={selectedDept === "All" ? "default" : "outline"}
            onClick={() => setSelectedDept("All")}
          >
            All Teams
          </Button>
          {departments.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={selectedDept === d ? "default" : "outline"}
              onClick={() => setSelectedDept(d)}
            >
              {d}
            </Button>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="goals">Goals ({goals.length})</TabsTrigger>
          {!isEmployeeView && <TabsTrigger value="alerts">Alerts ({kpis.totalAlerts})</TabsTrigger>}
        </TabsList>

        {/* ════════ OVERVIEW ════════ */}
        <TabsContent value="overview" className="space-y-6">
          {/* Employee self-view breakdown */}
          {isEmployeeView && metrics[0] && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" /> Score Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <DimensionBar
                    label="Productive Hours"
                    value={metrics[0].productiveHoursScore}
                    weight="30%"
                    detail={`${metrics[0].totalHoursWorked}h / ${metrics[0].adjustedTargetHours}h`}
                    icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                  />
                  <DimensionBar
                    label="Logsheet Compliance"
                    value={metrics[0].logsheetComplianceScore}
                    weight="25%"
                    detail={`${metrics[0].daysWithEnoughLogs}/${metrics[0].adjustedWorkingDays} days with 3+ entries`}
                    icon={<BookOpen className="h-3.5 w-3.5 text-muted-foreground" />}
                  />
                  <DimensionBar
                    label="Attendance"
                    value={metrics[0].attendanceScore}
                    weight="15%"
                    detail={`${metrics[0].daysAttended}/${metrics[0].adjustedWorkingDays} days`}
                    icon={<CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />}
                  />
                  <DimensionBar
                    label="Break Discipline"
                    value={metrics[0].breakDisciplineScore}
                    weight="10%"
                    detail={`${metrics[0].daysAttended > 0 ? Math.round(metrics[0].totalBreakMinutes / metrics[0].daysAttended) : 0}min avg (${ACCEPTABLE_BREAK_MINUTES}min standard)`}
                    icon={<Coffee className="h-3.5 w-3.5 text-muted-foreground" />}
                  />
                  <DimensionBar
                    label="Logsheet Quality"
                    value={metrics[0].logsheetQualityScore}
                    weight="10%"
                    detail={`Avg ${metrics[0].avgMinutesPerLog}min per entry`}
                    icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                  />
                  <DimensionBar
                    label="Consistency"
                    value={metrics[0].consistencyScore}
                    weight="10%"
                    detail="Daily hours variance"
                    icon={<Shield className="h-3.5 w-3.5 text-muted-foreground" />}
                  />
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-display font-bold">Final Score</span>
                      <ScoreBadge score={metrics[0].performanceScore} size="lg" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-lg">Performance Radar</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                          name="Score"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* CEO/Team view */}
          {!isEmployeeView && (
            <>
              {/* Department cards */}
              {selectedDept === "All" && deptStats.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {deptStats.map(
                    (d, i) =>
                      d && (
                        <Card
                          key={d.name}
                          className="cursor-pointer hover:border-primary/30 transition-colors animate-slide-up opacity-0"
                          style={{ animationDelay: `${300 + i * 50}ms`, animationFillMode: "forwards" }}
                          onClick={() => setSelectedDept(d.name!)}
                        >
                          <CardContent className="pt-5 pb-4">
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="font-display font-bold text-sm">{d.name}</h3>
                              <Badge variant="outline" className="text-xs">
                                {d.count} staff
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mb-3">
                              <ScoreBadge score={d.avgScore} />
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground">Productive Hrs</p>
                                <p className="text-sm font-bold">{d.avgUtil}%</p>
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground">Logsheets</p>
                                <p className="text-sm font-bold">{d.avgLogsheet}%</p>
                              </div>
                            </div>
                            <Progress value={d.avgScore} className="h-1.5" />
                            <div className="flex gap-2 mt-3">
                              {d.topCount > 0 && (
                                <Badge className="bg-green-500/15 text-green-500 border-green-500/30 border text-xs">
                                  {d.topCount} top
                                </Badge>
                              )}
                              {d.totalAlerts > 0 && (
                                <Badge className="bg-red-500/15 text-red-500 border-red-500/30 border text-xs">
                                  {d.totalAlerts} alerts
                                </Badge>
                              )}
                              {d.onlineCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {d.onlineCount} online
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ),
                  )}
                </div>
              )}

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" /> Performance Rankings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {barData.length > 0 ? (
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Score" />
                            <Bar dataKey="hours" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="Hours %" />
                            <Bar dataKey="logs" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Logsheets %" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-12">No data</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-lg">6-Dimension Avg</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar
                            name="Avg"
                            dataKey="value"
                            stroke="hsl(var(--primary))"
                            fill="hsl(var(--primary))"
                            fillOpacity={0.2}
                            strokeWidth={2}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Employee Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-lg">Employee Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {filtered.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No data</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-2 font-medium w-8">#</th>
                            <th className="pb-2 font-medium">Employee</th>
                            <th className="pb-2 font-medium text-center">Score</th>
                            <th className="pb-2 font-medium text-center hidden sm:table-cell">Hours</th>
                            <th className="pb-2 font-medium text-center hidden md:table-cell">Logsheets</th>
                            <th className="pb-2 font-medium text-center hidden md:table-cell">Attend.</th>
                            <th className="pb-2 font-medium text-center hidden lg:table-cell">Break</th>
                            <th className="pb-2 font-medium text-center hidden lg:table-cell">Consist.</th>
                            <th className="pb-2 font-medium text-center hidden sm:table-cell">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((m, idx) => {
                            const cfg = STATUS_CONFIG[m.status];
                            const emp = activeEmployees.find((e) => e.id === m.employeeId);
                            const presence = emp ? getPresenceStatus(emp.id) : "offline";
                            return (
                              <tr
                                key={m.employeeId}
                                className="border-b last:border-0 hover:bg-accent/30 transition-colors cursor-pointer"
                                onClick={() => setSelectedEmployeeId(m.employeeId)}
                              >
                                <td className="py-3 text-muted-foreground">{idx + 1}</td>
                                <td className="py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="relative">
                                      <Avatar className="h-8 w-8">
                                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                          {m.initials}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div
                                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${presence === "online" ? "bg-green-500" : presence === "break" ? "bg-amber-500" : "bg-gray-400"}`}
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium truncate flex items-center gap-1">
                                        {m.employeeName}
                                        {m.trend === "up" && <ArrowUp className="h-3.5 w-3.5 text-green-500" />}
                                        {m.trend === "down" && <ArrowDown className="h-3.5 w-3.5 text-red-500" />}
                                        {m.trend === "same" && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate">{m.department}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 text-center">
                                  <ScoreBadge score={m.performanceScore} />
                                </td>
                                <td className="py-3 text-center hidden sm:table-cell">
                                  <span className="text-xs">
                                    {m.totalHoursWorked}h{" "}
                                    <span className="text-muted-foreground">/ {m.adjustedTargetHours}h</span>
                                  </span>
                                </td>
                                <td className="py-3 text-center hidden md:table-cell">
                                  <span className="text-xs">
                                    {m.daysWithEnoughLogs}/{m.adjustedWorkingDays}
                                  </span>
                                </td>
                                <td className="py-3 text-center hidden md:table-cell">
                                  <span className="text-xs">
                                    {m.daysAttended}/{m.adjustedWorkingDays}
                                  </span>
                                </td>
                                <td className="py-3 text-center hidden lg:table-cell">
                                  <span className="text-xs">
                                    {m.daysAttended > 0 ? Math.round(m.totalBreakMinutes / m.daysAttended) : 0}m
                                  </span>
                                </td>
                                <td className="py-3 text-center hidden lg:table-cell">
                                  <span className="text-xs">{m.consistencyScore}%</span>
                                </td>
                                <td className="py-3 text-center hidden sm:table-cell">
                                  <Badge className={`${cfg.className} border text-[10px]`}>
                                    {cfg.icon} {cfg.label}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bottom insights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-sm flex items-center gap-2">
                      <Award className="h-4 w-4 text-yellow-500" /> Top Performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {metrics
                      .filter((m) => m.status === "top")
                      .slice(0, 6)
                      .map((m) => (
                        <div
                          key={m.employeeId}
                          className="flex items-center justify-between cursor-pointer hover:bg-accent/30 p-2 rounded-lg transition-colors"
                          onClick={() => setSelectedEmployeeId(m.employeeId)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span className="text-sm font-medium">{m.employeeName}</span>
                            <span className="text-xs text-muted-foreground">{m.department}</span>
                          </div>
                          <ScoreBadge score={m.performanceScore} />
                        </div>
                      ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" /> Needs Attention
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {metrics
                      .filter((m) => m.status === "needs-improvement" || m.status === "underutilized")
                      .slice(0, 6)
                      .map((m) => (
                        <div
                          key={m.employeeId}
                          className="flex items-center justify-between cursor-pointer hover:bg-accent/30 p-2 rounded-lg transition-colors"
                          onClick={() => setSelectedEmployeeId(m.employeeId)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span className="text-sm">{m.employeeName}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {m.department}
                          </Badge>
                        </div>
                      ))}
                    {metrics.filter((m) => m.status === "needs-improvement" || m.status === "underutilized").length ===
                      0 && <p className="text-sm text-muted-foreground text-center py-4">All good ✅</p>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-sm flex items-center gap-2">
                      <Flame className="h-4 w-4 text-red-500" /> Overloaded — Burnout Risk
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {metrics.filter((m) => m.status === "overloaded").length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No burnout risks ✅</p>
                    ) : (
                      metrics
                        .filter((m) => m.status === "overloaded")
                        .map((m) => (
                          <div
                            key={m.employeeId}
                            className="flex items-center justify-between cursor-pointer hover:bg-accent/30 p-2 rounded-lg transition-colors"
                            onClick={() => setSelectedEmployeeId(m.employeeId)}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              <span className="text-sm">{m.employeeName}</span>
                              <span className="text-xs text-muted-foreground">{m.totalHoursWorked}h</span>
                            </div>
                            <Badge className="bg-red-500/15 text-red-500 border-red-500/30 border text-xs">
                              {m.department}
                            </Badge>
                          </div>
                        ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ════════ GOALS ════════ */}
        <TabsContent value="goals" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-lg">Performance Goals</CardTitle>
              {canManage && (
                <Button size="sm" onClick={() => setShowGoalDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" /> New Goal
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <GoalsList
                goals={goals}
                onUpdateProgress={(id, p) => updateGoal(id, { progress: p })}
                onComplete={(id) => updateGoal(id, { status: "completed", progress: 100 })}
                onCancel={(id) => updateGoal(id, { status: "cancelled" })}
                onDelete={deleteGoal}
                canManage={canManage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════ ALERTS ════════ */}
        {!isEmployeeView && (
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" /> Active Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.filter((m) => m.alerts.length > 0).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                    <p className="text-lg font-medium">No active alerts</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {metrics
                      .filter((m) => m.alerts.length > 0)
                      .map((m) => (
                        <div key={m.employeeId}>
                          <div
                            className="flex items-center gap-3 mb-2 cursor-pointer"
                            onClick={() => setSelectedEmployeeId(m.employeeId)}
                          >
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                {m.initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{m.employeeName}</span>
                            <Badge variant="outline" className="text-xs">
                              {m.department}
                            </Badge>
                            <ScoreBadge score={m.performanceScore} />
                          </div>
                          {m.alerts.map((a, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 p-3 ml-10 rounded-lg bg-red-500/5 border border-red-500/10 mb-2"
                            >
                              <span>🚨</span>
                              <span className="text-sm text-red-500 dark:text-red-400">{a}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <SetGoalDialog
        open={showGoalDialog}
        onOpenChange={setShowGoalDialog}
        employees={activeEmployeesForDialog}
        onSubmit={createGoal}
      />
      <GiveFeedbackDialog
        open={showFeedbackDialog}
        onOpenChange={setShowFeedbackDialog}
        employees={activeEmployeesForDialog}
        onSubmit={createFeedback}
      />
    </DashboardLayout>
  );
};

export default PerformanceMetrics;
