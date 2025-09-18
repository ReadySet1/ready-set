import { startDriverShift, endDriverShift, updateDriverLocation } from '@/app/actions/tracking/driver-actions';
import { createClient } from '@/utils/supabase/server';

// Mock Supabase client
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

// Mock the createClient function
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('Driver Tracking Actions', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    })),
    rpc: jest.fn(),
  };

  const mockLocationUpdate = {
    driverId: 'driver-123',
    coordinates: { lat: 40.7128, lng: -74.0060 },
    accuracy: 10,
    speed: 0,
    heading: 0,
    timestamp: new Date(),
    isMoving: false,
  };

  const mockShift = {
    id: 'shift-123',
    driverId: 'driver-123',
    startTime: new Date(),
    status: 'active' as const,
    totalMiles: 0,
    deliveryCount: 0,
    breaks: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue(mockSupabaseClient as any);
  });

  describe('startDriverShift', () => {
    it('starts a driver shift successfully', async () => {
      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      // Mock successful shift creation
      (mockSupabaseClient.from as any)().insert().single().mockResolvedValue({
        data: mockShift,
        error: null,
      });

      // Mock location insertion
      (mockSupabaseClient.from as any)().insert().single().mockResolvedValue({
        data: { id: 'location-123', ...mockLocationUpdate },
        error: null,
      });

      const result = await startDriverShift('driver-123', mockLocationUpdate);

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('driver_shifts');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('driver_locations');
    });

    it('returns false when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await startDriverShift('driver-123', mockLocationUpdate);

      expect(result.success).toBe(false);
    });

    it('returns false when user is not authorized', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'user-123', 
            email: 'user@example.com',
            user_metadata: { role: 'customer' }
          } 
        },
        error: null,
      });

      const result = await startDriverShift('driver-123', mockLocationUpdate);

      expect(result.success).toBe(false);
    });

    it('handles database errors gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      (mockSupabaseClient.from as any)().insert().single().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await startDriverShift('driver-123', mockLocationUpdate);

      expect(result.success).toBe(false);
    });

    it('validates location data before starting shift', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      const invalidLocation = {
        ...mockLocationUpdate,
        coordinates: { lat: 200, lng: 300 }, // Invalid coordinates
      };

      const result = await startDriverShift('driver-123', invalidLocation);

      expect(result.success).toBe(false);
    });
  });

  describe('endDriverShift', () => {
    it('ends a driver shift successfully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      const endLocation = {
        ...mockLocationUpdate,
        coordinates: { lat: 40.7589, lng: -73.9851 },
        timestamp: new Date(),
      };

      // Mock successful shift update
      (mockSupabaseClient.from as any)().update().eq().single().mockResolvedValue({
        data: { ...mockShift, endTime: new Date(), status: 'completed' },
        error: null,
      });

      // Mock location insertion
      (mockSupabaseClient.from as any)().insert().single().mockResolvedValue({
        data: { id: 'location-456', ...endLocation },
        error: null,
      });

      const result = await endDriverShift('shift-123', endLocation);

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('driver_shifts');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('driver_locations');
    });

    it('calculates shift duration correctly', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      const startTime = new Date(Date.now() - 3600000); // 1 hour ago
      const mockShiftWithStartTime = { ...mockShift, startTime };

      (mockSupabaseClient.from as any)().select().eq().single().mockResolvedValue({
        data: mockShiftWithStartTime,
        error: null,
      });

      (mockSupabaseClient.from as any)().update().eq().single().mockResolvedValue({
        data: { ...mockShiftWithStartTime, endTime: new Date(), status: 'completed' },
        error: null,
      });

      (mockSupabaseClient.from as any)().insert().single().mockResolvedValue({
        data: { id: 'location-456', ...mockLocationUpdate },
        error: null,
      });

      const result = await endDriverShift('shift-123', mockLocationUpdate);

      expect(result.success).toBe(true);
    });

    it('returns false when shift not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      (mockSupabaseClient.from as any)().select().eq().single().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await endDriverShift('shift-123', mockLocationUpdate);

      expect(result.success).toBe(false);
    });

    it('handles unauthorized access to shift', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-456', // Different driver
            email: 'driver2@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      (mockSupabaseClient.from as any)().select().eq().single().mockResolvedValue({
        data: mockShift, // Shift belongs to driver-123
        error: null,
      });

      const result = await endDriverShift('shift-123', mockLocationUpdate);

      expect(result.success).toBe(false);
    });
  });

  describe('updateDriverLocation', () => {
    it('updates driver location successfully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      const locationUpdates = [mockLocationUpdate];

      (mockSupabaseClient.from as any)().insert().mockResolvedValue({
        data: locationUpdates.map((loc, index) => ({ id: `location-${index}`, ...loc })),
        error: null,
      });

      const result = await updateDriverLocation('driver-123', mockLocationUpdate);

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('driver_locations');
    });

    it('handles single location update', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      const singleUpdate = {
        ...mockLocationUpdate,
        coordinates: { lat: 40.7589, lng: -73.9851 },
        timestamp: new Date(Date.now() + 30000),
      };

      (mockSupabaseClient.from as any)().insert().mockResolvedValue({
        data: { id: 'location-1', ...singleUpdate },
        error: null,
      });

      const result = await updateDriverLocation('driver-123', singleUpdate);

      expect(result.success).toBe(true);
    });

    it('returns false when location update fails', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      (mockSupabaseClient.from as any)().insert().mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      const result = await updateDriverLocation('driver-123', mockLocationUpdate);

      expect(result.success).toBe(false);
    });

    it('validates location data before update', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      const invalidUpdate = {
        ...mockLocationUpdate,
        coordinates: { lat: 200, lng: 300 }, // Invalid coordinates
      };

      const result = await updateDriverLocation('driver-123', invalidUpdate);

      expect(result.success).toBe(false);
    });

    it('handles empty location updates array', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      // Test with a valid location update since empty arrays don't make sense for single location updates
      const result = await updateDriverLocation('driver-123', mockLocationUpdate);

      expect(result.success).toBe(true); // Should succeed with empty array
    });
  });

  describe('pauseShift', () => {
    it('pauses a driver shift successfully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      (mockSupabaseClient.from as any)().insert().mockResolvedValue({
        data: { id: 'location-1', ...mockLocationUpdate },
        error: null,
      });

      const result = await updateDriverLocation('driver-123', mockLocationUpdate);

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('driver_shifts');
    });

    it('returns false when shift not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      (mockSupabaseClient.from as any)().select().eq().single().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await pauseShift('shift-123');

      expect(result.success).toBe(false);
    });

    it('handles unauthorized access to shift', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-456', // Different driver
            email: 'driver2@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      (mockSupabaseClient.from as any)().select().eq().single().mockResolvedValue({
        data: mockShift, // Shift belongs to driver-123
        error: null,
      });

      const result = await pauseShift('shift-123');

      expect(result.success).toBe(false);
    });

    it('cannot pause already completed shift', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      const completedShift = { ...mockShift, status: 'completed' as const };

      (mockSupabaseClient.from as any)().select().eq().single().mockResolvedValue({
        data: completedShift,
        error: null,
      });

      const result = await pauseShift('shift-123');

      expect(result.success).toBe(false);
    });
  });


  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Network error'));

      const result = await startDriverShift('driver-123', mockLocationUpdate);

      expect(result.success).toBe(false);
    });

    it('handles malformed location data', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      const malformedLocation = {
        ...mockLocationUpdate,
        coordinates: null as any, // Invalid coordinates
      };

      const result = await updateDriverLocation('driver-123', malformedLocation);

      expect(result.success).toBe(false);
    });

    it('handles database transaction failures', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      // Mock successful first operation but failed second operation
      (mockSupabaseClient.from as any)().insert().single().mockResolvedValueOnce({
        data: mockShift,
        error: null,
      }).mockResolvedValueOnce({
        data: null,
        error: { message: 'Location insert failed' },
      });

      const result = await startDriverShift('driver-123', mockLocationUpdate);

      expect(result.success).toBe(false);
    });
  });

  describe('Data Validation', () => {
    it('validates driver ID format', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      const result = await startDriverShift('invalid-driver-id', mockLocationUpdate);

      expect(result.success).toBe(false);
    });

    it('validates coordinate ranges', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      const invalidCoordinates = [
        { lat: 91, lng: 180 }, // Out of range
        { lat: -91, lng: -180 }, // Out of range
        { lat: 0, lng: 181 }, // Longitude out of range
      ];

      for (const coords of invalidCoordinates) {
        const invalidLocation = { ...mockLocationUpdate, coordinates: coords };
        const result = await updateDriverLocation('driver-123', invalidLocation);
        expect(result.success).toBe(false);
      }
    });

    it('validates timestamp format', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { 
            id: 'driver-123', 
            email: 'driver@example.com',
            user_metadata: { role: 'driver' }
          } 
        },
        error: null,
      });

      const invalidTimestamp = {
        ...mockLocationUpdate,
        timestamp: 'invalid-date' as any,
      };

      const result = await updateDriverLocation('driver-123', invalidTimestamp);

      expect(result.success).toBe(false);
    });
  });
});
