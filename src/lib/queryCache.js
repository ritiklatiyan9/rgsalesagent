import api, { getActiveSiteId } from './axios';

const cache    = new Map();
const inflight = new Map();

const DEFAULT_STALE_TIME  = 60_000;
const DEFAULT_CACHE_TIME  = 600_000;
const ERROR_RETRY_DELAY   = 10_000;
const MAX_CACHE_SIZE      = 300;

const toCacheKey = (url) => `${getActiveSiteId() || 'no-site'}::${url}`;

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
            _revalidate(url);
            return entry.data;
        }
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
    if (!prefix) { cache.clear(); return; }
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) cache.delete(key);
    }
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
        _setCache(key, { _error: err, ts: Date.now() });
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
}
