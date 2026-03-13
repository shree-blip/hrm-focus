import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

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
  // joined fields
  attendance_log?: AttendanceLogRecord | null;
  requester_profile?: { first_name: string; last_name: string } | null;
}

// Table not yet in generated Database types — confine the cast here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adjTable = () => (supabase as unknown as any).from("attendance_adjustment_requests");

export function useAttendanceAdjustments() {
  const { user, isManager, isVP, isAdmin, isLineManager } = useAuth();
  const [myRequests, setMyRequests] = useState<AdjustmentRequest[]>([]);
  const [teamRequests, setTeamRequests] = useState<AdjustmentRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch requests the current user submitted
  const fetchMyRequests = useCallback(async () => {
    if (!user) return;
    const { data, error } = await adjTable()
      .select("*")
      .eq("requested_by", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setMyRequests(data as AdjustmentRequest[]);
    }
  }, [user]);

  // Fetch pending requests for team (line manager / VP / admin)
  const fetchTeamRequests = useCallback(async () => {
    if (!user) return;
    if (!isManager && !isVP && !isAdmin && !isLineManager) return;

    // For line managers / managers (non-VP, non-admin): scope to their direct reports only
    let teamUserIds: string[] | null = null;
    if (!isVP && !isAdmin) {
      // Get the current user's employee ID
      const { data: empId } = await supabase.rpc("get_employee_id_for_user", { _user_id: user.id });
      if (!empId) return;

      // Get direct reports (employees where line_manager_id or manager_id = this employee)
      const { data: reports } = await supabase
        .from("employees")
        .select("id, profile_id")
        .or(`line_manager_id.eq.${empId},manager_id.eq.${empId}`);

      if (!reports || reports.length === 0) return;

      // Get user_ids for these employees via profiles
      const profileIds = reports.map((r) => r.profile_id).filter(Boolean);
      if (profileIds.length === 0) return;

      const { data: profileUsers } = await supabase
        .from("profiles")
        .select("user_id")
        .in("id", profileIds);

      teamUserIds = (profileUsers || []).map((p) => p.user_id).filter(Boolean) as string[];
      if (teamUserIds.length === 0) return;
    }

    // Fetch adjustment requests
    const { data, error } = await adjTable()
      .select("*")
      .order("created_at", { ascending: false });

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

      // Enrich with requester profile and attendance log
      const enriched = await Promise.all(
        filtered.map(async (req) => {
          const [profileRes, logRes] = await Promise.all([
            supabase.from("profiles").select("first_name, last_name").eq("user_id", req.requested_by).single(),
            supabase.from("attendance_logs").select("clock_in, clock_out, total_break_minutes, total_pause_minutes, clock_type").eq("id", req.attendance_log_id).single(),
          ]);
          return {
            ...req,
            requester_profile: profileRes.data || null,
            attendance_log: logRes.data || null,
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

    const { error } = await adjTable()
      .insert({
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
  const reviewRequest = async (
    requestId: string,
    decision: "approved" | "rejected",
    comment: string,
  ) => {
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
          p_message: decision === "approved"
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
      description: decision === "approved"
        ? "The attendance record has been updated automatically."
        : "The request has been rejected.",
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_adjustment_requests" },
        () => {
          fetchMyRequests();
          fetchTeamRequests();
        },
      )
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
    getAdjustmentStatus,
    refetch: () => Promise.all([fetchMyRequests(), fetchTeamRequests()]),
  };
}
