/**
 * OS-level notification helper using the standard Web Notification API.
 * Works even when the tab is backgrounded or the triggering component is unmounted.
 */

const ICON_PATH = "/favicon.png";

/** Request permission once (idempotent, safe to call multiple times). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/** Fire an OS notification if permission is granted. No-op otherwise. */
export function sendOSNotification(title: string, body?: string): void {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    new Notification(title, {
      body: body ?? undefined,
      icon: ICON_PATH,
    });
  } catch {
    // Safari on iOS doesn't support the constructor – silently ignore
  }
}
