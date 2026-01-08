// src/__tests__/api/tracking/shifts.test.ts

import { GET, POST } from '@/app/api/tracking/shifts/route';
import { GET as GET_SHIFT, PUT } from '@/app/api/tracking/shifts/[id]/route';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
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
            start_time: new Date('2024-12-01T08:00:00Z'),
            end_time: null,
            start_location_geojson: JSON.stringify({
              coordinates: [-97.7431, 30.2672],
            }),
            end_location_geojson: null,
            total_distance_km: 25.5,
            delivery_count: 5,
            status: 'active',
            metadata: { vehicleCheck: true },
            created_at: new Date(),
            updated_at: new Date(),
            employee_id: 'EMP-001',
            vehicle_number: 'TX-1234',
          },
        ];

        const mockBreaks: never[] = [];

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce(mockShifts) // Get shifts
          .mockResolvedValueOnce(mockBreaks); // Get breaks for shift

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
            start_time: new Date(),
            end_time: null,
            start_location_geojson: JSON.stringify({
              coordinates: [-97.7431, 30.2672],
            }),
            end_location_geojson: null,
            total_distance_km: 0,
            delivery_count: 0,
            status: 'active',
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
            employee_id: null,
            vehicle_number: null,
          },
        ];

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce(mockShifts)
          .mockResolvedValueOnce([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data[0].driverInfo).toBeUndefined(); // Drivers shouldn't see driverInfo
        expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
          expect.stringContaining('ds.driver_id = (SELECT id FROM drivers WHERE user_id = $'),
          'driver-user-123',
          50,
          0
        );
      });

      it('should include breaks for each shift', async () => {
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
            start_time: new Date(),
            end_time: null,
            start_location_geojson: JSON.stringify({
              coordinates: [-97.7431, 30.2672],
            }),
            end_location_geojson: null,
            total_distance_km: 0,
            delivery_count: 0,
            status: 'active',
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
            employee_id: 'EMP-001',
            vehicle_number: 'TX-1234',
          },
        ];

        const mockBreaks = [
          {
            id: 'break-1',
            shift_id: 'shift-1',
            start_time: new Date(),
            end_time: new Date(),
            break_type: 'lunch',
            location_geojson: JSON.stringify({
              coordinates: [-97.7431, 30.2672],
            }),
            created_at: new Date(),
          },
        ];

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce(mockShifts)
          .mockResolvedValueOnce(mockBreaks);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data[0].breaks).toHaveLength(1);
        expect(data.data[0].breaks[0].breakType).toBe('lunch');
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
          .mockResolvedValueOnce([{ id: 'driver-1', current_shift_id: null }]) // Get driver
          .mockResolvedValueOnce([{ id: 'shift-new-1' }]); // Create shift

        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

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
      });

      it('should include metadata in shift creation', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([{ id: 'driver-1', current_shift_id: null }])
          .mockResolvedValueOnce([{ id: 'shift-new-2' }]);

        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

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

        // Verify metadata was included
        expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO driver_shifts'),
          'driver-1',
          expect.stringContaining('POINT'),
          expect.stringContaining('vehicleCheck')
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
          { id: 'driver-1', current_shift_id: 'existing-shift' },
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
          start_time: new Date(),
          end_time: null,
          start_location_geojson: JSON.stringify({
            coordinates: [-97.7431, 30.2672],
          }),
          end_location_geojson: null,
          total_distance_km: 15.5,
          delivery_count: 3,
          status: 'active',
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
          employee_id: 'EMP-001',
          vehicle_number: 'TX-1234',
        };

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([mockShift])
          .mockResolvedValueOnce([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1'
        );

        const response = await GET_SHIFT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data.id).toBe('shift-1');
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
          start_time: new Date(),
          end_time: null,
          start_location_geojson: JSON.stringify({
            coordinates: [-97.7431, 30.2672],
          }),
          end_location_geojson: null,
          total_distance_km: 0,
          delivery_count: 0,
          status: 'active',
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
          employee_id: null,
          vehicle_number: null,
        };

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([mockShift])
          .mockResolvedValueOnce([]);

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
            action: 'end',
            location: {
              coordinates: { lat: 30.2772, lng: -97.7531 },
            },
          }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.message).toContain('end');
      });

      it('should end a paused shift', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([
          {
            driver_id: 'driver-1',
            status: 'paused',
            user_id: 'driver-user-123',
          },
        ]);

        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1',
          {
            action: 'end',
          }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'shift-1' }),
        });
        expect(response.status).toBe(200);
      });

      it('should return 400 when trying to end completed shift', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([
          {
            driver_id: 'driver-1',
            status: 'completed',
            user_id: 'driver-user-123',
          },
        ]);

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

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([
          {
            driver_id: 'driver-1',
            status: 'active',
            user_id: 'different-driver-user', // Different user
          },
        ]);

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

        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/shifts/shift-1',
          {
            action: 'end',
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
