import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2 } from "lucide-react";
import { calendarEntries } from "@/components/dashboard/CompanyCalendar";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { toast } from "@/hooks/use-toast";

/** Special leave entitlements (days) — fixed company policy. */
const SPECIAL_LEAVES = [
  { key: "wedding", label: "Wedding Leave", cap: 15, match: /wedding/i },
  { key: "bereavement", label: "Bereavement Leave", cap: 15, match: /bereave|funeral|mourn/i },
  { key: "maternity", label: "Maternity Leave", cap: 98, match: /maternity/i },
  { key: "paternity", label: "Paternity Leave", cap: 22, match: /paternity/i },
] as const;

type DayCode = "P" | "A" | "HD" | "NR" | "H" | "WH" | "LL";

interface Row {
  name: string;
  email: string;
  gender: string | null;
  days: Record<string, DayCode>;
  presentCount: number;
  absentCount: number;
  halfDayCount: number;
  lieuCount: number;
  unpaidLeaveDays: number;
  paidLeaveDays: number;
  totalLeaveTaken: number;
  totalPresentCount: number;
  workingDays: number;
  annualBalance: number;
  annualEntitlement: number;
  special: Record<string, number>;
  adjustedPresent: number;
  paidLeaveRemaining: number;
  specialRemaining: Record<string, number>;
  deductDays: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Approved leave is unpaid when the reason carries an unpaid/payroll tag. */
const isUnpaidReason = (reason: string | null) => {
  const m = /\[(Payroll|Paid Leave|Unpaid Leave)\]/i.exec(reason || "");
  return !!m && m[1].toLowerCase() !== "paid leave";
};
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const csvCell = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function PayrollAttendanceLeaveTab() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const { events: calendarEvents } = useCalendarEvents();

