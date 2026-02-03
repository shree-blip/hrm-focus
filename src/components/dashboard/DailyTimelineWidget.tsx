import { useMemo } from "react";
import {
  Calendar,
  Star,
  AlertCircle,
  Cake,
  Briefcase,
  Clock,
  ChevronRight,
  PartyPopper,
  CalendarCheck,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMilestones } from "@/hooks/useMilestones";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR DATA
// ═══════════════════════════════════════════════════════════════════════════════

interface CalendarEntry {
  date: Date;
  name: string;
  type: "holiday" | "deadline" | "optional";
}

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
  { date: new Date(2026, 1, 6), name: "Month-end Books Closure", type: "deadline" },
  { date: new Date(2026, 1, 9), name: "Check Payroll Automation", type: "deadline" },
  { date: new Date(2026, 1, 13), name: "Monthly Books Review", type: "deadline" },
  { date: new Date(2026, 1, 14), name: "Valentine's Day", type: "optional" },
  { date: new Date(2026, 1, 15), name: "Maha Shivaratri", type: "holiday" },
  { date: new Date(2026, 1, 20), name: "Texas Sales Tax Filing", type: "deadline" },
  { date: new Date(2026, 1, 24), name: "Q1 1st Pre-Payment (CDTFA)", type: "deadline" },
  { date: new Date(2026, 1, 27), name: "Delaware Annual Report", type: "deadline" },
  { date: new Date(2026, 1, 28), name: "Venture23 Pay", type: "deadline" },

  // ── March 2026 ──
  { date: new Date(2026, 2, 2), name: "Holi", type: "holiday" },
  { date: new Date(2026, 2, 3), name: "File Extension 1120S & 1065", type: "deadline" },
  { date: new Date(2026, 2, 8), name: "Women's Day", type: "optional" },
  { date: new Date(2026, 2, 9), name: "Check Payroll Automation", type: "deadline" },
  { date: new Date(2026, 2, 16), name: "S Corp & 1065 Deadline", type: "deadline" },
  { date: new Date(2026, 2, 28), name: "Company Holiday", type: "holiday" },
  { date: new Date(2026, 2, 30), name: "Venture23 Payroll Day", type: "deadline" },

  // ── April 2026 ──
  { date: new Date(2026, 3, 14), name: "Nepali New Year", type: "holiday" },
  { date: new Date(2026, 3, 15), name: "Tax Day", type: "deadline" },
  { date: new Date(2026, 3, 30), name: "Q1 Sales Tax Filing", type: "deadline" },

  // ── May 2026 ──
  { date: new Date(2026, 4, 1), name: "Labor Day", type: "holiday" },
  { date: new Date(2026, 4, 15), name: "Texas FTB PIF Filing", type: "deadline" },
  { date: new Date(2026, 4, 25), name: "Q2 1st Pre-Payment", type: "deadline" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const getDaysUntil = (date: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const formatDateCompact = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const formatWeekday = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "short" });

