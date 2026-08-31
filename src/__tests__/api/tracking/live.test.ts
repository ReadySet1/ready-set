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
jest.mock('@/services/tracking/tracking-settings', () => ({
  getTrackingSettings: jest.fn().mockResolvedValue({
    mileageGpsAccuracyThresholdM: 100,
    mileageMaxSpeedMph: 95,
  }),
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

  /**
   * Drive one SSE tick and return the parsed `driver_update` payload.
   * Query order: activeDrivers, recentLocations, activeDeliveries,
   * legacyDispatches, shiftTrailPoints.
   */
  async function readDriverUpdate(queryResults: unknown[][]) {
    (withAuth as jest.Mock).mockResolvedValue({
      success: true,
      context: { user: { id: 'admin-123', type: 'ADMIN' } },
    });
    const mock = prisma.$queryRawUnsafe as jest.Mock;
    mock.mockReset();
    for (const result of queryResults) mock.mockResolvedValueOnce(result);
    mock.mockResolvedValue([]);

    const { request, abortController } = createSSERequest(
      'http://localhost:3000/api/tracking/live'
    );
    const response = await GET(request);
    const reader = response.body!.getReader();
    await reader.read(); // connection message
    // Fire the 5 s tick and let its awaited queries settle before reading.
    await jest.advanceTimersByTimeAsync(5000);
    const { value } = await reader.read();
    abortController.abort();
    reader.releaseLock();

    const message = new TextDecoder().decode(value);
    const dataMatch = message.match(/data: (.+)\n\n/);
    const data = JSON.parse(dataMatch![1]!);
    expect(data.type).toBe('driver_update');
    return { data: data.data, calls: mock.mock.calls as string[][] };
  }

  describe('Active deliveries scope (finding #2)', () => {
    it('only counts non-terminal deliveries of on-shift drivers or assigned today', async () => {
      const { calls } = await readDriverUpdate([[], [], [], [], []]);

      const deliveriesQuery = calls.find(
        (call) => call[0]!.includes('FROM deliveries d') && call[0]!.includes('d.order_number')
      );
      expect(deliveriesQuery).toBeDefined();
      const sql = deliveriesQuery![0]!;

      // Status casing is mixed in the DB ('CANCELLED', 'completed', 'DELIVERED')
      expect(sql).toMatch(/LOWER\(d\.status\) NOT IN \('delivered',\s*'cancelled',\s*'completed'\)/);
      // Scoped to the driver's current active shift or to deliveries assigned today
      expect(sql).toContain('driver_shifts');
      expect(sql).toMatch(/d\.assigned_at >= CURRENT_DATE/);
      expect(sql).toContain('d.deleted_at IS NULL');
    });

    it('scopes the per-driver activeDeliveries counter the same way', async () => {
      const { calls } = await readDriverUpdate([[], [], [], [], []]);
      const driversQuery = calls.find((call) => call[0]!.includes('FROM drivers d'));
      const sql = driversQuery![0]!;

      expect(sql).toMatch(/LOWER\(del\.status\) NOT IN \('delivered',\s*'cancelled',\s*'completed'\)/);
      expect(sql).toMatch(/del\.assigned_at >= /);
    });
  });

  describe('Driver shift stats (finding #3)', () => {
    const baseRow = {
      id: 'driver-123',
      user_id: 'user-456',
      employee_id: 'EMP001',
      driver_name: 'Fernando',
      vehicle_number: null,
      phone_number: null,
      is_on_duty: true,
      shift_start_time: new Date('2026-08-21T18:40:00Z'),
      current_shift_id: 'shift-5bae9262',
      last_known_location_geojson: JSON.stringify({ type: 'Point', coordinates: [-101.68, 21.12] }),
      last_location_update: new Date('2026-08-21T19:17:00Z'),
      shift_status: 'active',
      shift_start: new Date('2026-08-21T18:40:00Z'),
      total_distance: null,
      total_distance_miles: null,
      gps_distance_miles: null,
      delivery_count: 0,
      active_deliveries: 1,
    };

    // ~1 km walk north at 10 s cadence, 100 m per ping
    const trail = Array.from({ length: 11 }, (_, i) => ({
      driver_id: 'driver-123',
      latitude: 21.12 + i * 0.0009,
      longitude: -101.68,
      recorded_at: new Date(Date.UTC(2026, 7, 21, 18, 50, i * 10)),
    }));

    it('derives totalDistanceMiles from the live GPS trail while the shift is open', async () => {
      const { data } = await readDriverUpdate([[baseRow], [], [], [], trail]);

      const driver = data.activeDrivers[0];
      expect(driver.totalDistanceMiles).toBeGreaterThan(0.55);
      expect(driver.totalDistanceMiles).toBeLessThan(0.7);
    });

    it('queries the trail only for active shifts with the accuracy gate and soft-delete filter', async () => {
      const { calls } = await readDriverUpdate([[baseRow], [], [], [], trail]);
      const trailQuery = calls.find((call) => call[0]!.includes('JOIN driver_locations dl') && call[0]!.includes('dl.latitude'));
      expect(trailQuery).toBeDefined();
      const sql = trailQuery![0]!;
      expect(sql).toContain('dl.deleted_at IS NULL');
      expect(sql).toMatch(/ds\.status IN \('active',\s*'paused'\)/);
      expect(sql).toMatch(/dl\.accuracy <= /);
    });

    it('prefers the stored shift miles once the shift is closed', async () => {
      const closed = { ...baseRow, shift_status: 'completed', total_distance_miles: 3.2 };
      const { data } = await readDriverUpdate([[closed], [], [], [], trail]);
      expect(data.activeDrivers[0].totalDistanceMiles).toBe(3.2);
    });

    it('counts in-progress deliveries in deliveryCount so a driver mid-delivery is not at 0', async () => {
      const { data } = await readDriverUpdate([[{ ...baseRow, delivery_count: 2, active_deliveries: '1' }], [], [], [], []]);
      expect(data.activeDrivers[0].deliveryCount).toBe(3);
      expect(data.activeDrivers[0].activeDeliveries).toBe(1);
    });
  });
});
