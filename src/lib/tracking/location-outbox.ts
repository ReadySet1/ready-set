/**
 * Durable outbox for GPS fixes the phone could not send (board card
 * gps-points-lost-during-data-outage).
 *
 * One queue, in the page's IndexedDB (LocationStore), shared by both writers
 * that run in the driver page's JS context:
 * - the foreground web tracker (src/hooks/tracking/useLocationTracking.ts)
 * - the native background-GPS bridge (src/lib/tracking/capacitor-tracking.ts),
 *   which runs in the same WebView inside the Capacitor shell
 *
 * Why it lives in the page and not in public/service-worker.js: the service
 * worker only replayed its queue on a Background Sync `sync` event, which the
 * Android WebView and iOS Safari never fire, so fixes it swallowed during an
 * outage were never uploaded (2026-10-17: 294 s hole, nothing replayed).
 *
 * Replay goes through POST /api/tracking/locations/batch: the single-point
 * route allows one point per tracking interval, so a backlog sent through it
 * drained one point per interval and lost the race with live posts.
 *
 * Guarantees:
 * - every fix of a long outage is kept, up to OUTBOX_MAX_POINTS (oldest
 *   dropped first beyond that) — ~2.8 h at the default 5 s cadence;
 * - it survives a reload or an app restart (IndexedDB);
 * - replay is oldest-first, in chunks, with each fix's original time;
 * - fixes older than the server's filing window are discarded unsent;
 * - one flush at a time per page, with a back-off after a 429.
 */
import type { LocationUpdate } from '@/types/tracking';
import {
  getLocationStore,
  type StoredLocationUpdate,
} from '@/utils/indexedDB/locationStore';
import { RECORDED_AT_MAX_PAST_MS } from '@/lib/tracking/recorded-at';

/** Hard cap on queued fixes (~2.8 h at one fix per 5 s; a few hundred KB). */
export const OUTBOX_MAX_POINTS = 2000;
/** Older fixes can't be filed by the server (it would stamp them NOW()), so drop them. */
export const OUTBOX_MAX_AGE_MS = RECORDED_AT_MAX_PAST_MS - 60 * 60 * 1000;
/** Points per batch request (the route accepts up to 100). */
export const OUTBOX_BATCH_SIZE = 50;
/** Quiet period after the server answers 429. */
export const OUTBOX_429_BACKOFF_MS = 30_000;

export const LOCATION_BATCH_ENDPOINT = '/api/tracking/locations/batch';

export interface OutboxStore {
  addLocation(location: LocationUpdate): Promise<void>;
  getUnsyncedLocations(): Promise<StoredLocationUpdate[]>;
  deleteLocations(ids: string[]): Promise<void>;
}

/** One point as the batch route expects it. */
export interface BatchPointPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  battery_level?: number | null;
  is_moving?: boolean;
  timestamp: string;
}

/** `status` absent = the request never got an HTTP answer (offline, DNS, reset). */
export interface BatchSendResult {
  ok: boolean;
  status?: number;
}

export type BatchSender = (
  driverId: string,
  points: BatchPointPayload[],
) => Promise<BatchSendResult>;

export type FlushStop =
  | 'network'
  | 'server'
  | 'auth'
  | 'rate-limit'
  | 'backoff'
  | 'in-flight'
  | 'storage';

export interface FlushResult {
  sent: number;
  remaining: number;
  stoppedBy?: FlushStop;
}

// Module state is per page load; the queue itself is in IndexedDB.
let pendingHint = -1; // -1 = unknown until the store has been read
let flushInFlight = false;
// Fixes queued while a flush runs are not in its snapshot; count them so the
// flush's final tally does not hide them from flushIfPending.
let queuedDuringFlush = 0;
let backoffUntil = 0;

function defaultStore(): OutboxStore {
  return getLocationStore();
}

/** Last known number of queued fixes, or -1 before the store was read. */
export function getPendingHint(): number {
  return pendingHint;
}

function byFixTime(a: StoredLocationUpdate, b: StoredLocationUpdate): number {
  return Date.parse(a.timestamp) - Date.parse(b.timestamp);
}

async function enforceCap(store: OutboxStore): Promise<void> {
  const pending = (await store.getUnsyncedLocations()).sort(byFixTime);
  const excess = pending.length - OUTBOX_MAX_POINTS;
  if (excess > 0) {
    await store.deleteLocations(pending.slice(0, excess).map((p) => p.id));
  }
  pendingHint = Math.min(pending.length, OUTBOX_MAX_POINTS);
}

/**
 * Queue a fix that could not be sent. Returns the pending count. Never throws:
 * a full or unavailable IndexedDB loses this one fix, not the tracker.
 */
export async function enqueueLocation(
  location: LocationUpdate,
  store: OutboxStore = defaultStore(),
): Promise<number> {
  try {
    await store.addLocation(location);
  } catch (error) {
    console.error('[location-outbox] could not queue a GPS fix:', error);
    return Math.max(pendingHint, 0);
  }
  if (flushInFlight) queuedDuringFlush += 1;
  try {
    if (pendingHint < 0 || pendingHint + 1 > OUTBOX_MAX_POINTS) {
      await enforceCap(store);
    } else {
      pendingHint += 1;
    }
  } catch (error) {
    console.error('[location-outbox] could not apply the queue cap:', error);
  }
  return Math.max(pendingHint, 0);
}

