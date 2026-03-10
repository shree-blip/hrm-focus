import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

// ---- Types ----

export interface PerformanceReview {
  id: string;
  employee_id: string;
  reviewer_id: string;
  period_start: string;
  period_end: string;
  quality_rating: number | null;
  communication_rating: number | null;
  ownership_rating: number | null;
  collaboration_rating: number | null;
  final_score: number | null;
  strengths: string | null;
  improvements: string | null;
  comments: string | null;
  status: "draft" | "submitted" | "acknowledged";
  created_at: string;
  updated_at: string;
  // Joined fields
  employee_name?: string;
  reviewer_name?: string;
}

export interface Feedback360 {
  id: string;
  from_user_id: string;
  to_employee_id: string;
  category: "quality" | "communication" | "ownership" | "collaboration" | "leadership" | "technical";
  rating: number;
  comment: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  // Joined
  from_name?: string;
  to_name?: string;
}

export interface PerformanceGoal {
  id: string;
  employee_id: string;
  created_by: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: "active" | "completed" | "cancelled" | "overdue";
  progress: number;
  created_at: string;
  updated_at: string;
  // Joined
  employee_name?: string;
}

// ---- Input types ----

export interface CreateReviewInput {
  employee_id: string;
  period_start: string;
  period_end: string;
  quality_rating?: number;
  communication_rating?: number;
  ownership_rating?: number;
  collaboration_rating?: number;
  final_score?: number;
  strengths?: string;
  improvements?: string;
  comments?: string;
  status?: "draft" | "submitted";
}

export interface CreateFeedbackInput {
  to_employee_id: string;
  category: Feedback360["category"];
  rating: number;
  comment?: string;
  period_start?: string;
  period_end?: string;
}

export interface CreateGoalInput {
  employee_id: string;
  title: string;
  description?: string;
  target_date?: string;
}

// ---- Hook ----

