import { useEffect, useRef, useCallback } from "react";
import type { Notification } from "./useNotifications";

const CHANNEL_NAME = "hrm-notifications";

export function useBroadcastChannel(
  onReceive: (notification: Notification) => void
) {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const notification = event.data as Notification;
      onReceive(notification);
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [onReceive]);

  const broadcast = useCallback((notification: Notification) => {
    channelRef.current?.postMessage(notification);
  }, []);

  return { broadcast };
}
