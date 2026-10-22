import {
  ROUTE_REFETCH_DISTANCE_M,
  buildDirectionsUrl,
  formatGuideDistance,
  formatGuideDuration,
  formatNextStopLabel,
  parseDirectionsRoute,
  selectNextStop,
  shouldRefetchRoute,
  type GuideDelivery,
} from '../next-stop-guide';

const PICKUP_A: [number, number] = [-122.42, 37.77];
const DROPOFF_A: [number, number] = [-122.40, 37.79];
const PICKUP_B: [number, number] = [-122.45, 37.75];
const DROPOFF_B: [number, number] = [-122.38, 37.80];

const delivery = (overrides: Partial<GuideDelivery> & { id: string }): GuideDelivery => ({
  status: 'ASSIGNED',
  pickupLocation: { coordinates: PICKUP_A },
  deliveryLocation: { coordinates: DROPOFF_A },
  ...overrides,
});

describe('selectNextStop', () => {
  it('returns null when there are no deliveries', () => {
    expect(selectNextStop([])).toBeNull();
  });

  it.each(['ASSIGNED', 'EN_ROUTE_TO_VENDOR', 'ARRIVED_AT_VENDOR'])(
    'targets the pickup while the order is %s',
    (status) => {
      expect(selectNextStop([delivery({ id: 'd1', status })])).toEqual({
        deliveryId: 'd1',
        kind: 'pickup',
        coordinates: PICKUP_A,
      });
    },
  );

  it.each(['PICKED_UP', 'EN_ROUTE_TO_CLIENT', 'ARRIVED_TO_CLIENT'])(
    'targets the drop-off once the order is %s',
    (status) => {
      expect(selectNextStop([delivery({ id: 'd1', status })])).toEqual({
        deliveryId: 'd1',
        kind: 'dropoff',
        coordinates: DROPOFF_A,
      });
    },
  );

  it('accepts lower-case status strings from older feeds', () => {
    expect(selectNextStop([delivery({ id: 'd1', status: 'picked_up' })])?.kind).toBe('dropoff');
  });

  it('skips completed and cancelled orders', () => {
    expect(
      selectNextStop([
        delivery({ id: 'done', status: 'COMPLETED' }),
        delivery({ id: 'gone', status: 'cancelled' }),
      ]),
    ).toBeNull();
  });

  it('skips orders with a pending return-to-dispatch request', () => {
    expect(selectNextStop([delivery({ id: 'd1', pendingReturn: true })])).toBeNull();
  });

  it('prefers the order furthest along (food on board beats a new pickup)', () => {
    const next = selectNextStop([
      delivery({ id: 'new', status: 'ASSIGNED', pickupLocation: { coordinates: PICKUP_B } }),
      delivery({
        id: 'carrying',
        status: 'PICKED_UP',
        deliveryLocation: { coordinates: DROPOFF_B },
      }),
    ]);
    expect(next).toEqual({ deliveryId: 'carrying', kind: 'dropoff', coordinates: DROPOFF_B });
  });

  it('breaks ties by the earliest scheduled pickup', () => {
    const next = selectNextStop([
      delivery({ id: 'later', scheduledPickupAt: '2026-10-09T18:00:00Z' }),
      delivery({
        id: 'sooner',
        scheduledPickupAt: new Date('2026-10-09T17:00:00Z'),
        pickupLocation: { coordinates: PICKUP_B },
      }),
    ]);
    expect(next?.deliveryId).toBe('sooner');
    expect(next?.coordinates).toEqual(PICKUP_B);
  });

  it('falls through to the next order when the target is ungeocoded ([0,0])', () => {
    const next = selectNextStop([
      delivery({ id: 'bad', status: 'PICKED_UP', deliveryLocation: { coordinates: [0, 0] } }),
      delivery({ id: 'good', status: 'ASSIGNED' }),
    ]);
    expect(next?.deliveryId).toBe('good');
  });
});

describe('shouldRefetchRoute', () => {
  const origin = { lat: 37.7749, lng: -122.4194 };

  it('fetches when nothing has been requested yet', () => {
    expect(shouldRefetchRoute(null, { origin, targetKey: 'd1:pickup' })).toBe(true);
  });

  it('does not refetch for GPS jitter under the threshold', () => {
    // ~50 m north
    const moved = { lat: origin.lat + 0.00045, lng: origin.lng };
    expect(
      shouldRefetchRoute({ origin, targetKey: 'd1:pickup' }, { origin: moved, targetKey: 'd1:pickup' }),
    ).toBe(false);
  });

  it('refetches once the driver moved past the threshold', () => {
    // ~150 m north
    const moved = { lat: origin.lat + 0.00135, lng: origin.lng };
    expect(
      shouldRefetchRoute({ origin, targetKey: 'd1:pickup' }, { origin: moved, targetKey: 'd1:pickup' }),
    ).toBe(true);
  });

  it('refetches immediately when the next stop changes', () => {
    expect(
      shouldRefetchRoute({ origin, targetKey: 'd1:pickup' }, { origin, targetKey: 'd1:dropoff' }),
    ).toBe(true);
  });

  it('honors a custom threshold', () => {
    const moved = { lat: origin.lat + 0.00045, lng: origin.lng }; // ~50 m
    expect(
      shouldRefetchRoute(
        { origin, targetKey: 'd1:pickup' },
        { origin: moved, targetKey: 'd1:pickup' },
        25,
      ),
    ).toBe(true);
  });

  it('defaults to a ~100 m threshold', () => {
    expect(ROUTE_REFETCH_DISTANCE_M).toBe(100);
  });
});

