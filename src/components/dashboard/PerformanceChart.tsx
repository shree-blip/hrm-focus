import { useState, useEffect, useMemo } from "react";
import { TrendingUp, ArrowRight, Clock3, CalendarDays, Target, Activity } from "lucide-react";
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkDate } from "@/utils/timezoneUtils";

type RangeKey = "7d" | "30d" | "90d" | "all";

interface AttendanceLog {
  clock_in: string;
  clock_out: string | null;
  total_break_minutes: number | null;
  total_pause_minutes: number | null;
}

interface DailyPoint {
  date: string;
  label: string;
  fullLabel: string;
  hours: number;
  target: number;
}

const POLICY_HOURS = 8;

function formatShortDate(dateStr: string, totalDays: number) {
  const date = new Date(dateStr);
  if (totalDays <= 14) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  if (totalDays <= 90) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short" });
}

function formatFullDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildDailyHoursMap(logs: AttendanceLog[], tz: string): Record<string, number> {
  const map: Record<string, number> = {};

  for (const log of logs) {
    if (!log.clock_in || !log.clock_out) continue;

    const workDate = getWorkDate(log.clock_in, tz);
    const start = new Date(log.clock_in).getTime();
    const end = new Date(log.clock_out).getTime();

    const breakMs = (log.total_break_minutes || 0) * 60 * 1000;
    const pauseMs = (log.total_pause_minutes || 0) * 60 * 1000;
    const netMs = Math.max(0, end - start - breakMs - pauseMs);
    const hours = Math.round((netMs / (1000 * 60 * 60)) * 10) / 10;

    map[workDate] = Math.round(((map[workDate] || 0) + hours) * 10) / 10;
  }

  return map;
}

function getDateRangeFromFirstRecord(firstDate: string, range: RangeKey) {
  const today = new Date();
  const first = new Date(firstDate);

  let start = new Date(first);

  if (range === "7d") {
    start = new Date(today);
    start.setDate(today.getDate() - 6);
  } else if (range === "30d") {
    start = new Date(today);
    start.setDate(today.getDate() - 29);
  } else if (range === "90d") {
    start = new Date(today);
    start.setDate(today.getDate() - 89);
  }

  if (start < first) start = first;

  const end = new Date(today);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return { start, end };
}

