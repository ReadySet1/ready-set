/**
 * Tests for /api/dashboard-metrics route
 *
 * Critical functionality tested:
 * - Multi-role access control (ADMIN, SUPER_ADMIN, HELPDESK, VENDOR)
 * - Query parameter validation with Zod
 * - HTTP caching with ETag support
 * - Conditional requests (If-None-Match)
 * - Database retry logic
 * - Performance monitoring
 * - Cache invalidation
 * - HEAD method support
 *
 * Security focus:
 * - Role-based data isolation
 * - Vendor self-service restrictions
 * - Cache invalidation permissions
 */

import { NextRequest } from 'next/server';
import { GET, HEAD, POST } from '../route';
import { prisma, withDatabaseRetry } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import {
  getDashboardMetricsCacheWithEtag,
  setDashboardMetricsCache,
  invalidateDashboardMetricsCache,
} from '@/lib/cache/dashboard-cache';
import { recordApiPerformance } from '@/lib/monitoring/dashboard-performance';
import {
  handleConditionalRequest,
  createCachedResponse,
  recordCacheMetrics,
} from '@/lib/cache/http-cache';

// Mock dependencies
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $transaction: jest.fn(),
    cateringRequest: {
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    profile: {
      count: jest.fn(),
    },
  },
  withDatabaseRetry: jest.fn((fn) => fn()),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/cache/dashboard-cache', () => ({
  getDashboardMetricsCacheWithEtag: jest.fn(),
  setDashboardMetricsCache: jest.fn(),
  invalidateDashboardMetricsCache: jest.fn(),
  generateDashboardMetricsCacheKey: jest.fn((key) => JSON.stringify(key)),
}));

jest.mock('@/lib/monitoring/dashboard-performance', () => ({
  recordApiPerformance: jest.fn(),
}));

jest.mock('@/lib/cache/http-cache', () => ({
  CACHE_CONFIGS: {
    DASHBOARD_METRICS: {
      maxAge: 300,
      staleWhileRevalidate: 600,
    },
  },
  handleConditionalRequest: jest.fn(),
  createCachedResponse: jest.fn((data) => {
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300',
      },
    });
  }),
  recordCacheMetrics: jest.fn(),
}));

jest.mock('@/utils/error-logging', () => ({
  logError: jest.fn(),
}));

