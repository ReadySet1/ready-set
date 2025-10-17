/**
 * Tests for /api/tracking/deliveries route
 *
 * This route is BUSINESS CRITICAL as it handles real-time delivery tracking with geospatial data
 *
 * Tests cover:
 * - GET: Delivery tracking with multi-tenant isolation, geospatial queries, pagination
 * - POST: Delivery assignment creation with driver verification
 * - Role-based access control and data isolation
 * - PostGIS geospatial data handling
 * - Error handling and validation
 */

import { NextRequest } from "next/server";
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
  const mockDeliveries = [
    {
      id: "delivery-1",
      catering_request_id: "catering-1",
      on_demand_id: null,
      driver_id: "driver-1",
      status: "ASSIGNED",
      pickup_location_geojson: '{"type":"Point","coordinates":[-122.4194,37.7749]}',
      delivery_location_geojson: '{"type":"Point","coordinates":[-122.4084,37.7849]}',
      estimated_arrival: new Date("2025-01-15T12:00:00Z"),
      actual_arrival: null,
      proof_of_delivery: null,
      actual_distance_km: null,
      route_polyline: null,
      metadata: {},
      assigned_at: new Date("2025-01-15T10:00:00Z"),
      started_at: null,
      arrived_at: null,
      completed_at: null,
      created_at: new Date("2025-01-15T10:00:00Z"),
      updated_at: new Date("2025-01-15T10:00:00Z"),
      employee_id: "EMP001",
      vehicle_number: "VEH001",
    },
    {
      id: "delivery-2",
      catering_request_id: null,
      on_demand_id: "ondemand-1",
      driver_id: "driver-1",
      status: "IN_PROGRESS",
      pickup_location_geojson: '{"type":"Point","coordinates":[-122.4194,37.7749]}',
      delivery_location_geojson: '{"type":"Point","coordinates":[-122.4084,37.7849]}',
      estimated_arrival: new Date("2025-01-15T14:00:00Z"),
      actual_arrival: null,
      proof_of_delivery: null,
      actual_distance_km: 5.2,
      route_polyline: "encoded_polyline_string",
      metadata: { notes: "Fragile items" },
      assigned_at: new Date("2025-01-15T11:00:00Z"),
      started_at: new Date("2025-01-15T11:30:00Z"),
      arrived_at: null,
      completed_at: null,
      created_at: new Date("2025-01-15T11:00:00Z"),
      updated_at: new Date("2025-01-15T11:30:00Z"),
      employee_id: "EMP001",
      vehicle_number: "VEH001",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
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
      it("should filter deliveries by driver ID for DRIVER role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "driver-user-id",
              type: "DRIVER",
            },
          },
        } as any);

        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveries[0]]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        await GET(request);

        const query = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
        const params = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);

        expect(query).toContain("SELECT id FROM drivers WHERE user_id");
        expect(params).toContain("driver-user-id");
      });

      it("should not filter by driver ID for ADMIN role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "admin-id",
              type: "ADMIN",
            },
          },
        } as any);

        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(mockDeliveries);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        await GET(request);

        const query = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
        const params = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);

        expect(query).not.toContain("SELECT id FROM drivers WHERE user_id");
      });

      it("should hide driverInfo from DRIVER role responses", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "driver-user-id",
              type: "DRIVER",
            },
          },
        } as any);

        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveries[0]]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.data[0].driverInfo).toBeUndefined();
      });

      it("should include driverInfo for ADMIN role responses", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "admin-id",
              type: "ADMIN",
            },
          },
        } as any);

        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveries[0]]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.data[0].driverInfo).toBeDefined();
        expect(data.data[0].driverInfo.employeeId).toBe("EMP001");
        expect(data.data[0].driverInfo.vehicleNumber).toBe("VEH001");
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
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveries[0]]);

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/deliveries",
          { driver_id: "driver-1" }
        );
        await GET(request);

        const query = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
        const params = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);

        expect(query).toContain("AND d.driver_id =");
        expect(params).toContain("driver-1");
      });

      it("should filter by status query parameter", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveries[1]]);

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/deliveries",
          { status: "IN_PROGRESS" }
        );
        await GET(request);

        const query = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0];
        const params = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);

        expect(query).toContain("AND d.status =");
        expect(params).toContain("IN_PROGRESS");
      });

      it("should use default limit of 50", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        await GET(request);

        const params = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);
        expect(params).toContain(50);
      });

      it("should use custom limit parameter", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/deliveries",
          { limit: "10" }
        );
        await GET(request);

        const params = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);
        expect(params).toContain(10);
      });

      it("should use default offset of 0", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        await GET(request);

        const params = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);
        expect(params).toContain(0);
      });

      it("should use custom offset parameter", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/deliveries",
          { offset: "20" }
        );
        await GET(request);

        const params = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0].slice(1);
        expect(params).toContain(20);
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

      it("should parse pickup location GeoJSON correctly", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveries[0]]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        // GeoJSON coordinates are reversed to [lat, lng] format
        expect(data.data[0].pickupLocation).toEqual([37.7749, -122.4194]);
      });

      it("should parse delivery location GeoJSON correctly", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveries[0]]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        // GeoJSON coordinates are reversed to [lat, lng] format
        expect(data.data[0].deliveryLocation).toEqual([37.7849, -122.4084]);
      });

      it("should handle null geospatial data gracefully", async () => {
        const deliveryWithNullGeo = {
          ...mockDeliveries[0],
          pickup_location_geojson: null,
          delivery_location_geojson: null,
        };

        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([deliveryWithNullGeo]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.data[0].pickupLocation).toEqual({ lat: 0, lng: 0 });
        expect(data.data[0].deliveryLocation).toEqual({ lat: 0, lng: 0 });
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
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveries[0]]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data).toHaveProperty("pagination");
        expect(Array.isArray(data.data)).toBe(true);
      });

      it("should include pagination metadata", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(mockDeliveries);

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/deliveries",
          { limit: "10", offset: "20" }
        );
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.pagination).toEqual({
          limit: 10,
          offset: 20,
          total: 2,
        });
      });

      it("should include all delivery fields", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockDeliveries[0]]);

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);
        const delivery = data.data[0];

        expect(delivery).toHaveProperty("id");
        expect(delivery).toHaveProperty("cateringRequestId");
        expect(delivery).toHaveProperty("onDemandId");
        expect(delivery).toHaveProperty("driverId");
        expect(delivery).toHaveProperty("status");
        expect(delivery).toHaveProperty("pickupLocation");
        expect(delivery).toHaveProperty("deliveryLocation");
        expect(delivery).toHaveProperty("estimatedArrival");
        expect(delivery).toHaveProperty("actualArrival");
        expect(delivery).toHaveProperty("route");
        expect(delivery).toHaveProperty("proofOfDelivery");
        expect(delivery).toHaveProperty("actualDistanceKm");
        expect(delivery).toHaveProperty("routePolyline");
        expect(delivery).toHaveProperty("metadata");
        expect(delivery).toHaveProperty("assignedAt");
        expect(delivery).toHaveProperty("startedAt");
        expect(delivery).toHaveProperty("arrivedAt");
        expect(delivery).toHaveProperty("completedAt");
        expect(delivery).toHaveProperty("createdAt");
        expect(delivery).toHaveProperty("updatedAt");
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
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(
          new Error("Database connection failed")
        );

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        await expectServerError(response);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe("Failed to fetch deliveries");
        expect(data.details).toBe("Database connection failed");

        consoleErrorSpy.mockRestore();
      });

      it("should handle invalid GeoJSON gracefully", async () => {
        const deliveryWithInvalidGeo = {
          ...mockDeliveries[0],
          pickup_location_geojson: "invalid json",
        };

        mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([deliveryWithInvalidGeo]);

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        const request = createGetRequest("http://localhost:3000/api/tracking/deliveries");
        const response = await GET(request);

        await expectServerError(response);

        consoleErrorSpy.mockRestore();
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
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

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

        consoleErrorSpy.mockRestore();
      });

      it("should handle insertion errors", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        mockPrisma.$queryRawUnsafe
          .mockResolvedValueOnce([{ id: "driver-1", is_active: true }])
          .mockRejectedValueOnce(new Error("Insertion failed"));

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/deliveries",
          validDeliveryRequest
        );
        const response = await POST(request);

        await expectServerError(response);

        consoleErrorSpy.mockRestore();
      });
    });
  });
});
