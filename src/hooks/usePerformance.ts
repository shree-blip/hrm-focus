import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ---- Types ----

export type PeriodType = "this-week" | "this-month" | "last-month" | "this-quarter" | "this-year" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface EmployeeScore {
  employeeId: string;
  employeeName: string;
  initials: string;
  department: string;
  jobTitle: string;
  profileId: string | null;
  userId: string | null;
  /** Attendance-based: worked_hours / expected_hours × 100 */
  utilization: number;
  /** % of tasks delivered on or before due date */
  taskDelivery: number;
  /** Average of review dimension ratings scaled to 100 */
  qualityScore: number;
  /** Attendance punctuality: days on-time / total days × 100 */
  reliability: number;
  /** Weighted composite: util 35% + task 35% + quality 20% + reliability 10% */
  performanceScore: number;
  /** Task counts */
  tasksTotal: number;
  tasksCompleted: number;
  tasksOnTime: number;
  /** Attendance */
  hoursWorked: number;
  expectedHours: number;
  daysWorked: number;
  /** Review ratings (1-5 scale, null if no reviews) */
  avgQuality: number | null;
  avgCommunication: number | null;
  avgOwnership: number | null;
  avgCollaboration: number | null;
  /** "up" | "down" | "same" trend based on score > 70 */
  trend: "up" | "down" | "same";
}

export interface PerformanceKPIs {
  avgUtilization: number;
  avgTaskDelivery: number;
  avgScore: number;
  totalTasksCompleted: number;
  topPerformers: number; // score >= 80
  totalEmployees: number;
}

export interface MonthlyTrend {
  month: string;
  utilization: number;
  taskDelivery: number;
  score: number;
}

// ---- Helpers ----

export function getDateRangeFromPeriod(period: PeriodType): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "this-week": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      const start = new Date(y, m, diff);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case "this-month":
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59, 999) };
    case "last-month":
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) };
    case "this-quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return { start: new Date(y, qStart, 1), end: new Date(y, qStart + 3, 0, 23, 59, 59, 999) };
    }
    case "this-year":
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59, 999) };
    default:
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59, 999) };
  }
}

/** Standard work hours per day */
const STANDARD_HOURS_PER_DAY = 8;

