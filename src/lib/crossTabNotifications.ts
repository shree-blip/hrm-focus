/**
 * Cross-Tab Notification System
 *
 * Dual-layer: Web Notifications API + Broadcast Channel API
 * - Leader election prevents duplicate OS notifications across tabs
 * - Broadcast Channel syncs in-app toasts to all tabs
 * - Page Visibility API gates OS notifications to background tabs only
 * - Observable notification log for diagnostics UI
 */

// ─── Types ───────────────────────────────────────────────────────────
export interface CrossTabMessage {
  type: "notification" | "leader_heartbeat" | "leader_resign";
  payload?: NotificationPayload;
  tabId: string;
}

export interface NotificationPayload {
  id: string;
  title: string;
  body?: string;
  tag?: string;
  timestamp: number;
}

export interface NotificationLogEntry {
  id: string;
  title: string;
  body?: string;
  timestamp: number;
  source: "local" | "broadcast";
}

// ─── Singleton State ─────────────────────────────────────────────────
const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const CHANNEL_NAME = "focus-hrms-notifications";
const HEARTBEAT_MS = 3_000;
const LEADER_TIMEOUT_MS = 6_000;
const ICON_PATH = "/favicon.png";
const MAX_LOG = 50;

let _channel: BroadcastChannel | null = null;
let _isLeader = false;
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let _lastLeaderBeat = 0;
let _lastLeaderId = "";
let _onIncomingToast: ((title: string, body?: string) => void) | null = null;
let _initialized = false;

// Observable log + listeners
const _log: NotificationLogEntry[] = [];
const _logListeners = new Set<() => void>();

function emitLogChange() {
  _logListeners.forEach((l) => l());
}

function pushLog(entry: NotificationLogEntry) {
  _log.unshift(entry);
  if (_log.length > MAX_LOG) _log.length = MAX_LOG;
  emitLogChange();
}

// ─── Broadcast Channel ──────────────────────────────────────────────

function getChannel(): BroadcastChannel | null {
  if (!("BroadcastChannel" in window)) {
    console.warn("[CrossTab] BroadcastChannel API not available");
    return null;
  }
  if (!_channel) {
    try {
      _channel = new BroadcastChannel(CHANNEL_NAME);
      _channel.onmessage = handleMessage;
      console.log("[CrossTab] BroadcastChannel created:", CHANNEL_NAME, "tabId:", TAB_ID);
    } catch (e) {
      console.error("[CrossTab] Failed to create BroadcastChannel:", e);
      return null;
    }
  }
  return _channel;
}

function broadcast(msg: CrossTabMessage) {
  try {
    const ch = getChannel();
    if (ch) {
      ch.postMessage(msg);
      if (msg.type === "notification") {
        console.log("[CrossTab] Broadcasted notification:", msg.payload?.title, "from tab:", TAB_ID);
      }
    }
  } catch (e) {
    console.warn("[CrossTab] Broadcast failed:", e);
  }
}

function handleMessage(event: MessageEvent<CrossTabMessage>) {
  const msg = event.data;
  if (!msg || msg.tabId === TAB_ID) return;

  switch (msg.type) {
    case "leader_heartbeat":
      _lastLeaderBeat = Date.now();
      _lastLeaderId = msg.tabId;
      if (_isLeader && msg.tabId < TAB_ID) {
        resignLeader();
      }
      break;

    case "leader_resign":
      if (msg.tabId === _lastLeaderId) {
        tryClaimLeader();
      }
      break;

    case "notification":
      if (msg.payload) {
        console.log("[CrossTab] Received broadcast notification from tab:", msg.tabId, "title:", msg.payload.title);

        pushLog({
          id: msg.payload.id,
          title: msg.payload.title,
          body: msg.payload.body,
          timestamp: msg.payload.timestamp,
          source: "broadcast",
        });

        // Show in-app toast in this tab
        if (_onIncomingToast) {
          console.log("[CrossTab] Firing in-app toast for broadcast");
          _onIncomingToast(msg.payload.title, msg.payload.body);
        } else {
          console.warn("[CrossTab] No toast handler registered!");
        }

        // If we're the leader and hidden, also fire OS notification
        if (_isLeader && (document.visibilityState === "hidden" || !document.hasFocus())) {
          console.log("[CrossTab] Leader tab is hidden/unfocused, firing OS notification");
          fireOSNotification(msg.payload.title, msg.payload.body, msg.payload.tag);
        }
      }
      break;
  }
}