function buildSeries(dailyMap: Record<string, number>, start: Date, end: Date): DailyPoint[] {
  const points: DailyPoint[] = [];
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

  const current = new Date(start);
  while (current <= end) {
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(
      current.getDate(),
    ).padStart(2, "0")}`;

    const day = current.getDay();
    const isWeekend = day === 0 || day === 6;

    points.push({
      date: key,
      label: formatShortDate(key, totalDays),
      fullLabel: formatFullDate(key),
      hours: dailyMap[key] || 0,
      target: isWeekend ? 0 : POLICY_HOURS,
    });

    current.setDate(current.getDate() + 1);
  }

  return points;
}

function calculateStats(series: DailyPoint[]) {
  const workingDays = series.filter((d) => d.target > 0);
  const totalHours = series.reduce((sum, d) => sum + d.hours, 0);
  const avgHours =
    workingDays.length > 0 ? (workingDays.reduce((sum, d) => sum + d.hours, 0) / workingDays.length).toFixed(1) : "0.0";

  const fullDays = workingDays.filter((d) => d.hours >= POLICY_HOURS).length;
  const absentDays = workingDays.filter((d) => d.hours === 0).length;

  const bestDay = [...series].sort((a, b) => b.hours - a.hours)[0];
  const utilization =
    workingDays.length > 0
      ? Math.round((workingDays.reduce((sum, d) => sum + d.hours, 0) / (workingDays.length * POLICY_HOURS)) * 100)
      : 0;

  const last7 = series.slice(-7);
  const prev7 = series.slice(-14, -7);

  const last7Avg =
    last7.filter((d) => d.target > 0).reduce((sum, d) => sum + d.hours, 0) /
    Math.max(1, last7.filter((d) => d.target > 0).length);

  const prev7Avg =
    prev7.filter((d) => d.target > 0).reduce((sum, d) => sum + d.hours, 0) /
    Math.max(1, prev7.filter((d) => d.target > 0).length);

  const trend = Math.round((last7Avg - prev7Avg) * 10) / 10;

  return {
    totalHours: Math.round(totalHours),
    avgHours,
    fullDays,
    absentDays,
    utilization,
    bestDay,
    trend,
  };
}

export function PerformanceChart() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("30d");
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [employeeTimezone, setEmployeeTimezone] = useState("Asia/Kathmandu");

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);

      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();

      if (profile) {
        const { data: emp } = await supabase.from("employees").select("timezone").eq("profile_id", profile.id).single();

        if (emp?.timezone) {
          setEmployeeTimezone(emp.timezone);
        }
      }

      const { data, error } = await supabase
        .from("attendance_logs")
        .select("clock_in, clock_out, total_break_minutes, total_pause_minutes")
        .eq("user_id", user.id)
        .not("clock_out", "is", null)
        .order("clock_in", { ascending: true });

      if (!error && data) {
        setLogs(data as AttendanceLog[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const dailyMap = useMemo(() => {
    return buildDailyHoursMap(logs, employeeTimezone);
  }, [logs, employeeTimezone]);

  const firstRecordDate = useMemo(() => {
    const keys = Object.keys(dailyMap).sort();
    return keys.length > 0 ? keys[0] : null;
  }, [dailyMap]);

  const chartData = useMemo(() => {
    if (!firstRecordDate) return [];

    const { start, end } = getDateRangeFromFirstRecord(firstRecordDate, range);
    return buildSeries(dailyMap, start, end);
  }, [dailyMap, firstRecordDate, range]);

  const stats = useMemo(() => calculateStats(chartData), [chartData]);

  const rangeLabel = useMemo(() => {
    if (!chartData.length) return "";
    return `${chartData[0].fullLabel} - ${chartData[chartData.length - 1].fullLabel}`;
  }, [chartData]);

  const hasData = chartData.length > 0;

  return (
    <Card
      className="col-span-2 overflow-hidden border-border/60 shadow-sm animate-slide-up opacity-0"
      style={{ animationDelay: "350ms", animationFillMode: "forwards" }}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              Performance Overview
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Track your attendance-based working hours from the first available record.
            </p>
            {hasData && (
              <p className="text-xs text-muted-foreground">
                Showing: <span className="font-medium text-foreground">{rangeLabel}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(["7d", "30d", "90d", "all"] as RangeKey[]).map((item) => (
              <Button
                key={item}
                variant={range === item ? "default" : "outline"}
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setRange(item)}
              >
                {item === "all" ? "All Time" : item.toUpperCase()}
              </Button>
            ))}

            <Link to="/performance">
              <Button variant="ghost" size="sm" className="gap-1 text-primary">
                Details
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
            Loading performance data...
          </div>
        ) : !hasData ? (
          <div className="flex h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Activity className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold">No performance data yet</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Once attendance logs are created, this chart will automatically start showing your real performance trend.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-5">
              <div className="rounded-2xl border bg-background/60 p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <Clock3 className="h-4 w-4" />
                  Total Hours
                </div>
                <div className="text-2xl font-semibold">{stats.totalHours}h</div>
              </div>

              <div className="rounded-2xl border bg-background/60 p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <CalendarDays className="h-4 w-4" />
                  Avg / Working Day
                </div>
                <div className="text-2xl font-semibold">{stats.avgHours}h</div>
              </div>

              <div className="rounded-2xl border bg-background/60 p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <Target className="h-4 w-4" />
                  Utilization
                </div>
                <div className="text-2xl font-semibold">{stats.utilization}%</div>
              </div>

              <div className="rounded-2xl border bg-background/60 p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <TrendingUp className="h-4 w-4" />
                  7-Day Trend
                </div>
                <div
                  className={`text-2xl font-semibold ${
                    stats.trend > 0 ? "text-green-600" : stats.trend < 0 ? "text-red-600" : ""
                  }`}
                >
                  {stats.trend > 0 ? "+" : ""}
                  {stats.trend}h
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-gradient-to-b from-background to-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Working Hours Trend</h4>
                  <p className="text-xs text-muted-foreground">
                    Daily tracked hours compared with the {POLICY_HOURS}h workday target
                  </p>
                </div>
              </div>

              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="hoursFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.03} />
                      </linearGradient>
                      <linearGradient id="targetFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />

                    <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={20} />

                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={35} />

                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                      }}
                      labelStyle={{ fontWeight: 600, marginBottom: 6 }}
                      formatter={(value: number, name: string) => [
                        `${value}h`,
                        name === "hours" ? "Tracked Hours" : "Target",
                      ]}
                      labelFormatter={(_, payload) => {
                        if (!payload?.length) return "";
                        return payload[0].payload.fullLabel;
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="target"
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      fill="url(#targetFill)"
                      name="target"
                    />

                    <Area
                      type="monotone"
                      dataKey="hours"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      fill="url(#hoursFill)"
                      name="hours"
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  Tracked Hours
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-0.5 w-4 bg-muted-foreground inline-block" />
                  Daily Target
                </div>
                <div className="ml-auto flex flex-wrap gap-4">
                  <span>
                    Full Days: <span className="font-medium text-foreground">{stats.fullDays}</span>
                  </span>
                  <span>
                    Absent Days: <span className="font-medium text-foreground">{stats.absentDays}</span>
                  </span>
                  {stats.bestDay && (
                    <span>
                      Best Day: <span className="font-medium text-foreground">{stats.bestDay.hours}h</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
