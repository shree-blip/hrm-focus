import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useActivityAlerts } from "@/hooks/useActivityAlerts";
import { useDesktopNotification } from "@/hooks/useDesktopNotification";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import {
  initCrossTabNotifications,
  onCrossTabToast,
} from "@/lib/crossTabNotifications";
import { toast as sonnerToast } from "sonner";

/** HRM-specific notification title/body mapping */
function formatDesktopNotification(n: Notification): { title: string; body: string } {
  const type = (n.type || "").toLowerCase();

  if (type.includes("leave_approved") || n.title.toLowerCase().includes("leave approved")) {
    return { title: "✅ Leave Approved", body: n.message };
  }
  if (type.includes("leave_rejected") || n.title.toLowerCase().includes("leave rejected") || n.title.toLowerCase().includes("leave declined")) {
    return { title: "❌ Leave Rejected", body: n.message };
  }
  if (type.includes("leave_request") || n.title.toLowerCase().includes("leave request")) {
    return { title: "📋 New Leave Request", body: n.message };
  }
  if (type.includes("payroll") || n.title.toLowerCase().includes("payroll")) {
    return { title: "💰 Payroll Processed", body: n.message };
  }
  if (type.includes("task") || n.title.toLowerCase().includes("task")) {
    return { title: "📌 New Task Assigned", body: n.message };
  }
  if (type.includes("announcement") || n.title.toLowerCase().includes("announcement")) {
    return { title: "📢 Company Announcement", body: n.message };
  }
  if (type.includes("attendance") || n.title.toLowerCase().includes("attendance") || n.title.toLowerCase().includes("clock")) {
    return { title: "⏰ Attendance Alert", body: n.message };
  }

  // Fallback: use original title
  return { title: n.title, body: n.message };
}

/**
 * Invisible provider that:
 * 1. Wires activity alerts to the router
 * 2. Initialises the cross-tab notification system
 * 3. Listens for broadcasts from other tabs and shows in-app toasts
 * 4. Fires OS desktop notifications for new DB notifications
 */
export function ActivityAlertsProvider() {
  const navigate = useNavigate();
  const { setNavigate } = useActivityAlerts();
  const { fireDesktopNotification } = useDesktopNotification();
  const { notifications } = useNotifications();

  useEffect(() => {
    setNavigate(navigate);
  }, [navigate, setNavigate]);

  // Initialise cross-tab system once
  useEffect(() => {
    initCrossTabNotifications();

    // When another tab broadcasts a notification, show an in-app toast here
    onCrossTabToast((title, body) => {
      sonnerToast(title, {
        description: body,
        duration: 4000,
      });
    });
  }, []);

  // Fire desktop notification for each NEW unread notification
  const lastSeenRef = useRef("");

  useEffect(() => {
    if (!notifications.length) return;

    const newest = notifications[0]; // sorted by created_at desc
    if (!newest || newest.is_read) return;
    if (newest.id === lastSeenRef.current) return;

    lastSeenRef.current = newest.id;

    const { title, body } = formatDesktopNotification(newest);
    fireDesktopNotification({
      id: newest.id,
      title,
      body,
      onClick: () => {
        if (newest.link) navigate(newest.link);
        else navigate("/notifications");
      },
    });
  }, [notifications, fireDesktopNotification, navigate]);

  return null;
}

/** Tiny ref helper to track last notification we already processed */
function useLastSeenNotification() {
  const ref = { current: "" as string };
  return ref;
}
