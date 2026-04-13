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
  Info,
  ChevronRight,
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
  Legend,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useEmployees } from "@/hooks/useEmployees";
import { useLineManagerAccess } from "@/hooks/useLineManagerAccess";
import { useTeamPresence } from "@/hooks/useTeamPresence";
import { usePerformanceReviews } from "@/hooks/usePerformanceReviews";
import { useAuth } from "@/contexts/AuthContext";
import { WorkLog } from "@/hooks/useWorkLogs";

import { GiveFeedbackDialog } from "@/components/performance/GiveFeedbackDialog";
import { SetGoalDialog } from "@/components/performance/SetGoalDialog";
import { GoalsList } from "@/components/performance/GoalsList";

// ═══════════════════════════════════════════════════════════════
// COMPANY POLICY CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Net productive hours target per day (excluding breaks) */
const PRODUCTIVE_HOURS_PER_DAY = 7.5;

/** Mandatory break duration in minutes — this is policy, NOT penalized */
const MANDATORY_BREAK_MINUTES = 30;

/** Break threshold: above this total daily break minutes → slight penalty */
const BREAK_PENALTY_THRESHOLD = 40;

/** Max allowed break sessions per day. More than this = negative score */
const MAX_BREAK_SESSIONS_PER_DAY = 2;

/** Logsheet time target: 6.5–7 hours logged = 100% */
const LOGSHEET_TIME_MIN_HOURS = 6.5;
const LOGSHEET_TIME_MAX_HOURS = 7;

/** Min logsheet entries per day to be compliant */
const MIN_LOGS_PER_DAY = 2;
/** Ideal logsheet entries per day */
const IDEAL_LOGS_PER_DAY = 4;

/** Monthly logsheet entry targets */
const MONTHLY_MIN_LOGS = 25;
const MONTHLY_MAX_LOGS = 50;

/** Weekly productive hours target: 7.5 × 5 = 37.5 */
const WEEKLY_TARGET_HOURS = PRODUCTIVE_HOURS_PER_DAY * 5;

/** Don't flag overloaded unless avg daily > 9h */
const OVERLOAD_THRESHOLD_HOURS = 9;

/** Min daily hours for "underutilized" flag */
const UNDERUTILIZED_THRESHOLD_HOURS = 5;

type PeriodType = "this-week" | "last-week" | "this-month" | "last-month" | "this-quarter" | "this-year";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "this-week", label: "This Week" },
  { value: "last-week", label: "Last Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "this-quarter", label: "This Quarter" },
  { value: "this-year", label: "This Year" },
];

// ═══════════════════════════════════════════════════════════════
// DATE HELPERS
// ═══════════════════════════════════════════════════════════════

/** Count Mon-Fri working days between two dates (inclusive) */
function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const endClean = new Date(end);
  endClean.setHours(23, 59, 59, 999);
  while (d <= endClean) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Count working days that have passed up to today (for partial-period accuracy) */
function countWorkingDaysUpToToday(start: Date, end: Date): number {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const effectiveEnd = end < today ? end : today;
  return countWorkingDays(start, effectiveEnd);
}

function getDateRange(period: PeriodType) {
  const now = new Date();
  const y = now.getFullYear(),
    m = now.getMonth();
  let start: Date, end: Date;

  switch (period) {
    case "this-week": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(y, m, diff);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "last-week": {
      const day = now.getDay();
      const thisWeekStart = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(y, m, thisWeekStart - 7);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "this-month":
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      break;
    case "last-month":
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0, 23, 59, 59, 999);
      break;
    case "this-quarter": {
      const qs = Math.floor(m / 3) * 3;
      start = new Date(y, qs, 1);
      end = new Date(y, qs + 3, 0, 23, 59, 59, 999);
      break;
    }
    case "this-year":
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
      break;
    default:
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  }

  const totalWorkingDays = countWorkingDays(start, end);
  const elapsedWorkingDays = countWorkingDaysUpToToday(start, end);
  const targetHours = totalWorkingDays * PRODUCTIVE_HOURS_PER_DAY;

  // Calculate how many complete weeks are in this period
  const totalWeeks = Math.max(1, Math.ceil(totalWorkingDays / 5));

  return { start, end, totalWorkingDays, elapsedWorkingDays, targetHours, totalWeeks };
}

// ═══════════════════════════════════════════════════════════════
// TIME-ELAPSED NORMALIZATION HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate working minutes elapsed from period start until now (9 AM - 5 PM, Mon-Fri only)
 * EXCLUDES any days marked as approved leave
 */
function getWorkMinutesElapsed(periodStart: Date, now: Date, leaveDates: Set<string> = new Set()): number {
  let totalMinutes = 0;
  const current = new Date(periodStart);
  current.setHours(9, 0, 0, 0); // Start at 9 AM

  const endTime = new Date(now);
  if (endTime < periodStart) return 0;

  while (current < endTime) {
    const dow = current.getDay();
    const dayKey = current.toISOString().split("T")[0];

    // Count only Mon-Fri AND not on leave
    if (dow !== 0 && dow !== 6 && !leaveDates.has(dayKey)) {
      // Set to 9 AM of current day if not already
      const dayStart = new Date(current);
      dayStart.setHours(9, 0, 0, 0);

      // Set to 5 PM of current day or end time, whichever is earlier
      const dayEnd = new Date(current);
      dayEnd.setHours(17, 0, 0, 0);
      const effectiveEnd = dayEnd < endTime ? dayEnd : endTime;

      if (dayStart < effectiveEnd) {
        totalMinutes += (effectiveEnd.getTime() - dayStart.getTime()) / (1000 * 60);
      }
    }
    current.setDate(current.getDate() + 1);
    current.setHours(9, 0, 0, 0);
  }

  return Math.max(0, totalMinutes);
}

/**
 * Calculate expected hours worked so far in the period (9 AM - 5 PM pacing)
 * ADJUSTED for approved leave days
 */
function calculateExpectedHoursSoFar(periodStart: Date, now: Date, leaveDates: Set<string> = new Set()): number {
  const minutesElapsed = getWorkMinutesElapsed(periodStart, now, leaveDates);
  return minutesElapsed / 60;
}

/**
 * Calculate pacing score: actual vs expected at this moment
 * Returns percentage of whether they're on pace for their current point in time
 */
function calculatePacingScore(actualHours: number, expectedHoursSoFar: number): number {
  if (expectedHoursSoFar === 0) return 100; // Not started yet
  const pacing = (actualHours / expectedHoursSoFar) * 100;
  return Math.min(100, Math.max(0, Math.round(pacing)));
}

/**
 * Project total hours by end of period based on current pace
 * ADJUSTED for approved leave days: only calculates against available working days
 */
function calculateProjectedTotal(
  actualHours: number,
  workMinutesElapsed: number,
  adjustedWeeklyWorkMinutes: number, // Target minutes excluding leave days
): number {
  if (workMinutesElapsed === 0) return 0;
  const currentPace = actualHours / (workMinutesElapsed / 60);
  const projectedHours = (currentPace * adjustedWeeklyWorkMinutes) / 60;
  return Math.round(projectedHours * 10) / 10;
}

/**
 * Determine warm-up state for the viewing period
 * - If period already ended (past viewing): "final"
 * - If today is Monday of period start: "initializing" (all day)
 * - If today is Friday of period: "final"
 * - Otherwise: "active"
 */
function getWarmUpState(
  periodStart: Date,
  periodEnd: Date,
  now: Date,
  leaveDates: Set<string> = new Set(),
  totalNetHours: number = 0,
): "initializing" | "active" | "final" {
  // If we're past the period end → show final results
  if (now > periodEnd) {
    return "final";
  }

  const dow = now.getDay();
  const periodStartDow = periodStart.getDay();

  // Monday: Check if work hours logged (clocked out) → show real data
  // If no work hours yet → still initializing
  if (dow === periodStartDow && now >= periodStart) {
    if (totalNetHours > 0) {
      return "active"; // Has clocked out and logged work → show real data
    }
    return "initializing"; // No work logged yet → show calibrating
  }

  // Last day of week (Friday) = final
  if (dow === 5) {
    return "final";
  }

  // Default = active (Tuesday-Thursday)
  return "active";
}

/**
 * Calculate daily consistency score (low variance = high score)
 */
function calculateDailyConsistency(dailyHours: number[]): number {
  if (dailyHours.length <= 1) return 100;
  const validDays = dailyHours.filter((h) => h > 0);
  if (validDays.length <= 1) return 100;

  const mean = validDays.reduce((a, b) => a + b, 0) / validDays.length;
  const variance = validDays.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / validDays.length;
  const stdDev = Math.sqrt(variance);

  // Perfect consistency (0 variance) = 100, std dev > 3 = 0
  const consistencyScore = Math.max(0, 100 - (stdDev / mean) * 50);
  return Math.round(consistencyScore);
}

// ═══════════════════════════════════════════════════════════════
// SCORING ENGINE — Based on Company Policy
// ═══════════════════════════════════════════════════════════════

/**
 * SCORING FORMULA EXPLANATION (shown to admin):
 *
 * 1. Productive Hours Score (30%)
 *    Target: 7.5h net/day (breaks excluded). Score = (actual / target) × 100, capped at 100.
 *    Target is adjusted for approved leave days.
 *
 * 2. Logsheet Score (25%)
 *    Three sub-components averaged:
 *    a) Daily time logged: 6.5–7h = 100%, below 6.5h scales proportionally
 *    b) Daily entry count: 2–4 entries/day with client name required
 *    c) Monthly volume: 25–50 entries/month (calculated weekly: ~6–12/week)
 *
 * 3. Attendance Score (15%)
 *    Days present / expected working days (minus approved leave) × 100
 *
 * 4. Break Discipline (10%)
 *    30min mandatory break = no penalty.
 *    >40min total break = gradual penalty.
 *    >2 break sessions/day = penalty.
 *
 * 5. Consistency Score (10%)
 *    Low daily hours variance = high score. Measures regularity.
 *    Working 6h one day and 9h next is fine as long as weekly target met.
 *
 * 6. Logsheet Quality (10%)
 *    Checks: avg time per entry ≥ 30min, client_name filled rate.
 *
 * Final = weighted sum. Leave-adjusted: approved leave reduces expected
 * days/hours proportionally, never penalizes the employee.
 */

