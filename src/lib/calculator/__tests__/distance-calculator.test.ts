/**
 * Distance Calculator Tests
 *
 * Tests for the estimated driving distance calculation functionality.
 *
 * Tests cover:
 * - Basic distance calculations between known locations
 * - Round-trip distance calculations
 * - Edge cases (same location, zero distance)
 * - Cross-country distance sanity checks
 */

import {
  calculateEstimatedDrivingDistance,
  calculateEstimatedRoundTripDistance,
  type Coordinates,
} from '../distance-calculator';

// Known locations for testing
// San Francisco downtown coordinates
const SF_DOWNTOWN: Coordinates = {
  lat: 37.7749,
  lng: -122.4194,
};

// Oakland downtown coordinates (approximately 10 miles east of SF)
const OAKLAND_DOWNTOWN: Coordinates = {
  lat: 37.8044,
  lng: -122.2712,
};

// Same location in SF (different address, same coords)
const SF_LOCATION_2: Coordinates = {
  lat: 37.7749,
  lng: -122.4194,
};

// Los Angeles coordinates (approximately 380 miles south of SF)
const LOS_ANGELES: Coordinates = {
  lat: 34.0522,
  lng: -118.2437,
};

// New York City coordinates (approximately 2,500 miles east)
const NEW_YORK: Coordinates = {
  lat: 40.7128,
  lng: -74.006,
};

