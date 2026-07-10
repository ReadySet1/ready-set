/**
 * Shared unit conversions. Product rule: every user-facing distance is shown
 * in imperial (feet/miles); storage and math stay metric where the consuming
 * code is metric — these helpers convert at the display boundary.
 */

export const METERS_TO_FEET = 3.28084;
export const FEET_PER_MILE = 5280;

export const metersToFeet = (m: number): number => Math.round(m * METERS_TO_FEET);
export const feetToMeters = (ft: number): number => Math.round(ft / METERS_TO_FEET);
