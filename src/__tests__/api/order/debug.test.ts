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

import { GET } from '@/app/api/order/debug/route';
import { checkVendorAccess } from '@/lib/services/vendor';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

describe('/api/order/debug GET API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('❌ Error Handling Tests', () => {
    it('should return 500 when outer try-catch catches error', async () => {
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        throw new Error('Catastrophic failure');
      });

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('timestamp');
      expect(data.status).toBe('Error during diagnosis');
    });

    it('should handle generic error message', async () => {
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        throw new Error();
      });

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to run debug tests');
    });

    it('should log errors to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      await GET(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '🔍 Debug API Error:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error thrown values', async () => {
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        throw 'String error';
      });

      const request = createGetRequest('http://localhost:3000/api/order/debug');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to run debug tests');
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
});
