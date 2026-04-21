import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, CalendarX, Sparkles } from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useAuth } from "@/contexts/AuthContext";
import { useTimeTracker } from "@/contexts/TimeTrackerContext";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { calendarEntries } from "@/components/dashboard/CompanyCalendar";

interface WorkedOffDay {
  date: Date;
  dateStr: string;
  reason: string;
  windowStart: Date;
  windowEnd: Date;
}

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

const formatShort = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const nextBusinessDay = (d: Date): Date => {
  const result = new Date(d);
  result.setDate(result.getDate() + 1);
  while (isWeekend(result)) result.setDate(result.getDate() + 1);
  return result;
};

const lastBusinessDayOfMonth = (d: Date): Date => {
  const result = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  while (isWeekend(result)) result.setDate(result.getDate() - 1);
  return result;
};

/**
 * Shared hook so both `LeaveInLieuAlert` and the dashboard layout can agree on
 * whether the 5th tile is present (and resize the grid accordingly).
 */
export function useWorkedOffDays(): WorkedOffDay[] {
  const { monthlyLogs } = useTimeTracker();
  const { events: customEvents } = useCalendarEvents();
  const { ownRequests } = useLeaveRequests();

  const holidayByDate = useMemo(() => {
    const map = new Map();
    calendarEntries.forEach((e) => {
      if (e.type === "holiday" || e.type === "optional") {
        map.set(e.date.toDateString(), e.name);
      }
    });
    customEvents
      .filter((e) => e.event_type === "holiday")
      .forEach((e) => {
        const d = new Date(e.event_date + "T00:00:00");
        map.set(d.toDateString(), e.title);
      });
    return map;
  }, [customEvents]);

  // Dates already covered by an approved / pending Leave on Lieu request
  const coveredDates = useMemo(() => {
    const set = new Set();
    ownRequests
      .filter(
        (r) =>
          r.leave_type?.toLowerCase().startsWith("leave on lieu") &&
          (r.status === "approved" || r.status === "pending"),
      )
      .forEach((r) => {
        const start = new Date(r.start_date + "T00:00:00");
        const end = new Date(r.end_date + "T00:00:00");
        const cursor = new Date(start);
        while (cursor <= end) {
          set.add(cursor.toDateString());
          cursor.setDate(cursor.getDate() + 1);
        }
      });
    return set;
  }, [ownRequests]);

  return useMemo(() => {
    const seen = new Map();
    monthlyLogs.forEach((log) => {
      if (!log.clock_in) return;
      const d = new Date(log.clock_in);
      d.setHours(0, 0, 0, 0);
      const key = d.toDateString();
      if (seen.has(key)) return;

      let reason: string | null = null;
      const holiday = holidayByDate.get(key);
      if (holiday) {
        reason = holiday;
      } else if (isWeekend(d)) {
        reason = d.getDay() === 0 ? "Sunday (weekly off)" : "Saturday (weekly off)";
      }
      if (!reason) return;

      seen.set(key, {
        date: d,
        dateStr: key,
        reason,
        windowStart: nextBusinessDay(d),
        windowEnd: lastBusinessDayOfMonth(d),
      });
    });
    return Array.from(seen.values())
      .filter((w) => !coveredDates.has(w.dateStr))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [monthlyLogs, holidayByDate, coveredDates]);
}

export function LeaveInLieuAlert({ delay = 300 }: { delay?: number }) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);

  const workedOffDays = useWorkedOffDays();

  const storageKey = profile?.user_id ? `lieu-alert-dismissed-${profile.user_id}` : "lieu-alert-dismissed";

  useEffect(() => {
    if (workedOffDays.length === 0) return;
    let dismissed: string[] = [];
    try {
      dismissed = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
    } catch {
      dismissed = [];
    }
    const hasNew = workedOffDays.some((w) => !dismissed.includes(w.dateStr));
    if (hasNew) setDialogOpen(true);
  }, [workedOffDays, storageKey]);

  if (workedOffDays.length === 0) return null;

  const firstName = profile?.first_name || "there";
  const mostRecent = workedOffDays[workedOffDays.length - 1];
  const earliestDeadline = workedOffDays.reduce(
    (acc, w) => (w.windowEnd < acc ? w.windowEnd : acc),
    workedOffDays[0].windowEnd,
  );

  const markDismissed = () => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(workedOffDays.map((w) => w.dateStr)));
    } catch {
      // storage unavailable — silently skip
    }
  };

  const handleCloseDialog = () => {
    markDismissed();
    setDialogOpen(false);
  };

  const handleRequestLeave = () => {
    markDismissed();
    setDialogOpen(false);
    navigate("/leave");
  };

  return (
    <>
      <StatCard
        title="Leave on Lieu Available"
        value={`${workedOffDays.length}`}
        change={`Deadline ${formatShort(earliestDeadline)}`}
        changeType="negative"
        icon={CalendarCheck}
        iconColor="bg-success/10 text-success"
        delay={delay}
        onClick={() => setDialogOpen(true)}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (open) setDialogOpen(true);
          else handleCloseDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-warning" />
              <DialogTitle className="text-lg font-semibold">
                {firstName}, thanks for your dedication!
              </DialogTitle>
            </div>
            <DialogDescription className="pt-2 space-y-3">
              <p className="text-sm text-muted-foreground">
                You clocked in on{" "}
                <span className="font-medium text-foreground">{formatShort(mostRecent.date)}</span> (
                {mostRecent.reason}) — that was one of your days off.
              </p>

              <p className="text-sm text-muted-foreground">
                Please take a <span className="font-medium text-foreground">Leave on Lieu</span> on any working
                day between{" "}
                <span className="font-medium text-foreground">{formatShort(mostRecent.windowStart)}</span> and{" "}
                <span className="font-medium text-foreground">{formatShort(mostRecent.windowEnd)}</span> so you
                can recover your rest day within the same month.
              </p>

              {workedOffDays.length > 1 && (
                <div className="bg-muted/50 rounded-lg p-3 mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    All off-days worked this month ({workedOffDays.length}):
                  </p>
                  <ul className="space-y-2 text-sm">
                    {workedOffDays.map((w) => (
                      <li key={w.dateStr} className="flex justify-between items-start gap-2">
                        <span className="font-medium text-foreground">
                          {formatShort(w.date)}
                          <span className="text-muted-foreground font-normal"> · {w.reason}</span>
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatShort(w.windowStart)} – {formatShort(w.windowEnd)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-3">
                Rule of thumb: take the comp-off on a working day in the same month,
                from the next business day up to the month's last working day.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCloseDialog} className="w-full sm:w-auto">
              Remind me later
            </Button>
            <Button onClick={handleRequestLeave} className="w-full sm:w-auto gap-2">
              <CalendarCheck className="h-4 w-4" />
              Request Leave on Lieu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
