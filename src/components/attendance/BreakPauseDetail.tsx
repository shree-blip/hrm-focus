import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coffee, Pause, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BreakSession } from "@/hooks/useBreakSessions";

interface LegacyBreakPauseData {
  break_start?: string | null;
  break_end?: string | null;
  total_break_minutes?: number | null;
  pause_start?: string | null;
  pause_end?: string | null;
  total_pause_minutes?: number | null;
}

interface BreakPauseDetailProps {
  sessions: BreakSession[] | null;
  loading: boolean;
  timezone?: string;
  legacyData?: LegacyBreakPauseData;
}

function formatSessionTime(isoString: string | null, tz?: string): string {
  if (!isoString) return "ongoing";
  try {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      ...(tz ? { timeZone: tz } : {}),
    });
  } catch {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
}

function formatDur(minutes: number | null): string {
  if (!minutes || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function BreakPauseDetailPanel({ sessions, loading, timezone }: BreakPauseDetailProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">No individual session records found.</p>
    );
  }

  const breaks = sessions.filter((s) => s.session_type === "break");
  const pauses = sessions.filter((s) => s.session_type === "pause");

  const totalBreakMin = breaks.reduce((s, b) => s + (b.duration_minutes || 0), 0);
  const totalPauseMin = pauses.reduce((s, p) => s + (p.duration_minutes || 0), 0);

  return (
    <div className="space-y-3">
      {/* Sessions table */}
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground w-8">#</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Start</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">End</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Duration</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session, idx) => (
              <tr key={session.id} className="border-b last:border-0">
                <td className="px-3 py-1.5 text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0",
                      session.session_type === "break"
                        ? "border-warning text-warning bg-warning/10"
                        : "border-info text-info bg-info/10"
                    )}
                  >
                    {session.session_type === "break" ? (
                      <><Coffee className="h-2.5 w-2.5 mr-0.5" />Break</>
                    ) : (
                      <><Pause className="h-2.5 w-2.5 mr-0.5" />Pause</>
                    )}
                  </Badge>
                </td>
                <td className="px-3 py-1.5 font-mono">
                  {formatSessionTime(session.start_time, timezone)}
                </td>
                <td className="px-3 py-1.5 font-mono">
                  {session.end_time
                    ? formatSessionTime(session.end_time, timezone)
                    : <span className="text-warning italic">ongoing</span>}
                </td>
                <td className="px-3 py-1.5 font-medium">
                  {formatDur(session.duration_minutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {breaks.length > 0 && (
          <span className="flex items-center gap-1">
            <Coffee className="h-3 w-3 text-warning" />
            Total Breaks: {breaks.length} ({formatDur(totalBreakMin)})
          </span>
        )}
        {pauses.length > 0 && (
          <span className="flex items-center gap-1">
            <Pause className="h-3 w-3 text-info" />
            Total Pauses: {pauses.length} ({formatDur(totalPauseMin)})
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Clickable cell for break or pause duration that triggers session loading/expansion.
 */
interface BreakPauseCellProps {
  totalMinutes: number;
  type: "break" | "pause";
  isExpanded: boolean;
  onToggle: () => void;
  hasLegacyTime?: boolean;
  legacyStart?: string | null;
  legacyEnd?: string | null;
  timezone?: string;
}

export function BreakPauseCell({
  totalMinutes,
  type,
  isExpanded,
  onToggle,
  hasLegacyTime,
  legacyStart,
  legacyEnd,
  timezone,
}: BreakPauseCellProps) {
  if (totalMinutes <= 0 && !hasLegacyTime) {
    return <span className="text-muted-foreground">-</span>;
  }

  const colorClass = type === "break" ? "text-warning" : "text-info";

  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1 text-left group cursor-pointer hover:underline decoration-dotted",
        colorClass
      )}
    >
      {type === "break" ? (
        <Coffee className="h-3 w-3 flex-shrink-0" />
      ) : (
        <Pause className="h-3 w-3 flex-shrink-0" />
      )}
      <span className="font-mono text-xs font-medium">{formatDur(totalMinutes)}</span>
      {isExpanded ? (
        <ChevronUp className="h-3 w-3 opacity-60" />
      ) : (
        <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
      )}
    </button>
  );
}
