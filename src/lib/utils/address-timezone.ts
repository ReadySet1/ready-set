import { TIMEZONE_CONFIG } from '@/lib/config/timezone';
import { reinterpretWallClock } from '@/lib/utils/timezone';

/**
 * Per-location timezone resolution.
 *
 * `addresses.state` is dirty free text on prod ("CALIFORNIA (95054)",
 * "CAIFORNIA", "SAN FRANCISCO"), so the zone is derived from the ZIP prefix,
 * then from coordinates, and finally falls back to the app default. A stored
 * `addresses.timezone` always wins so it can act as a manual override.
 *
 * Design note: docs/ready-set/specs/2026-10-15-order-timezone-per-location.md
 */

export const US_TIMEZONES = {
  PACIFIC: 'America/Los_Angeles',
  MOUNTAIN: 'America/Denver',
  CENTRAL: 'America/Chicago',
  EASTERN: 'America/New_York',
} as const;

type ZipRange = { from: number; to: number; timezone: string };

/**
 * Three-digit ZIP prefix ranges, inclusive. Order matters only where ranges
 * overlap, which they do not. Add a state by appending a line; keep the El
 * Paso exception ahead of any broader Texas range you add later.
 *
 * Sources: USPS ZIP prefix allocation per state; TX Mountain-time counties
 * (El Paso, Hudspeth) use prefixes 798, 799 and 885.
 */
export const ZIP_PREFIX_TIMEZONES: readonly ZipRange[] = [
  // California
  { from: 900, to: 961, timezone: US_TIMEZONES.PACIFIC },
  // Texas: El Paso / Hudspeth corner (Mountain) first, then the rest (Central)
  { from: 798, to: 799, timezone: US_TIMEZONES.MOUNTAIN },
  { from: 885, to: 885, timezone: US_TIMEZONES.MOUNTAIN },
  { from: 750, to: 797, timezone: US_TIMEZONES.CENTRAL },
  // Georgia
  { from: 300, to: 319, timezone: US_TIMEZONES.EASTERN },
  { from: 398, to: 399, timezone: US_TIMEZONES.EASTERN },
];

const ZIP5_RE = /^(\d{5})(?:-\d{4})?$/;

/** IANA zone for a US ZIP (5 digits or ZIP+4), or null when the prefix is unknown. */
export function timezoneFromZip(zip: string | null | undefined): string | null {
  if (!zip) return null;
  const match = ZIP5_RE.exec(zip.trim());
  if (!match || !match[1]) return null;
  const prefix = Number(match[1].slice(0, 3));
  const range = ZIP_PREFIX_TIMEZONES.find((r) => prefix >= r.from && prefix <= r.to);
  return range?.timezone ?? null;
}

/**
 * Coarse CONUS longitude bands. Approximate on purpose: it is only the
 * fallback for ZIPs the table does not know, and the boundaries follow the
 * meridians closest to the real zone borders.
 */
const CONUS_LAT = { min: 24.0, max: 49.5 };
const CONUS_LNG = { min: -125.0, max: -66.5 };
const LNG_BANDS: readonly { eastOf: number; timezone: string }[] = [
  { eastOf: -85.0, timezone: US_TIMEZONES.EASTERN },
  { eastOf: -102.0, timezone: US_TIMEZONES.CENTRAL },
  { eastOf: -114.0, timezone: US_TIMEZONES.MOUNTAIN },
  { eastOf: CONUS_LNG.min, timezone: US_TIMEZONES.PACIFIC },
];

export function timezoneFromCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < CONUS_LAT.min || latitude > CONUS_LAT.max) return null;
  if (longitude < CONUS_LNG.min || longitude > CONUS_LNG.max) return null;
  const band = LNG_BANDS.find((b) => longitude >= b.eastOf);
  return band?.timezone ?? null;
}

export interface AddressTimezoneSource {
  timezone?: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * The zone to store on a new or updated address: ZIP first, coordinates second,
 * null when nothing matches (resolution falls back at read time).
 */
export function deriveAddressTimezone(
  address: Pick<AddressTimezoneSource, 'zip' | 'latitude' | 'longitude'> | null | undefined,
): string | null {
  if (!address) return null;
  return timezoneFromZip(address.zip) ?? timezoneFromCoordinates(address.latitude, address.longitude);
}

/** The zone an address is in, never null: stored → ZIP → coordinates → app default. */
export function resolveAddressTimezone(
  address: AddressTimezoneSource | null | undefined,
): string {
  if (!address) return TIMEZONE_CONFIG.LOCAL_TIMEZONE;
  const stored = address.timezone?.trim();
  if (stored) return stored;
  return deriveAddressTimezone(address) ?? TIMEZONE_CONFIG.LOCAL_TIMEZONE;
}

export interface OrderTimezoneSource {
  pickupAddress?: AddressTimezoneSource | null;
}

/**
 * The zone an order's times are entered and displayed in: the pickup address
 * zone. Pickup, not delivery, because that is what the restaurant and the
 * driver act on; cross-zone orders are not a live scenario.
 */
export function orderTimezone(order: OrderTimezoneSource | null | undefined): string {
  return resolveAddressTimezone(order?.pickupAddress);
}

const US_ABBREVIATIONS: Record<string, string> = {
  [US_TIMEZONES.PACIFIC]: 'PT',
  [US_TIMEZONES.MOUNTAIN]: 'MT',
  [US_TIMEZONES.CENTRAL]: 'CT',
  [US_TIMEZONES.EASTERN]: 'ET',
};

/**
 * Short label for a zone: "PT" / "CT" for the US zones we operate in, the
 * Intl short name ("GMT+9") for anything else.
 */
export function timezoneAbbreviation(timeZone: string, at: Date = new Date()): string {
  const known = US_ABBREVIATIONS[timeZone];
  if (known) return known;
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName');
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

const ORDER_TIME_FIELDS = ['pickupDateTime', 'arrivalDateTime', 'completeDateTime'] as const;
type OrderTimeField = (typeof ORDER_TIME_FIELDS)[number];

/**
 * Re-read an order payload's times in its pickup address zone.
 *
 * The create-order pickers build their Dates from the browser clock, so the
 * local fields of each Date are the wall-clock the admin typed. Re-interpreting
 * them in the order zone stores "11:00 for Austin" as 11:00 Central regardless
 * of where the admin sits. Fields that are absent, null or not Dates are left
 * untouched and no new keys are added.
 */
export function orderTimesInPickupZone<
  T extends OrderTimezoneSource & Partial<Record<OrderTimeField, Date | null | undefined>>,
>(values: T): T {
  const zone = orderTimezone(values);
  const out: T = { ...values };
  for (const field of ORDER_TIME_FIELDS) {
    const value = values[field];
    if (value instanceof Date) {
      (out as Record<OrderTimeField, Date | null | undefined>)[field] = reinterpretWallClock(value, zone);
    }
  }
  return out;
}
