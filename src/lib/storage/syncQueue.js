/**
 * syncQueue.js — Offline mutation queue.
 * Stores POST/PUT/DELETE operations in IndexedDB when offline,
 * flushes them in FIFO order when back online.
 */

const DB_NAME = 'rg_agent_sync';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';
const MAX_RETRIES = 5;
const RETRY_BACKOFF_BASE = 500; // 0.5s, 1s, 2s, 4s, 8s — aggressive, user wants fast sync

let dbPromise = null;
let _listeners = [];
let _flushing = false;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

function tx(mode = 'readonly') {
  return openDB().then((db) => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
}

/**
 * Subscribe to queue changes (count updates).
 * Returns unsubscribe function.
 */
export function onQueueChange(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((f) => f !== fn); };
}

function _notify() {
  getPendingCount().then((count) => {
    _listeners.forEach((fn) => {
      try { fn(count); } catch {}
    });
  });
}

/**
 * Enqueue a mutation for background sync.
 * @param {{ method: string, url: string, data?: any, headers?: object }} mutation
 */
export async function enqueue(mutation) {
  try {
    const store = await tx('readwrite');
    return new Promise((resolve) => {
      const entry = {
        method: mutation.method,
        url: mutation.url,
        data: mutation.data || null,
        headers: mutation.headers || null,
        status: 'pending', // pending | processing | failed
        retries: 0,
        createdAt: Date.now(),
        lastAttempt: null,
        error: null,
      };
      const req = store.add(entry);
      req.onsuccess = () => {
        _notify();
        resolve(req.result); // returns the auto-increment id
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Get count of pending + failed mutations.
 */
export async function getPendingCount() {
  try {
    const store = await tx('readonly');
    return new Promise((resolve) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Get all pending mutations in FIFO order.
 */
export async function getAllPending() {
  try {
    const store = await tx('readonly');
    return new Promise((resolve) => {
      const entries = [];
      const idx = store.index('createdAt');
      const req = idx.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(entries);
        entries.push(cursor.value);
        cursor.continue();
      };
      req.onerror = () => resolve(entries);
    });
  } catch {
    return [];
  }
}

/**
 * Remove a successfully synced mutation.
 */
export async function removeMutation(id) {
  try {
    const store = await tx('readwrite');
    return new Promise((resolve) => {
      const req = store.delete(id);
      req.onsuccess = () => { _notify(); resolve(true); };
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Update a mutation's retry count and status.
 * After MAX_RETRIES the entry is DROPPED rather than kept as 'failed' — keeping
 * a permanently-failed row alive made the Unsynced counter stick forever and,
 * combined with queue-change notifications, caused the UI to loop between
 * Syncing/Unsynced without ever draining.
 */
async function _markRetry(id, error) {
  try {
    const store = await tx('readwrite');
    return new Promise((resolve) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const entry = getReq.result;
        if (!entry) return resolve(false);
        entry.retries += 1;
        entry.lastAttempt = Date.now();
        entry.error = error?.message || String(error);
        if (entry.retries >= MAX_RETRIES) {
          const delReq = store.delete(id);
          delReq.onsuccess = () => { _notify(); resolve(true); };
          delReq.onerror = () => resolve(false);
          return;
        }
        const putReq = store.put(entry);
        putReq.onsuccess = () => { _notify(); resolve(true); };
        putReq.onerror = () => resolve(false);
      };
      getReq.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Flush queue: process all pending mutations through the provided api instance.
 * @param {import('axios').AxiosInstance} apiInstance — the axios instance with auth headers
 * @param {{ onSuccess?: Function, onError?: Function }} callbacks
 */
export async function flushQueue(apiInstance, callbacks = {}) {
  if (_flushing) return;
  _flushing = true;

  try {
    const pending = await getAllPending();

    for (const entry of pending) {
      // Legacy cleanup — older builds left entries as status='failed' indefinitely.
      // Drop them so the Unsynced counter can drain.
      if (entry.status === 'failed') {
        await removeMutation(entry.id);
        continue;
      }

      // Exponential backoff check
      if (entry.lastAttempt) {
        const backoff = RETRY_BACKOFF_BASE * Math.pow(2, entry.retries - 1);
        if (Date.now() - entry.lastAttempt < backoff) continue;
      }

      try {
        const config = {
          method: entry.method,
          url: entry.url,
        };
        if (entry.data) config.data = entry.data;
        if (entry.headers) {
          config.headers = { ...config.headers, ...entry.headers };
        }

        await apiInstance(config);
        await removeMutation(entry.id);
        if (callbacks.onSuccess) callbacks.onSuccess(entry);
      } catch (err) {
        // Don't retry on 4xx client errors (except 408, 429)
        const status = err?.response?.status;
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          await removeMutation(entry.id); // discard bad requests
          if (callbacks.onError) callbacks.onError(entry, err);
        } else {
          await _markRetry(entry.id, err);
        }
      }
    }
  } finally {
    _flushing = false;
    _notify();
  }
}

/**
 * Clear all mutations (e.g., on logout).
 */
export async function clearQueue() {
  try {
    const store = await tx('readwrite');
    return new Promise((resolve) => {
      const req = store.clear();
      req.onsuccess = () => { _notify(); resolve(true); };
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Is the queue currently flushing?
 */
export function isFlushing() {
  return _flushing;
}
