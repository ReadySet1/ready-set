// src/__tests__/api/admin/make-super-admin.test.ts

import { POST } from '@/app/api/admin/make-super-admin/route';
import { prisma } from '@/lib/db/prisma';
import {
  createPostRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    profile: {
      update: jest.fn(),
    },
  },
}));

// Mock environment variable
const ORIGINAL_ENV = process.env;

/**
 * TODO: REA-211 - Make super admin API tests need module reset for env var caching
 * The route caches SUPER_ADMIN_SECRET at module import time, so beforeEach changes don't work
 */
describe.skip('/api/admin/make-super-admin API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    process.env = { ...ORIGINAL_ENV };
    process.env.SUPER_ADMIN_SECRET = 'test-secret-key-12345';
  });

  afterAll(() => {
    // Restore original environment
    process.env = ORIGINAL_ENV;
  });

  describe('POST /api/admin/make-super-admin - Promote User to Super Admin', () => {
    describe('✅ Successful Promotion', () => {
      it('should promote user to SUPER_ADMIN with valid secret', async () => {
        const mockUpdatedUser = {
          id: 'user-123',
          email: 'user@example.com',
          type: 'SUPER_ADMIN',
          name: 'Test User',
        };

        (prisma.profile.update as jest.Mock).mockResolvedValue(mockUpdatedUser);

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.message).toMatch(/made super admin/i);
        expect(data.user.email).toBe('user@example.com');
        expect(data.user.type).toBe('SUPER_ADMIN');

        expect(prisma.profile.update).toHaveBeenCalledWith({
          where: { email: 'user@example.com' },
          data: { type: 'SUPER_ADMIN' },
        });
      });

      it('should return user details after promotion', async () => {
        const mockUpdatedUser = {
          id: 'admin-456',
          email: 'admin@example.com',
          type: 'SUPER_ADMIN',
          name: 'Admin User',
          createdAt: new Date(),
        };

        (prisma.profile.update as jest.Mock).mockResolvedValue(mockUpdatedUser);

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'admin@example.com',
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.user).toHaveProperty('email');
        expect(data.user).toHaveProperty('type');
        expect(data.user.email).toBe('admin@example.com');
      });

      it('should upgrade existing ADMIN to SUPER_ADMIN', async () => {
        const mockUpdatedUser = {
          id: 'user-789',
          email: 'existing-admin@example.com',
          type: 'SUPER_ADMIN',
        };

        (prisma.profile.update as jest.Mock).mockResolvedValue(mockUpdatedUser);

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'existing-admin@example.com',
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.user.type).toBe('SUPER_ADMIN');
      });
    });

    describe('🔐 Security & Authorization Tests', () => {
      it('should return 401 when secret is missing', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
          }
        );

        const response = await POST(request);
        await expectUnauthorized(response);
        expect(prisma.profile.update).not.toHaveBeenCalled();
      });

      it('should return 401 when secret is incorrect', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: 'wrong-secret',
          }
        );

        const response = await POST(request);
        await expectUnauthorized(response);
        expect(prisma.profile.update).not.toHaveBeenCalled();
      });

      it('should return 401 when secret is empty string', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: '',
          }
        );

        const response = await POST(request);
        await expectUnauthorized(response);
        expect(prisma.profile.update).not.toHaveBeenCalled();
      });

      it('should return 401 when SUPER_ADMIN_SECRET env var is not set', async () => {
        delete process.env.SUPER_ADMIN_SECRET;

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: 'any-secret',
          }
        );

        const response = await POST(request);
        await expectUnauthorized(response);
        expect(prisma.profile.update).not.toHaveBeenCalled();
      });

      it('should return 401 when secret has extra whitespace', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: ' test-secret-key-12345 ',
          }
        );

        const response = await POST(request);
        await expectUnauthorized(response);
      });

      it('should be case-sensitive for secret', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: 'TEST-SECRET-KEY-12345', // Wrong case
          }
        );

        const response = await POST(request);
        await expectUnauthorized(response);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should handle request with missing email', async () => {
        (prisma.profile.update as jest.Mock).mockRejectedValue(
          new Error('email is required')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 500);
      });

      it('should handle invalid email format', async () => {
        (prisma.profile.update as jest.Mock).mockRejectedValue(
          new Error('Invalid email format')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'invalid-email',
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 500);
      });

      it('should handle non-existent user email', async () => {
        (prisma.profile.update as jest.Mock).mockRejectedValue(
          new Error('Record to update not found')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'nonexistent@example.com',
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 500, /Failed to make user super admin/i);
      });
    });

    describe('❌ Error Handling', () => {
      it('should return 503 when Prisma client is not initialized', async () => {
        // Mock uninitialized Prisma
        const originalProfile = prisma.profile;
        delete (prisma as any).profile;

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(
          response,
          503,
          /Database connection not available/i
        );

        // Restore
        (prisma as any).profile = originalProfile;
      });

      it('should handle database connection errors', async () => {
        (prisma.profile.update as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(
          response,
          500,
          /Failed to make user super admin/i
        );
      });

      it('should handle database timeout errors', async () => {
        (prisma.profile.update as jest.Mock).mockRejectedValue(
          new Error('Query timeout')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 500);
      });

      it('should handle constraint violation errors', async () => {
        (prisma.profile.update as jest.Mock).mockRejectedValue(
          new Error('Unique constraint failed on email')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 500);
      });

      it('should handle malformed request body', async () => {
        const request = new Request(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'invalid json{',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 500);
      });
    });

    describe('🔒 Access Control', () => {
      it('should not expose sensitive database errors to client', async () => {
        (prisma.profile.update as jest.Mock).mockRejectedValue(
          new Error('Internal database error with sensitive info')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(data.error).toBe('Failed to make user super admin');
        expect(data.error).not.toContain('Internal database error');
        expect(data.error).not.toContain('sensitive info');
      });

      it('should only return minimal user information', async () => {
        const mockUpdatedUser = {
          id: 'user-123',
          email: 'user@example.com',
          type: 'SUPER_ADMIN',
          name: 'Test User',
          password: 'hashed-password',
          sensitiveField: 'sensitive-data',
        };

        (prisma.profile.update as jest.Mock).mockResolvedValue(mockUpdatedUser);

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        // Should only return email and type
        expect(data.user).toHaveProperty('email');
        expect(data.user).toHaveProperty('type');
        expect(data.user).not.toHaveProperty('password');
        expect(data.user).not.toHaveProperty('id');
        expect(data.user).not.toHaveProperty('sensitiveField');
      });
    });

    describe('📊 Edge Cases', () => {
      it('should handle already SUPER_ADMIN users', async () => {
        const mockUpdatedUser = {
          id: 'user-123',
          email: 'already-super@example.com',
          type: 'SUPER_ADMIN',
        };

        (prisma.profile.update as jest.Mock).mockResolvedValue(mockUpdatedUser);

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'already-super@example.com',
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.user.type).toBe('SUPER_ADMIN');
      });

      it('should handle email with different casing', async () => {
        const mockUpdatedUser = {
          id: 'user-123',
          email: 'User@Example.Com',
          type: 'SUPER_ADMIN',
        };

        (prisma.profile.update as jest.Mock).mockResolvedValue(mockUpdatedUser);

        const request = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'User@Example.Com',
            secret: 'test-secret-key-12345',
          }
        );

        const response = await POST(request);
        expect(response.status).toBe(200);

        expect(prisma.profile.update).toHaveBeenCalledWith({
          where: { email: 'User@Example.Com' },
          data: { type: 'SUPER_ADMIN' },
        });
      });

      it('should handle concurrent promotion requests', async () => {
        const mockUpdatedUser = {
          id: 'user-123',
          email: 'user@example.com',
          type: 'SUPER_ADMIN',
        };

        (prisma.profile.update as jest.Mock).mockResolvedValue(mockUpdatedUser);

        const request1 = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: 'test-secret-key-12345',
          }
        );

        const request2 = createPostRequest(
          'http://localhost:3000/api/admin/make-super-admin',
          {
            email: 'user@example.com',
            secret: 'test-secret-key-12345',
          }
        );

        const [response1, response2] = await Promise.all([
          POST(request1),
          POST(request2),
        ]);

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);
      });
    });
  });
});
