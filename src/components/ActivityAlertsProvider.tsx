import { useEffect, useRef } from "react";
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

/**
 * Invisible provider that:
 * 1. Wires activity alerts to the router
 * 2. Initialises the cross-tab notification system
 * 3. Subscribes to notification INSERTs and fires desktop + cross-tab notifications
 * 4. Listens for broadcasts from other tabs and shows in-app toasts
 */
export function ActivityAlertsProvider() {
  const navigate = useNavigate();
  const { setNavigate } = useActivityAlerts();
  const { fireDesktopNotification } = useDesktopNotification();
  const { user } = useAuth();
  const processedIdsRef = useRef(new Set<string>());

  useEffect(() => {
    setNavigate(navigate);
  }, [navigate, setNavigate]);

  // Initialise cross-tab system once
  useEffect(() => {
    initCrossTabNotifications();

    // When another tab broadcasts a notification, show an in-app toast here
    onCrossTabToast((title, body) => {
      console.log("[ActivityAlerts] Received cross-tab toast:", title);
      sonnerToast(title, {
        description: body,
        duration: 4000,
      });
    });
  }, []);

  // Dedicated realtime subscription for desktop + cross-tab notifications
  // This is separate from useNotifications to avoid hook sharing issues
  useEffect(() => {
    if (!user) return;

    console.log("[ActivityAlerts] Setting up desktop notification subscription for user:", user.id);

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
          const newNotif = payload.new as {
            id: string;
            title: string;
            message: string;
            type: string | null;
            link: string | null;
            is_read: boolean;
          };

          if (!newNotif?.id) return;

          // Deduplicate within this tab
          if (processedIdsRef.current.has(newNotif.id)) return;
          processedIdsRef.current.add(newNotif.id);

          // Keep the set from growing unbounded
          if (processedIdsRef.current.size > 200) {
            const arr = Array.from(processedIdsRef.current);
            processedIdsRef.current = new Set(arr.slice(-100));
          }

          console.log("[ActivityAlerts] New notification INSERT:", newNotif.title, "visibility:", document.visibilityState, "hasFocus:", document.hasFocus());

          const { title, body } = formatDesktopNotification(newNotif);

          // 1. Fire desktop (OS) notification directly (works even without cross-tab)
          fireDesktopNotification({
            id: newNotif.id,
            title,
            body,
            onClick: () => {
              if (newNotif.link) navigate(newNotif.link);
              else navigate("/notifications");
            },
          });

          // 2. Also broadcast via cross-tab system for other tabs
          sendCrossTabNotification(title, body, `notif-${newNotif.id}`);
        },
      )
      .subscribe((status) => {
        console.log("[ActivityAlerts] Desktop notification subscription status:", status);
      });

    return () => {
      console.log("[ActivityAlerts] Cleaning up desktop notification subscription");
      supabase.removeChannel(channel);
    };
  }, [user?.id, fireDesktopNotification, navigate]);

  return null;
}
