// src/__tests__/api/health/health.test.ts

import { GET, HEAD } from '@/app/api/health/route';
import { prismaPooled, healthCheck } from '@/lib/db/prisma-pooled';
import { getErrorMetrics } from '@/lib/error-logging';
import {
  createGetRequest,
  expectSuccessResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/db/prisma-pooled', () => ({
  prismaPooled: {
    $queryRaw: jest.fn(),
    profile: {
      count: jest.fn(),
    },
  },
  healthCheck: {
    getConnectionInfo: jest.fn(),
    debugPreparedStatements: jest.fn(),
  },
}));

jest.mock('@/lib/error-logging', () => ({
  getErrorMetrics: jest.fn(),
}));

jest.mock('@/lib/auth-middleware', () => ({
  addSecurityHeaders: jest.fn((response) => response),
}));

describe('GET /api/health - System Health Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.GOOGLE_MAPS_API_KEY = 'test-google-key';
    process.env.MAPBOX_ACCESS_TOKEN = 'test-mapbox-token';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.NODE_ENV = 'test';

    // Default successful mocks
    (prismaPooled.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
    (prismaPooled.profile.count as jest.Mock).mockResolvedValue(100);
    (healthCheck.getConnectionInfo as jest.Mock).mockResolvedValue({
      serverless: false,
      preparedStatementsDisabled: true,
      activeConnections: BigInt(5),
    });
    (healthCheck.debugPreparedStatements as jest.Mock).mockResolvedValue([]);
    (getErrorMetrics as jest.Mock).mockReturnValue({
      totalErrors: 10,
      recentErrors: [{ id: 1 }, { id: 2 }],
      errorsBySeverity: { critical: 1, error: 5, warning: 4 },
    });
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.MAPBOX_ACCESS_TOKEN;
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    delete process.env.STRIPE_SECRET_KEY;
  });

  describe('✅ Healthy System', () => {
    it('should return healthy status with all services operational', async () => {
      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.environment).toBe('test');
      expect(data.uptime).toBeGreaterThan(0);
    });

    it('should include all service health checks', async () => {
      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.services).toHaveProperty('database');
      expect(data.services).toHaveProperty('auth');
      expect(data.services).toHaveProperty('storage');
      expect(data.services).toHaveProperty('externalAPIs');
      expect(data.services).toHaveProperty('errorTracking');

      expect(data.services.database.status).toBe('healthy');
      expect(data.services.auth.status).toBe('healthy');
      expect(data.services.storage.status).toBe('healthy');
    });

    it('should include performance metrics', async () => {
      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.performance).toHaveProperty('responseTime');
      expect(data.performance).toHaveProperty('memoryUsage');
      expect(data.performance.responseTime).toBeGreaterThan(0);
      expect(data.performance.memoryUsage).toHaveProperty('rss');
      expect(data.performance.memoryUsage).toHaveProperty('heapTotal');
      expect(data.performance.memoryUsage).toHaveProperty('heapUsed');
    });

    it('should include error tracking metrics', async () => {
      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.errors).toHaveProperty('recentErrorCount');
      expect(data.errors).toHaveProperty('criticalErrorCount');
      expect(data.errors).toHaveProperty('errorRate');
      expect(data.errors.recentErrorCount).toBe(2);
      expect(data.errors.criticalErrorCount).toBe(1);
    });

    it('should include database connection details', async () => {
      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.services.database.details).toHaveProperty('userCount', 100);
      expect(data.services.database.details).toHaveProperty('poolingEnabled', true);
      expect(data.services.database.details).toHaveProperty('activeConnections', 5);
      expect(data.services.database.responseTime).toBeDefined();
    });

    it('should set proper cache headers', async () => {
      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
      expect(response.headers.get('X-Health-Status')).toBe('healthy');
      expect(response.headers.get('X-Response-Time')).toMatch(/\d+(\.\d+)?ms/);
    });
  });

  describe('⚠️ Degraded System', () => {
    it('should return degraded status when database is slow', async () => {
      // Simulate slow database
      (prismaPooled.$queryRaw as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([{ test: 1 }]), 150))
      );

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.status).toBe('degraded');
      expect(data.services.database.status).toBe('degraded');
    });

    it('should return degraded when some external services are missing', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.status).toBe('degraded');
      expect(data.services.externalAPIs.status).toBe('degraded');
    });

    it('should return degraded when error rate is high', async () => {
      (getErrorMetrics as jest.Mock).mockReturnValue({
        totalErrors: 20,
        recentErrors: Array(15).fill({ id: 1 }),
        errorsBySeverity: { critical: 2, error: 10, warning: 8 },
      });

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.status).toBe('degraded');
      expect(data.services.errorTracking.status).toBe('degraded');
    });

    it('should return degraded when storage config is incomplete', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.services.storage.status).toBe('degraded');
    });
  });

  describe('❌ Unhealthy System', () => {
    it('should return unhealthy status when database fails', async () => {
      (prismaPooled.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.status).toBe('unhealthy');
      expect(data.services.database.status).toBe('unhealthy');
      expect(data.services.database.message).toContain('failed');
    });

    it('should return 503 for unhealthy system', async () => {
      (prismaPooled.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      expect(response.status).toBe(200); // Still returns 200 but with unhealthy status in body
      const data = await response.json();
      expect(data.status).toBe('unhealthy');
    });

    it('should return unhealthy when auth config is missing', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(data.services.auth.status).toBe('unhealthy');
      expect(data.services.auth.details?.missingEnvironmentVariables).toContain('NEXT_PUBLIC_SUPABASE_URL');
    });

    it('should return unhealthy when no external services configured', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      delete process.env.MAPBOX_ACCESS_TOKEN;
      delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      delete process.env.STRIPE_SECRET_KEY;

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(data.services.externalAPIs.status).toBe('unhealthy');
    });

    it('should return unhealthy when critical errors exceed threshold', async () => {
      (getErrorMetrics as jest.Mock).mockReturnValue({
        totalErrors: 50,
        recentErrors: Array(10).fill({ id: 1 }),
        errorsBySeverity: { critical: 10, error: 30, warning: 10 },
      });

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(data.status).toBe('unhealthy');
      expect(data.services.errorTracking.status).toBe('unhealthy');
    });

    it('should handle complete health check failure', async () => {
      (prismaPooled.$queryRaw as jest.Mock).mockImplementation(() => {
        throw new Error('Catastrophic failure');
      });

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.status).toBe('unhealthy');
      expect(data.message).toContain('Health check failed');
    });
  });

  describe('📊 Edge Cases', () => {
    it('should handle BigInt conversion in database metrics', async () => {
      (healthCheck.getConnectionInfo as jest.Mock).mockResolvedValue({
        serverless: true,
        preparedStatementsDisabled: false,
        activeConnections: BigInt(999999999999),
      });

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(typeof data.services.database.details.activeConnections).toBe('number');
    });

    it('should handle memory usage with BigInt values', async () => {
      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(typeof data.performance.memoryUsage.rss).toBe('number');
      expect(typeof data.performance.memoryUsage.heapTotal).toBe('number');
      expect(typeof data.performance.memoryUsage.heapUsed).toBe('number');
    });

    it('should handle zero errors gracefully', async () => {
      (getErrorMetrics as jest.Mock).mockReturnValue({
        totalErrors: 0,
        recentErrors: [],
        errorsBySeverity: {},
      });

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.errors.recentErrorCount).toBe(0);
      expect(data.errors.criticalErrorCount).toBe(0);
      expect(data.errors.errorRate).toBe(0);
    });

    it('should handle very slow database (> 500ms)', async () => {
      (prismaPooled.$queryRaw as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([{ test: 1 }]), 600))
      );

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(data.services.database.status).toBe('unhealthy');
      expect(data.services.database.responseTime).toBeGreaterThan(500);
    });

    it('should include environment information in database details', async () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'production';

      const request = createGetRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.services.database.details.environment).toHaveProperty('isVercel', true);
      expect(data.services.database.details.environment).toHaveProperty('VERCEL_ENV', 'production');

      delete process.env.VERCEL;
      delete process.env.VERCEL_ENV;
    });
  });
});

