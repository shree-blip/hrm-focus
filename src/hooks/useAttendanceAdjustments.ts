import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { resolveTeamMemberUserIds } from "@/utils/teamResolver";

export interface AttendanceLogRecord {
  clock_in: string;
  clock_out: string | null;
  total_break_minutes: number;
  total_pause_minutes: number;
  clock_type: string | null;
}

export interface AdjustmentRequest {
  id: string;
  attendance_log_id: string;
  requested_by: string;
  reviewer_id: string | null;
  proposed_clock_in: string | null;
  proposed_clock_out: string | null;
  proposed_break_minutes: number | null;
  proposed_pause_minutes: number | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewer_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
  original_clock_in: string | null;
  original_clock_out: string | null;
  original_break_minutes: number | null;
  original_pause_minutes: number | null;
  override_status: "approved" | "rejected" | null;
  override_by: string | null;
  override_comment: string | null;
  override_at: string | null;
  attendance_log?: AttendanceLogRecord | null;
  requester_profile?: { first_name: string; last_name: string } | null;
  reviewer_profile?: { first_name: string; last_name: string } | null;
  override_profile?: { first_name: string; last_name: string } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adjTable = () => (supabase as unknown as any).from("attendance_adjustment_requests");

const SELECT_COLS = [
  "id","attendance_log_id","requested_by","reviewer_id",
  "proposed_clock_in","proposed_clock_out","proposed_break_minutes","proposed_pause_minutes",
  "reason","status","reviewer_comment","reviewed_at","created_at",
  "original_clock_in","original_clock_out","original_break_minutes","original_pause_minutes",
  "override_status","override_by","override_comment","override_at",
].join(",");

// Module-level realtime singleton — avoid duplicate subscriptions across consumers
let realtimeRefCount = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let realtimeChannel: any = null;

function ensureRealtime(onChange: () => void) {
  realtimeRefCount += 1;
  if (!realtimeChannel) {
    realtimeChannel = supabase
      .channel("attendance-adjustments-shared")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_adjustment_requests" },
        () => onChange(),
      )
      .subscribe();
  }
  return () => {
    realtimeRefCount -= 1;
    if (realtimeRefCount <= 0 && realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
      realtimeRefCount = 0;
    }
  };
}

// Batch profile lookups (single .in() instead of N+1)
async function fetchProfilesByUserIds(userIds: string[]) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return new Map<string, { first_name: string; last_name: string }>();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, first_name, last_name")
    .in("user_id", unique);
  const map = new Map<string, { first_name: string; last_name: string }>();
  (data || []).forEach((p: { user_id: string; first_name: string; last_name: string }) => {
    map.set(p.user_id, { first_name: p.first_name, last_name: p.last_name });
  });
  return map;
}

async function fetchAttendanceLogs(logIds: string[]) {
  const unique = Array.from(new Set(logIds.filter(Boolean)));
  if (unique.length === 0) return new Map<string, AttendanceLogRecord>();
  const { data } = await supabase
    .from("attendance_logs")
    .select("id, clock_in, clock_out, total_break_minutes, total_pause_minutes, clock_type")
    .in("id", unique);
  const map = new Map<string, AttendanceLogRecord>();
  (data || []).forEach((l: AttendanceLogRecord & { id: string }) => {
    const { id, ...rest } = l;
    map.set(id, rest);
  });
  return map;
}

