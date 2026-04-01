import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Coffee, Pause, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration } from "@/lib/timeFormat";
import { format } from "date-fns";

interface BreakSession {
  id: string;
  session_type: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
}

interface BreakPausePopoverProps {
  attendanceLogId: string;
  type: "break" | "pause";
  totalMinutes: number;
  /** Legacy single start/end from attendance_logs as fallback */
  legacyStart?: string | null;
  legacyEnd?: string | null;
}

export function BreakPausePopover({
  attendanceLogId,
  type,
  totalMinutes,
  legacyStart,
  legacyEnd,
}: BreakPausePopoverProps) {
  const [sessions, setSessions] = useState<BreakSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const isBreak = type === "break";
  const colorClass = isBreak ? "text-yellow-600" : "text-cyan-600";
  const Icon = isBreak ? Coffee : Pause;
  const label = isBreak ? "Break" : "Pause";

  const fetchSessions = async () => {
    if (fetched) return;
    setLoading(true);
    const { data } = await supabase
      .from("attendance_break_sessions")
      .select("id, session_type, start_time, end_time, duration_minutes")
      .eq("attendance_log_id", attendanceLogId)
      .eq("session_type", type)
      .order("start_time", { ascending: true });

    if (data && data.length > 0) {
      setSessions(data);
    }
    setFetched(true);
    setLoading(false);
  };

  if (totalMinutes <= 0 && !legacyStart) {
    return <span>-</span>;
  }

  return (
    <Popover onOpenChange={(open) => open && fetchSessions()}>
      <PopoverTrigger asChild>
        <button className={`${colorClass} font-medium text-xs hover:underline cursor-pointer`}>
          {totalMinutes > 0 ? formatDuration(totalMinutes) : "—"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" side="bottom" align="start">
        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${colorClass}`} /> {label} Details
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs text-muted-foreground">Loading...</span>
          </div>
        ) : sessions.length > 0 ? (
          <div className="space-y-1.5">
            {sessions.map((s, i) => {
              const dur = s.duration_minutes || (s.start_time && s.end_time
                ? Math.round((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000)
                : 0);
              return (
                <div key={s.id} className="flex items-center justify-between text-xs rounded border p-1.5 bg-background">
                  <span className={`font-mono ${colorClass}`}>
                    {format(new Date(s.start_time), "h:mm a")} –{" "}
                    {s.end_time ? format(new Date(s.end_time), "h:mm a") : "ongoing"}
                  </span>
                  {dur > 0 && (
                    <span className="text-muted-foreground">{dur}m</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : legacyStart ? (
          <div className="flex items-center justify-between text-xs rounded border p-1.5 bg-background">
            <span className={`font-mono ${colorClass}`}>
              {format(new Date(legacyStart), "h:mm a")} –{" "}
              {legacyEnd ? format(new Date(legacyEnd), "h:mm a") : "ongoing"}
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No detailed times recorded</p>
        )}

        {totalMinutes > 0 && (
          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
            Total: <span className="font-medium text-foreground">{formatDuration(totalMinutes)}</span>
            {sessions.length > 1 && (
              <span className="ml-1">({sessions.length} sessions)</span>
            )}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
