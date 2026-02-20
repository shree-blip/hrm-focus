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

// Helper to check if a leave type is "Leave on Lieu" (date-based)
const isLeaveOnLieuType = (leaveType: string) => {
  return leaveType.startsWith("Leave on Lieu");
};

// Helper to check if a leave type is "Other Leave" (reason-based)
const isOtherLeaveType = (leaveType: string) => {
  return leaveType.startsWith("Other Leave");
};

// Legacy support: old "Leave on Leave" prefix
const isLeaveOnLeaveType = (leaveType: string) => {
  return leaveType.startsWith("Leave on Leave") || leaveType.startsWith("Leave on Lieu");
};

export function useLeaveRequests() {
  const { user, isManager, isLineManager, isSupervisor, isVP, isAdmin, role } = useAuth();
  const [ownRequests, setOwnRequests] = useState<LeaveRequest[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMemberUserIds, setTeamMemberUserIds] = useState<string[]>([]);

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

  // Fetch user's own requests
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
  const fetchTeamLeaves = useCallback(async () => {
    if (!user) return [];

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

  // Fetch team member user IDs for supervisors/line managers
  const fetchTeamMemberUserIds = useCallback(async (): Promise<string[]> => {
    if (!user) return [];

    if (role === "admin" || role === "vp" || role === "manager") return [];

    if (isSupervisor || isLineManager) {
      const { data: myProfile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();

      if (!myProfile) return [];

      const { data: myEmployee } = await supabase
        .from("employees")
        .select("id")
        .eq("profile_id", myProfile.id)
        .single();

      if (!myEmployee) return [];

      const { data: teamMembers } = await supabase
        .from("employees")
        .select("profile_id")
        .or(`line_manager_id.eq.${myEmployee.id},manager_id.eq.${myEmployee.id}`);

      if (!teamMembers || teamMembers.length === 0) return [];

      const profileIds = teamMembers.map((e) => e.profile_id).filter(Boolean);
      if (profileIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .in("id", profileIds as string[]);

      return profiles?.map((p) => p.user_id) || [];
    }

    return [];
  }, [user, role, isSupervisor, isLineManager]);

  // Fetch pending requests for managers/supervisors/line_managers to approve
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

    if ((isSupervisor || isLineManager) && role !== "admin" && role !== "vp" && role !== "manager") {
      const teamIds = await fetchTeamMemberUserIds();
      if (teamIds.length > 0) {
        return (data || []).filter((r) => teamIds.includes(r.user_id));
      }
      return [];
    }

    return data || [];
  }, [user, isManager, isSupervisor, isLineManager, role, fetchTeamMemberUserIds]);

  // Fetch all team requests (all statuses) for supervisors/line_managers
  const fetchAllTeamRequests = useCallback(async () => {
    if (!user || !isManager) return [];

    if (role === "admin" || role === "vp" || role === "manager") {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .neq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    }

    if (isSupervisor || isLineManager) {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .neq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return [];

      const teamIds = await fetchTeamMemberUserIds();
      if (teamIds.length > 0) {
        return (data || []).filter((r) => teamIds.includes(r.user_id));
      }
      return [];
    }

    return [];
  }, [user, isManager, isSupervisor, isLineManager, role, fetchTeamMemberUserIds]);

  const fetchRequests = useCallback(async () => {
    if (!user) return;

    const ownRequestsData = await fetchOwnRequests();
    const approvedTeamLeaves = await fetchTeamLeaves();
    const allTeamRequests = isManager ? await fetchAllTeamRequests() : [];

    const allManageableRequests = [...ownRequestsData];

    allTeamRequests.forEach((req) => {
      if (!allManageableRequests.find((r) => r.id === req.id)) {
        allManageableRequests.push(req);
      }
    });

    const allUserIds = new Set([
      ...allManageableRequests.map((r) => r.user_id),
      ...approvedTeamLeaves.map((r) => r.user_id),
    ]);

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, email")
      .in("user_id", Array.from(allUserIds));

    const profilesMap = new Map(profilesData?.map((p) => [p.user_id, p]) || []);

    const ownRequestsWithProfiles = allManageableRequests.map((request) => ({
      ...request,
      profile: profilesMap.get(request.user_id) || undefined,
    })) as LeaveRequest[];

    const teamLeavesWithProfiles = approvedTeamLeaves.map((request) => ({
      ...request,
      profile: profilesMap.get(request.user_id) || undefined,
    })) as LeaveRequest[];

    setOwnRequests(ownRequestsWithProfiles);
    setTeamLeaves(teamLeavesWithProfiles);
  }, [user, isManager, fetchOwnRequests, fetchTeamLeaves, fetchAllTeamRequests]);

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

    // Check if it's a special leave type with fixed days
    if (SPECIAL_LEAVE_TYPES[request.leave_type]) {
      days = SPECIAL_LEAVE_TYPES[request.leave_type];
    } else if (isLeaveOnLieuType(request.leave_type)) {
      // Leave on Lieu is always 1 day
      days = 1;
    } else {
      // For Annual Leave, Other Leave, and other types - calculate from dates
      days = Math.ceil((request.end_date.getTime() - request.start_date.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    // Only check balance for Annual Leave
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

    // Determine leave category for notifications
    const isLieu = isLeaveOnLieuType(request.leave_type);
    const isOther = isOtherLeaveType(request.leave_type);

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
      const toastTitle = isLieu
        ? "Leave on Lieu Request Submitted"
        : isOther
          ? "Other Leave Request Submitted"
          : "Request Submitted";
      const toastDesc = isLieu
        ? "Your lieu day request is pending approval."
        : isOther
          ? "Your other leave request is pending approval."
          : "Your leave request is pending approval.";

      toast({ title: toastTitle, description: toastDesc });

      // Create notification for user
      await createNotification(
        user.id,
        toastTitle,
        isLieu
          ? `Your Leave on Lieu request for ${days} day(s) has been submitted.`
          : isOther
            ? `Your Other Leave (${request.leave_type.replace("Other Leave - ", "")}) request for ${days} day(s) has been submitted.`
            : `Your ${request.leave_type} request for ${days} day(s) has been submitted and is pending approval.`,
        "leave",
        `/leave`,
      );

      // Notify managers, supervisors, and line managers
      const { data: managers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["manager", "admin", "vp", "supervisor", "line_manager"]);

      // Also get the user's direct line manager/supervisor via employee record
      const { data: userProfile2 } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();

      let lineManagerUserIds: string[] = [];
      if (userProfile2) {
        const { data: empRecord } = await supabase
          .from("employees")
          .select("line_manager_id, manager_id")
          .eq("profile_id", userProfile2.id)
          .single();

        if (empRecord) {
          const managerEmpIds = [empRecord.line_manager_id, empRecord.manager_id].filter(Boolean);
          if (managerEmpIds.length > 0) {
            const { data: managerProfiles } = await supabase
              .from("employees")
              .select("profile_id")
              .in("id", managerEmpIds as string[]);

            if (managerProfiles) {
              const profileIds = managerProfiles.map((m) => m.profile_id).filter(Boolean);
              const { data: mgrUsers } = await supabase
                .from("profiles")
                .select("user_id")
                .in("id", profileIds as string[]);
              lineManagerUserIds = mgrUsers?.map((p) => p.user_id) || [];
            }
          }
        }
      }

      // Combine and deduplicate
      const allNotifyIds = new Set([...(managers?.map((m) => m.user_id) || []), ...lineManagerUserIds]);

      for (const managerId of allNotifyIds) {
        if (managerId !== user.id) {
          const notifTitle = isLieu
            ? "📅 Leave on Lieu Request"
            : isOther
              ? "📋 Other Leave Request"
              : "New Leave Request";
          const notifMsg = isLieu
            ? `${userName} submitted a Leave on Lieu request for ${days} day(s). ${request.reason}`
            : isOther
              ? `${userName} submitted an Other Leave request (${request.leave_type.replace("Other Leave - ", "")}) for ${days} day(s).`
              : `${userName} submitted a ${request.leave_type} request for ${days} day(s) (${formatLocalDate(request.start_date)} to ${formatLocalDate(request.end_date)}).`;

          await createNotification(managerId, notifTitle, notifMsg, "leave", `/approvals`);
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
      const isLieu = isLeaveOnLieuType(requestData.leave_type);
      const isOther = isOtherLeaveType(requestData.leave_type);

      const approveTitle = isLieu
        ? "Leave on Lieu Approved"
        : isOther
          ? "Other Leave Approved"
          : "Leave Request Approved";

      toast({
        title: "Approved",
        description: `${approveTitle.replace("Approved", "has been approved.")}`,
      });

      await createNotification(
        requestData.user_id,
        approveTitle,
        `Your ${requestData.leave_type} request for ${requestData.days} day(s) has been approved by ${managerName}.`,
        "leave",
        `/leave`,
      );

      await createNotification(
        user.id,
        approveTitle,
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
      const isLieu = isLeaveOnLieuType(requestData.leave_type);
      const isOther = isOtherLeaveType(requestData.leave_type);

      const rejectTitle = isLieu
        ? "Leave on Lieu Rejected"
        : isOther
          ? "Other Leave Rejected"
          : "Leave Request Rejected";

      toast({
        title: "Rejected",
        description: `${rejectTitle.replace("Rejected", "has been rejected.")}`,
        variant: "destructive",
      });

      await createNotification(
        requestData.user_id,
        rejectTitle,
        `Your ${requestData.leave_type} request for ${requestData.days} day(s) has been rejected by ${managerName}. Reason: ${rejectionReason}`,
        "leave",
        `/leave`,
      );

      await createNotification(
        user.id,
        rejectTitle,
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
    teamLeaves.forEach((tl) => {
      if (!allRequests.find((r) => r.id === tl.id)) {
        allRequests.push(tl);
      }
    });
    return allRequests;
  };

  return {
    requests: getAllRequests(),
    ownRequests,
    teamLeaves,
    balances,
    loading,
    createRequest,
    approveRequest,
    rejectRequest,
    refetch: loadAllData,
  };
}
