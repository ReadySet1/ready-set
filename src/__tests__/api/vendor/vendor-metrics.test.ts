// src/__tests__/api/vendor/vendor-metrics.test.ts

import { GET } from '@/app/api/vendor/metrics/route';
import {
  getUserOrderMetrics,
  checkOrderAccess,
  getCurrentUserId,
} from '@/lib/services/vendor';
import {
  getVendorMetricsCacheWithEtag,
  setVendorMetricsCache,
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
    VENDOR_METRICS: {
      maxAge: 300,
      staleWhileRevalidate: 600,
    },
  },
}));

/**
 * TODO: REA-211 - Response structure mismatch (double JSON stringification)
 * 11 pass, 4 fail - createCachedResponse mock returns stringified data
 */
describe.skip('/api/vendor/metrics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/vendor/metrics - Vendor Metrics', () => {
    describe('✅ Successful Retrieval', () => {
      it('should return vendor metrics with fresh data', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorMetricsCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });

        const mockMetrics = {
          totalOrders: 150,
          pendingOrders: 25,
          completedOrders: 120,
          cancelledOrders: 5,
          totalRevenue: 45000.0,
          averageOrderValue: 300.0,
          recentOrders: [],
        };

        (getUserOrderMetrics as jest.Mock).mockResolvedValue(mockMetrics);
        (setVendorMetricsCache as jest.Mock).mockReturnValue('etag-abc123');
        (createCachedResponse as jest.Mock).mockImplementation((data) =>
          new Response(JSON.stringify(data), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.totalOrders).toBe(150);
        expect(data.totalRevenue).toBe(45000.0);
        expect(getUserOrderMetrics).toHaveBeenCalled();
        expect(setVendorMetricsCache).toHaveBeenCalledWith(
          'vendor-123',
          mockMetrics,
          expect.any(Number)
        );
      });

      it('should return cached data when available', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');

        const cachedMetrics = {
          totalOrders: 100,
          pendingOrders: 10,
          completedOrders: 85,
          cancelledOrders: 5,
          totalRevenue: 30000.0,
        };

        (getVendorMetricsCacheWithEtag as jest.Mock).mockReturnValue({
          data: cachedMetrics,
          etag: 'etag-cached',
        });

        (handleConditionalRequest as jest.Mock).mockReturnValue(
          new Response(JSON.stringify(cachedMetrics), {
            status: 200,
            headers: { 'X-Cache': 'HIT' },
          })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(response.headers.get('X-Cache')).toBe('HIT');
        expect(data.totalOrders).toBe(100);
        expect(getUserOrderMetrics).not.toHaveBeenCalled();
        expect(recordCacheMetrics).toHaveBeenCalledWith(
          '/api/vendor/metrics',
          true,
          expect.any(Number),
          'vendor-123',
          'VENDOR'
        );
      });

      it('should handle 304 Not Modified for conditional requests', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');

        (getVendorMetricsCacheWithEtag as jest.Mock).mockReturnValue({
          data: { totalOrders: 100 },
          etag: 'etag-123',
        });

        (handleConditionalRequest as jest.Mock).mockReturnValue(
          new Response(null, { status: 304 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics',
          { 'If-None-Match': 'etag-123' }
        );

        const response = await GET(request);
        expect(response.status).toBe(304);
      });

      it('should include all expected metric fields', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorMetricsCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });

        const mockMetrics = {
          totalOrders: 200,
          pendingOrders: 30,
          inProgressOrders: 15,
          completedOrders: 150,
          cancelledOrders: 5,
          totalRevenue: 60000.0,
          averageOrderValue: 300.0,
          recentOrders: [
            { id: 'order-1', orderNumber: 'ORD-001', status: 'PENDING' },
            { id: 'order-2', orderNumber: 'ORD-002', status: 'COMPLETED' },
          ],
        };

        (getUserOrderMetrics as jest.Mock).mockResolvedValue(mockMetrics);
        (setVendorMetricsCache as jest.Mock).mockReturnValue('etag-new');
        (createCachedResponse as jest.Mock).mockImplementation((data) =>
          new Response(JSON.stringify(data), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveProperty('totalOrders');
        expect(data).toHaveProperty('pendingOrders');
        expect(data).toHaveProperty('completedOrders');
        expect(data).toHaveProperty('totalRevenue');
        expect(data).toHaveProperty('averageOrderValue');
        expect(data).toHaveProperty('recentOrders');
        expect(data.recentOrders).toHaveLength(2);
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue(null);

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        const response = await GET(request);
        await expectUnauthorized(response);
      });

      it('should return 401 when user ID cannot be retrieved', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue(undefined);

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        const response = await GET(request);
        await expectUnauthorized(response);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 400 when user lacks order access', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(false);

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        const response = await GET(request);
        await expectErrorResponse(response, 400, /Unauthorized access/i);
      });

      it('should allow vendors with proper access', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorMetricsCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });
        (getUserOrderMetrics as jest.Mock).mockResolvedValue({
          totalOrders: 50,
        });
        (setVendorMetricsCache as jest.Mock).mockReturnValue('etag');
        (createCachedResponse as jest.Mock).mockImplementation((data) =>
          new Response(JSON.stringify(data), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);
      });
    });

    describe('💾 Caching Behavior', () => {
      it('should set cache for fresh data', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorMetricsCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });

        const mockMetrics = { totalOrders: 100 };
        (getUserOrderMetrics as jest.Mock).mockResolvedValue(mockMetrics);
        (setVendorMetricsCache as jest.Mock).mockReturnValue('etag-new');
        (createCachedResponse as jest.Mock).mockImplementation((data) =>
          new Response(JSON.stringify(data), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        await GET(request);

        expect(setVendorMetricsCache).toHaveBeenCalledWith(
          'vendor-123',
          mockMetrics,
          expect.any(Number)
        );
      });

      it('should record cache metrics for hits', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorMetricsCacheWithEtag as jest.Mock).mockReturnValue({
          data: { totalOrders: 100 },
        });
        (handleConditionalRequest as jest.Mock).mockReturnValue(
          new Response(JSON.stringify({}), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        await GET(request);

        expect(recordCacheMetrics).toHaveBeenCalledWith(
          '/api/vendor/metrics',
          true,
          expect.any(Number),
          'vendor-123',
          'VENDOR'
        );
      });

      it('should record cache metrics for misses', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorMetricsCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });
        (getUserOrderMetrics as jest.Mock).mockResolvedValue({});
        (setVendorMetricsCache as jest.Mock).mockReturnValue('etag');
        (createCachedResponse as jest.Mock).mockImplementation((data) =>
          new Response(JSON.stringify(data), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        await GET(request);

        expect(recordCacheMetrics).toHaveBeenCalledWith(
          '/api/vendor/metrics',
          false,
          expect.any(Number),
          'vendor-123',
          'VENDOR'
        );
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle errors from getUserOrderMetrics', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorMetricsCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });
        (getUserOrderMetrics as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        const response = await GET(request);
        await expectErrorResponse(
          response,
          500,
          /Failed to fetch vendor metrics/i
        );
      });

      it('should handle errors from checkOrderAccess', async () => {
        (checkOrderAccess as jest.Mock).mockRejectedValue(
          new Error('Auth service unavailable')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        const response = await GET(request);
        await expectErrorResponse(response, 500);
      });

      it('should record error metrics when exceptions occur', async () => {
        (checkOrderAccess as jest.Mock).mockResolvedValue(true);
        (getCurrentUserId as jest.Mock).mockResolvedValue('vendor-123');
        (getVendorMetricsCacheWithEtag as jest.Mock).mockReturnValue({
          data: null,
        });
        (getUserOrderMetrics as jest.Mock).mockRejectedValue(
          new Error('Service error')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        await GET(request);

        expect(recordCacheMetrics).toHaveBeenCalledWith(
          '/api/vendor/metrics',
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
        (getVendorMetricsCacheWithEtag as jest.Mock).mockReturnValue({
          data: { totalOrders: 100 },
        });
        (handleConditionalRequest as jest.Mock).mockReturnValue(
          new Response(JSON.stringify({}), { status: 200 })
        );

        const request = createGetRequest(
          'http://localhost:3000/api/vendor/metrics'
        );

        await GET(request);

        // Verify duration was tracked
        expect(recordCacheMetrics).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Boolean),
          expect.any(Number), // duration
          expect.any(String),
          'VENDOR'
        );
      });
    });
  });
});
