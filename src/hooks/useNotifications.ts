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
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate unread count from notifications state (single source of truth)
  const unreadCount = notifications.filter((n) => n.is_read === false).length;

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

      // Normalize is_read to boolean (handle null as false)
      const normalizedData = (data || []).map((n) => ({
        ...n,
        is_read: n.is_read === true, // Convert null to false
      }));

      setNotifications(normalizedData);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mark single notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!user) return;

      // Find the notification first to check if it's already read
      const notification = notifications.find((n) => n.id === notificationId);
      if (!notification || notification.is_read) {
        return; // Already read or doesn't exist
      }

      // Optimistic update - update state immediately
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)),
      );

      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("id", notificationId)
          .eq("user_id", user.id);

        if (error) {
          console.error("Error marking notification as read:", error);
          // Revert optimistic update on error
          setNotifications((prev) =>
            prev.map((n) => (n.id === notificationId ? { ...n, is_read: false, read_at: null } : n)),
          );
          throw error;
        }
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
        toast({ title: "Error", description: "Failed to mark notification as read", variant: "destructive" });
      }
    },
    [user, notifications],
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    const unreadNotifications = notifications.filter((n) => !n.is_read);
    if (unreadNotifications.length === 0) return;

    // Optimistic update - update state immediately
    const previousNotifications = [...notifications];
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at || new Date().toISOString() })),
    );

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) {
        console.error("Error marking all notifications as read:", error);
        // Revert optimistic update on error
        setNotifications(previousNotifications);
        throw error;
      }

      toast({ title: "Success", description: "All notifications marked as read" });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      toast({ title: "Error", description: "Failed to mark all notifications as read", variant: "destructive" });
    }
  }, [user, notifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Separate effect for realtime subscription to avoid re-subscribing on every fetch
  useEffect(() => {
    if (!user) return;

    console.log("Setting up notifications real-time subscription for user:", user.id);

    const channel = supabase
      .channel(`notifications-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("New notification received:", payload);
          const newNotification = payload.new as Notification;
          // Normalize is_read
          const normalized = {
            ...newNotification,
            is_read: newNotification.is_read === true,
          };
          setNotifications((prev) => {
            // Prevent duplicates
            if (prev.some((n) => n.id === normalized.id)) return prev;
            return [normalized, ...prev];
          });
          // Show toast for new notification
          toast({
            title: normalized.title,
            description: normalized.message,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Notification updated:", payload);
          const updated = payload.new as Notification;
          // Normalize is_read
          const normalized = {
            ...updated,
            is_read: updated.is_read === true,
          };
          setNotifications((prev) => prev.map((n) => (n.id === normalized.id ? normalized : n)));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Notification deleted:", payload);
          const deleted = payload.old as { id: string };
          setNotifications((prev) => prev.filter((n) => n.id !== deleted.id));
        },
      )
      .subscribe((status) => {
        console.log("Notifications subscription status:", status);
      });

    return () => {
      console.log("Cleaning up notifications subscription");
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
