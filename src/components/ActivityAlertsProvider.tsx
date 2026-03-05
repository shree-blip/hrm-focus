import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useActivityAlerts } from "@/hooks/useActivityAlerts";
import { requestNotificationPermission } from "@/lib/osNotification";

/**
 * Invisible provider component that wires up the activity alerts
 * system with the router's navigate function.
 * Must be rendered inside a <BrowserRouter>.
 */
export function ActivityAlertsProvider() {
  const navigate = useNavigate();
  const { setNavigate } = useActivityAlerts();

  useEffect(() => {
    setNavigate(navigate);
  }, [navigate, setNavigate]);

  // Request OS notification permission on first load
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return null;
}
