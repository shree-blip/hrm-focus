import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Client {
  id: string;
  org_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchClients = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setClients((data as Client[]) || []);
    } catch (error: any) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addClient = async (name: string, description?: string) => {
    if (!user) return null;

    try {
      // Get org_id from employee
      const { data: empData } = await supabase
        .from("employees")
        .select("org_id")
        .eq("email", user.email)
        .single();

      const { data, error } = await supabase
        .from("clients")
        .insert({
          name,
          description: description || null,
          org_id: empData?.org_id || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client added successfully",
      });

      await fetchClients();
      return data as Client;
    } catch (error: any) {
      console.error("Error adding client:", error);
      toast({
        title: "Error",
        description: "Failed to add client",
        variant: "destructive",
      });
      return null;
    }
  };

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return {
    clients,
    loading,
    addClient,
    refetch: fetchClients,
  };
}
