import { useState, useEffect, useCallback } from "react";
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
  // original values (saved by trigger before first apply, used for revert)
  original_clock_in: string | null;
  original_clock_out: string | null;
  original_break_minutes: number | null;
  original_pause_minutes: number | null;
  // override fields (CEO/Admin only)
  override_status: "approved" | "rejected" | null;
  override_by: string | null;
  override_comment: string | null;
  override_at: string | null;
  // joined fields
  attendance_log?: AttendanceLogRecord | null;
  requester_profile?: { first_name: string; last_name: string } | null;
  reviewer_profile?: { first_name: string; last_name: string } | null;
  override_profile?: { first_name: string; last_name: string } | null;
}

// Table not yet in generated Database types — confine the cast here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adjTable = () => (supabase as unknown as any).from("attendance_adjustment_requests");

export function useAttendanceAdjustments() {
  const { user, isManager, isVP, isAdmin, isLineManager } = useAuth();
  const [myRequests, setMyRequests] = useState<AdjustmentRequest[]>([]);
  const [teamRequests, setTeamRequests] = useState<AdjustmentRequest[]>([]);
  const [loading, setLoading] = useState(false);

  /*
   * NOTE: No applyAdjustment / revertAdjustment RPC calls needed!
   * The database trigger `trg_apply_attendance_adjustment` automatically:
   *   - Saves original values & applies proposed values when status → approved
   *   - Reverts to original values when status approved → rejected (override)
   * All we need to do is UPDATE the status column — the trigger does the rest.
   */

  // Fetch requests the current user submitted
  const fetchMyRequests = useCallback(async () => {
    if (!user) return;
    const { data, error } = await adjTable()
      .select("*")
      .eq("requested_by", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const enriched = await Promise.all(
        (data as AdjustmentRequest[]).map(async (req) => {
          let reviewer_profile = null;
          if (req.reviewer_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("user_id", req.reviewer_id)
              .single();
            reviewer_profile = profile || null;
          }
          let override_profile = null;
          if (req.override_by) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("user_id", req.override_by)
              .single();
            override_profile = profile || null;
          }
          return { ...req, reviewer_profile, override_profile };
        }),
      );
      setMyRequests(enriched);
    }
  }, [user]);

  // Fetch pending requests for team (line manager / VP / admin)
  const fetchTeamRequests = useCallback(async () => {
    if (!user) return;
    if (!isManager && !isVP && !isAdmin && !isLineManager) return;

    // For line managers / managers (non-VP, non-admin): scope to recursive team tree
    let teamUserIds: string[] | null = null;
    if (!isVP && !isAdmin) {
      teamUserIds = await resolveTeamMemberUserIds(user.id);
      console.debug("[hierarchy][attendance_adjustments] team user ids", {
        managerUserId: user.id,
        teamUserIdsCount: teamUserIds.length,
        teamUserIds,
      });
      if (!teamUserIds || teamUserIds.length === 0) return;
    }

    // Fetch adjustment requests
    const { data, error } = await adjTable().select("*").order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching team adjustment requests:", error.message);
      return;
    }

    if (data) {
      let filtered = (data as AdjustmentRequest[]).filter((r) => r.requested_by !== user.id);

      // If scoped to team, only keep requests from direct reports
      if (teamUserIds) {
        filtered = filtered.filter((r) => teamUserIds!.includes(r.requested_by));
      }

      // Enrich with requester profile, attendance log, reviewer profile, and override profile
      const enriched = await Promise.all(
        filtered.map(async (req) => {
          const [profileRes, logRes, reviewerRes, overrideRes] = await Promise.all([
            supabase.from("profiles").select("first_name, last_name").eq("user_id", req.requested_by).single(),
            supabase
              .from("attendance_logs")
              .select("clock_in, clock_out, total_break_minutes, total_pause_minutes, clock_type")
              .eq("id", req.attendance_log_id)
              .single(),
            req.reviewer_id
              ? supabase.from("profiles").select("first_name, last_name").eq("user_id", req.reviewer_id).single()
              : Promise.resolve({ data: null }),
            req.override_by
              ? supabase.from("profiles").select("first_name, last_name").eq("user_id", req.override_by).single()
              : Promise.resolve({ data: null }),
          ]);
          return {
            ...req,
            requester_profile: profileRes.data || null,
            attendance_log: logRes.data || null,
            reviewer_profile: reviewerRes.data || null,
            override_profile: overrideRes.data || null,
          };
        }),
      );
      setTeamRequests(enriched);
    }
  }, [user, isManager, isVP, isAdmin, isLineManager]);

  // Submit an adjustment request
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
    await fetchMyRequests();
    return true;
  };

  // Manager reviews a request
  // The trigger automatically applies proposed values when status → approved
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

    // Notify the requester
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

    await fetchTeamRequests();
    return true;
  };

  // CEO/Admin overrides a previously reviewed request
  // The trigger automatically:
  //   - Applies proposed values when status changes TO approved
  //   - Reverts to original values when status changes FROM approved TO rejected
  const overrideRequest = async (requestId: string, decision: "approved" | "rejected", comment: string) => {
    if (!user) return false;

    const { error } = await adjTable()
      .update({
        override_status: decision,
        override_by: user.id,
        override_comment: comment,
        override_at: new Date().toISOString(),
        // Update main status — this is what the trigger watches
        status: decision,
      })
      .eq("id", requestId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }

    // Notify the requester
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

    await fetchTeamRequests();
    return true;
  };

  // Get the latest adjustment status for a specific attendance log
  const getAdjustmentStatus = (logId: string): AdjustmentRequest | undefined => {
    return myRequests.find((r) => r.attendance_log_id === logId);
  };

  // Initial fetch + realtime
  useEffect(() => {
    fetchMyRequests();
    fetchTeamRequests();
  }, [fetchMyRequests, fetchTeamRequests]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("attendance-adjustments")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_adjustment_requests" }, () => {
        fetchMyRequests();
        fetchTeamRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchMyRequests, fetchTeamRequests]);

  return {
    myRequests,
    teamRequests,
    loading,
    submitRequest,
    reviewRequest,
    overrideRequest,
    getAdjustmentStatus,
    refetch: () => Promise.all([fetchMyRequests(), fetchTeamRequests()]),
  };
}
