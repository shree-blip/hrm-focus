import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface BugReport {
  id: string;
  user_id: string;
  title: string;
  description: string;
  screenshot_url: string | null;
  status: string;
  org_id: string | null;
  created_at: string;
  updated_at: string;
  reporter_name?: string;
  reporter_email?: string;
}

export function useBugReports() {
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchBugReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("bug_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch reporter names
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((r) => r.user_id))];
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

        const enrichedData = data.map((report) => ({
          ...report,
          reporter_name: profileMap.get(report.user_id)?.name || "Unknown",
          reporter_email: profileMap.get(report.user_id)?.email || "",
        }));

        setBugReports(enrichedData);
      } else {
        setBugReports([]);
      }
    } catch (error: any) {
      console.error("Error fetching bug reports:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBugReports();
  }, [fetchBugReports]);

  const submitBugReport = async (
    title: string,
    description: string,
    screenshotFile?: File
  ) => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      let screenshotUrl = null;

      // Upload screenshot if provided
      if (screenshotFile) {
        const fileExt = screenshotFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("bug-screenshots")
          .upload(fileName, screenshotFile);

        if (uploadError) throw uploadError;
        screenshotUrl = fileName;
      }

      const { error } = await supabase.from("bug_reports").insert({
        user_id: user.id,
        title,
        description,
        screenshot_url: screenshotUrl,
        status: "open",
      });

      if (error) throw error;

      toast({
        title: "Bug Report Submitted",
        description: "Your bug report has been submitted successfully.",
      });

      await fetchBugReports();
      return { success: true };
    } catch (error: any) {
      console.error("Error submitting bug report:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit bug report",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  const updateBugStatus = async (reportId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("bug_reports")
        .update({ status })
        .eq("id", reportId);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Bug report status changed to ${status}`,
      });

      await fetchBugReports();
      return { success: true };
    } catch (error: any) {
      console.error("Error updating bug status:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  const getScreenshotUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from("bug-screenshots")
      .createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  };

  return {
    bugReports,
    loading,
    submitBugReport,
    updateBugStatus,
    getScreenshotUrl,
    refetch: fetchBugReports,
  };
}
