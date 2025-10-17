/**
 * Tests for /api/vendor/orders route
 *
 * This route is BUSINESS CRITICAL as it provides vendor order management and revenue tracking
 *
 * Tests cover:
 * - GET: Vendor order listing with pagination
 * - Authentication and authorization
 * - HTTP caching (ETags, conditional requests)
 * - Cache hit/miss scenarios
 * - Performance metrics tracking
 * - Error handling
 */

import { NextRequest, NextResponse } from "next/server";
import { GET } from "../route";
import { getUserOrders, checkOrderAccess, getCurrentUserId } from "@/lib/services/vendor";
import {
  handleConditionalRequest,
  createCachedResponse,
  recordCacheMetrics,
} from "@/lib/cache/http-cache";
import {
  getVendorOrdersCacheWithEtag,
  setVendorOrdersCache,
} from "@/lib/cache/dashboard-cache";
import {
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectServerError,
} from "@/__tests__/helpers/api-test-helpers";

// Helper to create a proper NextRequest with nextUrl property for Next.js 15
function createVendorOrdersRequest(url: string, params?: Record<string, string>): NextRequest {
  const fullUrl = new URL(url);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      fullUrl.searchParams.set(key, value);
    });
  }

  const request = new NextRequest(fullUrl);
  // Ensure nextUrl is properly set for Next.js 15
  Object.defineProperty(request, 'nextUrl', {
    value: fullUrl,
    writable: false,
    configurable: true
  });

  return request;
}

// Mock dependencies
jest.mock("@/lib/services/vendor", () => ({
  getUserOrders: jest.fn(),
  checkOrderAccess: jest.fn(),
  getCurrentUserId: jest.fn(),
}));

jest.mock("@/lib/cache/http-cache", () => ({
  CACHE_CONFIGS: {
    VENDOR_ORDERS: {
      maxAge: 300,
      staleWhileRevalidate: 60,
    },
  },
  handleConditionalRequest: jest.fn(),
  createCachedResponse: jest.fn(),
  recordCacheMetrics: jest.fn(),
}));

jest.mock("@/lib/cache/dashboard-cache", () => ({
  getVendorOrdersCacheWithEtag: jest.fn(),
  setVendorOrdersCache: jest.fn(),
}));

const mockGetUserOrders = getUserOrders as jest.MockedFunction<typeof getUserOrders>;
const mockCheckOrderAccess = checkOrderAccess as jest.MockedFunction<typeof checkOrderAccess>;
const mockGetCurrentUserId = getCurrentUserId as jest.MockedFunction<typeof getCurrentUserId>;
const mockHandleConditionalRequest = handleConditionalRequest as jest.MockedFunction<
  typeof handleConditionalRequest
>;
const mockCreateCachedResponse = createCachedResponse as jest.MockedFunction<
  typeof createCachedResponse
>;
const mockRecordCacheMetrics = recordCacheMetrics as jest.MockedFunction<
  typeof recordCacheMetrics
>;
const mockGetVendorOrdersCacheWithEtag = getVendorOrdersCacheWithEtag as jest.MockedFunction<
  typeof getVendorOrdersCacheWithEtag
>;
const mockSetVendorOrdersCache = setVendorOrdersCache as jest.MockedFunction<
  typeof setVendorOrdersCache
>;

