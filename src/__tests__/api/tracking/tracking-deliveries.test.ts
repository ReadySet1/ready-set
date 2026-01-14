// src/__tests__/api/tracking/tracking-deliveries.test.ts

/**
 * Tests for /api/tracking/deliveries API
 *
 * This route fetches from both `deliveries` (new tracking) and `dispatches` (legacy) tables
 * and combines the results with pagination applied in JavaScript.
 */

import { GET, POST } from '@/app/api/tracking/deliveries/route';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import {
  createGetRequest,
  createPostRequest,
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

describe('/api/tracking/deliveries API', () => {
  // Mock delivery from deliveries table
  const mockDeliveryFromDeliveriesTable = {
    id: 'delivery-1',
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
    order_number: 'ORD-001',
    customer_name: 'John Doe',
    pickup_address: '123 Pickup St, Austin, TX',
    delivery_address: '456 Delivery Ave, Austin, TX',
    assigned_at: new Date('2024-12-01T08:00:00Z'),
    started_at: null,
    arrived_at: null,
    completed_at: null,
    created_at: new Date('2024-12-01T08:00:00Z'),
    updated_at: new Date('2024-12-01T08:00:00Z'),
  };

  // Mock dispatch from dispatches table (catering)
  const mockCateringDispatch = {
    id: 'dispatch-1',
    catering_request_id: 'catering-1',
    on_demand_id: null,
    driver_id: 'driver-1',
    assigned_at: new Date('2024-12-01T08:00:00Z'),
    updated_at: new Date('2024-12-01T08:00:00Z'),
    cr_order_number: 'CR-001',
    cr_status: 'ACTIVE',
    cr_driver_status: 'ASSIGNED',
    cr_customer_name: 'Jane Doe',
    cr_pickup_time: new Date('2024-12-01T09:00:00Z'),
    cr_arrival_time: new Date('2024-12-01T10:00:00Z'),
    cr_pickup_street: '100 Restaurant St',
    cr_pickup_city: 'Austin',
    cr_pickup_state: 'TX',
    cr_pickup_zip: '78701',
    cr_pickup_lat: 30.2672,
    cr_pickup_lng: -97.7431,
    cr_delivery_street: '200 Office Blvd',
    cr_delivery_city: 'Austin',
    cr_delivery_state: 'TX',
    cr_delivery_zip: '78702',
    cr_delivery_lat: 30.2772,
    cr_delivery_lng: -97.7531,
    od_order_number: null,
    od_status: null,
    od_driver_status: null,
    od_customer_name: null,
    od_pickup_time: null,
    od_arrival_time: null,
    od_pickup_street: null,
    od_pickup_city: null,
    od_pickup_state: null,
    od_pickup_zip: null,
    od_pickup_lat: null,
    od_pickup_lng: null,
    od_delivery_street: null,
    od_delivery_city: null,
    od_delivery_state: null,
    od_delivery_zip: null,
    od_delivery_lat: null,
    od_delivery_lng: null,
    driver_name: 'Test Driver',
    driver_email: 'driver@test.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/tracking/deliveries - List Deliveries', () => {
    describe('Successful Retrieval', () => {
      it('should return deliveries for admin users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        // Mock deliveries table query
        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([mockDeliveryFromDeliveriesTable])
          .mockResolvedValueOnce([]); // dispatches query

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].id).toBe('delivery-1');
        expect(data.data[0].status).toBe('ASSIGNED');
        expect(data.data[0].sourceType).toBe('delivery');
      });

      it('should return combined deliveries and dispatches', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([mockDeliveryFromDeliveriesTable])
          .mockResolvedValueOnce([mockCateringDispatch]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);

        // Results should include both source types
        const sourceTypes = data.data.map((d: any) => d.sourceType);
        expect(sourceTypes).toContain('delivery');
        expect(sourceTypes).toContain('dispatch');
      });

      it('should filter by driver_id for admin', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries?driver_id=driver-123'
        );

        await GET(request);

        // Check that driver_id filter is in the query
        const deliveryQuery = (prisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
        expect(deliveryQuery).toContain('d.driver_id = $');

        const deliveryParams = (prisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);
        expect(deliveryParams).toContain('driver-123');
      });

      it('should filter by status', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries?status=COMPLETED'
        );

        await GET(request);

        const deliveryQuery = (prisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
        expect(deliveryQuery).toContain('d.status = $');

        const deliveryParams = (prisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);
        expect(deliveryParams).toContain('COMPLETED');
      });

      it('should support pagination with limit and offset', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([mockDeliveryFromDeliveriesTable])
          .mockResolvedValueOnce([mockCateringDispatch]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries?limit=20&offset=40'
        );

        const response = await GET(request);
        const data = await response.json();

        // Pagination is applied in JS after combining results
        expect(data.pagination.limit).toBe(20);
        expect(data.pagination.offset).toBe(40);
      });

      it('should only return driver own deliveries for DRIVER users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'driver-user-123', type: 'DRIVER' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([mockDeliveryFromDeliveriesTable])
          .mockResolvedValueOnce([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data).toHaveLength(1);

        // Verify driver filtering was applied
        const deliveryQuery = (prisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
        expect(deliveryQuery).toContain('d.driver_id = $');

        const deliveryParams = (prisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);
        expect(deliveryParams).toContain('driver-user-123');
      });

      it('should parse GeoJSON coordinates correctly', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([mockDeliveryFromDeliveriesTable])
          .mockResolvedValueOnce([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        // Coordinates should be reversed from GeoJSON [lng, lat] to [lat, lng]
        expect(data.data[0].pickupLocation).toEqual([30.2672, -97.7431]);
        expect(data.data[0].deliveryLocation).toEqual([30.2772, -97.7531]);
      });

      it('should parse dispatch lat/lng coordinates correctly', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([mockCateringDispatch]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        // Dispatch coordinates come from lat/lng fields directly
        expect(data.data[0].pickupLocation).toEqual([30.2672, -97.7431]);
        expect(data.data[0].deliveryLocation).toEqual([30.2772, -97.7531]);
      });

      it('should include orderType for dispatch records', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([mockCateringDispatch]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data[0].orderType).toBe('catering');
        expect(data.data[0].sourceType).toBe('dispatch');
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
          'http://localhost:3000/api/tracking/deliveries'
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

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

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

        (prisma.$queryRawUnsafe as jest.Mock)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);
      });
    });

    describe('Error Handling', () => {
      it('should gracefully handle deliveries table failure and continue to dispatches', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        // Deliveries query fails, but dispatches succeeds
        (prisma.$queryRawUnsafe as jest.Mock)
          .mockRejectedValueOnce(new Error('Database connection failed'))
          .mockResolvedValueOnce([mockCateringDispatch]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        // Should return 200 with dispatch data due to graceful degradation
        const data = await expectSuccessResponse(response, 200);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].sourceType).toBe('dispatch');
      });

      it('should return empty results when both queries fail', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        // Both queries fail - graceful degradation returns empty results
        (prisma.$queryRawUnsafe as jest.Mock)
          .mockRejectedValueOnce(new Error('Deliveries table error'))
          .mockRejectedValueOnce(new Error('Dispatches query error'));

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        // Should still return 200 with empty results due to graceful degradation
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(0);
      });

      it('should continue if deliveries table fails but dispatches succeeds', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
          },
        });

        // Deliveries query fails (table might not exist)
        (prisma.$queryRawUnsafe as jest.Mock)
          .mockRejectedValueOnce(new Error('relation "deliveries" does not exist'))
          .mockResolvedValueOnce([mockCateringDispatch]);

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        // Should still return dispatch data
        expect(data.data).toHaveLength(1);
        expect(data.data[0].sourceType).toBe('dispatch');
      });
    });
  });

  describe('POST /api/tracking/deliveries - Create Delivery', () => {
    describe('Successful Creation', () => {
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

    describe('Authentication Tests', () => {
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

    describe('Authorization Tests', () => {
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

    describe('Validation Tests', () => {
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

    describe('Error Handling', () => {
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
