/**
 * recentsStore.js — Single source of truth for the dialer's "Recents" feed.
 *
 * Why this exists:
 *   The previous design split state across (a) DialerPage useState, (b) a
 *   localStorage snapshot, and (c) the in-memory + IndexedDB queryCache.
 *   Each layer had its own freshness window, write paths, and invalidation
 *   rules. The result: cold-start showed stale rows from one layer, the
 *   server fetch wrote to a different layer, and nothing reconciled them
 *   without explicit user action ("refresh" / "sync"). Recent calls
 *   appeared late, and reopening the app showed pre-call data.
 *
 * What this gives us:
 *   - One in-memory state object, mirrored to localStorage (sync) and IDB
 *     (async, durable). Anything that mutates recents goes through this
 *     module, so reads and writes can never disagree.
 *   - Reactive subscribers via useSyncExternalStore — DialerPage re-renders
 *     the moment a call is upserted, a server fetch returns, or the drawer
 *     patches a row.
 *   - Aggressive background sync: 30s poll while visible, immediate refresh
 *     on visibilitychange / online / call-ended / call-updated events, and
 *     a force-refresh kick on app boot (regardless of which page mounts).
 *   - Optimistic upserts that survive a server refresh until the row is
 *     verified to have landed in the DB (pendingIds map with TTL).
 *
 * Trigger matrix for refresh():
 *   - Module init (after auth is established)         → force
 *   - 30s interval while document.visibilityState=visible
 *   - visibilitychange → visible                      → force
 *   - online                                          → force
 *   - rg:call-ended / rg:call-updated event           → force
 *   - DialerPage requests (pull-to-refresh, etc.)     → force
 */

import { useSyncExternalStore } from 'react';
import api, { getActiveSiteId } from './axios';
import { persistGet, persistSet } from './storage/persistCache';

const HISTORY_LIMIT = 30;
const DEVICE_LOG_LIMIT = 80;
const DEVICE_LOG_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // last 7 days
const DEVICE_LOG_POLL_MS = 30_000;
const isNative = () => {
    try { return !!window.Capacitor?.isNativePlatform?.(); } catch { return false; }
};
const getDialerPlugin = () => {
    try {
        const Cap = window.Capacitor;
        if (Cap?.isNativePlatform?.() && Cap.registerPlugin) {
            // Register or fetch existing — Capacitor caches the proxy internally.
            return Cap.registerPlugin('Dialer');
        }
    } catch { /* noop */ }
    return null;
};
const STALE_MS = 15_000;
const POLL_INTERVAL_MS = 60_000; // background tick — quiet
const PENDING_TTL_MS = 30_000;
const SNAPSHOT_PREFIX = 'rg:recentsSnapshot::';
const MAX_LOCAL_ROWS = 200; // hard ceiling on in-memory + persisted rows

