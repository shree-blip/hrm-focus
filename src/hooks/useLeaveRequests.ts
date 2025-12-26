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
  rejection_reason: string | null;
  created_at: string;
  // Joined profile data
  profile?: {
    first_name: string;
    last_name: string;
    email: string;
  };
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

    // Fetch leave requests
    let query = supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });

    // If manager, fetch all; otherwise only own
    if (!isManager) {
      query = query.eq("user_id", user.id);
    }

    const { data: leaveData, error: leaveError } = await query;

    if (leaveError || !leaveData) {
      setLoading(false);
      return;
    }

    // Fetch profiles for all unique user_ids
    const userIds = [...new Set(leaveData.map(r => r.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, email")
      .in("user_id", userIds);

    // Map profiles to requests
    const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
    
    const requestsWithProfiles = leaveData.map(request => ({
      ...request,
      profile: profilesMap.get(request.user_id) || undefined,
    })) as LeaveRequest[];

    setRequests(requestsWithProfiles);
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

    // Format dates as YYYY-MM-DD using local date components to avoid timezone shifts
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      leave_type: request.leave_type,
      start_date: formatLocalDate(request.start_date),
      end_date: formatLocalDate(request.end_date),
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
