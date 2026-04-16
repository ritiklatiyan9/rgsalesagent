import { useState, useEffect, useRef, useCallback } from 'react';
import { cachedGet, getCachedSync } from '@/lib/queryCache';

/**
 * useCachedData — React hook for cache-first data loading.
 *
 * Returns { data, loading, error, refresh }.
 * - Shows cached/persisted data instantly (no blank screen).
 * - Fetches fresh data in background.
 * - Only re-renders if data actually changed (deep hash comparison).
 *
 * @param {string|null} url — API url (relative), or null to skip
 * @param {{ staleTime?: number, cacheTime?: number, transform?: Function }} opts
 */
export function useCachedData(url, { staleTime, cacheTime, transform } = {}) {
  // Try sync cache first for instant data
  const initialData = url ? getCachedSync(url) : null;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);
  const lastHash = useRef(initialData ? _quickHash(initialData) : null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (force = false) => {
    if (!url) return;
    try {
      const opts = {};
      if (staleTime != null) opts.staleTime = staleTime;
      if (cacheTime != null) opts.cacheTime = cacheTime;
      if (force) opts.force = true;

      const result = await cachedGet(url, opts);
      if (!mountedRef.current) return;

      const transformed = transform ? transform(result) : result;
      const hash = _quickHash(transformed);

      // Only update state if data actually changed — prevents flicker
      if (hash !== lastHash.current) {
        lastHash.current = hash;
        setData(transformed);
      }
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      // Don't clear existing data on error — show stale data
      setError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [url, staleTime, cacheTime, transform]);

  useEffect(() => {
    mountedRef.current = true;
    if (url) {
      if (!initialData) setLoading(true);
      fetchData();
    }
    return () => { mountedRef.current = false; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, error, refresh };
}

/**
 * Simple fast hash for change detection.
 * Not cryptographic — just for equality checks.
 */
function _quickHash(obj) {
  try {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  } catch {
    return Math.random();
  }
}

export default useCachedData;
