import {
  LATE_POINT_MAX_AGE_MS,
  LATE_POINT_RECOMPUTE_MIN_AGE_MS,
  isOutOfOrderPoint,
  shouldCheckClosedShift,
  shouldUpdateLastKnownLocation,
} from '../late-point';

const NOW = Date.parse('2026-10-16T00:04:00Z');

describe('isOutOfOrderPoint', () => {
  it('is true when the point is older than the newest one already seen', () => {
    expect(isOutOfOrderPoint('2026-10-15T21:04:00Z', '2026-10-16T00:03:30Z')).toBe(true);
  });

  it('is false for a newer or equal point', () => {
    expect(isOutOfOrderPoint('2026-10-16T00:04:00Z', '2026-10-16T00:03:30Z')).toBe(false);
    expect(isOutOfOrderPoint('2026-10-16T00:03:30Z', '2026-10-16T00:03:30Z')).toBe(false);
  });

  it('is false when either time is missing or unparseable', () => {
    expect(isOutOfOrderPoint('2026-10-16T00:04:00Z', null)).toBe(false);
    expect(isOutOfOrderPoint(null, '2026-10-16T00:04:00Z')).toBe(false);
    expect(isOutOfOrderPoint('garbage', '2026-10-16T00:04:00Z')).toBe(false);
  });

  it('accepts Date and epoch-ms inputs', () => {
    expect(isOutOfOrderPoint(new Date(NOW - 1000), NOW)).toBe(true);
  });
});

describe('shouldUpdateLastKnownLocation', () => {
  it('updates for a fresh in-order point', () => {
    expect(
      shouldUpdateLastKnownLocation({
        recordedAt: new Date(NOW - 5000).toISOString(),
        latestStoredAt: new Date(NOW - 20_000),
        serverNowMs: NOW,
      }),
    ).toBe(true);
  });

  it('updates when the DB stamps the time (no device fix time)', () => {
    expect(
      shouldUpdateLastKnownLocation({
        recordedAt: null,
        latestStoredAt: new Date(NOW - 20_000),
        serverNowMs: NOW,
      }),
    ).toBe(true);
  });

  it('updates for the very first point of a driver', () => {
    expect(
      shouldUpdateLastKnownLocation({
        recordedAt: new Date(NOW - 5000).toISOString(),
        latestStoredAt: null,
        serverNowMs: NOW,
      }),
    ).toBe(true);
  });

  it('does not update for a point older than the latest stored point (the 3 h replay)', () => {
    expect(
      shouldUpdateLastKnownLocation({
        recordedAt: '2026-10-15T21:04:00Z',
        latestStoredAt: new Date(NOW - 15_000),
        serverNowMs: NOW,
      }),
    ).toBe(false);
  });

  it('does not update for a point older than the max age even when it is the newest stored', () => {
    expect(
      shouldUpdateLastKnownLocation({
        recordedAt: new Date(NOW - LATE_POINT_MAX_AGE_MS - 1).toISOString(),
        latestStoredAt: new Date(NOW - LATE_POINT_MAX_AGE_MS - 60_000),
        serverNowMs: NOW,
      }),
    ).toBe(false);
  });
});

describe('shouldCheckClosedShift', () => {
  it('is false for a live point and for DB-stamped points', () => {
    expect(
      shouldCheckClosedShift({ recordedAt: new Date(NOW - 5000).toISOString(), serverNowMs: NOW }),
    ).toBe(false);
    expect(shouldCheckClosedShift({ recordedAt: null, serverNowMs: NOW })).toBe(false);
  });

  it('is true for a point that arrived later than the recompute gate', () => {
    expect(
      shouldCheckClosedShift({
        recordedAt: new Date(NOW - LATE_POINT_RECOMPUTE_MIN_AGE_MS - 1).toISOString(),
        serverNowMs: NOW,
      }),
    ).toBe(true);
  });
});
