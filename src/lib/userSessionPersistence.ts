import { User } from '../types';

const STORAGE_KEY = 'posUser';
const SESSION_BACKUP_KEY = 'pos_session_backup';
const COOKIE_KEY = 'pos_auth_backup';
const IDB_NAME = 'cazuelas_auth_vault';
const IDB_STORE = 'session_backup';
const IDB_KEY = 'active_user';

// Open or create IndexedDB storage for indestructible session backup
function openAuthDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeToIndexedDB(user: User): Promise<void> {
  try {
    const db = await openAuthDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(user, IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Non-fatal
  }
}

async function readFromIndexedDB(): Promise<User | null> {
  try {
    const db = await openAuthDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        const val = req.result;
        if (val && typeof val === 'object' && (val.name || val.username || val.role)) {
          resolve(val as User);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

async function deleteFromIndexedDB(): Promise<void> {
  try {
    const db = await openAuthDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.delete(IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (err) {
    // Non-fatal
  }
}

function setCookieBackup(user: User): void {
  try {
    if (typeof document === 'undefined') return;
    const json = JSON.stringify({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      pin: user.pin,
      active: user.active
    });
    const encoded = encodeURIComponent(json);
    // Persist for 365 days
    document.cookie = `${COOKIE_KEY}=${encoded}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (e) {}
}

function getCookieBackup(): User | null {
  try {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + COOKIE_KEY + '=([^;]*)'));
    if (match && match[2]) {
      const decoded = decodeURIComponent(match[2]);
      const parsed = JSON.parse(decoded);
      if (parsed && (parsed.name || parsed.username)) {
        return parsed as User;
      }
    }
  } catch (e) {}
  return null;
}

function removeCookieBackup(): void {
  try {
    if (typeof document === 'undefined') return;
    document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
  } catch (e) {}
}

/**
 * Saves the active staff/user session across 4 independent redundant tiers:
 * 1. LocalStorage (instant synchronous access)
 * 2. SessionStorage (survives tab clears within window)
 * 3. Browser Cookie (survives site-data / simple storage clears)
 * 4. Dedicated IndexedDB Database (survives localStorage eviction)
 */
export async function saveUserSession(user: User): Promise<void> {
  if (!user) return;
  
  // Normalize user object
  const cleanUser: User = {
    ...user,
    name: user.name || user.username || 'Usuario',
    role: user.role || 'waiter'
  };

  const serialized = JSON.stringify(cleanUser);

  // 1. LocalStorage
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (e) {}

  // 2. SessionStorage
  try {
    sessionStorage.setItem(SESSION_BACKUP_KEY, serialized);
  } catch (e) {}

  // 3. Cookie
  setCookieBackup(cleanUser);

  // 4. IndexedDB
  await writeToIndexedDB(cleanUser);
}

/**
 * Restores user session even if browser cache / localStorage was emptied.
 * Checks all 4 tiers in priority order. If restored from a secondary tier,
 * immediately repairs localStorage so the rest of the application runs transparently.
 */
export async function restoreUserSession(): Promise<User | null> {
  // Tier 1: LocalStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.name || parsed.username || parsed.role)) {
        // Sync backups in background
        saveUserSession(parsed).catch(() => {});
        return parsed;
      }
    }
  } catch (e) {}

  // Tier 2: SessionStorage
  try {
    const rawSession = sessionStorage.getItem(SESSION_BACKUP_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed && (parsed.name || parsed.username || parsed.role)) {
        console.info("[SessionRecovery] Restored user session from sessionStorage backup.");
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); } catch (e) {}
        saveUserSession(parsed).catch(() => {});
        return parsed;
      }
    }
  } catch (e) {}

  // Tier 3: Browser Cookie
  const cookieUser = getCookieBackup();
  if (cookieUser) {
    console.info("[SessionRecovery] Restored user session from cookie backup.");
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cookieUser)); } catch (e) {}
    saveUserSession(cookieUser).catch(() => {});
    return cookieUser;
  }

  // Tier 4: Dedicated IndexedDB
  const idbUser = await readFromIndexedDB();
  if (idbUser) {
    console.info("[SessionRecovery] Restored user session from IndexedDB vault.");
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(idbUser)); } catch (e) {}
    saveUserSession(idbUser).catch(() => {});
    return idbUser;
  }

  return null;
}

/**
 * Removes the session completely across all 4 tiers when the user clicks 'Cerrar Sesión'
 */
export async function clearUserSessionPersistence(): Promise<void> {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  try { sessionStorage.removeItem(SESSION_BACKUP_KEY); } catch (e) {}
  removeCookieBackup();
  await deleteFromIndexedDB();
}

/**
 * Safe Cache Purge & Maintenance:
 * Clears bloated local collection caches, stale temporary keys, and resets Firestore memory,
 * while STRICTLY preserving the active user credentials and pending offline operations queue.
 */
export async function safePurgeCacheAndMaintain(preserveSession: boolean = true): Promise<{ freedKeys: number }> {
  let currentUser: User | null = null;
  if (preserveSession) {
    currentUser = await restoreUserSession();
  }

  let freedCount = 0;
  const keysToClean: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Preserve critical keys
      if (key === STORAGE_KEY || key === 'offline_operations_queue' || key === 'pos_device_id') {
        continue;
      }

      // Purge collection caches that get bloated
      if (
        key.startsWith('offline_cache_col_cashLogs') ||
        key.startsWith('offline_cache_col_cashAudits') ||
        key.startsWith('offline_cache_col_tipLoans') ||
        key.startsWith('offline_cache_col_chats') ||
        key.startsWith('offline_cache_query_') ||
        key.startsWith('custom_music_library')
      ) {
        keysToClean.push(key);
      }
    }

    keysToClean.forEach(k => {
      try {
        localStorage.removeItem(k);
        freedCount++;
      } catch (e) {}
    });

    // Prune orders cache to keep only active tickets
    const rawOrders = localStorage.getItem('offline_cache_col_orders');
    if (rawOrders) {
      try {
        const parsed = JSON.parse(rawOrders);
        if (Array.isArray(parsed)) {
          const trimmed = parsed
            .filter((o: any) => o && ['pending', 'preparing', 'ready', 'served'].includes(o.status || 'pending'))
            .slice(0, 50);
          localStorage.setItem('offline_cache_col_orders', JSON.stringify(trimmed));
        }
      } catch (e) {}
    }

    // Re-verify session is secured
    if (preserveSession && currentUser) {
      await saveUserSession(currentUser);
    }
  } catch (err) {
    console.warn("safePurgeCacheAndMaintain error:", err);
  }

  return { freedKeys: freedCount };
}
