import { useEffect, useRef, useCallback } from "react";
import type { Notification } from "./useNotifications";
import { useDesktopNotification } from "./useDesktopNotification";

const CHANNEL_NAME = "hrm-notifications";

export function useBroadcastChannel() {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const { fireDesktopNotification } = useDesktopNotification();

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const notification = event.data as Notification;
      console.log("[BroadcastChannel] Received from another tab:", notification.title);

      // Always fire OS notification for cross-tab events
      // force: true bypasses visibility check — user is in THIS tab, not the originating tab
      fireDesktopNotification({
        id: notification.id,
        title: notification.title,
        body: notification.message,
        force: true,
      });
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [fireDesktopNotification]);

  const broadcast = useCallback((notification: Notification) => {
    channelRef.current?.postMessage(notification);
    console.log("[BroadcastChannel] Broadcasted to other tabs:", notification.title);
  }, []);

  return { broadcast };
}
