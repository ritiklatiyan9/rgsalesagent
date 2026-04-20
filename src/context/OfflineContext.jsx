import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { isOnline, onNetworkChange, initNetwork } from '@/lib/network';
import { getPendingCount, onQueueChange, flushQueue, clearQueue } from '@/lib/storage/syncQueue';
import api from '@/lib/axios';

const OfflineContext = createContext(null);

export const useOffline = () => {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
};

const FLUSH_INTERVAL = 15_000; // 15s periodic flush (safety net)
const FLUSH_DELAY_ON_RECONNECT = 300; // 300ms after coming online
const FLUSH_DELAY_ON_PENDING = 250; // auto-flush shortly after new enqueue
const MIN_GAP_BETWEEN_FLUSHES = 3_000; // hard floor between auto-flushes

export const OfflineProvider = ({ children }) => {
  const [online, setOnline] = useState(isOnline);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const flushTimer = useRef(null);
  const pendingFlushTimer = useRef(null);
  const lastFlushAtRef = useRef(0);
  const flushInFlightRef = useRef(false);
  const lastCountRef = useRef(0);

  // Flush the mutation queue — guarded so we never launch two in parallel.
  const doFlush = useCallback(async () => {
    if (!isOnline()) return;
    if (flushInFlightRef.current) return;
    flushInFlightRef.current = true;
    lastFlushAtRef.current = Date.now();
    setIsSyncing(true);
    try {
      await flushQueue(api);
    } catch {
      // swallow — individual errors handled inside flushQueue
    } finally {
      setIsSyncing(false);
      flushInFlightRef.current = false;
    }
  }, []);

  // Debounced auto-flush — respects a minimum gap so a queue that can't drain
  // (e.g. repeated 5xx with retries) doesn't loop between Syncing/Unsynced.
  const scheduleAutoFlush = useCallback(() => {
    if (pendingFlushTimer.current) clearTimeout(pendingFlushTimer.current);
    const sinceLast = Date.now() - lastFlushAtRef.current;
    const delay = Math.max(FLUSH_DELAY_ON_PENDING, MIN_GAP_BETWEEN_FLUSHES - sinceLast);
    pendingFlushTimer.current = setTimeout(() => {
      pendingFlushTimer.current = null;
      doFlush();
    }, delay);
  }, [doFlush]);

  useEffect(() => {
    // Init network detection
    initNetwork();

    // Listen to network state changes
    const unsubNetwork = onNetworkChange((nowOnline) => {
      setOnline(nowOnline);
      if (nowOnline) {
        // Flush queue shortly after coming back online
        setTimeout(doFlush, FLUSH_DELAY_ON_RECONNECT);
      }
    });

    // Listen to queue changes — only auto-flush when the count GREW (new enqueue)
    // or when there are items and no flush has run recently. Previously we
    // flushed on every notify, which created a notify→flush→notify loop when
    // a mutation couldn't succeed (count never dropped, but kept re-triggering).
    const unsubQueue = onQueueChange((count) => {
      setPendingCount(count);
      const prev = lastCountRef.current;
      lastCountRef.current = count;
      if (count === 0) return;
      if (!isOnline()) return;
      const grew = count > prev;
      const staleEnough = Date.now() - lastFlushAtRef.current >= MIN_GAP_BETWEEN_FLUSHES;
      if (grew || staleEnough) scheduleAutoFlush();
    });

    // Initial count — and if anything is queued, flush right away.
    getPendingCount().then((count) => {
      setPendingCount(count);
      lastCountRef.current = count;
      if (count > 0 && isOnline()) scheduleAutoFlush();
    });

    // Periodic flush as a safety net (for network blips / server recovery)
    flushTimer.current = setInterval(doFlush, FLUSH_INTERVAL);

    // Initial flush (immediate, not delayed)
    doFlush();

    // Also retry when the tab becomes visible again
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isOnline()) doFlush();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubNetwork();
      unsubQueue();
      document.removeEventListener('visibilitychange', onVisible);
      if (flushTimer.current) clearInterval(flushTimer.current);
      if (pendingFlushTimer.current) clearTimeout(pendingFlushTimer.current);
    };
  }, [doFlush, scheduleAutoFlush]);

  // Clear queue on logout
  const clearPending = useCallback(async () => {
    await clearQueue();
    setPendingCount(0);
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        online,
        pendingCount,
        isSyncing,
        flushNow: doFlush,
        clearPending,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};