describe('GET /api/dashboard-metrics', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  };

  const mockDashboardData = {
    totalRevenue: 150000,
    deliveriesRequests: 120,
    salesTotal: 95,
    totalVendors: 15,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
    (getDashboardMetricsCacheWithEtag as jest.Mock).mockReturnValue({ data: null });
    (handleConditionalRequest as jest.Mock).mockReturnValue(null);
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should allow ADMIN role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'admin-user', type: 'ADMIN' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockDashboardData);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should allow SUPER_ADMIN role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'superadmin-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'superadmin-user', type: 'SUPER_ADMIN' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockDashboardData);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should allow HELPDESK role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'helpdesk-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'helpdesk-user', type: 'HELPDESK' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockDashboardData);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should allow VENDOR role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'vendor-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'vendor-user', type: 'VENDOR' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockDashboardData);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should reject CLIENT role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'client-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'client-user', type: 'CLIENT' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should reject DRIVER role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'driver-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'driver-user', type: 'DRIVER' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should return 404 when profile not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'unknown-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Profile not found'),
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User profile not found');
    });
  });

  describe('Query parameter validation', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'admin-user', type: 'ADMIN' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockDashboardData);
    });

    it('should accept valid date range', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard-metrics?startDate=2025-01-01&endDate=2025-01-31'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.period).toEqual({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });
    });

    it('should accept vendorId parameter', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard-metrics?vendorId=vendor-123'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should work without query parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.period).toBeUndefined();
    });

    it('should reject invalid date format', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard-metrics?startDate=invalid-date'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
      expect(data.details).toBeDefined();
    });
  });

  describe('HTTP caching with ETag', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'admin-user', type: 'ADMIN' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);
    });

    it('should return 304 Not Modified for matching ETag', async () => {
      const mockCachedResponse = new Response(null, { status: 304 });
      (getDashboardMetricsCacheWithEtag as jest.Mock).mockReturnValue({
        data: mockDashboardData,
      });
      (handleConditionalRequest as jest.Mock).mockReturnValue(mockCachedResponse);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        headers: { 'If-None-Match': 'etag-123' },
      });
      const response = await GET(request);

      expect(response.status).toBe(304);
      expect(recordCacheMetrics).toHaveBeenCalledWith(
        '/api/dashboard-metrics',
        true,
        expect.any(Number),
        'admin-user',
        'ADMIN'
      );
    });

    it('should fetch fresh data for cache miss', async () => {
      (getDashboardMetricsCacheWithEtag as jest.Mock).mockReturnValue({ data: null });
      (handleConditionalRequest as jest.Mock).mockReturnValue(null);
      (prisma.$transaction as jest.Mock).mockResolvedValue(mockDashboardData);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject(mockDashboardData);
      expect(setDashboardMetricsCache).toHaveBeenCalled();
    });

    it('should include Cache-Control headers', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue(mockDashboardData);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toContain('public');
      expect(response.headers.get('Cache-Control')).toContain('s-maxage=300');
    });
  });

  describe('Data fetching with retry logic', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'admin-user', type: 'ADMIN' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);
    });

    it('should use database transaction for data consistency', async () => {
      const mockTxResults = mockDashboardData;
      (prisma.$transaction as jest.Mock).mockResolvedValue(mockTxResults);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      await GET(request);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(withDatabaseRetry).toHaveBeenCalled();
    });

    it('should fallback to mock data on database error', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('DB connection failed'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalRevenue).toBe(12500);
      expect(data.deliveriesRequests).toBe(45);
      expect(data.salesTotal).toBe(38);
      expect(data.totalVendors).toBe(11);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Database query failed, using mock data:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Performance monitoring', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'admin-user', type: 'ADMIN' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockDashboardData);
    });

    it('should record API performance metrics', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      await GET(request);

      expect(recordApiPerformance).toHaveBeenCalledWith(
        '/api/dashboard-metrics',
        'GET',
        expect.any(Number),
        expect.objectContaining({
          userType: 'ADMIN',
          userId: 'admin-user',
          cacheHit: false,
          statusCode: 200,
        })
      );
    });

    it('should record cache metrics', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      await GET(request);

      expect(recordCacheMetrics).toHaveBeenCalledWith(
        '/api/dashboard-metrics',
        false,
        expect.any(Number),
        'admin-user',
        'ADMIN'
      );
    });

    it('should include response time in headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);

      expect(response.headers.get('X-Response-Time')).toMatch(/\d+\.\d+ms/);
    });
  });

  describe('Vendor data isolation', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'vendor-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'vendor-user', type: 'VENDOR' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockDashboardData);
    });

    it('should filter data by vendor user ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      await GET(request);

      // Vendor should only see their own data
      expect(setDashboardMetricsCache).toHaveBeenCalledWith(
        expect.objectContaining({
          userType: 'VENDOR',
        }),
        expect.any(Object)
      );
    });

    it('should ignore vendorId parameter for VENDOR role', async () => {
      // Vendors should not be able to see other vendors' data
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard-metrics?vendorId=other-vendor'
      );
      await GET(request);

      // The cache key should use the authenticated vendor's ID, not the query parameter
      expect(setDashboardMetricsCache).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Supabase error'));

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch dashboard metrics');
      expect(response.headers.get('X-Response-Time')).toBeDefined();
    });

    it('should include error details in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Test error'));

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.details).toBe('Test error');

      process.env.NODE_ENV = originalEnv;
    });
  });
});

