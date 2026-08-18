import { 
  collection, 
  doc, 
  addDoc as firestoreAddDoc, 
  updateDoc as firestoreUpdateDoc, 
  deleteDoc as firestoreDeleteDoc, 
  setDoc as firestoreSetDoc,
  onSnapshot as firestoreOnSnapshot,
  getDocs,
  query,
  limit,
  DocumentData,
  QueryConstraint
} from "firebase/firestore";
import { db } from "../firebase";
import toast from "react-hot-toast";

export interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'set';
  collectionName: string;
  docId: string;
  data?: any;
  timestamp: number;
}

// Global listeners for offline state changes
type OfflineStateListener = (isOffline: boolean, pendingCount: number) => void;
const stateListeners = new Set<OfflineStateListener>();

// Cache listeners for collection data changes
type CacheListener = (collectionName: string, data: any[]) => void;
const cacheListeners = new Map<string, Set<CacheListener>>();

// Safe localStorage wrapper for iframe applets
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }
};

// Internal states
let isSimulatingOffline = safeStorage.getItem('simulate_offline_mode') === 'true';
let isSyncing = false;
let isBrowserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

// Check if really online (online status + firebase accessible)
export function getOfflineStatus(): boolean {
  if (isSimulatingOffline) return true;
  return !isBrowserOnline;
}

export function toggleSimulateOffline(simulate: boolean) {
  isSimulatingOffline = simulate;
  safeStorage.setItem('simulate_offline_mode', simulate ? 'true' : 'false');
  notifyStateChange();
  
  if (!simulate && isBrowserOnline) {
    // Attempt automatic sync when turning off offline simulation
    syncOfflineData();
  }
}

export function getPendingOperationsCount(): number {
  const queue = getQueue();
  return queue.length;
}

// Subscribe to connection status changes
export function subscribeToOfflineState(listener: OfflineStateListener) {
  stateListeners.add(listener);
  listener(getOfflineStatus(), getPendingOperationsCount());
  return () => {
    stateListeners.delete(listener);
  };
}

function notifyStateChange() {
  const isOffline = getOfflineStatus();
  const pendingCount = getPendingOperationsCount();
  stateListeners.forEach(listener => listener(isOffline, pendingCount));
}

// Local cache methods
export function getLocalCache(collectionName: string): any[] {
  const dataStr = safeStorage.getItem(`offline_cache_col_${collectionName}`);
  if (!dataStr) return [];
  try {
    return JSON.parse(dataStr);
  } catch (e) {
    console.error(`Error parsing local cache for ${collectionName}:`, e);
    return [];
  }
}

export function saveLocalCache(collectionName: string, data: any[]) {
  try {
    safeStorage.setItem(`offline_cache_col_${collectionName}`, JSON.stringify(data));
    notifyCacheListeners(collectionName, data);
  } catch (e) {
    console.error(`Error saving local cache for ${collectionName}:`, e);
  }
}

// Cache listeners subscription
export function subscribeToCollectionCache(collectionName: string, listener: CacheListener) {
  if (!cacheListeners.has(collectionName)) {
    cacheListeners.set(collectionName, new Set());
  }
  cacheListeners.get(collectionName)!.add(listener);
  listener(collectionName, getLocalCache(collectionName));
  return () => {
    const listeners = cacheListeners.get(collectionName);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        cacheListeners.delete(collectionName);
      }
    }
  };
}

function notifyCacheListeners(collectionName: string, data: any[]) {
  const listeners = cacheListeners.get(collectionName);
  if (listeners) {
    listeners.forEach(listener => listener(collectionName, data));
  }
}

// Queue methods
export function getQueue(): OfflineOperation[] {
  const queueStr = safeStorage.getItem('offline_operations_queue');
  if (!queueStr) return [];
  try {
    return JSON.parse(queueStr);
  } catch (e) {
    console.error("Error parsing offline operations queue:", e);
    return [];
  }
}

function saveQueue(queue: OfflineOperation[]) {
  safeStorage.setItem('offline_operations_queue', JSON.stringify(queue));
  notifyStateChange();
}

