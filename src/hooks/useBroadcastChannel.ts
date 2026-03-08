import { useEffect, useRef, useCallback } from "react";
import { fireOSNotification } from "./useDesktopNotification";

const CHANNEL_NAME = "hrm-notifications-v1";

export interface BroadcastPayload {
  id: string;
  title: string;
  message: string;
  link: string | null;
}

export function useBroadcastChannel() {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) {
      console.warn("[BroadcastChannel] Not supported in this browser");
      return;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<BroadcastPayload>) => {
      const { id, title, message, link } = event.data;
      console.log("[BroadcastChannel] Received from another tab:", title);

      fireOSNotification({
        id,
        title,
        body: message,
        link,
        force: true,
      });
    };

    console.log("[BroadcastChannel] Listening on channel:", CHANNEL_NAME);

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const broadcast = useCallback((payload: BroadcastPayload) => {
    if (channelRef.current) {
      channelRef.current.postMessage(payload);
      console.log("[BroadcastChannel] Broadcasted to other tabs:", payload.title);
    }
  }, []);

  return { broadcast };
}
