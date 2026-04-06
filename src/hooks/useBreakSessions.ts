import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BreakSession {
  id: string;
  attendance_log_id: string;
  session_type: "break" | "pause";
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
}

/**
 * Hook to lazily fetch break/pause sessions for specific attendance log IDs.
 * Sessions are cached by log ID so repeated expansions don't re-fetch.
 */
export function useBreakSessions() {
  const [sessionsByLogId, setSessionsByLogId] = useState<Record<string, BreakSession[]>>({});
  const [loadingLogIds, setLoadingLogIds] = useState<Set<string>>(new Set());

  const fetchSessions = useCallback(async (logId: string) => {
    // Already cached
    if (sessionsByLogId[logId]) return sessionsByLogId[logId];

    setLoadingLogIds((prev) => new Set(prev).add(logId));

    const { data, error } = await supabase
      .from("attendance_break_sessions")
      .select("id, attendance_log_id, session_type, start_time, end_time, duration_minutes")
      .eq("attendance_log_id", logId)
      .order("start_time", { ascending: true });

    const sessions = (error || !data) ? [] : (data as BreakSession[]);

    setSessionsByLogId((prev) => ({ ...prev, [logId]: sessions }));
    setLoadingLogIds((prev) => {
      const next = new Set(prev);
      next.delete(logId);
      return next;
    });

    return sessions;
  }, [sessionsByLogId]);

  const getSessions = useCallback(
    (logId: string) => sessionsByLogId[logId] || null,
    [sessionsByLogId]
  );

  const isLoading = useCallback(
    (logId: string) => loadingLogIds.has(logId),
    [loadingLogIds]
  );

  return { fetchSessions, getSessions, isLoading };
}
