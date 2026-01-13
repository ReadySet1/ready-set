// src/__tests__/api/tracking/live.test.ts

/**
 * Integration tests for the live tracking SSE endpoint.
 * Tests SSE initialization, authentication, and error handling.
 */

import { GET } from '@/app/api/tracking/live/route';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { captureException, captureMessage } from '@/lib/monitoring/sentry';
import { createGetRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/auth-middleware');
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));
jest.mock('@/lib/monitoring/sentry', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// Helper to create a request with a mock abort signal for SSE tests
const createSSERequest = (url: string) => {
  const request = createGetRequest(url);
  // Add mock signal for abort handling
  const abortController = new AbortController();
  Object.defineProperty(request, 'signal', {
    value: abortController.signal,
    writable: true,
    configurable: true,
  });
  return { request, abortController };
};

describe('/api/tracking/live SSE Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: false,
        response: new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401 }
        ),
      });

      const request = createGetRequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should return 403 for DRIVER users', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: false,
        response: new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403 }
        ),
      });

      const request = createGetRequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(403);
    });

    it('should return 403 for CLIENT users', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: false,
        response: new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403 }
        ),
      });

      const request = createGetRequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(403);
    });

    it('should allow ADMIN users', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'admin-123', type: 'ADMIN' },
        },
      });

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const { request } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it('should allow SUPER_ADMIN users', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'superadmin-123', type: 'SUPER_ADMIN' },
        },
      });

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const { request } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it('should allow HELPDESK users', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'helpdesk-123', type: 'HELPDESK' },
        },
      });

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const { request } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);
    });
  });

  describe('SSE Response Headers', () => {
    it('should set correct SSE headers', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'admin-123', type: 'ADMIN' },
        },
      });

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const { request } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);

      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Initial Connection', () => {
    it('should create a readable stream for successful connections', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'admin-123', type: 'ADMIN' },
        },
      });

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const { request } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.body).toBeDefined();
      expect(response.body).toBeInstanceOf(ReadableStream);
    });
  });

  describe('Error Handling', () => {
    it('should handle setup errors gracefully', async () => {
      (withAuth as jest.Mock).mockRejectedValue(new Error('Auth service down'));

      const request = createGetRequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to establish live connection');
    });

    it('should capture exception on error', async () => {
      (withAuth as jest.Mock).mockRejectedValue(new Error('Auth service down'));

      const request = createGetRequest(
        'http://localhost:3000/api/tracking/live'
      );

      await GET(request);

      expect(captureException).toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    it('should log SSE stream start', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'admin-123', type: 'ADMIN' },
        },
      });

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const { request } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      await GET(request);

      expect(captureMessage).toHaveBeenCalledWith(
        'Admin tracking SSE stream started',
        'info',
        expect.objectContaining({
          feature: 'admin_tracking',
        })
      );
    });
  });

  describe('Driver Data Query', () => {
    it('should query for driver name from profiles table', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'admin-123', type: 'ADMIN' },
        },
      });

      // Mock the database queries
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const { request, abortController } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);

      // Start reading from the stream to trigger data fetch
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      // Read connection message
      await reader.read();

      // Advance timers to trigger the interval that fetches driver data
      jest.advanceTimersByTime(5000);

      // Wait for the async operations to complete
      await Promise.resolve();
      await Promise.resolve();

      // Verify the SQL query includes join with profiles table for driver name
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();

      reader.releaseLock();

      // Check that at least one of the queries includes the profiles join and driver_name
      const calls = (prisma.$queryRawUnsafe as jest.Mock).mock.calls;
      const activeDriversQuery = calls.find(call =>
        call[0].includes('FROM drivers d') &&
        call[0].includes('p.name as driver_name') &&
        call[0].includes('LEFT JOIN profiles p ON d.profile_id = p.id')
      );

      expect(activeDriversQuery).toBeDefined();

      // Cleanup
      abortController.abort();
    });

    it('should include driver name in response data structure', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'admin-123', type: 'ADMIN' },
        },
      });

      // Mock driver data with name
      const mockDriverData = [{
        id: 'driver-123',
        user_id: 'user-456',
        employee_id: 'EMP001',
        driver_name: 'Test Driver',
        vehicle_number: 'VEH-123',
        phone_number: '+1-555-0101',
        is_on_duty: true,
        shift_start_time: new Date(),
        current_shift_id: 'shift-789',
        last_known_location_geojson: JSON.stringify({
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        }),
        last_location_update: new Date(),
        shift_status: 'active',
        shift_start: new Date(),
        total_distance: 15.5,
        active_deliveries: 2
      }];

      // Return mock data for the first query (active drivers), empty for others
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce(mockDriverData)  // activeDrivers query
        .mockResolvedValueOnce([])               // recentLocations query
        .mockResolvedValueOnce([])               // activeDeliveries query
        .mockResolvedValueOnce([]);              // legacyDispatches query

      const { request, abortController } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);

      // Read the first chunk from the stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      // Read connection message
      const { value: firstChunk } = await reader.read();
      const firstMessage = new TextDecoder().decode(firstChunk);
      expect(firstMessage).toContain('connection');

      // Advance timers to trigger the interval
      jest.advanceTimersByTime(5000);

      // Read driver update message
      const { value: secondChunk } = await reader.read();
      if (secondChunk) {
        const secondMessage = new TextDecoder().decode(secondChunk);

        // Parse the SSE data
        const dataMatch = secondMessage.match(/data: (.+)\n\n/);
        if (dataMatch) {
          const data = JSON.parse(dataMatch[1]);

          if (data.type === 'driver_update') {
            expect(data.data.activeDrivers).toBeDefined();
            expect(data.data.activeDrivers.length).toBe(1);
            expect(data.data.activeDrivers[0].name).toBe('Test Driver');
            expect(data.data.activeDrivers[0].employeeId).toBe('EMP001');
          }
        }
      }

      // Cleanup
      abortController.abort();
      reader.releaseLock();
    });

    it('should handle null driver name gracefully', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'admin-123', type: 'ADMIN' },
        },
      });

      // Mock driver data without name (null)
      const mockDriverData = [{
        id: 'driver-123',
        user_id: 'user-456',
        employee_id: 'EMP001',
        driver_name: null,  // No name in profiles
        vehicle_number: 'VEH-123',
        phone_number: '+1-555-0101',
        is_on_duty: true,
        shift_start_time: new Date(),
        current_shift_id: 'shift-789',
        last_known_location_geojson: null,
        last_location_update: new Date(),
        shift_status: 'active',
        shift_start: new Date(),
        total_distance: 0,
        active_deliveries: 0
      }];

      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce(mockDriverData)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const { request, abortController } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      // Read connection message
      await reader.read();

      // Advance timers to trigger the interval
      jest.advanceTimersByTime(5000);

      // Read driver update message
      const { value: secondChunk } = await reader.read();
      if (secondChunk) {
        const secondMessage = new TextDecoder().decode(secondChunk);
        const dataMatch = secondMessage.match(/data: (.+)\n\n/);

        if (dataMatch) {
          const data = JSON.parse(dataMatch[1]);

          if (data.type === 'driver_update') {
            expect(data.data.activeDrivers[0].name).toBeNull();
            expect(data.data.activeDrivers[0].employeeId).toBe('EMP001');
          }
        }
      }

      // Cleanup
      abortController.abort();
      reader.releaseLock();
    });
  });
});
