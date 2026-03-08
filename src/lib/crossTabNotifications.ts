/**
 * Cross-Tab Notification System
 * 
 * Dual-layer: Web Notifications API + Broadcast Channel API
 * - Leader election prevents duplicate OS notifications across tabs
 * - Broadcast Channel syncs in-app toasts to all tabs
 * - Page Visibility API gates OS notifications to background tabs only
 */

// ─── Types ───────────────────────────────────────────────────────────
export interface CrossTabMessage {
  type: "notification" | "leader_heartbeat" | "leader_resign";
  payload?: {
    id: string;
    title: string;
    body?: string;
    tag?: string; // dedup key for OS notifications
    timestamp: number;
  };
  tabId: string;
}

// ─── Singleton State ─────────────────────────────────────────────────
const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const CHANNEL_NAME = "focus-hrms-notifications";
const HEARTBEAT_MS = 3_000;
const LEADER_TIMEOUT_MS = 6_000;
const ICON_PATH = "/favicon.png";

let _channel: BroadcastChannel | null = null;
let _isLeader = false;
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let _lastLeaderBeat = 0;
let _lastLeaderId = "";
let _onIncomingToast: ((title: string, body?: string) => void) | null = null;
let _initialized = false;

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
  if (!msg || msg.tabId === TAB_ID) return; // ignore own messages

  switch (msg.type) {
    case "leader_heartbeat":
      _lastLeaderBeat = Date.now();
      _lastLeaderId = msg.tabId;
      // If another tab is leader, we're not
      if (_isLeader && msg.tabId < TAB_ID) {
        // Lower ID wins — resign
        resignLeader();
      }
      break;

    case "leader_resign":
      if (msg.tabId === _lastLeaderId) {
        // Leader left, try to claim
        tryClaimLeader();
      }
      break;

    case "notification":
      // Another tab sent a notification — show in-app toast here
      if (msg.payload && _onIncomingToast) {
        _onIncomingToast(msg.payload.title, msg.payload.body);
      }
      break;
  }
}

// ─── Leader Election (lowest TAB_ID wins) ────────────────────────────

function tryClaimLeader() {
  _isLeader = true;
  sendHeartbeat();
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
}

function startLeaderElection() {
  // Claim leadership initially — if another tab has a lower ID it will
  // override us via the heartbeat handler
  tryClaimLeader();

  _heartbeatTimer = setInterval(() => {
    if (_isLeader) {
      sendHeartbeat();
    } else {
      // Check if leader is still alive
      if (Date.now() - _lastLeaderBeat > LEADER_TIMEOUT_MS) {
        tryClaimLeader();
      }
    }
  }, HEARTBEAT_MS);
}

// ─── Public API ─────────────────────────────────────────────────────

/** Initialize the cross-tab system. Call once in app root. */
export function initCrossTabNotifications() {
  if (_initialized) return;
  _initialized = true;

  getChannel();
  startLeaderElection();

  // Resign when tab closes
  window.addEventListener("beforeunload", () => {
    if (_isLeader) {
      broadcast({ type: "leader_resign", tabId: TAB_ID });
    }
    _channel?.close();
  });
}

/** Register a callback for incoming cross-tab toasts */
export function onCrossTabToast(handler: (title: string, body?: string) => void) {
  _onIncomingToast = handler;
}

/** Request notification permission (must be called from user gesture) */
export async function requestPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Send a notification through both layers:
 * 1. OS notification — only if this tab is leader AND page is hidden (deduped via tag)
 * 2. Broadcast to all other tabs for in-app toasts
 */
export function sendCrossTabNotification(
  title: string,
  body?: string,
  tag?: string,
) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const dedupeTag = tag || `focus-${id}`;

  // Layer 1: OS notification (leader only, background only)
  if (_isLeader && document.visibilityState === "hidden") {
    fireOSNotification(title, body, dedupeTag);
  } else if (_isLeader && document.visibilityState === "visible") {
    // Leader is visible — still fire OS notification so user sees it
    // (the in-app toast will also show in-tab)
    // Actually, per spec: if visible, skip OS notification to avoid annoyance
    // The in-app toast is sufficient
  }

  // If page is hidden and we're NOT leader, the leader tab will handle OS notification
  // But we should still tell the leader — however the leader also subscribes to the
  // same realtime channel, so it already knows. We just broadcast for in-app toasts.

  // Layer 2: Broadcast to all other tabs for in-app toast
  broadcast({
    type: "notification",
    payload: { id, title, body, tag: dedupeTag, timestamp: Date.now() },
    tabId: TAB_ID,
  });
}

function fireOSNotification(title: string, body?: string, tag?: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const notification = new Notification(title, {
      body: body ?? undefined,
      icon: ICON_PATH,
      tag, // same tag = browser replaces instead of stacking duplicates
    });

    // Auto-close after 6s
    setTimeout(() => notification.close(), 6000);
  } catch {
    // Safari iOS doesn't support constructor
  }
}

/** Check if this tab is the current leader */
export function isLeaderTab(): boolean {
  return _isLeader;
}

/** Cleanup — call on unmount if needed */
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
