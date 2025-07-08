import { GET } from "../route";
import { NextRequest } from "next/server";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the vendor service
const mockGetVendorOrders = vi.fn();
const mockCheckVendorAccess = vi.fn();

vi.mock("@/lib/services/vendor", () => ({
  getVendorOrders: mockGetVendorOrders,
  checkVendorAccess: mockCheckVendorAccess,
}));

describe("Vendor Orders API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckVendorAccess.mockResolvedValue(true);
  });

  it("returns orders with pagination metadata for valid request", async () => {
    const mockOrdersResult = {
      orders: [
        {
          id: "1",
          orderNumber: "TEST-001",
          orderType: "catering",
          status: "ACTIVE",
          pickupDateTime: "2024-07-08T10:00:00Z",
          arrivalDateTime: "2024-07-08T11:00:00Z",
          orderTotal: 200.00,
          tip: 20.00,
        }
      ],
      hasMore: true,
      total: 5
    };

    mockGetVendorOrders.mockResolvedValue(mockOrdersResult);

    const url = new URL("http://localhost/api/vendor/orders?page=1&limit=1");
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      orders: mockOrdersResult.orders,
      hasMore: true,
      total: 5,
      page: 1,
      limit: 1
    });

    expect(mockGetVendorOrders).toHaveBeenCalledWith(1, 1);
  });

  it("uses default pagination values when not provided", async () => {
    const mockOrdersResult = {
      orders: [],
      hasMore: false,
      total: 0
    };

    mockGetVendorOrders.mockResolvedValue(mockOrdersResult);

    const url = new URL("http://localhost/api/vendor/orders");
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(10);
    expect(mockGetVendorOrders).toHaveBeenCalledWith(10, 1);
  });

  it("handles page parameter correctly", async () => {
    const mockOrdersResult = {
      orders: [],
      hasMore: false,
      total: 0
    };

    mockGetVendorOrders.mockResolvedValue(mockOrdersResult);

    const url = new URL("http://localhost/api/vendor/orders?page=3");
    const request = new NextRequest(url);

    await GET(request);

    expect(mockGetVendorOrders).toHaveBeenCalledWith(10, 3);
  });

  it("handles limit parameter correctly", async () => {
    const mockOrdersResult = {
      orders: [],
      hasMore: false,
      total: 0
    };

    mockGetVendorOrders.mockResolvedValue(mockOrdersResult);

    const url = new URL("http://localhost/api/vendor/orders?limit=5");
    const request = new NextRequest(url);

    await GET(request);

    expect(mockGetVendorOrders).toHaveBeenCalledWith(5, 1);
  });

  it("handles both page and limit parameters", async () => {
    const mockOrdersResult = {
      orders: [],
      hasMore: true,
      total: 15
    };

    mockGetVendorOrders.mockResolvedValue(mockOrdersResult);

    const url = new URL("http://localhost/api/vendor/orders?page=2&limit=5");
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(data.page).toBe(2);
    expect(data.limit).toBe(5);
    expect(mockGetVendorOrders).toHaveBeenCalledWith(5, 2);
  });

  it("returns 403 when vendor access is denied", async () => {
    mockCheckVendorAccess.mockResolvedValue(false);

    const url = new URL("http://localhost/api/vendor/orders");
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Unauthorized access");
    expect(mockGetVendorOrders).not.toHaveBeenCalled();
  });

  it("handles service errors gracefully", async () => {
    mockGetVendorOrders.mockRejectedValue(new Error("Database connection failed"));

    const url = new URL("http://localhost/api/vendor/orders");
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database connection failed");
  });

  it("handles service errors without message", async () => {
    mockGetVendorOrders.mockRejectedValue(new Error());

    const url = new URL("http://localhost/api/vendor/orders");
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch vendor orders");
  });

  it("parses invalid page parameter as default", async () => {
    const mockOrdersResult = {
      orders: [],
      hasMore: false,
      total: 0
    };

    mockGetVendorOrders.mockResolvedValue(mockOrdersResult);

    const url = new URL("http://localhost/api/vendor/orders?page=invalid");
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(data.page).toBe(1); // Should default to 1 for invalid input
    expect(mockGetVendorOrders).toHaveBeenCalledWith(10, 1);
  });

  it("parses invalid limit parameter as default", async () => {
    const mockOrdersResult = {
      orders: [],
      hasMore: false,
      total: 0
    };

    mockGetVendorOrders.mockResolvedValue(mockOrdersResult);

    const url = new URL("http://localhost/api/vendor/orders?limit=invalid");
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(data.limit).toBe(10); // Should default to 10 for invalid input
    expect(mockGetVendorOrders).toHaveBeenCalledWith(10, 1);
  });

  it("returns correct hasMore flag for last page", async () => {
    const mockOrdersResult = {
      orders: [
        {
          id: "1",
          orderNumber: "TEST-001",
          orderType: "catering",
          status: "ACTIVE",
        }
      ],
      hasMore: false, // Last page
      total: 3
    };

    mockGetVendorOrders.mockResolvedValue(mockOrdersResult);

    const url = new URL("http://localhost/api/vendor/orders?page=3&limit=1");
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(data.hasMore).toBe(false);
    expect(data.page).toBe(3);
    expect(data.total).toBe(3);
  });

  it("returns correct hasMore flag for middle page", async () => {
    const mockOrdersResult = {
      orders: [
        {
          id: "2",
          orderNumber: "TEST-002",
          orderType: "on_demand",
          status: "PENDING",
        }
      ],
      hasMore: true, // More pages available
      total: 5
    };

    mockGetVendorOrders.mockResolvedValue(mockOrdersResult);

    const url = new URL("http://localhost/api/vendor/orders?page=2&limit=1");
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(data.hasMore).toBe(true);
    expect(data.page).toBe(2);
    expect(data.total).toBe(5);
  });
}); 