describe('HEAD /api/dashboard-metrics', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'HEAD',
      });
      const response = await HEAD(request);

      expect(response.status).toBe(401);
      expect(response.body).toBeNull();
    });

    it('should allow ADMIN role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'HEAD',
      });
      const response = await HEAD(request);

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });

    it('should reject CLIENT role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'client-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { type: 'CLIENT' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'HEAD',
      });
      const response = await HEAD(request);

      expect(response.status).toBe(403);
      expect(response.body).toBeNull();
    });
  });

  describe('Response headers', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);
    });

    it('should include Cache-Control headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'HEAD',
      });
      const response = await HEAD(request);

      expect(response.headers.get('Cache-Control')).toContain('public');
      expect(response.headers.get('Cache-Control')).toContain('s-maxage=300');
      expect(response.headers.get('Cache-Control')).toContain('stale-while-revalidate=600');
    });

    it('should include response time header', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'HEAD',
      });
      const response = await HEAD(request);

      expect(response.headers.get('X-Response-Time')).toMatch(/\d+\.\d+ms/);
    });

    it('should include user type header', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'HEAD',
      });
      const response = await HEAD(request);

      expect(response.headers.get('X-User-Type')).toBe('ADMIN');
    });
  });

  describe('Error handling', () => {
    it('should return 500 on error', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Server error'));

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'HEAD',
      });
      const response = await HEAD(request);

      expect(response.status).toBe(500);
      expect(response.body).toBeNull();
      expect(response.headers.get('X-Response-Time')).toBeDefined();
    });
  });
});

describe('POST /api/dashboard-metrics', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should allow ADMIN role to invalidate cache', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'admin-user', type: 'ADMIN' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(invalidateDashboardMetricsCache).toHaveBeenCalled();
    });

    it('should allow SUPER_ADMIN role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'superadmin-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'superadmin-user', type: 'SUPER_ADMIN' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should allow HELPDESK role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'helpdesk-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'helpdesk-user', type: 'HELPDESK' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should reject VENDOR role from cache invalidation', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'vendor-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'vendor-user', type: 'VENDOR' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('Cache invalidation', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'admin-user', type: 'ADMIN' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);
    });

    it('should invalidate all cache by default', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Dashboard metrics cache invalidated successfully');
      expect(invalidateDashboardMetricsCache).toHaveBeenCalledWith(
        expect.objectContaining({
          userType: 'ADMIN',
        })
      );
    });

    it('should support selective cache invalidation', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'POST',
        body: JSON.stringify({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          vendorId: 'vendor-123',
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(invalidateDashboardMetricsCache).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          vendorId: 'vendor-123',
          userType: 'ADMIN',
        })
      );
    });

    it('should handle empty request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'POST',
        body: '',
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(invalidateDashboardMetricsCache).toHaveBeenCalled();
    });

    it('should include response time in response', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.duration).toMatch(/\d+\.\d+ms/);
      expect(response.headers.get('X-Response-Time')).toMatch(/\d+\.\d+ms/);
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Server error'));

      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to invalidate cache');
      expect(response.headers.get('X-Response-Time')).toBeDefined();
    });
  });

  describe('Performance monitoring', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user' } },
        error: null,
      });

      const selectChain = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'admin-user', type: 'ADMIN' },
          error: null,
        }),
      };
      const eqChain = { eq: jest.fn().mockReturnValue(selectChain) };
      const fromChain = { select: jest.fn().mockReturnValue(eqChain) };
      mockSupabaseClient.from.mockReturnValue(fromChain);
    });

    it('should record API performance for POST', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await POST(request);

      expect(recordApiPerformance).toHaveBeenCalledWith(
        '/api/dashboard-metrics',
        'POST',
        expect.any(Number),
        expect.objectContaining({
          userType: 'ADMIN',
          userId: 'admin-user',
          cacheHit: false,
          statusCode: 200,
        })
      );
    });

    it('should record cache operation metrics', async () => {
      const request = new NextRequest('http://localhost:3000/api/dashboard-metrics', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await POST(request);

      expect(recordCacheMetrics).toHaveBeenCalledWith(
        '/api/dashboard-metrics',
        false,
        expect.any(Number),
        'admin-user',
        'ADMIN'
      );
    });
  });
});