const cleanNumber = (v) => String(v || '').replace(/[^0-9+*#]/g, '');

const completeness = (row) => {
    if (!row) return -1;
    let score = 0;
    if (row.customer_notes) score += 4;
    if (String(row.call_status || '').toUpperCase() !== 'ACTIVE') score += 2;
    if (Number(row.duration_seconds) > 0) score += 1;
    if (row.lead_id) score += 1;
    if (row.lead_name && row.lead_name !== 'Manual Call') score += 1;
    return score;
};

const mergeRows = (a, b) => {
    const winner = completeness(b) > completeness(a) ? b : a;
    const loser = winner === a ? b : a;
    const merged = { ...loser, ...winner };
    if (!merged.customer_notes && loser.customer_notes) merged.customer_notes = loser.customer_notes;
    if (!merged.lead_name && loser.lead_name) merged.lead_name = loser.lead_name;
    if (!merged.lead_id && loser.lead_id) merged.lead_id = loser.lead_id;
    return merged;
};

/** Time (ms) within which two same-phone/direction/source rows are treated as duplicates of one dial. */
const DUP_WINDOW_MS = 120_000;

/** Collapse same-id rows + sliding-window phone-near-duplicates from one dial. */
const dedupe = (items) => {
    const byId = new Map();
    const result = [];
    const indexById = new Map();

    for (const item of items) {
        if (!item) continue;
        const id = item.id != null ? String(item.id) : '';

        // ── 1. Same-id collapse ──────────────────────────────────────────
        if (id && byId.has(id)) {
            const existing = byId.get(id);
            const merged = mergeRows(existing, item);
            byId.set(id, merged);
            const idx = indexById.get(id);
            if (idx != null) result[idx] = merged;
            continue;
        }

        // ── 2. Sliding-window phone collapse ──────────────────────────────
        // Catches the case where ONE dial produced two server rows with
        // different ids (e.g. /calls/quick-log + a duplicate from the
        // call-detector bridge or device-log sync). Bucket-based dedup
        // misses these when the timestamps straddle a bucket boundary;
        // sliding-window does not.
        const phone = cleanNumber(item.phone_number_dialed || item.lead_phone || '').slice(-10);
        const ts = item.call_start ? new Date(item.call_start).getTime() : 0;
        const itemType = String(item.call_type || '').toUpperCase();
        const itemSource = String(item.call_source || '').toUpperCase();

        if (phone && ts) {
            let dupIdx = -1;
            for (let i = 0; i < result.length; i++) {
                const r = result[i];
                const rPhone = cleanNumber(r.phone_number_dialed || r.lead_phone || '').slice(-10);
                if (rPhone !== phone) continue;
                if (String(r.call_type || '').toUpperCase() !== itemType) continue;
                if (String(r.call_source || '').toUpperCase() !== itemSource) continue;
                const rTs = r.call_start ? new Date(r.call_start).getTime() : 0;
                if (rTs && Math.abs(ts - rTs) < DUP_WINDOW_MS) {
                    dupIdx = i;
                    break;
                }
            }
            if (dupIdx !== -1) {
                const merged = mergeRows(result[dupIdx], item);
                result[dupIdx] = merged;
                // Keep the byId/indexById maps pointing to the survivor so a
                // later same-id arrival merges into the right slot.
                const survivorId = merged.id != null ? String(merged.id) : '';
                if (survivorId) {
                    byId.set(survivorId, merged);
                    indexById.set(survivorId, dupIdx);
                }
                if (id && id !== survivorId) {
                    byId.set(id, merged);
                    indexById.set(id, dupIdx);
                }
                continue;
            }
        }

        result.push(item);
        if (id) {
            indexById.set(id, result.length - 1);
            byId.set(id, item);
        }
    }
    // Sort newest-first by call_start so device-log rows merged into an
    // existing list don't sink to the bottom regardless of when they
    // happened.
    result.sort((a, b) => {
        const ta = a?.call_start ? new Date(a.call_start).getTime() : 0;
        const tb = b?.call_start ? new Date(b.call_start).getTime() : 0;
        return tb - ta;
    });
    return result;
};

let state = {
    calls: [],
    nextCursor: null,
    hasMore: false,
    filter: 'ALL',
    isFetching: false,
    isLoadingMore: false,
    lastSyncAt: 0,
    error: null,
};

const subscribers = new Set();
/** call ids that we've optimistically written but the server hasn't confirmed yet */
const pendingIds = new Map();
let inflightRefresh = null;
let pollHandle = null;
let initialized = false;
let listenersAttached = false;
let activeSnapshotKey = null;

const snapshotKey = () => `${SNAPSHOT_PREFIX}${getActiveSiteId() || 'no-site'}`;

const notify = () => {
    for (const fn of subscribers) {
        try { fn(); } catch { /* subscriber crash is not the store's problem */ }
    }
};

const setState = (patch) => {
    state = { ...state, ...patch };
    notify();
};

const persistSnapshot = () => {
    const key = snapshotKey();
    activeSnapshotKey = key;
    const payload = {
        calls: state.calls.slice(0, MAX_LOCAL_ROWS),
        nextCursor: state.nextCursor,
        hasMore: state.hasMore,
        filter: state.filter,
        lastSyncAt: state.lastSyncAt,
    };
    try {
        localStorage.setItem(key, JSON.stringify(payload));
    } catch { /* quota exceeded — drop silently */ }
    persistSet(key, payload, Date.now()).catch(() => {});
};

const hydrateFromLocalStorage = () => {
    const key = snapshotKey();
    activeSnapshotKey = key;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.calls)) return false;
        state = {
            ...state,
            calls: parsed.calls,
            nextCursor: parsed.nextCursor || null,
            hasMore: !!parsed.hasMore,
            filter: parsed.filter || 'ALL',
            lastSyncAt: parsed.lastSyncAt || 0,
        };
        return true;
    } catch {
        return false;
    }
};

