/**
 * Shared unit conversions. Product rule: every user-facing distance is shown
 * in imperial (feet/miles); storage and math stay metric where the consuming
 * code is metric — these helpers convert at the display boundary.
 */

export const METERS_TO_FEET = 3.28084;
export const FEET_PER_MILE = 5280;

export const metersToFeet = (m: number): number => Math.round(m * METERS_TO_FEET);
export const feetToMeters = (ft: number): number => Math.round(ft / METERS_TO_FEET);

/**
 * Format a distance given in miles for display: feet (rounded to 10 ft) under
 * 1,000 ft, otherwise miles with one decimal. Same threshold as geofenceHint.
 */
export function formatMiles(miles: number): string {
  const feet = miles * FEET_PER_MILE;
  return feet >= 1000
    ? `${miles.toFixed(1)} mi`
    : `${Math.round(feet / 10) * 10} ft`;
}
