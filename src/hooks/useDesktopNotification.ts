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
      if (!("Notification" in window)) return;

      // Guard: permission granted?
      if (Notification.permission !== "granted") return;

      // Guard: tab must be hidden or unfocused
      if (document.visibilityState === "visible" && document.hasFocus()) return;

      try {
        const notification = new Notification(title, {
          body,
          icon: icon || ICON_PATH,
          tag: id,        // same id → browser overwrites instead of stacking
          renotify: false, // don't re-alert for same tag
        });

        // Auto-close after 5 seconds
        const timer = setTimeout(() => notification.close(), AUTO_CLOSE_MS);

        notification.onclick = () => {
          clearTimeout(timer);
          notification.close();
          window.focus();
          onClick?.();
        };
      } catch {
        // Safari iOS doesn't support Notification constructor
      }
    },
    [navigate]
  );

  return { fireDesktopNotification };
}