  const [year, monthIdx] = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return [y, (m || 1) - 1];
  }, [month]);

  const daysInMonth = useMemo(() => new Date(year, monthIdx + 1, 0).getDate(), [year, monthIdx]);
  const dayKeys = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => keyOf(year, monthIdx, i + 1)),
    [year, monthIdx, daysInMonth],
  );

  // Non-working days (weekends handled separately) from the company calendar.
  // Female-only holidays (e.g. Haritalika Teej) are tracked separately so they
  // only count as a holiday for female employees.
  const isFemaleOnly = (label: string) => /female\s*only/i.test(label || "");

  const { holidaySet, femaleHolidaySet } = useMemo(() => {
    const set = new Set<string>();
    const femaleSet = new Set<string>();
    const nonWorking = new Set(["holiday", "company_leave", "non_working", "leave"]);
    calendarEntries.forEach((e) => {
      if (!nonWorking.has(e.type)) return;
      const k = keyOf(e.date.getFullYear(), e.date.getMonth(), e.date.getDate());
      (isFemaleOnly((e as any).name) ? femaleSet : set).add(k);
    });
    (calendarEvents || []).forEach((ev: any) => {
      if (!nonWorking.has(ev.event_type)) return;
      (isFemaleOnly(ev.title) ? femaleSet : set).add(ev.event_date);
    });
    return { holidaySet: set, femaleHolidaySet: femaleSet };
  }, [calendarEvents]);

  // Auditable working-days breakdown for the selected month: weekdays (Mon–Fri)
  // minus only the holidays actually present in the company calendar.
  const workingDaysInfo = useMemo(() => {
    const names = new Map<string, string>();
    const femaleNames = new Map<string, string>();
    calendarEntries.forEach((e) => {
      if (!["holiday", "company_leave", "non_working", "leave"].includes(e.type)) return;
      const k = keyOf(e.date.getFullYear(), e.date.getMonth(), e.date.getDate());
      (isFemaleOnly((e as any).name) ? femaleNames : names).set(k, (e as any).name);
    });
    (calendarEvents || []).forEach((ev: any) => {
      if (!["holiday", "company_leave", "non_working", "leave"].includes(ev.event_type)) return;
      (isFemaleOnly(ev.title) ? femaleNames : names).set(ev.event_date, ev.title);
    });

    let weekdays = 0;
    const holidays: string[] = [];
    const femaleHolidays: string[] = [];
    dayKeys.forEach((k, i) => {
      const dow = new Date(year, monthIdx, i + 1).getDay();
      if (dow === 0 || dow === 6) return;
      weekdays++;
      if (names.has(k)) holidays.push(`${k} ${names.get(k)}`);
      else if (femaleNames.has(k)) femaleHolidays.push(`${k} ${femaleNames.get(k)}`);
    });

    return {
      weekdays,
      holidays,
      femaleHolidays,
      working: weekdays - holidays.length,
      workingFemale: weekdays - holidays.length - femaleHolidays.length,
    };
  }, [calendarEvents, dayKeys, year, monthIdx]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const startIso = new Date(Date.UTC(year, monthIdx, 1)).toISOString();
      const endIso = new Date(Date.UTC(year, monthIdx + 1, 0, 23, 59, 59, 999)).toISOString();
      const startKey = dayKeys[0];
      const endKey = dayKeys[dayKeys.length - 1];

      // Fiscal year (Jul–Jun) that this reporting month belongs to.
      const fyEndYear = monthIdx >= 6 ? year + 1 : year;

      const [profilesRes, employeesRes, leavesRes] = await Promise.all([
        supabase.from("profiles").select("id, user_id, first_name, last_name, email"),
        supabase
          .from("employees")
          .select(
            "id, profile_id, first_name, last_name, email, status, employment_type, gender, hire_date, probation_start_date, probation_end_date"
          ),
        supabase
          .from("leave_requests")
          .select("user_id, start_date, end_date, leave_type, is_half_day, status")
          .select("user_id, start_date, end_date, leave_type, is_half_day, status, reason")
          .eq("status", "approved")
          .lte("start_date", endKey)
          .gte("end_date", startKey),
      ]);

      // Attendance logs (paged so large months are never truncated).
      const logs: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data } = await supabase
          .from("attendance_logs")
          .select("user_id, clock_in")
          .gte("clock_in", startIso)
          .lte("clock_in", endIso)
          .range(from, from + pageSize - 1);
        logs.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }

      const profiles = profilesRes.data || [];
      const employees = (employeesRes.data || []).filter((e: any) => e.status !== "inactive");
      const profileById = new Map(profiles.map((p: any) => [p.id, p]));

      const people = employees
        .map((e: any) => {
          const p = e.profile_id ? profileById.get(e.profile_id) : null;
          return {
            user_id: p?.user_id || null,
            name: `${e.first_name} ${e.last_name}`.trim(),
            email: e.email,
            gender: (e.gender as string | null) || null,
            employment_type: (e.employment_type as string | null) || null,
            probation_start_date: (e as any).probation_start_date || (e as any).hire_date || null,
            probation_end_date: (e as any).probation_end_date || null,
          };
        })
        .filter((p) => !!p.user_id)
        .sort((a, b) => a.name.localeCompare(b.name));

      const userIds = people.map((p) => p.user_id as string);

      // ---- Probation / intern pooled paid-leave entitlement -------------------
      // Probation staff accrue 1 paid day per probation month but may use the whole
      // pool at once (e.g. all 3 days in month 1). Later months then have nothing
      // left, so those absences flow into payroll deductions.
      const probationInfo: Record<string, { pool: number; startKey: string }> = {};
      people.forEach((p) => {
        if (p.employment_type !== "probation" && p.employment_type !== "intern") return;
        const uid = p.user_id as string;
        const ps = p.probation_start_date ? String(p.probation_start_date).slice(0, 10) : null;
        if (!ps) {
          probationInfo[uid] = { pool: 3, startKey: "0000-00-00" };
          return;
        }
        const [psy, psm] = ps.split("-").map(Number);
        let months = 3;
        if (p.probation_end_date) {
          const [pey, pem] = String(p.probation_end_date).slice(0, 10).split("-").map(Number);
          months = Math.max(1, (pey - psy) * 12 + (pem - psm) + 1);
        }
        probationInfo[uid] = { pool: months, startKey: ps };
      });

      // Paid regular leave already consumed from the pool BEFORE this report month.
      const priorPoolUsed: Record<string, number> = {};
      const probationUserIds = Object.keys(probationInfo);
      if (probationUserIds.length > 0) {
        const earliest = probationUserIds.reduce(
          (min, uid) => (probationInfo[uid].startKey < min ? probationInfo[uid].startKey : min),
          "9999-12-31"
        );
        const { data: priorLeaves } = await supabase
          .from("leave_requests")
          .select("user_id, start_date, end_date, leave_type, is_half_day, reason")
          .in("user_id", probationUserIds)
          .eq("status", "approved")
          .lt("start_date", startKey)
          .gte("end_date", earliest);
        (priorLeaves || []).forEach((r: any) => {
          const info = probationInfo[r.user_id];
          if (!info) return;
          if (isUnpaidReason(r.reason)) return;
          if (SPECIAL_LEAVES.some((s) => s.match.test(r.leave_type || ""))) return;
          if (/lieu|comp(ensatory)?\s*off/i.test(r.leave_type || "")) return;
          const [sy, sm, sd] = String(r.start_date).split("-").map(Number);
          const [ey, em, ed] = String(r.end_date).split("-").map(Number);
          const cur = new Date(sy, sm - 1, sd);
          const end = new Date(ey, em - 1, ed);
          while (cur <= end) {
            const k = keyOf(cur.getFullYear(), cur.getMonth(), cur.getDate());
            const dow = cur.getDay();
            if (k >= info.startKey && k < startKey && dow !== 0 && dow !== 6) {
              priorPoolUsed[r.user_id] =
                (priorPoolUsed[r.user_id] || 0) + (r.is_half_day ? 0.5 : 1);
            }
            cur.setDate(cur.getDate() + 1);
          }
        });
      }

      const balanceMap: Record<string, { total: number; used: number }> = {};
      if (userIds.length > 0) {
        const { data: balances } = await supabase
          .from("leave_balances")
          .select("user_id, total_days, used_days")
          .in("user_id", userIds)
          .eq("year", fyEndYear)
          .eq("leave_type", "Annual Leave");
        (balances || []).forEach((b: any) => {
          balanceMap[b.user_id] = {
            total: Number(b.total_days || 0),
            used: Number(b.used_days || 0),
          };
        });
      }

      // Worked dates per user
      const workedMap: Record<string, Set<string>> = {};
      logs.forEach((l) => {
        if (!l.clock_in) return;
        const d = new Date(l.clock_in);
        const k = keyOf(d.getFullYear(), d.getMonth(), d.getDate());
        (workedMap[l.user_id] ||= new Set()).add(k);
      });

      // Leave dates per user, split into regular vs special leave.
      // `half` keeps the RAW half-day units requested on that date (0.5 each, never
      // capped) so the "Half day count" column reflects every half day taken, while
      // `amount` is the capped day value (max 1) used for the day code / absent count.
      const leaveMap: Record<
        string,
        Record<string, { amount: number; half: number; unpaid: number; special: string | null; lieu: boolean }>
      > = {};
      (leavesRes.data || []).forEach((r: any) => {
        const special = SPECIAL_LEAVES.find((s) => s.match.test(r.leave_type || ""))?.key || null;
        // Leave in lieu (compensatory off for weekend/holiday work).
        const isLieu = /lieu|comp(ensatory)?\s*off/i.test(r.leave_type || "");
        // Unpaid ("[Unpaid Leave]"/"[Payroll]") leave never consumes the paid balance.
        const unpaid = isUnpaidReason(r.reason);
        const [sy, sm, sd] = String(r.start_date).split("-").map(Number);
        const [ey, em, ed] = String(r.end_date).split("-").map(Number);
        const cur = new Date(sy, sm - 1, sd);
        const end = new Date(ey, em - 1, ed);
        while (cur <= end) {
          const k = keyOf(cur.getFullYear(), cur.getMonth(), cur.getDate());
          if (k >= startKey && k <= endKey) {
            const byUser = (leaveMap[r.user_id] ||= {});
            const existing = byUser[k];
            const add = r.is_half_day ? 0.5 : 1;
            byUser[k] = {
              amount: Math.min(1, (existing?.amount || 0) + add),
              half: (existing?.half || 0) + (r.is_half_day ? 0.5 : 0),
              unpaid: Math.min(1, (existing?.unpaid || 0) + (unpaid ? add : 0)),
              special: existing?.special || special,
              lieu: Boolean(existing?.lieu || isLieu),
            };
          }
          cur.setDate(cur.getDate() + 1);
        }
      });

      const countWorkingDays = (extraHolidays: Set<string>) => {
        let n = 0;
        dayKeys.forEach((k, i) => {
          const dow = new Date(year, monthIdx, i + 1).getDay();
          if (dow !== 0 && dow !== 6 && !holidaySet.has(k) && !extraHolidays.has(k)) n++;
        });
        return n;
      };
      const emptySet = new Set<string>();

      const built: Row[] = people.map((p) => {
        const uid = p.user_id as string;
        const isFemale = (p.gender || "").toLowerCase() === "female";
        const extraHolidays = isFemale ? femaleHolidaySet : emptySet;
        const workingDays = countWorkingDays(extraHolidays);
        const worked = workedMap[uid] || new Set<string>();
        const leaves = leaveMap[uid] || {};
        const days: Record<string, DayCode> = {};
        let presentCount = 0;
        let absentCount = 0;
        // Half days are accumulated in day units: each half day = 0.5.
        // halfDayCount = every half day taken (reported column).
        // halfPresentCredit = only halves on HD-coded days (half worked, half off).
        let halfDayCount = 0;
        let halfPresentCredit = 0;
        let lieuCount = 0;
        // Raw regular (non-special, non-lieu) leave units taken: full day = 1,
        // half day = 0.5. This is the authoritative "total leave taken" value.
        let regularLeaveUnits = 0;
        // Leave days explicitly marked unpaid — these never consume the paid
        // balance and always end up as payroll deductions.
        let unpaidLeaveDays = 0;
        const special: Record<string, number> = {};

        dayKeys.forEach((k, i) => {
          const dow = new Date(year, monthIdx, i + 1).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isHoliday = holidaySet.has(k) || extraHolidays.has(k);
          const leaveHere = leaves[k];
          // Leave in lieu taken → LL, on any day (incl. weekend/holiday).
          if (leaveHere?.lieu) {
            days[k] = "LL";
            lieuCount++;
            return;
          }
          // Worked on a weekend or public holiday → still shown as Present.
          if ((isWeekend || isHoliday) && worked.has(k)) {
            days[k] = "P";
            presentCount++;
            return;
          }
          if (isWeekend) {
            days[k] = "WH";
            return;
          }
          if (isHoliday) {
            days[k] = "H";
            return;
          }
          const leave = leaves[k];
          if (leave) {
            if (leave.special) special[leave.special] = (special[leave.special] || 0) + leave.amount;
            else {
              unpaidLeaveDays += Math.min(leave.unpaid, leave.amount);
              regularLeaveUnits += leave.amount;
            }
            halfDayCount += leave.half;
            if (leave.amount < 1) {
              days[k] = "HD";
              halfPresentCredit += leave.half;
            } else {
              days[k] = "A";
              absentCount++;
            }
            return;
          }
          if (worked.has(k)) {
            days[k] = "P";
            presentCount++;
            return;
          }
          days[k] = "NR";
        });

        const specialTotal = Object.values(special).reduce((a, b) => a + b, 0);
        void specialTotal;
        // Regular leave units remain the basis for paid/unpaid balance coverage.
        const regularLeave = Math.round(Math.max(0, regularLeaveUnits) * 10) / 10;
        // Reporting rule: Total Leave Taken = full absent days + all half-day units.
        // Keep this separate from the date-capped balance calculation above so
        // three full absences plus three half days always reports as 4.5.
        const totalLeaveTaken = Math.round((absentCount + halfDayCount) * 10) / 10;
        // Paid portion of regular leave (unpaid-tagged days are excluded).
        const paidRegularLeave = Math.max(0, regularLeave - unpaidLeaveDays);
        const totalPresentCount = presentCount + halfPresentCredit;
        const bal = balanceMap[uid];
        // Intern / probation staff accrue 1 paid leave day per month, so their
        // monthly report must be judged against that monthly allowance instead of
        // the aggregate fiscal-year balance (which may already be exhausted).
        const pool = probationInfo[uid];
        const isMonthlyAccrual = !!pool;
        // Probation / intern: show the full probation entitlement while any of the
        // carried pool remains. Once prior paid leave has exhausted that pool, the
        // report must show 0 (for example Richard). Current-month paid leave is
        // deducted from the displayed entitlement (for example Ashmita: 3 - 2 = 1).
        const probationEntitlement = isMonthlyAccrual
          ? (priorPoolUsed[uid] || 0) >= pool.pool
            ? 0
            : pool.pool
          : 0;
        // Balance available at the start of this reporting month.
        const availableBefore = isMonthlyAccrual
          ? probationEntitlement
          : bal
          ? Math.max(0, bal.total - bal.used + paidRegularLeave)
          : 0;
        // Remaining balance after this month's leave usage.
        // All employment types: entitlement - total PAID leave taken = remaining.
        // Unpaid leave is reported separately and must not reduce paid entitlement.
        const remainingNow = Math.round(Math.max(0, availableBefore - paidRegularLeave) * 10) / 10;
        // This month's paid leave days are subtracted from the displayed entitlement
        // to give "Paid leave remaining". Once the carried pool was already spent in
        // prior months, entitlement remains 0 and further leave is unpaid.
        const annualEntitlement = Math.round(availableBefore * 10) / 10;

        const covered = Math.min(paidRegularLeave, availableBefore);
        const uncovered = regularLeave - covered;

        const specialRemaining: Record<string, number> = {};
        let specialCovered = 0;
        SPECIAL_LEAVES.forEach((s) => {
          const used = special[s.key] || 0;
          specialCovered += Math.min(used, s.cap);
          specialRemaining[s.key] = Math.max(0, s.cap - used);
        });

        // Total present days after adjustment = actual present days (incl. half days)
        // + paid leave days covered by the annual balance + special leave days within cap.
        // Uncovered (unpaid) leave days are simply NOT added — subtracting them again
        // would double-penalise the employee.
        // Leave-in-lieu days are compensatory time off already earned by working a
        // weekend/holiday, so they count as present days (never a payroll deduction).
        const adjustedPresent = Math.min(
          workingDays,
          totalPresentCount + covered + specialCovered + lieuCount
        );
        void uncovered;
        const paidLeaveRemaining = remainingNow;
        // Unpaid leave always deducts from payroll — it can never be offset by the
        // remaining paid balance. Other gaps (NR / uncovered days) may still be
        // absorbed by the remaining paid leave balance.
        const otherGap = Math.max(
          0,
          workingDays - adjustedPresent - unpaidLeaveDays - paidLeaveRemaining
        );
        const deductDays = Math.round((otherGap + unpaidLeaveDays) * 10) / 10;

        return {
          name: p.name,
          email: p.email,
          gender: p.gender,
          days,
          presentCount,
          absentCount,
          halfDayCount,
          lieuCount,
          unpaidLeaveDays,
          paidLeaveDays: Math.round(paidRegularLeave * 10) / 10,
          totalLeaveTaken,
          totalPresentCount,
          workingDays,
          annualBalance: remainingNow,
          annualEntitlement,
          special,
          adjustedPresent,
          paidLeaveRemaining,
          specialRemaining,
          deductDays,
        };
      });

      if (!cancelled) {
        setRows(built);
        setLoading(false);
      }
    };

    load().catch((e) => {
      console.error("[payroll-report] load failed", e);
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [year, monthIdx, dayKeys, holidaySet, femaleHolidaySet]);

  const monthLabel = new Date(year, monthIdx, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const handleExport = () => {
    if (rows.length === 0) {
      toast({ title: "Nothing to export", description: "No employee data for this period." });
      return;
    }

    const dayNums = dayKeys.map((_, i) => i + 1);
    const dayNames = dayKeys.map((_, i) =>
      new Date(year, monthIdx, i + 1).toLocaleDateString("en-US", { weekday: "long" }),
    );

    const header1 = [
      "Date",
      ...dayNums.map(String),
      "",
      "",
      "Present count",
      "Absent Count",
      "Half day count",
      "Leave in Lieu taken",
      "Unpaid leave days",
      "Total paid leave days",
      "Total Leave taken",
      "Total Present Count",
      "Working Days",
      "Annual Paid Leave (entitlement)",
      ...SPECIAL_LEAVES.map((s) => s.label),
      "Total Present days after Adjustment",
      "Paid leave remaining",
      ...SPECIAL_LEAVES.map((s) => `Remaining Balance ${s.label}`),
      "Deduct days from payroll",
    ];
    const header2 = [
      "Name",
      ...dayNames,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ...SPECIAL_LEAVES.map(() => ""),
      "",
      "",
      ...SPECIAL_LEAVES.map(() => ""),
      "",
    ];

    let csv = header1.map(csvCell).join(",") + "\n";
    csv += header2.map(csvCell).join(",") + "\n";

    rows.forEach((r) => {
      const exportedTotalLeaveTaken = Math.round((r.absentCount + r.halfDayCount) * 10) / 10;
      const line = [
        r.name,
        ...dayKeys.map((k) => r.days[k]),
        "",
        "",
        r.presentCount,
        r.absentCount,
        r.halfDayCount,
        r.lieuCount,
        r.unpaidLeaveDays,
        r.paidLeaveDays,
        exportedTotalLeaveTaken,
        r.totalPresentCount,
        r.workingDays,
        r.annualEntitlement,
        ...SPECIAL_LEAVES.map((s) => r.special[s.key] || 0),
        r.adjustedPresent,
        r.paidLeaveRemaining,
        ...SPECIAL_LEAVES.map((s) => r.specialRemaining[s.key]),
        r.deductDays,
      ];
      csv += line.map(csvCell).join(",") + "\n";
    });

    csv += "\n";
    csv += csvCell("Note:") + "\n";
  csv += csvCell("P = Present, A = Absent (full day leave), HD = Half day, NR = Non recorded, WH = Weekend Holiday (Sat/Sun), H = Public Holiday, LL = Leave in Lieu taken (compensatory off for weekend/holiday work)") + "\n";
    csv += csvCell("Total Present days after Adjustment = Total Present Count + paid leave covered by balance + special leave within cap + leave in lieu (unpaid leave days are excluded)") + "\n";
    csv += csvCell("Deduct days from payroll = Working Days - Total Present days after Adjustment - Paid leave remaining") + "\n";
    csv +=
      csvCell(
        `Working days for ${monthLabel} = ${workingDaysInfo.weekdays} weekdays (Mon-Fri) - ${workingDaysInfo.holidays.length} calendar holiday(s) = ${workingDaysInfo.working}`,
      ) + "\n";
    if (workingDaysInfo.holidays.length)
      csv += csvCell(`Calendar holidays: ${workingDaysInfo.holidays.join("; ")}`) + "\n";
    if (workingDaysInfo.femaleHolidays.length)
      csv +=
        csvCell(
          `Female-only holidays (working days ${workingDaysInfo.workingFemale} for female employees): ${workingDaysInfo.femaleHolidays.join("; ")}`,
        ) + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-leave-attendance-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export ready", description: `Payroll, leave & attendance report for ${monthLabel}.` });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Payroll, Leave & Attendance Balance</CardTitle>
          <CardDescription>Day-wise attendance codes with leave balances and payroll deduction — {monthLabel}</CardDescription>
          <CardDescription className="mt-1">
            Working days: {workingDaysInfo.working} ({workingDaysInfo.weekdays} weekdays Mon–Fri
            {workingDaysInfo.holidays.length > 0 && <> − {workingDaysInfo.holidays.length} calendar holiday(s)</>})
            {workingDaysInfo.femaleHolidays.length > 0 && (
              <> · female employees: {workingDaysInfo.workingFemale} ({workingDaysInfo.femaleHolidays.join(", ")})</>
            )}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-[170px]"
            aria-label="Report month"
          />
          <Button onClick={handleExport} disabled={loading} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No employee data for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-max min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted/50 px-2 py-2 text-left font-semibold">Date</th>
                  {dayKeys.map((k, i) => (
                    <th key={k} className="px-1 py-2 text-center font-semibold">
                      {i + 1}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-semibold">Present</th>
                  <th className="px-2 py-2 text-center font-semibold">Absent</th>
                  <th className="px-2 py-2 text-center font-semibold">Half day</th>
                  <th className="px-2 py-2 text-center font-semibold">Leave in Lieu</th>
                  <th className="px-2 py-2 text-center font-semibold">Unpaid leave</th>
                  <th className="px-2 py-2 text-center font-semibold">Total paid leave</th>
                  <th className="px-2 py-2 text-center font-semibold">Total Leave taken</th>
                  <th className="px-2 py-2 text-center font-semibold">Total Present Count</th>
                  <th className="px-2 py-2 text-center font-semibold">Working Days</th>
                  <th className="px-2 py-2 text-center font-semibold">Annual Paid Leave (entitlement)</th>
                  {SPECIAL_LEAVES.map((s) => (
                    <th key={s.key} className="px-2 py-2 text-center font-semibold">
                      {s.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-semibold">Present after Adjustment</th>
                  <th className="px-2 py-2 text-center font-semibold">Paid leave remaining</th>
                  {SPECIAL_LEAVES.map((s) => (
                    <th key={`rem-${s.key}`} className="px-2 py-2 text-center font-semibold">
                      Remaining {s.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-semibold">Deduct days from payroll</th>
                </tr>
                <tr className="border-b bg-muted/30">
                  <th className="sticky left-0 z-10 bg-muted/30 px-2 py-1 text-left font-medium">Name</th>
                  {dayKeys.map((k, i) => (
                    <th key={`d-${k}`} className="px-1 py-1 text-center font-normal text-muted-foreground">
                      {new Date(year, monthIdx, i + 1).toLocaleDateString("en-US", { weekday: "narrow" })}
                    </th>
                  ))}
                  <th colSpan={13 + SPECIAL_LEAVES.length * 2} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.email} className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-2 py-1 font-medium">{r.name}</td>
                    {dayKeys.map((k) => (
                      <td key={`${r.email}-${k}`} className="px-1 py-1 text-center text-muted-foreground">
                        {r.days[k]}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-center">{r.presentCount}</td>
                    <td className="px-2 py-1 text-center">{r.absentCount}</td>
                    <td className="px-2 py-1 text-center">{r.halfDayCount}</td>
                    <td className="px-2 py-1 text-center">{r.lieuCount}</td>
                    <td className="px-2 py-1 text-center">{r.unpaidLeaveDays}</td>
                    <td className="px-2 py-1 text-center">{r.paidLeaveDays}</td>
                    <td className="px-2 py-1 text-center">{r.totalLeaveTaken}</td>
                    <td className="px-2 py-1 text-center">{r.totalPresentCount}</td>
                    <td className="px-2 py-1 text-center">{r.workingDays}</td>
                    <td className="px-2 py-1 text-center">{r.annualEntitlement}</td>
                    {SPECIAL_LEAVES.map((s) => (
                      <td key={`${r.email}-${s.key}`} className="px-2 py-1 text-center">
                        {r.special[s.key] || 0}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-center font-medium">{r.adjustedPresent}</td>
                    <td className="px-2 py-1 text-center">{r.paidLeaveRemaining}</td>
                    {SPECIAL_LEAVES.map((s) => (
                      <td key={`${r.email}-rem-${s.key}`} className="px-2 py-1 text-center">
                        {r.specialRemaining[s.key]}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-center font-semibold">{r.deductDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-muted-foreground">
              P = Present · A = Absent (full-day leave) · HD = Half day · NR = Non recorded · WH = Weekend (Sat/Sun) · H = Public Holiday · LL = Leave in Lieu taken (compensatory off for weekend/holiday work)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
