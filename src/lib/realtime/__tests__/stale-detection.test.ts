import { isLocationStale, STALE_LOCATION_THRESHOLD_MS } from '../stale-detection';

describe('isLocationStale', () => {
  it('treats a missing timestamp as stale', () => {
    expect(isLocationStale(undefined)).toBe(true);
    expect(isLocationStale(null)).toBe(true);
  });

  it('treats an unparseable timestamp as stale', () => {
    expect(isLocationStale('not-a-date')).toBe(true);
  });

  it('returns false for a fresh fix within the threshold', () => {
    const recent = new Date(Date.now() - (STALE_LOCATION_THRESHOLD_MS - 30_000));
    expect(isLocationStale(recent)).toBe(false);
    expect(isLocationStale(recent.toISOString())).toBe(false);
  });

  it('returns true once the fix is older than the threshold', () => {
    const old = new Date(Date.now() - (STALE_LOCATION_THRESHOLD_MS + 30_000));
    expect(isLocationStale(old)).toBe(true);
    expect(isLocationStale(old.toISOString())).toBe(true);
  });
});
