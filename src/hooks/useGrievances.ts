import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Grievance {
  id: string;
  user_id: string;
  org_id: string | null;
  employee_id: string | null;
  title: string;
  category: string;
  priority: string;
  details: string;
  is_anonymous: boolean;
  anonymous_visibility: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrievanceComment {
  id: string;
  grievance_id: string;
  user_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  profiles?: { first_name: string; last_name: string } | null;
}

export const GRIEVANCE_CATEGORIES = [
  "Harassment",
  "Payroll",
  "Manager Issue",
  "Workload",
  "Policy",
  "Safety",
  "Other",
];

export const GRIEVANCE_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export const GRIEVANCE_STATUSES = [
  "submitted",
  "in_review",
  "need_info",
  "resolved",
  "closed",
  "escalated",
];

export const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  in_review: "In Review",
  need_info: "Need Info",
  resolved: "Resolved",
  closed: "Closed",
  escalated: "Escalated",
};

export function useGrievances() {
  const { user, isManager, isAdmin, isVP } = useAuth();
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGrievances = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("grievances" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching grievances:", error);
      toast.error("Failed to load grievances");
    } else {
      setGrievances((data as any[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);

  const createGrievance = async (grievance: {
    title: string;
    category: string;
    priority: string;
    details: string;
    is_anonymous: boolean;
    anonymous_visibility: string;
  }) => {
    if (!user) return null;

    // Get employee_id and org_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, org_id")
      .eq("user_id", user.id)
      .single();

    let employeeId = null;
    if (profile) {
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("profile_id", profile.id)
        .single();
      employeeId = emp?.id || null;
    }

    const { data, error } = await supabase
      .from("grievances" as any)
      .insert({
        user_id: user.id,
        org_id: profile?.org_id || null,
        employee_id: employeeId,
        ...grievance,
      } as any)
      .select()
      .single();

    if (error) {
      console.error("Error creating grievance:", error);
      toast.error("Failed to submit grievance");
      return null;
    }

    toast.success("Grievance submitted successfully");
    await fetchGrievances();
    return data;
  };

  const updateGrievanceStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("grievances" as any)
      .update({ status } as any)
      .eq("id", id);

    if (error) {
      toast.error("Failed to update status");
      return false;
    }

    toast.success("Status updated");
    await fetchGrievances();
    return true;
  };

  const fetchComments = async (grievanceId: string): Promise<GrievanceComment[]> => {
    const { data, error } = await supabase
      .from("grievance_comments" as any)
      .select("*")
      .eq("grievance_id", grievanceId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      return [];
    }

    // Fetch profile names for each comment
    const comments = (data as any[]) || [];
    const userIds = [...new Set(comments.map((c) => c.user_id))];
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.user_id, p])
    );

    return comments.map((c) => ({
      ...c,
      profiles: profileMap.get(c.user_id) || null,
    }));
  };

  const addComment = async (
    grievanceId: string,
    content: string,
    isInternal: boolean
  ) => {
    if (!user) return false;

    const { error } = await supabase
      .from("grievance_comments" as any)
      .insert({
        grievance_id: grievanceId,
        user_id: user.id,
        content,
        is_internal: isInternal,
      } as any);

    if (error) {
      toast.error("Failed to add comment");
      return false;
    }

    toast.success("Comment added");
    return true;
  };

  const uploadAttachment = async (grievanceId: string, file: File) => {
    if (!user) return null;

    const filePath = `${user.id}/${grievanceId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("grievance-attachments")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Failed to upload attachment");
      return null;
    }

    const { error: dbError } = await supabase
      .from("grievance_attachments" as any)
      .insert({
        grievance_id: grievanceId,
        user_id: user.id,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      } as any);

    if (dbError) {
      console.error("Error saving attachment record:", dbError);
      return null;
    }

    return filePath;
  };

  const getSubmitterName = (grievance: Grievance): string => {
    if (!grievance.is_anonymous) return ""; // Will be resolved by caller
    if (grievance.user_id === user?.id) return "You (Anonymous)";
    
    // Check visibility rules
    if (grievance.anonymous_visibility === "nobody") return "Anonymous";
    if (grievance.anonymous_visibility === "hr_admin" && isAdmin) return ""; // resolve name
    if (grievance.anonymous_visibility === "vp_hr" && (isVP || isAdmin)) return ""; // resolve name
    
    return "Anonymous";
  };

  return {
    grievances,
    loading,
    createGrievance,
    updateGrievanceStatus,
    fetchComments,
    addComment,
    uploadAttachment,
    getSubmitterName,
    refetch: fetchGrievances,
  };
}
