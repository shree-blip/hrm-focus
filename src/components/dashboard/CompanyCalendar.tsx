import { Calendar as CalendarIcon, Briefcase, Star, Cake, Sparkles, AlertCircle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { useMilestones } from "@/hooks/useMilestones";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CalendarEntry {
  date: Date;
  name: string;
  type: "holiday" | "deadline" | "optional";
}

type TabKey = "upcoming" | "holidays" | "milestones";

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR DATA
// holiday  = actual day off (yellow on calendar)
// deadline = working-day task / filing (orange underline on calendar)
// optional = optional holiday (violet)
//
// Weekends (Sat & Sun) are ALWAYS days off — auto-detected, no need to list.
// ═══════════════════════════════════════════════════════════════════════════════

const calendarEntries: CalendarEntry[] = [
  // ── 2025 ──
  { date: new Date(2025, 0, 1), name: "New Year's Day", type: "holiday" },
  { date: new Date(2025, 0, 15), name: "Maghe Sankranti", type: "holiday" },
  { date: new Date(2025, 1, 14), name: "Valentine's Day", type: "optional" },
  { date: new Date(2025, 2, 8), name: "Maha Shivaratri", type: "holiday" },
  { date: new Date(2025, 2, 14), name: "Holi", type: "holiday" },
  { date: new Date(2025, 3, 14), name: "Nepali New Year", type: "holiday" },
  { date: new Date(2025, 4, 1), name: "May Day", type: "holiday" },
  { date: new Date(2025, 4, 29), name: "Republic Day", type: "holiday" },
  { date: new Date(2025, 6, 4), name: "Independence Day (US)", type: "holiday" },
  { date: new Date(2025, 9, 23), name: "Dashain", type: "holiday" },
  { date: new Date(2025, 10, 1), name: "Tihar", type: "holiday" },
  { date: new Date(2025, 10, 27), name: "Thanksgiving (US)", type: "holiday" },
  { date: new Date(2025, 11, 25), name: "Christmas Day", type: "holiday" },

  // ── January 2026 ──
  { date: new Date(2026, 0, 1), name: "New Year's Day", type: "holiday" },
  { date: new Date(2026, 0, 11), name: "Prithvi Jayanti", type: "holiday" },
  { date: new Date(2026, 0, 14), name: "Maghe Sankranti", type: "holiday" },
  { date: new Date(2026, 0, 30), name: "Martyrs' Day", type: "holiday" },

  // ── February 2026 ──
  { date: new Date(2026, 1, 2), name: "Q4 Sales Tax Filing", type: "deadline" },
  { date: new Date(2026, 1, 6), name: "Deadline: Month-end Books Closure", type: "deadline" },
  { date: new Date(2026, 1, 9), name: "Check Payroll Automation", type: "deadline" },
  { date: new Date(2026, 1, 13), name: "Deadline: Monthly Books Review", type: "deadline" },
  { date: new Date(2026, 1, 14), name: "Valentine's Day", type: "optional" },
  { date: new Date(2026, 1, 15), name: "Maha Shivaratri", type: "holiday" },
  { date: new Date(2026, 1, 20), name: "Texas Sales Tax Filing", type: "deadline" },
  { date: new Date(2026, 1, 20), name: "Deadline: Upload Monthly Financials", type: "deadline" },
  { date: new Date(2026, 1, 24), name: "Q1 1st Pre-Payment (CDTFA)", type: "deadline" },
  { date: new Date(2026, 1, 27), name: "Delaware Annual Report due", type: "deadline" },
  { date: new Date(2026, 1, 28), name: "Venture23 Pay", type: "deadline" },

  // ── March 2026 ──
  { date: new Date(2026, 2, 2), name: "Holi", type: "holiday" },
  { date: new Date(2026, 2, 3), name: "File Extension for 1120S & 1065", type: "deadline" },
  { date: new Date(2026, 2, 5), name: "File Extension for 1120S & 1065", type: "deadline" },
  { date: new Date(2026, 2, 8), name: "Women's Day", type: "optional" },
  { date: new Date(2026, 2, 9), name: "Check Payroll Automation", type: "deadline" },
  { date: new Date(2026, 2, 9), name: "Deadline: Month-end Books Closure", type: "deadline" },
  { date: new Date(2026, 2, 11), name: "File Extension for 1120S & 1065", type: "deadline" },
  { date: new Date(2026, 2, 16), name: "S Corp & 1065 Deadline", type: "deadline" },
  { date: new Date(2026, 2, 16), name: "Deadline: Monthly Books Review", type: "deadline" },
  { date: new Date(2026, 2, 20), name: "Texas Sales Tax Filing", type: "deadline" },
  { date: new Date(2026, 2, 24), name: "Q1 2nd Pre-Payment (CDTFA)", type: "deadline" },
  { date: new Date(2026, 2, 28), name: "Company Holiday", type: "holiday" },
  { date: new Date(2026, 2, 29), name: "Deadline: Upload Monthly Financials", type: "deadline" },
  { date: new Date(2026, 2, 30), name: "Venture23 Payroll Day", type: "deadline" },

  // ── April 2026 ──
  { date: new Date(2026, 3, 3), name: "File Extension for 1120C & 1040", type: "deadline" },
  { date: new Date(2026, 3, 6), name: "File Extension for 1120C & 1040", type: "deadline" },
  { date: new Date(2026, 3, 7), name: "Deadline: Month-end Books Closure", type: "deadline" },
  { date: new Date(2026, 3, 8), name: "Check Payroll Automation", type: "deadline" },
  { date: new Date(2026, 3, 9), name: "File Extension for 1120C & 1040", type: "deadline" },
  { date: new Date(2026, 3, 12), name: "File Extension for 1120C & 1040", type: "deadline" },
  { date: new Date(2026, 3, 14), name: "Nepali New Year", type: "holiday" },
  { date: new Date(2026, 3, 15), name: "Tax Day", type: "deadline" },
  { date: new Date(2026, 3, 15), name: "Deadline: Monthly Books Review", type: "deadline" },
  { date: new Date(2026, 3, 19), name: "Texas Sales Tax Filing", type: "deadline" },
  { date: new Date(2026, 3, 22), name: "Deadline: Upload Monthly Financials", type: "deadline" },
  { date: new Date(2026, 3, 30), name: "Q1 Sales Tax Filing (CDTFA)", type: "deadline" },
  { date: new Date(2026, 3, 30), name: "Venture23 Payroll Day", type: "deadline" },

  // ── May 2026 ──
  { date: new Date(2026, 4, 1), name: "Labor Day", type: "holiday" },
  { date: new Date(2026, 4, 8), name: "Check Payroll Automation", type: "deadline" },
  { date: new Date(2026, 4, 8), name: "Deadline: Month-end Books Closure", type: "deadline" },
  { date: new Date(2026, 4, 15), name: "Texas FTB PIF Filing Deadline", type: "deadline" },
  { date: new Date(2026, 4, 15), name: "Deadline: Monthly Books Review", type: "deadline" },
  { date: new Date(2026, 4, 20), name: "Texas Sales Tax Filing", type: "deadline" },
  { date: new Date(2026, 4, 22), name: "Deadline: Upload Monthly Financials", type: "deadline" },
  { date: new Date(2026, 4, 25), name: "Q2 1st Pre-Payment (CDTFA)", type: "deadline" },
  { date: new Date(2026, 4, 30), name: "Venture23 Payroll Day", type: "deadline" },

  // ── June 2026 ──
  { date: new Date(2026, 5, 5), name: "Deadline: Month-end Books Closure", type: "deadline" },
  { date: new Date(2026, 5, 8), name: "Check Payroll Automation", type: "deadline" },
  { date: new Date(2026, 5, 12), name: "Deadline: Monthly Books Review", type: "deadline" },
  { date: new Date(2026, 5, 19), name: "Deadline: Upload Monthly Financials", type: "deadline" },
  { date: new Date(2026, 5, 22), name: "Texas Sales Tax Filing", type: "deadline" },
  { date: new Date(2026, 5, 24), name: "Q2 2nd Pre-Payment (CDTFA)", type: "deadline" },
  { date: new Date(2026, 5, 30), name: "Venture23 Payroll Day", type: "deadline" },

  // TODO: Add Jul–Dec 2026 here
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

const formatDateShort = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const formatDateFull = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });

