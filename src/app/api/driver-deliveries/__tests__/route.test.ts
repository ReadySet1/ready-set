/**
 * Tests for /api/driver-deliveries route
 *
 * This route is BUSINESS CRITICAL as it shows drivers their assigned deliveries
 *
 * Tests cover:
 * - GET: Fetching driver's assigned deliveries
 * - Authentication enforcement
 * - Multi-tenant data isolation (drivers only see their deliveries)
 * - Pagination (limit, page)
 * - Combining catering and on-demand deliveries
 * - Sorting by createdAt
 * - Error handling
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import {
  createGetRequest,
  createRequestWithParams,
  expectSuccessResponse,
  expectUnauthorized,
  expectServerError,
  createMockCateringOrder,
  createMockOnDemandOrder,
  createMockAddress,
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies
jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    dispatch: {
      findMany: jest.fn(),
    },
    cateringRequest: {
      findMany: jest.fn(),
    },
    onDemand: {
      findMany: jest.fn(),
    },
    address: {
      findMany: jest.fn(),
    },
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockPrisma = prisma as any;

describe("/api/driver-deliveries", () => {
  const mockDriver = {
    id: "driver-id-123",
    email: "driver@example.com",
  };

  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
  };

  const mockCateringDispatch = {
    cateringRequestId: "catering-1",
    onDemandId: null,
  };

  const mockOnDemandDispatch = {
    cateringRequestId: null,
    onDemandId: "ondemand-1",
  };

  const mockPickupAddress = createMockAddress({
    id: "pickup-addr-1",
    address: "123 Pickup St",
  });

  const mockDeliveryAddress = createMockAddress({
    id: "delivery-addr-1",
    address: "456 Delivery Ave",
  });

  const mockCateringDelivery = createMockCateringOrder({
    id: "catering-1",
    orderNumber: "CAT001",
    user: {
      name: "Customer Name",
      email: "customer@example.com",
    },
    pickupAddress: mockPickupAddress,
    deliveryAddress: mockDeliveryAddress,
  });

  const mockOnDemandDelivery = createMockOnDemandOrder({
    id: "ondemand-1",
    orderNumber: "OND001",
    user: {
      name: "Customer Name",
      email: "customer@example.com",
    },
    pickupAddress: mockPickupAddress,
    deliveryAddressId: "delivery-addr-1",
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated driver
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockDriver },
      error: null,
    });
    mockCreateClient.mockResolvedValue(mockSupabase as any);

    // Default: no dispatches
    mockPrisma.dispatch.findMany.mockResolvedValue([]);
    mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
    mockPrisma.onDemand.findMany.mockResolvedValue([]);
    mockPrisma.address.findMany.mockResolvedValue([]);
  });

  describe("GET /api/driver-deliveries", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      await expectUnauthorized(response);
    });

    it("should return empty deliveries array when driver has no dispatches", async () => {
      mockPrisma.dispatch.findMany.mockResolvedValue([]);

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);
      expect(data).toHaveProperty('deliveries');
      expect(data).toHaveProperty('metadata');
      expect(Array.isArray(data.deliveries)).toBe(true);
      expect(data.deliveries).toHaveLength(0);
    });

    it("should fetch dispatches for the authenticated driver only", async () => {
      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      await GET(request);

      expect(mockPrisma.dispatch.findMany).toHaveBeenCalledWith({
        where: {
          driverId: mockDriver.id,
        },
        select: {
          cateringRequestId: true,
          onDemandId: true,
        },
      });
    });

    it("should return catering deliveries for the driver", async () => {
      mockPrisma.dispatch.findMany.mockResolvedValue([mockCateringDispatch]);
      mockPrisma.cateringRequest.findMany.mockResolvedValue([mockCateringDelivery]);

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      expect(data.deliveries).toHaveLength(1);
      expect(data.deliveries[0]).toMatchObject({
        id: mockCateringDelivery.id,
        orderNumber: mockCateringDelivery.orderNumber,
        delivery_type: "catering",
      });
    });

    it("should return on-demand deliveries for the driver", async () => {
      mockPrisma.dispatch.findMany.mockResolvedValue([mockOnDemandDispatch]);
      mockPrisma.onDemand.findMany.mockResolvedValue([mockOnDemandDelivery]);
      mockPrisma.address.findMany.mockResolvedValue([mockDeliveryAddress]);

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      expect(data.deliveries).toHaveLength(1);
      expect(data.deliveries[0]).toMatchObject({
        id: mockOnDemandDelivery.id,
        orderNumber: mockOnDemandDelivery.orderNumber,
        delivery_type: "on_demand",
      });
    });

    it("should combine catering and on-demand deliveries", async () => {
      mockPrisma.dispatch.findMany.mockResolvedValue([
        mockCateringDispatch,
        mockOnDemandDispatch,
      ]);
      mockPrisma.cateringRequest.findMany.mockResolvedValue([mockCateringDelivery]);
      mockPrisma.onDemand.findMany.mockResolvedValue([mockOnDemandDelivery]);
      mockPrisma.address.findMany.mockResolvedValue([mockDeliveryAddress]);

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      expect(data.deliveries).toHaveLength(2);
      expect(data.deliveries.some((d: any) => d.delivery_type === "catering")).toBe(true);
      expect(data.deliveries.some((d: any) => d.delivery_type === "on_demand")).toBe(true);
    });

    it("should include user information in deliveries", async () => {
      mockPrisma.dispatch.findMany.mockResolvedValue([mockCateringDispatch]);
      mockPrisma.cateringRequest.findMany.mockResolvedValue([mockCateringDelivery]);

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      expect(data.deliveries[0].user).toMatchObject({
        name: "Customer Name",
        email: "customer@example.com",
      });
    });

    it("should include pickup address in deliveries", async () => {
      mockPrisma.dispatch.findMany.mockResolvedValue([mockCateringDispatch]);
      mockPrisma.cateringRequest.findMany.mockResolvedValue([mockCateringDelivery]);

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      expect(data.deliveries[0].address).toMatchObject({
        id: mockPickupAddress.id,
        address: mockPickupAddress.address,
      });
    });

    it("should include delivery address in deliveries", async () => {
      mockPrisma.dispatch.findMany.mockResolvedValue([mockCateringDispatch]);
      mockPrisma.cateringRequest.findMany.mockResolvedValue([mockCateringDelivery]);

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      expect(data.deliveries[0].delivery_address).toMatchObject({
        id: mockDeliveryAddress.id,
        address: mockDeliveryAddress.address,
      });
    });

    it("should apply default pagination (limit 10, page 1)", async () => {
      const deliveries = Array.from({ length: 15 }, (_, i) => ({
        cateringRequestId: `catering-${i}`,
        onDemandId: null,
      }));

      const cateringDeliveries = Array.from({ length: 15 }, (_, i) =>
        createMockCateringOrder({
          id: `catering-${i}`,
          orderNumber: `CAT${String(i).padStart(3, "0")}`,
          createdAt: new Date(Date.now() - i * 1000 * 60 * 60),
        })
      );

      mockPrisma.dispatch.findMany.mockResolvedValue(deliveries);
      mockPrisma.cateringRequest.findMany.mockResolvedValue(cateringDeliveries);

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      // Should return first 10 items
      expect(data.deliveries).toHaveLength(10);
    });

    it("should support custom limit parameter", async () => {
      const deliveries = Array.from({ length: 20 }, (_, i) => ({
        cateringRequestId: `catering-${i}`,
        onDemandId: null,
      }));

      const cateringDeliveries = Array.from({ length: 20 }, (_, i) =>
        createMockCateringOrder({
          id: `catering-${i}`,
          orderNumber: `CAT${String(i).padStart(3, "0")}`,
          createdAt: new Date(Date.now() - i * 1000 * 60 * 60),
        })
      );

      mockPrisma.dispatch.findMany.mockResolvedValue(deliveries);
      mockPrisma.cateringRequest.findMany.mockResolvedValue(cateringDeliveries);

      const request = createRequestWithParams("http://localhost:3000/api/driver-deliveries", {
        limit: "5",
      });
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      expect(data.deliveries).toHaveLength(5);
    });

    it("should support page parameter for pagination", async () => {
      const deliveries = Array.from({ length: 20 }, (_, i) => ({
        cateringRequestId: `catering-${i}`,
        onDemandId: null,
      }));

      const cateringDeliveries = Array.from({ length: 20 }, (_, i) =>
        createMockCateringOrder({
          id: `catering-${i}`,
          orderNumber: `CAT${String(i).padStart(3, "0")}`,
          createdAt: new Date(Date.now() - i * 1000 * 60 * 60),
        })
      );

      mockPrisma.dispatch.findMany.mockResolvedValue(deliveries);
      mockPrisma.cateringRequest.findMany.mockResolvedValue(cateringDeliveries);

      const request = createRequestWithParams("http://localhost:3000/api/driver-deliveries", {
        limit: "5",
        page: "2",
      });
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      // Should skip first 5 and return next 5
      expect(data.deliveries).toHaveLength(5);
    });

    it("should sort deliveries by createdAt descending", async () => {
      const now = Date.now();
      const delivery1 = createMockCateringOrder({
        id: "catering-1",
        orderNumber: "CAT001",
        createdAt: new Date(now - 3600000), // 1 hour ago
      });
      const delivery2 = createMockCateringOrder({
        id: "catering-2",
        orderNumber: "CAT002",
        createdAt: new Date(now - 1800000), // 30 minutes ago
      });
      const delivery3 = createMockCateringOrder({
        id: "catering-3",
        orderNumber: "CAT003",
        createdAt: new Date(now - 900000), // 15 minutes ago
      });

      mockPrisma.dispatch.findMany.mockResolvedValue([
        { cateringRequestId: "catering-1", onDemandId: null },
        { cateringRequestId: "catering-2", onDemandId: null },
        { cateringRequestId: "catering-3", onDemandId: null },
      ]);
      mockPrisma.cateringRequest.findMany.mockResolvedValue([
        delivery1,
        delivery2,
        delivery3,
      ]);

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      // Most recent should be first
      expect(data.deliveries[0].id).toBe("catering-3");
      expect(data.deliveries[1].id).toBe("catering-2");
      expect(data.deliveries[2].id).toBe("catering-1");
    });

    it("should serialize bigint values correctly", async () => {
      const deliveryWithBigInt = {
        ...mockCateringDelivery,
        someBigIntField: BigInt("9007199254740991"),
      };

      mockPrisma.dispatch.findMany.mockResolvedValue([mockCateringDispatch]);
      mockPrisma.cateringRequest.findMany.mockResolvedValue([deliveryWithBigInt]);

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      // Should not throw JSON serialization error
      expect(data.deliveries).toHaveLength(1);
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.dispatch.findMany.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      await expectServerError(response);
    });

    it("should handle errors when fetching catering requests", async () => {
      mockPrisma.dispatch.findMany.mockResolvedValue([mockCateringDispatch]);
      mockPrisma.cateringRequest.findMany.mockRejectedValue(
        new Error("Failed to fetch catering requests")
      );

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      await expectServerError(response);
    });

    it("should handle errors when fetching on-demand requests", async () => {
      mockPrisma.dispatch.findMany.mockResolvedValue([mockOnDemandDispatch]);
      mockPrisma.onDemand.findMany.mockRejectedValue(
        new Error("Failed to fetch on-demand requests")
      );

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      const response = await GET(request);

      await expectServerError(response);
    });

    it("should not allow one driver to see another driver's deliveries", async () => {
      // This test verifies multi-tenant isolation
      const otherDriverId = "other-driver-id";

      const request = createGetRequest("http://localhost:3000/api/driver-deliveries");
      await GET(request);

      // Verify the query filters by the authenticated driver's ID only
      expect(mockPrisma.dispatch.findMany).toHaveBeenCalledWith({
        where: {
          driverId: mockDriver.id, // NOT otherDriverId
        },
        select: {
          cateringRequestId: true,
          onDemandId: true,
        },
      });

      expect(mockPrisma.dispatch.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            driverId: otherDriverId,
          }),
        })
      );
    });
  });
});
