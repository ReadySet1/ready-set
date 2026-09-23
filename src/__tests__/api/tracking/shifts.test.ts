// src/__tests__/api/tracking/shifts.test.ts

import { GET, POST } from '@/app/api/tracking/shifts/route';
import { GET as GET_SHIFT, PUT } from '@/app/api/tracking/shifts/[id]/route';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { endDriverShift, startDriverShift } from '@/app/actions/tracking/driver-actions';
import {
  createGetRequest,
  createPostRequest,
  createPutRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/auth-middleware');
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  },
}));
// The detail route's `action=end` delegates to the guarded endDriverShift;
// the list route's POST delegates the insert to startDriverShift.
jest.mock('@/app/actions/tracking/driver-actions', () => ({
  endDriverShift: jest.fn(),
  startDriverShift: jest.fn(),
}));

// Columns/tables that do not exist on the shipped driver_shifts schema.
const NON_EXISTENT_SHIFT_COLUMNS =
  /\bstart_time\b|\bend_time\b|total_distance_km|\bmetadata\b|shift_breaks/;

describe('/api/tracking/shifts API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tracking/shifts - List Shifts', () => {
    describe('Successful Retrieval', () => {
      it('should return shifts for admin users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        const mockShifts = [
          {
            id: 'shift-1',
            driver_id: 'driver-1',
            shift_start: new Date('2024-12-01T08:00:00Z'),
            shift_end: null,
            start_location_geojson: JSON.stringify({
              coordinates: [-97.7431, 30.2672],
            }),
            end_location_geojson: null,
            total_distance: 25.5,
            total_distance_miles: 15.8,
            gps_distance_miles: 15.8,
            mileage_source: 'gps',
            delivery_count: 5,
            status: 'active',
            notes: null,
            break_start: null,
            break_end: null,
            created_at: new Date(),
            updated_at: new Date(),
            employee_id: 'EMP-001',
            vehicle_number: 'TX-1234',
          },
        ];

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce(mockShifts);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].id).toBe('shift-1');
        expect(data.data[0].status).toBe('active');
        expect(data.data[0].driverInfo).toBeDefined();
        expect(data.data[0].driverInfo.employeeId).toBe('EMP-001');
        expect(data.data[0].startTime).toEqual(new Date('2024-12-01T08:00:00Z'));
        expect(data.data[0].totalDistanceMiles).toBe(15.8);
        expect(data.data[0].totalDistanceKm).toBe(25.5);
        expect(data.data[0].mileageSource).toBe('gps');
        expect(data.data[0].breaks).toEqual([]);

        // Single query against the real schema (no shift_breaks round-trip)
        expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        const sql = (prisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0] as string;
        expect(sql).not.toMatch(NON_EXISTENT_SHIFT_COLUMNS);
        expect(sql).toMatch(/ds\.shift_start/);
        expect(sql).toMatch(/ds\.shift_end/);
        expect(sql).toMatch(/ds\.deleted_at IS NULL/);
        expect(sql).toMatch(/ORDER BY ds\.shift_start DESC/);
      });

      it('should filter shifts by driver_id for admin', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts?driver_id=driver-123'
        );

        await GET(request);

        expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
          expect.stringContaining('ds.driver_id = $'),
          'driver-123',
          50,
          0
        );
      });

      it('should filter shifts by status', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts?status=completed'
        );

        await GET(request);

        expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
          expect.stringContaining('ds.status = $'),
          'completed',
          50,
          0
        );
      });

      it('should support custom pagination', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts?limit=25&offset=50'
        );

        await GET(request);

        expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          25,
          50
        );
      });

      it('should only return driver own shifts for DRIVER users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        const mockShifts = [
          {
            id: 'shift-1',
            driver_id: 'driver-1',
            shift_start: new Date(),
            shift_end: null,
            start_location_geojson: JSON.stringify({
              coordinates: [-97.7431, 30.2672],
            }),
            end_location_geojson: null,
            total_distance: 0,
            total_distance_miles: 0,
            gps_distance_miles: null,
            mileage_source: null,
            delivery_count: 0,
            status: 'active',
            notes: null,
            break_start: null,
            break_end: null,
            created_at: new Date(),
            updated_at: new Date(),
            employee_id: null,
            vehicle_number: null,
          },
        ];

        (prisma.$queryRawUnsafe as jest.Mock).mockImplementation((sql: string) => {
          if (sql.includes('FROM driver_shifts')) return Promise.resolve(mockShifts);
          // Driver row resolution (profile_id OR user_id linkage)
          return Promise.resolve([
            { id: 'driver-1', is_active: true, current_shift_id: 'shift-1' },
          ]);
        });

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data[0].driverInfo).toBeUndefined(); // Drivers shouldn't see driverInfo
        // Scoped to the resolved driver id, not a user_id subquery
        expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
          expect.stringContaining('ds.driver_id = $'),
          'driver-1',
          50,
          0
        );
      });

      it('should expose the inline break on the shift row', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        const mockShifts = [
          {
            id: 'shift-1',
            driver_id: 'driver-1',
            shift_start: new Date(),
            shift_end: null,
            start_location_geojson: JSON.stringify({
              coordinates: [-97.7431, 30.2672],
            }),
            end_location_geojson: null,
            total_distance: 0,
            total_distance_miles: 0,
            gps_distance_miles: null,
            mileage_source: null,
            delivery_count: 0,
            status: 'active',
            notes: null,
            break_start: new Date('2024-12-01T12:00:00Z'),
            break_end: new Date('2024-12-01T12:30:00Z'),
            created_at: new Date(),
            updated_at: new Date(),
            employee_id: 'EMP-001',
            vehicle_number: 'TX-1234',
          },
        ];

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce(mockShifts);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data[0].breaks).toEqual([
          {
            startTime: new Date('2024-12-01T12:00:00Z'),
            endTime: new Date('2024-12-01T12:30:00Z'),
          },
        ]);
      });
    });

    describe('Authentication Tests', () => {
      it('should return 401 for unauthenticated requests', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: false,
          response: new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401 }
          ),
        });

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts'
        );

        const response = await GET(request);
        expect(response.status).toBe(401);
      });
    });

    describe('Authorization Tests', () => {
      it('should return 403 for CLIENT users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: false,
          response: new Response(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403 }
          ),
        });

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts'
        );

        const response = await GET(request);
        expect(response.status).toBe(403);
      });

      it('should allow HELPDESK users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'helpdesk-123', type: 'HELPDESK' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts'
        );

        const response = await GET(request);
        await expectErrorResponse(response, 500, /Failed to fetch shifts/i);
      });
    });
  });

  describe('POST /api/tracking/shifts - Start Shift', () => {
    describe('Successful Shift Start', () => {
      it('should start a new shift for driver', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([{ id: 'driver-1', is_active: true, current_shift_id: null }]); // Get driver
        (startDriverShift as jest.Mock).mockResolvedValue({ success: true, shiftId: 'shift-new-1' });

        const shiftData = {
          location: {
            coordinates: { lat: 30.2672, lng: -97.7431 },
          },
          vehicleCheck: true,
        };

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/shifts',
          shiftData
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 201);

        expect(data.success).toBe(true);
        expect(data.data.shiftId).toBe('shift-new-1');
        expect(data.data.status).toBe('active');

        // The insert is delegated; the route never writes driver_shifts itself
        expect(startDriverShift).toHaveBeenCalledWith(
          'driver-1',
          shiftData.location,
          { vehicleCheck: true }
        );
        expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
        for (const [sql] of (prisma.$queryRawUnsafe as jest.Mock).mock.calls) {
          expect(sql).not.toMatch(/INSERT INTO driver_shifts/);
        }
      });

      it('should return 200 with resumed: true when an open shift is resumed', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([{ id: 'driver-1', is_active: true, current_shift_id: null }]);
        (startDriverShift as jest.Mock).mockResolvedValue({
          success: true,
          shiftId: 'shift-open-1',
          resumed: true,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/shifts',
          { location: { coordinates: { lat: 30.2672, lng: -97.7431 } } }
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data.shiftId).toBe('shift-open-1');
        expect(data.data.resumed).toBe(true);
        expect(data.data.status).toBe('active');
      });

      it('should map an "Access denied" startDriverShift failure to 403', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([{ id: 'driver-1', is_active: true, current_shift_id: null }]);
        (startDriverShift as jest.Mock).mockResolvedValue({ success: false, error: 'Access denied' });

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/shifts',
          { location: { coordinates: { lat: 30.2672, lng: -97.7431 } } }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 403, /Access denied/i);
      });

      it('should map an unexpected startDriverShift failure to a generic 500', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([{ id: 'driver-1', is_active: true, current_shift_id: null }]);
        (startDriverShift as jest.Mock).mockResolvedValue({
          success: false,
          error: 'relation "driver_shifts" violates constraint xyz',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/shifts',
          { location: { coordinates: { lat: 30.2672, lng: -97.7431 } } }
        );

        const response = await POST(request);
        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body).toEqual({ success: false, error: 'Failed to start shift' });
        expect(JSON.stringify(body)).not.toMatch(/driver_shifts|constraint/);
      });

      it('should include metadata in shift creation', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([{ id: 'driver-1', is_active: true, current_shift_id: null }]);
        (startDriverShift as jest.Mock).mockResolvedValue({ success: true, shiftId: 'shift-new-2' });

        const shiftData = {
          location: {
            coordinates: { lat: 30.2672, lng: -97.7431 },
          },
          vehicleCheck: true,
          metadata: { customField: 'value' },
        };

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/shifts',
          shiftData
        );

        await POST(request);

        // Verify metadata was forwarded to startDriverShift
        expect(startDriverShift).toHaveBeenCalledWith(
          'driver-1',
          shiftData.location,
          { vehicleCheck: true, customField: 'value' }
        );
      });
    });

    describe('Validation Tests', () => {
      it('should return 400 for missing location', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/shifts',
          {}
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, /Location coordinates required/i);
      });

      it('should return 400 for missing coordinates in location', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/shifts',
          { location: {} }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, /Location coordinates required/i);
      });
    });

    describe('Driver Verification', () => {
      it('should return 404 if driver profile not found', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/shifts',
          {
            location: {
              coordinates: { lat: 30.2672, lng: -97.7431 },
            },
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 404, /Driver profile not found or inactive/i);
      });

      it('should return 409 if driver already has active shift', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([
          { id: 'driver-1', is_active: true, current_shift_id: 'existing-shift' },
        ]);

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/shifts',
          {
            location: {
              coordinates: { lat: 30.2672, lng: -97.7431 },
            },
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 409, /already has an active shift/i);
      });
    });

    describe('Authorization Tests', () => {
      it('should return 403 for non-DRIVER users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: false,
          response: new Response(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403 }
          ),
        });

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/shifts',
          {
            location: {
              coordinates: { lat: 30.2672, lng: -97.7431 },
            },
          }
        );

        const response = await POST(request);
        expect(response.status).toBe(403);
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/shifts',
          {
            location: {
              coordinates: { lat: 30.2672, lng: -97.7431 },
            },
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 500, /Failed to start shift/i);
        const body = await response.json();
        expect(JSON.stringify(body)).not.toMatch(/Database error/);
      });
    });
  });

  describe('GET /api/tracking/shifts/[id] - Get Shift Details', () => {
    describe('Successful Retrieval', () => {
      it('should return shift details for admin', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        const mockShift = {
          id: 'shift-1',
          driver_id: 'driver-1',
          shift_start: new Date(),
          shift_end: null,
          start_location_geojson: JSON.stringify({
            coordinates: [-97.7431, 30.2672],
          }),
          end_location_geojson: null,
          total_distance: 24.94,
          total_distance_miles: 15.5,
          gps_distance_miles: 15.5,
          mileage_source: 'gps',
          delivery_count: 3,
          status: 'active',
          notes: null,
          break_start: null,
          break_end: null,
          created_at: new Date(),
          updated_at: new Date(),
          employee_id: 'EMP-001',
          vehicle_number: 'TX-1234',
        };

        // One query: shift + driver join. There is no shift_breaks table.
        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([mockShift]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1'
        );

        const response = await GET_SHIFT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        const data = await expectSuccessResponse(response, 200);

        expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        expect(data.success).toBe(true);
        expect(data.data.id).toBe('shift-1');
        expect(data.data.totalDistanceMiles).toBe(15.5);
        expect(data.data.breaks).toEqual([]);
        expect(data.data.driverInfo.employeeId).toBe('EMP-001');
      });

      it('should return shift for driver who owns it', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        const mockShift = {
          id: 'shift-1',
          driver_id: 'driver-1',
          shift_start: new Date(),
          shift_end: null,
          start_location_geojson: JSON.stringify({
            coordinates: [-97.7431, 30.2672],
          }),
          end_location_geojson: null,
          total_distance: null,
          total_distance_miles: null,
          gps_distance_miles: null,
          mileage_source: null,
          delivery_count: 0,
          status: 'active',
          notes: null,
          break_start: null,
          break_end: null,
          created_at: new Date(),
          updated_at: new Date(),
          employee_id: null,
          vehicle_number: null,
        };

        (prisma.$queryRawUnsafe as jest.Mock).mockImplementation((sql: string) => {
          if (sql.includes('FROM driver_shifts')) return Promise.resolve([mockShift]);
          // Ownership lookup: driver-1 belongs to driver-user-123
          return Promise.resolve([{ id: 'driver-1' }]);
        });

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1'
        );

        const response = await GET_SHIFT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        const data = await expectSuccessResponse(response, 200);

        expect(data.data.driverInfo).toBeUndefined(); // Driver shouldn't see driverInfo
      });
    });

    describe('Authorization Tests', () => {
      it('should return 404 (not 403) when a driver fetches another drivers shift', async () => {
        // Anti-oracle behavior: a non-owned shift must be indistinguishable
        // from a non-existent one, so the route can't be used to probe ids.
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        const mockShift = {
          id: 'shift-1',
          driver_id: 'driver-other',
          shift_start: new Date(),
          shift_end: null,
          start_location_geojson: JSON.stringify({
            coordinates: [-97.7431, 30.2672],
          }),
          end_location_geojson: null,
          total_distance: null,
          total_distance_miles: null,
          gps_distance_miles: null,
          mileage_source: null,
          delivery_count: 0,
          status: 'active',
          notes: null,
          break_start: null,
          break_end: null,
          created_at: new Date(),
          updated_at: new Date(),
          employee_id: null,
          vehicle_number: null,
        };

        (prisma.$queryRawUnsafe as jest.Mock).mockImplementation((sql: string) => {
          if (sql.includes('FROM driver_shifts')) return Promise.resolve([mockShift]);
          // Ownership lookup: driver-other is NOT linked to driver-user-123
          return Promise.resolve([]);
        });

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1'
        );

        const response = await GET_SHIFT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        await expectErrorResponse(response, 404, /shift not found/i);
      });
    });

    describe('Not Found', () => {
      it('should return 404 for non-existent shift', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts/non-existent'
        );

        const response = await GET_SHIFT(request, {
          params: Promise.resolve({ id: 'non-existent' }),
        });
        await expectErrorResponse(response, 404, /Shift not found/i);
      });
    });
  });

  describe('PUT /api/tracking/shifts/[id] - Update Shift', () => {
    describe('End Shift', () => {
      it('should end an active shift', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockImplementation((sql: string) => {
          if (sql.includes('FROM driver_shifts')) {
            return Promise.resolve([{ driver_id: 'driver-1', status: 'active' }]);
          }
          // Ownership lookup: driver-1 belongs to driver-user-123
          return Promise.resolve([{ id: 'driver-1' }]);
        });

        (endDriverShift as jest.Mock).mockResolvedValue({ success: true });

        const location = { coordinates: { lat: 30.2772, lng: -97.7531 } };
        const request = createPutRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1',
          {
            action: 'end',
            location,
          }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        // Ending goes through the guarded action; the route writes nothing itself.
        expect(endDriverShift).toHaveBeenCalledWith('shift-1', location, undefined, {});
        expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
      });

      it('should return 400 when ending without a location', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([
          { driver_id: 'driver-1', status: 'active' },
        ]);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1',
          { action: 'end' }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        await expectErrorResponse(response, 400, /Missing location/i);
        expect(endDriverShift).not.toHaveBeenCalled();
      });

      it('should return 409 when the active-delivery guard blocks the end', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([
          { driver_id: 'driver-1', status: 'active' },
        ]);
        (endDriverShift as jest.Mock).mockResolvedValue({
          success: false,
          error: 'Complete your deliveries first',
          activeDeliveries: 1,
          blockingOrders: [{ orderNumber: 'CV-1', reason: 'IN_PROGRESS' }],
        });

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1',
          {
            action: 'end',
            location: { coordinates: { lat: 30.2772, lng: -97.7531 } },
          }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        expect(response.status).toBe(409);
        const data = await response.json();
        expect(data.activeDeliveries).toBe(1);
        expect(data.blockingOrders).toHaveLength(1);
      });

      it('should end a paused shift', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockImplementation((sql: string) => {
          if (sql.includes('FROM driver_shifts')) {
            return Promise.resolve([{ driver_id: 'driver-1', status: 'paused' }]);
          }
          return Promise.resolve([{ id: 'driver-1' }]);
        });

        (endDriverShift as jest.Mock).mockResolvedValue({ success: true });

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1',
          {
            action: 'end',
            location: { coordinates: { lat: 30.2772, lng: -97.7531 } },
          }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        expect(response.status).toBe(200);
        expect(endDriverShift).toHaveBeenCalledTimes(1);
      });

      it('should return 400 when trying to end completed shift', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockImplementation((sql: string) => {
          if (sql.includes('FROM driver_shifts')) {
            return Promise.resolve([{ driver_id: 'driver-1', status: 'completed' }]);
          }
          return Promise.resolve([{ id: 'driver-1' }]);
        });

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1',
          {
            action: 'end',
          }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        await expectErrorResponse(response, 400, /Shift is not active/i);
      });
    });

    describe('Update Metadata', () => {
      it('should update shift metadata', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([
          {
            driver_id: 'driver-1',
            status: 'active',
            user_id: 'driver-user-123',
          },
        ]);

        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1',
          {
            action: 'update_metadata',
            metadata: { notes: 'Updated notes' },
          }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        const data = await expectSuccessResponse(response, 200);

        expect(data.message).toContain('update_metadata');
        // driver_shifts has no metadata column; the payload is appended to notes.
        const [sql, ...args] = (prisma.$executeRawUnsafe as jest.Mock).mock.calls[0]!;
        expect(String(sql)).toMatch(/notes = COALESCE\(notes, ''\) \|\| \$2/);
        expect(String(sql)).not.toMatch(/metadata/);
        expect(args).toEqual(['shift-1', ' ' + JSON.stringify({ notes: 'Updated notes' })]);
      });
    });

    describe('Authorization Tests', () => {
      it('should return 403 when driver tries to update another drivers shift', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockImplementation((sql: string) => {
          if (sql.includes('FROM driver_shifts')) {
            return Promise.resolve([{ driver_id: 'driver-1', status: 'active' }]);
          }
          // Ownership lookup: driver-1 is NOT linked to driver-user-123
          return Promise.resolve([]);
        });

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1',
          {
            action: 'end',
          }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        await expectErrorResponse(response, 403, /Access denied/i);
      });

      it('should allow admin to update any shift', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([
          {
            driver_id: 'driver-1',
            status: 'active',
            user_id: 'some-driver-user',
          },
        ]);

        (endDriverShift as jest.Mock).mockResolvedValue({ success: true });

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1',
          {
            action: 'end',
            location: { coordinates: { lat: 30.2772, lng: -97.7531 } },
          }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        expect(response.status).toBe(200);
      });
    });

    describe('Validation Tests', () => {
      it('should return 400 for invalid action', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([
          {
            driver_id: 'driver-1',
            status: 'active',
            user_id: 'driver-user-123',
          },
        ]);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1',
          {
            action: 'invalid_action',
          }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        await expectErrorResponse(response, 400, /Invalid action/i);
      });

      it('should return 404 for non-existent shift', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/shifts/non-existent',
          {
            action: 'end',
          }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'non-existent' }),
        });
        await expectErrorResponse(response, 404, /Shift not found/i);
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1',
          {
            action: 'end',
          }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        await expectErrorResponse(response, 500, /Failed to update shift/i);
      });
    });
  });
});
