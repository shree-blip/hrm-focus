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
  source: "local" | "broadcast"; // did this tab originate it or receive via broadcast
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
  _log.unshift(entry); // newest first
  if (_log.length > MAX_LOG) _log.length = MAX_LOG;
  emitLogChange();
}

// ─── Broadcast Channel ──────────────────────────────────────────────

function getChannel(): BroadcastChannel | null {
  if (!("BroadcastChannel" in window)) return null;
  if (!_channel) {
    _channel = new BroadcastChannel(CHANNEL_NAME);
    _channel.onmessage = handleMessage;
  }
  return _channel;
}

function broadcast(msg: CrossTabMessage) {
  try {
    getChannel()?.postMessage(msg);
  } catch {
    // Channel might be closed
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
        // Log it as a broadcast-received event
        pushLog({
          id: msg.payload.id,
          title: msg.payload.title,
          body: msg.payload.body,
          timestamp: msg.payload.timestamp,
          source: "broadcast",
        });

        // Show in-app toast
        _onIncomingToast?.(msg.payload.title, msg.payload.body);

        // If we're the leader and tab is hidden, fire OS notification
        // (the originating tab may not have been leader)
        if (_isLeader && document.visibilityState === "hidden") {
          fireOSNotification(msg.payload.title, msg.payload.body, msg.payload.tag);
        }
      }
      break;
  }
}

// ─── Leader Election ─────────────────────────────────────────────────

function tryClaimLeader() {
  _isLeader = true;
  sendHeartbeat();
  emitLogChange(); // leader status changed
}

function sendHeartbeat() {
  if (!_isLeader) return;
  broadcast({ type: "leader_heartbeat", tabId: TAB_ID });
}

function resignLeader() {
  _isLeader = false;
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

// ─── Public API ─────────────────────────────────────────────────────

export function initCrossTabNotifications() {
  if (_initialized) return;
  _initialized = true;
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
}

export async function requestPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Send a notification through both layers:
 * 1. OS notification — only if this tab is leader AND page is hidden
 * 2. Broadcast to all other tabs for in-app toasts
 */
export function sendCrossTabNotification(title: string, body?: string, tag?: string) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const dedupeTag = tag || `focus-${id}`;
  const now = Date.now();

  // Log locally
  pushLog({ id, title, body, timestamp: now, source: "local" });

  // Layer 1: OS notification (leader + hidden only)
  if (_isLeader && document.visibilityState === "hidden") {
    fireOSNotification(title, body, dedupeTag);
  }

  // Layer 2: Broadcast to all other tabs
  broadcast({
    type: "notification",
    payload: { id, title, body, tag: dedupeTag, timestamp: now },
    tabId: TAB_ID,
  });
}

function fireOSNotification(title: string, body?: string, tag?: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body: body ?? undefined,
      icon: ICON_PATH,
      tag, // same tag = browser replaces instead of stacking
    });
    setTimeout(() => n.close(), 6000);
  } catch {
    // Safari iOS doesn't support constructor
  }
}

export function isLeaderTab(): boolean {
  return _isLeader;
}

export function getTabId(): string {
  return TAB_ID;
}

/** Subscribe to log changes (for React useSyncExternalStore) */
export function subscribeLog(cb: () => void): () => void {
  _logListeners.add(cb);
  return () => _logListeners.delete(cb);
}

/** Snapshot of current log (for React useSyncExternalStore) */
export function getLogSnapshot(): readonly NotificationLogEntry[] {
  return _log;
}

/** Snapshot to check leader status reactively */
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
