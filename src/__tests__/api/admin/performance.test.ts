// src/__tests__/api/admin/performance.test.ts

import { GET } from '@/app/api/admin/performance/route';
import { createClient } from '@/utils/supabase/server';
import {
  getDashboardPerformanceReport,
  getCachePerformanceReport,
} from '@/lib/monitoring/dashboard-performance';
import {
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';
import { createMockSupabaseClient } from '@/__tests__/helpers/supabase-mock-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/lib/monitoring/dashboard-performance');

describe('/api/admin/performance API', () => {
  let mockSupabaseClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Use the helper to create a properly structured mock
    mockSupabaseClient = createMockSupabaseClient();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('GET /api/admin/performance - Performance Metrics', () => {
    describe('✅ Successful Retrieval', () => {
      it('should return performance metrics for admin users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123', email: 'admin@example.com' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'admin-123', type: 'ADMIN' },
          error: null,
        });

        const mockDashboardReport = {
          totalRequests: 1000,
          cacheHits: 750,
          cacheMisses: 250,
          avgResponseTime: 45,
        };

        const mockCacheReport = {
          size: 150,
          hitRate: 0.75,
          evictions: 10,
        };

        (getDashboardPerformanceReport as jest.Mock).mockReturnValue(
          mockDashboardReport
        );
        (getCachePerformanceReport as jest.Mock).mockReturnValue(
          mockCacheReport
        );

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.dashboard).toEqual(mockDashboardReport);
        expect(data.cache).toEqual(mockCacheReport);
        expect(data.timestamp).toBeDefined();
        expect(data.environment).toBeDefined();
      });

      it('should include environment information', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'superadmin-123', type: 'SUPER_ADMIN' },
          error: null,
        });

        (getDashboardPerformanceReport as jest.Mock).mockReturnValue({});
        (getCachePerformanceReport as jest.Mock).mockReturnValue({});

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.environment).toHaveProperty('nodeEnv');
        expect(data.environment).toHaveProperty('vercelEnv');
      });

      it('should set no-cache headers', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'admin-123', type: 'ADMIN' },
          error: null,
        });

        (getDashboardPerformanceReport as jest.Mock).mockReturnValue({});
        (getCachePerformanceReport as jest.Mock).mockReturnValue({});

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);

        expect(response.headers.get('Cache-Control')).toBe('no-cache');
        expect(response.headers.get('X-Response-Time')).toBeDefined();
      });

      it('should include timestamp in ISO format', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'helpdesk-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'helpdesk-123', type: 'HELPDESK' },
          error: null,
        });

        (getDashboardPerformanceReport as jest.Mock).mockReturnValue({});
        (getCachePerformanceReport as jest.Mock).mockReturnValue({});

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 for unauthenticated requests', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        await expectUnauthorized(response);
      });

      it('should return 401 when user is null', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        await expectUnauthorized(response);
      });

      it('should return 404 when user profile not found', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'no-profile-user' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: null,
          error: { message: 'Profile not found' },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        await expectErrorResponse(response, 404, /profile not found/i);
      });

      it('should return 404 when user type is missing', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'user-123', type: null },
          error: null,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        await expectErrorResponse(response, 404, /profile not found/i);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 for CLIENT users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'client-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'client-123', type: 'CLIENT' },
          error: null,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        await expectForbidden(response, /Insufficient permissions/i);
      });

      it('should return 403 for VENDOR users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'vendor-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'vendor-123', type: 'VENDOR' },
          error: null,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        await expectForbidden(response);
      });

      it('should return 403 for DRIVER users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'driver-123', type: 'DRIVER' },
          error: null,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        await expectForbidden(response);
      });

      it('should allow ADMIN users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'admin-123', type: 'ADMIN' },
          error: null,
        });

        (getDashboardPerformanceReport as jest.Mock).mockReturnValue({});
        (getCachePerformanceReport as jest.Mock).mockReturnValue({});

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);
      });

      it('should allow SUPER_ADMIN users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'superadmin-123', type: 'SUPER_ADMIN' },
          error: null,
        });

        (getDashboardPerformanceReport as jest.Mock).mockReturnValue({});
        (getCachePerformanceReport as jest.Mock).mockReturnValue({});

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);
      });

      it('should allow HELPDESK users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'helpdesk-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'helpdesk-123', type: 'HELPDESK' },
          error: null,
        });

        (getDashboardPerformanceReport as jest.Mock).mockReturnValue({});
        (getCachePerformanceReport as jest.Mock).mockReturnValue({});

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle errors from getDashboardPerformanceReport', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'admin-123', type: 'ADMIN' },
          error: null,
        });

        (getDashboardPerformanceReport as jest.Mock).mockImplementation(() => {
          throw new Error('Failed to fetch dashboard metrics');
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        await expectErrorResponse(
          response,
          500,
          /Failed to fetch performance metrics/i
        );
      });

      it('should handle errors from getCachePerformanceReport', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'admin-123', type: 'ADMIN' },
          error: null,
        });

        (getDashboardPerformanceReport as jest.Mock).mockReturnValue({});
        (getCachePerformanceReport as jest.Mock).mockImplementation(() => {
          throw new Error('Failed to fetch cache metrics');
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        await expectErrorResponse(response, 500);
      });

      it('should handle authentication service errors', async () => {
        mockSupabaseClient.auth.getUser.mockRejectedValue(
          new Error('Auth service unavailable')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        await expectErrorResponse(response, 500);
      });
    });

    describe('📊 Performance Data Format', () => {
      it('should return data in expected structure', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { id: 'admin-123', type: 'ADMIN' },
          error: null,
        });

        const mockDashboard = {
          metric1: 'value1',
          metric2: 100,
        };
        const mockCache = {
          size: 50,
          hitRate: 0.8,
        };

        (getDashboardPerformanceReport as jest.Mock).mockReturnValue(
          mockDashboard
        );
        (getCachePerformanceReport as jest.Mock).mockReturnValue(mockCache);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/performance'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('dashboard');
        expect(data).toHaveProperty('cache');
        expect(data).toHaveProperty('environment');
        expect(data.dashboard).toEqual(mockDashboard);
        expect(data.cache).toEqual(mockCache);
      });
    });
  });
});