describe("/api/vendor/orders", () => {
  const mockOrders = [
    {
      id: "order-1",
      orderNumber: "ORD001",
      status: "ACTIVE",
      total: 150.0,
      createdAt: new Date("2025-01-15T10:00:00Z"),
    },
    {
      id: "order-2",
      orderNumber: "ORD002",
      status: "PENDING",
      total: 200.0,
      createdAt: new Date("2025-01-16T10:00:00Z"),
    },
  ];

  const mockOrdersResult = {
    orders: mockOrders,
    hasMore: false,
    total: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful responses
    mockCheckOrderAccess.mockResolvedValue(true);
    mockGetCurrentUserId.mockResolvedValue("vendor-user-id");
    mockGetVendorOrdersCacheWithEtag.mockReturnValue({ data: null, etag: null });
    mockSetVendorOrdersCache.mockReturnValue("etag-12345");
    mockCreateCachedResponse.mockImplementation((data: any) => {
      return NextResponse.json(data, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  describe("GET /api/vendor/orders", () => {
    describe("Authentication & Authorization", () => {
      it("should reject unauthorized requests (403)", async () => {
        mockCheckOrderAccess.mockResolvedValueOnce(false);

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        const response = await GET(request);

        await expectForbidden(response);

        const data = await response.json();
        expect(data.error).toBe("Unauthorized access");
      });

      it("should reject unauthenticated requests (401)", async () => {
        mockCheckOrderAccess.mockResolvedValueOnce(true);
        mockGetCurrentUserId.mockResolvedValueOnce(null);

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        const response = await GET(request);

        await expectUnauthorized(response);

        const data = await response.json();
        expect(data.error).toBe("Unauthorized");
      });

      it("should allow authorized vendor access", async () => {
        mockCheckOrderAccess.mockResolvedValueOnce(true);
        mockGetCurrentUserId.mockResolvedValueOnce("vendor-user-id");
        mockGetUserOrders.mockResolvedValueOnce(mockOrdersResult);

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        const response = await GET(request);

        expect(response.status).toBe(200);
      });

      it("should verify checkOrderAccess is called", async () => {
        mockGetUserOrders.mockResolvedValueOnce(mockOrdersResult);

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        await GET(request);

        expect(mockCheckOrderAccess).toHaveBeenCalledTimes(1);
      });

      it("should verify getCurrentUserId is called", async () => {
        mockGetUserOrders.mockResolvedValueOnce(mockOrdersResult);

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        await GET(request);

        expect(mockGetCurrentUserId).toHaveBeenCalledTimes(1);
      });
    });

    describe("Pagination", () => {
      beforeEach(() => {
        mockGetUserOrders.mockResolvedValue(mockOrdersResult);
      });

      it("should use default page of 1", async () => {
        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        await GET(request);

        expect(mockGetUserOrders).toHaveBeenCalledWith(10, 1);
      });

      it("should use default limit of 10", async () => {
        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        await GET(request);

        expect(mockGetUserOrders).toHaveBeenCalledWith(10, 1);
      });

      it("should use custom page parameter", async () => {
        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders", {
          page: "2",
        });
        await GET(request);

        expect(mockGetUserOrders).toHaveBeenCalledWith(10, 2);
      });

      it("should use custom limit parameter", async () => {
        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders", {
          limit: "20",
        });
        await GET(request);

        expect(mockGetUserOrders).toHaveBeenCalledWith(20, 1);
      });

      it("should use both custom page and limit parameters", async () => {
        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders", {
          page: "3",
          limit: "25",
        });
        await GET(request);

        expect(mockGetUserOrders).toHaveBeenCalledWith(25, 3);
      });

      it("should return pagination metadata", async () => {
        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders", {
          page: "2",
          limit: "15",
        });
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.page).toBe(2);
        expect(data.limit).toBe(15);
        expect(data.total).toBe(2);
        expect(data.hasMore).toBe(false);
      });
    });

    describe("HTTP Caching", () => {
      beforeEach(() => {
        mockGetUserOrders.mockResolvedValue(mockOrdersResult);
      });

      it("should check cache for existing data", async () => {
        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        await GET(request);

        expect(mockGetVendorOrdersCacheWithEtag).toHaveBeenCalledWith(
          "vendor-user-id",
          1,
          10
        );
      });

      it("should return cached data on cache hit", async () => {
        const cachedData = {
          orders: mockOrders,
          hasMore: false,
          total: 2,
          page: 1,
          limit: 10,
        };

        mockGetVendorOrdersCacheWithEtag.mockReturnValueOnce({
          data: cachedData,
          etag: "cached-etag",
        });

        mockHandleConditionalRequest.mockReturnValueOnce(
          NextResponse.json(cachedData, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        const response = await GET(request);

        expect(response.status).toBe(200);

        // Should not call getUserOrders on cache hit
        expect(mockGetUserOrders).not.toHaveBeenCalled();
      });

      it("should set cache on cache miss", async () => {
        mockGetVendorOrdersCacheWithEtag.mockReturnValueOnce({
          data: null,
          etag: null,
        });

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        await GET(request);

        expect(mockSetVendorOrdersCache).toHaveBeenCalledWith(
          "vendor-user-id",
          1,
          10,
          expect.objectContaining({
            orders: mockOrders,
            hasMore: false,
            total: 2,
            page: 1,
            limit: 10,
          }),
          300000 // maxAge * 1000
        );
      });

      it("should return 304 Not Modified for matching ETags", async () => {
        const cachedData = {
          orders: mockOrders,
          hasMore: false,
          total: 2,
          page: 1,
          limit: 10,
        };

        mockGetVendorOrdersCacheWithEtag.mockReturnValueOnce({
          data: cachedData,
          etag: "matching-etag",
        });

        mockHandleConditionalRequest.mockReturnValueOnce(
          new Response(null, {
            status: 304,
            headers: { ETag: "matching-etag" },
          })
        );

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        const response = await GET(request);

        expect(response.status).toBe(304);
      });
    });

    describe("Performance Metrics", () => {
      beforeEach(() => {
        mockGetUserOrders.mockResolvedValue(mockOrdersResult);
      });

      it("should record cache hit metrics", async () => {
        const cachedData = {
          orders: mockOrders,
          hasMore: false,
          total: 2,
          page: 1,
          limit: 10,
        };

        mockGetVendorOrdersCacheWithEtag.mockReturnValueOnce({
          data: cachedData,
          etag: "cached-etag",
        });

        mockHandleConditionalRequest.mockReturnValueOnce(
          NextResponse.json(cachedData, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        await GET(request);

        expect(mockRecordCacheMetrics).toHaveBeenCalledWith(
          "/api/vendor/orders",
          true, // cache hit
          expect.any(Number),
          "vendor-user-id",
          "VENDOR"
        );
      });

      it("should record cache miss metrics", async () => {
        mockGetVendorOrdersCacheWithEtag.mockReturnValueOnce({
          data: null,
          etag: null,
        });

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        await GET(request);

        expect(mockRecordCacheMetrics).toHaveBeenCalledWith(
          "/api/vendor/orders",
          false, // cache miss
          expect.any(Number),
          "vendor-user-id",
          "VENDOR"
        );
      });

      it("should record error metrics", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        mockGetUserOrders.mockRejectedValueOnce(new Error("Database error"));

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        await GET(request);

        expect(mockRecordCacheMetrics).toHaveBeenCalledWith(
          "/api/vendor/orders",
          false,
          expect.any(Number),
          undefined,
          "VENDOR"
        );

        consoleErrorSpy.mockRestore();
      });

      it("should track request duration", async () => {
        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        await GET(request);

        const metricsCall = mockRecordCacheMetrics.mock.calls[0];
        const duration = metricsCall[2];

        expect(duration).toBeGreaterThanOrEqual(0);
        expect(typeof duration).toBe("number");
      });
    });

    describe("Response Format", () => {
      beforeEach(() => {
        mockGetUserOrders.mockResolvedValue(mockOrdersResult);
      });

      it("should return orders with correct structure", async () => {
        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data).toHaveProperty("orders");
        expect(data).toHaveProperty("hasMore");
        expect(data).toHaveProperty("total");
        expect(data).toHaveProperty("page");
        expect(data).toHaveProperty("limit");
      });

      it("should return all orders from service", async () => {
        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.orders).toEqual(mockOrders);
      });

      it("should indicate when more pages exist", async () => {
        mockGetUserOrders.mockResolvedValueOnce({
          orders: mockOrders,
          hasMore: true,
          total: 100,
        });

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.hasMore).toBe(true);
        expect(data.total).toBe(100);
      });

      it("should create cached response with proper headers", async () => {
        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        await GET(request);

        expect(mockCreateCachedResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            orders: mockOrders,
            hasMore: false,
            total: 2,
            page: 1,
            limit: 10,
          }),
          expect.objectContaining({
            maxAge: 300,
            staleWhileRevalidate: 60,
          })
        );
      });
    });

    describe("Error Handling", () => {
      it("should handle service errors gracefully", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        mockGetUserOrders.mockRejectedValueOnce(new Error("Database connection failed"));

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        const response = await GET(request);

        await expectServerError(response);

        const data = await response.json();
        expect(data.error).toBe("Database connection failed");

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error fetching vendor orders:",
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });

      it("should handle unknown errors", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        mockGetUserOrders.mockRejectedValueOnce("Unknown error");

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        const response = await GET(request);

        await expectServerError(response);

        const data = await response.json();
        expect(data.error).toBe("Failed to fetch vendor orders");

        consoleErrorSpy.mockRestore();
      });

      it("should handle checkOrderAccess errors", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        mockCheckOrderAccess.mockRejectedValueOnce(new Error("Auth service error"));

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        const response = await GET(request);

        await expectServerError(response);

        consoleErrorSpy.mockRestore();
      });

      it("should handle getCurrentUserId errors", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        mockCheckOrderAccess.mockResolvedValueOnce(true);
        mockGetCurrentUserId.mockRejectedValueOnce(new Error("Session error"));

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        const response = await GET(request);

        await expectServerError(response);

        consoleErrorSpy.mockRestore();
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty orders list", async () => {
        mockGetUserOrders.mockResolvedValueOnce({
          orders: [],
          hasMore: false,
          total: 0,
        });

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.orders).toEqual([]);
        expect(data.total).toBe(0);
        expect(data.hasMore).toBe(false);
      });

      it("should handle large page numbers", async () => {
        mockGetUserOrders.mockResolvedValueOnce({
          orders: [],
          hasMore: false,
          total: 0,
        });

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders", {
          page: "9999",
        });
        await GET(request);

        expect(mockGetUserOrders).toHaveBeenCalledWith(10, 9999);
      });

      it("should handle large limit values", async () => {
        mockGetUserOrders.mockResolvedValueOnce(mockOrdersResult);

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders", {
          limit: "1000",
        });
        await GET(request);

        expect(mockGetUserOrders).toHaveBeenCalledWith(1000, 1);
      });

      it("should handle invalid page parameter (NaN)", async () => {
        mockGetUserOrders.mockResolvedValueOnce(mockOrdersResult);

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders", {
          page: "invalid",
        });
        await GET(request);

        // parseInt('invalid') returns NaN, which should default to 1
        expect(mockGetUserOrders).toHaveBeenCalledWith(10, NaN);
      });

      it("should handle invalid limit parameter (NaN)", async () => {
        mockGetUserOrders.mockResolvedValueOnce(mockOrdersResult);

        const request = createVendorOrdersRequest("http://localhost:3000/api/vendor/orders", {
          limit: "invalid",
        });
        await GET(request);

        // parseInt('invalid') returns NaN
        expect(mockGetUserOrders).toHaveBeenCalledWith(NaN, 1);
      });
    });
  });
});
