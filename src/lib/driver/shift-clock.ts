/**
 * Shift timer clock math, corrected for a wrong device clock.
 *
 * The shift start comes from the server (`NOW()` at insert), but the timer
 * ticks on the DEVICE clock. On 2026-10-14 an Android tester's phone ran
 * ~3,648 s behind the server (same device as the 2026-10-06 GPS skew fixed
 * server-side in PR #668), so `Date.now() - startTime` stayed negative for
 * the first hour and every shift timer read 0:00. The active-shift route now
 * reports the server clock; the client keeps `serverNow - deviceNow` as an
 * offset and adds it back before measuring elapsed time.
 */

/** Offset changes at or below this are request latency, not a clock change.
 *  Keeping the previous offset avoids a visible ±1 s jump on every refresh. */
export const CLOCK_OFFSET_STABLE_MS = 2_000;

/**
 * Server-minus-device clock offset (ms) from one request, measured at the
 * request midpoint to cancel symmetric latency. Null when the server sent no
 * usable time (older deployments).
 */
export function estimateClockOffsetMs(
  serverNowMs: unknown,
  requestSentAtMs: number,
  responseReceivedAtMs: number,
): number | null {
  if (typeof serverNowMs !== "number" || !Number.isFinite(serverNowMs)) return null;
  const deviceMidpointMs = (requestSentAtMs + responseReceivedAtMs) / 2;
  return Math.round(serverNowMs - deviceMidpointMs);
}

/** The offset to keep after a new measurement (see CLOCK_OFFSET_STABLE_MS). */
export function nextClockOffsetMs(previousMs: number, measuredMs: number | null): number {
  if (measuredMs === null) return previousMs;
  return Math.abs(measuredMs - previousMs) <= CLOCK_OFFSET_STABLE_MS ? previousMs : measuredMs;
}

/** Whole seconds since the shift started, on the server's clock. Never negative. */
export function shiftElapsedSeconds(
  startTime: string | Date | null | undefined,
  deviceNowMs: number,
  clockOffsetMs = 0,
): number {
  if (!startTime) return 0;
  const startMs = new Date(startTime).getTime();
  if (!Number.isFinite(startMs)) return 0;
  return Math.max(0, Math.floor((deviceNowMs + clockOffsetMs - startMs) / 1000));
}
