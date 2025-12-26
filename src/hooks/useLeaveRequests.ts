import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

interface LeaveBalance {
  id: string;
  leave_type: string;
  total_days: number;
  used_days: number;
}

export function useLeaveRequests() {
  const { user, isManager } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) return;

    let query = supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });

    // If manager, fetch all; otherwise only own
    if (!isManager) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;

    if (!error && data) {
      setRequests(data as LeaveRequest[]);
    }
    setLoading(false);
  }, [user, isManager]);

  const fetchBalances = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("user_id", user.id);

    if (!error && data) {
      setBalances(data as LeaveBalance[]);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
    fetchBalances();
  }, [fetchRequests, fetchBalances]);

  const createRequest = async (request: {
    leave_type: string;
    start_date: Date;
    end_date: Date;
    reason: string;
  }) => {
    if (!user) return;

    const days = Math.ceil(
      (request.end_date.getTime() - request.start_date.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      leave_type: request.leave_type,
      start_date: request.start_date.toISOString().split("T")[0],
      end_date: request.end_date.toISOString().split("T")[0],
      days,
      reason: request.reason,
      status: "pending",
    });

    if (error) {
      toast({ title: "Error", description: "Failed to submit request", variant: "destructive" });
    } else {
      toast({ title: "Request Submitted", description: "Your leave request is pending approval." });
      fetchRequests();
    }
  };

  const approveRequest = async (requestId: string) => {
    if (!user || !isManager) return;

    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) {
      toast({ title: "Error", description: "Failed to approve request", variant: "destructive" });
    } else {
      toast({ title: "Approved", description: "Leave request has been approved." });
      fetchRequests();
    }
  };

  const rejectRequest = async (requestId: string, reason?: string) => {
    if (!user || !isManager) return;

    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq("id", requestId);

    if (error) {
      toast({ title: "Error", description: "Failed to reject request", variant: "destructive" });
    } else {
      toast({ title: "Rejected", description: "Leave request has been rejected.", variant: "destructive" });
      fetchRequests();
    }
  };

  return {
    requests,
    balances,
    loading,
    createRequest,
    approveRequest,
    rejectRequest,
    refetch: () => {
      fetchRequests();
      fetchBalances();
    },
  };
}
