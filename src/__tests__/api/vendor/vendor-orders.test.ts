// src/__tests__/api/vendor/vendor-orders.test.ts

import { GET } from '@/app/api/vendor/orders/route';
import {
  getUserOrders,
  checkOrderAccess,
  getCurrentUserId,
} from '@/lib/services/vendor';
import {
  getVendorOrdersCacheWithEtag,
  setVendorOrdersCache,
} from '@/lib/cache/dashboard-cache';
import {
  handleConditionalRequest,
  createCachedResponse,
  recordCacheMetrics,
  CACHE_CONFIGS,
} from '@/lib/cache/http-cache';
import {
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/services/vendor');
jest.mock('@/lib/cache/dashboard-cache');
jest.mock('@/lib/cache/http-cache', () => ({
  ...jest.requireActual('@/lib/cache/http-cache'),
  handleConditionalRequest: jest.fn(),
  createCachedResponse: jest.fn(),
  recordCacheMetrics: jest.fn(),
  CACHE_CONFIGS: {
    VENDOR_ORDERS: {
      maxAge: 180,
      staleWhileRevalidate: 360,
    },
  },
}));

describe('/api/vendor/orders API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/vendor/orders - Vendor Orders List', () => {
    describe('✅ Successful Retrieval', () => {
      it('should return paginated vendor orders', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });

        const mockOrders = [
          {
            id: 'order-1',
            orderNumber: 'ORD-001',
            status: 'PENDING',
            totalAmount: 250.0,
            createdAt: new Date('2024-01-01'),
          },
          {
            id: 'order-2',
            orderNumber: 'ORD-002',
            status: 'COMPLETED',
            totalAmount: 350.0,
            createdAt: new Date('2024-01-02'),
          },
        ];

        (getUserOrders as jest.Mock).mockResolvedValue({
          orders: mockOrders,
          hasMore: true,
          total: 50,
        });

        (setVendorOrdersCache as jest.Mock).mockReturnValue('etag-abc');
        (createCachedResponse as jest.Mock).mockImplementation((data) =>
          new Response(JSON.stringify(data), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.orders).toHaveLength(2);
        expect(data.hasMore).toBe(true);
        expect(data.total).toBe(50);
        expect(data.page).toBe(1);
        expect(data.limit).toBe(10);
      });

      it('should support custom pagination parameters', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });

        (getUserOrders as jest.Mock).mockResolvedValue({
          orders: [],
          hasMore: false,
          total: 15,
        });

        (setVendorOrdersCache as jest.Mock).mockReturnValue('etag-page2');
        (createCachedResponse as jest.Mock).mockImplementation((data) =>
          new Response(JSON.stringify(data), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders?page=2&limit=20'
        );

        await GET(request);

        expect(getUserOrders).toHaveBeenCalledWith(20, 2);
      });

      it('should default to page 1 and limit 10', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });

        (getUserOrders as jest.Mock).mockResolvedValue({
          orders: [],
          hasMore: false,
          total: 5,
        });

        (setVendorOrdersCache as jest.Mock).mockReturnValue('etag-default');
        (createCachedResponse as jest.Mock).mockImplementation((data) =>
          new Response(JSON.stringify(data), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders'
        );

        await GET(request);

        expect(getUserOrders).toHaveBeenCalledWith(10, 1);
      });

      it('should return cached orders when available', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');

        const cachedOrders = {
          orders: [{ id: 'cached-order-1', orderNumber: 'CACHE-001' }],
          hasMore: false,
          total: 1,
          page: 1,
          limit: 10,
        };

        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValue({
          data: cachedOrders,
          etag: 'etag-cached-orders',
        });

        (handleConditionalRequest as jest.Mock).mockReturnValue(
          new Response(JSON.stringify(cachedOrders), {
            status: 200,
            headers: { 'X-Cache': 'HIT' },
          })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(response.headers.get('X-Cache')).toBe('HIT');
        expect(data.orders).toHaveLength(1);
        expect(getUserOrders).not.toHaveBeenCalled();
      });

      it('should include pagination metadata', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });

        (getUserOrders as jest.Mock).mockResolvedValue({
          orders: [{}, {}, {}],
          hasMore: true,
          total: 100,
        });

        (setVendorOrdersCache as jest.Mock).mockReturnValue('etag');
        (createCachedResponse as jest.Mock).mockImplementation((data) =>
          new Response(JSON.stringify(data), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders?page=3&limit=3'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.page).toBe(3);
        expect(data.limit).toBe(3);
        expect(data.hasMore).toBe(true);
        expect(data.total).toBe(100);
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue(null);

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders'
        );

        const response = await GET(request);
        await expectUnauthorized(response);
      });

      it('should return 401 when getCurrentUserId returns undefined', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue(undefined);

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders'
        );

        const response = await GET(request);
        await expectUnauthorized(response);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 when user lacks order access', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(false);

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders'
        );

        const response = await GET(request);
        await expectForbidden(response, /Unauthorized access/i);
      });

      it('should allow vendors with proper access', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });
        (getUserOrders as jest.Mock).mockResolvedValue({
          orders: [],
          hasMore: false,
          total: 0,
        });
        (setVendorOrdersCache as jest.Mock).mockReturnValue('etag');
        (createCachedResponse as jest.Mock).mockImplementation((data) =>
          new Response(JSON.stringify(data), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);
      });
    });

    describe('💾 Caching Behavior', () => {
      it('should cache orders with pagination parameters', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });

        const mockResult = {
          orders: [{ id: 'order-1' }],
          hasMore: false,
          total: 1,
        };

        (getUserOrders as jest.Mock).mockResolvedValue(mockResult);
        (setVendorOrdersCache as jest.Mock).mockReturnValue('etag-new');
        (createCachedResponse as jest.Mock).mockImplementation((data) =>
          new Response(JSON.stringify(data), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders?page=2&limit=5'
        );

        await GET(request);

        expect(setVendorOrdersCache).toHaveBeenCalledWith(
          'vendor-123',
          2,
          5,
          expect.objectContaining({
            orders: mockResult.orders,
            hasMore: false,
            total: 1,
            page: 2,
            limit: 5,
          }),
          expect.any(Number)
        );
      });

      it('should record cache metrics for hits', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValue({
          data: { orders: [] },
        });
        (handleConditionalRequest as jest.Mock).mockReturnValue(
          new Response(JSON.stringify({}), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders'
        );

        await GET(request);

        expect(recordCacheMetrics).toHaveBeenCalledWith(
          '/api/vendor/orders',
          true,
          expect.any(Number),
          'vendor-123',
          'VENDOR'
        );
      });

      it('should record cache metrics for misses', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });
        (getUserOrders as jest.Mock).mockResolvedValue({
          orders: [],
          hasMore: false,
          total: 0,
        });
        (setVendorOrdersCache as jest.Mock).mockReturnValue('etag');
        (createCachedResponse as jest.Mock).mockImplementation((data) =>
          new Response(JSON.stringify(data), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders'
        );

        await GET(request);

        expect(recordCacheMetrics).toHaveBeenCalledWith(
          '/api/vendor/orders',
          false,
          expect.any(Number),
          'vendor-123',
          'VENDOR'
        );
      });

      it('should use separate cache keys for different pagination', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');

        // First request - page 1
        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValueOnce({
          data: null,
        });
        (getUserOrders as jest.Mock).mockResolvedValue({
          orders: [{ id: 'order-1' }],
          hasMore: true,
          total: 20,
        });
        (setVendorOrdersCache as jest.Mock).mockReturnValue('etag-page1');
        (createCachedResponse as jest.Mock).mockImplementation((data) =>
          new Response(JSON.stringify(data), { status: 200 })
        );

        const request1 = createGetRequest(
          'http://localhost:3000/api/vendor/orders?page=1&limit=10'
        );
        await GET(request1);

        // Verify first cache call
        expect(getVendorOrdersCacheWithEtag).toHaveBeenCalledWith(
          'vendor-123',
          1,
          10
        );

        // Second request - page 2
        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValueOnce({
          data: null,
        });
        (getUserOrders as jest.Mock).mockResolvedValue({
          orders: [{ id: 'order-2' }],
          hasMore: false,
          total: 20,
        });

        const request2 = createGetRequest(
          'http://localhost:3000/api/vendor/orders?page=2&limit=10'
        );
        await GET(request2);

        // Verify second cache call with different params
        expect(getVendorOrdersCacheWithEtag).toHaveBeenCalledWith(
          'vendor-123',
          2,
          10
        );
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle errors from getUserOrders', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });
        (getUserOrders as jest.Mock).mockRejectedValue(
          new Error('Database query failed')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders'
        );

        const response = await GET(request);
        await expectErrorResponse(
          response,
          500,
          /Failed to fetch vendor orders/i
        );
      });

      it('should handle errors from checkOrderAccess', async () => {
        (checkOrderAccess as jest.Mock).mockRejectedValue(
          new Error('Auth service error')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders'
        );

        const response = await GET(request);
        await expectErrorResponse(response, 500);
      });

      it('should record error metrics when exceptions occur', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });
        (getUserOrders as jest.Mock).mockRejectedValue(
          new Error('Service error')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders'
        );

        await GET(request);

        expect(recordCacheMetrics).toHaveBeenCalledWith(
          '/api/vendor/orders',
          false,
          expect.any(Number),
          undefined,
          'VENDOR'
        );
      });
    });

    describe('⚡ Performance', () => {
      it('should track request duration', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorOrdersCacheWithEtag as jest.Mock).mockReturnValue({
          data: { orders: [] },
        });
        (handleConditionalRequest as jest.Mock).mockReturnValue(
          new Response(JSON.stringify({}), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/orders'
        );

        await GET(request);

        // Verify duration was tracked
        expect(recordCacheMetrics).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Boolean),
          expect.any(Number), // duration in milliseconds
          expect.any(String),
          'VENDOR'
        );
      });
    });
  });
});
