import { NextRequest } from "next/server";
import { GET } from "../route";
import { prisma } from "@/utils/prismaDB";
import { createClient } from "@/utils/supabase/server";

// Mock dependencies
jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    cateringRequest: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    onDemand: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe("/api/user-orders", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
  };

  const mockCateringOrder = {
    id: "catering-1",
    orderNumber: "CAT001",
    status: "ACTIVE",
    pickupDateTime: new Date("2025-01-15T10:00:00Z"),
    arrivalDateTime: new Date("2025-01-15T11:00:00Z"),
    orderTotal: 150.00,
    createdAt: new Date("2025-01-15T09:00:00Z"),
    userId: "test-user-id",
    deletedAt: null,
    user: { name: "Test User", email: "test@example.com" },
    pickupAddress: {
      address: "123 Pickup St",
      city: "San Francisco",
      state: "CA",
    },
    deliveryAddress: {
      address: "456 Delivery Ave",
      city: "San Francisco",
      state: "CA",
    },
    brokerage: true, // This identifies it as a catering order
  };

  const mockOnDemandOrder = {
    id: "ondemand-1",
    orderNumber: "OND001",
    status: "PENDING",
    pickupDateTime: new Date("2025-01-16T10:00:00Z"),
    arrivalDateTime: new Date("2025-01-16T11:00:00Z"),
    orderTotal: 75.50,
    createdAt: new Date("2025-01-16T09:00:00Z"),
    userId: "test-user-id",
    deletedAt: null,
    user: { name: "Test User", email: "test@example.com" },
    pickupAddress: {
      address: "789 Pickup Blvd",
      city: "Oakland",
      state: "CA",
    },
    deliveryAddress: {
      address: "012 Delivery Way",
      city: "Oakland",
      state: "CA",
    },
    // No brokerage field identifies it as on-demand
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Supabase client
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    } as any);
  });

  describe("GET /api/user-orders", () => {
    it("should return 401 when user is not authenticated", async () => {
      // Mock unauthenticated user
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      } as any);

      const request = {
        url: "http://localhost:3000/api/user-orders"
      } as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe("Unauthorized");
    });

    it("should return orders with default pagination (5 per page)", async () => {
      // Mock Prisma responses
      mockPrisma.cateringRequest.findMany.mockResolvedValue([mockCateringOrder]);
      mockPrisma.onDemand.findMany.mockResolvedValue([mockOnDemandOrder]);

      const request = {
        url: "http://localhost:3000/api/user-orders"
      } as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orders).toHaveLength(2);
      expect(data.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalOrders: 2,
        hasNextPage: false,
        hasPrevPage: false,
        ordersPerPage: 5,
      });

      // Verify orders are properly serialized
      expect(data.orders).toHaveLength(2);
      
      // Check that both orders are present (order may vary due to sorting by creation date)
      const cateringOrder = data.orders.find((order: any) => order.order_type === "catering");
      const onDemandOrder = data.orders.find((order: any) => order.order_type === "on_demand");
      
      expect(cateringOrder).toMatchObject({
        orderNumber: "CAT001",
        order_type: "catering",
        status: "ACTIVE",
      });
      expect(onDemandOrder).toMatchObject({
        orderNumber: "OND001",
        order_type: "on_demand",
        status: "PENDING",
      });
    });

    it("should handle custom pagination parameters", async () => {
      // Mock more orders for pagination testing
      const mockOrders = Array.from({ length: 8 }, (_, i) => ({
        ...mockCateringOrder,
        id: `catering-${i + 1}`,
        orderNumber: `CAT${String(i + 1).padStart(3, '0')}`,
        createdAt: new Date(`2025-01-${15 + i}T09:00:00Z`),
      }));

      mockPrisma.cateringRequest.findMany.mockResolvedValue(mockOrders);
      mockPrisma.onDemand.findMany.mockResolvedValue([]);

      const request = {
        url: "http://localhost:3000/api/user-orders?page=2&limit=3"
      } as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orders).toHaveLength(3);
      expect(data.pagination).toEqual({
        currentPage: 2,
        totalPages: 3, // 8 orders / 3 per page = 3 pages
        totalOrders: 8,
        hasNextPage: true,
        hasPrevPage: true,
        ordersPerPage: 3,
      });
    });

    it("should filter out deleted orders", async () => {
      const deletedOrder = {
        ...mockCateringOrder,
        deletedAt: new Date(),
      };

      mockPrisma.cateringRequest.findMany.mockResolvedValue([mockCateringOrder]);
      mockPrisma.onDemand.findMany.mockResolvedValue([]);

      const request = {
        url: "http://localhost:3000/api/user-orders"
      } as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orders).toHaveLength(1);
      expect(data.orders[0].deletedAt).toBeNull();
    });

    it("should sort orders by creation date (newest first)", async () => {
      const olderOrder = {
        ...mockCateringOrder,
        id: "catering-older",
        orderNumber: "CAT-OLDER",
        createdAt: new Date("2025-01-10T09:00:00Z"),
      };

      const newerOrder = {
        ...mockCateringOrder,
        id: "catering-newer",
        orderNumber: "CAT-NEWER",
        createdAt: new Date("2025-01-20T09:00:00Z"),
      };

      mockPrisma.cateringRequest.findMany.mockResolvedValue([olderOrder, newerOrder]);
      mockPrisma.onDemand.findMany.mockResolvedValue([]);

      const request = {
        url: "http://localhost:3000/api/user-orders"
      } as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // The newer order should come first due to sorting by creation date (newest first)
      expect(data.orders[0].orderNumber).toBe("CAT-NEWER");
      expect(data.orders[1].orderNumber).toBe("CAT-OLDER");
    });

    it("should handle empty results", async () => {
      mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
      mockPrisma.onDemand.findMany.mockResolvedValue([]);

      const request = {
        url: "http://localhost:3000/api/user-orders"
      } as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orders).toHaveLength(0);
      expect(data.pagination).toEqual({
        currentPage: 1,
        totalPages: 0,
        totalOrders: 0,
        hasNextPage: false,
        hasPrevPage: false,
        ordersPerPage: 5,
      });
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.cateringRequest.findMany.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = {
        url: "http://localhost:3000/api/user-orders"
      } as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe("Error fetching user orders");
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });

    it("should properly serialize bigint values", async () => {
      const orderWithBigInt = {
        ...mockCateringOrder,
        orderTotal: BigInt(15000), // 150.00 as cents
      };

      mockPrisma.cateringRequest.findMany.mockResolvedValue([orderWithBigInt]);
      mockPrisma.onDemand.findMany.mockResolvedValue([]);

      const request = {
        url: "http://localhost:3000/api/user-orders"
      } as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.orders[0].orderTotal).toBe("string");
      expect(data.orders[0].orderTotal).toBe("15000");
    });

    it("should handle last page pagination correctly", async () => {
      // Mock 7 orders total, 5 per page = 2 pages
      const mockOrders = Array.from({ length: 7 }, (_, i) => ({
        ...mockCateringOrder,
        id: `catering-${i + 1}`,
        orderNumber: `CAT${String(i + 1).padStart(3, '0')}`,
      }));

      mockPrisma.cateringRequest.findMany.mockResolvedValue(mockOrders);
      mockPrisma.onDemand.findMany.mockResolvedValue([]);

      const request = {
        url: "http://localhost:3000/api/user-orders?page=2&limit=5"
      } as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orders).toHaveLength(2); // Only 2 orders on page 2
      expect(data.pagination).toEqual({
        currentPage: 2,
        totalPages: 2,
        totalOrders: 7,
        hasNextPage: false,
        hasPrevPage: true,
        ordersPerPage: 5,
      });
    });
  });
}); 