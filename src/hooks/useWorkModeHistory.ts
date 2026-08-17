import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WorkModeChange {
  id: string;
  user_id: string;
  attendance_log_id: string | null;
  mode: "wfo" | "wfh";
  applies_on: string; // YYYY-MM-DD
  recorded_at: string; // ISO timestamp
  recorded_by: string | null;
  source: string | null;
}

/**
 * Reads the append-only work mode history (work_mode_changes).
 *
 * Every recorded change is returned as its own entry — consecutive identical
 * values are NEVER collapsed, and the latest value is never applied backwards
 * over earlier entries. Entries are ordered chronologically by recorded_at.
 */
export function useWorkModeHistory(startDate?: string, endDate?: string) {
  const [changes, setChanges] = useState<WorkModeChange[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChanges = useCallback(async () => {
    if (!startDate || !endDate) {
      setChanges([]);
      return;
    }
    setLoading(true);
    const pageSize = 1000;
    let from = 0;
    const all: WorkModeChange[] = [];
    // Paginated read so large ranges are never truncated at the 1000-row API cap.
    for (;;) {
      const { data, error } = await supabase
        .from("work_mode_changes")
        .select("id, user_id, attendance_log_id, mode, applies_on, recorded_at, recorded_by, source")
        .gte("applies_on", startDate)
        .lte("applies_on", endDate)
        .order("recorded_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) {
        console.error("Failed to load work mode history", error);
        break;
      }
      const rows = (data || []) as WorkModeChange[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    setChanges(all);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  /** Chronological entries grouped by `${user_id}|${YYYY-MM-DD}`. */
  const byUserDate = useMemo(() => {
    const map = new Map<string, WorkModeChange[]>();
    changes.forEach((change) => {
      const key = `${change.user_id}|${change.applies_on}`;
      const list = map.get(key);
      if (list) list.push(change);
      else map.set(key, [change]);
    });
    map.forEach((list) =>
      list.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()),
    );
    return map;
  }, [changes]);

  const getChangesFor = useCallback(
    (userId: string, dateKey: string) => byUserDate.get(`${userId}|${dateKey}`) || [],
    [byUserDate],
  );

  return { changes, byUserDate, getChangesFor, loading, refetch: fetchChanges };
}