import { calculateDistance } from '@/utils/distance';

/**
 * Multiplier to estimate driving distance from straight-line (Haversine) distance.
 * Roads typically add ~35% extra distance compared to as-the-crow-flies.
 */
const DRIVING_MULTIPLIER = 1.35;

/**
 * Conversion factor from kilometers to miles.
 */
const KM_TO_MILES = 0.621371;

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Calculates estimated driving distance between two points.
 * Uses Haversine formula for straight-line distance, then applies a multiplier
 * to estimate actual driving distance.
 *
 * @param pickup - Pickup location coordinates
 * @param delivery - Delivery location coordinates
 * @returns Estimated one-way driving distance in miles
 */
export function calculateEstimatedDrivingDistance(
  pickup: Coordinates,
  delivery: Coordinates
): number {
  // Calculate straight-line distance in kilometers
  const straightLineKm = calculateDistance(
    { latitude: pickup.lat, longitude: pickup.lng },
    { latitude: delivery.lat, longitude: delivery.lng }
  );

  // Apply multiplier to estimate driving distance
  const estimatedDrivingKm = straightLineKm * DRIVING_MULTIPLIER;

  // Convert to miles
  const miles = estimatedDrivingKm * KM_TO_MILES;

  // Round to 1 decimal place
  return Math.round(miles * 10) / 10;
}

/**
 * Calculates estimated round-trip driving distance between two points.
 * This is the total distance: to pickup + to delivery + return.
 *
 * @param pickup - Pickup location coordinates
 * @param delivery - Delivery location coordinates
 * @returns Estimated round-trip driving distance in miles
 */
export function calculateEstimatedRoundTripDistance(
  pickup: Coordinates,
  delivery: Coordinates
): number {
  const oneWay = calculateEstimatedDrivingDistance(pickup, delivery);
  // Round trip is approximately 2x the one-way distance
  const roundTrip = oneWay * 2;
  // Round to 1 decimal place
  return Math.round(roundTrip * 10) / 10;
}
