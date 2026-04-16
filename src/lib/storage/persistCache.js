/**
 * persistCache.js — IndexedDB-backed persistent cache for API responses.
 * Survives app restarts → instant UI on cold start.
 *
 * Uses a single object store with key = cacheKey (siteId::url), value = { data, ts }.
 * Auto-evicts oldest entries when store exceeds MAX_ENTRIES.
 */

const DB_NAME = 'rg_agent_cache';
const DB_VERSION = 1;
const STORE_NAME = 'api_cache';
const MAX_ENTRIES = 500;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('ts', 'ts', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('[persistCache] IndexedDB open failed', req.error);
        reject(req.error);
      };
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

function tx(mode = 'readonly') {
  return openDB().then((db) => {
    const transaction = db.transaction(STORE_NAME, mode);
    return transaction.objectStore(STORE_NAME);
  });
}

/**
 * Get a persisted cache entry by key.
 * Returns { data, ts } or null.
 */
export async function persistGet(key) {
  try {
    const store = await tx('readonly');
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result;
        if (!entry) return resolve(null);
        // Evict entries older than MAX_AGE
        if (Date.now() - entry.ts > MAX_AGE_MS) {
          persistDelete(key).catch(() => {});
          return resolve(null);
        }
        resolve({ data: entry.data, ts: entry.ts });
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Persist data for a cache key.
 */
export async function persistSet(key, data, ts = Date.now()) {
  try {
    const store = await tx('readwrite');
    return new Promise((resolve) => {
      const req = store.put({ key, data, ts });
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Delete a cache entry.
 */
export async function persistDelete(key) {
  try {
    const store = await tx('readwrite');
    return new Promise((resolve) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Delete all entries matching a key prefix.
 */
export async function persistDeleteByPrefix(prefix) {
  try {
    const store = await tx('readwrite');
    return new Promise((resolve) => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(true);
        if (cursor.key.includes(prefix)) cursor.delete();
        cursor.continue();
      };
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Clear all persisted cache.
 */
export async function persistClear() {
  try {
    const store = await tx('readwrite');
    return new Promise((resolve) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Load ALL persisted entries into memory Map (for cold-start hydration).
 * Returns Map<key, { data, ts }>.
 */
export async function persistLoadAll() {
  try {
    const store = await tx('readonly');
    return new Promise((resolve) => {
      const map = new Map();
      const now = Date.now();
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(map);
        const entry = cursor.value;
        // Skip expired
        if (now - entry.ts <= MAX_AGE_MS) {
          map.set(entry.key, { data: entry.data, ts: entry.ts });
        }
        cursor.continue();
      };
      req.onerror = () => resolve(map);
    });
  } catch {
    return new Map();
  }
}

/**
 * Evict oldest entries if store exceeds MAX_ENTRIES.
 * Call periodically or after writes.
 */
export async function persistEvict() {
  try {
    const store = await tx('readwrite');
    return new Promise((resolve) => {
      const countReq = store.count();
      countReq.onsuccess = () => {
        if (countReq.result <= MAX_ENTRIES) return resolve(true);
        const toDelete = countReq.result - MAX_ENTRIES;
        let deleted = 0;
        const idx = store.index('ts');
        const cursorReq = idx.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor || deleted >= toDelete) return resolve(true);
          cursor.delete();
          deleted++;
          cursor.continue();
        };
        cursorReq.onerror = () => resolve(false);
      };
      countReq.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Initialize the DB (call early to open connection).
 */
export async function persistInit() {
  try {
    await openDB();
    return true;
  } catch {
    return false;
  }
}
