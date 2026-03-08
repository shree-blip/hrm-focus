import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useDesktopNotification } from "./useDesktopNotification";
import { useBroadcastChannel } from "./useBroadcastChannel";

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
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { fireDesktopNotification } = useDesktopNotification();
  const { broadcast } = useBroadcastChannel();

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

      const normalizedData = (data || []).map((n) => ({
        ...n,
        is_read: n.is_read === true,
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

      const notification = notifications.find((n) => n.id === notificationId);
      if (!notification || notification.is_read) return;

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

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    console.log("[Notifications] Setting up realtime subscription for user:", user.id);

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
          console.log("[Notifications] New notification received:", payload);
          const newNotification = payload.new as Notification;
          const normalized = {
            ...newNotification,
            is_read: newNotification.is_read === true,
          };
          setNotifications((prev) => {
            if (prev.some((n) => n.id === normalized.id)) return prev;
            return [normalized, ...prev];
          });

          // Show in-app toast always
          toast({
            title: normalized.title,
            description: normalized.message,
          });

          // Fire OS notification on THIS tab if hidden/unfocused (force: false)
          setTimeout(() => {
            fireDesktopNotification({
              id: normalized.id,
              title: normalized.title,
              body: normalized.message,
              force: false,
              onClick: normalized.link ? () => navigate(normalized.link!) : undefined,
            });
          }, 100);

          // Tell ALL other tabs — they will fire OS notification with force: true
          broadcast(normalized);
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
          const updated = payload.new as Notification;
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
          const deleted = payload.old as { id: string };
          setNotifications((prev) => prev.filter((n) => n.id !== deleted.id));
        },
      )
      .subscribe((status) => {
        console.log("[Notifications] Subscription status:", status);
      });

    return () => {
      console.log("[Notifications] Cleaning up subscription");
      supabase.removeChannel(channel);
    };
  }, [user?.id, fireDesktopNotification, broadcast, navigate]);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
