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

const FLUSH_INTERVAL = 30_000; // 30s periodic flush
const FLUSH_DELAY_ON_RECONNECT = 2_000; // 2s after coming online

export const OfflineProvider = ({ children }) => {
  const [online, setOnline] = useState(isOnline);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const flushTimer = useRef(null);

  // Flush the mutation queue
  const doFlush = useCallback(async () => {
    if (!isOnline()) return;
    setIsSyncing(true);
    try {
      await flushQueue(api);
    } catch {
      // swallow — individual errors handled inside flushQueue
    } finally {
      setIsSyncing(false);
    }
  }, []);

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

    // Listen to queue changes
    const unsubQueue = onQueueChange((count) => {
      setPendingCount(count);
    });

    // Initial count
    getPendingCount().then(setPendingCount);

    // Periodic flush
    flushTimer.current = setInterval(doFlush, FLUSH_INTERVAL);

    // Initial flush
    setTimeout(doFlush, 3000);

    return () => {
      unsubNetwork();
      unsubQueue();
      if (flushTimer.current) clearInterval(flushTimer.current);
    };
  }, [doFlush]);

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
