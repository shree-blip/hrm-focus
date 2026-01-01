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
}

export function useAnnouncements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
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

      setAnnouncements(data || []);
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();

    // Set up real-time subscription
    console.log("Setting up announcements real-time subscription");
    
    const channel = supabase
      .channel('announcements-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements'
        },
        (payload) => {
          console.log("Announcement change received:", payload);
          
          if (payload.eventType === 'INSERT') {
            const newAnnouncement = payload.new as Announcement;
            if (newAnnouncement.is_active) {
              setAnnouncements(prev => {
                // Insert based on pinned status and created_at
                const updated = [...prev, newAnnouncement];
                return updated.sort((a, b) => {
                  if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                });
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Announcement;
            if (updated.is_active) {
              setAnnouncements(prev =>
                prev.map(a => a.id === updated.id ? updated : a)
              );
            } else {
              // If deactivated, remove from list
              setAnnouncements(prev => prev.filter(a => a.id !== updated.id));
            }
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setAnnouncements(prev => prev.filter(a => a.id !== deleted.id));
          }
        }
      )
      .subscribe((status) => {
        console.log("Announcements subscription status:", status);
      });

    return () => {
      console.log("Cleaning up announcements subscription");
      supabase.removeChannel(channel);
    };
  }, [fetchAnnouncements]);

  return {
    announcements,
    loading,
    refetch: fetchAnnouncements,
  };
}