function getWorkingDaysInRange(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++; // Mon-Fri
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function getInitials(first: string, last: string): string {
  return `${first?.charAt(0) || ""}${last?.charAt(0) || ""}`.toUpperCase();
}

// ---- Hook ----

export function usePerformance(period: PeriodType = "this-month", customRange?: DateRange) {
  const { user, isManager, isVP, isAdmin, role, isLineManager, isSupervisor } = useAuth();
  const [scores, setScores] = useState<EmployeeScore[]>([]);
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => {
    if (period === "custom" && customRange) return customRange;
    return getDateRangeFromPeriod(period);
  }, [period, customRange]);

  const fetchPerformance = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    try {
      const startISO = dateRange.start.toISOString();
      const endISO = dateRange.end.toISOString();
      const workingDays = getWorkingDaysInRange(dateRange.start, dateRange.end);
      const expectedHours = workingDays * STANDARD_HOURS_PER_DAY;

      // ---- 1.  Determine visible employees based on role ----
      const hasOrgWideAccess = isVP || isAdmin || role === "manager";

      let employeesQuery = supabase
        .from("employees")
        .select("id, first_name, last_name, email, department, job_title, profile_id, manager_id, line_manager_id, status")
        .eq("status", "active");

      // For non-org-wide users: find their employee record first
      if (!hasOrgWideAccess) {
        // Get current user's profile → employee
        const { data: myProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!myProfile) { setScores([]); setLoading(false); return; }

        const { data: myEmployee } = await supabase
          .from("employees")
          .select("id")
          .eq("profile_id", myProfile.id)
          .single();

        if (!myEmployee) { setScores([]); setLoading(false); return; }

        if (isLineManager || isSupervisor) {
          // See direct reports + self
          employeesQuery = employeesQuery.or(
            `manager_id.eq.${myEmployee.id},line_manager_id.eq.${myEmployee.id},id.eq.${myEmployee.id}`
          );
        } else {
          // Regular employee sees only self
          employeesQuery = employeesQuery.eq("id", myEmployee.id);
        }
      }

      const { data: employees, error: empError } = await employeesQuery;
      if (empError || !employees?.length) { setScores([]); setLoading(false); return; }

      // Map profile_id → user_id for attendance queries
      const profileIds = employees.map(e => e.profile_id).filter(Boolean) as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, user_id")
        .in("id", profileIds);
      const profileToUser = new Map(profiles?.map(p => [p.id, p.user_id]) || []);

      const userIds = employees
        .map(e => e.profile_id ? profileToUser.get(e.profile_id) : null)
        .filter(Boolean) as string[];

      // ---- 2.  Fetch attendance logs in range ----
      let attendanceQuery = supabase
        .from("attendance_logs")
        .select("user_id, clock_in, clock_out, total_break_minutes, total_pause_minutes")
        .gte("clock_in", startISO)
        .lte("clock_in", endISO);

      if (userIds.length > 0) {
        attendanceQuery = attendanceQuery.in("user_id", userIds);
      }

      const { data: attLogs } = await attendanceQuery;

      // Build per-user attendance stats
      const attMap = new Map<string, { hours: number; days: Set<string> }>();
      attLogs?.forEach(log => {
        if (!log.clock_out) return;
        const uid = log.user_id;
        const clockIn = new Date(log.clock_in);
        const clockOut = new Date(log.clock_out);
        const breakMin = log.total_break_minutes || 0;
        const pauseMin = log.total_pause_minutes || 0;
        const hrs = Math.max(0,
          (clockOut.getTime() - clockIn.getTime() - (breakMin + pauseMin) * 60000) / 3600000
        );
        if (!attMap.has(uid)) attMap.set(uid, { hours: 0, days: new Set() });
        const entry = attMap.get(uid)!;
        entry.hours += hrs;
        entry.days.add(clockIn.toISOString().split("T")[0]);
      });

      // ---- 3.  Fetch tasks (assigned via task_assignees or assignee_id) ----
      const { data: allTasks } = await supabase
        .from("tasks")
        .select("id, assignee_id, status, due_date, created_at");

      const { data: allAssignees } = await supabase
        .from("task_assignees")
        .select("task_id, user_id");

      // Build per-user task stats within date range
      type TaskStats = { total: number; completed: number; onTime: number };
      const taskMap = new Map<string, TaskStats>();

      const userIdSet = new Set(userIds);
      const assigneeByTask = new Map<string, string[]>();
      allAssignees?.forEach(a => {
        const list = assigneeByTask.get(a.task_id) || [];
        list.push(a.user_id);
        assigneeByTask.set(a.task_id, list);
      });

      // Map profile_id to user_id for assignee_id matching (assignee_id is profile_id)
      const profileIdToUserId = new Map<string, string>();
      employees.forEach(e => {
        const uid = e.profile_id ? profileToUser.get(e.profile_id) : null;
        if (e.profile_id && uid) profileIdToUserId.set(e.profile_id, uid);
      });

      allTasks?.forEach(task => {
        const taskCreated = new Date(task.created_at);
        // Only count tasks created within or due within the date range
        const taskDue = task.due_date ? new Date(task.due_date) : null;
        const inRange = (taskCreated >= dateRange.start && taskCreated <= dateRange.end) ||
          (taskDue && taskDue >= dateRange.start && taskDue <= dateRange.end);
        if (!inRange) return;

        // Find which user(s) this is assigned to
        const assignedUsers: string[] = [];
        // Direct assignee_id (which is profile_id)
        if (task.assignee_id) {
          const uid = profileIdToUserId.get(task.assignee_id);
          if (uid) assignedUsers.push(uid);
        }
        // task_assignees (user_ids)
        const fromAssignees = assigneeByTask.get(task.id) || [];
        fromAssignees.forEach(uid => {
          if (!assignedUsers.includes(uid)) assignedUsers.push(uid);
        });

        assignedUsers.forEach(uid => {
          if (!userIdSet.has(uid)) return;
          if (!taskMap.has(uid)) taskMap.set(uid, { total: 0, completed: 0, onTime: 0 });
          const stats = taskMap.get(uid)!;
          stats.total++;
          if (task.status === "done") {
            stats.completed++;
            // On-time if no due_date or completed (we assume "done" was before or on due)
            if (!task.due_date || new Date(task.due_date) >= taskCreated) {
              stats.onTime++;
            }
          }
        });
      });

      // ---- 4.  Fetch performance reviews in range ----
      const { data: reviews } = await supabase
        .from("performance_reviews" as any)
        .select("employee_id, quality_rating, communication_rating, ownership_rating, collaboration_rating, final_score, status")
        .gte("period_start", dateRange.start.toISOString().split("T")[0])
        .lte("period_end", dateRange.end.toISOString().split("T")[0]);

      // Build per-employee review averages
      type ReviewAvg = { quality: number[]; communication: number[]; ownership: number[]; collaboration: number[] };
      const reviewMap = new Map<string, ReviewAvg>();
      (reviews as any[])?.forEach((r: any) => {
        if (r.status === "draft") return; // only count submitted/acknowledged
        const eid = r.employee_id;
        if (!reviewMap.has(eid)) reviewMap.set(eid, { quality: [], communication: [], ownership: [], collaboration: [] });
        const entry = reviewMap.get(eid)!;
        if (r.quality_rating) entry.quality.push(r.quality_rating);
        if (r.communication_rating) entry.communication.push(r.communication_rating);
        if (r.ownership_rating) entry.ownership.push(r.ownership_rating);
        if (r.collaboration_rating) entry.collaboration.push(r.collaboration_rating);
      });

      // ---- 5.  Compute per-employee scores ----
      const result: EmployeeScore[] = employees.map(emp => {
        const uid = emp.user_id || (emp.profile_id ? profileToUser.get(emp.profile_id) : null) || "";

        // Attendance / Utilization
        const att = attMap.get(uid) || { hours: 0, days: new Set<string>() };
        const utilization = expectedHours > 0
          ? Math.min(Math.round((att.hours / expectedHours) * 100), 100)
          : 0;

        // Task delivery
        const ts = taskMap.get(uid) || { total: 0, completed: 0, onTime: 0 };
        const taskDelivery = ts.total > 0
          ? Math.round((ts.onTime / ts.total) * 100)
          : 0;

        // Quality from reviews (scale 1-5 → 0-100)
        const rv = reviewMap.get(emp.id);
        const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        const avgQ = avg(rv?.quality || []);
        const avgComm = avg(rv?.communication || []);
        const avgOwn = avg(rv?.ownership || []);
        const avgCol = avg(rv?.collaboration || []);

        const allRatings = [avgQ, avgComm, avgOwn, avgCol].filter(v => v !== null) as number[];
        const qualityScore = allRatings.length > 0
          ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length / 5) * 100)
          : 0; // If no reviews, quality contributes 0

        // Reliability = days attended / working days
        const reliability = workingDays > 0
          ? Math.min(Math.round((att.days.size / workingDays) * 100), 100)
          : 0;

        // Weighted composite
        const performanceScore = Math.round(
          utilization * 0.35 +
          taskDelivery * 0.35 +
          qualityScore * 0.20 +
          reliability * 0.10
        );

        const trend: "up" | "down" | "same" = performanceScore >= 70 ? "up" : performanceScore >= 50 ? "same" : "down";

        return {
          employeeId: emp.id,
          employeeName: `${emp.first_name} ${emp.last_name}`,
          initials: getInitials(emp.first_name, emp.last_name),
          department: emp.department || "—",
          jobTitle: emp.job_title || "Employee",
          profileId: emp.profile_id,
          userId: uid,
          utilization,
          taskDelivery,
          qualityScore,
          reliability,
          performanceScore,
          tasksTotal: ts.total,
          tasksCompleted: ts.completed,
          tasksOnTime: ts.onTime,
          hoursWorked: Math.round(att.hours * 10) / 10,
          expectedHours,
          daysWorked: att.days.size,
          avgQuality: avgQ,
          avgCommunication: avgComm,
          avgOwnership: avgOwn,
          avgCollaboration: avgCol,
          trend,
        };
      });

      // Sort by performance score descending
      result.sort((a, b) => b.performanceScore - a.performanceScore);
      setScores(result);
    } catch (err) {
      console.error("Performance fetch error:", err);
      setScores([]);
    } finally {
      setLoading(false);
    }
  }, [user, isManager, isVP, isAdmin, role, isLineManager, isSupervisor, dateRange]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  // ---- Computed KPIs ----
  const kpis = useMemo<PerformanceKPIs>(() => {
    if (scores.length === 0) return {
      avgUtilization: 0, avgTaskDelivery: 0, avgScore: 0,
      totalTasksCompleted: 0, topPerformers: 0, totalEmployees: 0,
    };
    const n = scores.length;
    return {
      avgUtilization: Math.round(scores.reduce((s, e) => s + e.utilization, 0) / n),
      avgTaskDelivery: Math.round(scores.reduce((s, e) => s + e.taskDelivery, 0) / n),
      avgScore: Math.round(scores.reduce((s, e) => s + e.performanceScore, 0) / n),
      totalTasksCompleted: scores.reduce((s, e) => s + e.tasksCompleted, 0),
      topPerformers: scores.filter(e => e.performanceScore >= 80).length,
      totalEmployees: n,
    };
  }, [scores]);

  return { scores, kpis, loading, dateRange, refetch: fetchPerformance };
}
