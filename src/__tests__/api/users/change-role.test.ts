// src/__tests__/api/users/change-role.test.ts

import { POST } from '@/app/api/users/[userId]/change-role/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { createPostRequest } from '@/__tests__/helpers/api-test-helpers';
import { UserType } from '@/types/prisma';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('/api/users/[userId]/change-role POST API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should verify user authentication before processing', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'No auth token' },
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });

      expect(response.status).toBe(401);
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    });
  });

  describe('🛡️ Authorization Tests', () => {
    it('should return 403 for non-SUPER_ADMIN users', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'admin-user-id',
            email: 'admin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.ADMIN, // Not SUPER_ADMIN
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'VENDOR' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: Only Super Admins can change user roles.');
    });

    it('should allow SUPER_ADMIN to change roles', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      (prisma.profile.update as jest.Mock).mockResolvedValue({
        id: 'target-user-id',
        email: 'target@example.com',
        type: UserType.ADMIN,
        name: 'Target User',
        status: 'active',
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);
    });

    it('should prevent CLIENT from changing roles', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'client-user-id',
            email: 'client@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.CLIENT,
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: Only Super Admins can change user roles.');
    });

    it('should prevent VENDOR from changing roles', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'vendor-user-id',
            email: 'vendor@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.VENDOR,
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: Only Super Admins can change user roles.');
    });

    it('should prevent DRIVER from changing roles', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'driver-user-id',
            email: 'driver@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.DRIVER,
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: Only Super Admins can change user roles.');
    });
  });

  describe('🚫 Self-Role Change Prevention', () => {
    it('should prevent user from changing their own role', async () => {
      const userId = 'super-admin-id';

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: userId,
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      const request = createPostRequest(
        `http://localhost:3000/api/users/${userId}/change-role`,
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Cannot change your own role via this endpoint.');
    });

    it('should allow changing other users roles', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      (prisma.profile.update as jest.Mock).mockResolvedValue({
        id: 'different-user-id',
        email: 'target@example.com',
        type: UserType.ADMIN,
        name: 'Target User',
        status: 'active',
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/different-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'different-user-id' });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);
    });
  });

  describe('✅ Input Validation Tests', () => {
    it('should return 400 for invalid role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'INVALID_ROLE' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid role provided');
    });

    it('should return 400 for missing role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        {}
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid role provided');
    });

    it('should return 400 for null role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: null }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid role provided');
    });

    it('should accept role in lowercase and convert to uppercase', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      (prisma.profile.update as jest.Mock).mockResolvedValue({
        id: 'target-user-id',
        email: 'target@example.com',
        type: UserType.ADMIN,
        name: 'Target User',
        status: 'active',
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'admin' } // lowercase
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { id: 'target-user-id' },
        data: { type: 'ADMIN' }, // Should be uppercase
        select: {
          id: true,
          email: true,
          type: true,
          name: true,
          status: true,
        },
      });
    });

    it('should accept role in mixed case', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      (prisma.profile.update as jest.Mock).mockResolvedValue({
        id: 'target-user-id',
        email: 'target@example.com',
        type: UserType.VENDOR,
        name: 'Target User',
        status: 'active',
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'VeNdOr' } // mixed case
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { id: 'target-user-id' },
        data: { type: 'VENDOR' },
        select: {
          id: true,
          email: true,
          type: true,
          name: true,
          status: true,
        },
      });
    });
  });

  describe('✅ Successful Role Changes', () => {
    it('should successfully change user role to ADMIN', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      const updatedUser = {
        id: 'target-user-id',
        email: 'target@example.com',
        type: UserType.ADMIN,
        name: 'Target User',
        status: 'active',
      };

      (prisma.profile.update as jest.Mock).mockResolvedValue(updatedUser);

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('User role updated successfully');
      expect(data.user).toEqual(updatedUser);
    });

    it('should successfully change user role to VENDOR', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      const updatedUser = {
        id: 'target-user-id',
        email: 'target@example.com',
        type: UserType.VENDOR,
        name: 'Target User',
        status: 'active',
      };

      (prisma.profile.update as jest.Mock).mockResolvedValue(updatedUser);

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'VENDOR' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.type).toBe(UserType.VENDOR);
    });

    it('should successfully change user role to DRIVER', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      const updatedUser = {
        id: 'target-user-id',
        email: 'target@example.com',
        type: UserType.DRIVER,
        name: 'Target User',
        status: 'active',
      };

      (prisma.profile.update as jest.Mock).mockResolvedValue(updatedUser);

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'DRIVER' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.type).toBe(UserType.DRIVER);
    });

    it('should successfully change user role to CLIENT', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      const updatedUser = {
        id: 'target-user-id',
        email: 'target@example.com',
        type: UserType.CLIENT,
        name: 'Target User',
        status: 'active',
      };

      (prisma.profile.update as jest.Mock).mockResolvedValue(updatedUser);

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'CLIENT' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.type).toBe(UserType.CLIENT);
    });
  });

  describe('❌ Error Handling Tests', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      (prisma.profile.update as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle Prisma P2025 error (record not found)', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      const prismaError = new Error('Record not found');
      (prismaError as any).code = 'P2025';
      (prisma.profile.update as jest.Mock).mockRejectedValue(prismaError);

      const request = createPostRequest(
        'http://localhost:3000/api/users/nonexistent-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'nonexistent-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle profile lookup errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockRejectedValue(
        new Error('Profile lookup failed')
      );

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('🔒 Security Tests', () => {
    it('should not expose database error details', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      (prisma.profile.update as jest.Mock).mockRejectedValue(
        new Error('Internal: Database connection string postgres://user:pass@host')
      );

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.error).not.toContain('postgres');
      expect(data.error).not.toContain('password');
    });

    it('should validate role against enum values', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'MALICIOUS_ROLE' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid role provided');
    });
  });

  describe('📊 Response Format Tests', () => {
    it('should return updated user with all required fields', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      const updatedUser = {
        id: 'target-user-id',
        email: 'target@example.com',
        type: UserType.ADMIN,
        name: 'Target User',
        status: 'active',
      };

      (prisma.profile.update as jest.Mock).mockResolvedValue(updatedUser);

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('id');
      expect(data.user).toHaveProperty('email');
      expect(data.user).toHaveProperty('type');
      expect(data.user).toHaveProperty('name');
      expect(data.user).toHaveProperty('status');
    });

    it('should not include sensitive fields in response', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'super-admin-id',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      const updatedUser = {
        id: 'target-user-id',
        email: 'target@example.com',
        type: UserType.ADMIN,
        name: 'Target User',
        status: 'active',
      };

      (prisma.profile.update as jest.Mock).mockResolvedValue(updatedUser);

      const request = createPostRequest(
        'http://localhost:3000/api/users/target-user-id/change-role',
        { newRole: 'ADMIN' }
      );

      const params = Promise.resolve({ userId: 'target-user-id' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(data.user).not.toHaveProperty('password');
      expect(data.user).not.toHaveProperty('deletedAt');
    });
  });
});
