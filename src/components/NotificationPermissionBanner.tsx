import { useState, useEffect } from "react";
import { Bell, X, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";

const DISMISS_KEY = "desktop-notification-banner-dismissed";

export function NotificationPermissionBanner() {
  const { permission, requestPermission } = useNotificationPermission();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (permission !== "default") return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;
    setVisible(true);
  }, [permission]);

  if (!visible) return null;

  const handleEnable = async () => {
    await requestPermission();
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  };

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-3 bg-muted border border-border rounded-lg px-4 py-2.5 mx-4 mt-2 animate-in fade-in slide-in-from-top-2">
        <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground flex-1">
          Desktop notifications are blocked. To enable them, click the lock icon in your browser address bar → Permissions → Notifications → Allow.
        </p>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 mx-4 mt-2 animate-in fade-in slide-in-from-top-2">
      <Bell className="h-4 w-4 text-primary shrink-0" />
      <p className="text-sm text-foreground flex-1">
        Enable desktop notifications to stay updated on leave requests, payroll alerts, and approvals — even when you're in another tab.
      </p>
      <Button size="sm" variant="default" onClick={handleEnable} className="shrink-0">
        Enable Notifications
      </Button>
      <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Not now">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
