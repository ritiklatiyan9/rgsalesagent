import api from './axios';

const cache    = new Map();
const inflight = new Map();

const DEFAULT_STALE_TIME  = 60_000;
const DEFAULT_CACHE_TIME  = 600_000;
const ERROR_RETRY_DELAY   = 10_000;
const MAX_CACHE_SIZE      = 300;

export async function cachedGet(
    url,
    { staleTime = DEFAULT_STALE_TIME, cacheTime = DEFAULT_CACHE_TIME, force = false } = {}
) {
    const now = Date.now();

    if (!force && cache.has(url)) {
        const entry = cache.get(url);
        if (entry._error) {
            if (now - entry.ts < ERROR_RETRY_DELAY) throw entry._error;
            cache.delete(url);
        } else {
            const age = now - entry.ts;
            if (age < staleTime) return entry.data;
            if (age < cacheTime) { _revalidate(url); return entry.data; }
            _revalidate(url);
            return entry.data;
        }
    }

    if (inflight.has(url)) return inflight.get(url);
    const promise = _fetchAndCache(url);
    inflight.set(url, promise);
    return promise;
}

export function prefetch(url) {
    if (cache.has(url) || inflight.has(url)) return;
    const p = _fetchAndCache(url);
    inflight.set(url, p);
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
    return cache.has(url) ? cache.get(url).data ?? null : null;
}

async function _fetchAndCache(url) {
    try {
        const { data } = await api.get(url);
        _setCache(url, { data, ts: Date.now() });
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
        _setCache(url, { _error: err, ts: Date.now() });
        throw err;
    } finally {
        inflight.delete(url);
    }
}

function _revalidate(url) {
    if (inflight.has(url)) return;
    const p = _fetchAndCache(url);
    inflight.set(url, p);
}

function _setCache(url, entry) {
    if (cache.size >= MAX_CACHE_SIZE) {
        cache.delete(cache.keys().next().value);
    }
    cache.set(url, entry);
}
