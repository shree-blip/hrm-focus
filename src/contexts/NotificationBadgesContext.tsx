import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type BadgeModule =
  | "approvals"
  | "leave"
  | "tasks"
  | "announcements"
  | "hiring"
  | "loans"
  | "support";

type BadgeState = Record<BadgeModule, boolean>;

const EMPTY: BadgeState = {
  approvals: false,
  leave: false,
  tasks: false,
  announcements: false,
  hiring: false,
  loans: false,
  support: false,
};

interface Ctx {
  badges: BadgeState;
  markModuleRead: (m: BadgeModule) => void;
}

const NotificationBadgesContext = createContext<Ctx>({ badges: EMPTY, markModuleRead: () => {} });

export function NotificationBadgesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [badges, setBadges] = useState<BadgeState>(EMPTY);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setBadges(EMPTY);
      userIdRef.current = null;
      return;
    }
    userIdRef.current = user.id;

    // 1) One-time initial query
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("module")
        .eq("user_id", user.id)
        .is("read_at", null)
        .not("module", "is", null);
      if (cancelled || error || !data) return;
      const next: BadgeState = { ...EMPTY };
      for (const row of data as Array<{ module: string | null }>) {
        if (row.module && row.module in next) next[row.module as BadgeModule] = true;
      }
      setBadges(next);
    })();

    // 2) Single realtime subscription (INSERT only)
    const channel = supabase
      .channel(`notif-badges-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { module: string | null; read_at: string | null };
          if (!row.module || row.read_at) return;
          if (!(row.module in EMPTY)) return;
          setBadges((prev) =>
            prev[row.module as BadgeModule] ? prev : { ...prev, [row.module as BadgeModule]: true },
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markModuleRead = useCallback((m: BadgeModule) => {
    // Optimistic: clear instantly
    setBadges((prev) => (prev[m] ? { ...prev, [m]: false } : prev));
    const uid = userIdRef.current;
    if (!uid) return;
    // Fire-and-forget
    void supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString(), is_read: true })
      .eq("user_id", uid)
      .eq("module", m)
      .is("read_at", null);
  }, []);

  return (
    <NotificationBadgesContext.Provider value={{ badges, markModuleRead }}>
      {children}
    </NotificationBadgesContext.Provider>
  );
}

export function useNotificationBadges() {
  return useContext(NotificationBadgesContext);
}