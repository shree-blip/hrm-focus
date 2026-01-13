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
}

let announcementsChannel: ReturnType<typeof supabase.channel> | null = null;
let announcementsChannelUsers = 0;
const channelListeners = new Set<() => void>();

function ensureAnnouncementsChannel() {
  if (announcementsChannel) return;

  announcementsChannel = supabase
    .channel("announcements-realtime-shared")
    .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
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
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const nowIso = new Date().toISOString();

      // ✅ Only fetch active + not expired (expires_at is null OR > now)
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const creatorIds = [...new Set((data || []).map((a) => a.created_by).filter(Boolean))] as string[];

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

      const transformed: Announcement[] = (data || []).map((a) => ({
        ...a,
        publisher_name: a.created_by ? profilesMap[a.created_by] || "System" : "System",
      })) as Announcement[];

      setAnnouncements(transformed);
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // ✅ Auto-refetch when the next announcement is about to expire,
  // so it disappears without needing a DB change.
  useEffect(() => {
    const now = Date.now();
    const upcoming = announcements
      .map((a) => (a.expires_at ? new Date(a.expires_at).getTime() : null))
      .filter((t): t is number => typeof t === "number" && t > now);

    if (upcoming.length === 0) return;

    const nextExpiry = Math.min(...upcoming);
    const delay = Math.min(nextExpiry - now + 1000, 2147483647); // cap for setTimeout

    const t = setTimeout(() => {
      fetchAnnouncements();
    }, delay);

    return () => clearTimeout(t);
  }, [announcements, fetchAnnouncements]);

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
    loading,
    refetch: fetchAnnouncements,
  };
}
