import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface PromotionRequest {
  id: string;
  employee_id: string;
  requested_by: string;
  current_title: string | null;
  current_salary: number | null;
  new_title: string;
  new_salary: number;
  effective_date: string;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  employee?: {
    first_name: string;
    last_name: string;
    employee_id: string | null;
    department: string | null;
    job_title: string | null;
    salary: number | null;
  };
  requester_profile?: {
    first_name: string;
    last_name: string;
  };
}

export interface PromotionHistoryEntry {
  id: string;
  promotion_request_id: string | null;
  employee_id: string;
  previous_title: string | null;
  new_title: string;
  previous_salary: number | null;
  new_salary: number;
  effective_date: string;
  approved_by: string | null;
  reason: string | null;
  created_at: string;
}

export function usePromotions() {
  const { user, isVP, isAdmin, isLineManager } = useAuth();
  const [myRequests, setMyRequests] = useState<PromotionRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PromotionRequest[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<PromotionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch promotion requests submitted by the current user (line manager)
  const fetchMyRequests = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("promotion_requests")
        .select(
          "*, employee:employees!promotion_requests_employee_id_fkey(first_name, last_name, employee_id, department, job_title, salary)"
        )
        .eq("requested_by", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching my promotion requests:", error.message);
        return;
      }
      if (data) setMyRequests(data as unknown as PromotionRequest[]);
    } catch (err) {
      console.error("Unexpected error fetching promotion requests:", err);
    }
  }, [user]);

  // Fetch pending promotion requests for VP/Admin approval
  const fetchPendingApprovals = useCallback(async () => {
    if (!user || (!isVP && !isAdmin)) return;
    try {
      const { data, error } = await supabase
        .from("promotion_requests")
        .select(
          "*, employee:employees!promotion_requests_employee_id_fkey(first_name, last_name, employee_id, department, job_title, salary)"
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching pending promotions:", error.message);
        return;
      }
      if (data) setPendingApprovals(data as unknown as PromotionRequest[]);
    } catch (err) {
      console.error("Unexpected error fetching pending promotions:", err);
    }
  }, [user, isVP, isAdmin]);

  // Fetch approved/rejected promotion requests (VP/Admin history)
  const fetchApprovalHistory = useCallback(async () => {
    if (!user || (!isVP && !isAdmin)) return;
    try {
      const { data, error } = await supabase
        .from("promotion_requests")
        .select(
          "*, employee:employees!promotion_requests_employee_id_fkey(first_name, last_name, employee_id, department, job_title, salary)"
        )
        .in("status", ["approved", "rejected"])
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error fetching promotion history:", error.message);
        return;
      }
      if (data) setApprovalHistory(data as unknown as PromotionRequest[]);
    } catch (err) {
      console.error("Unexpected error fetching promotion history:", err);
    }
  }, [user, isVP, isAdmin]);

  const refetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMyRequests(), fetchPendingApprovals(), fetchApprovalHistory()]);
    setLoading(false);
  }, [fetchMyRequests, fetchPendingApprovals, fetchApprovalHistory]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  // Realtime subscription for promotion_requests changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("promotion-requests-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "promotion_requests" },
        () => {
          fetchMyRequests();
          fetchPendingApprovals();
          fetchApprovalHistory();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchMyRequests, fetchPendingApprovals, fetchApprovalHistory]);

  // Create a promotion request (line manager action)
  const createPromotionRequest = async (data: {
    employee_id: string;
    current_title: string | null;
    current_salary: number | null;
    new_title: string;
    new_salary: number;
    effective_date: string;
    reason?: string;
  }) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("promotion_requests").insert({
        employee_id: data.employee_id,
        requested_by: user.id,
        current_title: data.current_title,
        current_salary: data.current_salary,
        new_title: data.new_title,
        new_salary: data.new_salary,
        effective_date: data.effective_date,
        reason: data.reason || null,
        status: "pending",
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to submit promotion request: " + error.message,
          variant: "destructive",
        });
        return false;
      }

      // Notify VP/Admin users
      try {
        const { data: vpUsers } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["vp", "admin"]);

        if (vpUsers) {
          for (const vpUser of vpUsers) {
            await supabase.rpc("create_notification", {
              p_user_id: vpUser.user_id,
              p_title: "New Promotion Request",
              p_message: `A promotion request has been submitted for review.`,
              p_type: "promotion",
              p_link: "/approvals",
            });
          }
        }
      } catch (notifErr) {
        console.error("Error sending promotion notification:", notifErr);
      }

      toast({
        title: "Success",
        description: "Promotion request submitted for VP approval.",
      });
      return true;
    } catch (err) {
      console.error("Error creating promotion request:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Approve a promotion request (VP/Admin action)
  const approvePromotion = async (requestId: string) => {
    if (!user) return false;
    try {
      // First fetch the full request to get employee details
      const { data: request, error: fetchErr } = await supabase
        .from("promotion_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (fetchErr || !request) {
        toast({
          title: "Error",
          description: "Could not find the promotion request.",
          variant: "destructive",
        });
        return false;
      }

      // Update promotion request status
      const { error: updateErr } = await supabase
        .from("promotion_requests")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateErr) {
        toast({
          title: "Error",
          description: "Failed to approve promotion: " + updateErr.message,
          variant: "destructive",
        });
        return false;
      }

      // Update employee record with new title and salary
      const updateFields: Record<string, unknown> = {
        job_title: request.new_title,
        salary: request.new_salary,
      };

      const { error: empErr } = await supabase
        .from("employees")
        .update(updateFields)
        .eq("id", request.employee_id);

      if (empErr) {
        console.error("Error updating employee record:", empErr.message);
        toast({
          title: "Warning",
          description:
            "Promotion approved but employee record could not be updated. Please update manually.",
          variant: "destructive",
        });
      }

      // Insert into promotion_history audit log
      await supabase.from("promotion_history").insert({
        promotion_request_id: requestId,
        employee_id: request.employee_id,
        previous_title: request.current_title,
        new_title: request.new_title,
        previous_salary: request.current_salary,
        new_salary: request.new_salary,
        effective_date: request.effective_date,
        approved_by: user.id,
        reason: request.reason,
      });

      // Notify the requester
      try {
        await supabase.rpc("create_notification", {
          p_user_id: request.requested_by,
          p_title: "Promotion Approved",
          p_message: `The promotion request you submitted has been approved.`,
          p_type: "promotion",
          p_link: "/approvals",
        });
      } catch (notifErr) {
        console.error("Error sending approval notification:", notifErr);
      }

      toast({
        title: "Promotion Approved",
        description:
          "The employee record has been updated with the new title and salary.",
      });
      return true;
    } catch (err) {
      console.error("Error approving promotion:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Reject a promotion request (VP/Admin action)
  const rejectPromotion = async (requestId: string, rejectionReason: string) => {
    if (!user) return false;
    try {
      const { data: request } = await supabase
        .from("promotion_requests")
        .select("requested_by")
        .eq("id", requestId)
        .single();

      const { error } = await supabase
        .from("promotion_requests")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq("id", requestId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to reject promotion: " + error.message,
          variant: "destructive",
        });
        return false;
      }

      // Notify the requester
      if (request) {
        try {
          await supabase.rpc("create_notification", {
            p_user_id: request.requested_by,
            p_title: "Promotion Request Rejected",
            p_message: `A promotion request has been rejected. Reason: ${rejectionReason}`,
            p_type: "promotion",
            p_link: "/approvals",
          });
        } catch (notifErr) {
          console.error("Error sending rejection notification:", notifErr);
        }
      }

      toast({
        title: "Promotion Rejected",
        description: "The promotion request has been rejected.",
      });
      return true;
    } catch (err) {
      console.error("Error rejecting promotion:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    myRequests,
    pendingApprovals,
    approvalHistory,
    loading,
    createPromotionRequest,
    approvePromotion,
    rejectPromotion,
    refetchAll,
  };
}
