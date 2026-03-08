/**
 * OS-level notification helper — now delegates to crossTabNotifications
 * for leader-aware, deduplicated delivery.
 * 
 * Kept as a thin wrapper for backward compatibility with existing call sites.
 */

import { requestPermission, sendCrossTabNotification } from "./crossTabNotifications";

export const requestNotificationPermission = requestPermission;

/** Fire a notification through the cross-tab system (OS + broadcast) */
export function sendOSNotification(title: string, body?: string): void {
  sendCrossTabNotification(title, body);
}