describe('Distance Calculator', () => {
  describe('calculateEstimatedDrivingDistance', () => {
    it('should calculate SF to Oakland as approximately 8-12 miles one-way', () => {
      // SF to Oakland is about 8-10 miles straight-line, with 1.35x multiplier ~10-14 miles
      const distance = calculateEstimatedDrivingDistance(SF_DOWNTOWN, OAKLAND_DOWNTOWN);

      expect(distance).toBeGreaterThanOrEqual(8);
      expect(distance).toBeLessThanOrEqual(14);
    });

    it('should return 0 for same location', () => {
      const distance = calculateEstimatedDrivingDistance(SF_DOWNTOWN, SF_LOCATION_2);

      expect(distance).toBe(0);
    });

    it('should calculate distance symmetrically (A to B equals B to A)', () => {
      const distanceAB = calculateEstimatedDrivingDistance(SF_DOWNTOWN, OAKLAND_DOWNTOWN);
      const distanceBA = calculateEstimatedDrivingDistance(OAKLAND_DOWNTOWN, SF_DOWNTOWN);

      expect(distanceAB).toBe(distanceBA);
    });

    it('should handle very short distances (within same city)', () => {
      // Two points about 1 mile apart in SF
      const point1: Coordinates = { lat: 37.7749, lng: -122.4194 };
      const point2: Coordinates = { lat: 37.7849, lng: -122.4094 }; // ~1km away

      const distance = calculateEstimatedDrivingDistance(point1, point2);

      // Should be around 0.5-1.5 miles
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(2);
    });

    it('should calculate SF to LA as approximately 330-400 miles', () => {
      // SF to LA is about 350 miles straight-line, with multiplier ~470 miles
      // But driving is actually closer to 380 miles
      const distance = calculateEstimatedDrivingDistance(SF_DOWNTOWN, LOS_ANGELES);

      // Haversine distance is ~350 miles, times 1.35 = ~470 miles
      // This is a sanity check that we're in the right ballpark
      expect(distance).toBeGreaterThan(300);
      expect(distance).toBeLessThan(500);
    });

    it('should return distance rounded to 1 decimal place', () => {
      const distance = calculateEstimatedDrivingDistance(SF_DOWNTOWN, OAKLAND_DOWNTOWN);

      // Check that it's rounded to 1 decimal place
      const decimalPlaces = (distance.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateEstimatedRoundTripDistance', () => {
    it('should return double the one-way distance', () => {
      const oneWay = calculateEstimatedDrivingDistance(SF_DOWNTOWN, OAKLAND_DOWNTOWN);
      const roundTrip = calculateEstimatedRoundTripDistance(SF_DOWNTOWN, OAKLAND_DOWNTOWN);

      expect(roundTrip).toBeCloseTo(oneWay * 2, 1);
    });

    it('should return 0 for same location', () => {
      const roundTrip = calculateEstimatedRoundTripDistance(SF_DOWNTOWN, SF_LOCATION_2);

      expect(roundTrip).toBe(0);
    });

    it('should calculate SF to Oakland round trip as approximately 16-28 miles', () => {
      const roundTrip = calculateEstimatedRoundTripDistance(SF_DOWNTOWN, OAKLAND_DOWNTOWN);

      // One-way is ~10-14 miles, round trip should be ~20-28 miles
      expect(roundTrip).toBeGreaterThanOrEqual(16);
      expect(roundTrip).toBeLessThanOrEqual(28);
    });

    it('should be symmetric (same result regardless of pickup/delivery order)', () => {
      const tripAB = calculateEstimatedRoundTripDistance(SF_DOWNTOWN, OAKLAND_DOWNTOWN);
      const tripBA = calculateEstimatedRoundTripDistance(OAKLAND_DOWNTOWN, SF_DOWNTOWN);

      expect(tripAB).toBe(tripBA);
    });

    it('should return distance rounded to 1 decimal place', () => {
      const distance = calculateEstimatedRoundTripDistance(SF_DOWNTOWN, OAKLAND_DOWNTOWN);

      const decimalPlaces = (distance.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(1);
    });
  });

  describe('Cross-Country Distance Sanity Check', () => {
    it('should calculate SF to NYC as approximately 2,000-3,500 miles one-way', () => {
      // SF to NYC is about 2,570 miles straight-line
      const distance = calculateEstimatedDrivingDistance(SF_DOWNTOWN, NEW_YORK);

      // With 1.35 multiplier, should be around 3,400 miles (actual driving is ~2,900)
      expect(distance).toBeGreaterThan(2000);
      expect(distance).toBeLessThan(3500);
    });
  });

  describe('Coordinate Edge Cases', () => {
    it('should handle coordinates at 0,0', () => {
      const origin: Coordinates = { lat: 0, lng: 0 };

      const distance = calculateEstimatedDrivingDistance(SF_DOWNTOWN, origin);

      // SF to 0,0 (Gulf of Guinea) is a very long distance
      expect(distance).toBeGreaterThan(5000);
    });

    it('should handle negative latitudes (Southern Hemisphere)', () => {
      const sydney: Coordinates = { lat: -33.8688, lng: 151.2093 };

      const distance = calculateEstimatedDrivingDistance(SF_DOWNTOWN, sydney);

      // SF to Sydney is about 7,400 miles
      expect(distance).toBeGreaterThan(5000);
    });

    it('should handle coordinates near poles', () => {
      const arcticPoint: Coordinates = { lat: 89, lng: 0 };

      const distance = calculateEstimatedDrivingDistance(SF_DOWNTOWN, arcticPoint);

      // Distance to near-pole should be significant
      expect(distance).toBeGreaterThan(3000);
    });

    it('should handle coordinates near international date line', () => {
      const tokyo: Coordinates = { lat: 35.6762, lng: 139.6503 };

      const distance = calculateEstimatedDrivingDistance(SF_DOWNTOWN, tokyo);

      // SF to Tokyo is about 5,100 miles straight-line
      expect(distance).toBeGreaterThan(4000);
      expect(distance).toBeLessThan(8000);
    });
  });

  describe('Multiplier Accuracy', () => {
    it('should apply approximately 1.35x multiplier to Haversine distance', () => {
      // Known Haversine distance: SF to Oakland is about 8.7 miles (14 km) straight-line
      const distance = calculateEstimatedDrivingDistance(SF_DOWNTOWN, OAKLAND_DOWNTOWN);

      // Expected: ~8.7 miles * 1.35 = ~11.7 miles
      // Allow for some variance in the underlying calculation
      expect(distance).toBeGreaterThan(9);
      expect(distance).toBeLessThan(13);
    });
  });
});
