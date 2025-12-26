import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface UserPreferences {
  id: string;
  user_id: string;
  theme: string | null;
  leave_notifications: boolean | null;
  task_notifications: boolean | null;
  payroll_notifications: boolean | null;
  performance_notifications: boolean | null;
  email_digest: boolean | null;
}

export function useSettings() {
  const { user, profile } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!error && data) {
      setPreferences(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPreferences();
  }, [user]);

  const updateProfile = async (updates: {
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { error } = await supabase
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
      return { error };
    }

    toast({
      title: "Profile Updated",
      description: "Your profile has been updated successfully",
    });

    return { error: null };
  };

  const updateAvatar = async (file: File) => {
    if (!user) return { error: new Error("Not authenticated") };

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast({
        title: "Upload Failed",
        description: uploadError.message,
        variant: "destructive",
      });
      return { error: uploadError };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    // Update profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (updateError) {
      toast({
        title: "Error",
        description: "Failed to update avatar",
        variant: "destructive",
      });
      return { error: updateError };
    }

    toast({
      title: "Avatar Updated",
      description: "Your profile photo has been updated",
    });

    return { error: null, url: urlData.publicUrl };
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { error } = await supabase
      .from("user_preferences")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive",
      });
      return { error };
    }

    toast({
      title: "Preferences Updated",
      description: "Your notification preferences have been saved",
    });

    fetchPreferences();
    return { error: null };
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    // Supabase requires re-authentication for password change
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
      return { error };
    }

    toast({
      title: "Password Updated",
      description: "Your password has been changed successfully",
    });

    return { error: null };
  };

  return {
    preferences,
    loading,
    updateProfile,
    updateAvatar,
    updatePreferences,
    updatePassword,
    refetch: fetchPreferences,
  };
}
