import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useActivityAlerts } from "@/hooks/useActivityAlerts";
import {
  initCrossTabNotifications,
  onCrossTabToast,
} from "@/lib/crossTabNotifications";
import { toast as sonnerToast } from "sonner";

/**
 * Invisible provider that:
 * 1. Wires activity alerts to the router
 * 2. Initialises the cross-tab toast system
 *
 * OS notifications are now handled directly in useNotifications.ts + useBroadcastChannel.ts
 */
export function ActivityAlertsProvider() {
  const navigate = useNavigate();
  const { setNavigate } = useActivityAlerts();

  useEffect(() => {
    setNavigate(navigate);
  }, [navigate, setNavigate]);

  // Initialise cross-tab system once
  useEffect(() => {
    initCrossTabNotifications();

    onCrossTabToast((title, body) => {
      console.log("[ActivityAlerts] Received cross-tab toast:", title);
      sonnerToast(title, {
        description: body,
        duration: 4000,
      });
    });
  }, []);

  return null;
}
