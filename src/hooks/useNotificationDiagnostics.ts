import { useSyncExternalStore, useState, useEffect, useCallback } from "react";
import {
  subscribeLog,
  getLogSnapshot,
  getLeaderSnapshot,
  sendCrossTabNotification,
  requestPermission,
  clearLog,
  getTabId,
  type NotificationLogEntry,
} from "@/lib/crossTabNotifications";

/**
 * Hook exposing cross-tab notification diagnostics:
 * - permission status (reactive)
 * - visibility state (reactive)
 * - leader status (reactive)
 * - notification log (reactive)
 * - actions: sendTest, requestPerm, clear
 */
export function useNotificationDiagnostics() {
  // Notification log via useSyncExternalStore
  const log: readonly NotificationLogEntry[] = useSyncExternalStore(subscribeLog, getLogSnapshot);
  const isLeader = useSyncExternalStore(subscribeLog, getLeaderSnapshot);

  // Permission status — poll on mount + after request
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied"
  );

  // Visibility state — reactive
  const [visibility, setVisibility] = useState<DocumentVisibilityState>(document.visibilityState);

  useEffect(() => {
    const handler = () => setVisibility(document.visibilityState);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const handleRequestPermission = useCallback(async () => {
    await requestPermission();
    if ("Notification" in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const sendTestNotification = useCallback(() => {
    const types = ["info", "success", "warning", "alert"];
    const type = types[Math.floor(Math.random() * types.length)];
    const titles: Record<string, string> = {
      info: "📋 New task assigned",
      success: "✅ Leave request approved",
      warning: "⚠️ Payroll deadline approaching",
      alert: "🔴 System maintenance in 30 min",
    };
    sendCrossTabNotification(
      titles[type] || "Test notification",
      `This is a ${type} test event from tab ${getTabId().slice(-6)}`,
      undefined
    );
  }, []);

  return {
    log,
    isLeader,
    tabId: getTabId(),
    permissionStatus,
    visibility,
    requestPermission: handleRequestPermission,
    sendTestNotification,
    clearLog,
  };
}
