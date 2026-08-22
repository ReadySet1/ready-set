import {
  buildTrailLineString,
  appendTrailPoint,
  trailLengthMiles,
  type TrailPoint,
} from '@/lib/tracking/trail-geojson';

const p = (lng: number, lat: number, at: string): TrailPoint => ({
  longitude: lng,
  latitude: lat,
  recordedAt: at,
});

describe('buildTrailLineString', () => {
  it('returns an empty LineString with pointCount 0 for no input', () => {
    const trail = buildTrailLineString([]);
    expect(trail.type).toBe('Feature');
    expect(trail.geometry).toEqual({ type: 'LineString', coordinates: [] });
    expect(trail.properties.pointCount).toBe(0);
  });

  it('orders points by recordedAt ascending regardless of input order', () => {
    const trail = buildTrailLineString([
      p(-101.7, 21.13, '2026-08-21T19:02:00Z'),
      p(-101.6, 21.12, '2026-08-21T19:00:00Z'),
      p(-101.8, 21.14, '2026-08-21T19:04:00Z'),
    ]);
    expect(trail.geometry.coordinates).toEqual([
      [-101.6, 21.12],
      [-101.7, 21.13],
      [-101.8, 21.14],
    ]);
    expect(trail.properties.pointCount).toBe(3);
  });

  it('drops identical consecutive points but keeps non-adjacent repeats', () => {
    const trail = buildTrailLineString([
      p(-101.6, 21.12, '2026-08-21T19:00:00Z'),
      p(-101.6, 21.12, '2026-08-21T19:00:10Z'),
      p(-101.7, 21.13, '2026-08-21T19:00:20Z'),
      p(-101.6, 21.12, '2026-08-21T19:00:30Z'),
    ]);
    expect(trail.geometry.coordinates).toEqual([
      [-101.6, 21.12],
      [-101.7, 21.13],
      [-101.6, 21.12],
    ]);
    expect(trail.properties.pointCount).toBe(3);
  });

  it('skips points with non-finite coordinates', () => {
    const trail = buildTrailLineString([
      p(Number.NaN, 21.12, '2026-08-21T19:00:00Z'),
      p(-101.7, 21.13, '2026-08-21T19:00:20Z'),
    ]);
    expect(trail.geometry.coordinates).toEqual([[-101.7, 21.13]]);
  });
});

describe('appendTrailPoint', () => {
  it('appends a new coordinate without mutating the input', () => {
    const base = buildTrailLineString([p(-101.6, 21.12, '2026-08-21T19:00:00Z')]);
    const next = appendTrailPoint(base, [-101.7, 21.13]);
    expect(next.geometry.coordinates).toEqual([[-101.6, 21.12], [-101.7, 21.13]]);
    expect(next.properties.pointCount).toBe(2);
    expect(base.geometry.coordinates).toHaveLength(1);
  });

  it('returns the same trail when the ping repeats the last coordinate', () => {
    const base = buildTrailLineString([p(-101.6, 21.12, '2026-08-21T19:00:00Z')]);
    const next = appendTrailPoint(base, [-101.6, 21.12]);
    expect(next).toBe(base);
  });
});

describe('trailLengthMiles', () => {
  it('is 0 for fewer than two points', () => {
    expect(trailLengthMiles(buildTrailLineString([]))).toBe(0);
  });

  it('sums haversine distance and converts to miles', () => {
    // ~1 degree of latitude at the equator is ~69.1 miles.
    const trail = buildTrailLineString([
      p(0, 0, '2026-08-21T19:00:00Z'),
      p(0, 1, '2026-08-21T19:10:00Z'),
    ]);
    expect(trailLengthMiles(trail)).toBeCloseTo(69.1, 0);
  });
});
