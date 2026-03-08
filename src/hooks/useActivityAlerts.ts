import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast as sonnerToast } from "sonner";
import { sendCrossTabNotification } from "@/lib/crossTabNotifications";

type AttendanceEventType = "clock_in" | "clock_out" | "break_start" | "break_end" | "pause_start" | "pause_end";

interface QueuedEvent {
  type: AttendanceEventType;
  employeeName: string;
  timestamp: string;
}

const EVENT_LABELS: Record<AttendanceEventType, string> = {
  clock_in: "clocked in",
  clock_out: "clocked out",
  break_start: "started a break",
  break_end: "resumed work",
  pause_start: "paused",
  pause_end: "continued",
};

const EVENT_ICONS: Record<AttendanceEventType, string> = {
  clock_in: "🟢",
  clock_out: "🔴",
  break_start: "☕",
  break_end: "💼",
  pause_start: "⏸️",
  pause_end: "▶️",
};

const DEBOUNCE_MS = 3_000; // 3 seconds for snappy feel

// Module-level singleton state
let _navigateFn: ((path: string) => void) | null = null;
let _enabled: boolean | null = null;
const _listeners = new Set<() => void>();
const _queue: QueuedEvent[] = [];
let _timer: ReturnType<typeof setTimeout> | null = null;
const _empCache = new Map<string, string>();
// Track last notified event type per attendance_log ID to prevent duplicates
const _lastNotified = new Map<string, AttendanceEventType>();

function notifyListeners() {
  _listeners.forEach((l) => l());
}

function setEnabled(val: boolean) {
  _enabled = val;
  notifyListeners();
}

function flush() {
  const events = _queue.splice(0);
  _timer = null;
  if (events.length === 0) return;

  if (events.length === 1) {
    const e = events[0];
    const title = `${EVENT_ICONS[e.type]} ${e.employeeName} ${EVENT_LABELS[e.type]}`;
    sonnerToast(title, { duration: 5000 });
    sendCrossTabNotification(title);
    return;
  }

  const groups: Record<string, number> = {};
  events.forEach((e) => {
    const label = EVENT_LABELS[e.type];
    groups[label] = (groups[label] || 0) + 1;
  });
  const parts = Object.entries(groups).map(([label, count]) => `${count} ${label}`);
  const title = `👥 ${events.length} activity updates`;
  const body = parts.join(", ");

  sonnerToast(title, { description: body, duration: 5000 });
  sendOSNotification(title, body);
}

function enqueue(event: QueuedEvent) {
  _queue.push(event);
  if (!_timer) {
    _timer = setTimeout(flush, DEBOUNCE_MS);
  }
}

function resolveEventType(newLog: any, eventType: string): AttendanceEventType | null {
  if (!newLog) return null;
  
  if (eventType === "INSERT") return "clock_in";
  
  // For UPDATE events, determine the most recent action by checking which fields are set
  // Order matters: check the most specific/latest state first
  if (newLog.clock_out) return "clock_out";
  if (newLog.pause_end && newLog.pause_start) return "pause_end";
  if (newLog.pause_start && !newLog.pause_end) return "pause_start";
  if (newLog.break_end && newLog.break_start) return "break_end";
  if (newLog.break_start && !newLog.break_end) return "break_start";
  if (newLog.clock_in && !newLog.clock_out) return "clock_in";
  
  return null;
}

export function useActivityAlerts() {
  const { user } = useAuth();

  const enabled = useSyncExternalStore(
    (cb) => {
      _listeners.add(cb);
      return () => _listeners.delete(cb);
    },
    () => _enabled,
  );

  // Fetch preference on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_preferences")
      .select("activity_alerts_enabled")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setEnabled(data?.activity_alerts_enabled ?? true);
      });
  }, [user]);

  const toggleEnabled = useCallback(
    async (value: boolean) => {
      setEnabled(value);
      if (!user) return;
      await supabase
        .from("user_preferences")
        .update({ activity_alerts_enabled: value })
        .eq("user_id", user.id);
    },
    [user],
  );

  const setNavigate = useCallback((nav: (path: string) => void) => {
    _navigateFn = nav;
  }, []);

  // Resolve name
  const resolveNameRef = useRef(async (userId: string, employeeId: string | null): Promise<string> => {
    const cacheKey = employeeId || userId;
    if (_empCache.has(cacheKey)) return _empCache.get(cacheKey)!;
    let name = "Someone";
    if (employeeId) {
      const { data } = await supabase.from("employees").select("first_name, last_name").eq("id", employeeId).single();
      if (data) name = `${data.first_name} ${data.last_name}`.trim();
    } else {
      const { data } = await supabase.from("profiles").select("first_name, last_name").eq("user_id", userId).single();
      if (data) name = `${data.first_name} ${data.last_name}`.trim();
    }
    _empCache.set(cacheKey, name);
    return name;
  });

  // Realtime subscription
  useEffect(() => {
    if (!user || enabled === false) return;

    const channel = supabase
      .channel("activity-alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_logs" },
        async (payload) => {
          const newLog = payload.new as any;
          if (!newLog) return;

          const evtType = resolveEventType(newLog, payload.eventType);
          if (!evtType) return;

          // Deduplicate: skip if we already notified this event for this log
          const logId = newLog.id as string;
          if (logId && _lastNotified.get(logId) === evtType) return;
          if (logId) _lastNotified.set(logId, evtType);

          const name = await resolveNameRef.current(newLog.user_id, newLog.employee_id);
          if (!name) return;

          enqueue({ type: evtType, employeeName: name, timestamp: new Date().toISOString() });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (_timer) {
        clearTimeout(_timer);
        flush();
      }
    };
  }, [user, enabled]);

  return { enabled, toggleEnabled, setNavigate };
}
