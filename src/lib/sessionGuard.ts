/**
 * Security & Single-Instance / Single-Session Coordinator
 *
 * Rules:
 * 1. Only ONE window/tab allowed for the app per device/browser.
 *    If a second tab or window is opened, it gets blocked with a screen:
 *    "Ya hay una ventana abierta en este dispositivo".
 * 2. Only ONE active session per user across devices.
 *    When a user logs in (or another device logs in with the same user credentials),
 *    the active session is tracked in Firestore (`user_sessions/{userId}`).
 *    If another device/session claims this user account, the previous one gets invalidated / logged out
 *    with a clear notification: "Se ha iniciado sesión con esta cuenta en otro dispositivo".
 */

import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Storage keys
const TAB_ID_KEY = 'pos_active_tab_id';
const TAB_HEARTBEAT_KEY = 'pos_active_tab_heartbeat';
const TAB_CHANNEL_NAME = 'pos_single_tab_channel';
const DEVICE_ID_KEY = 'pos_device_id';

// Generate random UUID-like string
export function generateRandomId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Get or create persistent device ID
export function getDeviceId(): string {
  try {
    let devId = localStorage.getItem(DEVICE_ID_KEY);
    if (!devId) {
      devId = `dev_${generateRandomId()}`;
      localStorage.setItem(DEVICE_ID_KEY, devId);
    }
    return devId;
  } catch (e) {
    return `dev_fallback_${Date.now()}`;
  }
}

// Tab ID unique to THIS specific window / tab instance (in sessionStorage or memory)
let currentTabId: string = '';
try {
  let stored = sessionStorage.getItem('pos_current_window_id');
  if (!stored) {
    stored = `tab_${generateRandomId()}`;
    sessionStorage.setItem('pos_current_window_id', stored);
  }
  currentTabId = stored;
} catch (e) {
  currentTabId = `tab_${generateRandomId()}`;
}

export function getCurrentTabId(): string {
  return currentTabId;
}

/**
 * -------------------------------------------------------------
 * 1. SINGLE WINDOW/TAB LOCK ON SAME DEVICE
 * -------------------------------------------------------------
 */
export function initSingleTabLock(callbacks: {
  onDuplicateTab: () => void;
  onBecameMaster?: () => void;
}): () => void {
  let isMaster = false;
  let heartbeatTimer: any = null;
  let broadcastChannel: BroadcastChannel | null = null;
  const now = () => Date.now();
  const HEARTBEAT_INTERVAL = 1500; // ms
  const TIMEOUT_THRESHOLD = 3500; // If master hasn't pinged in 3.5s, it crashed/closed

  // Try using BroadcastChannel if supported
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(TAB_CHANNEL_NAME);
    } catch (e) {
      broadcastChannel = null;
    }
  }

  const claimMaster = () => {
    isMaster = true;
    try {
      localStorage.setItem(TAB_ID_KEY, currentTabId);
      localStorage.setItem(TAB_HEARTBEAT_KEY, String(now()));
    } catch (e) {}

    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'CLAIM_MASTER', tabId: currentTabId });
    }

    if (callbacks.onBecameMaster) {
      callbacks.onBecameMaster();
    }
  };

  const checkTabStatus = () => {
    try {
      const activeTab = localStorage.getItem(TAB_ID_KEY);
      const lastHeartbeat = parseInt(localStorage.getItem(TAB_HEARTBEAT_KEY) || '0', 10);
      const isAlive = (now() - lastHeartbeat) < TIMEOUT_THRESHOLD;

      if (!activeTab || activeTab === currentTabId || !isAlive) {
        // No active tab, or it was this tab, or the previous master tab expired/closed
        claimMaster();
      } else {
        // Another tab is active and healthy!
        isMaster = false;
        callbacks.onDuplicateTab();
      }
    } catch (e) {
      // Fallback
      claimMaster();
    }
  };

  // Immediate check
  checkTabStatus();

  // Heartbeat loop
  heartbeatTimer = setInterval(() => {
    if (isMaster) {
      try {
        localStorage.setItem(TAB_ID_KEY, currentTabId);
        localStorage.setItem(TAB_HEARTBEAT_KEY, String(now()));
      } catch (e) {}
    } else {
      // If we are currently a blocked tab, check if master was closed
      const activeTab = localStorage.getItem(TAB_ID_KEY);
      const lastHeartbeat = parseInt(localStorage.getItem(TAB_HEARTBEAT_KEY) || '0', 10);
      const isAlive = (now() - lastHeartbeat) < TIMEOUT_THRESHOLD;
      if (!activeTab || !isAlive) {
        claimMaster();
      }
    }
  }, HEARTBEAT_INTERVAL);

  // BroadcastChannel message handling
  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      const { type, tabId } = event.data || {};
      if (type === 'CLAIM_MASTER') {
        if (tabId !== currentTabId && isMaster) {
          // Another tab was opened and claims master or asks who is master
          // We assert our primacy if we were already master
          broadcastChannel?.postMessage({ type: 'MASTER_PING', tabId: currentTabId });
        }
      } else if (type === 'MASTER_PING') {
        if (tabId !== currentTabId) {
          isMaster = false;
          callbacks.onDuplicateTab();
        }
      } else if (type === 'PING') {
        if (isMaster) {
          broadcastChannel?.postMessage({ type: 'PONG', tabId: currentTabId });
        }
      }
    };
  }

  // Window storage event (fires across tabs in the same browser)
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === TAB_ID_KEY) {
      if (e.newValue && e.newValue !== currentTabId) {
        // Another tab set itself as master
        isMaster = false;
        callbacks.onDuplicateTab();
      }
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  // Clean up on beforeunload
  const handleUnload = () => {
    if (isMaster) {
      try {
        const activeTab = localStorage.getItem(TAB_ID_KEY);
        if (activeTab === currentTabId) {
          localStorage.removeItem(TAB_ID_KEY);
          localStorage.removeItem(TAB_HEARTBEAT_KEY);
        }
      } catch (e) {}
    }
  };
  window.addEventListener('beforeunload', handleUnload);

  return () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    window.removeEventListener('storage', handleStorageEvent);
    window.removeEventListener('beforeunload', handleUnload);
    if (broadcastChannel) {
      try {
        broadcastChannel.close();
      } catch (e) {}
    }
  };
}

