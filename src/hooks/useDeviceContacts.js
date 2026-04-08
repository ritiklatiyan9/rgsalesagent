import { useState, useCallback, useRef } from 'react';
import { useDialer } from '@/hooks/useDialer';
import { toast } from 'sonner';

// In-memory cache (survives re-renders, cleared on page refresh)
let _cache = null;
let _syncing = false;

export const useDeviceContacts = () => {
  const { requestPermissions, getDeviceContacts } = useDialer();
  const [deviceContacts, setDeviceContacts] = useState(_cache || []);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(!!_cache);

  const syncContacts = useCallback(async () => {
    if (_syncing) return _cache || [];
    _syncing = true;
    setSyncing(true);
    try {
      await requestPermissions();
      const contacts = await getDeviceContacts();
      _cache = contacts;
      setDeviceContacts(contacts);
      setSynced(true);
      toast.success(`Synced ${contacts.length} device contacts`);
      return contacts;
    } catch (err) {
      toast.error('Failed to sync device contacts');
      return _cache || [];
    } finally {
      _syncing = false;
      setSyncing(false);
    }
  }, [requestPermissions, getDeviceContacts]);

  const searchDeviceContacts = useCallback((query) => {
    if (!_cache || !query) return [];
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return _cache.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
    );
  }, []);

  const clearCache = useCallback(() => {
    _cache = null;
    setDeviceContacts([]);
    setSynced(false);
  }, []);

  return {
    deviceContacts,
    syncing,
    synced,
    syncContacts,
    searchDeviceContacts,
    clearCache,
    count: _cache?.length || 0,
  };
};

export default useDeviceContacts;
