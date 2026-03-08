import { useState, useEffect, useCallback } from "react";

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") return;
    if (Notification.permission === "denied") {
      alert(
        "Notifications are blocked. Click the lock icon in your browser address bar and allow notifications."
      );
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    console.log("[Permission] Result:", result);
  }, []);

  return { permission, requestPermission };
}
