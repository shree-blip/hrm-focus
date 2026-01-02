import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
      // First fetch announcements
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching announcements:", error);
        throw error;
      }

      // Get unique creator IDs
      const creatorIds = [...new Set((data || []).map(a => a.created_by).filter(Boolean))] as string[];
      
      // Fetch profiles for creators
      let profilesMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", creatorIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = `${p.first_name} ${p.last_name}`;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Transform data to include publisher_name
      const transformed: Announcement[] = (data || []).map((a) => ({
        id: a.id,
        org_id: a.org_id,
        title: a.title,
        content: a.content,
        type: a.type,
        is_pinned: a.is_pinned,
        created_by: a.created_by,
        created_at: a.created_at,
        expires_at: a.expires_at,
        is_active: a.is_active,
        publisher_name: a.created_by ? (profilesMap[a.created_by] || 'System') : 'System',
      }));

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

  // Separate effect for realtime to avoid re-subscribing
  useEffect(() => {
    console.log("Setting up announcements real-time subscription");
    
    const channel = supabase
      .channel('announcements-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements'
        },
        async (payload) => {
          console.log("New announcement received:", payload);
          const newAnnouncement = payload.new as Announcement;
          if (newAnnouncement.is_active) {
            // Fetch publisher name
            let publisherName = 'System';
            if (newAnnouncement.created_by) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("first_name, last_name")
                .eq("user_id", newAnnouncement.created_by)
                .single();
              if (profile) {
                publisherName = `${profile.first_name} ${profile.last_name}`;
              }
            }
            
            const transformed: Announcement = {
              ...newAnnouncement,
              publisher_name: publisherName,
            };
            
            setAnnouncements(prev => {
              if (prev.some(a => a.id === transformed.id)) return prev;
              const updated = [transformed, ...prev];
              return updated.sort((a, b) => {
                if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'announcements'
        },
        (payload) => {
          console.log("Announcement updated:", payload);
          const updated = payload.new as Announcement;
          if (updated.is_active) {
            setAnnouncements(prev =>
              prev.map(a => a.id === updated.id ? { ...a, ...updated } : a)
            );
          } else {
            setAnnouncements(prev => prev.filter(a => a.id !== updated.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'announcements'
        },
        (payload) => {
          console.log("Announcement deleted:", payload);
          const deleted = payload.old as { id: string };
          setAnnouncements(prev => prev.filter(a => a.id !== deleted.id));
        }
      )
      .subscribe((status) => {
        console.log("Announcements subscription status:", status);
      });

    return () => {
      console.log("Cleaning up announcements subscription");
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    announcements,
    loading,
    refetch: fetchAnnouncements,
  };
}
