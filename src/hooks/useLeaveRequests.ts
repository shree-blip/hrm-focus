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

  const createNotification = async (
    userId: string,
    title: string,
    message: string,
    type: string = "leave",
    link: string | null = "/leave",
  ) => {
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        title,
        message,
        type,
        link,
        is_read: false,
      });

      if (error) {
        console.error("Error creating notification:", error);
      }
    } catch (error) {
      console.error("Failed to create notification:", error);
    }
  };

  const fetchRequests = useCallback(async () => {
    if (!user) return;

    // Fetch leave requests
    let query = supabase.from("leave_requests").select("*").order("created_at", { ascending: false });

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
    const userIds = [...new Set(leaveData.map((r) => r.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, email")
      .in("user_id", userIds);

    // Map profiles to requests
    const profilesMap = new Map(profilesData?.map((p) => [p.user_id, p]) || []);

    const requestsWithProfiles = leaveData.map((request) => ({
      ...request,
      profile: profilesMap.get(request.user_id) || undefined,
    })) as LeaveRequest[];

    setRequests(requestsWithProfiles);
  }, [user, isManager]);

  const fetchBalances = useCallback(async () => {
    if (!user) return;

    // First, get the leave balances configuration
    const { data: balanceConfigs, error: configError } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("user_id", user.id);

    if (configError || !balanceConfigs) return;

    // Then, calculate used days from approved leave requests
    const { data: approvedRequests, error: requestsError } = await supabase
      .from("leave_requests")
      .select("leave_type, days")
      .eq("user_id", user.id)
      .eq("status", "approved");

    if (requestsError) return;

    // Calculate used days per leave type
    const usedDaysByType: Record<string, number> = {};

    approvedRequests?.forEach((request) => {
      if (!usedDaysByType[request.leave_type]) {
        usedDaysByType[request.leave_type] = 0;
      }
      usedDaysByType[request.leave_type] += request.days;
    });

    // Merge configuration with calculated used days
    const updatedBalances = balanceConfigs.map((config) => ({
      ...config,
      used_days: usedDaysByType[config.leave_type] || 0,
    })) as LeaveBalance[];

    setBalances(updatedBalances);
  }, [user]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchRequests(), fetchBalances()]);
    setLoading(false);
  }, [fetchRequests, fetchBalances]);

  useEffect(() => {
    loadAllData();

    // Set up real-time subscription for leave requests
    const channel = supabase
      .channel("leave-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leave_requests",
          filter: isManager ? undefined : `user_id=eq.${user?.id}`,
        },
        () => {
          loadAllData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAllData, user, isManager]);

  const createRequest = async (request: { leave_type: string; start_date: Date; end_date: Date; reason: string }) => {
    if (!user) return;

    const days = Math.ceil((request.end_date.getTime() - request.start_date.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // First, check available balance
    const balanceForType = balances.find((b) => b.leave_type === request.leave_type);
    if (balanceForType) {
      const availableDays = balanceForType.total_days - balanceForType.used_days;
      if (days > availableDays) {
        toast({
          title: "Insufficient Balance",
          description: `You only have ${availableDays} days available for ${request.leave_type}.`,
          variant: "destructive",
        });
        return;
      }
    }

    // Format dates as YYYY-MM-DD using local date components
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // Fetch user profile for notification
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .single();

    const userName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : "Employee";

    const { data: newRequest, error } = await supabase
      .from("leave_requests")
      .insert({
        user_id: user.id,
        leave_type: request.leave_type,
        start_date: formatLocalDate(request.start_date),
        end_date: formatLocalDate(request.end_date),
        days,
        reason: request.reason,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to submit leave request",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request Submitted",
        description: "Your leave request is pending approval.",
      });

      // Notify the employee
      await createNotification(
        user.id,
        "Leave Request Submitted",
        `Your ${request.leave_type} request for ${days} day(s) has been submitted and is pending approval.`,
        "leave",
        `/leave`,
      );

      // If there are managers, notify them too
      if (isManager) {
        // Find all users who have manager role (adjust based on your actual schema)
        const { data: managers } = await supabase.from("profiles").select("user_id");

        if (managers && Array.isArray(managers)) {
          for (const manager of managers) {
            if (manager.user_id !== user.id) {
              await createNotification(
                manager.user_id,
                "New Leave Request",
                `${userName} submitted a ${request.leave_type} request for ${days} day(s) (${formatLocalDate(request.start_date)} to ${formatLocalDate(request.end_date)}).`,
                "leave",
                `/leave`,
              );
            }
          }
        }
      }

      await loadAllData();
    }
  };

  const approveRequest = async (requestId: string) => {
    if (!user || !isManager) return;

    // Get the request details before approval
    const { data: requestData } = await supabase.from("leave_requests").select("*").eq("id", requestId).single();

    if (!requestData) {
      toast({
        title: "Error",
        description: "Leave request not found",
        variant: "destructive",
      });
      return;
    }

    // Fetch profile separately
    const { data: requestProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("user_id", requestData.user_id)
      .single();

    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to approve request",
        variant: "destructive",
      });
    } else {
      // Get manager's name for notification
      const { data: managerProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .single();

      const managerName = managerProfile ? `${managerProfile.first_name} ${managerProfile.last_name}` : "Manager";

      const userName = requestProfile ? `${requestProfile.first_name} ${requestProfile.last_name}` : "Employee";

      toast({
        title: "Approved",
        description: "Leave request has been approved.",
      });

      // Notify the employee
      await createNotification(
        requestData.user_id,
        "Leave Request Approved",
        `Your ${requestData.leave_type} request for ${requestData.days} day(s) has been approved by ${managerName}.`,
        "leave",
        `/leave`,
      );

      // Notify the manager who approved
      await createNotification(
        user.id,
        "Leave Request Approved",
        `You approved ${userName}'s ${requestData.leave_type} request for ${requestData.days} day(s).`,
        "leave",
        `/leave`,
      );

      await loadAllData();
    }
  };

  const rejectRequest = async (requestId: string, reason?: string) => {
    if (!user || !isManager) return;

    // Get the request details before rejection
    const { data: requestData } = await supabase.from("leave_requests").select("*").eq("id", requestId).single();

    if (!requestData) {
      toast({
        title: "Error",
        description: "Leave request not found",
        variant: "destructive",
      });
      return;
    }

    // Fetch profile separately
    const { data: requestProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("user_id", requestData.user_id)
      .single();

    const rejectionReason = reason || "Request denied by manager";

    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      })
      .eq("id", requestId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive",
      });
    } else {
      // Get manager's name for notification
      const { data: managerProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .single();

      const managerName = managerProfile ? `${managerProfile.first_name} ${managerProfile.last_name}` : "Manager";

      const userName = requestProfile ? `${requestProfile.first_name} ${requestProfile.last_name}` : "Employee";

      toast({
        title: "Rejected",
        description: "Leave request has been rejected.",
        variant: "destructive",
      });

      // Notify the employee
      await createNotification(
        requestData.user_id,
        "Leave Request Rejected",
        `Your ${requestData.leave_type} request for ${requestData.days} day(s) has been rejected by ${managerName}. Reason: ${rejectionReason}`,
        "leave",
        `/leave`,
      );

      // Notify the manager who rejected
      await createNotification(
        user.id,
        "Leave Request Rejected",
        `You rejected ${userName}'s ${requestData.leave_type} request. Reason: ${rejectionReason}`,
        "leave",
        `/leave`,
      );

      await loadAllData();
    }
  };

  return {
    requests,
    balances,
    loading,
    createRequest,
    approveRequest,
    rejectRequest,
    refetch: loadAllData,
  };
}
