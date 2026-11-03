import { prisma } from '@/utils/prismaDB';
import { existingDriverOwnershipCondition } from '@/lib/auth/driver-ownership';
import { getTrackingSettings } from '@/services/tracking/tracking-settings';
import { realtimeLogger } from '@/lib/logging/realtime-logger';

/**
 * Position recorded on an `order_status_history` row — same `{ lat, lng }`
 * JSON shape the column has always been written with.
 */
export interface StatusHistoryPoint {
  lat: number;
  lng: number;
}

export interface ResolveStatusHistoryLocationInput {
  /** Profile id (auth uid) of the driver the order is dispatched to. */
  driverProfileId?: string | null;
  /** Point sent by the client with the status change, if any. Fallback only. */
  clientLocation?: StatusHistoryPoint | null;
  /** Injectable clock for tests. */
  now?: Date;
}

/** How far in the future a recorded_at may be (device clock skew) and still count as fresh. */
const FUTURE_SKEW_TOLERANCE_MS = 60_000;

interface LatestPointRow {
  latitude: number;
  longitude: number;
  recorded_at: Date;
}

function isValidPoint(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/**
 * Normalize a client-sent position (`{ lat, lng }` or `{ latitude, longitude }`)
 * to the history shape. Anything malformed or out of range is null.
 */
export function parseClientLocation(raw: unknown): StatusHistoryPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const lat = r.lat ?? r.latitude;
  const lng = r.lng ?? r.longitude;
  return isValidPoint(lat, lng) ? { lat: lat as number, lng: lng as number } : null;
}

interface DispatchLike {
  createdAt?: Date | string | null;
  driverId?: string | null;
  driver?: { id?: string | null } | null;
}

/**
 * Profile id of the order's dispatched driver, chosen deterministically: the
 * newest dispatch row that names a driver (rows without `createdAt` sort
 * oldest). Callers may load dispatches without an `orderBy`.
 */
function dispatchedDriverProfileId(dispatches: unknown): string | null {
  if (!Array.isArray(dispatches)) return null;
  const time = (d: DispatchLike) => (d.createdAt ? new Date(d.createdAt).getTime() || 0 : 0);
  let best: { id: string; at: number } | null = null;
  for (const raw of dispatches as Array<DispatchLike | null | undefined>) {
    if (!raw) continue;
    const id = raw.driverId ?? raw.driver?.id ?? null;
    if (!id) continue;
    const at = time(raw);
    if (!best || at > best.at) best = { id, at };
  }
  return best?.id ?? null;
}

export interface StatusHistoryDriverInput {
  /** Authenticated caller (auth uid === profile id). */
  callerId: string;
  /** ADMIN / SUPER_ADMIN / HELPDESK. */
  callerIsStaff: boolean;
  /** The order's dispatch rows (`driverId` and/or `driver.id`). */
  dispatches?: unknown;
  /** Driver status being set. */
  driverStatus?: string | null;
  /** Driver named in the request body. Trusted only on a staff ASSIGNED call. */
  requestedDriverId?: string | null;
}

/**
 * Whose position may go on the history row. A non-staff caller (already
 * verified as assigned to the order) only ever gets their OWN identity, so a
 * request body cannot make the server write another driver's position. Staff
 * get the order's dispatched driver, or the body driver when they are
 * assigning one. The id is resolved to a drivers row inside the lookup via
 * the driver-ownership module.
 */
export function statusHistoryDriverProfileId(input: StatusHistoryDriverInput): string | null {
  if (!input.callerIsStaff) return input.callerId;
  if (input.driverStatus === 'ASSIGNED' && input.requestedDriverId) {
    return input.requestedDriverId;
  }
  return dispatchedDriverProfileId(input.dispatches);
}

/** Latest non-deleted GPS point of the (non-deleted) driver linked to this profile. */
async function latestDriverPoint(driverProfileId: string): Promise<LatestPointRow | null> {
  const rows = await prisma.$queryRawUnsafe<LatestPointRow[]>(
    `
    SELECT dl.latitude, dl.longitude, dl.recorded_at
    FROM driver_locations dl
    JOIN drivers d ON d.id = dl.driver_id
    WHERE ${existingDriverOwnershipCondition(1, 'd')}
    AND dl.deleted_at IS NULL
    ORDER BY dl.recorded_at DESC
    LIMIT 1
  `,
    driverProfileId,
  );
  return rows?.[0] ?? null;
}

/**
 * Where the driver was when a status change happened.
 *
 * Product decision (2026-11): the server's own latest `driver_locations` point
 * wins as long as it is no older than the tracking settings'
 * `staleGpsThresholdSeconds` (the age at which the admin dashboard already
 * treats a driver's GPS as stale/offline). The client-sent point is only the
 * fallback; with neither the result is null.
 *
 * Never throws: a lookup failure is logged and falls back to the client point,
 * so a status change is never blocked by this.
 */
export async function resolveStatusHistoryLocation(
  input: ResolveStatusHistoryLocationInput,
): Promise<StatusHistoryPoint | null> {
  const fallback = parseClientLocation(input.clientLocation);
  if (!input.driverProfileId) return fallback;

  try {
    const [settings, point] = await Promise.all([
      getTrackingSettings(),
      latestDriverPoint(input.driverProfileId),
    ]);
    if (point && isValidPoint(point.latitude, point.longitude)) {
      const nowMs = (input.now ?? new Date()).getTime();
      const ageMs = nowMs - new Date(point.recorded_at).getTime();
      // A phone clock running ahead stamps points in the future; beyond the
      // skew tolerance a negative age would read as fresh forever.
      if (
        ageMs >= -FUTURE_SKEW_TOLERANCE_MS &&
        ageMs <= settings.staleGpsThresholdSeconds * 1000
      ) {
        return { lat: point.latitude, lng: point.longitude };
      }
    }
  } catch (err) {
    realtimeLogger.warn('[order-status-history] driver location lookup failed', {
      eventType: 'order_status_history',
      error: err,
      metadata: { driverProfileId: input.driverProfileId },
    });
  }
  return fallback;
}
