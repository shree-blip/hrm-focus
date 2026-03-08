import { useState, useEffect, useCallback } from "react";

export type PermissionState = NotificationPermission | "unsupported";

export function useNotificationPermission() {
  const isSupported = "Notification" in window;

  const [permission, setPermission] = useState<PermissionState>(() =>
    isSupported ? Notification.permission : "unsupported"
  );

  // Sync if permission changes externally (e.g. user toggles in browser settings)
  useEffect(() => {
    if (!isSupported) return;

    // permissions API lets us watch for changes
    let cleanup: (() => void) | undefined;
    navigator.permissions?.query?.({ name: "notifications" as PermissionName }).then((status) => {
      const onChange = () => setPermission(Notification.permission);
      status.addEventListener("change", onChange);
      cleanup = () => status.removeEventListener("change", onChange);
    }).catch(() => {/* Safari may not support this */});

    return () => cleanup?.();
  }, [isSupported]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) return "denied";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [isSupported]);

  return { permission, requestPermission, isSupported };
}