export function addToQueue(type: 'create' | 'update' | 'delete' | 'set', collectionName: string, docId: string, data?: any) {
  const queue = getQueue();
  
  // Clean redundant operations for the same document to optimize sync
  const filteredQueue = queue.filter(op => {
    // If we're updating or deleting, and there is a previous pending update/set, we can combine or replace
    if (op.collectionName === collectionName && op.docId === docId) {
      if (type === 'delete' && op.type === 'create') {
        // If created offline and then deleted offline, remove both from queue entirely
        return false;
      }
      if (type === 'update' && op.type === 'create') {
        // If created offline and then updated, merge data into creation
        op.data = { ...op.data, ...data };
        return true;
      }
    }
    return true;
  });

  const existingIndex = filteredQueue.findIndex(op => op.collectionName === collectionName && op.docId === docId && op.type === type);
  
  if (existingIndex >= 0 && type !== 'create') {
    // Replace existing operation with updated data
    filteredQueue[existingIndex].data = { ...filteredQueue[existingIndex].data, ...data };
    filteredQueue[existingIndex].timestamp = Date.now();
  } else {
    // Add new operation
    filteredQueue.push({
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      collectionName,
      docId,
      data,
      timestamp: Date.now()
    });
  }

  saveQueue(filteredQueue);
  applyOperationToLocalCache(type, collectionName, docId, data);
}

function sanitizeDataForLocalCache(existingItem: any, data: any) {
  if (!data) return data;
  const cleanData: any = { ...data };
  
  // Handle arrayUnion / FieldValue for movementLogs or arrays
  for (const key of Object.keys(cleanData)) {
    const val = cleanData[key];
    if (val && typeof val === 'object') {
      // Check if it is a FieldValue / arrayUnion
      if (val._methodName === 'arrayUnion' || val._elements || (val.constructor && val.constructor.name === 'FieldValue')) {
        const elements = val._elements || (Array.isArray(val) ? val : []);
        const existingArray = Array.isArray(existingItem?.[key]) ? existingItem[key] : [];
        cleanData[key] = [...existingArray, ...elements];
      }
    }
  }
  return cleanData;
}