const hydrateFromIDB = async () => {
    const key = snapshotKey();
    try {
        const persisted = await persistGet(key);
        if (!persisted?.data?.calls) return;
        // Only adopt IDB data if it's newer than what we already hold.
        const idbSyncAt = persisted.data.lastSyncAt || persisted.ts || 0;
        if (idbSyncAt <= state.lastSyncAt) return;
        const merged = dedupe([
            ...state.calls.filter(isPendingProtected),
            ...persisted.data.calls,
        ]);
        setState({
            calls: merged,
            nextCursor: persisted.data.nextCursor || state.nextCursor,
            hasMore: !!persisted.data.hasMore || state.hasMore,
            lastSyncAt: idbSyncAt,
        });
    } catch { /* idb best-effort */ }
};

const isPendingProtected = (item) => {
    const id = item?.id != null ? String(item.id) : '';
    if (!id) return false;
    if (id.startsWith('local-')) return true;
    if (id.startsWith('device-')) return true;
    return pendingIds.has(id);
};

const buildUrl = ({ cursor = null, limit = HISTORY_LIMIT } = {}) => {
    const params = new URLSearchParams({ limit });
    if (cursor) params.set('cursor', cursor);
    if (state.filter && state.filter !== 'ALL') params.set('call_type', state.filter);
    return `/calls/dialer-history?${params}`;
};

/* ── Public API ─────────────────────────────────────────────────────────── */

export const subscribe = (fn) => {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
};

export const getSnapshot = () => state;

/** Mark a call id as recently optimistically written; protected from server-fetch overwrites until TTL. */
export const markPending = (id, ttl = PENDING_TTL_MS) => {
    if (id == null) return;
    const key = String(id);
    pendingIds.set(key, Date.now() + ttl);
    setTimeout(() => {
        const expiry = pendingIds.get(key);
        if (expiry && expiry <= Date.now()) pendingIds.delete(key);
    }, ttl + 50);
};

export const clearPending = (id) => {
    if (id == null) return;
    pendingIds.delete(String(id));
};

/** Insert or replace a row. Used by the dialer for optimistic updates. */
export const upsertRecent = (entry, { replaceId = null } = {}) => {
    if (!entry) return;
    const incomingId = entry.id != null ? String(entry.id) : null;
    const targetReplaceId = replaceId != null ? String(replaceId) : null;
    const filtered = state.calls.filter((item) => {
        const id = item?.id != null ? String(item.id) : null;
        if (incomingId && id === incomingId) return false;
        if (targetReplaceId && id === targetReplaceId) return false;
        return true;
    });
    const next = dedupe([entry, ...filtered]).slice(0, MAX_LOCAL_ROWS);
    setState({ calls: next });
    persistSnapshot();
    if (incomingId) markPending(incomingId);
};

/**
 * Convert a native CallLog entry (from the Dialer plugin's getRecentCalls)
 * into a recents-row shape. Tagged with call_source='APP' so the existing
 * dedupe collapses it cleanly with the server-side row that the device-log
 * sync POST will produce a moment later.
 */
const deviceCallToRow = (c) => {
    if (!c) return null;
    const phone = String(c.number || c.phoneNumber || '').replace(/[^0-9+]/g, '');
    if (!phone) return null;
    const rawType = String(c.type || c.callType || '').toUpperCase();
    const callType = ['MISSED', 'REJECTED'].includes(rawType) ? 'MISSED'
        : rawType === 'INCOMING' ? 'INCOMING'
        : rawType === 'OUTGOING' ? 'OUTGOING'
        : rawType === 'UNKNOWN' ? 'INCOMING' : rawType;
    const ts = c.date ? Number(c.date) : (c.timestamp ? Number(c.timestamp) : Date.now());
    // Android sometimes stores the ring-time on MISSED rows (so a missed call
    // can come back with duration > 0). Force 0 so we don't display "00:05"
    // next to a missed call.
    const rawDuration = Math.max(0, Number(c.duration) || 0);
    const duration = callType === 'MISSED' ? 0 : rawDuration;
    const stableId = `device-${c.id || phone}-${ts}`;
    const cachedName = c.name && String(c.name).trim().length ? String(c.name).trim() : null;
    return {
        id: stableId,
        call_type: callType,
        call_start: new Date(ts).toISOString(),
        duration_seconds: duration,
        call_status: callType === 'MISSED' ? 'MISSED' : 'COMPLETED',
        call_source: 'APP',
        phone_number_dialed: phone,
        lead_phone: phone,
        lead_id: null,
        lead_name: cachedName,
    };
};

