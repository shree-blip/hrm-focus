import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestNotificationPermission } from "@/lib/osNotification";

/**
 * A small banner that asks the user to enable OS-level notifications.
 * Only renders when Notification.permission === "default" (not yet decided).
 * Requires a user click (gesture) to satisfy browser security requirements.
 */
export function NotificationPermissionBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleEnable = async () => {
    try {
      // Must be called from a direct user gesture (click)
      const granted = await requestNotificationPermission();
      setVisible(false);
      if (granted) {
        console.log("OS notifications enabled ✓");
      } else {
        console.warn("OS notifications denied or unavailable");
      }
    } catch (err) {
      console.error("Failed to request notification permission:", err);
      setVisible(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 mx-4 mt-2 animate-in fade-in slide-in-from-top-2">
      <Bell className="h-4 w-4 text-primary shrink-0" />
      <p className="text-sm text-foreground flex-1">
        Enable desktop notifications to stay updated even when this tab is in the background.
      </p>
      <Button size="sm" variant="default" onClick={handleEnable} className="shrink-0">
        Enable
      </Button>
      <button
        onClick={() => setVisible(false)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
