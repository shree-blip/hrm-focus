import { useState, useEffect } from "react";
import { Bell, X, Settings2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";

const DISMISS_KEY = "desktop-notification-banner-dismissed";

export function NotificationPermissionBanner() {
  const { permission, requestPermission } = useNotificationPermission();
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return false;
    if (localStorage.getItem(DISMISS_KEY) === "true") return false;
    return true;
  });

  if (!visible) return null;

  const handleEnable = async () => {
    await requestPermission();
    // Always dismiss after attempting — in iframes the request may silently fail
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  };

  // When permission is denied, show helpful recovery instructions
  if (permission === "denied") {
    return (
      <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mx-4 mt-2 animate-in fade-in slide-in-from-top-2">
        <Settings2 className="h-5 w-5 text-destructive shrink-0" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">
            Desktop notifications are currently blocked
          </p>
          <p className="text-xs text-muted-foreground">
            To enable: Click the <span className="inline-flex items-center font-medium text-foreground">🔒 lock icon</span> in your address bar → <span className="font-medium text-foreground">Site settings</span> → Set <span className="font-medium text-foreground">Notifications</span> to <span className="font-medium text-primary">Allow</span> → Refresh the page.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            // Some browsers allow re-requesting after user resets in settings
            handleEnable();
          }}
          className="shrink-0 text-xs"
        >
          Try Again
        </Button>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Default state — ask user to enable
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