/**
 * Merge raw native CallLog entries directly into the in-memory recents state.
 * Intended for "ultra-fast" display: rows show up immediately (no network),
 * and get reconciled with the server's canonical rows on the next refresh
 * via the same dedupe path (phone + type + source within a 2-min window).
 */
export const mergeDeviceCalls = (deviceCalls) => {
    if (!Array.isArray(deviceCalls) || deviceCalls.length === 0) return 0;
    const rows = deviceCalls.map(deviceCallToRow).filter(Boolean);
    if (rows.length === 0) return 0;
    // Server rows already in state should win on overlap (higher completeness),
    // so we put existing state first, then append device rows.
    const merged = dedupe([...state.calls, ...rows]).slice(0, MAX_LOCAL_ROWS);
    if (merged.length === state.calls.length) {
        // Nothing new — but mergeRows may still have updated existing rows
        // (e.g. cached_name from device). Push notification regardless.
        let changed = false;
        for (let i = 0; i < merged.length; i++) {
            if (merged[i] !== state.calls[i]) { changed = true; break; }
        }
        if (!changed) return 0;
    }
    setState({ calls: merged });
    persistSnapshot();
    return rows.length;
};

/** Patch a single row by call id (used when the drawer saves a lead → row name update). */
export const patchRecent = (callId, patch = {}) => {
    if (callId == null && !patch.phone) return;
    const cid = callId != null ? String(callId) : null;
    const phoneTail = patch.phone ? cleanNumber(patch.phone).slice(-10) : null;
    let touched = false;
    const next = state.calls.map((item) => {
        const idMatch = cid != null && item?.id != null && String(item.id) === cid;
        // Also patch any phone-matching unlinked rows for the same number — fixes
        // the case where the drawer-saved name doesn't propagate to a sibling
        // row (e.g. the optimistic local row written before the server cid).
        let phoneMatch = false;
        if (!idMatch && phoneTail) {
            const itemPhoneTail = cleanNumber(item?.phone_number_dialed || item?.lead_phone || '').slice(-10);
            if (itemPhoneTail && itemPhoneTail === phoneTail) {
                // Only patch unlinked rows so we don't smash a row that's
                // already tied to a different lead.
                if (!item?.lead_id) phoneMatch = true;
            }
        }
        if (!idMatch && !phoneMatch) return item;
        touched = true;
        return {
            ...item,
            customer_notes: patch.customerNotes !== undefined ? patch.customerNotes : (item.customer_notes ?? null),
            lead_id: patch.leadId ?? item.lead_id ?? null,
            lead_name: patch.leadName !== undefined ? (patch.leadName || item.lead_name) : item.lead_name,
        };
    });
    if (!touched) return;
    setState({ calls: next });
    persistSnapshot();
};

export const removeRecent = (callId) => {
    if (callId == null) return;
    const cid = String(callId);
    const next = state.calls.filter((c) => String(c?.id) !== cid);
    if (next.length === state.calls.length) return;
    setState({ calls: next });
    persistSnapshot();
};

export const setFilter = (filter) => {
    const normalized = filter || 'ALL';
    if (normalized === state.filter) return;
    setState({ filter: normalized, nextCursor: null, hasMore: false });
    refresh({ force: true }).catch(() => {});
};

/**
 * Fetch first page from server.
 *   - force=true   bypasses the staleness check (user-triggered).
 *   - silent=true  doesn't toggle isFetching (background polls — UI stays
 *                  calm and the Refresh button doesn't spin for free).
 */
