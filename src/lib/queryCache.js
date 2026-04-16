import api, { getActiveSiteId } from './axios';
import { persistGet, persistSet, persistDeleteByPrefix, persistClear, persistLoadAll, persistEvict } from './storage/persistCache';

const cache    = new Map();
const inflight = new Map();

const DEFAULT_STALE_TIME  = 60_000;
const DEFAULT_CACHE_TIME  = 600_000;
const ERROR_RETRY_DELAY   = 10_000;
const MAX_CACHE_SIZE      = 300;

// Persistence write is debounced to avoid IDB thrashing
let _persistQueue = [];
let _persistTimer = null;

function _schedulePersist(key, data, ts) {
    _persistQueue.push({ key, data, ts });
    if (!_persistTimer) {
        _persistTimer = setTimeout(_flushPersistQueue, 300);
    }
}

function _flushPersistQueue() {
    _persistTimer = null;
    const batch = _persistQueue.splice(0);
    batch.forEach(({ key, data, ts }) => {
        persistSet(key, data, ts).catch(() => {});
    });
    // Periodic eviction
    if (batch.length > 10) persistEvict().catch(() => {});
}

const toCacheKey = (url) => `${getActiveSiteId() || 'no-site'}::${url}`;

/**
 * Hydrate memory cache from IndexedDB on cold start.
 * Call once before React renders.
 */
export async function hydrateCache() {
    try {
        const persisted = await persistLoadAll();
        for (const [key, entry] of persisted) {
            if (!cache.has(key)) {
                cache.set(key, { data: entry.data, ts: entry.ts });
            }
        }
    } catch (e) {
        console.warn('[queryCache] hydrate failed:', e.message);
    }
}

export async function cachedGet(
    url,
    { staleTime = DEFAULT_STALE_TIME, cacheTime = DEFAULT_CACHE_TIME, force = false } = {}
) {
    const now = Date.now();

    const key = toCacheKey(url);

    if (!force && cache.has(key)) {
        const entry = cache.get(key);
        if (entry._error) {
            if (now - entry.ts < ERROR_RETRY_DELAY) throw entry._error;
            cache.delete(key);
        } else {
            const age = now - entry.ts;
            if (age < staleTime) return entry.data;
            if (age < cacheTime) { _revalidate(url); return entry.data; }
            // Data is beyond cacheTime but still have it — return stale, revalidate
            _revalidate(url);
            return entry.data;
        }
    }

    // Try loading from IndexedDB persistence if memory miss
    if (!force && !cache.has(key)) {
        try {
            const persisted = await persistGet(key);
            if (persisted) {
                cache.set(key, { data: persisted.data, ts: persisted.ts });
                // Return persisted data immediately, revalidate in background
                _revalidate(url);
                return persisted.data;
            }
        } catch {}
    }

    if (inflight.has(key)) return inflight.get(key);
    const promise = _fetchAndCache(url);
    inflight.set(key, promise);
    return promise;
}

export function prefetch(url) {
    const key = toCacheKey(url);
    if (cache.has(key) || inflight.has(key)) return;
    const p = _fetchAndCache(url);
    inflight.set(key, p);
}

export function warmCache(urls = []) {
    urls.forEach(url => {
        try {
            prefetch(url);
        } catch (err) {
            // Silently ignore prefetch errors during warmup
            console.debug(`Warmup prefetch failed for ${url}:`, err.message);
        }
    });
}

export function invalidateCache(prefix = '') {
    if (!prefix) {
        cache.clear();
        persistClear().catch(() => {});
        return;
    }
    for (const key of cache.keys()) {
        if (key.includes(prefix)) cache.delete(key);
    }
    persistDeleteByPrefix(prefix).catch(() => {});
}

export function getCachedSync(url) {
    const key = toCacheKey(url);
    return cache.has(key) ? cache.get(key).data ?? null : null;
}

async function _fetchAndCache(url) {
    const key = toCacheKey(url);
    try {
        const { data } = await api.get(url);
        _setCache(key, { data, ts: Date.now() });
        return data;
    } catch (err) {
        // Enhanced logging for debugging
        if (err.response?.status === 403) {
            console.error(`🚫 Permission denied (403) for URL: ${url}`, {
                status: err.response?.status,
                message: err.response?.data?.message,
                userRole: err.config?.headers?.Authorization ? 'Token present' : 'No token',
            });
        } else if (err.response?.status === 401) {
            console.error(`🔐 Unauthorized (401) for URL: ${url}`, {
                status: err.response?.status,
                message: err.response?.data?.message,
            });
        }
        // Don't persist errors
        if (cache.size >= MAX_CACHE_SIZE) {
            cache.delete(cache.keys().next().value);
        }
        cache.set(key, { _error: err, ts: Date.now() });
        throw err;
    } finally {
        inflight.delete(key);
    }
}

function _revalidate(url) {
    const key = toCacheKey(url);
    if (inflight.has(key)) return;
    const p = _fetchAndCache(url);
    inflight.set(key, p);
}

function _setCache(key, entry) {
    if (cache.size >= MAX_CACHE_SIZE) {
        cache.delete(cache.keys().next().value);
    }
    cache.set(key, entry);

    // Persist successful responses to IndexedDB (non-blocking)
    if (!entry._error) {
        _schedulePersist(key, entry.data, entry.ts);
    }
}