function toPayload(row: StoredLocationUpdate): BatchPointPayload {
  return {
    latitude: row.coordinates.lat,
    longitude: row.coordinates.lng,
    accuracy: row.accuracy,
    speed: row.speed,
    heading: row.heading,
    altitude: row.altitude,
    battery_level: row.batteryLevel != null ? Math.round(row.batteryLevel) : null,
    is_moving: row.isMoving,
    timestamp: row.timestamp,
  };
}

function stopReason(result: BatchSendResult): FlushStop | 'drop' {
  if (result.status === undefined) return 'network';
  if (result.status === 429) return 'rate-limit';
  if (result.status === 401 || result.status === 403) return 'auth';
  // A malformed batch will never succeed — drop it rather than block the queue.
  if (result.status === 400 || result.status === 413 || result.status === 422) return 'drop';
  return 'server';
}

/**
 * Replay queued fixes, oldest first, in batches. Safe to call often: it is
 * single-flight, honours the 429 back-off, and stops at the first failure
 * (the rest stays queued for the next call).
 */
export async function flushLocationOutbox(
  send: BatchSender,
  store: OutboxStore = defaultStore(),
): Promise<FlushResult> {
  if (flushInFlight) return { sent: 0, remaining: Math.max(pendingHint, 0), stoppedBy: 'in-flight' };
  if (Date.now() < backoffUntil) {
    return { sent: 0, remaining: Math.max(pendingHint, 0), stoppedBy: 'backoff' };
  }

  flushInFlight = true;
  queuedDuringFlush = 0;
  let sent = 0;
  let stoppedBy: FlushStop | undefined;
  let remaining = 0;
  try {
    const all = await store.getUnsyncedLocations();
    const cutoff = Date.now() - OUTBOX_MAX_AGE_MS;
    const expired = all.filter((row) => !(Date.parse(row.timestamp) >= cutoff));
    if (expired.length > 0) await store.deleteLocations(expired.map((row) => row.id));
    const queue = all.filter((row) => Date.parse(row.timestamp) >= cutoff).sort(byFixTime);
    remaining = queue.length;

    // Oldest first overall; consecutive fixes of the same driver share a batch.
    let i = 0;
    while (i < queue.length) {
      const driverId = queue[i]!.driverId;
      const chunk: StoredLocationUpdate[] = [];
      while (i < queue.length && chunk.length < OUTBOX_BATCH_SIZE && queue[i]!.driverId === driverId) {
        chunk.push(queue[i]!);
        i += 1;
      }

      const result = await send(driverId, chunk.map(toPayload));
      const reason = result.ok ? null : stopReason(result);
      if (reason === null || reason === 'drop') {
        await store.deleteLocations(chunk.map((row) => row.id));
        remaining -= chunk.length;
        if (reason === null) sent += chunk.length;
        continue;
      }
      if (reason === 'rate-limit') backoffUntil = Date.now() + OUTBOX_429_BACKOFF_MS;
      stoppedBy = reason;
      break;
    }
  } catch (error) {
    console.error('[location-outbox] flush failed:', error);
    stoppedBy = 'storage';
  } finally {
    flushInFlight = false;
  }
  pendingHint = Math.min(remaining + queuedDuringFlush, OUTBOX_MAX_POINTS);
  queuedDuringFlush = 0;
  return stoppedBy ? { sent, remaining, stoppedBy } : { sent, remaining };
}

/** Flush only when something may be queued — cheap enough to call after every live post. */
export async function flushIfPending(
  send: BatchSender,
  store: OutboxStore = defaultStore(),
): Promise<FlushResult> {
  if (pendingHint === 0) return { sent: 0, remaining: 0 };
  return flushLocationOutbox(send, store);
}

/**
 * HTTP transport for the batch route. `getHeaders` returns extra headers
 * (Bearer token on native; nothing on web, where the session cookie is sent),
 * or null when there are no credentials — reported as 401 without a request.
 */
export function createBatchSender(
  getHeaders: () => Promise<Record<string, string> | null>,
): BatchSender {
  return async (driverId, points) => {
    let headers: Record<string, string> | null;
    try {
      headers = await getHeaders();
    } catch {
      headers = null;
    }
    if (!headers) return { ok: false, status: 401 };
    try {
      const res = await fetch(LOCATION_BATCH_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          driver_id: driverId,
          // Device clock at send time: the server corrects a skewed phone.
          client_sent_at: Date.now(),
          points,
        }),
      });
      return { ok: res.ok, status: res.status };
    } catch {
      return { ok: false };
    }
  };
}

/** Test hook: forget the per-page state (simulates a fresh page load). */
export function __resetLocationOutboxForTests(): void {
  pendingHint = -1;
  flushInFlight = false;
  queuedDuringFlush = 0;
  backoffUntil = 0;
}