export const refresh = async ({ force = false, silent = false } = {}) => {
    if (inflightRefresh) return inflightRefresh;
    if (!force && state.lastSyncAt && (Date.now() - state.lastSyncAt) < STALE_MS) return null;

    if (!silent) setState({ isFetching: true });
    const url = buildUrl();

    inflightRefresh = api.get(url).then(({ data }) => {
        if (data?.success) {
            const protectedRows = state.calls.filter(isPendingProtected);
            const merged = dedupe([...protectedRows, ...(Array.isArray(data.calls) ? data.calls : [])]);
            // Drop pending markers for any id that's now confirmed by the server.
            const serverIds = new Set((data.calls || []).map((c) => String(c?.id)));
            for (const id of pendingIds.keys()) {
                if (serverIds.has(id)) pendingIds.delete(id);
            }
            state = {
                ...state,
                calls: merged.slice(0, MAX_LOCAL_ROWS),
                nextCursor: data.nextCursor || null,
                hasMore: !!data.hasMore,
                lastSyncAt: Date.now(),
                error: null,
                isFetching: false,
            };
            notify();
            persistSnapshot();
        } else {
            setState({ isFetching: false });
        }
        return data;
    }).catch((err) => {
        setState({ isFetching: false, error: err });
        return null;
    }).finally(() => {
        inflightRefresh = null;
    });
    return inflightRefresh;
};

export const loadMore = async () => {
    if (state.isLoadingMore || !state.hasMore || !state.nextCursor) return;
    setState({ isLoadingMore: true });
    const url = buildUrl({ cursor: state.nextCursor });
    try {
        const { data } = await api.get(url);
        if (data?.success) {
            const merged = dedupe([...state.calls, ...(Array.isArray(data.calls) ? data.calls : [])]);
            state = {
                ...state,
                calls: merged.slice(0, MAX_LOCAL_ROWS),
                nextCursor: data.nextCursor || null,
                hasMore: !!data.hasMore,
                isLoadingMore: false,
            };
            notify();
            persistSnapshot();
        } else {
            setState({ isLoadingMore: false });
        }
    } catch {
        setState({ isLoadingMore: false });
    }
};

/* ── Device CallLog sync ──────────────────────────────────────────────────
 * Pulls the native phone CallLog so calls placed/received from the system
 * dialer (i.e. NOT through this app) also appear in Recents.
 *
 * Two-stage flow for instant UI:
 *   1. Native CallLog read (~50ms) → mergeDeviceCalls → rows visible immediately.
 *   2. POST /calls/sync-device-log in background → server persists + dedupes.
 *      The next refresh from the server replaces the local rows with their
 *      canonical (lead-linked, notes-enriched) counterparts.
 */
let inflightDeviceSync = null;
let deviceSyncPollHandle = null;
let lastDeviceSyncAt = 0;
const DEVICE_SYNC_MIN_INTERVAL_MS = 5_000;

export const syncDeviceLog = async ({ force = false, postToServer = true } = {}) => {
    if (!isNative()) return null;
    if (inflightDeviceSync) return inflightDeviceSync;
    if (!force && lastDeviceSyncAt && (Date.now() - lastDeviceSyncAt) < DEVICE_SYNC_MIN_INTERVAL_MS) {
        return null;
    }
    const dialer = getDialerPlugin();
    if (!dialer || typeof dialer.getRecentCalls !== 'function') return null;

    inflightDeviceSync = (async () => {
        try {
            const res = await dialer.getRecentCalls({ limit: DEVICE_LOG_LIMIT });
            const calls = Array.isArray(res?.calls) ? res.calls : [];
            const cutoff = Date.now() - DEVICE_LOG_LOOKBACK_MS;
            const recent = calls.filter((c) => Number(c?.date) >= cutoff);

            // Stage 1 — instant local merge so Recents updates without a network hop.
            mergeDeviceCalls(recent);

            // Stage 2 — push to backend so the rows become canonical (lead match,
            // duplicate suppression, etc). Server dedupes by (phone, ±30s).
            if (postToServer && recent.length > 0) {
                const payload = recent
                    .map((c) => {
                        const phone = String(c.number || '').replace(/[^0-9+]/g, '');
                        if (!phone) return null;
                        const rawType = String(c.type || '').toUpperCase();
                        const callType = ['MISSED', 'REJECTED'].includes(rawType) ? 'MISSED'
                            : rawType === 'INCOMING' ? 'INCOMING'
                            : rawType === 'OUTGOING' ? 'OUTGOING'
                            : null;
                        if (!callType) return null;
                        const rawDur = Number(c.duration) || 0;
                        return {
                            phone_number: phone,
                            call_type: callType,
                            call_start: c.date ? new Date(Number(c.date)).toISOString() : new Date().toISOString(),
                            duration_seconds: callType === 'MISSED' ? 0 : rawDur,
                        };
                    })
                    .filter(Boolean);

                if (payload.length > 0) {
                    try {
                        await api.post('/calls/sync-device-log', { calls: payload });
                        // Pull the canonical rows back from the server.
                        refresh({ force: true, silent: true }).catch(() => {});
                    } catch { /* server-side sync best-effort */ }
                }
            }

            lastDeviceSyncAt = Date.now();
            return { merged: recent.length };
        } catch {
            return null;
        } finally {
            inflightDeviceSync = null;
        }
    })();
    return inflightDeviceSync;
};

