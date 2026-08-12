/**
 * Planning helpers for field test drives (`scripts/reset-driver-test-drive.ts`).
 *
 * Field runs happen wherever the tester lives, not where the seed data was
 * written. The 2026-08-06 walking run lost its shift to two June seed orders
 * pinned to Mexico City while the tester stood in León — 198 mi outside the
 * arrival geofence, so they could neither advance nor dismiss them, and the
 * end-shift guard refused to close the shift.
 *
 * The fix is to generate every run's stops relative to the tester's own
 * position. This module holds the pure part of that: the geo math, the
 * disposable-order classifier, and the plan builder. All DB work lives in the
 * script.
 */

import { ARRIVAL_GEOFENCE_RADIUS_M } from '@/lib/driver/geofence';

export interface Coords {
  lat: number;
  lng: number;
}

/** Order-number prefix stamped on every generated test drive. */
export const TEST_ORDER_PREFIX = 'RSQA-';

/**
 * Order-number shapes that are unambiguously synthetic and therefore safe to
 * clear without asking. Anything outside this list is treated as real data and
 * needs an explicit override, so pointing the script at a live driver by
 * mistake cannot quietly cancel their work.
 */
const DISPOSABLE_PATTERNS: readonly RegExp[] = [
  /^rsqa-/i,
  /^walk-test\b/i,
  /^drive-test\b/i,
  /^cc-smoke-/i,
];

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Move `meters` from `origin` along `bearingDeg` (0 = north, 90 = east) on a
 * spherical earth. Matches the haversine used by the in-app geofence closely
 * enough that a point generated at N meters measures back as N meters.
 */
export function offsetCoords(origin: Coords, meters: number, bearingDeg: number): Coords {
  const angular = meters / EARTH_RADIUS_M;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

/** Great-circle distance in meters between two coordinates (haversine). */
function distanceMeters(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** True only for order numbers this tooling generated or is known to own. */
export function isDisposableTestOrder(orderNumber: string | null | undefined): boolean {
  if (!orderNumber) return false;
  const trimmed = orderNumber.trim();
  if (!trimmed) return false;
  return DISPOSABLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** One real-world stop on a named route preset, with a full postal address. */
export interface RouteStop {
  /** Human-readable label for logs and previews. */
  label: string;
  street1: string;
  city: string;
  state: string;
  zip: string;
  coords: Coords;
  isRestaurant?: boolean;
}

/**
 * A named recurring route: one vendor (the pickup for both legs) and one
 * dropoff per leg, each anchored to a real geocoded address.
 */
export interface TestDriveRoute {
  key: string;
  description: string;
  vendor: RouteStop;
  legs: {
    am: { dropoff: RouteStop; startHint: string };
    pm: { dropoff: RouteStop; startHint: string };
  };
  timeZone: string;
}

/**
 * Named route presets for the recurring field runs. Unlike the pin-based
 * generator above, these stops are real places the tester already walks or
 * drives, so the seeded orders match their actual day.
 *
 * The street1 strings deliberately match the historical rs-dev address rows
 * (June 2026 walk tests) so find-or-create reuses them instead of minting
 * duplicates.
 */
export const TEST_DRIVE_ROUTES: Record<string, TestDriveRoute> = {
  cdmx: {
    key: 'cdmx',
    description: 'Recurring CDMX commute: Del Bosque → office (am) / home (pm)',
    timeZone: 'America/Mexico_City',
    vendor: {
      label: 'Del Bosque restaurant',
      street1: 'Lago Menor, Del Rosal s/n, Bosque de Chapultepec',
      city: 'Ciudad de México',
      state: 'CDMX',
      zip: '11040',
      coords: { lat: 19.41127, lng: -99.199556 },
      isRestaurant: true,
    },
    legs: {
      am: {
        dropoff: {
          label: 'Office — Lomas de Chapultepec',
          street1: 'Aguiar y Seijas 25, Lomas - Virreyes, Lomas de Chapultepec',
          city: 'Ciudad de México',
          state: 'CDMX',
          zip: '11000',
          coords: { lat: 19.42222, lng: -99.20502 },
        },
        startHint: 'home (Col. Daniel Garza), departure ~08:15–08:30',
      },
      pm: {
        dropoff: {
          label: 'Home — Col. Daniel Garza',
          street1: 'Daniel Garza al Poniente, Col. Daniel Garza',
          city: 'Ciudad de México',
          state: 'CDMX',
          zip: '11840',
          coords: { lat: 19.408785, lng: -99.196468 },
        },
        startHint: 'office (Aguiar y Seijas 25), departure ~18:00',
      },
    },
  },
};

/**
 * Which leg of a route fits `now`: 'am' while the local hour in `timeZone` is
 * before 14:00, 'pm' from then on. Pure — the caller supplies the clock.
 */
export function pickRouteLeg(now: Date, timeZone: string): 'am' | 'pm' {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now),
  );
  return hour < 14 ? 'am' : 'pm';
}

export interface TestDriveStop {
  /** Human-readable label written to the address row. */
  label: string;
  coords: Coords;
}

export interface TestDrivePlan {
  orderNumber: string;
  pickup: TestDriveStop;
  dropoff: TestDriveStop;
  pickupAt: Date;
  arriveBy: Date;
}

export interface BuildTestDrivePlanOptions {
  /** Where the tester will be standing when they start the shift. */
  origin: Coords;
  /** Short identifier folded into the order number, e.g. "20260807-1". */
  runId: string;
  now: Date;
  /** Walk from the start point to the vendor. Default 250 m. */
  pickupDistanceM?: number;
  /** Walk from the start point to the client. Default 750 m. */
  dropoffDistanceM?: number;
  pickupBearingDeg?: number;
  dropoffBearingDeg?: number;
  /** Minutes from `now` until the scheduled pickup. Default 30. */
  leadMinutes?: number;
  /** Minutes allowed between pickup and arrival. Default 30. */
  windowMinutes?: number;
}

function assertValidOrigin(origin: Coords): void {
  const { lat, lng } = origin;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('origin must have finite lat/lng');
  }
  if (lat === 0 && lng === 0) {
    throw new Error('origin [0, 0] is the ungeocoded fallback, not a real position');
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error(`origin out of range: ${lat}, ${lng}`);
  }
}

