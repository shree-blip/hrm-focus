import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { resolveTeamMemberUserIds, resolveManagerUserIds } from "@/utils/teamResolver";

/** Count business days (Mon–Fri) between two dates, inclusive. */
function getBusinessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

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
  is_half_day: boolean;
  half_day_period: string | null;
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
  const [allApprovedLeaves, setAllApprovedLeaves] = useState<LeaveRequest[]>([]);
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
      const { error } = await supabase.rpc("create_notification", {
        p_user_id: userId,
        p_title: title,
        p_message: message,
        p_type: type,
        p_link: link,
      });

      if (error) {
        console.error("Error creating notification:", error);
      }
    } catch (error) {
      console.error("Failed to create notification:", error);
    }
  };

  // Send leave notification via edge function (email + in-app for managers/admin)
  const sendLeaveNotification = async (payload: {
    leave_request_id: string;
    event_type: "submitted" | "approved" | "rejected";
    employee_name: string;
    employee_email?: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    days: number;
    reason?: string;
    rejection_reason?: string;
    approver_name?: string;
    target_user_ids: string[];
    target_emails?: string[];
    requesting_user_id: string;
  }) => {
    try {
      const { error } = await supabase.functions.invoke("send-leave-notification", {
        body: payload,
      });
      if (error) {
        console.error("send-leave-notification failed:", error);
      }
    } catch (err) {
      console.error("Failed to call send-leave-notification:", err);
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

  // Fetch team member user IDs for supervisors/line managers
  const fetchTeamMemberUserIds = useCallback(async (): Promise<string[]> => {
    if (!user) return [];

    if (role === "admin" || role === "vp") return [];

    if (isSupervisor || isLineManager || role === "line_manager" || role === "supervisor") {
      const ids = await resolveTeamMemberUserIds(user.id);
      console.debug("[hierarchy][leave] team user ids", {
        managerUserId: user.id,
        teamUserIdsCount: ids.length,
        teamUserIds: ids,
      });
      return ids;
    }

    return [];
  }, [user, role, isSupervisor, isLineManager]);

  // Fetch approved team leaves (scoped by team for non-admin/VP)
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

    // Admin/VP see all approved leaves
    if (role === "admin" || role === "vp") {
      return data || [];
    }

    // Line managers/supervisors only see their team's approved leaves
    if (isSupervisor || isLineManager || role === "line_manager" || role === "supervisor") {
      const teamIds = await fetchTeamMemberUserIds();
      if (teamIds.length > 0) {
        return (data || []).filter((r) => r.user_id === user.id || teamIds.includes(r.user_id));
      }
    }

    // Regular employees see only their own
    return (data || []).filter((r) => r.user_id === user.id);
  }, [user, role, isSupervisor, isLineManager, fetchTeamMemberUserIds]);

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

    if ((isSupervisor || isLineManager || role === "line_manager" || role === "supervisor") && role !== "admin" && role !== "vp") {
      const teamIds = await fetchTeamMemberUserIds();
      console.debug("[hierarchy][leave] pending filter", { managerUserId: user.id, teamIdsCount: teamIds.length, teamIds });
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

    if (role === "admin" || role === "vp") {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .neq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    }

    if (isSupervisor || isLineManager || role === "line_manager" || role === "supervisor") {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .neq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return [];

      const teamIds = await fetchTeamMemberUserIds();
      console.debug("[hierarchy][leave] all-team filter", { managerUserId: user.id, teamIdsCount: teamIds.length, teamIds });
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

    const currentYear = new Date().getFullYear();

    const { data: balanceConfigs, error: configError } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("user_id", user.id)
      .eq("year", currentYear);

    if (configError || !balanceConfigs) return;

    // Use used_days directly from the database (manually managed balances)
    setBalances(balanceConfigs as LeaveBalance[]);
  }, [user]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchRequests(), fetchBalances()]);
    setLoading(false);
  }, [fetchRequests, fetchBalances]);

  // Debounce realtime to prevent cascading re-fetches
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadAllData();

    const debouncedLoad = () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      realtimeTimerRef.current = setTimeout(() => loadAllData(), 500);
    };

    const channel = supabase
      .channel("leave-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leave_requests",
        },
        debouncedLoad,
      )
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [loadAllData, user]);

  const createRequest = async (request: { leave_type: string; start_date: Date; end_date: Date; reason: string; is_half_day?: boolean; half_day_period?: string | null }) => {
    if (!user) return;

    let days: number;

    // Half-day leave = 0.5 days
    if (request.is_half_day) {
      days = 0.5;
    } else if (SPECIAL_LEAVE_TYPES[request.leave_type]) {
      // Check if it's a special leave type with fixed days
      days = SPECIAL_LEAVE_TYPES[request.leave_type];
    } else if (isLeaveOnLieuType(request.leave_type)) {
      // Leave on Lieu is always 1 day
      days = 1;
    } else {
      // For Annual Leave, Other Leave, and other types - calculate business days (excluding weekends)
      days = getBusinessDaysBetween(request.start_date, request.end_date);
    }

    // Only check balance for Annual Leave (and Sick Leave which deducts from annual)
    const isSickLeave = request.leave_type === "Other Leave - Sick Leave";
    if (request.leave_type === "Annual Leave" || isSickLeave) {
      const balanceForType = balances.find((b) => b.leave_type === "Annual Leave");
      if (balanceForType) {
        const availableDays = balanceForType.total_days - balanceForType.used_days;
        if (days > availableDays) {
          toast({
            title: "Insufficient Balance",
            description: `You only have ${availableDays} annual leave days available.${isSickLeave ? " Sick leave deducts from annual leave." : ""}`,
            variant: "destructive",
          });
          return;
        }
      } else {
        const usedAnnualLeave = ownRequests
          .filter((r) => r.status === "approved" && (r.leave_type === "Annual Leave" || r.leave_type === "Other Leave - Sick Leave") && r.user_id === user.id)
          .reduce((sum, r) => sum + r.days, 0);

        if (days > 12 - usedAnnualLeave) {
          toast({
            title: "Insufficient Balance",
            description: `You only have ${12 - usedAnnualLeave} annual leave days available.${isSickLeave ? " Sick leave deducts from annual leave." : ""}`,
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
        is_half_day: request.is_half_day || false,
        half_day_period: request.half_day_period || null,
      } as any)
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

      // Find ALL managers assigned to this employee (from junction table + legacy fields)
      let targetNotifyIds: string[] = [];

      try {
        targetNotifyIds = await resolveManagerUserIds(user.id);
      } catch (err) {
        console.error("Error resolving manager user IDs:", err);
      }

      // ALWAYS include VP/Admin in notifications for every leave request
      const { data: vpAdminUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["vp", "admin"]);
      
      if (vpAdminUsers) {
        for (const va of vpAdminUsers) {
          if (!targetNotifyIds.includes(va.user_id)) {
            targetNotifyIds.push(va.user_id);
          }
        }
      }

      // Deduplicate and exclude self
      const notifySet = new Set(targetNotifyIds);
      notifySet.delete(user.id);

      for (const managerId of notifySet) {
        const notifTitle = isLieu
          ? "📅 Leave on Lieu Request"
          : isOther
            ? "📋 Other Leave Request"
            : "📋 New Leave Request";
        const notifMsg = isLieu
          ? `${userName} submitted a Leave on Lieu request for ${days} day(s). ${request.reason}`
          : isOther
            ? `${userName} submitted an Other Leave request (${request.leave_type.replace("Other Leave - ", "")}) for ${days} day(s).`
            : `${userName} submitted a ${request.leave_type} request for ${days} day(s) (${formatLocalDate(request.start_date)} to ${formatLocalDate(request.end_date)}).`;

        await createNotification(managerId, notifTitle, notifMsg, "leave", `/approvals`);
      }

      // Send email notifications via edge function
      const managerEmails: string[] = [];
      for (const managerId of notifySet) {
        const { data: mgrProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", managerId)
          .single();
        if (mgrProfile?.email) managerEmails.push(mgrProfile.email);
      }

      await sendLeaveNotification({
        leave_request_id: newRequest.id,
        event_type: "submitted",
        employee_name: userName,
        employee_email: user.email || undefined,
        leave_type: request.leave_type,
        start_date: formatLocalDate(request.start_date),
        end_date: formatLocalDate(request.end_date),
        days,
        reason: request.reason,
        target_user_ids: Array.from(notifySet),
        target_emails: managerEmails,
        requesting_user_id: user.id,
      });

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
        ? "✅ Leave on Lieu Approved"
        : isOther
          ? "✅ Other Leave Approved"
          : "✅ Leave Request Approved";

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

      // Also notify VP/Admin about the approval
      const { data: vpAdminApprove } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["vp", "admin"]);

      const approveNotifyIds = [requestData.user_id];
      const approveEmails: string[] = requestProfile?.email ? [requestProfile.email] : [];

      for (const va of vpAdminApprove || []) {
        if (va.user_id !== user.id && va.user_id !== requestData.user_id) {
          approveNotifyIds.push(va.user_id);
          await createNotification(
            va.user_id,
            approveTitle,
            `${userName}'s ${requestData.leave_type} request for ${requestData.days} day(s) has been approved by ${managerName}.`,
            "leave",
            `/leave`,
          );
        }
        // Get VP/Admin emails
        const { data: vaProfile } = await supabase.from("profiles").select("email").eq("user_id", va.user_id).single();
        if (vaProfile?.email && !approveEmails.includes(vaProfile.email)) {
          approveEmails.push(vaProfile.email);
        }
      }

      // Send email notification to employee + VP/Admin about approval
      await sendLeaveNotification({
        leave_request_id: requestId,
        event_type: "approved",
        employee_name: userName,
        employee_email: requestProfile?.email || undefined,
        leave_type: requestData.leave_type,
        start_date: requestData.start_date,
        end_date: requestData.end_date,
        days: requestData.days,
        approver_name: managerName,
        target_user_ids: approveNotifyIds,
        target_emails: approveEmails,
        requesting_user_id: user.id,
      });

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
        ? "❌ Leave on Lieu Rejected"
        : isOther
          ? "❌ Other Leave Rejected"
          : "❌ Leave Request Rejected";

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

      // Also notify VP/Admin about the rejection
      const { data: vpAdminReject } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["vp", "admin"]);

      const rejectNotifyIds = [requestData.user_id];
      const rejectEmails: string[] = requestProfile?.email ? [requestProfile.email] : [];

      for (const va of vpAdminReject || []) {
        if (va.user_id !== user.id && va.user_id !== requestData.user_id) {
          rejectNotifyIds.push(va.user_id);
          await createNotification(
            va.user_id,
            rejectTitle,
            `${userName}'s ${requestData.leave_type} request for ${requestData.days} day(s) has been rejected by ${managerName}. Reason: ${rejectionReason}`,
            "leave",
            `/leave`,
          );
        }
        const { data: vaProfile } = await supabase.from("profiles").select("email").eq("user_id", va.user_id).single();
        if (vaProfile?.email && !rejectEmails.includes(vaProfile.email)) {
          rejectEmails.push(vaProfile.email);
        }
      }

      // Send email notification to employee + VP/Admin about rejection
      await sendLeaveNotification({
        leave_request_id: requestId,
        event_type: "rejected",
        employee_name: userName,
        employee_email: requestProfile?.email || undefined,
        leave_type: requestData.leave_type,
        start_date: requestData.start_date,
        end_date: requestData.end_date,
        days: requestData.days,
        rejection_reason: rejectionReason,
        approver_name: managerName,
        target_user_ids: rejectNotifyIds,
        target_emails: rejectEmails,
        requesting_user_id: user.id,
      });

      await loadAllData();
    }
  };

  // Admin: create leave on behalf of an employee (auto-approved)
  const adminCreateLeave = async (params: {
    user_id: string;
    leave_type: string;
    start_date: Date;
    end_date: Date;
    reason: string;
    days: number;
    is_half_day: boolean;
    half_day_period: string | null;
  }) => {
    if (!user || (!isAdmin && !isVP)) return;

    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const { error } = await supabase
      .from("leave_requests")
      .insert({
        user_id: params.user_id,
        leave_type: params.leave_type,
        start_date: formatLocalDate(params.start_date),
        end_date: formatLocalDate(params.end_date),
        days: params.days,
        reason: `[Admin assigned] ${params.reason}`,
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        is_half_day: params.is_half_day,
        half_day_period: params.half_day_period,
      } as any);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to assign leave: " + error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Leave Assigned",
        description: `Leave has been assigned and auto-approved.`,
      });
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

  /**
   * Cancel a leave request.
   * - Pending: employee can cancel their own.
   * - Approved: only admin, VP, line manager, or supervisor of the employee can cancel.
   * Logs cancellation to leave_cancellation_logs for auditing.
   */
  const cancelRequest = async (requestId: string, reason?: string) => {
    if (!user) return;

    const { data: requestData } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (!requestData) {
      toast({ title: "Error", description: "Leave request not found", variant: "destructive" });
      return;
    }

    const isOwnRequest = requestData.user_id === user.id;
    const originalStatus = requestData.status;

    // Authorization check
    if (originalStatus === "pending") {
      if (!isOwnRequest) {
        toast({ title: "Unauthorized", description: "You can only cancel your own pending leave.", variant: "destructive" });
        return;
      }
    } else if (originalStatus === "approved") {
      // Only admin, VP, line manager, or supervisor can cancel approved leave
      const canCancel = isAdmin || isVP || isSupervisor || isLineManager;
      if (!canCancel && !isOwnRequest) {
        toast({ title: "Unauthorized", description: "Only Admin, CEO, Line Manager, or Supervisor can cancel approved leave.", variant: "destructive" });
        return;
      }
      // Even own approved leave needs manager+ role
      if (isOwnRequest && !isAdmin && !isVP && !isSupervisor && !isLineManager) {
        toast({ title: "Unauthorized", description: "Approved leave can only be cancelled by Admin, CEO, Line Manager, or Supervisor.", variant: "destructive" });
        return;
      }
    } else {
      toast({ title: "Cannot Cancel", description: `Leave with status "${originalStatus}" cannot be cancelled.`, variant: "destructive" });
      return;
    }

    // Update leave request status to cancelled
    const { error } = await supabase
      .from("leave_requests")
      .update({ status: "cancelled" })
      .eq("id", requestId);

    if (error) {
      toast({ title: "Error", description: "Failed to cancel leave request", variant: "destructive" });
      return;
    }

    // Insert audit log
    await supabase.from("leave_cancellation_logs").insert({
      leave_request_id: requestId,
      cancelled_by: user.id,
      original_status: originalStatus,
      reason: reason || "No reason provided",
    });

    // Fetch names for notifications
    const { data: cancellerProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .single();
    const cancellerName = cancellerProfile ? `${cancellerProfile.first_name} ${cancellerProfile.last_name}` : "Someone";

    const { data: requestProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", requestData.user_id)
      .single();
    const employeeName = requestProfile ? `${requestProfile.first_name} ${requestProfile.last_name}` : "Employee";

    // Notify the employee if cancelled by someone else
    if (!isOwnRequest) {
      await createNotification(
        requestData.user_id,
        "🚫 Leave Cancelled",
        `Your ${requestData.leave_type} request for ${requestData.days} day(s) has been cancelled by ${cancellerName}.${reason ? ` Reason: ${reason}` : ""}`,
        "leave",
        "/leave",
      );
    }

    // Notify admins/VP
    const { data: vpAdminCancel } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["vp", "admin"]);

    for (const va of vpAdminCancel || []) {
      if (va.user_id !== user.id) {
        await createNotification(
          va.user_id,
          "🚫 Leave Cancelled",
          `${isOwnRequest ? employeeName + "'s" : employeeName + "'s"} ${requestData.leave_type} (${requestData.days} day(s)) was cancelled by ${cancellerName}.`,
          "leave",
          "/leave",
        );
      }
    }

    toast({ title: "Leave Cancelled", description: `The ${originalStatus} leave request has been cancelled.` });
    await loadAllData();
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
    cancelRequest,
    adminCreateLeave,
    refetch: loadAllData,
  };
}
