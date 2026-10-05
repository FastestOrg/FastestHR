/**
 * Offline Workforce Sync Queue & Network Detection
 * Enables field workers to clock in, clock out, and record breaks with zero connectivity.
 * Implements cryptographic replay-protection nonces and automatic flush upon reconnection.
 */

export type OfflineAttendanceAction = 'clock_in' | 'clock_out' | 'toggle_break';

export interface QueuedAttendancePunch {
  id: string;
  action: OfflineAttendanceAction;
  payload: Record<string, unknown>;
  clientTimestamp: string;
  nonce: string;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
}

const STORAGE_KEY = 'fastesth_offline_attendance_queue';
const DB_NAME = 'FastestHROfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'attendance_punches';

/**
 * Generates a cryptographic nonce to prevent replay attacks
 */
export function generateReplayNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Helper to open IndexedDB with fallback
 */
function openIndexedDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Fallback storage operations using localStorage
 */
function getFromLocalStorage(): QueuedAttendancePunch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(items: QueuedAttendancePunch[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('[OfflineSync] Failed saving to localStorage:', e);
  }
}

/**
 * Retrieves all currently queued attendance punches
 */
export async function getQueuedAttendancePunches(): Promise<QueuedAttendancePunch[]> {
  const db = await openIndexedDB();
  if (!db) {
    return getFromLocalStorage();
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        resolve(req.result || []);
      };
      req.onerror = () => {
        resolve(getFromLocalStorage());
      };
    } catch {
      resolve(getFromLocalStorage());
    }
  });
}

/**
 * Queues an attendance punch for later synchronization
 */
export async function queueAttendancePunch(
  action: OfflineAttendanceAction,
  payload: Record<string, unknown>
): Promise<QueuedAttendancePunch> {
  const punch: QueuedAttendancePunch = {
    id: generateReplayNonce(),
    action,
    payload,
    clientTimestamp: new Date().toISOString(),
    nonce: generateReplayNonce(),
    attempts: 0,
  };

  const db = await openIndexedDB();
  if (!db) {
    const existing = getFromLocalStorage();
    existing.push(punch);
    saveToLocalStorage(existing);
    notifySyncListeners();
    return punch;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.add(punch);

      tx.oncomplete = () => {
        notifySyncListeners();
        resolve(punch);
      };
      tx.onerror = () => {
        // Fallback to localStorage
        const existing = getFromLocalStorage();
        existing.push(punch);
        saveToLocalStorage(existing);
        notifySyncListeners();
        resolve(punch);
      };
    } catch {
      const existing = getFromLocalStorage();
      existing.push(punch);
      saveToLocalStorage(existing);
      notifySyncListeners();
      resolve(punch);
    }
  });
}

/**
 * Removes a punch from the queue after successful synchronization
 */
export async function removeQueuedPunch(id: string): Promise<void> {
  const db = await openIndexedDB();
  if (!db) {
    const remaining = getFromLocalStorage().filter((p) => p.id !== id);
    saveToLocalStorage(remaining);
    notifySyncListeners();
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);

      tx.oncomplete = () => {
        notifySyncListeners();
        resolve();
      };
      tx.onerror = () => {
        const remaining = getFromLocalStorage().filter((p) => p.id !== id);
        saveToLocalStorage(remaining);
        notifySyncListeners();
        resolve();
      };
    } catch {
      const remaining = getFromLocalStorage().filter((p) => p.id !== id);
      saveToLocalStorage(remaining);
      notifySyncListeners();
      resolve();
    }
  });
}

/**
 * Clears the entire offline sync queue
 */
export async function clearOfflineQueue(): Promise<void> {
  const db = await openIndexedDB();
  if (!db) {
    saveToLocalStorage([]);
    notifySyncListeners();
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => {
        notifySyncListeners();
        resolve();
      };
      tx.onerror = () => {
        saveToLocalStorage([]);
        notifySyncListeners();
        resolve();
      };
    } catch {
      saveToLocalStorage([]);
      notifySyncListeners();
      resolve();
    }
  });
}

export type PunchExecutor = (punch: QueuedAttendancePunch) => Promise<boolean>;

/**
 * Flushes all queued punches in chronological order using the provided executor
 */
export async function flushOfflineAttendanceQueue(executor: PunchExecutor): Promise<{
  syncedCount: number;
  failedCount: number;
}> {
  const queue = await getQueuedAttendancePunches();
  if (queue.length === 0) {
    return { syncedCount: 0, failedCount: 0 };
  }

  // Sort chronologically by client timestamp
  queue.sort((a, b) => new Date(a.clientTimestamp).getTime() - new Date(b.clientTimestamp).getTime());

  let syncedCount = 0;
  let failedCount = 0;

  for (const punch of queue) {
    try {
      const success = await executor(punch);
      if (success) {
        await removeQueuedPunch(punch.id);
        syncedCount++;
      } else {
        failedCount++;
      }
    } catch (err) {
      console.warn(`[OfflineSync] Failed to process punch ${punch.id}:`, err);
      failedCount++;
    }
  }

  return { syncedCount, failedCount };
}

// -------------------------------------------------------------
// Reactive Network Status & Auto-Sync Triggers
// -------------------------------------------------------------

type Listener = (queueLength: number) => void;
const listeners = new Set<Listener>();

function notifySyncListeners() {
  getQueuedAttendancePunches().then((q) => {
    listeners.forEach((fn) => fn(q.length));
  });
}

/**
 * Subscribes to changes in the offline queue size
 */
export function subscribeToQueueChanges(callback: (count: number) => void): () => void {
  listeners.add(callback);
  getQueuedAttendancePunches().then((q) => callback(q.length));
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Returns current browser network online state
 */
export function isBrowserOnline(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true;
}

/**
 * Sets up auto-sync listener when browser reconnects to internet
 */
export function registerAutoSyncOnReconnect(executor: PunchExecutor): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = async () => {
    console.info('[OfflineSync] Network connectivity restored. Flushing offline queue...');
    await flushOfflineAttendanceQueue(executor);
  };

  window.addEventListener('online', handleOnline);
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