const getDaysLabel = (days: number): string => {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days}d`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════════════════════

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  accentColor: string;
}

function SectionHeader({ icon, title, count, accentColor }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className={cn("p-1.5 rounded-md", accentColor)}>
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <Badge variant="secondary" className="text-xs">
        {count}
      </Badge>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMELINE ITEM (COMPACT)
// ═══════════════════════════════════════════════════════════════════════════════

interface TimelineItemProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  date: string;
  daysUntil: number;
  isUrgent?: boolean;
}

function TimelineItem({ icon, iconBg, title, date, daysUntil, isUrgent }: TimelineItemProps) {
  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className={cn("p-2 rounded-lg shrink-0", iconBg)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {date}
        </div>
      </div>
      <span className={cn(
        "text-xs font-medium px-2 py-1 rounded-full shrink-0",
        daysUntil === 0 && "bg-green-500/20 text-green-400",
        daysUntil === 1 && "bg-blue-500/20 text-blue-400",
        daysUntil > 1 && daysUntil <= 3 && isUrgent && "bg-red-500/20 text-red-400",
        daysUntil > 1 && !isUrgent && "bg-muted text-muted-foreground"
      )}>
        {getDaysLabel(daysUntil)}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MILESTONE CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface MilestoneItemProps {
  name: string;
  type: "birthday" | "anniversary";
  date: string;
  years?: number;
  daysUntil: number;
}

function MilestoneItem({ name, type, date, years, daysUntil }: MilestoneItemProps) {
  const isBirthday = type === "birthday";
  
  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className={cn(
        "p-2 rounded-lg shrink-0",
        isBirthday ? "bg-pink-500/10" : "bg-purple-500/10"
      )}>
        <div className={cn(
          "h-4 w-4",
          isBirthday ? "text-pink-500" : "text-purple-500"
        )}>
          {isBirthday 
            ? <Cake className="h-4 w-4" />
            : <Briefcase className="h-4 w-4" />
          }
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isBirthday ? "🎂 Birthday" : `🎉 ${years} Year${years !== 1 ? "s" : ""}`}
          </span>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
      </div>
      <span className={cn(
        "text-xs font-medium px-2 py-1 rounded-full shrink-0",
        daysUntil === 0 && "bg-green-500/20 text-green-400",
        daysUntil === 1 && "bg-blue-500/20 text-blue-400",
        daysUntil > 1 && "bg-muted text-muted-foreground"
      )}>
        {getDaysLabel(daysUntil)}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface DailyTimelineWidgetProps {
  maxItemsPerSection?: number;
  onViewAll?: () => void;
}

export function DailyTimelineWidget({ maxItemsPerSection = 3, onViewAll }: DailyTimelineWidgetProps) {
  const { upcomingMilestones } = useMilestones();

  const { milestones, upcoming, holidays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Process milestones (birthdays & anniversaries)
    const milestoneItems = upcomingMilestones
      .filter((m) => {
        const days = getDaysUntil(m.date);
        return days >= 0 && days <= 14;
      })
      .map((m) => ({
        id: m.id,
        date: m.date,
        name: m.employee_name,
        type: m.type as "birthday" | "anniversary",
        years: m.years,
        days: getDaysUntil(m.date),
        dateStr: `${formatDateCompact(m.date)} · ${formatWeekday(m.date)}`,
      }))
      .sort((a, b) => a.days - b.days)
      .slice(0, maxItemsPerSection);

    // Process calendar entries
    const calendarItems = calendarEntries
      .filter((e) => {
        const days = getDaysUntil(e.date);
        return days >= 0 && days <= 14;
      })
      .map((e, i) => ({
        id: `cal-${e.type}-${i}`,
        date: e.date,
        name: e.name,
        type: e.type,
        days: getDaysUntil(e.date),
        dateStr: `${formatDateCompact(e.date)} · ${formatWeekday(e.date)}`,
      }))
      .sort((a, b) => a.days - b.days);

    // Split calendar items
    const upcomingItems = calendarItems
      .filter((item) => item.type === "deadline")
      .slice(0, maxItemsPerSection);

    const holidayItems = calendarItems
      .filter((item) => item.type === "holiday" || item.type === "optional")
      .slice(0, maxItemsPerSection);

    return {
      milestones: milestoneItems,
      upcoming: upcomingItems,
      holidays: holidayItems,
    };
  }, [upcomingMilestones, maxItemsPerSection]);

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Daily Timeline
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {todayFormatted}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ════════════════════════════════════════════════════════════════════
            SECTION 1: MILESTONES (Birthdays & Anniversaries)
        ════════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader
            icon={<PartyPopper className="h-4 w-4 text-pink-500" />}
            title="Milestones"
            count={milestones.length}
            accentColor="bg-pink-500/10"
          />
          {milestones.length === 0 ? (
            <EmptyState message="No upcoming milestones" />
          ) : (
            <div className="space-y-1">
              {milestones.map((item) => (
                <MilestoneItem
                  key={item.id}
                  name={item.name}
                  type={item.type}
                  date={item.dateStr}
                  years={item.years}
                  daysUntil={item.days}
                />
              ))}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 2: UPCOMING DEADLINES
        ════════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader
            icon={<Target className="h-4 w-4 text-orange-500" />}
            title="Upcoming Deadlines"
            count={upcoming.length}
            accentColor="bg-orange-500/10"
          />
          {upcoming.length === 0 ? (
            <EmptyState message="No upcoming deadlines" />
          ) : (
            <div className="space-y-1">
              {upcoming.map((item) => (
                <TimelineItem
                  key={item.id}
                  icon={<AlertCircle className="h-4 w-4 text-orange-500" />}
                  iconBg="bg-orange-500/10"
                  title={item.name}
                  date={item.dateStr}
                  daysUntil={item.days}
                  isUrgent={item.days <= 3}
                />
              ))}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 3: HOLIDAYS & OBSERVANCES
        ════════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader
            icon={<CalendarCheck className="h-4 w-4 text-amber-500" />}
            title="Holidays & Observances"
            count={holidays.length}
            accentColor="bg-amber-500/10"
          />
          {holidays.length === 0 ? (
            <EmptyState message="No upcoming holidays" />
          ) : (
            <div className="space-y-1">
              {holidays.map((item) => (
                <TimelineItem
                  key={item.id}
                  icon={item.type === "holiday" 
                    ? <Star className="h-4 w-4 text-amber-500" /> 
                    : <Star className="h-4 w-4 text-violet-500" />
                  }
                  iconBg={item.type === "holiday" ? "bg-amber-500/10" : "bg-violet-500/10"}
                  title={item.name}
                  date={item.dateStr}
                  daysUntil={item.days}
                />
              ))}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            VIEW ALL BUTTON
        ════════════════════════════════════════════════════════════════════ */}
        {onViewAll && (
          <Button variant="ghost" className="w-full" onClick={onViewAll}>
            View Full Calendar
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
