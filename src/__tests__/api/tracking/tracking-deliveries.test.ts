// src/__tests__/api/tracking/tracking-deliveries.test.ts

import { GET, POST } from '@/app/api/tracking/deliveries/route';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import {
  createGetRequest,
  createPostRequest,
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

describe('/api/tracking/deliveries API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tracking/deliveries - List Deliveries', () => {
    describe('✅ Successful Retrieval', () => {
      it('should return deliveries for admin users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        const mockDeliveries = [
          {
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
            metadata: {},
            assigned_at: new Date('2024-12-01T08:00:00Z'),
            started_at: null,
            arrived_at: null,
            completed_at: null,
            created_at: new Date('2024-12-01T08:00:00Z'),
            updated_at: new Date('2024-12-01T08:00:00Z'),
            employee_id: 'EMP-001',
            vehicle_number: 'TX-1234',
          },
        ];

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockDeliveries);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].id).toBe('delivery-1');
        expect(data.data[0].status).toBe('ASSIGNED');
        expect(data.data[0].driverInfo).toBeDefined();
        expect(data.data[0].driverInfo.employeeId).toBe('EMP-001');
      });

      it('should filter deliveries by driver_id for admin', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries?driver_id=driver-123'
        );

        await GET(request);

        expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
          expect.stringContaining('d.driver_id = $'),
          'driver-123',
          50,
          0
        );
      });

      it('should filter deliveries by status', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries?status=COMPLETED'
        );

        await GET(request);

        expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
          expect.stringContaining('d.status = $'),
          'COMPLETED',
          50,
          0
        );
      });

      it('should support custom pagination parameters', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries?limit=20&offset=40'
        );

        await GET(request);

        expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          20,
          40
        );
      });

      it('should only return driver own deliveries for DRIVER users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        const mockDeliveries = [
          {
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
            employee_id: null,
            vehicle_number: null,
          },
        ];

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockDeliveries);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data).toHaveLength(1);
        expect(data.data[0].driverInfo).toBeUndefined(); // Driver shouldn't see driver info
        expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
          expect.stringContaining('d.driver_id = (SELECT id FROM drivers WHERE user_id = $'),
          'driver-user-123',
          50,
          0
        );
      });

      it('should parse GeoJSON coordinates correctly', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        const mockDeliveries = [
          {
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
            employee_id: 'EMP-001',
            vehicle_number: 'TX-1234',
          },
        ];

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockDeliveries);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        // Coordinates should be reversed from GeoJSON [lng, lat] to [lat, lng]
        expect(data.data[0].pickupLocation).toEqual([30.2672, -97.7431]);
        expect(data.data[0].deliveryLocation).toEqual([30.2772, -97.7531]);
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
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        expect(response.status).toBe(401);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 for CLIENT users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: false,
          response: new Response(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403 }
          ),
        });

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        expect(response.status).toBe(403);
      });

      it('should allow DRIVER users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
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

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);
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
          new Error('Database connection failed')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        await expectErrorResponse(
          response,
          500,
          /Failed to fetch deliveries/i
        );
      });
    });
  });

  describe('POST /api/tracking/deliveries - Create Delivery', () => {
    describe('✅ Successful Creation', () => {
      it('should create delivery with valid data', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        // Mock driver verification
        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([{ id: 'driver-1', is_active: true }])
          .mockResolvedValueOnce([
            {
              id: 'delivery-1',
              assigned_at: new Date('2024-12-01T08:00:00Z'),
            },
          ]);

        const deliveryData = {
          driverId: 'driver-1',
          pickupLocation: { lat: 30.2672, lng: -97.7431 },
          deliveryLocation: { lat: 30.2772, lng: -97.7531 },
          cateringRequestId: 'catering-1',
          estimatedArrival: '2024-12-01T10:00:00Z',
          metadata: { notes: 'Handle with care' },
        };

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/deliveries',
          deliveryData
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 201);

        expect(data.success).toBe(true);
        expect(data.data.deliveryId).toBe('delivery-1');
        expect(data.data.status).toBe('ASSIGNED');
      });

      it('should create delivery without optional fields', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([{ id: 'driver-1', is_active: true }])
          .mockResolvedValueOnce([
            {
              id: 'delivery-2',
              assigned_at: new Date(),
            },
          ]);

        const deliveryData = {
          driverId: 'driver-1',
          pickupLocation: { lat: 30.2672, lng: -97.7431 },
          deliveryLocation: { lat: 30.2772, lng: -97.7531 },
        };

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/deliveries',
          deliveryData
        );

        const response = await POST(request);
        expect(response.status).toBe(201);
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

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/deliveries',
          {}
        );

        const response = await POST(request);
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

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/deliveries',
          {}
        );

        const response = await POST(request);
        expect(response.status).toBe(403);
      });

      it('should allow ADMIN users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([{ id: 'driver-1', is_active: true }])
          .mockResolvedValueOnce([{ id: 'delivery-1', assigned_at: new Date() }]);

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/deliveries',
          {
            driverId: 'driver-1',
            pickupLocation: { lat: 30.2672, lng: -97.7431 },
            deliveryLocation: { lat: 30.2772, lng: -97.7531 },
          }
        );

        const response = await POST(request);
        expect(response.status).toBe(201);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 for missing driverId', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/deliveries',
          {
            pickupLocation: { lat: 30.2672, lng: -97.7431 },
            deliveryLocation: { lat: 30.2772, lng: -97.7531 },
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, /Missing required fields/i);
      });

      it('should return 400 for missing pickup location', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/deliveries',
          {
            driverId: 'driver-1',
            deliveryLocation: { lat: 30.2772, lng: -97.7531 },
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, /Missing required fields/i);
      });

      it('should return 404 for inactive driver', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
          { id: 'driver-1', is_active: false },
        ]);

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/deliveries',
          {
            driverId: 'driver-1',
            pickupLocation: { lat: 30.2672, lng: -97.7431 },
            deliveryLocation: { lat: 30.2772, lng: -97.7531 },
          }
        );

        const response = await POST(request);
        await expectErrorResponse(
          response,
          404,
          /Driver not found or inactive/i
        );
      });

      it('should return 404 for non-existent driver', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/deliveries',
          {
            driverId: 'non-existent',
            pickupLocation: { lat: 30.2672, lng: -97.7431 },
            deliveryLocation: { lat: 30.2772, lng: -97.7531 },
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 404, /Driver not found/i);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle database errors during creation', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([{ id: 'driver-1', is_active: true }])
          .mockRejectedValueOnce(new Error('Database insert failed'));

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/deliveries',
          {
            driverId: 'driver-1',
            pickupLocation: { lat: 30.2672, lng: -97.7431 },
            deliveryLocation: { lat: 30.2772, lng: -97.7531 },
          }
        );

        const response = await POST(request);
        await expectErrorResponse(
          response,
          500,
          /Failed to create delivery/i
        );
      });
    });
  });
});