function withTimeout<T>(promise: Promise<T>, ms: number = 2500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Firestore operation timed out after ${ms}ms`));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function applyOperationToLocalCache(type: 'create' | 'update' | 'delete' | 'set', collectionName: string, docId: string, data?: any) {
  const cache = getLocalCache(collectionName);
  let updatedCache = [...cache];

  if (type === 'create' || type === 'set') {
    const idx = updatedCache.findIndex(item => item.id === docId);
    const existing = idx >= 0 ? updatedCache[idx] : null;
    const cleanData = sanitizeDataForLocalCache(existing, data);
    const itemData = { ...(existing || {}), id: docId, ...cleanData, updatedAt: Date.now() };
    if (type === 'create') {
      itemData.createdAt = itemData.createdAt || Date.now();
    }
    if (idx >= 0) {
      updatedCache[idx] = itemData;
    } else {
      updatedCache.push(itemData);
    }
  } else if (type === 'update') {
    const idx = updatedCache.findIndex(item => item.id === docId);
    const existing = idx >= 0 ? updatedCache[idx] : null;
    const cleanData = sanitizeDataForLocalCache(existing, data);
    if (idx >= 0) {
      updatedCache[idx] = { ...updatedCache[idx], ...cleanData, updatedAt: Date.now() };
    } else {
      // If not in cache, create stub with what we have
      updatedCache.push({ id: docId, ...cleanData, updatedAt: Date.now() });
    }
  } else if (type === 'delete') {
    updatedCache = updatedCache.filter(item => item.id !== docId);
  }

  saveLocalCache(collectionName, updatedCache);
}

// --- Synced operations replacements for firestore ---

// Generates a document ID client side instantly
export function generateDocId(collectionName: string): string {
  return doc(collection(db, collectionName)).id;
}

export async function addOfflineDoc(collectionName: string, data: any): Promise<{ id: string }> {
  const docId = generateDocId(collectionName);
  
  // Mirror into local cache immediately
  applyOperationToLocalCache('create', collectionName, docId, data);

  if (getOfflineStatus()) {
    addToQueue('create', collectionName, docId, data);
    toast.success("Guardado localmente (sin conexión)", { id: `offline-save-${docId}` });
    return { id: docId };
  }

  try {
    const docRef = doc(db, collectionName, docId);
    await withTimeout(firestoreSetDoc(docRef, { ...data, createdAt: Date.now(), updatedAt: Date.now() }), 2500);
    return { id: docId };
  } catch (error: any) {
    console.warn("Firestore write failed or timed out, fallback to offline queue:", error);
    addToQueue('create', collectionName, docId, data);
    toast.success("Conexión inestable. Guardado localmente.", { id: `offline-fallback-${docId}` });
    return { id: docId };
  }
}

export async function updateOfflineDoc(collectionName: string, docId: string, data: any): Promise<void> {
  // Mirror into local cache immediately so UI updates instantly without lag
  applyOperationToLocalCache('update', collectionName, docId, data);

  if (getOfflineStatus()) {
    addToQueue('update', collectionName, docId, data);
    toast.success("Modificación guardada localmente", { id: `offline-update-${docId}` });
    return;
  }

  try {
    const docRef = doc(db, collectionName, docId);
    await withTimeout(firestoreUpdateDoc(docRef, { ...data, updatedAt: Date.now() }), 2500);
  } catch (error: any) {
    console.warn("Firestore update failed or timed out, fallback to offline queue:", error);
    addToQueue('update', collectionName, docId, data);
    toast.success("Sin conexión. Modificación guardada localmente.", { id: `offline-fallback-${docId}` });
  }
}

export async function setOfflineDoc(collectionName: string, docId: string, data: any): Promise<void> {
  // Mirror into local cache immediately
  applyOperationToLocalCache('set', collectionName, docId, data);

  if (getOfflineStatus()) {
    addToQueue('set', collectionName, docId, data);
    toast.success("Guardado localmente", { id: `offline-set-${docId}` });
    return;
  }

  try {
    const docRef = doc(db, collectionName, docId);
    await withTimeout(firestoreSetDoc(docRef, { ...data, updatedAt: Date.now() }, { merge: true }), 2500);
  } catch (error: any) {
    console.warn("Firestore set failed or timed out, fallback to offline queue:", error);
    addToQueue('set', collectionName, docId, data);
    toast.success("Sin conexión. Guardado localmente.", { id: `offline-fallback-${docId}` });
  }
}

export async function deleteOfflineDoc(collectionName: string, docId: string): Promise<void> {
  // Mirror into local cache immediately so UI deletes instantly
  applyOperationToLocalCache('delete', collectionName, docId);

  if (getOfflineStatus()) {
    addToQueue('delete', collectionName, docId);
    toast.success("Eliminado localmente", { id: `offline-delete-${docId}` });
    return;
  }

  try {
    const docRef = doc(db, collectionName, docId);
    await withTimeout(firestoreDeleteDoc(docRef), 2500);
  } catch (error: any) {
    console.warn("Firestore delete failed or timed out, fallback to offline queue:", error);
    addToQueue('delete', collectionName, docId);
    toast.success("Sin conexión. Eliminado localmente.", { id: `offline-fallback-${docId}` });
  }
}

// Wrapper for real-time snapshots with offline fallback
export function onOfflineSnapshot(
  collectionName: string,
  queryInstance: any,
  onData: (data: any[]) => void,
  onError?: (error: any) => void
) {
  // Always trigger immediately with local cache to avoid visual delay
  const cachedData = getLocalCache(collectionName);
  
  // Merge cached data with any offline modifications currently in the queue
  const queue = getQueue().filter(op => op.collectionName === collectionName);
  let mergedData = [...cachedData];

  queue.forEach(op => {
    if (op.type === 'create' || op.type === 'set') {
      const idx = mergedData.findIndex(item => item.id === op.docId);
      const itemData = { id: op.docId, ...op.data };
      if (idx >= 0) {
        mergedData[idx] = { ...mergedData[idx], ...itemData };
      } else {
        mergedData.push(itemData);
      }
    } else if (op.type === 'update') {
      const idx = mergedData.findIndex(item => item.id === op.docId);
      if (idx >= 0) {
        mergedData[idx] = { ...mergedData[idx], ...op.data };
      }
    } else if (op.type === 'delete') {
      mergedData = mergedData.filter(item => item.id !== op.docId);
    }
  });

  // Sort logically if they are orders or products
  if (collectionName === 'orders') {
    mergedData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } else if (collectionName === 'products') {
    mergedData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  onData(mergedData);

  // If we are strictly simulated offline, do not connect to network
  if (isSimulatingOffline) {
    // Just listen to local cache modifications
    const unsubCache = subscribeToCollectionCache(collectionName, (_, updatedCacheData) => {
      onData(updatedCacheData);
    });
    return unsubCache;
  }

  // Subscribe to real Firestore
  const unsubscribeFirestore = firestoreOnSnapshot(
    queryInstance,
    (snapshot) => {
      const docsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Save to local cache
      saveLocalCache(collectionName, docsData);
      
      // Merge with offline queue again
      let finalData = [...docsData];
      const activeQueue = getQueue().filter(op => op.collectionName === collectionName);
      
      activeQueue.forEach(op => {
        if (op.type === 'create' || op.type === 'set') {
          const idx = finalData.findIndex(item => item.id === op.docId);
          const itemData = { id: op.docId, ...op.data };
          if (idx >= 0) {
            finalData[idx] = { ...finalData[idx], ...itemData };
          } else {
            finalData.push(itemData);
          }
        } else if (op.type === 'update') {
          const idx = finalData.findIndex(item => item.id === op.docId);
          if (idx >= 0) {
            finalData[idx] = { ...finalData[idx], ...op.data };
          }
        } else if (op.type === 'delete') {
          finalData = finalData.filter(item => item.id !== op.docId);
        }
      });

      if (collectionName === 'orders') {
        finalData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      } else if (collectionName === 'products') {
        finalData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }

      onData(finalData);
    },
    (err) => {
      console.warn(`Firestore snapshot failed for ${collectionName}, using local cache fallback:`, err);
      if (onError) onError(err);
      
      // Keep listening to local cache updates
      const unsubCache = subscribeToCollectionCache(collectionName, (_, updatedCacheData) => {
        onData(updatedCacheData);
      });
      return unsubCache;
    }
  );

  return () => {
    unsubscribeFirestore();
  };
}

// --- Synchronization Engine ---

export async function syncOfflineData() {
  if (isSyncing) return;
  const queue = getQueue();
  if (queue.length === 0) return;

  if (getOfflineStatus()) {
    console.log("Cannot sync: currently offline or simulating offline mode");
    return;
  }

  isSyncing = true;
  notifyStateChange();

  const toastId = toast.loading(`Sincronizando ${queue.length} cambios locales con la nube...`, {
    position: 'top-center'
  });

  const successfulOps: string[] = [];
  
  try {
    for (const op of queue) {
      try {
        const docRef = doc(db, op.collectionName, op.docId);
        
        if (op.type === 'create') {
          await firestoreSetDoc(docRef, { 
            ...op.data, 
            createdAt: op.data.createdAt || op.timestamp, 
            updatedAt: Date.now() 
          });
        } else if (op.type === 'set') {
          await firestoreSetDoc(docRef, { ...op.data, updatedAt: Date.now() }, { merge: true });
        } else if (op.type === 'update') {
          await firestoreUpdateDoc(docRef, { ...op.data, updatedAt: Date.now() });
        } else if (op.type === 'delete') {
          await firestoreDeleteDoc(docRef);
        }
        
        successfulOps.push(op.id);
      } catch (err: any) {
        // If it's a authorization, quote, or database rule error, log it and keep in queue or skip
        console.error(`Failed to sync operation ${op.id} (${op.type} in ${op.collectionName}):`, err);
        
        if (err?.code === 'permission-denied' || err?.message?.includes('permission') || err?.message?.includes('denied')) {
          // Remove from queue to prevent blockages if it is a permission issue
          successfulOps.push(op.id);
        } else {
          // Network error or database locked, stop processing further operations to preserve order
          break;
        }
      }
    }

    // Filter queue to remove successfully processed operations
    const remainingQueue = getQueue().filter(op => !successfulOps.includes(op.id));
    saveQueue(remainingQueue);

    if (remainingQueue.length === 0) {
      toast.success("¡Base de datos sincronizada correctamente! Datos al día.", { id: toastId });
    } else {
      toast.error(`Sincronización parcial: quedaron ${remainingQueue.length} cambios pendientes.`, { id: toastId });
    }
  } catch (error) {
    console.error("General error during sync:", error);
    toast.error("Error al sincronizar con la nube. Se reintentará al recuperar la conexión.", { id: toastId });
  } finally {
    isSyncing = false;
    notifyStateChange();
  }
}

// Global listeners for online/offline browser events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isBrowserOnline = true;
    notifyStateChange();
    if (!isSimulatingOffline) {
      syncOfflineData();
    }
  });

  window.addEventListener('offline', () => {
    isBrowserOnline = false;
    notifyStateChange();
  });

  // Periodic heartbeat / sync check (every 20 seconds)
  setInterval(() => {
    if (isBrowserOnline && !isSimulatingOffline && getQueue().length > 0) {
      syncOfflineData();
    }
  }, 20000);
}
