const ICON_PATH = "/favicon.png";
const AUTO_CLOSE_MS = 5000;

interface DesktopNotificationOptions {
  id: string;
  title: string;
  body: string;
  icon?: string;
  force?: boolean;
  link?: string | null;
}

export function fireOSNotification({
  id,
  title,
  body,
  icon,
  force = false,
  link,
}: DesktopNotificationOptions): void {
  if (!("Notification" in window)) {
    console.warn("[OSNotif] Notification API not supported");
    return;
  }

  if (Notification.permission !== "granted") {
    console.warn("[OSNotif] Permission not granted:", Notification.permission);
    return;
  }

  const isHidden = document.visibilityState === "hidden";
  const isUnfocused = !document.hasFocus();

  if (!force && !isHidden && !isUnfocused) {
    console.log("[OSNotif] Tab visible+focused, skipping");
    return;
  }

  try {
    const n = new Notification(title, {
      body,
      icon: icon ?? ICON_PATH,
      tag: id,
    } as NotificationOptions);

    const timer = setTimeout(() => n.close(), AUTO_CLOSE_MS);

    n.onclick = () => {
      clearTimeout(timer);
      n.close();
      window.focus();
      if (link) window.location.href = link;
    };

    console.log("[OSNotif] Fired OS notification:", title);
  } catch (e) {
    console.warn("[OSNotif] Failed to create notification:", e);
  }
}

// Keep hook wrapper for components that need it
export function useDesktopNotification() {
  return { fireDesktopNotification: fireOSNotification };
}
