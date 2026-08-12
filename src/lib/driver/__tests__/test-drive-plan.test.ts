import {
  TEST_DRIVE_ROUTES,
  TEST_ORDER_PREFIX,
  buildRouteTestDrivePlan,
  buildTestDrivePlan,
  isDisposableTestOrder,
  offsetCoords,
  pickRouteLeg,
} from '@/lib/driver/test-drive-plan';
import { ARRIVAL_GEOFENCE_RADIUS_M, distanceToTargetM } from '@/lib/driver/geofence';

/** León, Gto. — the city Fernando runs the walking legs from. */
const LEON = { lat: 21.1219, lng: -101.6833 };

describe('offsetCoords', () => {
  it('lands the requested number of meters away, measured by the app geofence math', () => {
    const moved = offsetCoords(LEON, 250, 0);
    const measured = distanceToTargetM(LEON, [moved.lng, moved.lat]);
    expect(measured).not.toBeNull();
    expect(measured as number).toBeCloseTo(250, -1); // within ~10m
  });

  it('moves north on bearing 0 and east on bearing 90', () => {
    const north = offsetCoords(LEON, 500, 0);
    expect(north.lat).toBeGreaterThan(LEON.lat);
    expect(north.lng).toBeCloseTo(LEON.lng, 5);

    const east = offsetCoords(LEON, 500, 90);
    expect(east.lng).toBeGreaterThan(LEON.lng);
    expect(east.lat).toBeCloseTo(LEON.lat, 5);
  });

  it('is accurate at a very different latitude', () => {
    const sf = { lat: 37.7749, lng: -122.4194 };
    const moved = offsetCoords(sf, 1000, 45);
    expect(distanceToTargetM(sf, [moved.lng, moved.lat]) as number).toBeCloseTo(1000, -1);
  });
});

describe('isDisposableTestOrder', () => {
  it.each([
    `${TEST_ORDER_PREFIX}20260807-1`,
    'WALK-TEST-AM',
    'WALK-TEST-PM',
    'DRIVE-TEST-0624',
    'CC-SMOKE-1778181232',
  ])('treats %s as disposable synthetic data', (orderNumber) => {
    expect(isDisposableTestOrder(orderNumber)).toBe(true);
  });

  it.each(['318555', 'Destino Cater Cow 1', 'ZeroCater -  2143-73', 'Cater Cow 320085'])(
    'refuses to treat %s as disposable',
    (orderNumber) => {
      expect(isDisposableTestOrder(orderNumber)).toBe(false);
    },
  );

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(isDisposableTestOrder('  walk-test-am ')).toBe(true);
  });

  it('never treats an empty or missing order number as disposable', () => {
    expect(isDisposableTestOrder('')).toBe(false);
    expect(isDisposableTestOrder(null)).toBe(false);
    expect(isDisposableTestOrder(undefined)).toBe(false);
  });
});

describe('buildTestDrivePlan', () => {
  const now = new Date('2026-08-07T18:00:00.000Z');
  const plan = buildTestDrivePlan({ origin: LEON, runId: '20260807-1', now });

  it('places the pickup outside the arrival geofence so the walk to it is a real leg', () => {
    const d = distanceToTargetM(LEON, [plan.pickup.coords.lng, plan.pickup.coords.lat]) as number;
    expect(d).toBeGreaterThan(ARRIVAL_GEOFENCE_RADIUS_M);
  });

  it('places the dropoff farther out than the pickup', () => {
    const toPickup = distanceToTargetM(LEON, [
      plan.pickup.coords.lng,
      plan.pickup.coords.lat,
    ]) as number;
    const toDropoff = distanceToTargetM(LEON, [
      plan.dropoff.coords.lng,
      plan.dropoff.coords.lat,
    ]) as number;
    expect(toDropoff).toBeGreaterThan(toPickup);
  });

  it('separates pickup and dropoff by more than the geofence radius so arrivals are distinct', () => {
    const legM = distanceToTargetM(plan.pickup.coords, [
      plan.dropoff.coords.lng,
      plan.dropoff.coords.lat,
    ]) as number;
    expect(legM).toBeGreaterThan(ARRIVAL_GEOFENCE_RADIUS_M);
  });

  it('stamps an order number that is recognisably disposable and carries the run id', () => {
    expect(plan.orderNumber).toBe(`${TEST_ORDER_PREFIX}20260807-1`);
    expect(isDisposableTestOrder(plan.orderNumber)).toBe(true);
  });

  it('schedules the pickup window around now so the run is never pre-flagged as overdue', () => {
    // The end-shift guard blocks ASSIGNED orders whose pickup is already past
    // (or within endShiftPickupGuardMinutes). A fresh plan must start ahead of
    // that window, otherwise the driver is blocked before they even walk.
    expect(plan.pickupAt.getTime()).toBeGreaterThan(now.getTime());
    expect(plan.arriveBy.getTime()).toBeGreaterThan(plan.pickupAt.getTime());
  });

  it('honours explicit distances and bearings', () => {
    const custom = buildTestDrivePlan({
      origin: LEON,
      runId: 'x',
      now,
      pickupDistanceM: 400,
      dropoffDistanceM: 1200,
    });
    expect(
      distanceToTargetM(LEON, [custom.pickup.coords.lng, custom.pickup.coords.lat]) as number,
    ).toBeCloseTo(400, -1);
    expect(
      distanceToTargetM(LEON, [custom.dropoff.coords.lng, custom.dropoff.coords.lat]) as number,
    ).toBeCloseTo(1200, -1);
  });

  it('rejects a dropoff that is not farther than the pickup', () => {
    expect(() =>
      buildTestDrivePlan({
        origin: LEON,
        runId: 'x',
        now,
        pickupDistanceM: 800,
        dropoffDistanceM: 300,
      }),
    ).toThrow(/dropoff/i);
  });

  it('rejects an origin that is not a real coordinate', () => {
    expect(() => buildTestDrivePlan({ origin: { lat: 0, lng: 0 }, runId: 'x', now })).toThrow(
      /origin/i,
    );
    expect(() =>
      buildTestDrivePlan({ origin: { lat: 91, lng: -101 }, runId: 'x', now }),
    ).toThrow(/origin/i);
  });
});

