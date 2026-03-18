import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const POLL_INTERVAL = 30_000;

export type BadgeCounts = Record<string, number>;

/** Map sidebar hrefs to badge keys returned by the edge function */
const HREF_TO_BADGE_KEY: Record<string, string> = {
  "/attendance": "attendance",
  "/leave": "leave",
  "/tasks": "tasks",
  "/announcements": "announcements",
  "/documents": "documents",
  "/invoices": "invoices",
  "/loans": "loans",
  "/support": "support",
};

export function useSidebarBadges() {
  const { session } = useAuth();
  const [badges, setBadges] = useState<BadgeCounts>({});
  const clearedRef = useRef<Set<string>>(new Set());

  const fetchBadges = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const { data, error } = await supabase.functions.invoke("sidebar-badges", {
        method: "GET",
      });
      if (!error && data) {
        setBadges((prev) => {
          const next = { ...data } as BadgeCounts;
          // Re-apply cleared keys
          clearedRef.current.forEach((key) => {
            delete next[key];
          });
          return next;
        });
      }
    } catch {
      // silently ignore fetch errors
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!session) return;
    fetchBadges();
    const id = setInterval(fetchBadges, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchBadges, session]);

  const clearBadge = useCallback((href: string) => {
    const key = HREF_TO_BADGE_KEY[href];
    if (key) {
      clearedRef.current.add(key);
      setBadges((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, []);

  // Reset cleared keys when fresh data comes in after 30s
  // (already handled above by re-applying cleared set)

  const getBadgeCount = useCallback(
    (href: string): number => {
      const key = HREF_TO_BADGE_KEY[href];
      return key ? badges[key] || 0 : 0;
    },
    [badges],
  );

  return { getBadgeCount, clearBadge, badges };
}