export function usePerformanceReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [feedback, setFeedback] = useState<Feedback360[]>([]);
  const [goals, setGoals] = useState<PerformanceGoal[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- Fetch all ----
  const fetchAll = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    try {
      // Profiles map for name resolution
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name");
      const profileMap = new Map(
        profiles?.map(p => [p.user_id, `${p.first_name} ${p.last_name}`.trim()]) || []
      );

      // Employees map: id → name, also employee_id → profile_id for cross-ref
      const { data: employees } = await supabase
        .from("employees")
        .select("id, first_name, last_name, profile_id");
      const empNameMap = new Map(
        employees?.map(e => [e.id, `${e.first_name} ${e.last_name}`.trim()]) || []
      );
      const empProfileMap = new Map(
        employees?.map(e => [e.id, e.profile_id]) || []
      );

      // ---- Reviews ----
      const { data: reviewsData } = await supabase
        .from("performance_reviews" as any)
        .select("*")
        .order("created_at", { ascending: false });

      const mappedReviews: PerformanceReview[] = (reviewsData as any[] || []).map((r: any) => ({
        ...r,
        employee_name: empNameMap.get(r.employee_id) || "Unknown",
        reviewer_name: profileMap.get(r.reviewer_id) || "Unknown",
      }));
      setReviews(mappedReviews);

      // ---- 360 Feedback ----
      const { data: feedbackData } = await supabase
        .from("feedback_360" as any)
        .select("*")
        .order("created_at", { ascending: false });

      const mappedFeedback: Feedback360[] = (feedbackData as any[] || []).map((f: any) => ({
        ...f,
        from_name: profileMap.get(f.from_user_id) || "Unknown",
        to_name: empNameMap.get(f.to_employee_id) || "Unknown",
      }));
      setFeedback(mappedFeedback);

      // ---- Goals ----
      const { data: goalsData } = await supabase
        .from("performance_goals" as any)
        .select("*")
        .order("created_at", { ascending: false });

      const mappedGoals: PerformanceGoal[] = (goalsData as any[] || []).map((g: any) => ({
        ...g,
        employee_name: empNameMap.get(g.employee_id) || "Unknown",
      }));
      setGoals(mappedGoals);

    } catch (err) {
      console.error("usePerformanceReviews fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();

    // Realtime subscriptions
    const reviewChannel = supabase
      .channel("perf-reviews-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "performance_reviews" }, () => fetchAll())
      .subscribe();

    const feedbackChannel = supabase
      .channel("feedback-360-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback_360" }, () => fetchAll())
      .subscribe();

    const goalChannel = supabase
      .channel("perf-goals-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "performance_goals" }, () => fetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(reviewChannel);
      supabase.removeChannel(feedbackChannel);
      supabase.removeChannel(goalChannel);
    };
  }, [fetchAll]);

  // ---- CRUD: Reviews ----

  const createReview = useCallback(async (input: CreateReviewInput) => {
    if (!user) return;
    const { error } = await supabase.from("performance_reviews" as any).insert({
      ...input,
      reviewer_id: user.id,
      status: input.status || "draft",
    } as any);
    if (error) {
      toast({ title: "Error", description: "Failed to create review", variant: "destructive" });
      console.error(error);
    } else {
      toast({ title: "Review created" });
      fetchAll();
    }
  }, [user, fetchAll]);

  const updateReview = useCallback(async (id: string, updates: Partial<CreateReviewInput & { status: string }>) => {
    const { error } = await supabase
      .from("performance_reviews" as any)
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to update review", variant: "destructive" });
      console.error(error);
    } else {
      toast({ title: "Review updated" });
      fetchAll();
    }
  }, [fetchAll]);

  const submitReview = useCallback(async (id: string) => {
    return updateReview(id, { status: "submitted" });
  }, [updateReview]);

  const acknowledgeReview = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("performance_reviews" as any)
      .update({ status: "acknowledged", updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to acknowledge review", variant: "destructive" });
    } else {
      toast({ title: "Review acknowledged" });
      fetchAll();
    }
  }, [fetchAll]);

  const deleteReview = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("performance_reviews" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete review", variant: "destructive" });
    } else {
      toast({ title: "Review deleted" });
      fetchAll();
    }
  }, [fetchAll]);

  // ---- CRUD: Feedback ----

  const createFeedback = useCallback(async (input: CreateFeedbackInput) => {
    if (!user) return;
    const { error } = await supabase.from("feedback_360" as any).insert({
      ...input,
      from_user_id: user.id,
    } as any);
    if (error) {
      toast({ title: "Error", description: "Failed to submit feedback", variant: "destructive" });
      console.error(error);
    } else {
      toast({ title: "Feedback submitted" });
      fetchAll();
    }
  }, [user, fetchAll]);

  // ---- CRUD: Goals ----

  const createGoal = useCallback(async (input: CreateGoalInput) => {
    if (!user) return;
    const { error } = await supabase.from("performance_goals" as any).insert({
      ...input,
      created_by: user.id,
      status: "active",
      progress: 0,
    } as any);
    if (error) {
      toast({ title: "Error", description: "Failed to create goal", variant: "destructive" });
      console.error(error);
    } else {
      toast({ title: "Goal created" });
      fetchAll();
    }
  }, [user, fetchAll]);

  const updateGoal = useCallback(async (id: string, updates: Partial<{ title: string; description: string; target_date: string; status: string; progress: number }>) => {
    const { error } = await supabase
      .from("performance_goals" as any)
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to update goal", variant: "destructive" });
    } else {
      toast({ title: "Goal updated" });
      fetchAll();
    }
  }, [fetchAll]);

  const deleteGoal = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("performance_goals" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete goal", variant: "destructive" });
    } else {
      toast({ title: "Goal deleted" });
      fetchAll();
    }
  }, [fetchAll]);

  return {
    reviews,
    feedback,
    goals,
    loading,
    refetch: fetchAll,
    // Reviews
    createReview,
    updateReview,
    submitReview,
    acknowledgeReview,
    deleteReview,
    // Feedback
    createFeedback,
    // Goals
    createGoal,
    updateGoal,
    deleteGoal,
  };
}
