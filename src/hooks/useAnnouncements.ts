import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Announcement {
  id: string;
  org_id: string | null;
  title: string;
  content: string;
  type: string;
  is_pinned: boolean | null;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean | null;
  publisher_name?: string;
  deleted_at?: string | null;
}

export interface AnnouncementHistory extends Announcement {
  history_reason: "expired" | "deleted";
}

let announcementsChannel: ReturnType<typeof supabase.channel> | null = null;
let announcementsChannelUsers = 0;
const channelListeners = new Set<() => void>();

function ensureAnnouncementsChannel() {
  if (announcementsChannel) return;

  announcementsChannel = supabase
    .channel("announcements-realtime-shared")
    .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
      // Trigger all listeners on any change
      channelListeners.forEach((fn) => fn());
    })
    .subscribe();
}

function teardownAnnouncementsChannelIfUnused() {
  if (!announcementsChannel || announcementsChannelUsers > 0) return;
  supabase.removeChannel(announcementsChannel);
  announcementsChannel = null;
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [history, setHistory] = useState<AnnouncementHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  const fetchAnnouncements = useCallback(async () => {
    try {
      const nowIso = new Date().toISOString();

      // Fetch active + not expired announcements
      const { data: activeData, error: activeError } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (activeError) throw activeError;

      // Fetch history: expired announcements OR soft-deleted (is_active = false)
      const { data: historyData, error: historyError } = await supabase
        .from("announcements")
        .select("*")
        .or(`is_active.eq.false,and(is_active.eq.true,expires_at.lt.${nowIso})`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (historyError) throw historyError;

      // Get all unique creator IDs from both active and history
      const allData = [...(activeData || []), ...(historyData || [])];
      const creatorIds = [...new Set(allData.map((a) => a.created_by).filter(Boolean))] as string[];

      let profilesMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", creatorIds);

        if (profiles) {
          profilesMap = profiles.reduce(
            (acc, p) => {
              acc[p.user_id] = `${p.first_name} ${p.last_name}`;
              return acc;
            },
            {} as Record<string, string>,
          );
        }
      }

      // Transform active announcements
      const transformedActive: Announcement[] = (activeData || []).map((a) => ({
        ...a,
        publisher_name: a.created_by ? profilesMap[a.created_by] || "System" : "System",
      })) as Announcement[];

      // Transform history announcements with reason
      const transformedHistory: AnnouncementHistory[] = (historyData || []).map((a) => {
        const isExpired = a.is_active && a.expires_at && new Date(a.expires_at).getTime() < Date.now();
        return {
          ...a,
          publisher_name: a.created_by ? profilesMap[a.created_by] || "System" : "System",
          history_reason: isExpired ? "expired" : "deleted",
        } as AnnouncementHistory;
      });

      setAnnouncements(transformedActive);
      setHistory(transformedHistory);
      setLastRefresh(Date.now());
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Auto-refetch when the next announcement is about to expire
  useEffect(() => {
    const now = Date.now();
    const upcoming = announcements
      .map((a) => (a.expires_at ? new Date(a.expires_at).getTime() : null))
      .filter((t): t is number => typeof t === "number" && t > now);

    if (upcoming.length === 0) return;

    const nextExpiry = Math.min(...upcoming);
    // Refresh 500ms after expiry to ensure it's moved to history
    const delay = Math.min(nextExpiry - now + 500, 2147483647);

    const t = setTimeout(() => {
      console.log("Auto-refreshing: announcement expired");
      fetchAnnouncements();
    }, delay);

    return () => clearTimeout(t);
  }, [announcements, fetchAnnouncements, lastRefresh]);

  // Periodic check every 30 seconds to catch any missed expirations
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const hasExpired = announcements.some((a) => a.expires_at && new Date(a.expires_at).getTime() <= now);

      if (hasExpired) {
        console.log("Periodic check: found expired announcements");
        fetchAnnouncements();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [announcements, fetchAnnouncements]);

  // Realtime subscription
  useEffect(() => {
    announcementsChannelUsers += 1;
    ensureAnnouncementsChannel();

    channelListeners.add(fetchAnnouncements);

    return () => {
      channelListeners.delete(fetchAnnouncements);
      announcementsChannelUsers -= 1;
      teardownAnnouncementsChannelIfUnused();
    };
  }, [fetchAnnouncements]);

  return {
    announcements,
    history,
    loading,
    refetch: fetchAnnouncements,
  };
}
