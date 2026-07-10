import {
  ARRIVAL_GEOFENCE_RADIUS_M,
  checkArrivalGeofence,
  distanceToTargetM,
  geofenceHint,
  isValidTarget,
} from '../geofence';

// Del Bosque (pickup) and Casa (drop-off) from the CDMX walk-test route —
// real coordinates ~1.9 km apart.
const DEL_BOSQUE: [number, number] = [-99.1998007, 19.4110786];
const CASA: [number, number] = [-99.1965659, 19.4088789];

describe('isValidTarget', () => {
  it('accepts a finite [lng, lat] tuple', () => {
    expect(isValidTarget(DEL_BOSQUE)).toBe(true);
  });

  it('rejects the [0, 0] ungeocoded fallback, malformed and non-finite input', () => {
    expect(isValidTarget([0, 0])).toBe(false);
    expect(isValidTarget(null)).toBe(false);
    expect(isValidTarget(undefined)).toBe(false);
    expect(isValidTarget([1])).toBe(false);
    expect(isValidTarget([NaN, 19.4])).toBe(false);
    expect(isValidTarget('nope')).toBe(false);
  });
});

describe('distanceToTargetM', () => {
  it('computes ~0 m for the same point', () => {
    const d = distanceToTargetM({ lat: DEL_BOSQUE[1], lng: DEL_BOSQUE[0] }, DEL_BOSQUE);
    expect(d).not.toBeNull();
    expect(d!).toBeLessThan(1);
  });

  it('computes a plausible distance between the two walk-test stops (~400-500 m)', () => {
    const d = distanceToTargetM({ lat: CASA[1], lng: CASA[0] }, DEL_BOSQUE);
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThan(300);
    expect(d!).toBeLessThan(700);
  });

  it('returns null (fail-open) when either side is unknown', () => {
    expect(distanceToTargetM(null, DEL_BOSQUE)).toBeNull();
    expect(distanceToTargetM({ lat: NaN, lng: 1 }, DEL_BOSQUE)).toBeNull();
    expect(distanceToTargetM({ lat: 19.4, lng: -99.2 }, [0, 0])).toBeNull();
    expect(distanceToTargetM({ lat: 19.4, lng: -99.2 }, undefined)).toBeNull();
  });
});

describe('checkArrivalGeofence', () => {
  it('allows when within the radius', () => {
    const near = { lat: DEL_BOSQUE[1] + 0.0005, lng: DEL_BOSQUE[0] }; // ~55 m
    const check = checkArrivalGeofence(near, DEL_BOSQUE);
    expect(check.allowed).toBe(true);
    expect(check.distanceM).toBeGreaterThan(0);
    expect(check.distanceM).toBeLessThan(ARRIVAL_GEOFENCE_RADIUS_M);
  });

  it('blocks when clearly outside the radius', () => {
    const far = { lat: DEL_BOSQUE[1] + 0.01, lng: DEL_BOSQUE[0] }; // ~1.1 km
    const check = checkArrivalGeofence(far, DEL_BOSQUE);
    expect(check.allowed).toBe(false);
    expect(check.distanceM).toBeGreaterThan(ARRIVAL_GEOFENCE_RADIUS_M);
  });

  it('fails open when GPS or target is unknown', () => {
    expect(checkArrivalGeofence(null, DEL_BOSQUE)).toEqual({
      allowed: true,
      distanceM: null,
    });
    expect(checkArrivalGeofence({ lat: 19.4, lng: -99.2 }, [0, 0])).toEqual({
      allowed: true,
      distanceM: null,
    });
  });

  it('respects a custom radius', () => {
    const near = { lat: DEL_BOSQUE[1] + 0.0005, lng: DEL_BOSQUE[0] }; // ~55 m
    expect(checkArrivalGeofence(near, DEL_BOSQUE, 10).allowed).toBe(false);
  });
});

describe('geofenceHint', () => {
  it('formats meters and kilometers', () => {
    expect(geofenceHint(480)).toBe('~480 m away — move closer to enable');
    expect(geofenceHint(1850)).toBe('~1.9 km away — move closer to enable');
  });
});
