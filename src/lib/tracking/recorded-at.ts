/**
 * Resolves the `recorded_at` stored for a driver location point.
 *
 * The client sends the GPS fix time (`timestamp`) from the DEVICE clock. A
 * phone with a wrong clock (manually set time, stale time-zone rules) shifts
 * every point — on 2026-10-06 an Android tester's clock ran ~3,648 s behind and
 * only 10 of his 90 points fell inside the shift window. Readers (mileage,
 * shift trail, live view) all filter on `recorded_at`, so the fix belongs here,
 * at write time.
 *
 * Design: the client also sends its own clock at send time (`client_sent_at`).
 * `serverNow - clientSentAt` estimates the device clock offset for THIS
 * request; beyond a small tolerance (network latency + jitter) the fix time is
 * shifted by it. This keeps offline-queued points safe: a point captured 40 min
 * ago and flushed now is still 40 min old after correction — only the device's
 * clock error is removed, never the point's real age. Old clients that do not
 * send `client_sent_at` keep the previous behavior.
 *
 * Pure and server-only (no I/O) so it is unit-testable in isolation.
 */

/** Offsets at or below this are latency/jitter, not a wrong clock. */
export const CLOCK_SKEW_TOLERANCE_MS = 30 * 1000;

/** Fix times older than this (after correction) fall back to DB NOW(). */
export const RECORDED_AT_MAX_PAST_MS = 24 * 60 * 60 * 1000;

export interface RecordedAtInput {
  /** GPS fix time from the device clock (ISO string or epoch ms). */
  timestamp: unknown;
  /** Device clock at send time (epoch ms or ISO string); absent on old clients. */
  clientSentAt?: unknown;
  /** Server clock (epoch ms) when the request was handled. */
  serverNowMs: number;
}

export interface RecordedAtResolution {
  /** ISO string to store, or null to let the DB default to NOW(). */
  recordedAt: string | null;
  /** `serverNow - clientSentAt` when the client sent a usable send time. */
  clockOffsetMs: number | null;
  /** True when the offset exceeded the tolerance and was applied. */
  clockCorrected: boolean;
}

function toEpochMs(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function resolveRecordedAt({
  timestamp,
  clientSentAt,
  serverNowMs,
}: RecordedAtInput): RecordedAtResolution {
  const sentMs = toEpochMs(clientSentAt);
  const clockOffsetMs = sentMs === null ? null : serverNowMs - sentMs;
  const clockCorrected =
    clockOffsetMs !== null && Math.abs(clockOffsetMs) > CLOCK_SKEW_TOLERANCE_MS;

  const fixMs = toEpochMs(timestamp);
  if (fixMs === null) {
    return { recordedAt: null, clockOffsetMs, clockCorrected };
  }

  const correctedMs = clockCorrected ? fixMs + clockOffsetMs! : fixMs;
  if (correctedMs < serverNowMs - RECORDED_AT_MAX_PAST_MS) {
    return { recordedAt: null, clockOffsetMs, clockCorrected };
  }
  // Never store a future recorded_at: a point cannot be captured after the
  // server received it.
  const recordedMs = Math.min(correctedMs, serverNowMs);
  return {
    recordedAt: new Date(recordedMs).toISOString(),
    clockOffsetMs,
    clockCorrected,
  };
}