/**
 * -------------------------------------------------------------
 * 2. SINGLE ACTIVE SESSION PER USER ACROSS DEVICES (Firestore)
 * -------------------------------------------------------------
 */
let sessionUnsubscribe: (() => void) | null = null;
let currentSessionToken: string = '';

export function getCurrentSessionToken(): string {
  return currentSessionToken;
}

/**
 * Register / Claim user session in Firestore and monitor for concurrent logins
 */
export async function registerUserSession(
  userId: string,
  userName: string,
  userRole: string,
  onRemoteTerminated: (reason: string) => void
): Promise<string> {
  // Clear any existing listener
  if (sessionUnsubscribe) {
    sessionUnsubscribe();
    sessionUnsubscribe = null;
  }

  const deviceId = getDeviceId();
  const sessionToken = `sess_${generateRandomId()}`;
  currentSessionToken = sessionToken;

  try {
    sessionStorage.setItem('pos_user_session_token', sessionToken);
    localStorage.setItem('pos_current_session_token', sessionToken);
  } catch (e) {}

  const sessionDocRef = doc(db, 'user_sessions', userId);

  // Set new session info in Firestore
  try {
    await setDoc(sessionDocRef, {
      userId,
      userName,
      userRole,
      sessionToken,
      deviceId,
      platform: navigator.userAgent || 'unknown',
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      active: true
    }, { merge: true });
  } catch (err: any) {
    console.warn("Could not register session in cloud (operating offline or quota):", err);
  }

  // Subscribe to real-time changes to detect if another device logs in
  try {
    sessionUnsubscribe = onSnapshot(sessionDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.sessionToken && data.sessionToken !== sessionToken) {
          // Another device or login took over this user account!
          console.warn(`User ${userName} logged in from another device/session.`);
          onRemoteTerminated(
            `La sesión se ha cerrado porque este usuario inició sesión en otro dispositivo o ventana.`
          );
        }
      }
    }, (error) => {
      console.warn("User session snapshot error:", error);
    });
  } catch (err) {
    console.warn("Failed to listen to user session updates:", err);
  }

  return sessionToken;
}

/**
 * Release active user session
 */
export function clearUserSession() {
  if (sessionUnsubscribe) {
    sessionUnsubscribe();
    sessionUnsubscribe = null;
  }
  currentSessionToken = '';
  try {
    sessionStorage.removeItem('pos_user_session_token');
    localStorage.removeItem('pos_current_session_token');
  } catch (e) {}
}
