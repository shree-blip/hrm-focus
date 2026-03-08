import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface DesktopNotificationOptions {
  id: string;
  title: string;
  body: string;
  icon?: string;
  onClick?: () => void;
}

const ICON_PATH = "/favicon.png";
const AUTO_CLOSE_MS = 5_000;

/**
 * Fires an OS-level notification ONLY when:
 *   1. Permission is 'granted'
 *   2. Tab is hidden or unfocused
 *
 * Uses `tag` = notification ID for cross-tab deduplication.
 * Auto-closes after 5 s. Clicking focuses the window and navigates.
 */
export function useDesktopNotification() {
  const navigate = useNavigate();

  const fireDesktopNotification = useCallback(
    ({ id, title, body, icon, onClick }: DesktopNotificationOptions) => {
      // Guard: API available?
      if (!("Notification" in window)) {
        console.log("[DesktopNotif] Notification API not available");
        return;
      }

      // Guard: permission granted?
      if (Notification.permission !== "granted") {
        console.log("[DesktopNotif] Permission not granted:", Notification.permission);
        return;
      }

      // Guard: tab must be hidden or unfocused
      const isHidden = document.visibilityState === "hidden";
      const hasFocus = document.hasFocus();
      console.log("[DesktopNotif] Checking visibility:", { isHidden, hasFocus, title });

      if (!isHidden && hasFocus) {
        console.log("[DesktopNotif] Tab is visible and focused, skipping OS notification (in-app handles it)");
        return;
      }

      try {
        console.log("[DesktopNotif] Firing OS notification:", title);
        const notification = new Notification(title, {
          body,
          icon: icon || ICON_PATH,
          tag: id, // same id → browser overwrites instead of stacking
        } as NotificationOptions);

        // Auto-close after 5 seconds
        const timer = setTimeout(() => notification.close(), AUTO_CLOSE_MS);

        notification.onclick = () => {
          clearTimeout(timer);
          notification.close();
          window.focus();
          onClick?.();
        };
      } catch (e) {
        console.warn("[DesktopNotif] Failed to create notification:", e);
      }
    },
    [navigate]
  );

  return { fireDesktopNotification };
}