const attachGlobalListeners = () => {
    if (listenersAttached || typeof window === 'undefined') return;
    listenersAttached = true;

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            refresh({ force: true, silent: true }).catch(() => {});
            // Pick up any calls placed/received from the native dialer while
            // the app was backgrounded.
            syncDeviceLog({ force: true }).catch(() => {});
        }
    });
    window.addEventListener('online', () => refresh({ force: true, silent: true }).catch(() => {}));

    // App-internal events fired by the dialer / drawer / call detector.
    window.addEventListener('rg:call-ended', () => {
        refresh({ force: true, silent: true }).catch(() => {});
        // Native dialer outgoing calls: by the time onCallEnded fires the
        // CallLog has been written, so a quick re-sync catches them.
        syncDeviceLog({ force: true }).catch(() => {});
    });
    window.addEventListener('rg:call-updated', (e) => {
        const detail = e?.detail || {};
        if (detail.callId != null || detail.phone) {
            patchRecent(detail.callId, {
                leadId: detail.leadId,
                leadName: detail.leadName,
                customerNotes: detail.customerNotes,
                phone: detail.phone,
            });
        }
        refresh({ force: true, silent: true }).catch(() => {});
    });

    if (!pollHandle) {
        pollHandle = setInterval(() => {
            if (document.visibilityState === 'visible') {
                refresh({ silent: true }).catch(() => {});
            }
        }, POLL_INTERVAL_MS);
    }

    // Background poll of the native CallLog. Catches calls that come in while
    // the app is open but the CallStateReceiver missed for any reason.
    if (!deviceSyncPollHandle && isNative()) {
        deviceSyncPollHandle = setInterval(() => {
            if (document.visibilityState === 'visible') {
                syncDeviceLog().catch(() => {});
            }
        }, DEVICE_LOG_POLL_MS);
    }
};

/** Call once at app boot (after persistInit). Idempotent. */
export const init = () => {
    if (initialized) return;
    initialized = true;

    // 1) Sync hydration so the very first render shows last-known data.
    hydrateFromLocalStorage();
    notify();

    // 2) Async upgrades — IDB may have a fresher copy than localStorage if
    //    localStorage was cleared by the OS / user.
    hydrateFromIDB().catch(() => {});

    // 3) Server refresh kicks off immediately (silent — UI already shows the
    //    snapshot, no need to flicker the spinner). If unauthenticated the
    //    request will fail silently; rehydrateForSite() can be called once
    //    login lands.
    refresh({ force: true, silent: true }).catch(() => {});

    // 4) On native, scoop up calls placed/received via the system dialer
    //    while the app was closed. Stage-1 merge surfaces them in the UI
    //    immediately; stage-2 POST persists them to the server.
    syncDeviceLog({ force: true }).catch(() => {});

    attachGlobalListeners();
};

/** Re-hydrate for a (possibly different) site id. Call after login or site switch. */
export const rehydrateForSite = () => {
    pendingIds.clear();
    lastDeviceSyncAt = 0;
    state = {
        calls: [],
        nextCursor: null,
        hasMore: false,
        filter: 'ALL',
        isFetching: false,
        isLoadingMore: false,
        lastSyncAt: 0,
        error: null,
    };
    hydrateFromLocalStorage();
    notify();
    hydrateFromIDB().catch(() => {});
    refresh({ force: true, silent: true }).catch(() => {});
    syncDeviceLog({ force: true }).catch(() => {});
};

export const reset = () => {
    pendingIds.clear();
    state = {
        calls: [],
        nextCursor: null,
        hasMore: false,
        filter: 'ALL',
        isFetching: false,
        isLoadingMore: false,
        lastSyncAt: 0,
        error: null,
    };
    notify();
};

/** React hook — re-renders on every store change. */
export const useRecents = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