describe('formatGuideDistance (imperial only)', () => {
  it('shows short distances in feet rounded to 10 ft', () => {
    expect(formatGuideDistance(30)).toBe('100 ft'); // 98.4 ft
    expect(formatGuideDistance(150)).toBe('490 ft'); // 492 ft
  });

  it('switches to miles with one decimal at 1000 ft and above', () => {
    expect(formatGuideDistance(305)).toBe('0.2 mi'); // 1000.6 ft
    expect(formatGuideDistance(1609.344)).toBe('1.0 mi');
    expect(formatGuideDistance(8046.72)).toBe('5.0 mi');
  });

  it('never prints meters or kilometers', () => {
    for (const m of [5, 120, 999, 2500, 40000]) {
      expect(formatGuideDistance(m)).toMatch(/ (ft|mi)$/);
    }
  });
});

describe('formatGuideDuration', () => {
  it('shows under a minute as "<1 min"', () => {
    expect(formatGuideDuration(20)).toBe('<1 min');
  });

  it('rounds to whole minutes', () => {
    expect(formatGuideDuration(90)).toBe('2 min');
    expect(formatGuideDuration(59 * 60)).toBe('59 min');
  });

  it('uses hours past 60 minutes', () => {
    expect(formatGuideDuration(60 * 60)).toBe('1 h');
    expect(formatGuideDuration(75 * 60)).toBe('1 h 15 min');
  });
});

describe('formatNextStopLabel', () => {
  it('labels a pickup with road distance and ETA', () => {
    expect(formatNextStopLabel('pickup', { distanceM: 1609.344, durationS: 360 })).toBe(
      'Next: Pickup · 1.0 mi · 6 min',
    );
  });

  it('labels a drop-off', () => {
    expect(formatNextStopLabel('dropoff', { distanceM: 150, durationS: 45 })).toBe(
      'Next: Drop-off · 490 ft · <1 min',
    );
  });

  it('falls back to an approximate straight-line distance without ETA', () => {
    expect(formatNextStopLabel('pickup', { distanceM: 1609.344, approximate: true })).toBe(
      'Next: Pickup · ~1.0 mi',
    );
  });

  it('shows just the stop when no distance is known', () => {
    expect(formatNextStopLabel('dropoff', null)).toBe('Next: Drop-off');
  });
});

describe('buildDirectionsUrl', () => {
  it('builds a Mapbox driving request from origin to target with the encoded token', () => {
    const url = buildDirectionsUrl({ lat: 37.7749, lng: -122.4194 }, PICKUP_A, 'pk.a/b');
    expect(url).toBe(
      'https://api.mapbox.com/directions/v5/mapbox/driving/-122.4194,37.7749;-122.42,37.77' +
        '?geometries=geojson&overview=full&access_token=pk.a%2Fb',
    );
  });
});

describe('parseDirectionsRoute', () => {
  it('extracts geometry, distance and duration from the first route', () => {
    const coordinates = [
      [-122.4194, 37.7749],
      [-122.42, 37.77],
    ];
    expect(
      parseDirectionsRoute({
        routes: [{ geometry: { type: 'LineString', coordinates }, distance: 812.4, duration: 151 }],
      }),
    ).toEqual({ coordinates, distanceM: 812.4, durationS: 151 });
  });

  it.each([
    ['null body', null],
    ['no routes', { routes: [] }],
    ['NoRoute code', { code: 'NoRoute', routes: [] }],
    ['wrong geometry type', { routes: [{ geometry: { type: 'Point', coordinates: [1, 2] } }] }],
    ['single vertex', { routes: [{ geometry: { type: 'LineString', coordinates: [[1, 2]] } }] }],
  ])('returns null for %s', (_label, body) => {
    expect(parseDirectionsRoute(body)).toBeNull();
  });

  it('keeps the geometry even when distance/duration are missing', () => {
    const coordinates = [
      [1, 2],
      [3, 4],
    ];
    expect(
      parseDirectionsRoute({ routes: [{ geometry: { type: 'LineString', coordinates } }] }),
    ).toEqual({ coordinates, distanceM: null, durationS: null });
  });
});