// ─── Leader Election ─────────────────────────────────────────────────

function tryClaimLeader() {
  _isLeader = true;
  console.log("[CrossTab] This tab claimed leader:", TAB_ID);
  sendHeartbeat();
  emitLogChange();
}

function sendHeartbeat() {
  if (!_isLeader) return;
  broadcast({ type: "leader_heartbeat", tabId: TAB_ID });
}

function resignLeader() {
  _isLeader = false;
  console.log("[CrossTab] Resigned leader:", TAB_ID);
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
  emitLogChange();
}

function startLeaderElection() {
  tryClaimLeader();
  _heartbeatTimer = setInterval(() => {
    if (_isLeader) {
      sendHeartbeat();
    } else if (Date.now() - _lastLeaderBeat > LEADER_TIMEOUT_MS) {
      tryClaimLeader();
    }
  }, HEARTBEAT_MS);
}

// ─── OS Notification ────────────────────────────────────────────────

function fireOSNotification(title: string, body?: string, tag?: string) {
  if (!("Notification" in window)) {
    console.log("[CrossTab] Notification API not available");
    return;
  }
  if (Notification.permission !== "granted") {
    console.log("[CrossTab] Notification permission not granted:", Notification.permission);
    return;
  }
  try {
    console.log("[CrossTab] Creating OS notification:", title);
    const n = new Notification(title, {
      body: body ?? undefined,
      icon: ICON_PATH,
      tag,
    });
    setTimeout(() => n.close(), 5000);

    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (e) {
    console.warn("[CrossTab] OS notification failed:", e);
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export function initCrossTabNotifications() {
  if (_initialized) return;
  _initialized = true;
  console.log("[CrossTab] Initializing cross-tab system, tabId:", TAB_ID);
  getChannel();
  startLeaderElection();
  window.addEventListener("beforeunload", () => {
    if (_isLeader) {
      broadcast({ type: "leader_resign", tabId: TAB_ID });
    }
    _channel?.close();
  });
}

export function onCrossTabToast(handler: (title: string, body?: string) => void) {
  _onIncomingToast = handler;
  console.log("[CrossTab] Toast handler registered");
}

export async function requestPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  console.log("[CrossTab] Permission request result:", result);
  return result === "granted";
}

/**
 * Send a notification through both layers:
 * 1. OS notification — if this tab is hidden/unfocused (leader handles dedup)
 * 2. Broadcast to all other tabs for in-app toasts
 */
export function sendCrossTabNotification(title: string, body?: string, tag?: string) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const dedupeTag = tag || `focus-${id}`;
  const now = Date.now();

  console.log("[CrossTab] sendCrossTabNotification:", title, "isLeader:", _isLeader, "visibility:", document.visibilityState, "hasFocus:", document.hasFocus());

  // Log locally
  pushLog({ id, title, body, timestamp: now, source: "local" });

  // Layer 1: OS notification — fire if tab is hidden/unfocused AND we're leader
  if (_isLeader && (document.visibilityState === "hidden" || !document.hasFocus())) {
    fireOSNotification(title, body, dedupeTag);
  }

  // Layer 2: Broadcast to all other tabs
  broadcast({
    type: "notification",
    payload: { id, title, body, tag: dedupeTag, timestamp: now },
    tabId: TAB_ID,
  });
}

export function isLeaderTab(): boolean {
  return _isLeader;
}

export function getTabId(): string {
  return TAB_ID;
}

export function subscribeLog(cb: () => void): () => void {
  _logListeners.add(cb);
  return () => _logListeners.delete(cb);
}

export function getLogSnapshot(): readonly NotificationLogEntry[] {
  return _log;
}

export function getLeaderSnapshot(): boolean {
  return _isLeader;
}

export function clearLog() {
  _log.length = 0;
  emitLogChange();
}

export function destroyCrossTabNotifications() {
  resignLeader();
  if (_isLeader) {
    broadcast({ type: "leader_resign", tabId: TAB_ID });
  }
  _channel?.close();
  _channel = null;
  _initialized = false;
  _onIncomingToast = null;
}