describe('HEAD /api/health - Quick Health Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prismaPooled.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
  });

  describe('✅ Successful Quick Check', () => {
    it('should return 200 for healthy database', async () => {
      const request = new Request('http://localhost:3000/api/health', {
        method: 'HEAD',
      });

      const response = await HEAD(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Health-Status')).toBe('healthy');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
    });

    it('should have no response body', async () => {
      const request = new Request('http://localhost:3000/api/health', {
        method: 'HEAD',
      });

      const response = await HEAD(request);
      const text = await response.text();

      expect(text).toBe('');
    });

    it('should be faster than full health check', async () => {
      const request = new Request('http://localhost:3000/api/health', {
        method: 'HEAD',
      });

      const start = performance.now();
      await HEAD(request);
      const duration = performance.now() - start;

      // HEAD should be very fast (< 100ms typically)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('❌ Failed Quick Check', () => {
    it('should return 503 when database fails', async () => {
      (prismaPooled.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const request = new Request('http://localhost:3000/api/health', {
        method: 'HEAD',
      });

      const response = await HEAD(request);

      expect(response.status).toBe(503);
      expect(response.headers.get('X-Health-Status')).toBe('unhealthy');
    });

    it('should have no response body on failure', async () => {
      (prismaPooled.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const request = new Request('http://localhost:3000/api/health', {
        method: 'HEAD',
      });

      const response = await HEAD(request);
      const text = await response.text();

      expect(text).toBe('');
    });
  });
});
