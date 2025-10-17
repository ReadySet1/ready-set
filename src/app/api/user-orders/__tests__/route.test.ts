/**
 * Tests for /api/user-orders route
 *
 * This route is BUSINESS CRITICAL as it shows users their order history
 *
 * Tests cover:
 * - GET: Fetching user's orders with pagination
 * - Authentication enforcement (401 for unauthenticated)
 * - Multi-tenant data isolation (users only see their own orders)
 * - Soft-delete protection (deleted orders are filtered out)
 * - Pagination (limit, page query parameters)
 * - Order type detection (catering vs on-demand)
 * - Sorting by createdAt descending
 * - BigInt serialization
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
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies
jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    cateringRequest: {
      findMany: jest.fn(),
    },
    onDemand: {
      findMany: jest.fn(),
    },
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockPrisma = prisma as any;

describe("/api/user-orders", () => {
  const mockUser = {
    id: "user-id-123",
    email: "user@example.com",
  };

  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mockCreateClient.mockResolvedValue(mockSupabase as any);

    // Default: no orders
    mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
    mockPrisma.onDemand.findMany.mockResolvedValue([]);
  });

  describe("GET /api/user-orders", () => {
    describe("Authentication", () => {
      it("should return 401 when not authenticated", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        await expectUnauthorized(response);
      });

      it("should return 401 when user id is missing", async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { email: "test@example.com" } }, // No id
          error: null,
        });

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        await expectUnauthorized(response);
      });
    });

    describe("Multi-Tenant Data Isolation", () => {
      it("should only fetch orders for the authenticated user", async () => {
        const request = createGetRequest("http://localhost:3000/api/user-orders");
        await GET(request);

        // Verify catering orders query includes userId filter
        expect(mockPrisma.cateringRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              userId: mockUser.id,
              deletedAt: null,
            },
          })
        );

        // Verify on-demand orders query includes userId filter
        expect(mockPrisma.onDemand.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              userId: mockUser.id,
              deletedAt: null,
            },
          })
        );
      });

      it("should not return orders from other users", async () => {
        const otherUserId = "other-user-id";

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        await GET(request);

        // Verify queries do NOT use other user's ID
        expect(mockPrisma.cateringRequest.findMany).not.toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              userId: otherUserId,
            }),
          })
        );

        expect(mockPrisma.onDemand.findMany).not.toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              userId: otherUserId,
            }),
          })
        );
      });
    });

    describe("Soft-Delete Protection", () => {
      it("should filter out deleted catering orders", async () => {
        const request = createGetRequest("http://localhost:3000/api/user-orders");
        await GET(request);

        expect(mockPrisma.cateringRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              deletedAt: null,
            }),
          })
        );
      });

      it("should filter out deleted on-demand orders", async () => {
        const request = createGetRequest("http://localhost:3000/api/user-orders");
        await GET(request);

        expect(mockPrisma.onDemand.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              deletedAt: null,
            }),
          })
        );
      });
    });

    describe("Order Fetching", () => {
      it("should return empty array when user has no orders", async () => {
        mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
        mockPrisma.onDemand.findMany.mockResolvedValue([]);

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.orders).toEqual([]);
        expect(data.pagination.totalOrders).toBe(0);
      });

      it("should return catering orders only if user has no on-demand orders", async () => {
        const cateringOrder = createMockCateringOrder();
        mockPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
        mockPrisma.onDemand.findMany.mockResolvedValue([]);

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.orders).toHaveLength(1);
        expect(data.orders[0].order_type).toBe("catering");
      });

      it("should return on-demand orders only if user has no catering orders", async () => {
        const onDemandOrder = createMockOnDemandOrder();
        mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
        mockPrisma.onDemand.findMany.mockResolvedValue([onDemandOrder]);

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.orders).toHaveLength(1);
        expect(data.orders[0].order_type).toBe("on_demand");
      });

      it("should combine catering and on-demand orders", async () => {
        const cateringOrder = createMockCateringOrder();
        const onDemandOrder = createMockOnDemandOrder();

        mockPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
        mockPrisma.onDemand.findMany.mockResolvedValue([onDemandOrder]);

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.orders).toHaveLength(2);
        expect(data.orders.some((o: any) => o.order_type === "catering")).toBe(true);
        expect(data.orders.some((o: any) => o.order_type === "on_demand")).toBe(true);
      });

      it("should include user information in orders", async () => {
        const cateringOrder = createMockCateringOrder();
        mockPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.orders[0].user).toBeDefined();
        expect(data.orders[0].user.name).toBe(cateringOrder.user.name);
        expect(data.orders[0].user.email).toBe(cateringOrder.user.email);
      });

      it("should include address information in orders", async () => {
        const cateringOrder = createMockCateringOrder();
        mockPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.orders[0].pickupAddress).toBeDefined();
        expect(data.orders[0].deliveryAddress).toBeDefined();
      });
    });

    describe("Sorting", () => {
      it("should sort orders by createdAt descending (most recent first)", async () => {
        const now = Date.now();
        const order1 = createMockCateringOrder({
          id: "order-1",
          createdAt: new Date(now - 3600000), // 1 hour ago
        });
        const order2 = createMockCateringOrder({
          id: "order-2",
          createdAt: new Date(now - 1800000), // 30 minutes ago
        });
        const order3 = createMockCateringOrder({
          id: "order-3",
          createdAt: new Date(now - 900000), // 15 minutes ago
        });

        mockPrisma.cateringRequest.findMany.mockResolvedValue([order1, order2, order3]);

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        // Most recent should be first
        expect(data.orders[0].id).toBe("order-3");
        expect(data.orders[1].id).toBe("order-2");
        expect(data.orders[2].id).toBe("order-1");
      });

      it("should sort combined catering and on-demand orders by date", async () => {
        const now = Date.now();
        const cateringOrder = createMockCateringOrder({
          id: "catering-1",
          createdAt: new Date(now - 1800000), // 30 minutes ago
        });
        const onDemandOrder = createMockOnDemandOrder({
          id: "ondemand-1",
          createdAt: new Date(now - 900000), // 15 minutes ago
        });

        mockPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
        mockPrisma.onDemand.findMany.mockResolvedValue([onDemandOrder]);

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        // On-demand order should be first (more recent)
        expect(data.orders[0].id).toBe("ondemand-1");
        expect(data.orders[1].id).toBe("catering-1");
      });
    });

    describe("Pagination", () => {
      it("should apply default pagination (limit=5, page=1)", async () => {
        const orders = Array.from({ length: 10 }, (_, i) =>
          createMockCateringOrder({
            id: `order-${i}`,
            createdAt: new Date(Date.now() - i * 1000 * 60 * 60),
          })
        );

        mockPrisma.cateringRequest.findMany.mockResolvedValue(orders);

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        // Should return first 5 items
        expect(data.orders).toHaveLength(5);
        expect(data.pagination.currentPage).toBe(1);
        expect(data.pagination.ordersPerPage).toBe(5);
        expect(data.pagination.totalOrders).toBe(10);
        expect(data.pagination.totalPages).toBe(2);
      });

      it("should support custom limit parameter", async () => {
        const orders = Array.from({ length: 20 }, (_, i) =>
          createMockCateringOrder({
            id: `order-${i}`,
            createdAt: new Date(Date.now() - i * 1000 * 60 * 60),
          })
        );

        mockPrisma.cateringRequest.findMany.mockResolvedValue(orders);

        const request = createRequestWithParams("http://localhost:3000/api/user-orders", {
          limit: "10",
        });
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.orders).toHaveLength(10);
        expect(data.pagination.ordersPerPage).toBe(10);
      });

      it("should support page parameter for pagination", async () => {
        const orders = Array.from({ length: 20 }, (_, i) =>
          createMockCateringOrder({
            id: `order-${i}`,
            createdAt: new Date(Date.now() - i * 1000 * 60 * 60),
          })
        );

        mockPrisma.cateringRequest.findMany.mockResolvedValue(orders);

        const request = createRequestWithParams("http://localhost:3000/api/user-orders", {
          limit: "5",
          page: "2",
        });
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        // Should skip first 5 and return next 5
        expect(data.orders).toHaveLength(5);
        expect(data.pagination.currentPage).toBe(2);
        expect(data.orders[0].id).toBe("order-5");
      });

      it("should calculate hasNextPage correctly", async () => {
        const orders = Array.from({ length: 10 }, (_, i) =>
          createMockCateringOrder({
            id: `order-${i}`,
            createdAt: new Date(Date.now() - i * 1000 * 60 * 60),
          })
        );

        mockPrisma.cateringRequest.findMany.mockResolvedValue(orders);

        const request = createRequestWithParams("http://localhost:3000/api/user-orders", {
          limit: "5",
          page: "1",
        });
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.pagination.hasNextPage).toBe(true);
      });

      it("should calculate hasPrevPage correctly", async () => {
        const orders = Array.from({ length: 10 }, (_, i) =>
          createMockCateringOrder({
            id: `order-${i}`,
            createdAt: new Date(Date.now() - i * 1000 * 60 * 60),
          })
        );

        mockPrisma.cateringRequest.findMany.mockResolvedValue(orders);

        const request = createRequestWithParams("http://localhost:3000/api/user-orders", {
          limit: "5",
          page: "2",
        });
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.pagination.hasPrevPage).toBe(true);
      });

      it("should calculate totalPages correctly", async () => {
        const orders = Array.from({ length: 12 }, (_, i) =>
          createMockCateringOrder({
            id: `order-${i}`,
            createdAt: new Date(Date.now() - i * 1000 * 60 * 60),
          })
        );

        mockPrisma.cateringRequest.findMany.mockResolvedValue(orders);

        const request = createRequestWithParams("http://localhost:3000/api/user-orders", {
          limit: "5",
        });
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        // 12 orders / 5 per page = 2.4 => 3 pages
        expect(data.pagination.totalPages).toBe(3);
      });
    });

    describe("BigInt Serialization", () => {
      it("should serialize bigint values correctly", async () => {
        const orderWithBigInt = {
          ...createMockCateringOrder(),
          someBigIntField: BigInt("9007199254740991"),
        };

        mockPrisma.cateringRequest.findMany.mockResolvedValue([orderWithBigInt]);

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        // Should not throw JSON serialization error
        expect(data.orders).toHaveLength(1);
      });
    });

    describe("Order Type Detection", () => {
      it("should detect catering orders by 'brokerage' field", async () => {
        const cateringOrder = createMockCateringOrder({
          brokerage: true, // This indicates catering order
        });

        mockPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.orders[0].order_type).toBe("catering");
      });

      it("should detect on-demand orders by absence of 'brokerage' field", async () => {
        const onDemandOrder = createMockOnDemandOrder();
        // On-demand orders don't have 'brokerage' field

        mockPrisma.onDemand.findMany.mockResolvedValue([onDemandOrder]);

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.orders[0].order_type).toBe("on_demand");
      });
    });

    describe("Error Handling", () => {
      it("should handle database errors gracefully", async () => {
        mockPrisma.cateringRequest.findMany.mockRejectedValue(
          new Error("Database connection failed")
        );

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        await expectServerError(response);
      });

      it("should handle errors when fetching catering orders", async () => {
        mockPrisma.cateringRequest.findMany.mockRejectedValue(
          new Error("Failed to fetch catering orders")
        );

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        await expectServerError(response);
      });

      it("should handle errors when fetching on-demand orders", async () => {
        mockPrisma.onDemand.findMany.mockRejectedValue(
          new Error("Failed to fetch on-demand orders")
        );

        const request = createGetRequest("http://localhost:3000/api/user-orders");
        const response = await GET(request);

        await expectServerError(response);
      });
    });

    describe("Edge Cases", () => {
      it("should handle request without URL (test environment)", async () => {
        mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
        mockPrisma.onDemand.findMany.mockResolvedValue([]);

        // Create request without URL
        const request = new NextRequest("http://localhost:3000/api/user-orders");
        Object.defineProperty(request, 'url', { value: undefined, writable: true });

        const response = await GET(request);

        // Should use default URL and not crash
        const data = await expectSuccessResponse(response, 200);
        expect(data.orders).toEqual([]);
      });

      it("should handle invalid page number gracefully", async () => {
        const orders = Array.from({ length: 10 }, (_, i) =>
          createMockCateringOrder({ id: `order-${i}` })
        );

        mockPrisma.cateringRequest.findMany.mockResolvedValue(orders);

        const request = createRequestWithParams("http://localhost:3000/api/user-orders", {
          page: "0", // Invalid: page should be >= 1
        });
        const response = await GET(request);

        // Should handle gracefully and treat as page 1 or similar
        const data = await expectSuccessResponse(response, 200);
        expect(data.orders).toBeDefined();
      });

      it("should handle invalid limit gracefully", async () => {
        const orders = Array.from({ length: 10 }, (_, i) =>
          createMockCateringOrder({ id: `order-${i}` })
        );

        mockPrisma.cateringRequest.findMany.mockResolvedValue(orders);

        const request = createRequestWithParams("http://localhost:3000/api/user-orders", {
          limit: "not-a-number",
        });
        const response = await GET(request);

        // Should handle gracefully and use default limit
        const data = await expectSuccessResponse(response, 200);
        expect(data.orders).toBeDefined();
      });

      it("should handle empty page beyond total pages", async () => {
        const orders = Array.from({ length: 5 }, (_, i) =>
          createMockCateringOrder({ id: `order-${i}` })
        );

        mockPrisma.cateringRequest.findMany.mockResolvedValue(orders);

        const request = createRequestWithParams("http://localhost:3000/api/user-orders", {
          page: "10", // Way beyond available pages
        });
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        // Should return empty array for out-of-range pages
        expect(data.orders).toHaveLength(0);
      });
    });
  });
});
