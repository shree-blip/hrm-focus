import { useCallback } from "react";

interface DesktopNotificationOptions {
  id: string;
  title: string;
  body: string;
  icon?: string;
  force?: boolean;
  onClick?: () => void;
}

const ICON_PATH = "/favicon.png";
const AUTO_CLOSE_MS = 5_000;

export function useDesktopNotification() {
  const fireDesktopNotification = useCallback(
    ({ id, title, body, icon, force = false, onClick }: DesktopNotificationOptions) => {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      const isHidden = document.visibilityState === "hidden";
      const hasFocus = document.hasFocus();

      if (!force && !isHidden && hasFocus) {
        console.log("[DesktopNotif] Tab visible+focused, skipping (in-app toast handles it)");
        return;
      }

      try {
        console.log("[DesktopNotif] Firing OS notification:", title, { force, isHidden, hasFocus });
        const notification = new Notification(title, {
          body,
          icon: icon || ICON_PATH,
          tag: id,
        } as NotificationOptions);

        const timer = setTimeout(() => notification.close(), AUTO_CLOSE_MS);

        notification.onclick = () => {
          clearTimeout(timer);
          notification.close();
          window.focus();
          onClick?.();
        };
      } catch (e) {
        console.warn("[DesktopNotif] Failed:", e);
      }
    },
    []
  );

  return { fireDesktopNotification };
}
