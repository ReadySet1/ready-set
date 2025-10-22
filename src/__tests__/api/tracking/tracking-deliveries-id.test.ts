// src/__tests__/api/tracking/tracking-deliveries-id.test.ts

import { GET, PUT, DELETE } from '@/app/api/tracking/deliveries/[id]/route';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { DriverStatus } from '@/types/user';
import {
  createGetRequest,
  createPutRequest,
  createDeleteRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
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

describe('/api/tracking/deliveries/[id] API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tracking/deliveries/[id] - Get Delivery Details', () => {
    describe('✅ Successful Retrieval', () => {
      it('should return delivery details for admin users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        const mockDelivery = {
          id: 'delivery-1',
          catering_request_id: 'catering-1',
          on_demand_id: null,
          driver_id: 'driver-1',
          status: 'ASSIGNED',
          pickup_location_geojson: JSON.stringify({
            coordinates: [-97.7431, 30.2672],
          }),
          delivery_location_geojson: JSON.stringify({
            coordinates: [-97.7531, 30.2772],
          }),
          estimated_arrival: new Date('2024-12-01T10:00:00Z'),
          actual_arrival: null,
          proof_of_delivery: null,
          actual_distance_km: 5.2,
          route_polyline: null,
          metadata: { notes: 'Handle with care' },
          assigned_at: new Date('2024-12-01T08:00:00Z'),
          started_at: null,
          arrived_at: null,
          completed_at: null,
          created_at: new Date('2024-12-01T08:00:00Z'),
          updated_at: new Date('2024-12-01T08:00:00Z'),
          employee_id: 'EMP-001',
          vehicle_number: 'TX-1234',
          user_id: 'driver-user-1',
        };

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          mockDelivery,
        ]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1'
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await GET(request, { params });
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data.id).toBe('delivery-1');
        expect(data.data.status).toBe('ASSIGNED');
        expect(data.data.driverInfo).toBeDefined();
        expect(data.data.driverInfo.employeeId).toBe('EMP-001');
      });

      it('should return delivery without driver info for DRIVER users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-1', type: 'DRIVER' },
          },
        });

        const mockDelivery = {
          id: 'delivery-1',
          catering_request_id: null,
          on_demand_id: 'ondemand-1',
          driver_id: 'driver-1',
          status: 'STARTED',
          pickup_location_geojson: JSON.stringify({
            coordinates: [-97.7431, 30.2672],
          }),
          delivery_location_geojson: JSON.stringify({
            coordinates: [-97.7531, 30.2772],
          }),
          estimated_arrival: new Date(),
          actual_arrival: null,
          proof_of_delivery: null,
          actual_distance_km: null,
          route_polyline: null,
          metadata: {},
          assigned_at: new Date(),
          started_at: new Date(),
          arrived_at: null,
          completed_at: null,
          created_at: new Date(),
          updated_at: new Date(),
          employee_id: 'EMP-001',
          vehicle_number: 'TX-1234',
          user_id: 'driver-user-1',
        };

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          mockDelivery,
        ]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1'
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await GET(request, { params });
        const data = await expectSuccessResponse(response, 200);

        expect(data.data.driverInfo).toBeUndefined();
      });

      it('should parse GeoJSON coordinates correctly', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        const mockDelivery = {
          id: 'delivery-1',
          catering_request_id: 'catering-1',
          on_demand_id: null,
          driver_id: 'driver-1',
          status: 'ASSIGNED',
          pickup_location_geojson: JSON.stringify({
            coordinates: [-97.7431, 30.2672],
          }),
          delivery_location_geojson: JSON.stringify({
            coordinates: [-97.7531, 30.2772],
          }),
          estimated_arrival: new Date(),
          actual_arrival: null,
          proof_of_delivery: null,
          actual_distance_km: null,
          route_polyline: null,
          metadata: {},
          assigned_at: new Date(),
          started_at: null,
          arrived_at: null,
          completed_at: null,
          created_at: new Date(),
          updated_at: new Date(),
          employee_id: null,
          vehicle_number: null,
          user_id: null,
        };

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          mockDelivery,
        ]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1'
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await GET(request, { params });
        const data = await expectSuccessResponse(response, 200);

        // Coordinates should be reversed from GeoJSON [lng, lat] to [lat, lng]
        expect(data.data.pickupLocation).toEqual([30.2672, -97.7431]);
        expect(data.data.deliveryLocation).toEqual([30.2772, -97.7531]);
      });

      it('should return 404 when delivery not found', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries/non-existent'
        );
        const params = Promise.resolve({ id: 'non-existent' });

        const response = await GET(request, { params });
        await expectErrorResponse(response, 404, /Delivery not found/i);
      });

      it('should return 404 when driver accesses another driver delivery', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-2', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1'
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await GET(request, { params });
        await expectErrorResponse(response, 404, /Delivery not found/i);
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 for unauthenticated requests', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: false,
          response: new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401 }
          ),
        });

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1'
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await GET(request, { params });
        expect(response.status).toBe(401);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle database errors', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
          new Error('Database query failed')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1'
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await GET(request, { params });
        await expectErrorResponse(response, 500, /Failed to fetch delivery/i);
      });
    });
  });

  describe('PUT /api/tracking/deliveries/[id] - Update Delivery Status', () => {
    describe('✅ Successful Update', () => {
      it('should update delivery status', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-1', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          {
            driver_id: 'driver-1',
            status: 'ASSIGNED',
            user_id: 'driver-user-1',
          },
        ]);

        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const updateData = {
          status: DriverStatus.STARTED,
        };

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          updateData
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await PUT(request, { params });
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.message).toMatch(/updated successfully/i);
      });

      it('should update delivery with location', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-1', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          {
            driver_id: 'driver-1',
            status: 'STARTED',
            user_id: 'driver-user-1',
          },
        ]);

        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const updateData = {
          status: DriverStatus.ARRIVED_TO_CLIENT,
          location: {
            coordinates: { lat: 30.2672, lng: -97.7431 },
          },
        };

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          updateData
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await PUT(request, { params });
        expect(response.status).toBe(200);

        // Verify location update was called
        expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE drivers'),
          'driver-1',
          expect.stringContaining('POINT')
        );
      });

      it('should update delivery with proof of delivery', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          {
            driver_id: 'driver-1',
            status: 'ARRIVED',
            user_id: 'driver-user-1',
          },
        ]);

        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const updateData = {
          status: DriverStatus.COMPLETED,
          proofOfDelivery: 'https://storage.example.com/proof.jpg',
        };

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          updateData
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await PUT(request, { params });
        expect(response.status).toBe(200);

        // Verify delivery count was incremented
        expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE driver_shifts'),
          'driver-1'
        );
      });

      it('should update delivery with notes', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-1', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          {
            driver_id: 'driver-1',
            status: 'STARTED',
            user_id: 'driver-user-1',
          },
        ]);

        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const updateData = {
          notes: 'Customer requested to leave at front door',
        };

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          updateData
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await PUT(request, { params });
        expect(response.status).toBe(200);
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 for unauthenticated requests', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: false,
          response: new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401 }
          ),
        });

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          {}
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await PUT(request, { params });
        expect(response.status).toBe(401);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 when driver tries to update another driver delivery', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-2', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          {
            driver_id: 'driver-1',
            status: 'ASSIGNED',
            user_id: 'driver-user-1',
          },
        ]);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.STARTED }
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await PUT(request, { params });
        await expectForbidden(response, /Access denied/i);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 for invalid status', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          {
            driver_id: 'driver-1',
            status: 'ASSIGNED',
            user_id: 'driver-user-1',
          },
        ]);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: 'INVALID_STATUS' }
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await PUT(request, { params });
        await expectErrorResponse(response, 400, /Invalid status/i);
      });

      it('should return 404 when delivery not found', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/non-existent',
          { status: DriverStatus.STARTED }
        );
        const params = Promise.resolve({ id: 'non-existent' });

        const response = await PUT(request, { params });
        await expectErrorResponse(response, 404, /Delivery not found/i);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle database update errors', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-1', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          {
            driver_id: 'driver-1',
            status: 'ASSIGNED',
            user_id: 'driver-user-1',
          },
        ]);

        (prisma.$executeRawUnsafe as jest.Mock).mockRejectedValue(
          new Error('Update failed')
        );

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.STARTED }
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await PUT(request, { params });
        await expectErrorResponse(response, 500, /Failed to update delivery/i);
      });
    });
  });

  describe('DELETE /api/tracking/deliveries/[id] - Cancel Delivery', () => {
    describe('✅ Successful Cancellation', () => {
      it('should cancel delivery', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          { status: 'ASSIGNED' },
        ]);

        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createDeleteRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1'
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await DELETE(request, { params });
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.message).toMatch(/cancelled successfully/i);
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 for unauthenticated requests', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: false,
          response: new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401 }
          ),
        });

        const request = createDeleteRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1'
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await DELETE(request, { params });
        expect(response.status).toBe(401);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 for DRIVER users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: false,
          response: new Response(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403 }
          ),
        });

        const request = createDeleteRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1'
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await DELETE(request, { params });
        expect(response.status).toBe(403);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 404 when delivery not found', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createDeleteRequest(
          'http://localhost:3000/api/tracking/deliveries/non-existent'
        );
        const params = Promise.resolve({ id: 'non-existent' });

        const response = await DELETE(request, { params });
        await expectErrorResponse(response, 404, /Delivery not found/i);
      });

      it('should return 400 when trying to cancel completed delivery', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          { status: 'DELIVERED' },
        ]);

        const request = createDeleteRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1'
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await DELETE(request, { params });
        await expectErrorResponse(
          response,
          400,
          /Cannot cancel completed delivery/i
        );
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle database cancellation errors', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          { status: 'ASSIGNED' },
        ]);

        (prisma.$executeRawUnsafe as jest.Mock).mockRejectedValue(
          new Error('Cancellation failed')
        );

        const request = createDeleteRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1'
        );
        const params = Promise.resolve({ id: 'delivery-1' });

        const response = await DELETE(request, { params });
        await expectErrorResponse(response, 500, /Failed to cancel delivery/i);
      });
    });
  });
});
