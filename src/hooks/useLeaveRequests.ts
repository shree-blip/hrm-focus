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

// Special leave types configuration
const SPECIAL_LEAVE_TYPES: Record<string, number> = {
  "Wedding Leave": 15,
  "Bereavement Leave": 15,
  "Maternity Leave": 98,
  "Paternity Leave": 22,
};

export function useLeaveRequests() {
  const { user, isManager } = useAuth();
  const [ownRequests, setOwnRequests] = useState<LeaveRequest[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveRequest[]>([]);
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

  // Fetch user's own requests (for management - pending, approved, rejected)
  const fetchOwnRequests = useCallback(async () => {
    if (!user) return [];

    const { data, error } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching own requests:", error);
      return [];
    }

    return data || [];
  }, [user]);

  // Fetch all approved team leaves (for calendar visibility)
  // This should work if you have RLS policy allowing read on approved leaves
  const fetchTeamLeaves = useCallback(async () => {
    if (!user) return [];

    // Fetch all approved leave requests for team calendar
    const { data, error } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "approved")
      .order("start_date", { ascending: true });

    if (error) {
      console.error("Error fetching team leaves:", error);
      return [];
    }

    return data || [];
  }, [user]);

  // Fetch pending requests for managers to approve
  const fetchPendingForManager = useCallback(async () => {
    if (!user || !isManager) return [];

    const { data, error } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "pending")
      .neq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching pending requests:", error);
      return [];
    }

    return data || [];
  }, [user, isManager]);

  const fetchRequests = useCallback(async () => {
    if (!user) return;

    // Fetch own requests
    const ownRequestsData = await fetchOwnRequests();

    // Fetch team leaves (approved) for calendar
    const approvedTeamLeaves = await fetchTeamLeaves();

    // Fetch pending requests if manager
    const pendingRequests = isManager ? await fetchPendingForManager() : [];

    // Combine own requests with pending requests for managers
    const allManageableRequests = [...ownRequestsData];

    // Add pending requests from others (for managers)
    pendingRequests.forEach((req) => {
      if (!allManageableRequests.find((r) => r.id === req.id)) {
        allManageableRequests.push(req);
      }
    });

    // Get all unique user IDs from both sets
    const allUserIds = new Set([
      ...allManageableRequests.map((r) => r.user_id),
      ...approvedTeamLeaves.map((r) => r.user_id),
    ]);

    // Fetch profiles for all users
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, email")
      .in("user_id", Array.from(allUserIds));

    const profilesMap = new Map(profilesData?.map((p) => [p.user_id, p]) || []);

    // Add profiles to own requests
    const ownRequestsWithProfiles = allManageableRequests.map((request) => ({
      ...request,
      profile: profilesMap.get(request.user_id) || undefined,
    })) as LeaveRequest[];

    // Add profiles to team leaves
    const teamLeavesWithProfiles = approvedTeamLeaves.map((request) => ({
      ...request,
      profile: profilesMap.get(request.user_id) || undefined,
    })) as LeaveRequest[];

    setOwnRequests(ownRequestsWithProfiles);
    setTeamLeaves(teamLeavesWithProfiles);
  }, [user, isManager, fetchOwnRequests, fetchTeamLeaves, fetchPendingForManager]);

  const fetchBalances = useCallback(async () => {
    if (!user) return;

    const { data: balanceConfigs, error: configError } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("user_id", user.id);

    if (configError || !balanceConfigs) return;

    const { data: approvedRequests, error: requestsError } = await supabase
      .from("leave_requests")
      .select("leave_type, days")
      .eq("user_id", user.id)
      .eq("status", "approved");

    if (requestsError) return;

    const usedDaysByType: Record<string, number> = {};

    approvedRequests?.forEach((request) => {
      if (!usedDaysByType[request.leave_type]) {
        usedDaysByType[request.leave_type] = 0;
      }
      usedDaysByType[request.leave_type] += request.days;
    });

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
        },
        () => {
          loadAllData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAllData, user]);

  const createRequest = async (request: { leave_type: string; start_date: Date; end_date: Date; reason: string }) => {
    if (!user) return;

    let days: number;

    if (SPECIAL_LEAVE_TYPES[request.leave_type]) {
      days = SPECIAL_LEAVE_TYPES[request.leave_type];
    } else {
      days = Math.ceil((request.end_date.getTime() - request.start_date.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    if (request.leave_type === "Annual Leave") {
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
      } else {
        const usedAnnualLeave = ownRequests
          .filter((r) => r.status === "approved" && r.leave_type === "Annual Leave" && r.user_id === user.id)
          .reduce((sum, r) => sum + r.days, 0);

        if (days > 12 - usedAnnualLeave) {
          toast({
            title: "Insufficient Balance",
            description: `You only have ${12 - usedAnnualLeave} days available for Annual Leave.`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

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

      await createNotification(
        user.id,
        "Leave Request Submitted",
        `Your ${request.leave_type} request for ${days} day(s) has been submitted and is pending approval.`,
        "leave",
        `/leave`,
      );

      // Notify managers
      const { data: managers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["manager", "admin", "vp"]);

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

      await loadAllData();
    }
  };

  const approveRequest = async (requestId: string) => {
    if (!user || !isManager) return;

    const { data: requestData } = await supabase.from("leave_requests").select("*").eq("id", requestId).single();

    if (!requestData) {
      toast({
        title: "Error",
        description: "Leave request not found",
        variant: "destructive",
      });
      return;
    }

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

      await createNotification(
        requestData.user_id,
        "Leave Request Approved",
        `Your ${requestData.leave_type} request for ${requestData.days} day(s) has been approved by ${managerName}.`,
        "leave",
        `/leave`,
      );

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

    const { data: requestData } = await supabase.from("leave_requests").select("*").eq("id", requestId).single();

    if (!requestData) {
      toast({
        title: "Error",
        description: "Leave request not found",
        variant: "destructive",
      });
      return;
    }

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

      await createNotification(
        requestData.user_id,
        "Leave Request Rejected",
        `Your ${requestData.leave_type} request for ${requestData.days} day(s) has been rejected by ${managerName}. Reason: ${rejectionReason}`,
        "leave",
        `/leave`,
      );

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

  // For managers, we need all requests to display pending requests from team
  const getAllRequests = () => {
    const allRequests = [...ownRequests];
    // Add team leaves that aren't already in ownRequests
    teamLeaves.forEach((tl) => {
      if (!allRequests.find((r) => r.id === tl.id)) {
        allRequests.push(tl);
      }
    });
    return allRequests;
  };

  return {
    requests: getAllRequests(), // Combined list for manager view
    ownRequests, // Only user's own requests (for employee dashboard)
    teamLeaves, // All approved team leaves (for calendar)
    balances,
    loading,
    createRequest,
    approveRequest,
    rejectRequest,
    refetch: loadAllData,
  };
}
