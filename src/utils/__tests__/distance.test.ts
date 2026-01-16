import { getCenterCoordinate, calculateDistance } from '../distance';

describe('distance', () => {
  describe('getCenterCoordinate', () => {
    it('should return the same coordinate for single point', () => {
      const coords = [{ latitude: 30.0, longitude: -97.0 }];
      const center = getCenterCoordinate(coords);

      expect(center.latitude).toBe(30.0);
      expect(center.longitude).toBe(-97.0);
    });

    it('should calculate center of two points', () => {
      const coords = [
        { latitude: 30.0, longitude: -97.0 },
        { latitude: 32.0, longitude: -99.0 },
      ];
      const center = getCenterCoordinate(coords);

      expect(center.latitude).toBe(31.0);
      expect(center.longitude).toBe(-98.0);
    });

    it('should calculate center of multiple points', () => {
      const coords = [
        { latitude: 30.0, longitude: -97.0 },
        { latitude: 31.0, longitude: -98.0 },
        { latitude: 32.0, longitude: -99.0 },
      ];
      const center = getCenterCoordinate(coords);

      expect(center.latitude).toBe(31.0);
      expect(center.longitude).toBe(-98.0);
    });

    it('should handle negative coordinates', () => {
      const coords = [
        { latitude: -30.0, longitude: -97.0 },
        { latitude: -32.0, longitude: -99.0 },
      ];
      const center = getCenterCoordinate(coords);

      expect(center.latitude).toBe(-31.0);
      expect(center.longitude).toBe(-98.0);
    });

    it('should handle coordinates at origin', () => {
      const coords = [
        { latitude: 10.0, longitude: 10.0 },
        { latitude: -10.0, longitude: -10.0 },
      ];
      const center = getCenterCoordinate(coords);

      expect(center.latitude).toBe(0);
      expect(center.longitude).toBe(0);
    });

    it('should throw error for empty array', () => {
      expect(() => getCenterCoordinate([])).toThrow('No coordinates provided');
    });
  });

  describe('calculateDistance', () => {
    it('should return 0 for same coordinates', () => {
      const coord = { latitude: 30.2672, longitude: -97.7431 };
      const distance = calculateDistance(coord, coord);

      expect(distance).toBe(0);
    });

    it('should calculate distance between two cities (Austin to Dallas)', () => {
      const austin = { latitude: 30.2672, longitude: -97.7431 };
      const dallas = { latitude: 32.7767, longitude: -96.7970 };
      const distance = calculateDistance(austin, dallas);

      // Distance is approximately 290 km
      expect(distance).toBeGreaterThan(280);
      expect(distance).toBeLessThan(300);
    });

    it('should calculate distance between two cities (New York to Los Angeles)', () => {
      const newYork = { latitude: 40.7128, longitude: -74.0060 };
      const losAngeles = { latitude: 34.0522, longitude: -118.2437 };
      const distance = calculateDistance(newYork, losAngeles);

      // Distance is approximately 3940 km
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });

    it('should calculate short distances accurately', () => {
      const point1 = { latitude: 30.2672, longitude: -97.7431 };
      const point2 = { latitude: 30.2682, longitude: -97.7441 }; // Very close point
      const distance = calculateDistance(point1, point2);

      // Should be less than 1 km
      expect(distance).toBeLessThan(1);
      expect(distance).toBeGreaterThan(0);
    });

    it('should handle coordinates crossing the equator', () => {
      const north = { latitude: 10.0, longitude: -97.0 };
      const south = { latitude: -10.0, longitude: -97.0 };
      const distance = calculateDistance(north, south);

      // Distance should be approximately 2222 km (20 degrees latitude)
      expect(distance).toBeGreaterThan(2200);
      expect(distance).toBeLessThan(2250);
    });

    it('should handle coordinates crossing the prime meridian', () => {
      const west = { latitude: 51.5074, longitude: -10.0 };
      const east = { latitude: 51.5074, longitude: 10.0 };
      const distance = calculateDistance(west, east);

      // Distance should be approximately 1385 km
      expect(distance).toBeGreaterThan(1300);
      expect(distance).toBeLessThan(1450);
    });

    it('should be symmetric (distance A to B equals B to A)', () => {
      const austin = { latitude: 30.2672, longitude: -97.7431 };
      const dallas = { latitude: 32.7767, longitude: -96.7970 };

      const distanceAB = calculateDistance(austin, dallas);
      const distanceBA = calculateDistance(dallas, austin);

      expect(distanceAB).toBeCloseTo(distanceBA, 10);
    });
  });
});