const formatWeekday = (date: Date) => date.toLocaleDateString("en-US", { weekday: "short" });

const getDaysUntil = (date: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const getDaysLabel = (days: number): string => {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `in ${days}d`;
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

// Entry lookups
const isNamedHoliday = (date: Date) =>
  calendarEntries.some(
    (e) => e.date.toDateString() === date.toDateString() && (e.type === "holiday" || e.type === "optional"),
  );

const isDeadlineDate = (date: Date) =>
  calendarEntries.some((e) => e.date.toDateString() === date.toDateString() && e.type === "deadline");

const getEntriesForDate = (date: Date) => calendarEntries.filter((e) => e.date.toDateString() === date.toDateString());

const getEntriesForMonth = (date: Date) =>
  calendarEntries.filter((e) => e.date.getMonth() === date.getMonth() && e.date.getFullYear() === date.getFullYear());

// Type config
const typeConfig = {
  holiday: {
    label: "Day Off",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
    dot: "bg-amber-500",
    iconBg: "bg-amber-100 dark:bg-amber-950/40",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  deadline: {
    label: "Deadline",
    badge:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800",
    dot: "bg-orange-500",
    iconBg: "bg-orange-100 dark:bg-orange-950/40",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  optional: {
    label: "Optional",
    badge:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800",
    dot: "bg-violet-400",
    iconBg: "bg-violet-100 dark:bg-violet-950/40",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNED AVATAR
// ═══════════════════════════════════════════════════════════════════════════════

function MilestoneAvatar({
  avatarPath,
  name,
  isBirthday,
}: {
  avatarPath?: string | null;
  name: string;
  isBirthday: boolean;
}) {
  const { signedUrl } = useAvatarUrl(avatarPath || undefined);
  return (
    <Avatar className="h-8 w-8 flex-shrink-0">
      {signedUrl && <AvatarImage src={signedUrl} />}
      <AvatarFallback
        className={cn(
          "text-[10px] font-bold",
          isBirthday
            ? "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB BUTTON
// ═══════════════════════════════════════════════════════════════════════════════

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-lg text-xs font-semibold",
        "transition-all duration-200 border cursor-pointer select-none",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25"
          : "bg-transparent text-muted-foreground border-border/50 hover:bg-accent/60 hover:text-foreground hover:border-border",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1",
            active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
      <div className="opacity-25 mb-2">{icon}</div>
      <p className="text-xs">{text}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function CompanyCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState<TabKey>("upcoming");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  const {
    loading: milestonesLoading,
    isMilestoneDate,
    getMilestonesForDate,
    upcomingMilestones,
    getMilestonesForMonth,
  } = useMilestones();

  // ── Selected date data ────────────────────────────────────────────────
  const selectedEntries = selectedDate ? getEntriesForDate(selectedDate) : [];
  const selectedMilestones = selectedDate ? getMilestonesForDate(selectedDate) : [];
  const isSelectedWeekend = selectedDate ? isWeekend(selectedDate) : false;
  const hasSelectedInfo = selectedEntries.length > 0 || selectedMilestones.length > 0 || isSelectedWeekend;

  // ── Month data ────────────────────────────────────────────────────────
  const monthEntries = getEntriesForMonth(calendarMonth);
  const monthHolidays = monthEntries.filter((e) => e.type === "holiday" || e.type === "optional");
  const monthDeadlines = monthEntries.filter((e) => e.type === "deadline");
  const monthMilestones = getMilestonesForMonth(calendarMonth);

  // ── Combined upcoming ─────────────────────────────────────────────────
  const upcomingAll = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items: Array<{
      id: string;
      date: Date;
      label: string;
      sublabel?: string;
      kind: "holiday" | "deadline" | "optional" | "birthday" | "anniversary";
    }> = [];

    calendarEntries
      .filter((e) => e.date >= today)
      .forEach((e, i) => {
        items.push({
          id: `e-${e.type}-${i}`,
          date: e.date,
          label: e.name,
          kind: e.type === "holiday" ? "holiday" : e.type === "optional" ? "optional" : "deadline",
        });
      });

    upcomingMilestones.forEach((m) => {
      items.push({
        id: m.id,
        date: m.date,
        label: m.employee_name,
        sublabel: m.type === "birthday" ? "Birthday" : `${m.years} Year${(m.years || 0) > 1 ? "s" : ""} Anniversary`,
        kind: m.type === "birthday" ? "birthday" : "anniversary",
      });
    });

    return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 15);
  }, [upcomingMilestones]);

  // ── Calendar modifiers (mutually exclusive) ───────────────────────────
  const calendarModifiers = useMemo(
    () => ({
      // Yellow — day off (weekend or named holiday) with NO milestone
      dayOff: (date: Date) => (isWeekend(date) || isNamedHoliday(date)) && !isMilestoneDate(date),
      // Orange underline — deadline on a working day with NO milestone
      deadline: (date: Date) =>
        isDeadlineDate(date) && !isWeekend(date) && !isNamedHoliday(date) && !isMilestoneDate(date),
      // Green — milestone on a working day
      milestone: (date: Date) => isMilestoneDate(date) && !isWeekend(date) && !isNamedHoliday(date),
      // Yellow+Green gradient — day off that is also a milestone
      dayOffMilestone: (date: Date) => (isWeekend(date) || isNamedHoliday(date)) && isMilestoneDate(date),
      // Green + orange underline — deadline day that is also a milestone
      deadlineMilestone: (date: Date) =>
        isDeadlineDate(date) && isMilestoneDate(date) && !isWeekend(date) && !isNamedHoliday(date),
    }),
    [isMilestoneDate],
  );

  const calendarModifierStyles = {
    dayOff: {
      backgroundColor: "hsl(45 93% 47% / 0.15)",
      color: "hsl(45 80% 28%)",
      fontWeight: "bold" as const,
      borderRadius: "6px",
    },
    deadline: {
      borderBottom: "2.5px solid hsl(25 95% 53%)",
      fontWeight: "600" as const,
      borderRadius: "6px",
    },
    milestone: {
      backgroundColor: "hsl(142 71% 45% / 0.14)",
      color: "hsl(142 71% 28%)",
      fontWeight: "bold" as const,
      borderRadius: "6px",
    },
    dayOffMilestone: {
      background: "linear-gradient(135deg, hsl(45 93% 47% / 0.16), hsl(142 71% 45% / 0.16))",
      fontWeight: "bold" as const,
      borderRadius: "6px",
    },
    deadlineMilestone: {
      backgroundColor: "hsl(142 71% 45% / 0.14)",
      borderBottom: "2.5px solid hsl(25 95% 53%)",
      fontWeight: "bold" as const,
      borderRadius: "6px",
    },
  };

  const upcomingCount = upcomingAll.length;
  const holidayTabCount = monthHolidays.length + monthDeadlines.length;
  const milestoneTabCount = monthMilestones.length;

  // ── Clear selection handler ───────────────────────────────────────────
  const handleClearSelection = () => {
    setSelectedDate(undefined);
  };

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════

  return (
    <Card
      className="animate-slide-up opacity-0 overflow-hidden"
      style={{ animationDelay: "350ms", animationFillMode: "forwards" }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          Company Calendar
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── CALENDAR - WIDER VERSION ── */}
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          onMonthChange={setCalendarMonth}
          className="rounded-lg border p-3 w-full"
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
            month: "space-y-4 w-full",
            caption: "flex justify-center pt-1 relative items-center px-2",
            caption_label: "text-base font-medium",
            nav: "space-x-1 flex items-center",
            nav_button: "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100",
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse",
            head_row: "flex w-full",
            head_cell: "text-muted-foreground rounded-md flex-1 font-medium text-[0.8rem] py-2 text-center",
            row: "flex w-full mt-1",
            cell: "flex-1 text-center text-sm p-0.5 relative focus-within:relative focus-within:z-20",
            day: "h-10 w-full rounded-md p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground",
            day_range_end: "day-range-end",
            day_selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside:
              "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
            day_disabled: "text-muted-foreground opacity-50",
            day_hidden: "invisible",
          }}
          modifiers={calendarModifiers}
          modifiersStyles={calendarModifierStyles}
        />

        {/* ── SELECTED DATE DETAIL WITH CLEAR BUTTON ── */}
        {selectedDate && (
          <div className="space-y-1.5">
            {/* Selected date header with clear button */}
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-medium text-foreground">{formatDateFull(selectedDate)}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            </div>

            {/* Weekend badge */}
            {isSelectedWeekend && selectedEntries.filter((e) => e.type === "holiday").length === 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Star className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {formatWeekday(selectedDate)} — Weekly Off
                </p>
              </div>
            )}

            {selectedEntries.map((entry, i) => {
              const cfg = typeConfig[entry.type];
              return (
                <div key={`sel-${i}`} className={cn("p-2.5 rounded-lg border flex items-center gap-2.5", cfg.badge)}>
                  <div className={cn("w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0", cfg.iconBg)}>
                    {entry.type === "deadline" ? (
                      <AlertCircle className={cn("h-3 w-3", cfg.iconColor)} />
                    ) : (
                      <Star className={cn("h-3 w-3", cfg.iconColor)} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{entry.name}</p>
                    <p className="text-[11px] opacity-70">{formatDateFull(entry.date)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                    {cfg.label}
                  </Badge>
                </div>
              );
            })}

            {selectedMilestones.map((m) => (
              <div
                key={m.id}
                className="p-2.5 rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5"
              >
                <MilestoneAvatar avatarPath={m.avatar_url} name={m.employee_name} isBirthday={m.type === "birthday"} />
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300 truncate">
                    {m.employee_name}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {m.type === "birthday"
                      ? "🎂 Birthday"
                      : `🎉 ${m.years} Year${(m.years || 0) > 1 ? "s" : ""} Work Anniversary`}
                  </p>
                </div>
              </div>
            ))}

            {/* Show "No events" if it's not a weekend and no entries/milestones */}
            {!hasSelectedInfo && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-center">
                <p className="text-sm text-muted-foreground">No events on this date</p>
              </div>
            )}
          </div>
        )}

        {/* ── LEGEND ── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground px-0.5">
          <span className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: "hsl(45 93% 47% / 0.25)", border: "1px solid hsl(45 93% 47% / 0.4)" }}
            />
            Day Off
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm border-b-2" style={{ borderBottomColor: "hsl(25 95% 53%)" }} />
            Deadline
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: "hsl(142 71% 45% / 0.22)", border: "1px solid hsl(142 71% 45% / 0.35)" }}
            />
            Milestone
          </span>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1.5">
          <TabButton
            active={activeTab === "upcoming"}
            onClick={() => setActiveTab("upcoming")}
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="Upcoming"
            count={upcomingCount}
          />
          <TabButton
            active={activeTab === "holidays"}
            onClick={() => setActiveTab("holidays")}
            icon={<Star className="h-3.5 w-3.5" />}
            label="Holidays"
            count={holidayTabCount}
          />
          <TabButton
            active={activeTab === "milestones"}
            onClick={() => setActiveTab("milestones")}
            icon={<Cake className="h-3.5 w-3.5" />}
            label="Milestones"
            count={milestoneTabCount}
          />
        </div>

        {/* ── TAB CONTENT ── */}
        <div className="min-h-[160px] max-h-[360px] overflow-y-auto">
          {/* ═══ UPCOMING ═══ */}
          {activeTab === "upcoming" && (
            <div className="space-y-1">
              {upcomingAll.length === 0 ? (
                <EmptyState icon={<Sparkles className="h-6 w-6" />} text="No upcoming events" />
              ) : (
                upcomingAll.map((item) => {
                  const days = getDaysUntil(item.date);
                  const isToday = days === 0;
                  const isUrgentDeadline = item.kind === "deadline" && days >= 0 && days <= 3;

                  let iconEl: React.ReactNode;
                  let iconBg: string;
                  if (item.kind === "holiday") {
                    iconEl = <Star className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
                    iconBg = "bg-amber-100 dark:bg-amber-950/40";
                  } else if (item.kind === "optional") {
                    iconEl = <Star className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400" />;
                    iconBg = "bg-violet-100 dark:bg-violet-950/40";
                  } else if (item.kind === "deadline") {
                    iconEl = <AlertCircle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />;
                    iconBg = "bg-orange-100 dark:bg-orange-950/40";
                  } else if (item.kind === "birthday") {
                    iconEl = <Cake className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />;
                    iconBg = "bg-pink-100 dark:bg-pink-950/40";
                  } else {
                    iconEl = <Briefcase className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
                    iconBg = "bg-emerald-100 dark:bg-emerald-950/40";
                  }

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 cursor-default group",
                        isToday
                          ? "bg-primary/5 border border-primary/20 shadow-sm"
                          : "border border-transparent hover:bg-accent/50 hover:border-border/40",
                      )}
                    >
                      <div
                        className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105",
                          iconBg,
                        )}
                      >
                        {iconEl}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.sublabel ? `${item.sublabel} · ` : ""}
                          {formatDateShort(item.date)} · {formatWeekday(item.date)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-5 flex-shrink-0 font-semibold tabular-nums",
                          isToday && "bg-primary text-primary-foreground border-primary",
                          isUrgentDeadline &&
                            !isToday &&
                            "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800",
                        )}
                      >
                        {getDaysLabel(days)}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ═══ HOLIDAYS TAB (Days Off + Deadlines for month) ═══ */}
          {activeTab === "holidays" && (
            <div className="space-y-3">
              {/* Days Off */}
              {monthHolidays.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
                    <Star className="h-3 w-3" /> Days Off
                  </p>
                  {monthHolidays.map((entry, idx) => {
                    const cfg = typeConfig[entry.type];
                    const days = getDaysUntil(entry.date);
                    const isPast = days < 0;
                    return (
                      <div
                        key={`hol-${idx}`}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 cursor-default group",
                          isPast ? "opacity-40" : "hover:bg-accent/50",
                        )}
                      >
                        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-[13px] font-medium truncate", isPast && "line-through")}>
                            {entry.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">
                              {formatDateShort(entry.date)} · {formatWeekday(entry.date)}
                            </span>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 border", cfg.badge)}>
                              {cfg.label}
                            </Badge>
                          </div>
                        </div>
                        {!isPast && (
                          <span className="text-[11px] text-muted-foreground font-medium tabular-nums flex-shrink-0">
                            {getDaysLabel(days)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Deadlines */}
              {monthDeadlines.length > 0 && (
                <div className="space-y-1">
                  {monthHolidays.length > 0 && <div className="border-t border-border/40 my-1" />}
                  <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3" /> Deadlines
                  </p>
                  {monthDeadlines.map((entry, idx) => {
                    const days = getDaysUntil(entry.date);
                    const isPast = days < 0;
                    const isUrgent = days >= 0 && days <= 3;
                    return (
                      <div
                        key={`dl-${idx}`}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 cursor-default group",
                          isPast ? "opacity-40" : "hover:bg-accent/50",
                        )}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-orange-500" />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-[13px] font-medium truncate", isPast && "line-through")}>
                            {entry.name}
                          </p>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDateShort(entry.date)} · {formatWeekday(entry.date)}
                          </span>
                        </div>
                        {!isPast && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0 h-5 flex-shrink-0 font-semibold tabular-nums",
                              isUrgent &&
                                "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800",
                            )}
                          >
                            {getDaysLabel(days)}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {monthHolidays.length === 0 && monthDeadlines.length === 0 && (
                <EmptyState icon={<Star className="h-6 w-6" />} text="No events this month" />
              )}
            </div>
          )}

          {/* ═══ MILESTONES TAB ═══ */}
          {activeTab === "milestones" && (
            <div className="space-y-1">
              {milestonesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : monthMilestones.length === 0 ? (
                <EmptyState icon={<Cake className="h-6 w-6" />} text="No milestones this month" />
              ) : (
                monthMilestones.map((m) => {
                  const days = getDaysUntil(m.date);
                  const isPast = days < 0;
                  const isBirthday = m.type === "birthday";
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-default group",
                        isPast ? "opacity-40" : "hover:bg-accent/50",
                      )}
                    >
                      <div className="transition-transform group-hover:scale-105">
                        <MilestoneAvatar avatarPath={m.avatar_url} name={m.employee_name} isBirthday={isBirthday} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{m.employee_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">
                            {isBirthday ? "🎂 Birthday" : `🎉 ${m.years}yr Anniversary`}
                          </span>
                          {m.department && (
                            <span className="text-[10px] text-muted-foreground/50">· {m.department}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[11px] font-medium tabular-nums">{formatDateShort(m.date)}</p>
                        {!isPast && (
                          <p className="text-[10px] text-muted-foreground tabular-nums">{getDaysLabel(days)}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
