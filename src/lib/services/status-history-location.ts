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
      if (ageMs <= settings.staleGpsThresholdSeconds * 1000) {
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
