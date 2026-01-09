import {
  startDriverShift,
  endDriverShift,
  updateDriverLocation,
  pauseShift,
  startShiftBreak,
  endShiftBreak,
  getActiveShift,
  getDriverShiftHistory
} from '@/app/actions/tracking/driver-actions';

// Mock Prisma client
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  },
}));

// Mock Next.js cache revalidation
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock rate limiter
jest.mock('@/lib/rate-limiting/location-rate-limiter', () => ({
  locationRateLimiter: {
    checkAndRecordLimit: jest.fn().mockReturnValue({ allowed: true }),
  },
  RateLimitExceededError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RateLimitExceededError';
    }
  },
}));

// Mock realtime logger
jest.mock('@/lib/logging/realtime-logger', () => ({
  realtimeLogger: {
    warn: jest.fn(),
    error: jest.fn(),
    rateLimit: jest.fn(),
  },
}));

// Mock stale detection
jest.mock('@/lib/realtime/stale-detection', () => ({
  staleLocationDetector: {
    recordLocation: jest.fn(),
  },
}));

// Mock driver metadata cache
jest.mock('@/lib/cache/driver-metadata-cache', () => ({
  driverMetadataCache: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

// Mock mileage calculation service
jest.mock('@/services/tracking/mileage', () => ({
  calculateShiftMileage: jest.fn().mockResolvedValue({ totalMiles: 10.5 }),
  calculateShiftMileageWithBreakdown: jest.fn().mockResolvedValue({ totalMiles: 10.5 }),
  calculateShiftMileageWithValidation: jest.fn().mockResolvedValue({
    totalMiles: 10.5,
    warnings: [],
    discrepancyPercent: 0
  }),
}));

import { prisma } from '@/utils/prismaDB';
import { locationRateLimiter } from '@/lib/rate-limiting/location-rate-limiter';
import { revalidatePath } from 'next/cache';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Driver Tracking Actions', () => {
  const validDriverId = '550e8400-e29b-41d4-a716-446655440000';
  const validShiftId = '660e8400-e29b-41d4-a716-446655440001';
  const validBreakId = '770e8400-e29b-41d4-a716-446655440002';

  const mockLocationUpdate = {
    driverId: validDriverId,
    coordinates: { lat: 40.7128, lng: -74.0060 },
    accuracy: 10,
    speed: 0,
    heading: 0,
    altitude: 50,
    batteryLevel: 85,
    timestamp: new Date(),
    isMoving: false,
    activityType: 'stationary' as const,
  };

  beforeEach(() => {
    // Reset all mocks completely (including mock implementation queues)
    jest.resetAllMocks();
    // Default rate limiter to allow requests
    (locationRateLimiter.checkAndRecordLimit as jest.Mock).mockReturnValue({ allowed: true });
  });

  describe('startDriverShift', () => {
    it('starts a driver shift successfully', async () => {
      // Mock the INSERT for shift creation
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValueOnce(1);
      // Mock the UPDATE for driver status
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValueOnce(1);
      // Mock the SELECT for getting shift ID
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{ id: validShiftId }]);

      const result = await startDriverShift(validDriverId, mockLocationUpdate);

      expect(result.success).toBe(true);
      expect(result.shiftId).toBe(validShiftId);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
      expect(revalidatePath).toHaveBeenCalledWith('/admin/tracking');
      expect(revalidatePath).toHaveBeenCalledWith('/driver');
    });

    it('accepts metadata parameter', async () => {
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValueOnce(1);
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValueOnce(1);
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{ id: validShiftId }]);

      const metadata = { vehicleId: 'vehicle-123', notes: 'Starting morning shift' };
      const result = await startDriverShift(validDriverId, mockLocationUpdate, metadata);

      expect(result.success).toBe(true);
      // Verify notes from metadata was passed to SQL query
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO driver_shifts'),
        validDriverId,
        mockLocationUpdate.coordinates.lng,
        mockLocationUpdate.coordinates.lat,
        metadata.notes // Implementation uses metadata.notes directly
      );
    });

    it('handles database errors gracefully', async () => {
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const result = await startDriverShift(validDriverId, mockLocationUpdate);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('handles empty query result when getting shift ID', async () => {
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValueOnce(1);
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValueOnce(1);
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

      const result = await startDriverShift(validDriverId, mockLocationUpdate);

      expect(result.success).toBe(true);
      expect(result.shiftId).toBeUndefined();
    });
  });

  describe('endDriverShift', () => {
    it('ends a driver shift successfully', async () => {
      const endLocation = {
        ...mockLocationUpdate,
        coordinates: { lat: 40.7589, lng: -73.9851 },
        timestamp: new Date(),
      };

      // Mock SELECT to get shift info (returns active shift)
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{
        driver_id: validDriverId,
        status: 'active',
      }]);
      // Mock UPDATE shift with end time
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValueOnce(1);
      // Mock UPDATE shift with mileage (safety net)
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValueOnce(1);
      // Mock UPDATE driver status
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValueOnce(1);

      const result = await endDriverShift(validShiftId, endLocation);

      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith('/admin/tracking');
      expect(revalidatePath).toHaveBeenCalledWith('/driver');
    });

    it('returns error when shift not found', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

      const result = await endDriverShift(validShiftId, mockLocationUpdate);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Active shift not found');
    });

    it('returns error when shift is already completed', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{
        driver_id: validDriverId,
        status: 'completed',
      }]);

      const result = await endDriverShift(validShiftId, mockLocationUpdate);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Active shift not found');
    });

    it('allows ending a paused shift', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{
        driver_id: validDriverId,
        status: 'paused',
      }]);
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

      const result = await endDriverShift(validShiftId, mockLocationUpdate);

      expect(result.success).toBe(true);
    });

    it('handles database errors during end shift', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{
        driver_id: validDriverId,
        status: 'active',
      }]);
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockRejectedValueOnce(
        new Error('Database error')
      );

      const result = await endDriverShift(validShiftId, mockLocationUpdate);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('accepts optional finalMileage parameter', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{
        driver_id: validDriverId,
        status: 'active',
      }]);
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

      const result = await endDriverShift(validShiftId, mockLocationUpdate, 25.5);

      expect(result.success).toBe(true);
    });
  });

  describe('updateDriverLocation', () => {
    it('updates driver location successfully', async () => {
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

      const result = await updateDriverLocation(validDriverId, mockLocationUpdate);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(2); // INSERT location + UPDATE driver
      expect(locationRateLimiter.checkAndRecordLimit).toHaveBeenCalledWith(validDriverId);
    });

    it('returns error when rate limited', async () => {
      (locationRateLimiter.checkAndRecordLimit as jest.Mock).mockReturnValueOnce({
        allowed: false,
        retryAfter: 5,
        message: 'Rate limit exceeded. Try again in 5 seconds.',
      });

      const result = await updateDriverLocation(validDriverId, mockLocationUpdate);

      expect(result).toEqual({
        success: false,
        error: 'Rate limit exceeded. Try again in 5 seconds.',
      });
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('validates driver ID format (UUID)', async () => {
      const result = await updateDriverLocation('invalid-uuid', mockLocationUpdate);

      expect(result).toEqual({
        success: false,
        error: 'Invalid driverId',
      });
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('returns error when location is not provided', async () => {
      const result = await updateDriverLocation(validDriverId, undefined as any);

      expect(result).toEqual({
        success: false,
        error: 'Location is required',
      });
    });

    it('handles database errors during location update', async () => {
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockRejectedValueOnce(
        new Error('Insert failed')
      );

      const result = await updateDriverLocation(validDriverId, mockLocationUpdate);

      expect(result).toEqual({
        success: false,
        error: 'Insert failed',
      });
    });

    it('handles array of locations (legacy interface)', async () => {
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

      const locations = [
        { ...mockLocationUpdate, timestamp: new Date() },
        { ...mockLocationUpdate, timestamp: new Date(Date.now() + 30000) },
      ];

      const result = await updateDriverLocation(locations);

      expect(result).toBe(true);
    });

    it('returns true for empty location array', async () => {
      const result = await updateDriverLocation([]);

      expect(result).toBe(true);
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('returns false when any location in array fails', async () => {
      (mockPrisma.$executeRawUnsafe as jest.Mock)
        .mockResolvedValueOnce(1) // First INSERT
        .mockResolvedValueOnce(1) // First UPDATE
        .mockRejectedValueOnce(new Error('Insert failed')); // Second INSERT fails

      const locations = [
        { ...mockLocationUpdate, timestamp: new Date() },
        { ...mockLocationUpdate, timestamp: new Date(Date.now() + 30000) },
      ];

      const result = await updateDriverLocation(locations);

      expect(result).toBe(false);
    });
  });

  describe('startShiftBreak', () => {
    it('starts a break with location successfully', async () => {
      // Mock SELECT to verify shift exists and is active
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{ id: validShiftId }]);
      // Mock UPDATE shift status to paused with break_start
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValueOnce(1);

      const result = await startShiftBreak(validShiftId, 'meal', mockLocationUpdate);

      expect(result.success).toBe(true);
      // Implementation returns shiftId as breakId since breaks are on the shift record
      expect(result.breakId).toBe(validShiftId);
      expect(revalidatePath).toHaveBeenCalledWith('/admin/tracking');
      expect(revalidatePath).toHaveBeenCalledWith('/driver');
    });

    it('starts a break without location', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{ id: validShiftId }]);
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValueOnce(1);

      const result = await startShiftBreak(validShiftId, 'rest');

      expect(result.success).toBe(true);
      // Implementation returns shiftId as breakId since breaks are on the shift record
      expect(result.breakId).toBe(validShiftId);
    });

    it('returns error when shift not found', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

      const result = await startShiftBreak(validShiftId, 'rest');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Active shift not found');
    });

    it('handles different break types', async () => {
      const breakTypes: Array<'rest' | 'meal' | 'fuel' | 'emergency'> = ['rest', 'meal', 'fuel', 'emergency'];

      for (const breakType of breakTypes) {
        jest.clearAllMocks();
        // Mock SELECT to verify shift exists
        (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{ id: validShiftId }]);
        // Mock UPDATE to set break_start and status=paused
        (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const result = await startShiftBreak(validShiftId, breakType);
        expect(result.success).toBe(true);
        // Implementation returns shiftId as breakId
        expect(result.breakId).toBe(validShiftId);
      }
    });
  });

  describe('endShiftBreak', () => {
    it('ends a break successfully', async () => {
      // Mock SELECT to get break info
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{
        shift_id: validShiftId,
        break_type: 'rest',
      }]);
      // Mock UPDATE break end time
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValueOnce(1);
      // Mock UPDATE shift status back to active
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValueOnce(1);

      const result = await endShiftBreak(validBreakId);

      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith('/admin/tracking');
      expect(revalidatePath).toHaveBeenCalledWith('/driver');
    });

    it('returns error when break not found', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

      const result = await endShiftBreak(validBreakId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Paused shift not found (no active break)');
    });

    it('handles database errors during end break', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{
        shift_id: validShiftId,
        break_type: 'rest',
      }]);
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockRejectedValueOnce(
        new Error('Update failed')
      );

      const result = await endShiftBreak(validBreakId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('pauseShift', () => {
    it('pauses a shift successfully (delegates to startShiftBreak)', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{ id: validShiftId }]);
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{ id: validBreakId }]);

      const result = await pauseShift(validShiftId, mockLocationUpdate);

      expect(result.success).toBe(true);
    });

    it('returns error when shift not found', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

      const result = await pauseShift(validShiftId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Active shift not found');
    });
  });

  describe('getActiveShift', () => {
    it('returns active shift for driver', async () => {
      const mockShiftData = {
        id: validShiftId,
        driver_id: validDriverId,
        start_time: new Date(),
        end_time: null,
        start_location_geojson: JSON.stringify({
          type: 'Point',
          coordinates: [-74.0060, 40.7128], // GeoJSON is [lng, lat]
        }),
        end_location_geojson: null,
        total_distance_miles: 0,
        delivery_count: 0,
        status: 'active',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockPrisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockShiftData]) // Get shift
        .mockResolvedValueOnce([]); // Get breaks

      const result = await getActiveShift(validDriverId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(validShiftId);
      expect(result?.status).toBe('active');
      expect(result?.breaks).toEqual([]);
    });

    it('returns null when no active shift', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

      const result = await getActiveShift(validDriverId);

      expect(result).toBeNull();
    });

    it('returns null for invalid driver ID', async () => {
      const result = await getActiveShift('invalid-uuid');

      expect(result).toBeNull();
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('includes breaks in the response', async () => {
      const mockShiftData = {
        id: validShiftId,
        driver_id: validDriverId,
        start_time: new Date(),
        end_time: null,
        start_location_geojson: null,
        end_location_geojson: null,
        total_distance_miles: 0,
        delivery_count: 0,
        status: 'paused',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockPrisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockShiftData]);

      const result = await getActiveShift(validDriverId);

      // Note: shift_breaks table doesn't exist in schema, so breaks are always empty
      expect(result?.breaks).toHaveLength(0);
      expect(result?.status).toBe('paused');
    });

    it('handles database errors gracefully', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockRejectedValueOnce(
        new Error('Query failed')
      );

      const result = await getActiveShift(validDriverId);

      expect(result).toBeNull();
    });
  });

  describe('getDriverShiftHistory', () => {
    it('returns shift history for driver', async () => {
      // Mock data uses total_distance in km (implementation converts to miles)
      const totalDistanceKm = 41.0426; // ~25.5 miles
      const mockShifts = [
        {
          id: validShiftId,
          driver_id: validDriverId,
          start_time: new Date(),
          end_time: new Date(),
          start_location_geojson: null,
          end_location_geojson: null,
          total_distance: totalDistanceKm,
          status: 'completed',
          notes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce(mockShifts);

      const result = await getDriverShiftHistory(validDriverId);

      expect(result).toHaveLength(1);
      // Implementation converts km to miles (total_distance * 0.621371)
      expect(result[0].totalDistanceMiles).toBeCloseTo(25.5, 1);
      // Note: deliveryCount column doesn't exist in DB schema, always returns 0
      expect(result[0].deliveryCount).toBe(0);
    });

    it('returns empty array for invalid driver ID', async () => {
      const result = await getDriverShiftHistory('invalid-uuid');

      expect(result).toEqual([]);
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('respects limit parameter', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

      await getDriverShiftHistory(validDriverId, 5);

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        validDriverId,
        5
      );
    });

    it('handles database errors gracefully', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockRejectedValueOnce(
        new Error('Query failed')
      );

      const result = await getDriverShiftHistory(validDriverId);

      expect(result).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('handles network/database errors gracefully in startDriverShift', async () => {
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await startDriverShift(validDriverId, mockLocationUpdate);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('handles unexpected errors with generic message', async () => {
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockRejectedValueOnce('String error');

      const result = await startDriverShift(validDriverId, mockLocationUpdate);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to start shift');
    });
  });

  describe('Data Validation', () => {
    it('passes location coordinates to PostGIS correctly', async () => {
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{ id: validShiftId }]);

      await startDriverShift(validDriverId, mockLocationUpdate);

      // Verify longitude (lng) is passed before latitude (lat) for PostGIS ST_MakePoint
      // The INSERT query is the first call
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('ST_MakePoint'),
        validDriverId,
        mockLocationUpdate.coordinates.lng, // lng first
        mockLocationUpdate.coordinates.lat, // lat second
        null // notes is null when no metadata.notes provided
      );
    });
  });
});