export function useAttendanceAdjustments() {
  const { user, isManager, isVP, isAdmin, isLineManager } = useAuth();
  const queryClient = useQueryClient();

  const canSeeTeam = !!user && (isManager || isVP || isAdmin || isLineManager);

  // ── My Requests ───────────────────────────────────────────
  const myQuery = useQuery({
    queryKey: ["attendance-adjustments", "mine", user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<AdjustmentRequest[]> => {
      if (!user) return [];
      const { data, error } = await adjTable()
        .select(SELECT_COLS)
        .eq("requested_by", user.id)
        .order("created_at", { ascending: false });
      if (error || !data) return [];
      const rows = data as AdjustmentRequest[];
      const profiles = await fetchProfilesByUserIds([
        ...rows.map((r) => r.reviewer_id || ""),
        ...rows.map((r) => r.override_by || ""),
      ]);
      return rows.map((r) => ({
        ...r,
        reviewer_profile: r.reviewer_id ? profiles.get(r.reviewer_id) || null : null,
        override_profile: r.override_by ? profiles.get(r.override_by) || null : null,
      }));
    },
  });

  // ── Team Requests ─────────────────────────────────────────
  const teamQuery = useQuery({
    queryKey: ["attendance-adjustments", "team", user?.id, isVP, isAdmin, isManager, isLineManager],
    enabled: canSeeTeam,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<AdjustmentRequest[]> => {
      if (!user) return [];

      let teamUserIds: string[] | null = null;
      if (!isVP && !isAdmin) {
        teamUserIds = await resolveTeamMemberUserIds(user.id);
        if (!teamUserIds || teamUserIds.length === 0) return [];
      }

      const { data, error } = await adjTable()
        .select(SELECT_COLS)
        .order("created_at", { ascending: false });
      if (error || !data) return [];

      let filtered = (data as AdjustmentRequest[]).filter((r) => r.requested_by !== user.id);
      if (teamUserIds) {
        const set = new Set(teamUserIds);
        filtered = filtered.filter((r) => set.has(r.requested_by));
      }

      const [profiles, logs] = await Promise.all([
        fetchProfilesByUserIds([
          ...filtered.map((r) => r.requested_by),
          ...filtered.map((r) => r.reviewer_id || ""),
          ...filtered.map((r) => r.override_by || ""),
        ]),
        fetchAttendanceLogs(filtered.map((r) => r.attendance_log_id)),
      ]);

      return filtered.map((r) => ({
        ...r,
        requester_profile: profiles.get(r.requested_by) || null,
        reviewer_profile: r.reviewer_id ? profiles.get(r.reviewer_id) || null : null,
        override_profile: r.override_by ? profiles.get(r.override_by) || null : null,
        attendance_log: logs.get(r.attendance_log_id) || null,
      }));
    },
  });

  // ── Realtime: invalidate shared cache (single subscription) ──
  useEffect(() => {
    if (!user) return;
    const cleanup = ensureRealtime(() => {
      queryClient.invalidateQueries({ queryKey: ["attendance-adjustments"] });
    });
    return cleanup;
  }, [user, queryClient]);

  const myRequests = myQuery.data || [];
  const teamRequests = teamQuery.data || [];

  const submitRequest = async (data: {
    attendance_log_id: string;
    proposed_clock_in?: string;
    proposed_clock_out?: string;
    proposed_break_minutes?: number;
    proposed_pause_minutes?: number;
    reason: string;
  }) => {
    if (!user) return;
    const { error } = await adjTable().insert({
      attendance_log_id: data.attendance_log_id,
      requested_by: user.id,
      proposed_clock_in: data.proposed_clock_in || null,
      proposed_clock_out: data.proposed_clock_out || null,
      proposed_break_minutes: data.proposed_break_minutes ?? null,
      proposed_pause_minutes: data.proposed_pause_minutes ?? null,
      reason: data.reason,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Request Submitted", description: "Your adjustment request has been sent to your manager." });
    queryClient.invalidateQueries({ queryKey: ["attendance-adjustments", "mine", user.id] });
    return true;
  };

  const reviewRequest = async (requestId: string, decision: "approved" | "rejected", comment: string) => {
    if (!user) return;
    const { error } = await adjTable()
      .update({
        status: decision,
        reviewer_id: user.id,
        reviewer_comment: comment,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    try {
      const req = teamRequests.find((r) => r.id === requestId);
      if (req) {
        await supabase.rpc("create_notification", {
          p_user_id: req.requested_by,
          p_title: decision === "approved" ? "✅ Adjustment Approved" : "❌ Adjustment Rejected",
          p_message:
            decision === "approved"
              ? `Your attendance adjustment request has been approved. Your log has been updated.`
              : `Your attendance adjustment request was rejected. Reason: ${comment}`,
          p_type: "attendance",
          p_link: "/attendance",
        });
      }
    } catch (err) {
      console.error("Error sending adjustment notification:", err);
    }
    toast({
      title: decision === "approved" ? "Approved" : "Rejected",
      description:
        decision === "approved"
          ? "The attendance record has been updated automatically."
          : "The request has been rejected.",
    });
    queryClient.invalidateQueries({ queryKey: ["attendance-adjustments"] });
    return true;
  };

  const overrideRequest = async (requestId: string, decision: "approved" | "rejected", comment: string) => {
    if (!user) return false;
    const { error } = await adjTable()
      .update({
        override_status: decision,
        override_by: user.id,
        override_comment: comment,
        override_at: new Date().toISOString(),
        status: decision,
      })
      .eq("id", requestId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    try {
      const existingReq = teamRequests.find((r) => r.id === requestId);
      if (existingReq) {
        await supabase.rpc("create_notification", {
          p_user_id: existingReq.requested_by,
          p_title: decision === "approved" ? "✅ Adjustment Override: Approved" : "❌ Adjustment Override: Rejected",
          p_message:
            decision === "approved"
              ? "Your attendance adjustment has been approved by senior management. Your log has been updated."
              : `Your attendance adjustment was overridden to rejected by senior management. Your log has been reverted to original values. Reason: ${comment}`,
          p_type: "attendance",
          p_link: "/attendance",
        });
      }
    } catch (err) {
      console.error("Error sending override notification:", err);
    }
    toast({
      title: "Override Applied",
      description:
        decision === "approved"
          ? "Request approved — attendance record updated."
          : "Request rejected — attendance record reverted to original values.",
    });
    queryClient.invalidateQueries({ queryKey: ["attendance-adjustments"] });
    return true;
  };

  const myRequestsByLog = useMemo(() => {
    const m = new Map<string, AdjustmentRequest>();
    myRequests.forEach((r) => {
      if (!m.has(r.attendance_log_id)) m.set(r.attendance_log_id, r);
    });
    return m;
  }, [myRequests]);

  const getAdjustmentStatus = (logId: string): AdjustmentRequest | undefined =>
    myRequestsByLog.get(logId);

  return {
    myRequests,
    teamRequests,
    loading: myQuery.isLoading || teamQuery.isLoading,
    submitRequest,
    reviewRequest,
    overrideRequest,
    getAdjustmentStatus,
    refetch: () => Promise.all([myQuery.refetch(), teamQuery.refetch()]),
  };
}
