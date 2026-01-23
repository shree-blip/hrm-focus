import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ClientAlert {
  id: string;
  client_id: string;
  title: string;
  message: string;
  alert_type: string;
  is_active: boolean;
  show_on_selection: boolean;
  org_id: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
}

export function useClientAlerts(clientId?: string) {
  const [alerts, setAlerts] = useState<ClientAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchAlertsForClient = useCallback(async (id: string) => {
    if (!id) return [];
    
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("client_alerts")
        .select("*")
        .eq("client_id", id)
        .eq("is_active", true)
        .eq("show_on_selection", true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as ClientAlert[]) || [];
    } catch (error: any) {
      console.error("Error fetching client alerts:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_alerts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAlerts((data as ClientAlert[]) || []);
    } catch (error: any) {
      console.error("Error fetching alerts:", error);
      toast({
        title: "Error",
        description: "Failed to fetch alerts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createAlert = async (input: {
    client_id: string;
    title: string;
    message: string;
    alert_type?: string;
    expires_at?: string;
    show_on_selection?: boolean;
  }) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data: employeeData } = await supabase
        .from("employees")
        .select("org_id")
        .eq("email", userData.user.email)
        .single();

      const { error } = await supabase.from("client_alerts").insert({
        client_id: input.client_id,
        title: input.title,
        message: input.message,
        alert_type: input.alert_type || "info",
        expires_at: input.expires_at || null,
        show_on_selection: input.show_on_selection ?? true,
        org_id: employeeData?.org_id || null,
        created_by: userData.user.id,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Alert created successfully",
      });

      await fetchAllAlerts();
    } catch (error: any) {
      console.error("Error creating alert:", error);
      toast({
        title: "Error",
        description: "Failed to create alert",
        variant: "destructive",
      });
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("client_alerts")
        .update({ is_active: false })
        .eq("id", alertId);

      if (error) throw error;

      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (error: any) {
      console.error("Error dismissing alert:", error);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchAlertsForClient(clientId).then(setAlerts);
    }
  }, [clientId, fetchAlertsForClient]);

  return {
    alerts,
    loading,
    fetchAlertsForClient,
    fetchAllAlerts,
    createAlert,
    dismissAlert,
  };
}
