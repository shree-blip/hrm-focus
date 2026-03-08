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
 * 2. Initialises the cross-tab notification system
 * 3. Listens for broadcasts from other tabs and shows in-app toasts
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

    // When another tab broadcasts a notification, show an in-app toast here
    onCrossTabToast((title, body) => {
      sonnerToast(title, {
        description: body,
        duration: 5000,
      });
    });
  }, []);

  return null;
}
