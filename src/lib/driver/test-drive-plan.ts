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

/** True only for order numbers this tooling generated or is known to own. */
export function isDisposableTestOrder(orderNumber: string | null | undefined): boolean {
  if (!orderNumber) return false;
  const trimmed = orderNumber.trim();
  if (!trimmed) return false;
  return DISPOSABLE_PATTERNS.some((pattern) => pattern.test(trimmed));
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
