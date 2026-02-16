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
  // Added submitter info
  submitter?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  // Added comment count
  comment_count: number;
  // Track if there are unread comments (comments from others since last viewed)
  has_new_comments: boolean;
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
  is_new?: boolean; // Flag for unread comments
}

export const GRIEVANCE_CATEGORIES = ["Harassment", "Payroll", "Manager Issue", "Workload", "Policy", "Safety", "Other"];

export const GRIEVANCE_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export const GRIEVANCE_STATUSES = ["submitted", "in_review", "need_info", "resolved", "closed", "escalated"];

export const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  in_review: "In Review",
  need_info: "Need Info",
  resolved: "Resolved",
  closed: "Closed",
  escalated: "Escalated",
};

// Local storage key for tracking last viewed timestamps
const getLastViewedKey = (userId: string, grievanceId: string) => `grievance_last_viewed_${userId}_${grievanceId}`;

export function useGrievances() {
  const { user, isManager, isAdmin, isVP } = useAuth();
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGrievances = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch grievances
      const { data: grievancesData, error } = await supabase
        .from("grievances" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching grievances:", error);
        toast.error("Failed to load grievances");
        setLoading(false);
        return;
      }

      const grievancesList = (grievancesData as any[]) || [];

      // Get unique user_ids to fetch submitter info
      const userIds = [...new Set(grievancesList.map((g) => g.user_id))];
      const grievanceIds = grievancesList.map((g) => g.id);

      // Fetch profiles for all submitters
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      // Fetch comment counts for all grievances
      let commentCounts: Record<string, number> = {};
      let latestCommentTimes: Record<string, { time: string; userId: string }> = {};

      if (grievanceIds.length > 0) {
        // Get comment counts
        const { data: comments } = await supabase
          .from("grievance_comments" as any)
          .select("grievance_id, user_id, created_at, is_internal")
          .in("grievance_id", grievanceIds)
          .order("created_at", { ascending: false });

        if (comments) {
          // Count comments per grievance (exclude internal comments for non-managers viewing their own grievances)
          const canSeeInternal = isManager || isAdmin || isVP;

          (comments as any[]).forEach((c) => {
            const grievance = grievancesList.find((g) => g.id === c.grievance_id);
            const isOwnGrievance = grievance?.user_id === user.id;

            // Skip internal comments for employees viewing their own grievances
            if (c.is_internal && isOwnGrievance && !canSeeInternal) {
              return;
            }

            commentCounts[c.grievance_id] = (commentCounts[c.grievance_id] || 0) + 1;

            // Track latest comment from someone other than current user
            if (c.user_id !== user.id) {
              if (
                !latestCommentTimes[c.grievance_id] ||
                new Date(c.created_at) > new Date(latestCommentTimes[c.grievance_id].time)
              ) {
                latestCommentTimes[c.grievance_id] = { time: c.created_at, userId: c.user_id };
              }
            }
          });
        }
      }

      // Attach submitter info and comment counts to each grievance
      const grievancesWithData = grievancesList.map((g) => {
        // Check if there are new comments since last viewed
        const lastViewedKey = getLastViewedKey(user.id, g.id);
        const lastViewed = localStorage.getItem(lastViewedKey);
        const latestOtherComment = latestCommentTimes[g.id];

        let hasNewComments = false;
        if (latestOtherComment) {
          if (!lastViewed) {
            hasNewComments = true;
          } else {
            hasNewComments = new Date(latestOtherComment.time) > new Date(lastViewed);
          }
        }

        return {
          ...g,
          submitter: profileMap.get(g.user_id) || null,
          comment_count: commentCounts[g.id] || 0,
          has_new_comments: hasNewComments,
        };
      });

      setGrievances(grievancesWithData);
    } catch (err) {
      console.error("Error in fetchGrievances:", err);
      toast.error("Failed to load grievances");
    } finally {
      setLoading(false);
    }
  }, [user, isManager, isAdmin, isVP]);

  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);

  // Mark grievance as viewed (for tracking new comments)
  const markAsViewed = (grievanceId: string) => {
    if (!user) return;
    const key = getLastViewedKey(user.id, grievanceId);
    localStorage.setItem(key, new Date().toISOString());

    // Update local state to reflect the change
    setGrievances((prev) => prev.map((g) => (g.id === grievanceId ? { ...g, has_new_comments: false } : g)));
  };

  const createGrievance = async (grievance: {
    title: string;
    category: string;
    priority: string;
    details: string;
    is_anonymous: boolean;
    anonymous_visibility: string;
  }) => {
    if (!user) return null;

    try {
      // Get employee_id and org_id
      const { data: profile } = await supabase.from("profiles").select("id, org_id").eq("user_id", user.id).single();

      let employeeId = null;
      if (profile) {
        const { data: emp } = await supabase.from("employees").select("id").eq("profile_id", profile.id).single();
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

      // Immediately refresh the list
      await fetchGrievances();

      return data;
    } catch (err) {
      console.error("Error in createGrievance:", err);
      toast.error("Failed to submit grievance");
      return null;
    }
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
    if (!user) return [];

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

    if (userIds.length === 0) return comments;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

    // Get last viewed time for this grievance
    const lastViewedKey = getLastViewedKey(user.id, grievanceId);
    const lastViewed = localStorage.getItem(lastViewedKey);

    return comments.map((c) => ({
      ...c,
      profiles: profileMap.get(c.user_id) || null,
      // Mark as new if comment is from someone else and after last viewed
      is_new:
        c.user_id !== user.id && lastViewed
          ? new Date(c.created_at) > new Date(lastViewed)
          : c.user_id !== user.id && !lastViewed,
    }));
  };

  const addComment = async (grievanceId: string, content: string, isInternal: boolean) => {
    if (!user) return false;

    const { error } = await supabase.from("grievance_comments" as any).insert({
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
    await fetchGrievances(); // Refresh to update comment counts
    return true;
  };

  const uploadAttachment = async (grievanceId: string, file: File) => {
    if (!user) return null;

    const filePath = `${user.id}/${grievanceId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage.from("grievance-attachments").upload(filePath, file);

    if (uploadError) {
      toast.error("Failed to upload attachment");
      return null;
    }

    const { error: dbError } = await supabase.from("grievance_attachments" as any).insert({
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

  // Helper to get displayable submitter name based on anonymous settings and viewer permissions
  const getSubmitterDisplayName = (grievance: Grievance): string => {
    // If not anonymous, show the name
    if (!grievance.is_anonymous) {
      if (grievance.submitter) {
        return `${grievance.submitter.first_name} ${grievance.submitter.last_name}`;
      }
      return "Unknown User";
    }

    // If it's the user's own grievance
    if (grievance.user_id === user?.id) {
      return "You (Anonymous)";
    }

    // Check visibility rules for anonymous grievances
    const visibility = grievance.anonymous_visibility;

    // Check if current user has permission to see the name
    if (visibility === "hr_admin" && isAdmin) {
      if (grievance.submitter) {
        return `${grievance.submitter.first_name} ${grievance.submitter.last_name} (Anonymous to others)`;
      }
    }

    if (visibility === "vp_hr" && (isVP || isAdmin)) {
      if (grievance.submitter) {
        return `${grievance.submitter.first_name} ${grievance.submitter.last_name} (Anonymous to others)`;
      }
    }

    // Default: show as anonymous
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
    getSubmitterDisplayName,
    markAsViewed,
    refetch: fetchGrievances,
  };
}