interface EmployeeMetrics {
  employeeId: string;
  employeeName: string;
  initials: string;
  department: string;
  jobTitle: string;
  userId: string;
  profileId: string | null;

  // Raw data
  totalNetHours: number; // Net productive hours (gross - breaks - pauses)
  totalGrossHours: number; // Clock-in to clock-out
  totalBreakMinutes: number;
  totalPauseMinutes: number;
  daysAttended: number;
  dailyNetHours: number[]; // net hours per day
  totalLogEntries: number;
  logEntriesWithClient: number;
  totalLogMinutes: number; // sum of time_spent_minutes from work_logs
  avgLogMinutesPerEntry: number;
  avgLogEntriesPerWeek: number;
  daysWithEnoughLogs: number; // days with ≥2 entries
  dailyBreakSessions: number[]; // number of break sessions per day
  daysWithExcessiveBreaks: number; // days with >2 break sessions
  leaveDaysTaken: number;

  // Adjusted targets (after subtracting approved leave)
  adjustedWorkingDays: number;
  adjustedTargetHours: number;
  adjustedWeeklyTarget: number;

  // Weekly breakdown
  weeklyHours: { week: number; hours: number; target: number; logEntries: number }[];

  // 6 dimension scores (0-100)
  productiveHoursScore: number;
  logsheetScore: number;
  attendanceScore: number;
  breakDisciplineScore: number;
  consistencyScore: number;
  logsheetQualityScore: number;
  validationScore: number;
  totalLogHours: number;
  attendanceLogRatio: number;
  untrackedHours: number;
  missingLogs: boolean;
  highAttendanceLowLogs: boolean;
  excessiveBreakUsage: boolean;
  continuousWorkValidated: boolean;
  needsReview: boolean;
  reviewTags: string[];
  positiveAlerts: string[];

  // Time-Elapsed Normalization (Pacing & Projection)
  pacingScore: number; // Actual vs Expected at current moment (0-100)
  projectedTotal: number; // Projected Friday total based on current pace
  expectedHoursSoFar: number; // What they should have by now
  warmupState: "initializing" | "active" | "final"; // Warm-up phase or final push
  dailyConsistency: number; // Variance in daily hours (0-100)
  workMinutesElapsed: number; // Total working minutes elapsed in period

  // Final
  performanceScore: number;
  status: "top" | "good" | "needs-improvement" | "underutilized" | "overloaded" | "initializing";
  trend: "up" | "down" | "same";
  alerts: string[];
  // Explanation strings for each dimension
  explanations: {
    productiveHours: string;
    logsheet: string;
    attendance: string;
    breakDiscipline: string;
    consistency: string;
    logsheetQuality: string;
    validation: string;
    pacing: string;
  };
}

function computeFinal(
  m: Omit<EmployeeMetrics, "performanceScore" | "status" | "trend" | "alerts" | "positiveAlerts">,
): Pick<EmployeeMetrics, "performanceScore" | "status" | "trend" | "alerts" | "positiveAlerts"> {
  const baseScore = Math.round(
    m.productiveHoursScore * 0.28 +
      m.logsheetScore * 0.23 +
      m.attendanceScore * 0.14 +
      m.breakDisciplineScore * 0.1 +
      m.consistencyScore * 0.1 +
      m.logsheetQualityScore * 0.1 +
      m.validationScore * 0.05,
  );

  const avgDailyHrs = m.daysAttended > 0 ? m.totalNetHours / m.daysAttended : 0;

  // ═══ PACING-AWARE SCORING ═══
  // During the week: use pacing score for real-time status
  // Friday/End of period: use actual final score
  let performanceScore = baseScore;
  let status: EmployeeMetrics["status"];

  // Warm-up period: show "initializing" status
  if (m.warmupState === "initializing") {
    performanceScore = 0; // Hide raw percentage
    status = "initializing";
  }
  // Active period: smart performance-based status
  else if (m.warmupState === "active" && m.expectedHoursSoFar > 0) {
    // Use projected score blended with current achievement
    const projectedScore = (m.projectedTotal / m.adjustedTargetHours) * 100;
    performanceScore = Math.round(m.pacingScore * 0.6 + projectedScore * 0.4);

    // ═══ SMART STATUS: Based on actual pacing performance ═══
    // If doing REALLY WELL → reward them, don't wait for Friday
    // If falling behind → warn them early so they can catch up

    if (avgDailyHrs > OVERLOAD_THRESHOLD_HOURS) {
      status = "overloaded";
    }
    // Strong performance: 90%+ pacing = they're crushing it
    else if (m.pacingScore >= 90) {
      status = "top"; // Today's performance is excellent
    }
    // Good performance: 80-89% pacing = on track and solid
    else if (m.pacingScore >= 80) {
      status = "good"; // On track, good pace
    }
    // Falling behind: 60-79% pacing = warning, 2-3 days to recover
    else if (m.pacingScore >= 60) {
      status = "needs-improvement"; // Behind but recoverable
    }
    // Very low utilization
    else if (avgDailyHrs < UNDERUTILIZED_THRESHOLD_HOURS && m.daysAttended > 1) {
      status = "underutilized"; // Very low hours
    }
    // Default
    else {
      status = "needs-improvement"; // Not on track
    }
  }
  // Final/Friday: use actual score
  else {
    if (avgDailyHrs > OVERLOAD_THRESHOLD_HOURS) status = "overloaded";
    else if (baseScore >= 85) status = "top";
    else if (baseScore >= 70) status = "good";
    else if (avgDailyHrs < UNDERUTILIZED_THRESHOLD_HOURS && m.daysAttended > 3) status = "underutilized";
    else status = "needs-improvement";
  }

  const trend: EmployeeMetrics["trend"] = baseScore >= 70 ? "up" : baseScore >= 50 ? "same" : "down";

  const negativeAlerts: string[] = [];
  const positiveAlerts: string[] = [];

  // ═══ PACING ALERTS ═══
  if (m.warmupState === "active" && m.expectedHoursSoFar > 0) {
    const minutesBehind = Math.round((m.expectedHoursSoFar - m.totalNetHours) * 60);
    const minutesAhead = Math.round((m.totalNetHours - m.expectedHoursSoFar) * 60);

    if (minutesAhead > 30) {
      positiveAlerts.push(`${(minutesAhead / 60).toFixed(1)}h ahead of schedule — maintaining strong pace`);
    } else if (minutesBehind > 30) {
      negativeAlerts.push(`${(minutesBehind / 60).toFixed(1)}h behind adjusted schedule (${m.pacingScore}% pacing)`);
    }

    // Use adjusted target (excluding leave days) for projection comparison
    const projectedGap = m.adjustedTargetHours - m.projectedTotal;
    if (Math.abs(projectedGap) > 1) {
      negativeAlerts.push(
        `Projected to deliver ${m.projectedTotal.toFixed(1)}h by end of period (adjusted target ${m.adjustedTargetHours.toFixed(1)}h after ${Math.round(m.leaveDaysTaken * PRODUCTIVE_HOURS_PER_DAY)}h leave)`,
      );
    }
  }

  // ═══ EXISTING ALERTS ═══
  if (avgDailyHrs > OVERLOAD_THRESHOLD_HOURS)
    negativeAlerts.push(
      `Avg ${avgDailyHrs.toFixed(1)}h/day — burnout risk (above ${OVERLOAD_THRESHOLD_HOURS}h threshold)`,
    );
  if (avgDailyHrs < UNDERUTILIZED_THRESHOLD_HOURS && m.daysAttended > 3)
    negativeAlerts.push(`Only ${avgDailyHrs.toFixed(1)}h/day avg — underutilized`);
  if (m.totalLogEntries === 0 && m.daysAttended > 0) {
    negativeAlerts.push("No logsheets filed this period — attendance alone is not enough.");
    if (m.attendanceScore >= 60) {
      negativeAlerts.push("High attendance with no logsheet entries is a major compliance issue.");
    }
  }
  if (m.highAttendanceLowLogs)
    negativeAlerts.push("High attendance with low logged work time — likely untracked or non-productive hours.");
  if (m.untrackedHours > 0 && m.totalLogEntries > 0)
    negativeAlerts.push(`Untracked work hours: ${m.untrackedHours}h of attendance not covered by logs.`);
  if (m.logsheetScore < 50 && m.daysAttended > 0 && m.totalLogEntries > 0)
    negativeAlerts.push("Logsheet compliance below 50% — missing daily entries or insufficient logging time");
  if (m.excessiveBreakUsage)
    negativeAlerts.push("Excessive break usage relative to attendance — verify break recording and effectiveness.");
  if (m.daysWithExcessiveBreaks > 2)
    negativeAlerts.push(`${m.daysWithExcessiveBreaks} days with >2 break sessions — exceeds company policy`);
  if (m.breakDisciplineScore < 50) negativeAlerts.push("Excessive break time — above 40min/day average");
  if (m.continuousWorkValidated)
    positiveAlerts.push("Continuous work validated: attendance and logs are aligned with low break usage.");
  if (m.validationScore >= 90 && !m.continuousWorkValidated)
    positiveAlerts.push("Strong attendance/logsheet validation — work output aligns well with attendance.");
  if (m.logEntriesWithClient >= m.totalLogEntries * 0.8 && m.totalLogEntries > 0)
    positiveAlerts.push("Strong client tagging across logsheet entries.");
  if (m.totalBreakMinutes > 0 && m.daysAttended > 0) {
    const avgBreakPerDay = m.totalBreakMinutes / m.daysAttended;
    const avgDailyHours = m.totalNetHours / m.daysAttended;
    if (avgDailyHours > PRODUCTIVE_HOURS_PER_DAY && avgBreakPerDay < MANDATORY_BREAK_MINUTES) {
      negativeAlerts.push("High hours with below-policy break time — verify break recording and rest compliance.");
    }
    if (avgDailyHours > OVERLOAD_THRESHOLD_HOURS && avgBreakPerDay < BREAK_PENALTY_THRESHOLD) {
      negativeAlerts.push("Long workdays with limited breaks may indicate continuous overtime without enough rest.");
    }
  }
  if (m.attendanceScore < 60 && m.adjustedWorkingDays > 5) negativeAlerts.push("Low attendance rate");
  if (m.logEntriesWithClient < m.totalLogEntries * 0.5 && m.totalLogEntries > 0)
    negativeAlerts.push("Client name missing in many logsheet entries");

  return {
    performanceScore: Math.min(100, Math.max(0, performanceScore)),
    status,
    trend,
    alerts: negativeAlerts,
    positiveAlerts,
  };
}

