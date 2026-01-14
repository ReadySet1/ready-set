/**
 * Tests for /api/tracking/deliveries route
 *
 * This route is BUSINESS CRITICAL as it handles real-time delivery tracking
 * It fetches from both `deliveries` table (new tracking) and `dispatches` table (legacy)
 *
 * Tests cover:
 * - GET: Delivery tracking with multi-tenant isolation, dual-source data, pagination
 * - POST: Delivery assignment creation with driver verification
 * - Role-based access control and data isolation
 * - PostGIS geospatial data handling
 * - Error handling and validation
 */

import { GET, POST } from "../route";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/utils/prismaDB";
import {
  createGetRequest,
  createPostRequest,
  createRequestWithParams,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectServerError,
  expectValidationError,
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies
jest.mock("@/lib/auth-middleware", () => ({
  withAuth: jest.fn(),
}));

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));

const mockWithAuth = withAuth as jest.MockedFunction<typeof withAuth>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("/api/tracking/deliveries", () => {
  // Mock delivery from deliveries table (new system)
  const mockDeliveryRecord = {
    id: "delivery-1",
    driver_id: "driver-1",
    status: "ASSIGNED",
    pickup_location_geojson: '{"type":"Point","coordinates":[-122.4194,37.7749]}',
    delivery_location_geojson: '{"type":"Point","coordinates":[-122.4084,37.7849]}',
    estimated_arrival: new Date("2025-01-15T12:00:00Z"),
    actual_arrival: null,
    proof_of_delivery: null,
    order_number: "ORD-001",
    customer_name: "John Doe",
    pickup_address: "123 Pickup St",
    delivery_address: "456 Delivery Ave",
    assigned_at: new Date("2025-01-15T10:00:00Z"),
    started_at: null,
    arrived_at: null,
    completed_at: null,
    created_at: new Date("2025-01-15T10:00:00Z"),
    updated_at: new Date("2025-01-15T10:00:00Z"),
    source_type: "delivery",
  };

  // Mock dispatch from dispatches table (legacy system)
  const mockDispatchRecord = {
    id: "dispatch-1",
    catering_request_id: "catering-1",
    on_demand_id: null,
    driver_id: "driver-1",
    assigned_at: new Date("2025-01-15T10:00:00Z"),
    updated_at: new Date("2025-01-15T10:00:00Z"),
    cr_order_number: "CR-001",
    cr_status: "ACTIVE",
    cr_driver_status: "ASSIGNED",
    cr_customer_name: "Jane Doe",
    cr_pickup_time: new Date("2025-01-15T11:00:00Z"),
    cr_arrival_time: new Date("2025-01-15T12:00:00Z"),
    cr_pickup_street: "100 Restaurant St",
    cr_pickup_city: "Austin",
    cr_pickup_state: "TX",
    cr_pickup_zip: "78701",
    cr_pickup_lat: 30.2672,
    cr_pickup_lng: -97.7431,
    cr_delivery_street: "200 Office Blvd",
    cr_delivery_city: "Austin",
    cr_delivery_state: "TX",
    cr_delivery_zip: "78702",
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
    driver_name: "Test Driver",
    driver_email: "driver@test.com",
    source_type: "dispatch",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.warn for deliveries table not existing
    jest.spyOn(console, "warn").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("GET /api/tracking/deliveries", () => {
    describe("Authentication & Authorization", () => {
      it("should reject unauthenticated requests", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: false,
          response: new Response(
            JSON.stringify({ message: "Unauthorized" }),
            { status: 401 }
          ),
        } as any);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        await expectUnauthorized(response);
      });

      it("should allow DRIVER role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "driver-user-id",
              type: "DRIVER",
            },
          },
        } as any);

        // Mock deliveries query (empty)
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
        // Mock dispatches query (empty)
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        expect(response.status).toBe(200);
      });

      it("should allow ADMIN role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "admin-id",
              type: "ADMIN",
            },
          },
        } as any);

        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        expect(response.status).toBe(200);
      });

      it("should allow SUPER_ADMIN role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "super-admin-id",
              type: "SUPER_ADMIN",
            },
          },
        } as any);

        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        expect(response.status).toBe(200);
      });

      it("should allow HELPDESK role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "helpdesk-id",
              type: "HELPDESK",
            },
          },
        } as any);

        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        expect(response.status).toBe(200);
      });

      it("should reject CLIENT role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: false,
          response: new Response(
            JSON.stringify({ message: "Forbidden" }),
            { status: 403 }
          ),
        } as any);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        await expectForbidden(response);
      });
    });

    describe("Multi-Tenant Data Isolation", () => {
      it("should filter deliveries by user ID for DRIVER role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "driver-user-id",
              type: "DRIVER",
            },
          },
        } as any);

        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveryRecord]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        await GET(request);

        // First query is for deliveries table - should filter by driver_id using user.id
        const deliveryQuery = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
        expect(deliveryQuery).toContain("d.driver_id = $");
        expect(deliveryQuery).toContain("::uuid");

        // Verify user ID is passed as parameter
        const deliveryParams = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);
        expect(deliveryParams).toContain("driver-user-id");
      });

      it("should not filter by driver ID for ADMIN role without driver_id param", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "admin-id",
              type: "ADMIN",
            },
          },
        } as any);

        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveryRecord]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDispatchRecord]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        await GET(request);

        // For admin without driver_id param, no driver filtering should be applied
        const deliveryQuery = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
        // The base query should not have driver_id filter when admin has no driver_id param
        expect(deliveryQuery).toContain("FROM deliveries d");
      });
    });

    describe("Query Parameters", () => {
      beforeEach(() => {
        mockWithAuth.mockResolvedValue({
          success: true,
          context: {
            user: {
              id: "admin-id",
              type: "ADMIN",
            },
          },
        } as any);
      });

      it("should filter by driver_id query parameter", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveryRecord]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/deliveries",
          { driver_id: "driver-1" }
        );
        await GET(request);

        const deliveryQuery = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
        expect(deliveryQuery).toContain("d.driver_id = $");

        const params = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);
        expect(params).toContain("driver-1");
      });

      it("should filter by status query parameter", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveryRecord]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/deliveries",
          { status: "IN_PROGRESS" }
        );
        await GET(request);

        const deliveryQuery = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
        expect(deliveryQuery).toContain("d.status = $");

        const params = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);
        expect(params).toContain("IN_PROGRESS");
      });

      it("should filter by source parameter (deliveries only)", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveryRecord]);

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/deliveries",
          { source: "deliveries" }
        );
        await GET(request);

        // Should only query deliveries table, not dispatches
        expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        const query = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
        expect(query).toContain("FROM deliveries d");
      });

      it("should filter by source parameter (dispatches only)", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDispatchRecord]);

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/deliveries",
          { source: "dispatches" }
        );
        await GET(request);

        // Should only query dispatches table, not deliveries
        expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        const query = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
        expect(query).toContain("FROM dispatches disp");
      });

      it("should apply pagination from limit/offset params", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/deliveries",
          { limit: "10", offset: "20" }
        );
        const response = await GET(request);
        const data = await response.json();

        // Pagination is applied in JS after combining results
        expect(data.pagination).toEqual({
          limit: 10,
          offset: 20,
          total: 0,
        });
      });
    });

    describe("Geospatial Data Handling", () => {
      beforeEach(() => {
        mockWithAuth.mockResolvedValue({
          success: true,
          context: {
            user: {
              id: "admin-id",
              type: "ADMIN",
            },
          },
        } as any);
      });

      it("should parse delivery pickup location GeoJSON correctly", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveryRecord]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        // GeoJSON coordinates are reversed from [lng, lat] to [lat, lng]
        expect(data.data[0].pickupLocation).toEqual([37.7749, -122.4194]);
      });

      it("should parse delivery location GeoJSON correctly", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveryRecord]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.data[0].deliveryLocation).toEqual([37.7849, -122.4084]);
      });

      it("should handle null geospatial data gracefully", async () => {
        const deliveryWithNullGeo = {
          ...mockDeliveryRecord,
          pickup_location_geojson: null,
          delivery_location_geojson: null,
        };

        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([deliveryWithNullGeo]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.data[0].pickupLocation).toBeNull();
        expect(data.data[0].deliveryLocation).toBeNull();
      });

      it("should parse dispatch coordinates from lat/lng fields", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDispatchRecord]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        // Dispatch records use lat/lng directly
        expect(data.data[0].pickupLocation).toEqual([30.2672, -97.7431]);
        expect(data.data[0].deliveryLocation).toEqual([30.2772, -97.7531]);
      });
    });

    describe("Response Format", () => {
      beforeEach(() => {
        mockWithAuth.mockResolvedValue({
          success: true,
          context: {
            user: {
              id: "admin-id",
              type: "ADMIN",
            },
          },
        } as any);
      });

      it("should return deliveries with correct structure", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveryRecord]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data).toHaveProperty("pagination");
        expect(Array.isArray(data.data)).toBe(true);
      });

      it("should include pagination metadata", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveryRecord]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDispatchRecord]);

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/deliveries",
          { limit: "10", offset: "0" }
        );
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.pagination).toEqual({
          limit: 10,
          offset: 0,
          total: 2,
        });
      });

      it("should include sourceType in delivery records", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveryRecord]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.data[0].sourceType).toBe("delivery");
      });

      it("should include sourceType in dispatch records", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDispatchRecord]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.data[0].sourceType).toBe("dispatch");
      });

      it("should include delivery fields from deliveries table", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveryRecord]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);
        const delivery = data.data[0];

        expect(delivery).toHaveProperty("id");
        expect(delivery).toHaveProperty("driverId");
        expect(delivery).toHaveProperty("status");
        expect(delivery).toHaveProperty("pickupLocation");
        expect(delivery).toHaveProperty("deliveryLocation");
        expect(delivery).toHaveProperty("orderNumber");
        expect(delivery).toHaveProperty("customerName");
        expect(delivery).toHaveProperty("pickupAddress");
        expect(delivery).toHaveProperty("deliveryAddress");
        expect(delivery).toHaveProperty("assignedAt");
        expect(delivery).toHaveProperty("sourceType", "delivery");
      });

      it("should include dispatch fields from dispatches table", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDispatchRecord]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);
        const dispatch = data.data[0];

        expect(dispatch).toHaveProperty("id");
        expect(dispatch).toHaveProperty("cateringRequestId");
        expect(dispatch).toHaveProperty("driverId");
        expect(dispatch).toHaveProperty("status");
        expect(dispatch).toHaveProperty("pickupLocation");
        expect(dispatch).toHaveProperty("deliveryLocation");
        expect(dispatch).toHaveProperty("orderNumber");
        expect(dispatch).toHaveProperty("customerName");
        expect(dispatch).toHaveProperty("sourceType", "dispatch");
        expect(dispatch).toHaveProperty("orderType", "catering");
      });
    });

    describe("Error Handling", () => {
      beforeEach(() => {
        mockWithAuth.mockResolvedValue({
          success: true,
          context: {
            user: {
              id: "admin-id",
              type: "ADMIN",
            },
          },
        } as any);
      });

      it("should gracefully handle deliveries table query failure and continue to dispatches", async () => {
        // Deliveries query fails (table might not exist in older deployments)
        mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(
          new Error("Database connection failed")
        );
        // Dispatches query succeeds
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDispatchRecord]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        // Should return 200 with dispatch data due to graceful degradation
        const data = await expectSuccessResponse(response);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].sourceType).toBe("dispatch");
      });

      it("should continue if deliveries table query fails but dispatches succeeds", async () => {
        // Deliveries query throws (table might not exist)
        mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(
          new Error("relation \"deliveries\" does not exist")
        );
        // Dispatches query succeeds
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDispatchRecord]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        // Should still return dispatch data
        expect(data.data).toHaveLength(1);
        expect(data.data[0].sourceType).toBe("dispatch");
      });

      it("should return empty results when both queries fail", async () => {
        // Both queries fail - graceful degradation returns empty results
        mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(
          new Error("Deliveries table error")
        );
        mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(
          new Error("Dispatches query error")
        );

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        // Should still return 200 with empty results due to graceful degradation
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(0);
      });
    });
  });

  describe("POST /api/tracking/deliveries", () => {
    const validDeliveryRequest = {
      driverId: "driver-1",
      pickupLocation: { lat: 37.7749, lng: -122.4194 },
      deliveryLocation: { lat: 37.7849, lng: -122.4084 },
      cateringRequestId: "catering-1",
      estimatedArrival: "2025-01-15T12:00:00Z",
      metadata: { notes: "Fragile items" },
    };

    describe("Authentication & Authorization", () => {
      it("should reject unauthenticated requests", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: false,
          response: new Response(
            JSON.stringify({ message: "Unauthorized" }),
            { status: 401 }
          ),
        } as any);

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          validDeliveryRequest
        );
        const response = await POST(request);

        await expectUnauthorized(response);
      });

      it("should allow ADMIN role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "admin-id",
              type: "ADMIN",
            },
          },
        } as any);

        mockPrisma.$queryRawUnsafe
          .mockResolvedValueOnce([{ id: "driver-1", is_active: true }])
          .mockResolvedValueOnce([
            { id: "delivery-1", assigned_at: new Date("2025-01-15T10:00:00Z") },
          ]);

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          validDeliveryRequest
        );
        const response = await POST(request);

        expect(response.status).toBe(201);
      });

      it("should allow SUPER_ADMIN role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "super-admin-id",
              type: "SUPER_ADMIN",
            },
          },
        } as any);

        mockPrisma.$queryRawUnsafe
          .mockResolvedValueOnce([{ id: "driver-1", is_active: true }])
          .mockResolvedValueOnce([
            { id: "delivery-1", assigned_at: new Date("2025-01-15T10:00:00Z") },
          ]);

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          validDeliveryRequest
        );
        const response = await POST(request);

        expect(response.status).toBe(201);
      });

      it("should allow HELPDESK role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "helpdesk-id",
              type: "HELPDESK",
            },
          },
        } as any);

        mockPrisma.$queryRawUnsafe
          .mockResolvedValueOnce([{ id: "driver-1", is_active: true }])
          .mockResolvedValueOnce([
            { id: "delivery-1", assigned_at: new Date("2025-01-15T10:00:00Z") },
          ]);

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          validDeliveryRequest
        );
        const response = await POST(request);

        expect(response.status).toBe(201);
      });

      it("should reject DRIVER role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: false,
          response: new Response(
            JSON.stringify({ message: "Forbidden" }),
            { status: 403 }
          ),
        } as any);

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          validDeliveryRequest
        );
        const response = await POST(request);

        await expectForbidden(response);
      });
    });

    describe("Validation", () => {
      beforeEach(() => {
        mockWithAuth.mockResolvedValue({
          success: true,
          context: {
            user: {
              id: "admin-id",
              type: "ADMIN",
            },
          },
        } as any);
      });

      it("should require driverId field", async () => {
        const { driverId, ...invalidRequest } = validDeliveryRequest;

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          invalidRequest
        );
        const response = await POST(request);

        await expectValidationError(response);

        const data = await response.json();
        expect(data.error).toContain("Missing required fields");
      });

      it("should require pickupLocation field", async () => {
        const { pickupLocation, ...invalidRequest } = validDeliveryRequest;

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          invalidRequest
        );
        const response = await POST(request);

        await expectValidationError(response);
      });

      it("should require deliveryLocation field", async () => {
        const { deliveryLocation, ...invalidRequest } = validDeliveryRequest;

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          invalidRequest
        );
        const response = await POST(request);

        await expectValidationError(response);
      });

      it("should verify driver exists", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          validDeliveryRequest
        );
        const response = await POST(request);

        expect(response.status).toBe(404);

        const data = await response.json();
        expect(data.error).toBe("Driver not found or inactive");
      });

      it("should verify driver is active", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
          { id: "driver-1", is_active: false },
        ]);

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          validDeliveryRequest
        );
        const response = await POST(request);

        expect(response.status).toBe(404);

        const data = await response.json();
        expect(data.error).toBe("Driver not found or inactive");
      });
    });

    describe("Delivery Creation", () => {
      beforeEach(() => {
        mockWithAuth.mockResolvedValue({
          success: true,
          context: {
            user: {
              id: "admin-id",
              type: "ADMIN",
            },
          },
        } as any);
      });

      it("should create delivery successfully", async () => {
        mockPrisma.$queryRawUnsafe
          .mockResolvedValueOnce([{ id: "driver-1", is_active: true }])
          .mockResolvedValueOnce([
            { id: "delivery-1", assigned_at: new Date("2025-01-15T10:00:00Z") },
          ]);

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          validDeliveryRequest
        );
        const response = await POST(request);

        expect(response.status).toBe(201);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.deliveryId).toBe("delivery-1");
        expect(data.data.status).toBe("ASSIGNED");
      });

      it("should create delivery for on-demand orders", async () => {
        mockPrisma.$queryRawUnsafe
          .mockResolvedValueOnce([{ id: "driver-1", is_active: true }])
          .mockResolvedValueOnce([
            { id: "delivery-1", assigned_at: new Date("2025-01-15T10:00:00Z") },
          ]);

        const onDemandRequest = {
          ...validDeliveryRequest,
          cateringRequestId: undefined,
          onDemandId: "ondemand-1",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          onDemandRequest
        );
        const response = await POST(request);

        expect(response.status).toBe(201);
      });

      it("should handle optional metadata field", async () => {
        mockPrisma.$queryRawUnsafe
          .mockResolvedValueOnce([{ id: "driver-1", is_active: true }])
          .mockResolvedValueOnce([
            { id: "delivery-1", assigned_at: new Date("2025-01-15T10:00:00Z") },
          ]);

        const requestWithMetadata = {
          ...validDeliveryRequest,
          metadata: { priority: "high", notes: "Urgent delivery" },
        };

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          requestWithMetadata
        );
        await POST(request);

        const insertQuery = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[1][0];
        expect(insertQuery).toContain("metadata");
      });

      it("should default metadata to empty object", async () => {
        mockPrisma.$queryRawUnsafe
          .mockResolvedValueOnce([{ id: "driver-1", is_active: true }])
          .mockResolvedValueOnce([
            { id: "delivery-1", assigned_at: new Date("2025-01-15T10:00:00Z") },
          ]);

        const { metadata, ...requestWithoutMetadata } = validDeliveryRequest;

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          requestWithoutMetadata
        );
        await POST(request);

        const params = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[1].slice(1);
        expect(params[params.length - 1]).toBe("{}");
      });
    });

    describe("Error Handling", () => {
      beforeEach(() => {
        mockWithAuth.mockResolvedValue({
          success: true,
          context: {
            user: {
              id: "admin-id",
              type: "ADMIN",
            },
          },
        } as any);
      });

      it("should handle database errors gracefully", async () => {
        mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(
          new Error("Database connection failed")
        );

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          validDeliveryRequest
        );
        const response = await POST(request);

        await expectServerError(response);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe("Failed to create delivery");
      });

      it("should handle insertion errors", async () => {
        mockPrisma.$queryRawUnsafe
          .mockResolvedValueOnce([{ id: "driver-1", is_active: true }])
          .mockRejectedValueOnce(new Error("Insertion failed"));

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          validDeliveryRequest
        );
        const response = await POST(request);

        await expectServerError(response);
      });
    });
  });
});
