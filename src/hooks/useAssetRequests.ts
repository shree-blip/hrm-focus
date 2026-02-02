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
  status: "pending" | "approved" | "declined";
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  org_id: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string;
  requester_email?: string;
  approver_name?: string;
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
      const { data, error } = await supabase
        .from("asset_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch requester and approver names
      if (data && data.length > 0) {
        const userIds = [
          ...new Set([
            ...data.map((r) => r.user_id),
            ...data.filter((r) => r.approved_by).map((r) => r.approved_by!),
          ]),
        ];

        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email")
          .in("user_id", userIds);

        const profileMap = new Map(
          profiles?.map((p) => [
            p.user_id,
            { name: `${p.first_name} ${p.last_name}`, email: p.email },
          ])
        );

        const enrichedData = data.map((request) => ({
          ...request,
          status: request.status as "pending" | "approved" | "declined",
          requester_name: profileMap.get(request.user_id)?.name || "Unknown",
          requester_email: profileMap.get(request.user_id)?.email || "",
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
        status: "pending",
      });

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

  const approveRequest = async (requestId: string) => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      const { error } = await supabase
        .from("asset_requests")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Request Approved",
        description: "The request has been approved.",
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

  const declineRequest = async (requestId: string, reason?: string) => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      const { error } = await supabase
        .from("asset_requests")
        .update({
          status: "declined",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason || null,
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Request Declined",
        description: "The request has been declined.",
      });

      await fetchAssetRequests();
      return { success: true };
    } catch (error: any) {
      console.error("Error declining request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to decline request",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  return {
    assetRequests,
    loading,
    submitAssetRequest,
    approveRequest,
    declineRequest,
    refetch: fetchAssetRequests,
  };
}