// ═══════════════════════════════════════════════════════════════
// STATUS CONFIG
// ═══════════════════════════════════════════════════════════════
const STATUS_CONFIG = {
  top: { label: "Top Performer", className: "bg-green-500/15 text-green-500 border-green-500/30", icon: "⭐" },
  good: { label: "Good", className: "bg-blue-500/15 text-blue-500 border-blue-500/30", icon: "✓" },
  "needs-improvement": {
    label: "Needs Improvement",
    className: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    icon: "⚠",
  },
  underutilized: { label: "Underutilized", className: "bg-gray-400/15 text-gray-400 border-gray-400/30", icon: "↓" },
  overloaded: { label: "Overloaded", className: "bg-red-500/15 text-red-500 border-red-500/30", icon: "🔥" },
  initializing: {
    label: "Calibrating...",
    className: "bg-purple-500/15 text-purple-500 border-purple-500/30",
    icon: "⏳",
  },
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
  explanation,
  icon,
}: {
  label: string;
  value: number;
  weight: string;
  detail: string;
  explanation?: string;
  icon: React.ReactNode;
}) {
  const [showExplanation, setShowExplanation] = useState(false);
  const color =
    value >= 85 ? "text-green-500" : value >= 70 ? "text-blue-500" : value >= 50 ? "text-amber-500" : "text-red-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium flex items-center gap-1.5">
          {icon}
          {label} <span className="text-muted-foreground font-normal">({weight})</span>
          {explanation && (
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-muted-foreground hover:text-primary transition-colors"
              title="How is this calculated?"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
        <span className={`font-mono font-bold ${color}`}>{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
      <p className="text-xs text-muted-foreground">{detail}</p>
      {showExplanation && explanation && (
        <div className="text-xs bg-muted/50 rounded-lg p-3 border border-border mt-1">{explanation}</div>
      )}
    </div>
  );
}

function WeeklyLogsheetPanel({
  weeks,
}: {
  weeks: { week: number; hours: number; target: number; logEntries: number }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const totalLogs = weeks.reduce((sum, week) => sum + week.logEntries, 0);
  const totalHours = weeks.reduce((sum, week) => sum + week.hours, 0);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <CardTitle className="font-display text-lg">Weekly Logsheet Detail</CardTitle>
        </div>
        <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)} className="gap-2">
          {expanded ? "Collapse" : "Expand"}
          <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="rounded-2xl border border-border bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">Weeks</p>
            <p className="text-xl font-semibold">{weeks.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">Total logs</p>
            <p className="text-xl font-semibold">{totalLogs}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">Total net hours</p>
            <p className="text-xl font-semibold">{totalHours.toFixed(1)}h</p>
          </div>
        </div>
        {expanded && (
          <div className="space-y-3">
            {weeks.map((week) => (
              <div key={week.week} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Week {week.week}</p>
                    <p className="text-xs text-muted-foreground">Target {week.target}h</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{week.hours}h net</p>
                    <p className="text-xs text-muted-foreground">{week.logEntries} logs</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Weekly breakdown mini-chart for employee detail */
function WeeklyBreakdown({ weeks }: { weeks: { week: number; hours: number; target: number; logEntries: number }[] }) {
  if (weeks.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" /> Weekly Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `Wk ${v}`}
              />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [
                  name === "hours" ? `${value.toFixed(1)}h` : value,
                  name === "hours" ? "Net Hours" : name === "target" ? "Target" : "Log Entries",
                ]}
              />
              <Legend />
              <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Net Hours" />
              <Bar dataKey="target" fill="hsl(var(--border))" radius={[4, 4, 0, 0]} name="Target" />
              <Bar dataKey="logEntries" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Logs" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const PerformanceMetrics = () => {
  const { isManager, isVP, isAdmin, user, isLineManager, isSupervisor } = useAuth();
  const { teamMembers } = useLineManagerAccess();
  const canManage = isManager || isVP || isAdmin;
  const isTeamView = canManage || isLineManager || isSupervisor;
  const isEmployeeView = !isTeamView;

  const [period, setPeriod] = useState<PeriodType>("this-week");
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<EmployeeMetrics[]>([]);
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedTagFilter, setSelectedTagFilter] = useState<"all" | "high-attendance" | "no-logs" | "flagged-review">(
    "all",
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [periodInfo, setPeriodInfo] = useState({
    totalWorkingDays: 0,
    elapsedWorkingDays: 0,
    targetHours: 0,
    totalWeeks: 0,
  });
  const [showFormula, setShowFormula] = useState(false);

  const { employees, loading: empLoading } = useEmployees();
  const { getStatus: getPresenceStatus, getOnlineCount } = useTeamPresence();
  const { goals, loading: goalsLoading, createGoal, updateGoal, deleteGoal, createFeedback } = usePerformanceReviews();

  const activeEmployees = useMemo(() => {
    if (isLineManager || isSupervisor) {
      // Only show assigned team for line managers/supervisors
      const teamIds = new Set(teamMembers.map((t) => t.id));
      return employees.filter((e) => e.status === "active" && teamIds.has(e.id));
    }
    return employees.filter((e) => e.status === "active");
  }, [employees, isLineManager, isSupervisor, teamMembers]);
  const activeEmployeesForDialog = useMemo(
    () => activeEmployees.map((e) => ({ id: e.id, first_name: e.first_name, last_name: e.last_name })),
    [activeEmployees],
  );

  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  // ═══════════════════════════════════════
  // FETCH & COMPUTE
  // ═══════════════════════════════════════
  const fetchMetrics = useCallback(async () => {
    if (!user || activeEmployees.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const { start, end, totalWorkingDays, elapsedWorkingDays, targetHours, totalWeeks } = getDateRange(period);
      setPeriodInfo({ totalWorkingDays, elapsedWorkingDays, targetHours, totalWeeks });
      const startISO = start.toISOString();
      const endISO = end.toISOString();
      const startDate = start.toISOString().split("T")[0];
      const endDate = end.toISOString().split("T")[0];

      // Profile → user mapping
      const profileIds = activeEmployees.map((e) => e.profile_id).filter(Boolean) as string[];
      const { data: profiles } = await supabase.from("profiles").select("id, user_id").in("id", profileIds);
      const profileToUser = new Map(profiles?.map((p) => [p.id, p.user_id]) || []);

      // Determine visible employees
      let visibleEmployees = activeEmployees;
      if (isEmployeeView) {
        visibleEmployees = activeEmployees.filter((e) => {
          const uid = e.profile_id ? profileToUser.get(e.profile_id) : null;
          return uid === user.id;
        });
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
        .select("id, user_id, clock_in, clock_out, total_break_minutes, total_pause_minutes")
        .in("user_id", userIds)
        .gte("clock_in", startISO)
        .lte("clock_in", endISO);

      // ── FETCH: Break sessions (to count sessions per day) ──
      const attLogIds = attLogs?.map((l) => l.id) || [];
      const breakSessionsMap = new Map<string, number>(); // attendance_log_id → count of break sessions
      if (attLogIds.length > 0) {
        const batchSize = 200;
        for (let i = 0; i < attLogIds.length; i += batchSize) {
          const batch = attLogIds.slice(i, i + batchSize);
          const { data: sessions } = await supabase
            .from("attendance_break_sessions")
            .select("attendance_log_id, session_type")
            .in("attendance_log_id", batch)
            .eq("session_type", "break");
          sessions?.forEach((s: { attendance_log_id: string }) => {
            const logId = s.attendance_log_id;
            breakSessionsMap.set(logId, (breakSessionsMap.get(logId) || 0) + 1);
          });
        }
      }

      // ── FETCH: Work logs (logsheets) ──
      const { data: workLogs } = await supabase
        .from("work_logs")
        .select("user_id, log_date, time_spent_minutes, task_description, client:clients(name, client_id)")
        .in("user_id", userIds)
        .gte("log_date", startDate)
        .lte("log_date", endDate);

      // ── FETCH: Approved leave ──
      const { data: leaveData } = await supabase
        .from("leave_requests")
        .select("user_id, days, start_date, end_date")
        .in("user_id", userIds)
        .eq("status", "approved")
        .lte("start_date", endDate)
        .gte("end_date", startDate);

      // ── COMPUTE per employee ──
      const results: EmployeeMetrics[] = visibleEmployees.map((emp) => {
        const uid = emp.profile_id ? profileToUser.get(emp.profile_id) || "" : "";
        const name = `${emp.first_name} ${emp.last_name}`.trim();
        const initials = `${emp.first_name?.charAt(0) || ""}${emp.last_name?.charAt(0) || ""}`.toUpperCase();

        // === LEAVE (only working days within period) ===
        const empLeaves = leaveData?.filter((l) => l.user_id === uid) || [];
        let leaveDaysTaken = 0;
        empLeaves.forEach((l) => {
          const ls = new Date(l.start_date);
          const le = new Date(l.end_date);
          const es = ls < start ? start : ls;
          const ee = le > end ? end : le;
          const d = new Date(es);
          while (d <= ee) {
            if (d.getDay() !== 0 && d.getDay() !== 6) leaveDaysTaken++;
            d.setDate(d.getDate() + 1);
          }
        });

        // Adjusted targets — leave is company policy, never penalized
        const adjustedWorkingDays = Math.max(0, elapsedWorkingDays - leaveDaysTaken);
        const adjustedTargetHours = adjustedWorkingDays * PRODUCTIVE_HOURS_PER_DAY;
        const adjustedWeeks = adjustedWorkingDays > 0 ? Math.max(1, Math.ceil(adjustedWorkingDays / 5)) : 1;
        const adjustedWeeklyTarget = adjustedWorkingDays > 0 ? (adjustedWorkingDays / 5) * PRODUCTIVE_HOURS_PER_DAY : 0;

        // === ATTENDANCE ===
        const empAtt = attLogs?.filter((l) => l.user_id === uid && l.clock_out) || [];
        const attendedDays = new Set<string>();
        const dailyNetMap = new Map<string, number>();
        const dailyGrossMap = new Map<string, number>();
        const dailyBreakMinMap = new Map<string, number>();
        const dailyBreakSessionsMap = new Map<string, number>();
        let totalNetHours = 0;
        let totalGrossHours = 0;
        let totalBreakMinutes = 0;
        let totalPauseMinutes = 0;

        empAtt.forEach((log) => {
          const cin = new Date(log.clock_in);
          const cout = new Date(log.clock_out!);
          const brk = log.total_break_minutes || 0;
          const pause = log.total_pause_minutes || 0;
          const grossHrs = Math.max(0, (cout.getTime() - cin.getTime()) / 3600000);
          const netHrs = Math.max(0, (cout.getTime() - cin.getTime() - (brk + pause) * 60000) / 3600000);

          const dayKey = cin.toISOString().split("T")[0];
          attendedDays.add(dayKey);
          dailyNetMap.set(dayKey, (dailyNetMap.get(dayKey) || 0) + netHrs);
          dailyGrossMap.set(dayKey, (dailyGrossMap.get(dayKey) || 0) + grossHrs);
          dailyBreakMinMap.set(dayKey, (dailyBreakMinMap.get(dayKey) || 0) + brk);

          // Count break sessions from break_sessions table
          const sessions = breakSessionsMap.get(log.id) || 0;
          dailyBreakSessionsMap.set(dayKey, (dailyBreakSessionsMap.get(dayKey) || 0) + sessions);

          totalNetHours += netHrs;
          totalGrossHours += grossHrs;
          totalBreakMinutes += brk;
          totalPauseMinutes += pause;
        });

        const daysAttended = attendedDays.size;
        const dailyNetHours = Array.from(dailyNetMap.values());
        const dailyBreakSessions = Array.from(dailyBreakSessionsMap.values());
        const daysWithExcessiveBreaks = dailyBreakSessions.filter((s) => s > MAX_BREAK_SESSIONS_PER_DAY).length;

        // === LOGSHEETS (WORK_LOGS) ===
        const empLogs = (workLogs?.filter((l) => l.user_id === uid) || []) as WorkLog[];
        const totalLogEntries = empLogs.length;
        const logEntriesWithClient = empLogs.filter((l) => l.client?.name && l.client.name.trim().length > 0).length;
        let totalLogMinutes = 0;
        const logsByDay = new Map<string, number>();
        const logMinutesByDay = new Map<string, number>();
        empLogs.forEach((l) => {
          logsByDay.set(l.log_date, (logsByDay.get(l.log_date) || 0) + 1);
          logMinutesByDay.set(l.log_date, (logMinutesByDay.get(l.log_date) || 0) + (l.time_spent_minutes || 0));
          totalLogMinutes += l.time_spent_minutes || 0;
        });
        const daysWithEnoughLogs = Array.from(logsByDay.values()).filter((c) => c >= MIN_LOGS_PER_DAY).length;
        const daysWithIdealLogCount = Array.from(logsByDay.values()).filter(
          (c) => c >= MIN_LOGS_PER_DAY && c <= IDEAL_LOGS_PER_DAY,
        ).length;
        const daysWithEnoughLogTime = Array.from(logMinutesByDay.values()).filter(
          (mins) => mins >= LOGSHEET_TIME_MIN_HOURS * 60,
        ).length;
        const avgLogMinutesPerEntry = totalLogEntries > 0 ? totalLogMinutes / totalLogEntries : 0;
        const clientEntryRate = totalLogEntries > 0 ? (logEntriesWithClient / totalLogEntries) * 100 : 0;
        const totalLogHours = Math.round((totalLogMinutes / 60) * 10) / 10;
        const attendanceLogRatio = totalNetHours > 0 ? Math.round((totalLogHours / totalNetHours) * 100) / 100 : 0;
        const untrackedHours = Math.max(0, Math.round((totalNetHours - totalLogHours) * 10) / 10);
        const missingLogs = totalLogEntries === 0 && daysAttended > 0;
        const highAttendanceLowLogs =
          daysAttended > 0 &&
          totalNetHours > PRODUCTIVE_HOURS_PER_DAY * daysAttended &&
          totalLogHours < totalNetHours * 0.6;
        const excessiveBreakUsage = daysAttended > 0 && totalBreakMinutes / daysAttended > BREAK_PENALTY_THRESHOLD;
        const continuousWorkValidated =
          daysAttended > 0 &&
          attendanceLogRatio >= 0.8 &&
          totalNetHours / daysAttended > PRODUCTIVE_HOURS_PER_DAY &&
          totalBreakMinutes / daysAttended < MANDATORY_BREAK_MINUTES;
        const needsReview = missingLogs || highAttendanceLowLogs || excessiveBreakUsage;
        const reviewTags = [] as string[];
        if (missingLogs) reviewTags.push("Missing Logs");
        if (highAttendanceLowLogs) reviewTags.push("Attendance/Log Mismatch");
        if (excessiveBreakUsage) reviewTags.push("Excessive Break Usage");
        if (continuousWorkValidated) reviewTags.push("Continuous Work Validated");
        if (untrackedHours > 0 && !missingLogs) reviewTags.push("Untracked Work Hours");

        // === Weekly breakdown ===
        const weeklyHours: { week: number; hours: number; target: number; logEntries: number }[] = [];
        // Group attended days into ISO weeks
        const weekMap = new Map<number, { hours: number; logs: number }>();
        Array.from(attendedDays).forEach((dayStr) => {
          const d = new Date(dayStr);
          // Simple week number within the period
          const daysSinceStart = Math.floor((d.getTime() - start.getTime()) / 86400000);
          const weekNum = Math.floor(daysSinceStart / 7) + 1;
          const entry = weekMap.get(weekNum) || { hours: 0, logs: 0 };
          entry.hours += dailyNetMap.get(dayStr) || 0;
          weekMap.set(weekNum, entry);
        });
        // Add log entries per week
        empLogs.forEach((l) => {
          const d = new Date(l.log_date);
          const daysSinceStart = Math.floor((d.getTime() - start.getTime()) / 86400000);
          const weekNum = Math.floor(daysSinceStart / 7) + 1;
          const entry = weekMap.get(weekNum) || { hours: 0, logs: 0 };
          entry.logs += 1;
          weekMap.set(weekNum, entry);
        });
        const weekNums = Array.from(weekMap.keys()).sort((a, b) => a - b);
        weekNums.forEach((wn) => {
          const w = weekMap.get(wn)!;
          weeklyHours.push({
            week: wn,
            hours: Math.round(w.hours * 10) / 10,
            target: WEEKLY_TARGET_HOURS,
            logEntries: w.logs,
          });
        });

        // ═══════════════════════════════════════
        // DIMENSION SCORES
        // ═══════════════════════════════════════

        // 1. Productive Hours Score (30%)
        // Target = adjusted working days × 7.5h
        const productiveHoursScore =
          adjustedTargetHours > 0 ? Math.min(100, Math.round((totalNetHours / adjustedTargetHours) * 100)) : 0;

        const productiveHoursExplanation = `Target: ${adjustedWorkingDays} working days × ${PRODUCTIVE_HOURS_PER_DAY}h = ${adjustedTargetHours.toFixed(1)}h. Actual net hours: ${totalNetHours.toFixed(1)}h. Score = (${totalNetHours.toFixed(1)} / ${adjustedTargetHours.toFixed(1)}) × 100 = ${productiveHoursScore}%. Breaks and pauses are excluded from net hours. Approved leave (${leaveDaysTaken} days) reduces the target.`;

        // 2. Logsheet Score (25%) — 3 sub-components
        let logTimeSub = 0;
        if (daysAttended > 0) {
          const avgLogHoursPerDay = totalLogMinutes / 60 / daysAttended;
          if (avgLogHoursPerDay >= LOGSHEET_TIME_MIN_HOURS) {
            logTimeSub = 100;
          } else {
            logTimeSub = Math.round((avgLogHoursPerDay / LOGSHEET_TIME_MIN_HOURS) * 100);
          }
        }

        let logCountSub = 0;
        if (adjustedWorkingDays > 0) {
          logCountSub = Math.min(100, Math.round((daysWithEnoughLogs / adjustedWorkingDays) * 100));
        }

        // Monthly volume: scale based on period
        // Weekly target: ~6-12 entries/week (25-50/month ÷ ~4 weeks)
        const expectedLogEntries = Math.max(
          (MONTHLY_MIN_LOGS / 20) * adjustedWorkingDays,
          MIN_LOGS_PER_DAY * adjustedWorkingDays,
        );
        const maxLogEntries = Math.min(
          (MONTHLY_MAX_LOGS / 20) * adjustedWorkingDays,
          IDEAL_LOGS_PER_DAY * adjustedWorkingDays,
        );
        const weeklyLogTarget = adjustedWeeks > 0 ? expectedLogEntries / adjustedWeeks : 0;
        const weeklyLogMax = adjustedWeeks > 0 ? Math.max(weeklyLogTarget, maxLogEntries / adjustedWeeks) : 0;
        let logVolumeSub = 0;
        if (adjustedWeeks > 0) {
          const avgLogsPerWeek = totalLogEntries / adjustedWeeks;
          if (avgLogsPerWeek >= weeklyLogTarget) {
            logVolumeSub = Math.min(100, Math.round((avgLogsPerWeek / weeklyLogMax) * 100));
            if (avgLogsPerWeek >= weeklyLogMax) logVolumeSub = 100;
          } else {
            logVolumeSub = Math.round((avgLogsPerWeek / Math.max(1, weeklyLogTarget)) * 100);
          }
        }

        const logsheetScore = Math.round((logTimeSub + logCountSub + logVolumeSub) / 3);

        const logsheetExplanation = `Three sub-scores averaged:\n• Daily time logged: avg ${daysAttended > 0 ? (totalLogMinutes / 60 / daysAttended).toFixed(1) : 0}h/day (${daysWithEnoughLogTime}/${adjustedWorkingDays} days hit ${LOGSHEET_TIME_MIN_HOURS}h) → ${logTimeSub}%\n• Daily entry count: ${daysWithEnoughLogs}/${adjustedWorkingDays} days with ≥${MIN_LOGS_PER_DAY} entries (ideal ${daysWithIdealLogCount} days with ${MIN_LOGS_PER_DAY}-${IDEAL_LOGS_PER_DAY} entries) → ${logCountSub}%\n• Weekly volume: ${totalLogEntries} total entries across ${adjustedWeeks} weeks (target: ${weeklyLogTarget.toFixed(1)}–${weeklyLogMax.toFixed(1)}/week) → ${logVolumeSub}%`;

        // 3. Attendance Score (15%)
        const attendanceScore =
          adjustedWorkingDays > 0 ? Math.min(100, Math.round((daysAttended / adjustedWorkingDays) * 100)) : 100;

        const attendanceExplanation =
          adjustedWorkingDays > 0
            ? `${daysAttended} days attended out of ${adjustedWorkingDays} expected working days (${elapsedWorkingDays} total − ${leaveDaysTaken} leave). Score = ${attendanceScore}%. Approved annual leave is never penalized — it reduces the expected days.`
            : `All ${leaveDaysTaken} working day(s) in this period were approved leave. Attendance is not penalized; score = 100%.`;

        // 4. Break Discipline (10%)
        // 30min mandatory break = NO penalty
        // >40min avg break = gradual penalty
        // >2 sessions/day = penalty
        let breakDisciplineScore = 100;
        if (daysAttended > 0) {
          const avgBreakPerDay = totalBreakMinutes / daysAttended;
          // Only penalize above 40min
          if (avgBreakPerDay > BREAK_PENALTY_THRESHOLD) {
            const excess = avgBreakPerDay - BREAK_PENALTY_THRESHOLD;
            breakDisciplineScore = Math.max(0, Math.round(100 - (excess / 20) * 25));
          }
          // Additional penalty for excessive break sessions
          if (daysWithExcessiveBreaks > 0) {
            const sessionPenalty = Math.round((daysWithExcessiveBreaks / daysAttended) * 30);
            breakDisciplineScore = Math.max(0, breakDisciplineScore - sessionPenalty);
          }
        }

        const avgBreakPerDay = daysAttended > 0 ? Math.round(totalBreakMinutes / daysAttended) : 0;
        const breakExplanation = `Mandatory 30min break is company policy — not penalized. Avg break: ${avgBreakPerDay}min/day. Penalty starts above ${BREAK_PENALTY_THRESHOLD}min. Max ${MAX_BREAK_SESSIONS_PER_DAY} break sessions/day allowed — ${daysWithExcessiveBreaks} days exceeded this. Score: ${breakDisciplineScore}%.`;

        // 5. Consistency (10%)
        // Low variance in daily hours = good. Working 6h one day and 9h next is acceptable if weekly target is met.
        let consistencyScore = 100;
        if (dailyNetHours.length >= 3) {
          const mean = dailyNetHours.reduce((a, b) => a + b, 0) / dailyNetHours.length;
          const variance = dailyNetHours.reduce((a, h) => a + Math.pow(h - mean, 2), 0) / dailyNetHours.length;
          const stdDev = Math.sqrt(variance);
          // StdDev ≤ 1.5 is acceptable (allows 6h one day, 9h next)
          // StdDev > 3 = 0 score
          if (stdDev <= 1.5) {
            consistencyScore = 100;
          } else {
            consistencyScore = Math.max(0, Math.round(100 - ((stdDev - 1.5) / 1.5) * 100));
          }
        } else if (dailyNetHours.length === 0) {
          consistencyScore = 0;
        }

        const consistencyExplanation = `Measures how regular your daily work hours are. Std deviation of daily hours: ${dailyNetHours.length >= 2 ? Math.sqrt(dailyNetHours.reduce((a, h) => a + Math.pow(h - dailyNetHours.reduce((s, v) => s + v, 0) / dailyNetHours.length, 2), 0) / dailyNetHours.length).toFixed(1) : "N/A"}h. Working 6–9h/day is acceptable. Large swings (e.g., 3h one day, 10h next) lower this score.`;

        // 6. Logsheet Quality (10%)
        // avg time per entry ≥ 30min + client_name filled
        let logsheetQualityScore = 0;
        if (totalLogEntries > 0) {
          // Time quality: avg ≥ 30min = full marks
          let timePart = 0;
          if (avgLogMinutesPerEntry >= 30) timePart = 100;
          else timePart = Math.round((avgLogMinutesPerEntry / 30) * 100);

          // Client name fill rate
          const clientRate = Math.round((logEntriesWithClient / totalLogEntries) * 100);

          logsheetQualityScore = Math.round(timePart * 0.5 + clientRate * 0.5);
        }

        const logQualityExplanation = `Two factors (50/50):\n• Avg time per entry: ${Math.round(avgLogMinutesPerEntry)}min (target: ≥30min)\n• Client name filled: ${logEntriesWithClient}/${totalLogEntries} entries (${totalLogEntries > 0 ? Math.round((logEntriesWithClient / totalLogEntries) * 100) : 0}%)`;

        const validationScore = missingLogs
          ? 0
          : highAttendanceLowLogs
            ? 40
            : excessiveBreakUsage
              ? 60
              : continuousWorkValidated
                ? 100
                : Math.min(100, Math.round(attendanceLogRatio * 100));

        const validationExplanation = missingLogs
          ? "Attendance recorded without logsheet entries — this is a negative productivity signal."
          : highAttendanceLowLogs
            ? "High attendance with low logged work time — likely untracked or non-productive hours."
            : excessiveBreakUsage
              ? "Break usage exceeds policy thresholds relative to attendance hours."
              : continuousWorkValidated
                ? "High attendance matched by logs with low break time — validated continuous work."
                : `Log hours cover ${(attendanceLogRatio * 100).toFixed(0)}% of net attendance hours.`;

        // ═══════════════════════════════════════
        // TIME-ELAPSED NORMALIZATION (Pacing & Projection)
        // ADJUSTED FOR APPROVED LEAVE — Leave days don't count against performance
        // ═══════════════════════════════════════

        // Build set of leave dates for this employee
        const leaveDates = new Set<string>();
        empLeaves.forEach((l) => {
          const ls = new Date(l.start_date);
          const le = new Date(l.end_date);
          const es = ls < start ? start : ls;
          const ee = le > end ? end : le;
          const d = new Date(es);
          while (d <= ee) {
            if (d.getDay() !== 0 && d.getDay() !== 6) {
              leaveDates.add(d.toISOString().split("T")[0]);
            }
            d.setDate(d.getDate() + 1);
          }
        });

        // Adjusted working minutes: total minus leave days (9 AM - 5 PM only)
        const adjustedWeeklyWorkMinutes = adjustedWorkingDays * PRODUCTIVE_HOURS_PER_DAY * 60; // Adjusted target

        const workMinutesElapsed = getWorkMinutesElapsed(start, new Date(), leaveDates);
        const expectedHoursSoFar = calculateExpectedHoursSoFar(start, new Date(), leaveDates);
        const pacingScore = calculatePacingScore(totalNetHours, expectedHoursSoFar);
        const projectedTotal = calculateProjectedTotal(totalNetHours, workMinutesElapsed, adjustedWeeklyWorkMinutes);
        const warmupState = getWarmUpState(start, end, new Date(), leaveDates, totalNetHours);
        const dailyConsistency = calculateDailyConsistency(dailyNetHours);

        const pacingExplanation = `Real-time pace (leave-adjusted): ${expectedHoursSoFar.toFixed(1)}h expected by now vs ${totalNetHours.toFixed(1)}h logged. Pacing: ${pacingScore}%. Approved leave: ${leaveDaysTaken}d (${leaveDaysTaken * PRODUCTIVE_HOURS_PER_DAY}h removed from target). Adjusted target: ${adjustedTargetHours.toFixed(1)}h. Projected: ${projectedTotal.toFixed(1)}h.`;

        const base = {
          employeeId: emp.id,
          employeeName: name,
          initials,
          department: emp.department || "—",
          jobTitle: emp.job_title || "Employee",
          userId: uid,
          profileId: emp.profile_id,
          totalNetHours: Math.round(totalNetHours * 10) / 10,
          totalGrossHours: Math.round(totalGrossHours * 10) / 10,
          totalBreakMinutes,
          totalPauseMinutes,
          daysAttended,
          dailyNetHours,
          totalLogEntries,
          logEntriesWithClient,
          totalLogMinutes,
          totalLogHours,
          attendanceLogRatio,
          untrackedHours,
          missingLogs,
          highAttendanceLowLogs,
          excessiveBreakUsage,
          continuousWorkValidated,
          needsReview,
          reviewTags,
          validationScore,
          avgLogMinutesPerEntry: Math.round(avgLogMinutesPerEntry),
          avgLogEntriesPerWeek: Math.round(totalLogEntries / adjustedWeeks),
          daysWithEnoughLogs,
          dailyBreakSessions,
          daysWithExcessiveBreaks,
          leaveDaysTaken,
          adjustedWorkingDays,
          adjustedTargetHours: Math.round(adjustedTargetHours * 10) / 10,
          adjustedWeeklyTarget,
          weeklyHours,
          productiveHoursScore,
          logsheetScore,
          attendanceScore,
          breakDisciplineScore,
          consistencyScore,
          logsheetQualityScore,
          // Pacing & Projection
          pacingScore,
          projectedTotal,
          expectedHoursSoFar,
          warmupState,
          dailyConsistency,
          workMinutesElapsed,
          explanations: {
            productiveHours: productiveHoursExplanation,
            logsheet: logsheetExplanation,
            attendance: attendanceExplanation,
            breakDiscipline: breakExplanation,
            consistency: consistencyExplanation,
            logsheetQuality: logQualityExplanation,
            validation: validationExplanation,
            pacing: pacingExplanation,
          },
        };

        return { ...base, ...computeFinal(base) };
      });

      results.sort((a, b) => b.performanceScore - a.performanceScore);
      setMetrics(results);
    } catch (err) {
      console.error("Performance metrics fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, activeEmployees, period, isEmployeeView]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Real-time performance updates for Tue-Thu
  useEffect(() => {
    const now = new Date();
    const dow = now.getDay();
    const hour = now.getHours();

    // Only enable real-time polling on Tue-Thu during work hours (9 AM - 5 PM)
    const isTueThu = dow >= 2 && dow <= 4; // 2=Tue, 3=Wed, 4=Thu
    const isDuringWorkHours = hour >= 9 && hour < 17;
    const isActiveState = metrics.some((m) => m.warmupState === "active");

    if (isTueThu && isDuringWorkHours && isActiveState) {
      // Refresh metrics every 30 seconds for real-time updates
      const interval = setInterval(() => {
        fetchMetrics();
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [fetchMetrics, metrics]);

  // ═══════════════════════════════════════
  // DERIVED
  // ═══════════════════════════════════════
  const departments = useMemo(() => {
    const d = new Set(metrics.map((m) => m.department).filter((d) => d !== "—"));
    return Array.from(d).sort();
  }, [metrics]);

  const filtered = useMemo(() => {
    return metrics.filter((m) => {
      const deptMatch = selectedDept === "All" || m.department === selectedDept;
      if (!deptMatch) return false;

      switch (selectedTagFilter) {
        case "high-attendance":
          return m.daysAttended > 0 && m.totalNetHours / m.daysAttended > OVERLOAD_THRESHOLD_HOURS;
        case "no-logs":
          return m.daysAttended > 0 && m.totalLogEntries === 0;
        case "flagged-review":
          return m.needsReview || m.alerts.length > 0;
        case "all":
        default:
          return true;
      }
    });
  }, [metrics, selectedDept, selectedTagFilter]);

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
            avgHoursScore: Math.round(members.reduce((s, m) => s + m.productiveHoursScore, 0) / members.length),
            avgLogsheet: Math.round(members.reduce((s, m) => s + m.logsheetScore, 0) / members.length),
            totalAlerts: members.reduce((s, m) => s + m.alerts.length, 0),
            topCount: members.filter((m) => m.status === "top").length,
          };
        })
        .filter(Boolean),
    [departments, metrics],
  );

  const kpis = useMemo(() => {
    if (metrics.length === 0)
      return {
        avgScore: 0,
        avgNetHours: 0,
        avgLogsheet: 0,
        topPerformers: 0,
        needsAttention: 0,
        totalAlerts: 0,
        totalLogEntries: 0,
        total: 0,
      };
    // Use filtered data (respects department filter) for KPIs
    const dataSource = selectedDept === "All" ? metrics : filtered;
    const n = dataSource.length;
    return {
      avgScore: Math.round(dataSource.reduce((s, m) => s + m.performanceScore, 0) / n),
      avgNetHours: Math.round((dataSource.reduce((s, m) => s + m.totalNetHours, 0) / n) * 10) / 10,
      avgLogsheet: Math.round(dataSource.reduce((s, m) => s + m.logsheetScore, 0) / n),
      topPerformers: dataSource.filter((m) => m.status === "top").length,
      needsAttention: dataSource.filter((m) => m.performanceScore < 50).length,
      totalAlerts: dataSource.reduce((s, m) => s + m.alerts.length, 0),
      totalLogEntries: dataSource.reduce((s, m) => s + m.totalLogEntries, 0),
      total: n,
    };
  }, [metrics, filtered, selectedDept]);

  const selected = selectedEmployeeId ? metrics.find((m) => m.employeeId === selectedEmployeeId) : null;
  const empGoals = selected ? goals.filter((g) => g.employee_id === selected.employeeId) : [];

  const validationSummary = useMemo(() => {
    const flagged = metrics.filter((m) => m.needsReview || m.alerts.length > 0).length;
    const noLogs = metrics.filter((m) => m.daysAttended > 0 && m.totalLogEntries === 0).length;
    const highAttendance = metrics.filter(
      (m) => m.daysAttended > 0 && m.totalNetHours / m.daysAttended > OVERLOAD_THRESHOLD_HOURS,
    ).length;
    return { flagged, noLogs, highAttendance };
  }, [metrics]);

  const radarData = useMemo(() => {
    const source = selected ? [selected] : selectedDept === "All" ? filtered : filtered;
    if (!source.length) return [];
    const avg = (fn: (s: (typeof source)[0]) => number) =>
      Math.round(source.reduce((a, s) => a + fn(s), 0) / source.length);
    return [
      { metric: "Productive Hrs", value: avg((s) => s.productiveHoursScore) },
      { metric: "Logsheets", value: avg((s) => s.logsheetScore) },
      { metric: "Attendance", value: avg((s) => s.attendanceScore) },
      { metric: "Break Disc.", value: avg((s) => s.breakDisciplineScore) },
      { metric: "Log Quality", value: avg((s) => s.logsheetQualityScore) },
      { metric: "Consistency", value: avg((s) => s.consistencyScore) },
    ];
  }, [filtered, selected, selectedDept]);

  const barData = useMemo(() => {
    // Determine if we're showing pacing (real-time) or final scores
    const showPacing = metrics.some((m) => m.warmupState !== "final");

    // Use filtered data (respects department + tag filters) sorted by actual hours worked
    const dataSource = selectedDept === "All" ? metrics : filtered;
    const sortedEmployees = [...dataSource].sort((a, b) => {
      // Sort by actual hours worked (descending) - shows who's most active
      return b.totalNetHours - a.totalNetHours;
    });

    return sortedEmployees.map((m) => {
      // Show pacing score for active/initializing, final score for past periods
      const scoreToShow = showPacing && m.warmupState !== "final" ? m.pacingScore : m.performanceScore;

      return {
        name: m.employeeName.split(" ")[0],
        score: scoreToShow,
        hours: m.totalNetHours, // Show actual hours worked
        logs: m.totalLogEntries,
      };
    });
  }, [metrics, filtered, selectedDept]);

  // Chart title based on what data is being shown
  const chartTitle = useMemo(() => {
    const showPacing = metrics.some((m) => m.warmupState !== "final");
    return showPacing ? "Live Pacing Rankings" : "Performance Rankings";
  }, [metrics]);

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
  // FORMULA EXPLANATION CARD
  // ═══════════════════════════════════════
  const FormulaCard = () => (
    <Card className="mb-6 border-primary/20">
      <CardHeader className="cursor-pointer" onClick={() => setShowFormula(!showFormula)}>
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          How is Performance Score Calculated?
          <ChevronRight className={`h-4 w-4 ml-auto transition-transform ${showFormula ? "rotate-90" : ""}`} />
        </CardTitle>
      </CardHeader>
      {showFormula && (
        <CardContent className="text-sm space-y-3 text-muted-foreground">
          <p>The performance score is a weighted average of 6 dimensions based on company policy:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="font-medium text-foreground">1. Productive Hours (30%)</p>
              <p>
                Net hours worked (excluding breaks/pauses) vs target of {PRODUCTIVE_HOURS_PER_DAY}h/day. Adjusted for
                approved leave.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="font-medium text-foreground">2. Logsheet Compliance (25%)</p>
              <p>
                Avg of: daily log time ({LOGSHEET_TIME_MIN_HOURS}–{LOGSHEET_TIME_MAX_HOURS}h target), daily entries (≥
                {MIN_LOGS_PER_DAY}), weekly volume ({Math.round(MONTHLY_MIN_LOGS / 4)}–
                {Math.round(MONTHLY_MAX_LOGS / 4)}/week).
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="font-medium text-foreground">3. Attendance (15%)</p>
              <p>Days present ÷ expected working days. Leave reduces expected days (never penalized).</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="font-medium text-foreground">4. Break Discipline (10%)</p>
              <p>
                {MANDATORY_BREAK_MINUTES}min mandatory break = no penalty. &gt;{BREAK_PENALTY_THRESHOLD}min or &gt;
                {MAX_BREAK_SESSIONS_PER_DAY} sessions/day = penalty.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="font-medium text-foreground">5. Consistency (10%)</p>
              <p>Low daily hours variance = high score. 6–9h/day is fine. Large swings lower the score.</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="font-medium text-foreground">6. Logsheet Quality (10%)</p>
              <p>Avg time per entry (≥30min ideal) + client name fill rate.</p>
            </div>
          </div>
          <p className="text-xs mt-2">
            <strong>Period info:</strong> {periodInfo.totalWorkingDays} total working days (Mon-Fri) ·{" "}
            {periodInfo.elapsedWorkingDays} elapsed · Weekly target: {WEEKLY_TARGET_HOURS}h
          </p>
        </CardContent>
      )}
    </Card>
  );

  // ═══════════════════════════════════════
  // EMPLOYEE DETAIL VIEW
  // ═══════════════════════════════════════
  if (selected) {
    const s = selected;
    const cfg = STATUS_CONFIG[s.status];
    const emp = activeEmployees.find((e) => e.id === s.employeeId);
    const presence = emp ? getPresenceStatus(emp.id) : "offline";
    const avgDailyHrs = s.daysAttended > 0 ? (s.totalNetHours / s.daysAttended).toFixed(1) : "0";
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

        {s.warmupState === "initializing" ? (
          // Monday: Calibrating state - simplified view
          <Card className="mb-6 border-purple-500/30 bg-purple-500/5">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <div className="text-4xl mb-4">⏳</div>
                <h3 className="text-lg font-display font-semibold text-purple-600 dark:text-purple-400 mb-2">
                  Performance Calibrating...
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Week just started. Detailed metrics will appear as the week progresses. Employee is logging work
                  normally.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Tue-Fri: Show full metrics
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <KPICard
                title="Net Hours"
                value={`${s.totalNetHours}h`}
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
                value={s.totalLogEntries.toString()}
                subtitle={`${s.logEntriesWithClient} with client · ${s.daysWithEnoughLogs}/${s.adjustedWorkingDays}d compliant`}
                icon={<BookOpen className="h-5 w-5 text-blue-500" />}
                iconBg="bg-blue-500/10"
                delay={160}
              />
              <KPICard
                title="Attendance"
                value={`${s.daysAttended}/${s.adjustedWorkingDays}`}
                subtitle={`${s.attendanceScore}% · ${s.leaveDaysTaken}d leave`}
                icon={<CheckCircle2 className="h-5 w-5 text-amber-500" />}
                iconBg="bg-amber-500/10"
                delay={190}
              />
              <KPICard
                title="Weekly Logs"
                value={`${s.avgLogEntriesPerWeek}/wk`}
                subtitle={`Target ${Math.round(MONTHLY_MIN_LOGS / 4)}–${Math.round(MONTHLY_MAX_LOGS / 4)}/week`}
                icon={<BookOpen className="h-5 w-5 text-sky-500" />}
                iconBg="bg-sky-500/10"
                delay={220}
              />
              <KPICard
                title="Avg Break"
                value={`${avgBreakPerDay}m`}
                subtitle={`${s.daysWithExcessiveBreaks}d with >2 sessions`}
                icon={<Coffee className="h-5 w-5 text-orange-500" />}
                iconBg="bg-orange-500/10"
                delay={250}
              />
              <KPICard
                title="Leave"
                value={`${s.leaveDaysTaken}d`}
                subtitle="Approved (not penalized)"
                icon={<Calendar className="h-5 w-5 text-purple-500" />}
                iconBg="bg-purple-500/10"
                delay={280}
              />
            </div>

            <div className="mb-6">
              <WeeklyLogsheetPanel weeks={s.weeklyHours} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 6-Dimension Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" /> Score Breakdown
                    <span className="text-xs text-muted-foreground font-normal ml-1">(click ⓘ for formula)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <DimensionBar
                    label="Productive Hours"
                    value={s.productiveHoursScore}
                    weight="30%"
                    detail={`${s.totalNetHours}h net / ${s.adjustedTargetHours}h target (${s.adjustedWorkingDays}d × ${PRODUCTIVE_HOURS_PER_DAY}h)`}
                    explanation={s.explanations.productiveHours}
                    icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                  />
                  <DimensionBar
                    label="Logsheet Compliance"
                    value={s.logsheetScore}
                    weight="25%"
                    detail={`${s.daysWithEnoughLogs}/${s.adjustedWorkingDays}d with ≥${MIN_LOGS_PER_DAY} entries · ${s.totalLogEntries} total`}
                    explanation={s.explanations.logsheet}
                    icon={<BookOpen className="h-3.5 w-3.5 text-muted-foreground" />}
                  />
                  <DimensionBar
                    label="Attendance"
                    value={s.attendanceScore}
                    weight="15%"
                    detail={`${s.daysAttended}/${s.adjustedWorkingDays} days (${s.leaveDaysTaken}d leave excluded)`}
                    explanation={s.explanations.attendance}
                    icon={<CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />}
                  />
                  <DimensionBar
                    label="Break Discipline"
                    value={s.breakDisciplineScore}
                    weight="10%"
                    detail={`Avg ${avgBreakPerDay}min/day · ${s.daysWithExcessiveBreaks}d with >2 sessions`}
                    explanation={s.explanations.breakDiscipline}
                    icon={<Coffee className="h-3.5 w-3.5 text-muted-foreground" />}
                  />
                  <DimensionBar
                    label="Logsheet Quality"
                    value={s.logsheetQualityScore}
                    weight="10%"
                    detail={`Avg ${s.avgLogMinutesPerEntry}min/entry · ${s.logEntriesWithClient}/${s.totalLogEntries} with client`}
                    explanation={s.explanations.logsheetQuality}
                    icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                  />
                  <DimensionBar
                    label="Consistency"
                    value={s.consistencyScore}
                    weight="10%"
                    detail="Daily hours regularity (6–9h/day is OK)"
                    explanation={s.explanations.consistency}
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
          </>
        )}

        {/* Weekly Breakdown */}
        <div className="mb-6">
          <WeeklyBreakdown weeks={s.weeklyHours} />
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Attendance vs Logsheet Validation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="rounded-2xl border border-border bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Net Attendance Hours</p>
                <p className="text-xl font-semibold">{s.totalNetHours}h</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Logged Work Hours</p>
                <p className="text-xl font-semibold">{s.totalLogHours}h</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Untracked Hours</p>
                <p className="text-xl font-semibold">{s.untrackedHours}h</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Validation Score</p>
                <p className="text-xl font-semibold">{s.validationScore}%</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Attendance/Log Ratio</p>
                <p className="text-lg font-semibold">{Math.round(s.attendanceLogRatio * 100)}%</p>
                <p className="text-xs text-muted-foreground mt-2">Higher means logs cover attendance reliably.</p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Break / Pause</p>
                <p className="text-lg font-semibold">{Math.round(s.totalBreakMinutes + s.totalPauseMinutes)}m</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Breaks: {s.totalBreakMinutes}m · Pauses: {s.totalPauseMinutes}m
                </p>
              </div>
            </div>
            {s.reviewTags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {s.reviewTags.map((tag) => (
                  <Badge
                    key={tag}
                    className={`text-sm ${tag === "Missing Logs" || tag === "Attendance/Log Mismatch" ? "bg-red-500/15 text-red-500 border-red-500/30" : tag === "Excessive Break Usage" ? "bg-amber-500/15 text-amber-500 border-amber-500/30" : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"}`}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts */}
        {(s.alerts.length > 0 || s.positiveAlerts.length > 0) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" /> Performance Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {s.positiveAlerts.length > 0 && (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-emerald-700 font-medium">
                    <span>✅</span>
                    <span>Positive Validation</span>
                  </div>
                  <div className="space-y-2">
                    {s.positiveAlerts.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200"
                      >
                        <span>✔️</span>
                        <span className="text-sm text-emerald-700">{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {s.alerts.length > 0 && (
                <div className="rounded-2xl border border-red-500/30 bg-red-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-red-700 font-medium">
                    <span>🚨</span>
                    <span>Negative Alerts</span>
                  </div>
                  <div className="space-y-2">
                    {s.alerts.map((a, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                        <span>⚠️</span>
                        <span className="text-sm text-red-700">{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
          <h1 className="heading-page font-display font-bold">
            {isEmployeeView ? "My Performance" : "Performance Command Center"}
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            {isEmployeeView ? (
              "Your performance metrics based on company policy"
            ) : (
              <>
                {metrics.length} employees · {periodInfo.elapsedWorkingDays}/{periodInfo.totalWorkingDays} working days
                elapsed
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

      {/* Formula explanation */}
      <FormulaCard />

      {/* KPI Cards */}
      {isEmployeeView && metrics[0] ? (
        <>
          {metrics[0].warmupState === "initializing" ? (
            // Employee view on Monday: Calibrating state
            <Card className="mb-6 border-purple-500/30 bg-purple-500/5">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">⏳</div>
                  <h3 className="text-lg font-display font-semibold text-purple-600 dark:text-purple-400 mb-2">
                    Your Performance is Calibrating...
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Week just started. Detailed metrics will appear as the week progresses. Keep up the good work!
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Tue-Fri: Show full metrics
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KPICard
                  delay={100}
                  title="My Score"
                  value={metrics[0].performanceScore.toString()}
                  subtitle={STATUS_CONFIG[metrics[0].status].label}
                  icon={<Award className="h-5 w-5 text-primary" />}
                  iconBg="bg-primary/10"
                />
                <KPICard
                  delay={130}
                  title="Net Hours"
                  value={`${metrics[0].totalNetHours}h`}
                  subtitle={`of ${metrics[0].adjustedTargetHours}h target (${metrics[0].adjustedWorkingDays}d × ${PRODUCTIVE_HOURS_PER_DAY}h)`}
                  icon={<Clock className="h-5 w-5 text-green-500" />}
                  iconBg="bg-green-500/10"
                />
                <KPICard
                  delay={160}
                  title="Logsheets"
                  value={`${metrics[0].daysWithEnoughLogs}/${metrics[0].adjustedWorkingDays}`}
                  subtitle={`${metrics[0].totalLogEntries} entries · ${metrics[0].logEntriesWithClient} with client`}
                  icon={<BookOpen className="h-5 w-5 text-blue-500" />}
                  iconBg="bg-blue-500/10"
                />
                <KPICard
                  delay={190}
                  title="Attendance"
                  value={`${metrics[0].daysAttended} days`}
                  subtitle={`${metrics[0].attendanceScore}% · ${metrics[0].leaveDaysTaken}d leave (OK)`}
                  icon={<CheckCircle2 className="h-5 w-5 text-amber-500" />}
                  iconBg="bg-amber-500/10"
                />
              </div>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Weekly Logsheet Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg logs per week</p>
                      <p className="text-xl font-semibold">{metrics[0].avgLogEntriesPerWeek}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Weeks in period</p>
                      <p className="text-xl font-semibold">{metrics[0].weeklyHours.length}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Target: {Math.round(MONTHLY_MIN_LOGS / 4)}–{Math.round(MONTHLY_MAX_LOGS / 4)} logs/week · Net
                    target: {WEEKLY_TARGET_HOURS}h/week
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </>
      ) : !isEmployeeView ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <KPICard
            delay={100}
            title="Avg Score"
            value={kpis.avgScore.toString()}
            subtitle="Weighted composite"
            icon={<Award className="h-5 w-5 text-primary" />}
            iconBg="bg-primary/10"
          />
          <KPICard
            delay={120}
            title="Avg Net Hours"
            value={`${kpis.avgNetHours}h`}
            subtitle={`Target: ${periodInfo.targetHours}h (${periodInfo.totalWorkingDays}d × ${PRODUCTIVE_HOURS_PER_DAY}h)`}
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
        <>
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
          <div className="flex gap-2 flex-wrap mb-4">
            <Button
              size="sm"
              variant={selectedTagFilter === "all" ? "default" : "outline"}
              onClick={() => setSelectedTagFilter("all")}
            >
              All Cases
            </Button>
            <Button
              size="sm"
              variant={selectedTagFilter === "high-attendance" ? "default" : "outline"}
              onClick={() => setSelectedTagFilter("high-attendance")}
            >
              High Attendance
            </Button>
            <Button
              size="sm"
              variant={selectedTagFilter === "no-logs" ? "default" : "outline"}
              onClick={() => setSelectedTagFilter("no-logs")}
            >
              No Logs
            </Button>
            <Button
              size="sm"
              variant={selectedTagFilter === "flagged-review" ? "default" : "outline"}
              onClick={() => setSelectedTagFilter("flagged-review")}
            >
              Flagged Review
            </Button>
          </div>
        </>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="goals">Goals ({goals.length})</TabsTrigger>
          {!isEmployeeView && <TabsTrigger value="alerts">Alerts ({kpis.totalAlerts})</TabsTrigger>}
        </TabsList>

        {/* ════════ OVERVIEW ════════ */}
        <TabsContent value="overview" className="space-y-6">
          {/* Employee self-view */}
          {isEmployeeView && metrics[0] && (
            <>
              {metrics[0].warmupState === "initializing" ? (
                // Monday: Already shown calibrating message in KPI cards section
                <p className="text-sm text-muted-foreground text-center py-6">
                  Detailed metrics will populate as the week progresses.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="font-display text-lg flex items-center gap-2">
                          <Zap className="h-5 w-5 text-primary" /> Score Breakdown
                          <span className="text-xs text-muted-foreground font-normal">(click ⓘ for details)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <DimensionBar
                          label="Productive Hours"
                          value={metrics[0].productiveHoursScore}
                          weight="30%"
                          detail={`${metrics[0].totalNetHours}h / ${metrics[0].adjustedTargetHours}h`}
                          explanation={metrics[0].explanations.productiveHours}
                          icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                        />
                        <DimensionBar
                          label="Logsheet Compliance"
                          value={metrics[0].logsheetScore}
                          weight="25%"
                          detail={`${metrics[0].daysWithEnoughLogs}/${metrics[0].adjustedWorkingDays}d with ≥${MIN_LOGS_PER_DAY} entries`}
                          explanation={metrics[0].explanations.logsheet}
                          icon={<BookOpen className="h-3.5 w-3.5 text-muted-foreground" />}
                        />
                        <DimensionBar
                          label="Attendance"
                          value={metrics[0].attendanceScore}
                          weight="15%"
                          detail={`${metrics[0].daysAttended}/${metrics[0].adjustedWorkingDays} days`}
                          explanation={metrics[0].explanations.attendance}
                          icon={<CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />}
                        />
                        <DimensionBar
                          label="Break Discipline"
                          value={metrics[0].breakDisciplineScore}
                          weight="10%"
                          detail={`${metrics[0].daysAttended > 0 ? Math.round(metrics[0].totalBreakMinutes / metrics[0].daysAttended) : 0}min avg`}
                          explanation={metrics[0].explanations.breakDiscipline}
                          icon={<Coffee className="h-3.5 w-3.5 text-muted-foreground" />}
                        />
                        <DimensionBar
                          label="Logsheet Quality"
                          value={metrics[0].logsheetQualityScore}
                          weight="10%"
                          detail={`${metrics[0].avgLogMinutesPerEntry}min/entry · ${metrics[0].logEntriesWithClient}/${metrics[0].totalLogEntries} with client`}
                          explanation={metrics[0].explanations.logsheetQuality}
                          icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                        />
                        <DimensionBar
                          label="Consistency"
                          value={metrics[0].consistencyScore}
                          weight="10%"
                          detail="Daily hours regularity"
                          explanation={metrics[0].explanations.consistency}
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
                  {/* Weekly breakdown for self-view */}
                  <WeeklyBreakdown weeks={metrics[0].weeklyHours} />
                </>
              )}
            </>
          )}

          {/* Team/Admin view */}
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
                                <p className="text-xs text-muted-foreground">Hours</p>
                                <p className="text-sm font-bold">{d.avgHoursScore}%</p>
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
                            </div>
                          </CardContent>
                        </Card>
                      ),
                  )}
                </div>
              )}

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Hide bar chart on Monday (initializing), show only on active/final */}
                {metrics.some((m) => m.warmupState !== "initializing") && (
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="font-display text-lg flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" /> {chartTitle}
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
                              <Bar
                                dataKey="score"
                                fill="hsl(var(--primary))"
                                radius={[4, 4, 0, 0]}
                                name={chartTitle.includes("Pacing") ? "Pacing %" : "Score"}
                              />
                              <Bar
                                dataKey="hours"
                                fill="hsl(142, 76%, 36%)"
                                radius={[4, 4, 0, 0]}
                                name={chartTitle.includes("Pacing") ? "Actual Hours %" : "Hours %"}
                              />
                              <Bar dataKey="logs" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Logsheet %" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-12">No data</p>
                      )}
                    </CardContent>
                  </Card>
                )}
                <Card className={metrics.some((m) => m.warmupState !== "initializing") ? "" : "lg:col-span-3"}>
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
                            <th className="pb-2 font-medium text-center hidden sm:table-cell">Net Hrs</th>
                            <th className="pb-2 font-medium text-center hidden md:table-cell">Logs</th>
                            <th className="pb-2 font-medium text-center hidden md:table-cell">Attend.</th>
                            <th className="pb-2 font-medium text-center hidden lg:table-cell">Break</th>
                            <th className="pb-2 font-medium text-center hidden lg:table-cell">Leave</th>
                            <th className="pb-2 font-medium text-center hidden sm:table-cell">Status</th>
                            <th className="pb-2 font-medium text-center hidden md:table-cell">Review</th>
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
                                {/* ═══ MONDAY (Initializing): Hide details ═══ */}
                                {m.warmupState === "initializing" ? (
                                  <>
                                    <td colSpan={8} className="py-3 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <div className="animate-pulse flex gap-1">
                                          <div className="h-2 w-2 rounded-full bg-primary/60"></div>
                                          <div className="h-2 w-2 rounded-full bg-primary/40"></div>
                                          <div className="h-2 w-2 rounded-full bg-primary/20"></div>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                          Calibrating Performance...
                                        </span>
                                      </div>
                                    </td>
                                  </>
                                ) : m.warmupState === "active" ? (
                                  // ═══ TUESDAY-THURSDAY (Active): Show pacing only ═══
                                  <>
                                    <td className="py-3 text-center">
                                      <Badge
                                        className={`text-[11px] ${m.pacingScore >= 90 ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" : m.pacingScore >= 80 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : m.pacingScore >= 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"}`}
                                      >
                                        {m.pacingScore}%
                                      </Badge>
                                    </td>
                                    <td className="py-3 text-center hidden sm:table-cell">
                                      <span className="text-xs font-medium">{m.projectedTotal}h</span>
                                      <span className="text-xs text-muted-foreground block">proj.</span>
                                    </td>
                                    <td colSpan={5} className="py-3 text-center hidden md:table-cell">
                                      <Badge className={`${cfg.className} border text-[10px]`}>
                                        {cfg.icon} {cfg.label}
                                      </Badge>
                                    </td>
                                  </>
                                ) : (
                                  // ═══ FRIDAY/PAST (Final): Show all details ═══
                                  <>
                                    <td className="py-3 text-center">
                                      <ScoreBadge score={m.performanceScore} />
                                    </td>
                                    <td className="py-3 text-center hidden sm:table-cell">
                                      <span className="text-xs">
                                        {m.totalNetHours}h{" "}
                                        <span className="text-muted-foreground">/ {m.adjustedTargetHours}h</span>
                                      </span>
                                    </td>
                                    <td className="py-3 text-center hidden md:table-cell">
                                      <span className="text-xs">
                                        {m.totalLogEntries} ({m.logEntriesWithClient}c)
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
                                      <span className="text-xs">{m.leaveDaysTaken}d</span>
                                    </td>
                                    <td className="py-3 text-center hidden sm:table-cell">
                                      <Badge className={`${cfg.className} border text-[10px]`}>
                                        {cfg.icon} {cfg.label}
                                      </Badge>
                                    </td>
                                  </>
                                )}
                                {m.warmupState !== "initializing" && (
                                  <td className="py-3 text-center hidden md:table-cell">
                                    <div className="flex justify-center gap-1 flex-wrap">
                                      {m.reviewTags.slice(0, 2).map((tag) => (
                                        <Badge
                                          key={tag}
                                          className={`text-[10px] ${tag === "Missing Logs" || tag === "Attendance/Log Mismatch" ? "bg-red-500/15 text-red-500 border-red-500/30" : tag === "Excessive Break Usage" ? "bg-amber-500/15 text-amber-500 border-amber-500/30" : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"}`}
                                        >
                                          {tag}
                                        </Badge>
                                      ))}
                                      {m.reviewTags.length > 2 && (
                                        <Badge className="text-[10px] bg-muted/10 border text-muted-foreground">
                                          +{m.reviewTags.length - 2}
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
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
                    {metrics.filter((m) => m.status === "top").length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No top performers yet</p>
                    )}
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
                            {m.alerts.length > 0 ? m.alerts[0].split("—")[0] : m.department}
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
                      <Flame className="h-4 w-4 text-red-500" /> Burnout Risk (&gt;{OVERLOAD_THRESHOLD_HOURS}h/day avg)
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
                              <span className="text-xs text-muted-foreground">{m.totalNetHours}h</span>
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
                {metrics.filter((m) => m.alerts.length > 0 || m.positiveAlerts.length > 0).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                    <p className="text-lg font-medium">No active alerts</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {metrics
                      .filter((m) => m.alerts.length > 0 || m.positiveAlerts.length > 0)
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
                          {m.positiveAlerts.length > 0 && (
                            <div className="mb-2 ml-10 space-y-2">
                              {m.positiveAlerts.map((a, i) => (
                                <div
                                  key={`pos-${i}`}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200"
                                >
                                  <span>✔️</span>
                                  <span className="text-sm text-emerald-700">{a}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {m.alerts.length > 0 && (
                            <div className="mb-4 ml-10 space-y-2">
                              {m.alerts.map((a, i) => (
                                <div
                                  key={`neg-${i}`}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200"
                                >
                                  <span>🚨</span>
                                  <span className="text-sm text-red-700">{a}</span>
                                </div>
                              ))}
                            </div>
                          )}
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
