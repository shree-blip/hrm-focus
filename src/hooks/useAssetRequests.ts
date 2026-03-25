import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface AssetRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  request_type: string;
  status: string;
  approval_stage: string;
  first_approver_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  line_manager_approved_by: string | null;
  line_manager_approved_at: string | null;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  requester_employee_id: string | null;
  org_id: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string;
  requester_email?: string;
  requester_department?: string;
  approver_name?: string;
  line_manager_name?: string;
  admin_approver_name?: string;
}

export function useAssetRequests() {
  const [assetRequests, setAssetRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAssetRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // RLS handles visibility - just fetch all accessible
      const { data, error } = await supabase
        .from("asset_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Collect all user/employee IDs to resolve names
        const employeeIds = [
          ...new Set([
            ...data.filter((r) => r.first_approver_id).map((r) => r.first_approver_id!),
            ...data.filter((r) => r.requester_employee_id).map((r) => r.requester_employee_id!),
            ...data.filter((r) => r.line_manager_approved_by).map((r) => r.line_manager_approved_by!),
          ]),
        ].filter(Boolean);

        const userIds = [
          ...new Set([
            ...data.map((r) => r.user_id),
            ...data.filter((r) => r.admin_approved_by).map((r) => r.admin_approved_by!),
            ...data.filter((r) => r.approved_by).map((r) => r.approved_by!),
          ]),
        ].filter(Boolean);

        // Fetch profiles by user_id
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email, department")
          .in("user_id", userIds);

        const profileMap = new Map(
          profiles?.map((p) => [
            p.user_id,
            { name: `${p.first_name} ${p.last_name}`, email: p.email, department: p.department },
          ])
        );

        // Fetch employee names by employee ID
        let employeeMap = new Map<string, string>();
        if (employeeIds.length > 0) {
          const { data: employees } = await supabase
            .from("employees")
            .select("id, first_name, last_name")
            .in("id", employeeIds);

          employeeMap = new Map(
            employees?.map((e) => [e.id, `${e.first_name} ${e.last_name}`]) || []
          );
        }

        const enrichedData = data.map((request: any) => ({
          ...request,
          requester_name: profileMap.get(request.user_id)?.name || "Unknown",
          requester_email: profileMap.get(request.user_id)?.email || "",
          requester_department: profileMap.get(request.user_id)?.department || "",
          line_manager_name: request.first_approver_id
            ? employeeMap.get(request.first_approver_id) || 
              (request.line_manager_approved_by ? employeeMap.get(request.line_manager_approved_by) : undefined)
            : undefined,
          admin_approver_name: request.admin_approved_by
            ? profileMap.get(request.admin_approved_by)?.name
            : undefined,
          approver_name: request.approved_by
            ? profileMap.get(request.approved_by)?.name || "Unknown"
            : undefined,
        }));

        setAssetRequests(enrichedData);
      } else {
        setAssetRequests([]);
      }
    } catch (error: any) {
      console.error("Error fetching asset requests:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAssetRequests();
  }, [fetchAssetRequests]);

  const submitAssetRequest = async (
    title: string,
    description: string,
    requestType: "asset" | "it_support" = "asset"
  ) => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      const { error } = await supabase.from("asset_requests").insert({
        user_id: user.id,
        title,
        description,
        request_type: requestType,
      } as any);

      if (error) throw error;

      toast({
        title: "Request Submitted",
        description: "Your request has been submitted for approval.",
      });

      await fetchAssetRequests();
      return { success: true };
    } catch (error: any) {
      console.error("Error submitting asset request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  // Line manager approves → moves to admin stage + sends email
  const lineManagerApprove = async (requestId: string) => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      // Get employee ID for current user (line manager)
      const { data: empData } = await supabase.rpc("get_employee_id_for_user", { _user_id: user.id });
      
      const { error } = await supabase
        .from("asset_requests")
        .update({
          approval_stage: "pending_admin",
          status: "pending_admin",
          line_manager_approved_by: empData || null,
          line_manager_approved_at: new Date().toISOString(),
        } as any)
        .eq("id", requestId);

      if (error) throw error;

      // Get request details for email
      const request = assetRequests.find((r) => r.id === requestId);
      if (request) {
        // Get LM name
        const { data: lmProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", user.id)
          .single();

        // Trigger email to admin
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        await supabase.functions.invoke("send-asset-approval-email", {
          body: {
            requestId,
            requestTitle: request.title,
            requestType: request.request_type,
            requestDescription: request.description,
            requestDate: request.created_at,
            employeeName: request.requester_name,
            employeeEmail: request.requester_email,
            department: request.requester_department,
            lineManagerName: lmProfile ? `${lmProfile.first_name} ${lmProfile.last_name}` : "Line Manager",
            approvalDate: new Date().toISOString(),
          },
        });
      }

      toast({
        title: "Request Approved",
        description: "The request has been forwarded to Admin for final review.",
      });

      await fetchAssetRequests();
      return { success: true };
    } catch (error: any) {
      console.error("Error approving request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  // Admin final approval
  const adminApprove = async (requestId: string) => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      const { error } = await supabase
        .from("asset_requests")
        .update({
          approval_stage: "approved",
          status: "approved",
          admin_approved_by: user.id,
          admin_approved_at: new Date().toISOString(),
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        } as any)
        .eq("id", requestId);

      if (error) throw error;

      toast({ title: "Request Approved", description: "The asset request has been fully approved." });
      await fetchAssetRequests();
      return { success: true };
    } catch (error: any) {
      console.error("Error admin approving:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return { success: false, error: error.message };
    }
  };

  const declineRequest = async (requestId: string, reason?: string) => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      const request = assetRequests.find((r) => r.id === requestId);
      const { error } = await supabase
        .from("asset_requests")
        .update({
          status: "declined",
          approval_stage: "declined",
          rejection_reason: reason || null,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        } as any)
        .eq("id", requestId);

      if (error) throw error;

      toast({ title: "Request Declined", description: "The request has been declined." });
      await fetchAssetRequests();
      return { success: true };
    } catch (error: any) {
      console.error("Error declining request:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return { success: false, error: error.message };
    }
  };

  return {
    assetRequests,
    loading,
    submitAssetRequest,
    lineManagerApprove,
    adminApprove,
    declineRequest,
    refetch: fetchAssetRequests,
  };
}
