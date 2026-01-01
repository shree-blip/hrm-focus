import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string | null;
  link: string | null;
  is_read: boolean | null;
  read_at: string | null;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching notifications:", error);
        throw error;
      }

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mark single notification as read
  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error marking notification as read:", error);
        throw error;
      }

      // Update local state optimistically
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      toast({ title: "Error", description: "Failed to mark notification as read", variant: "destructive" });
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) {
        console.error("Error marking all notifications as read:", error);
        throw error;
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      
      toast({ title: "Success", description: "All notifications marked as read" });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      toast({ title: "Error", description: "Failed to mark all notifications as read", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Set up real-time subscription
    if (user) {
      console.log("Setting up notifications real-time subscription for user:", user.id);
      
      const channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log("Notification change received:", payload);
            
            if (payload.eventType === 'INSERT') {
              const newNotification = payload.new as Notification;
              setNotifications(prev => [newNotification, ...prev]);
              if (!newNotification.is_read) {
                setUnreadCount(prev => prev + 1);
              }
              // Show toast for new notification
              toast({
                title: newNotification.title,
                description: newNotification.message,
              });
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as Notification;
              setNotifications(prev =>
                prev.map(n => n.id === updated.id ? updated : n)
              );
              // Recalculate unread count
              setNotifications(prev => {
                const count = prev.filter(n => !n.is_read).length;
                setUnreadCount(count);
                return prev;
              });
            } else if (payload.eventType === 'DELETE') {
              const deleted = payload.old as { id: string };
              setNotifications(prev => prev.filter(n => n.id !== deleted.id));
            }
          }
        )
        .subscribe((status) => {
          console.log("Notifications subscription status:", status);
        });

      return () => {
        console.log("Cleaning up notifications subscription");
        supabase.removeChannel(channel);
      };
    }
  }, [user, fetchNotifications]);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
