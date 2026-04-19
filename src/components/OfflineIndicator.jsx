import { useOffline } from '@/context/OfflineContext';

/**
 * Subtle offline/sync status indicator.
 * Shows a small pill at bottom of screen when offline or syncing pending changes.
 * Non-intrusive — does not block interaction.
 */
const OfflineIndicator = () => {
  const { online, pendingCount, isSyncing } = useOffline();

  // Nothing to show
  if (online && pendingCount === 0 && !isSyncing) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm border pointer-events-auto transition-all duration-300"
        style={{
          background: !online ? 'rgba(239, 68, 68, 0.9)' : 'rgba(99, 102, 241, 0.9)',
          color: 'white',
          borderColor: !online ? 'rgba(239, 68, 68, 0.3)' : 'rgba(99, 102, 241, 0.3)',
        }}
      >
        {!online && (
          <>
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span>Offline</span>
          </>
        )}
        {online && isSyncing && (
          <>
            <span className="h-2 w-2 rounded-full bg-white animate-spin border border-transparent border-t-white" />
            <span>Syncing...</span>
          </>
        )}
        {online && !isSyncing && pendingCount > 0 && (
          <>
            <span className="h-2 w-2 rounded-full bg-amber-300" />
            <span>{pendingCount} unsynced</span>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;