describe('pickRouteLeg', () => {
  const CDMX_TZ = 'America/Mexico_City';

  it("returns 'am' during the morning commute (08:20 CDMX)", () => {
    // CDMX is UTC-6 year-round (no DST since 2022): 14:20Z = 08:20 local.
    expect(pickRouteLeg(new Date('2026-08-11T14:20:00.000Z'), CDMX_TZ)).toBe('am');
  });

  it("returns 'pm' for the evening return (18:05 CDMX)", () => {
    // 00:05Z next day = 18:05 local the previous evening.
    expect(pickRouteLeg(new Date('2026-08-12T00:05:00.000Z'), CDMX_TZ)).toBe('pm');
  });

  it('flips from am to pm at exactly 14:00 local', () => {
    expect(pickRouteLeg(new Date('2026-08-11T19:59:00.000Z'), CDMX_TZ)).toBe('am'); // 13:59
    expect(pickRouteLeg(new Date('2026-08-11T20:00:00.000Z'), CDMX_TZ)).toBe('pm'); // 14:00
  });
});

describe('TEST_DRIVE_ROUTES.cdmx', () => {
  const route = TEST_DRIVE_ROUTES.cdmx!;
  const now = new Date('2026-08-11T14:20:00.000Z');

  it('flags the vendor stop as a restaurant so the pickup address renders as one', () => {
    expect(route.vendor.isRestaurant).toBe(true);
  });

  it('keeps both dropoffs outside the arrival geofence around the vendor', () => {
    for (const leg of ['am', 'pm'] as const) {
      const stop = route.legs[leg].dropoff;
      const d = distanceToTargetM(route.vendor.coords, [
        stop.coords.lng,
        stop.coords.lat,
      ]) as number;
      expect(d).toBeGreaterThan(ARRIVAL_GEOFENCE_RADIUS_M);
    }
  });

  it('stamps an order number that is recognisably disposable', () => {
    const plan = buildRouteTestDrivePlan({ route, runId: '20260811-1', now });
    expect(isDisposableTestOrder(plan.orderNumber)).toBe(true);
  });
});

describe('buildRouteTestDrivePlan', () => {
  const route = TEST_DRIVE_ROUTES.cdmx!;
  /** 14:20Z = 08:20 in CDMX (UTC-6) — the tester's morning commute. */
  const morning = new Date('2026-08-11T14:20:00.000Z');
  /** 00:05Z = 18:05 in CDMX the previous evening — the return leg. */
  const evening = new Date('2026-08-12T00:05:00.000Z');

  it('routes the morning commute from the vendor to the office', () => {
    const plan = buildRouteTestDrivePlan({ route, runId: '20260811-1', now: morning });
    expect(plan.leg).toBe('am');
    expect(plan.pickup).toBe(route.vendor);
    expect(plan.dropoff).toBe(route.legs.am.dropoff);
    expect(plan.startHint).toBe(route.legs.am.startHint);
  });

  it('routes the evening return from the vendor to home', () => {
    const plan = buildRouteTestDrivePlan({ route, runId: '20260811-2', now: evening });
    expect(plan.leg).toBe('pm');
    expect(plan.dropoff).toBe(route.legs.pm.dropoff);
    expect(plan.startHint).toBe(route.legs.pm.startHint);
  });

  it('lets an explicit leg override the clock', () => {
    const plan = buildRouteTestDrivePlan({ route, leg: 'pm', runId: 'x', now: morning });
    expect(plan.leg).toBe('pm');
    expect(plan.dropoff).toBe(route.legs.pm.dropoff);
  });

  it('schedules the pickup window around now so the run is never pre-flagged as overdue', () => {
    // Same rule as buildTestDrivePlan: the end-shift guard blocks ASSIGNED
    // orders whose pickup is already past, so a fresh seed must start ahead.
    const plan = buildRouteTestDrivePlan({ route, runId: 'x', now: morning });
    expect(plan.pickupAt.getTime()).toBe(morning.getTime() + 30 * 60_000);
    expect(plan.arriveBy.getTime()).toBe(plan.pickupAt.getTime() + 30 * 60_000);
  });
});
