import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface CompanySettings {
  companyName: string;
  timezone: string;
  fiscalYear: string;
  payFrequency: string;
  // Regional settings
  usOvertimeMultiplier: number;
  nepalWorkWeek: number;
}

const DEFAULT_SETTINGS: CompanySettings = {
  companyName: "Focus Your Finance",
  timezone: "America/New_York (EST)",
  fiscalYear: "January 1",
  payFrequency: "Semi-Monthly",
  usOvertimeMultiplier: 1.5,
  nepalWorkWeek: 6,
};

const STORAGE_KEY = "company_settings";

export function useCompanySettings() {
  const { isVP } = useAuth();
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch {
      // Use defaults
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (updates: Partial<CompanySettings>) => {
    if (!isVP) {
      toast({ title: "Unauthorized", description: "Only VP can modify company settings", variant: "destructive" });
      return;
    }

    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      toast({ title: "Settings Saved", description: "Company settings have been updated" });
    } catch {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    }
  };

  return {
    settings,
    loading,
    saveSettings,
    refetch: fetchSettings,
  };
}
