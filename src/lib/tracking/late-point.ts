/**
 * Late / out-of-order GPS points.
 *
 * The service-worker offline queue replays points hours after they were
 * captured (seen 2026-10-15: a point recorded during shift A reached the
 * server 3 h later, during shift B). Such a point is still stored with its
 * device time — mileage and trails select by `recorded_at`, so it is filed
 * under the right shift — but it must never become the driver's CURRENT
 * position, or the live maps jump backwards mid-shift.
 *
 * Pure (no I/O) so both the API route and the browser map consumers share it.
 */

/**
 * A point older than this (vs server now) is history, not the current
 * position, even when it is the newest one stored. Generous enough that a
 * short tunnel/dead-zone replay or a slightly slow, uncorrected device clock
 * still moves the marker.
 */
export const LATE_POINT_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Points that arrive at least this long after capture may belong to a shift
 * that was already closed; only those pay for the closed-shift lookup. Live
 * points arrive within seconds.
 */
export const LATE_POINT_RECOMPUTE_MIN_AGE_MS = 60 * 1000;

type TimeInput = Date | string | number | null | undefined;

function toMs(value: TimeInput): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** True when `recordedAt` is strictly older than the newest point already seen. */
export function isOutOfOrderPoint(recordedAt: TimeInput, latestSeenAt: TimeInput): boolean {
  const recordedMs = toMs(recordedAt);
  const latestMs = toMs(latestSeenAt);
  if (recordedMs === null || latestMs === null) return false;
  return recordedMs < latestMs;
}

export interface LastKnownLocationInput {
  /** Resolved device time for the new point; null means the DB stamps NOW(). */
  recordedAt: TimeInput;
  /** Newest `recorded_at` stored for the driver before this insert. */
  latestStoredAt: TimeInput;
  serverNowMs: number;
}

/** Whether a new point may overwrite `drivers.last_known_location`. */
export function shouldUpdateLastKnownLocation({
  recordedAt,
  latestStoredAt,
  serverNowMs,
}: LastKnownLocationInput): boolean {
  const recordedMs = toMs(recordedAt);
  // DB-stamped (NOW()) points are current by definition.
  if (recordedMs === null) return true;
  if (serverNowMs - recordedMs > LATE_POINT_MAX_AGE_MS) return false;
  return !isOutOfOrderPoint(recordedMs, latestStoredAt);
}

/** Whether a new point is late enough that it may fall in an already-closed shift. */
export function shouldCheckClosedShift({
  recordedAt,
  serverNowMs,
}: {
  recordedAt: TimeInput;
  serverNowMs: number;
}): boolean {
  const recordedMs = toMs(recordedAt);
  if (recordedMs === null) return false;
  return serverNowMs - recordedMs > LATE_POINT_RECOMPUTE_MIN_AGE_MS;
}