/**
 * Build the stops and timings for one test drive, anchored on the tester's own
 * position.
 *
 * Two constraints keep the run actually completable:
 *  - the pickup sits outside the arrival geofence, so walking to it is a real
 *    leg that visibly flips the advance button from disabled to enabled;
 *  - the pickup is scheduled ahead of `now`, so the end-shift guard's
 *    overdue-assignment branch never fires on a freshly seeded order.
 */
export function buildTestDrivePlan(options: BuildTestDrivePlanOptions): TestDrivePlan {
  const {
    origin,
    runId,
    now,
    pickupDistanceM = 250,
    dropoffDistanceM = 750,
    pickupBearingDeg = 0,
    dropoffBearingDeg = 120,
    leadMinutes = 30,
    windowMinutes = 30,
  } = options;

  assertValidOrigin(origin);

  if (pickupDistanceM <= ARRIVAL_GEOFENCE_RADIUS_M) {
    throw new Error(
      `pickup must be farther than the ${ARRIVAL_GEOFENCE_RADIUS_M}m arrival geofence, got ${pickupDistanceM}m`,
    );
  }
  if (dropoffDistanceM <= pickupDistanceM) {
    throw new Error(
      `dropoff (${dropoffDistanceM}m) must be farther than the pickup (${pickupDistanceM}m)`,
    );
  }

  const pickupAt = new Date(now.getTime() + leadMinutes * 60_000);
  const arriveBy = new Date(pickupAt.getTime() + windowMinutes * 60_000);

  return {
    orderNumber: `${TEST_ORDER_PREFIX}${runId}`,
    pickup: {
      label: `QA vendor stop (${pickupDistanceM}m from start)`,
      coords: offsetCoords(origin, pickupDistanceM, pickupBearingDeg),
    },
    dropoff: {
      label: `QA client stop (${dropoffDistanceM}m from start)`,
      coords: offsetCoords(origin, dropoffDistanceM, dropoffBearingDeg),
    },
    pickupAt,
    arriveBy,
  };
}

export interface BuildRouteTestDrivePlanOptions {
  route: TestDriveRoute;
  /** Which leg to seed. Default: picked from `now` in the route's time zone. */
  leg?: 'am' | 'pm';
  /** Short identifier folded into the order number, e.g. "20260811-1". */
  runId: string;
  now: Date;
  /** Minutes from `now` until the scheduled pickup. Default 30. */
  leadMinutes?: number;
  /** Minutes allowed between pickup and arrival. Default 30. */
  windowMinutes?: number;
}

export interface RouteTestDrivePlan {
  orderNumber: string;
  leg: 'am' | 'pm';
  pickup: RouteStop;
  dropoff: RouteStop;
  pickupAt: Date;
  arriveBy: Date;
  /** Where the tester should be standing when the run starts. */
  startHint: string;
}

/**
 * Build the stops and timings for one test drive along a named route preset.
 *
 * Same constraints as `buildTestDrivePlan`, for the same reasons: the vendor
 * and dropoff must sit farther apart than the arrival geofence so the leg
 * between them is real, and the pickup is scheduled ahead of `now` so the
 * end-shift guard's overdue-assignment branch never fires on a fresh seed.
 */
export function buildRouteTestDrivePlan(options: BuildRouteTestDrivePlanOptions): RouteTestDrivePlan {
  const { route, runId, now, leadMinutes = 30, windowMinutes = 30 } = options;
  const leg = options.leg ?? pickRouteLeg(now, route.timeZone);
  const { dropoff, startHint } = route.legs[leg];

  const legM = distanceMeters(route.vendor.coords, dropoff.coords);
  if (legM <= ARRIVAL_GEOFENCE_RADIUS_M) {
    throw new Error(
      `route ${route.key} ${leg} leg is only ${Math.round(legM)}m — vendor and dropoff must be farther apart than the ${ARRIVAL_GEOFENCE_RADIUS_M}m arrival geofence`,
    );
  }

  const pickupAt = new Date(now.getTime() + leadMinutes * 60_000);
  const arriveBy = new Date(pickupAt.getTime() + windowMinutes * 60_000);

  return {
    orderNumber: `${TEST_ORDER_PREFIX}${runId}`,
    leg,
    pickup: route.vendor,
    dropoff,
    pickupAt,
    arriveBy,
    startHint,
  };
}
