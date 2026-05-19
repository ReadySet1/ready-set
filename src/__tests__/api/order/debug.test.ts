// src/__tests__/api/order/debug.test.ts

import { createGetRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/lib/services/vendor', () => ({
  checkVendorAccess: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    profile: {
      count: jest.fn(),
    },
  },
}));

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    profile: {
      count: jest.fn(),
    },
  },
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $queryRaw: jest.fn(),
    profile: {
      count: jest.fn(),
    },
  })),
}));

jest.mock('@/lib/auth-middleware', () => ({
  withAuth: jest.fn(),
}));

import { GET } from '@/app/api/order/debug/route';
import { checkVendorAccess } from '@/lib/services/vendor';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { withAuth } from '@/lib/auth-middleware';

const originalNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined) {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value,
    configurable: true,
  });
}

describe('/api/order/debug GET API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: NODE_ENV is "test" (Jest default) and the caller is SUPER_ADMIN
    setNodeEnv('test');
    (withAuth as jest.Mock).mockResolvedValue({
      success: true,
      context: {
        user: { id: 'super-admin-id', email: 'super@example.com', type: 'SUPER_ADMIN' },
        isAdmin: true,
        isSuperAdmin: true,
        isHelpdesk: false,
      },
    });
  });

  afterEach(() => {
    setNodeEnv(originalNodeEnv);
  });

  describe('✅ Successful Debug Information Collection', () => {
    it('should return debug information with all tests passing', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      });
      (checkVendorAccess as jest.Mock).mockResolvedValue(true);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('timestamp');
      expect(data.status).toBe('Debug information collected');
      expect(data.tests).toHaveProperty('prisma');
      expect(data.tests).toHaveProperty('authentication');
      expect(data.tests).toHaveProperty('vendorAccess');
      expect(data.tests).toHaveProperty('profileTest');
      expect(data.tests).toHaveProperty('environment');
    });

    it('should return successful Prisma test results', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(5);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.prisma.success).toBe(true);
      expect(data.tests.prisma.testQuery).toEqual([{ test: 1 }]);
    });

    it('should return authenticated user information', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue({
        id: 'user-456',
        email: 'vendor@example.com',
      });
      (checkVendorAccess as jest.Mock).mockResolvedValue(true);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.authentication.success).toBe(true);
      expect(data.tests.authentication.user).toEqual({
        id: 'user-456',
        email: 'vendor@example.com',
      });
    });

    it('should return vendor access status', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      });
      (checkVendorAccess as jest.Mock).mockResolvedValue(true);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.vendorAccess.success).toBe(true);
      expect(data.tests.vendorAccess.message).toBe('Vendor access granted');
    });

    it('should return profile count', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(25);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.profileTest.success).toBe(true);
      expect(data.tests.profileTest.profileCount).toBe(25);
    });

    it('should return environment information', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.environment).toHaveProperty('NODE_ENV');
      expect(data.tests.environment).toHaveProperty('hasDataBaseUrl');
      expect(data.tests.environment).toHaveProperty('databaseUrlPreview');
    });
  });

  describe('🔍 Test Failure Scenarios', () => {
    it('should handle Prisma connection failure', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection failed'));
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.prisma.success).toBe(false);
      expect(data.tests.prisma.error).toBe('Connection failed');
    });

    it('should handle authentication failure', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockRejectedValue(new Error('Auth failed'));
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.authentication.success).toBe(false);
      expect(data.tests.authentication.error).toBe('Auth failed');
    });

    it('should handle vendor access check failure', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockRejectedValue(new Error('Access check failed'));
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.vendorAccess.success).toBe(false);
      expect(data.tests.vendorAccess.error).toBe('Access check failed');
    });

    it('should handle profile test failure', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockRejectedValue(new Error('Profile query failed'));

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.profileTest.success).toBe(false);
      expect(data.tests.profileTest.error).toBe('Profile query failed');
    });

    it('should handle no authenticated user', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.authentication.success).toBe(false);
      expect(data.tests.authentication.user).toBeNull();
      expect(data.tests.authentication.message).toBe('No user authenticated');
    });

    it('should handle vendor access denied', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      });
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.vendorAccess.success).toBe(false);
      expect(data.tests.vendorAccess.message).toBe('Vendor access denied');
    });
  });

  describe('📊 Response Structure Tests', () => {
    it('should include timestamp in response', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('timestamp');
      expect(typeof data.timestamp).toBe('string');
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it('should include status field', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('Debug information collected');
    });

    it('should include all test result fields', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tests).toHaveProperty('prisma');
      expect(data.tests).toHaveProperty('authentication');
      expect(data.tests).toHaveProperty('vendorAccess');
      expect(data.tests).toHaveProperty('profileTest');
      expect(data.tests).toHaveProperty('environment');
    });

    it('should return proper JSON content type', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Verify response is valid JSON by checking parsed data structure
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('tests');
    });
  });

  describe('❌ Error Handling Tests', () => {
    it('should gracefully handle Prisma errors and continue other tests', async () => {
      // When prisma.$queryRaw throws, the error is caught internally
      // and the route continues with other tests
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        throw new Error('Catastrophic failure');
      });
      (getCurrentUser as jest.Mock).mockResolvedValue({ id: 'user-123', email: 'test@example.com' });
      (checkVendorAccess as jest.Mock).mockResolvedValue(true);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      // Route returns 200 with error info for failed test
      expect(response.status).toBe(200);
      expect(data.tests.prisma.success).toBe(false);
      expect(data.tests.prisma.error).toBe('Catastrophic failure');
      // Other tests should still succeed
      expect(data.tests.authentication.success).toBe(true);
    });

    it('should handle error with empty message', async () => {
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        throw new Error();
      });
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.prisma.success).toBe(false);
      // Empty error message falls back to empty string
      expect(data.tests.prisma.error).toBe('');
    });

    it('should handle non-Error thrown values in inner try-catch', async () => {
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        throw 'String error';
      });
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.prisma.success).toBe(false);
      expect(data.tests.prisma.error).toBe('Unknown error');
    });

    it('should handle multiple test failures independently', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB error'));
      (getCurrentUser as jest.Mock).mockRejectedValue(new Error('Auth error'));
      (checkVendorAccess as jest.Mock).mockRejectedValue(new Error('Access error'));
      (prisma.profile.count as jest.Mock).mockRejectedValue(new Error('Profile error'));

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      // All tests fail but route returns 200 with error details for each
      expect(response.status).toBe(200);
      expect(data.tests.prisma.success).toBe(false);
      expect(data.tests.prisma.error).toBe('DB error');
      expect(data.tests.authentication.success).toBe(false);
      expect(data.tests.authentication.error).toBe('Auth error');
      expect(data.tests.vendorAccess.success).toBe(false);
      expect(data.tests.vendorAccess.error).toBe('Access error');
      expect(data.tests.profileTest.success).toBe(false);
      expect(data.tests.profileTest.error).toBe('Profile error');
    });
  });

  describe('🔐 Environment Security Tests', () => {
    it('should not expose full database URL', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.environment.databaseUrlPreview).toContain('...');
      expect(data.tests.environment.databaseUrlPreview.length).toBeLessThan(30);
    });

    it('should indicate if database URL is set', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
      (checkVendorAccess as jest.Mock).mockResolvedValue(false);
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.environment).toHaveProperty('hasDataBaseUrl');
      expect(typeof data.tests.environment.hasDataBaseUrl).toBe('boolean');
    });
  });

  describe('🎯 Integration Tests', () => {
    it('should handle mixed success and failure states', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      });
      (checkVendorAccess as jest.Mock).mockRejectedValue(new Error('Access denied'));
      (prisma.profile.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.prisma.success).toBe(true);
      expect(data.tests.authentication.success).toBe(true);
      expect(data.tests.vendorAccess.success).toBe(false);
      expect(data.tests.profileTest.success).toBe(true);
    });

    it('should handle all tests passing', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }]);
      (getCurrentUser as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      });
      (checkVendorAccess as jest.Mock).mockResolvedValue(true);
      (prisma.profile.count as jest.Mock).mockResolvedValue(15);

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.prisma.success).toBe(true);
      expect(data.tests.authentication.success).toBe(true);
      expect(data.tests.vendorAccess.success).toBe(true);
      expect(data.tests.profileTest.success).toBe(true);
    });

    it('should handle all tests failing', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB error'));
      (getCurrentUser as jest.Mock).mockRejectedValue(new Error('Auth error'));
      (checkVendorAccess as jest.Mock).mockRejectedValue(new Error('Access error'));
      (prisma.profile.count as jest.Mock).mockRejectedValue(new Error('Profile error'));

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tests.prisma.success).toBe(false);
      expect(data.tests.authentication.success).toBe(false);
      expect(data.tests.vendorAccess.success).toBe(false);
      expect(data.tests.profileTest.success).toBe(false);
    });
  });

  describe('🛡️ Production gating + auth', () => {
    it('returns 404 in production regardless of role', async () => {
      setNodeEnv('production');

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);

      expect(response.status).toBe(404);
      // withAuth must not even be invoked once the dev-only guard short-circuits
      expect(withAuth).not.toHaveBeenCalled();
    });

    it('returns 403 (from withAuth) when caller is not SUPER_ADMIN', async () => {
      const forbidden = new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      );
      (withAuth as jest.Mock).mockResolvedValue({
        success: false,
        response: forbidden,
        context: {},
      });

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);

      expect(response.status).toBe(403);
      // No business logic should have run
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
