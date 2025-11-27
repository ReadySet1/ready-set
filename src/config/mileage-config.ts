/**
 * Mileage Calculation Configuration
 *
 * All distance values are in MILES (not kilometers).
 * These can be overridden via environment variables for operational flexibility.
 */

/**
 * Meters to miles conversion factor.
 * 1 mile = 1609.344 meters
 */
export const METERS_TO_MILES = 1 / 1609.344;

/**
 * Configuration for mileage calculation thresholds and filters.
 */
export const MILEAGE_CONFIG = {
  /**
   * GPS accuracy threshold in meters.
   * Points with accuracy worse than this are filtered out.
   * Default: 100m (represents ~66% confidence radius)
   */
  GPS_ACCURACY_THRESHOLD_M: Number(process.env.MILEAGE_GPS_ACCURACY_M) || 100,

  /**
   * Maximum reasonable mileage for a single shift in miles.
   * Values exceeding this trigger a warning but are still saved.
   * Default: 310 miles (approximately 500 km, very high for delivery shift)
   */
  MAX_REASONABLE_SHIFT_MILES: Number(process.env.MILEAGE_MAX_SHIFT_MILES) || 310,

  /**
   * Threshold for GPS filter rate warnings.
   * If more than this percentage of GPS points are filtered out, log a warning.
   * Default: 0.5 (50%)
   */
  HIGH_FILTER_RATE_THRESHOLD: Number(process.env.MILEAGE_HIGH_FILTER_RATE) || 0.5,

  /**
   * Maximum effective speed in mph to filter GPS glitches.
   * Segments exceeding this speed are dropped.
   * Default: 95 mph (approximately 150 km/h)
   */
  MAX_SPEED_MPH: Number(process.env.MILEAGE_MAX_SPEED_MPH) || 95,

  /**
   * Threshold for per-delivery breakdown deviation from total.
   * If sum of per-delivery distances differs from total by more than this, log a warning.
   * Default: 0.2 (20%)
   */
  BREAKDOWN_DEVIATION_THRESHOLD: Number(process.env.MILEAGE_DEVIATION_THRESHOLD) || 0.2,

  /**
   * Threshold for client-reported mileage discrepancy warning.
   * If client value differs from GPS by more than this percentage, log a warning.
   * Default: 0.1 (10%)
   */
  CLIENT_DISCREPANCY_WARN_THRESHOLD: Number(process.env.MILEAGE_DISCREPANCY_WARN) || 0.1,

  /**
   * Minimum speed in m/s to consider a point as "moving".
   * Points below this speed are filtered as stationary.
   * Default: 0.5 m/s (~1.1 mph)
   */
  MIN_MOVING_SPEED_MS: Number(process.env.MILEAGE_MIN_SPEED_MS) || 0.5,

  /**
   * Maximum single segment distance in miles to filter outliers.
   * Segments longer than this in a short time are dropped as GPS glitches.
   * Default: 3.1 miles (approximately 5 km)
   */
  MAX_SEGMENT_DISTANCE_MILES: Number(process.env.MILEAGE_MAX_SEGMENT_MILES) || 3.1,

  /**
   * Minimum time delta in seconds for outlier detection.
   * Default: 30 seconds
   */
  OUTLIER_MIN_TIME_DELTA_SECONDS: Number(process.env.MILEAGE_OUTLIER_TIME_DELTA) || 30,
} as const;

/**
 * Convert meters per second to miles per hour
 */
export function msToMph(metersPerSecond: number): number {
  return metersPerSecond * 2.23694;
}

/**
 * Convert miles per hour to meters per second
 */
export function mphToMs(milesPerHour: number): number {
  return milesPerHour / 2.23694;
}

/**
 * Convert meters to miles
 */
export function metersToMiles(meters: number): number {
  return meters * METERS_TO_MILES;
}

/**
 * Convert miles to meters
 */
export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}
