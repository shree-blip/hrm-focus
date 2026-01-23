import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Client {
  id: string;
  name: string;
  description: string | null;
  org_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientInput {
  name: string;
  description?: string;
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchClients = useCallback(async () => {
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
      toast({
        title: "Error",
        description: "Failed to fetch clients",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const addClient = async (input: ClientInput): Promise<Client | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Get org_id from employee
      const { data: employeeData } = await supabase
        .from("employees")
        .select("org_id")
        .eq("email", userData.user.email)
        .single();

      const { data, error } = await supabase
        .from("clients")
        .insert({
          name: input.name,
          description: input.description || null,
          org_id: employeeData?.org_id || null,
          created_by: userData.user.id,
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

  const updateClient = async (id: string, input: Partial<ClientInput>) => {
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          name: input.name,
          description: input.description,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client updated successfully",
      });

      await fetchClients();
    } catch (error: any) {
      console.error("Error updating client:", error);
      toast({
        title: "Error",
        description: "Failed to update client",
        variant: "destructive",
      });
    }
  };

  const deactivateClient = async (id: string) => {
    try {
      const { error } = await supabase
        .from("clients")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client deactivated successfully",
      });

      await fetchClients();
    } catch (error: any) {
      console.error("Error deactivating client:", error);
      toast({
        title: "Error",
        description: "Failed to deactivate client",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return {
    clients,
    loading,
    addClient,
    updateClient,
    deactivateClient,
    refetch: fetchClients,
  };
}
