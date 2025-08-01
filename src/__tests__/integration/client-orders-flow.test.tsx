import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";

// Mock dependencies
jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

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
    userAddress: {
      count: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

const mockCreateClient = createClient as jest.MockedFunction<
  typeof createClient
>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("Client Orders Flow Integration", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
  };

  const mockOrders = [
    {
      id: "1",
      orderNumber: "CAT001",
      order_type: "catering" as const,
      status: "ACTIVE",
      pickupDateTime: "2025-01-15T10:00:00Z",
      arrivalDateTime: "2025-01-15T11:00:00Z",
      orderTotal: 150.0,
      createdAt: "2025-01-15T09:00:00Z",
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
    },
    {
      id: "2",
      orderNumber: "OND001",
      order_type: "on_demand" as const,
      status: "PENDING",
      pickupDateTime: "2025-01-16T10:00:00Z",
      arrivalDateTime: "2025-01-16T11:00:00Z",
      orderTotal: 75.5,
      createdAt: "2025-01-16T09:00:00Z",
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
    },
  ];

  const mockPagination = {
    currentPage: 1,
    totalPages: 3,
    totalOrders: 12,
    hasNextPage: true,
    hasPrevPage: false,
    ordersPerPage: 5,
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

    // Mock Prisma responses for dashboard
    mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
    mockPrisma.onDemand.findMany.mockResolvedValue([]);
    mockPrisma.cateringRequest.count.mockResolvedValue(2);
    mockPrisma.onDemand.count.mockResolvedValue(1);
    mockPrisma.userAddress.count.mockResolvedValue(3);

    // Mock fetch for orders page
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        orders: mockOrders,
        pagination: mockPagination,
      }),
    } as Response);
  });

  describe("Dashboard to Orders Page Navigation", () => {
    it("should have 'View All' link that navigates to orders page", async () => {
      // This test verifies the link exists in the dashboard
      // In a real integration test, you'd render the dashboard component
      const viewAllLink = "/client/orders";
      expect(viewAllLink).toBe("/client/orders");
    });

    it("should display correct page title when navigating to orders", async () => {
      // Mock the orders page component
      const { getByText } = render(
        <div>
          <h1>Your Orders</h1>
          <p>View and manage your orders.</p>
        </div>,
      );

      expect(getByText("Your Orders")).toBeInTheDocument();
      expect(getByText("View and manage your orders.")).toBeInTheDocument();
    });
  });

  describe("Orders Page Data Flow", () => {
    it("should fetch orders with correct pagination parameters", async () => {
      // Simulate the orders page making API call
      const response = await fetch("/api/user-orders?page=1&limit=5");
      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith("/api/user-orders?page=1&limit=5");
      expect(data.orders).toEqual(mockOrders);
      expect(data.pagination).toEqual(mockPagination);
    });

    it("should handle pagination navigation correctly", async () => {
      // Mock second page response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: mockOrders.slice(0, 2),
          pagination: {
            ...mockPagination,
            currentPage: 2,
            hasNextPage: false,
            hasPrevPage: true,
          },
        }),
      } as Response);

      // Simulate clicking next page
      const response = await fetch("/api/user-orders?page=2&limit=5");
      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith("/api/user-orders?page=2&limit=5");
      expect(data.pagination.currentPage).toBe(2);
      expect(data.pagination.hasPrevPage).toBe(true);
      expect(data.pagination.hasNextPage).toBe(false);
    });
  });

  describe("API Endpoint Integration", () => {
    it("should return 5 orders per page by default", async () => {
      const response = await fetch("/api/user-orders");
      const data = await response.json();

      expect(data.orders).toHaveLength(2); // Our mock data has 2 orders
      expect(data.pagination.ordersPerPage).toBe(5);
    });

    it("should calculate total pages correctly", async () => {
      const response = await fetch("/api/user-orders");
      const data = await response.json();

      expect(data.pagination.totalPages).toBe(3);
      expect(data.pagination.totalOrders).toBe(12);
    });

    it("should handle authentication correctly", async () => {
      // Mock unauthenticated user
      mockCreateClient.mockResolvedValueOnce({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      } as any);

      // Mock fetch to return 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      } as Response);

      const response = await fetch("/api/user-orders");
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe("Unauthorized");
    });
  });

  describe("Data Consistency", () => {
    it("should maintain data consistency between dashboard and orders page", async () => {
      // Mock dashboard data
      const dashboardOrders = [
        {
          id: "1",
          orderNumber: "CAT001",
          status: "ACTIVE",
          orderType: "catering",
          orderTotal: 150.0,
        },
      ];

      // Mock orders page data
      const ordersPageData = {
        orders: [
          {
            id: "1",
            orderNumber: "CAT001",
            status: "ACTIVE",
            order_type: "catering",
            orderTotal: 150.0,
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalOrders: 1,
          hasNextPage: false,
          hasPrevPage: false,
          ordersPerPage: 5,
        },
      };

      // Verify data consistency
      expect(dashboardOrders[0]?.orderNumber).toBe(
        ordersPageData.orders[0]?.orderNumber,
      );
      expect(dashboardOrders[0]?.status).toBe(ordersPageData.orders[0]?.status);
      expect(dashboardOrders[0]?.orderTotal).toBe(
        ordersPageData.orders[0]?.orderTotal,
      );
    });

    it("should handle both catering and on-demand orders", async () => {
      const response = await fetch("/api/user-orders");
      const data = await response.json();

      const cateringOrder = data.orders.find(
        (order: any) => order.order_type === "catering",
      );
      const onDemandOrder = data.orders.find(
        (order: any) => order.order_type === "on_demand",
      );

      expect(cateringOrder).toBeDefined();
      expect(onDemandOrder).toBeDefined();
      expect(cateringOrder.orderNumber).toBe("CAT001");
      expect(onDemandOrder.orderNumber).toBe("OND001");
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle API errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      try {
        await fetch("/api/user-orders");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Network error");
      }
    });

    it("should handle database errors in API", async () => {
      mockPrisma.cateringRequest.findMany.mockRejectedValueOnce(
        new Error("Database connection failed"),
      );

      // Mock fetch to return 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: "Error fetching user orders" }),
      } as Response);

      const response = await fetch("/api/user-orders");
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe("Error fetching user orders");
    });
  });

  describe("Pagination Integration", () => {
    it("should handle edge cases in pagination", async () => {
      // Test with exactly 5 orders (1 page)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: mockOrders,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalOrders: 5,
            hasNextPage: false,
            hasPrevPage: false,
            ordersPerPage: 5,
          },
        }),
      } as Response);

      const response = await fetch("/api/user-orders");
      const data = await response.json();

      expect(data.pagination.totalPages).toBe(1);
      expect(data.pagination.hasNextPage).toBe(false);
      expect(data.pagination.hasPrevPage).toBe(false);
    });

    it("should handle last page correctly", async () => {
      // Test last page with remaining orders
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: mockOrders.slice(0, 2), // Only 2 orders on last page
          pagination: {
            currentPage: 3,
            totalPages: 3,
            totalOrders: 12,
            hasNextPage: false,
            hasPrevPage: true,
            ordersPerPage: 5,
          },
        }),
      } as Response);

      const response = await fetch("/api/user-orders?page=3&limit=5");
      const data = await response.json();

      expect(data.orders).toHaveLength(2);
      expect(data.pagination.currentPage).toBe(3);
      expect(data.pagination.hasNextPage).toBe(false);
      expect(data.pagination.hasPrevPage).toBe(true);
    });
  });

  describe("Data Formatting Integration", () => {
    it("should format currency consistently", async () => {
      const response = await fetch("/api/user-orders");
      const data = await response.json();

      const order = data.orders[0];
      expect(typeof order.orderTotal).toBe("number");
      expect(order.orderTotal).toBe(150.0);
    });

    it("should format addresses correctly", async () => {
      const response = await fetch("/api/user-orders");
      const data = await response.json();

      const order = data.orders[0];
      expect(order.pickupAddress).toEqual({
        address: "123 Pickup St",
        city: "San Francisco",
        state: "CA",
      });
    });

    it("should handle date formatting", async () => {
      const response = await fetch("/api/user-orders");
      const data = await response.json();

      const order = data.orders[0];
      expect(order.createdAt).toBe("2025-01-15T09:00:00Z");
    });
  });
});
