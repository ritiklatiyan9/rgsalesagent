/**
 * mutationBus — global mutation broadcaster.
 *
 * Any page that mutates data calls broadcastMutation(['entity', ...]).
 * This does two things atomically:
 *   1. Invalidates all cache keys that match the entity's URL prefixes.
 *   2. Notifies every currently-mounted page subscriber so it can
 *      force-refetch its own data immediately.
 *
 * Entity → cache prefix mapping:
 *   leads     → /leads
 *   contacts  → /contacts
 *   followups → /followups   (covers /followups/counts, /followups/reminders,
 *                              /followups/scheduled, /followups?limit=...)
 *   calls     → /calls
 */

import { invalidateCache } from './queryCache';

const ENTITY_PREFIXES = {
    leads:     ['/leads'],
    contacts:  ['/contacts'],
    followups: ['/followups'],
    calls:     ['/calls'],
};

const listeners = new Set();

/**
 * Call after any successful mutation.
 * entities: array of entity names, e.g. ['leads'] or ['followups', 'calls']
 */
export function broadcastMutation(entities = []) {
    const invalidated = new Set();
    for (const entity of entities) {
        for (const prefix of (ENTITY_PREFIXES[entity] || [])) {
            if (!invalidated.has(prefix)) {
                invalidated.add(prefix);
                invalidateCache(prefix);
            }
        }
    }
    for (const fn of listeners) {
        try { fn(entities); } catch { /* subscriber crash is isolated */ }
    }
}

/**
 * Subscribe to mutation events. Returns an unsubscribe function.
 * Use in useEffect(() => onMutation(fn), []).
 */
export function onMutation(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
