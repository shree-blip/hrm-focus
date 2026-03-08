import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useActivityAlerts } from "@/hooks/useActivityAlerts";
import { useDesktopNotification } from "@/hooks/useDesktopNotification";
import {
  initCrossTabNotifications,
  onCrossTabToast,
  sendCrossTabNotification,
} from "@/lib/crossTabNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast as sonnerToast } from "sonner";

/** HRM-specific notification title/body mapping */
function formatDesktopNotification(n: { type?: string | null; title: string; message: string }): { title: string; body: string } {
  const type = (n.type || "").toLowerCase();
  const titleLower = n.title.toLowerCase();

  if (type.includes("leave_approved") || titleLower.includes("leave approved"))
    return { title: "✅ Leave Approved", body: n.message };
  if (type.includes("leave_rejected") || titleLower.includes("leave rejected") || titleLower.includes("leave declined"))
    return { title: "❌ Leave Rejected", body: n.message };
  if (type.includes("leave_request") || titleLower.includes("leave request"))
    return { title: "📋 New Leave Request", body: n.message };
  if (type.includes("payroll") || titleLower.includes("payroll"))
    return { title: "💰 Payroll Processed", body: n.message };
  if (type.includes("task") || titleLower.includes("task"))
    return { title: "📌 New Task Assigned", body: n.message };
  if (type.includes("announcement") || titleLower.includes("announcement"))
    return { title: "📢 Company Announcement", body: n.message };
  if (type.includes("attendance") || titleLower.includes("attendance") || titleLower.includes("clock"))
    return { title: "⏰ Attendance Alert", body: n.message };

  return { title: n.title, body: n.message };
}

interface NotifRow {
  id: string;
  title: string;
  message: string;
  type: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const POLL_INTERVAL_MS = 10_000; // Poll every 10 seconds as fallback

/**
 * Invisible provider that:
 * 1. Wires activity alerts to the router
 * 2. Initialises the cross-tab notification system
 * 3. Subscribes to notification INSERTs via Supabase Realtime
 * 4. Polls for new notifications as a fallback (in case Realtime fails silently)
 * 5. Fires desktop + cross-tab notifications for new items
 */
export function ActivityAlertsProvider() {
  const navigate = useNavigate();
  const { setNavigate } = useActivityAlerts();
  const { fireDesktopNotification } = useDesktopNotification();
  const { user } = useAuth();
  const processedIdsRef = useRef(new Set<string>());
  const lastPollTimeRef = useRef<string | null>(null);

  useEffect(() => {
    setNavigate(navigate);
  }, [navigate, setNavigate]);

  // Initialise cross-tab system once
  useEffect(() => {
    initCrossTabNotifications();

    onCrossTabToast((title, body) => {
      console.log("[ActivityAlerts] Received cross-tab toast:", title);
      sonnerToast(title, {
        description: body,
        duration: 4000,
      });
    });
  }, []);

  // Process a new notification — fire desktop + cross-tab
  const processNewNotification = useCallback(
    (notif: NotifRow) => {
      if (!notif?.id) return;
      if (processedIdsRef.current.has(notif.id)) return;
      processedIdsRef.current.add(notif.id);

      // Keep the set bounded
      if (processedIdsRef.current.size > 200) {
        const arr = Array.from(processedIdsRef.current);
        processedIdsRef.current = new Set(arr.slice(-100));
      }

      console.log("[ActivityAlerts] Processing notification:", notif.title, "visibility:", document.visibilityState, "hasFocus:", document.hasFocus());

      const { title, body } = formatDesktopNotification(notif);

      // Fire desktop (OS) notification
      fireDesktopNotification({
        id: notif.id,
        title,
        body,
        onClick: () => {
          if (notif.link) navigate(notif.link);
          else navigate("/notifications");
        },
      });

      // Broadcast via cross-tab system for other tabs
      sendCrossTabNotification(title, body, `notif-${notif.id}`);
    },
    [fireDesktopNotification, navigate],
  );

  // Layer 1: Supabase Realtime subscription
  useEffect(() => {
    if (!user) return;

    console.log("[ActivityAlerts] Setting up realtime subscription for user:", user.id);

    const channel = supabase
      .channel(`desktop-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("[ActivityAlerts] Realtime INSERT received:", payload.new?.title);
          processNewNotification(payload.new as NotifRow);
        },
      )
      .subscribe((status) => {
        console.log("[ActivityAlerts] Realtime subscription status:", status);
      });

    return () => {
      console.log("[ActivityAlerts] Cleaning up realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [user?.id, processNewNotification]);

  // Layer 2: Polling fallback — catches anything Realtime missed
  useEffect(() => {
    if (!user) return;

    // Set initial poll time to now (don't re-process old notifications)
    if (!lastPollTimeRef.current) {
      lastPollTimeRef.current = new Date().toISOString();
    }

    let active = true;

    const poll = async () => {
      if (!active) return;

      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("id, title, message, type, link, is_read, created_at")
          .eq("user_id", user.id)
          .eq("is_read", false)
          .gt("created_at", lastPollTimeRef.current!)
          .order("created_at", { ascending: true })
          .limit(10);

        if (error) {
          console.warn("[ActivityAlerts] Poll error:", error.message);
          return;
        }

        if (data && data.length > 0) {
          console.log("[ActivityAlerts] Poll found", data.length, "new notifications");
          // Update the poll cursor to the newest notification's created_at
          lastPollTimeRef.current = data[data.length - 1].created_at;

          for (const notif of data) {
            processNewNotification(notif as NotifRow);
          }
        }
      } catch (e) {
        console.warn("[ActivityAlerts] Poll exception:", e);
      }
    };

    const timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user?.id, processNewNotification]);

  return null;
}
