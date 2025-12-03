// src/__tests__/api/users/user-status.test.ts

import { PUT } from '@/app/api/users/updateUserStatus/route';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { UserStatus, UserType } from '@/types/prisma';
import {
  createPutRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    // Mock $transaction to execute the callback with the same mocked prisma
    $transaction: jest.fn((callback) => callback({
      profile: {
        update: jest.fn(),
      },
    })),
  },
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

// Mock UserAuditService
jest.mock('@/services/userAuditService', () => ({
  UserAuditService: jest.fn().mockImplementation(() => ({
    createAuditEntry: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('PUT /api/users/updateUserStatus - Update User Status', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('✅ Successful Status Updates', () => {
    it('should update user status to ACTIVE by SUPER_ADMIN', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { type: UserType.SUPER_ADMIN },
        error: null,
      });

      // Mock current user status lookup
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        status: UserStatus.PENDING,
      });

      const mockUpdatedUser = {
        id: 'user-456',
        name: 'John Doe',
        email: 'john@example.com',
        type: UserType.CLIENT,
        status: UserStatus.ACTIVE,
      };

      // Mock the transaction to return the updated user
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = {
          profile: {
            update: jest.fn().mockResolvedValue(mockUpdatedUser),
          },
        };
        return callback(txMock);
      });

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.message).toMatch(/updated successfully/i);
      expect(data.user.status).toBe(UserStatus.ACTIVE);
      expect(data.user.id).toBe('user-456');
    });

    it('should update user status to PENDING by ADMIN', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { type: UserType.ADMIN },
        error: null,
      });

      // Mock current user status lookup
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        status: UserStatus.ACTIVE,
      });

      const mockUpdatedUser = {
        id: 'user-789',
        name: 'Jane Smith',
        email: 'jane@example.com',
        type: UserType.VENDOR,
        status: UserStatus.PENDING,
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = {
          profile: {
            update: jest.fn().mockResolvedValue(mockUpdatedUser),
          },
        };
        return callback(txMock);
      });

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-789',
          newStatus: 'pending',
        }
      );

      const response = await PUT(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.user.status).toBe(UserStatus.PENDING);
    });

    it('should update user status to DELETED by HELPDESK', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'helpdesk-123' } },
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { type: UserType.HELPDESK },
        error: null,
      });

      // Mock current user status lookup
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        status: UserStatus.ACTIVE,
      });

      const mockUpdatedUser = {
        id: 'user-101',
        name: 'Bob Johnson',
        email: 'bob@example.com',
        type: UserType.DRIVER,
        status: UserStatus.DELETED,
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = {
          profile: {
            update: jest.fn().mockResolvedValue(mockUpdatedUser),
          },
        };
        return callback(txMock);
      });

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-101',
          newStatus: 'deleted',
        }
      );

      const response = await PUT(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.user.status).toBe(UserStatus.DELETED);
    });

    it('should return updated user with all required fields', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { type: UserType.SUPER_ADMIN },
        error: null,
      });

      // Mock current user status lookup
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        status: UserStatus.PENDING,
      });

      const mockUpdatedUser = {
        id: 'user-456',
        name: 'Test User',
        email: 'test@example.com',
        type: UserType.CLIENT,
        status: UserStatus.ACTIVE,
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = {
          profile: {
            update: jest.fn().mockResolvedValue(mockUpdatedUser),
          },
        };
        return callback(txMock);
      });

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.user).toHaveProperty('id');
      expect(data.user).toHaveProperty('name');
      expect(data.user).toHaveProperty('email');
      expect(data.user).toHaveProperty('type');
      expect(data.user).toHaveProperty('status');
    });

    it('should handle fallback to Prisma when Supabase profile not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      // Supabase profile not found
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: null,
      });

      const mockUpdatedUser = {
        id: 'user-456',
        name: 'Test User',
        email: 'test@example.com',
        type: UserType.CLIENT,
        status: UserStatus.ACTIVE,
      };

      // Prisma fallback for role check + current user status lookup
      (prisma.profile.findUnique as jest.Mock)
        .mockResolvedValueOnce({ type: UserType.ADMIN }) // role check
        .mockResolvedValueOnce({ status: UserStatus.PENDING }); // current status

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = {
          profile: {
            update: jest.fn().mockResolvedValue(mockUpdatedUser),
          },
        };
        return callback(txMock);
      });

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.message).toMatch(/updated successfully/i);
    });
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      await expectUnauthorized(response);
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });

    it('should return 401 when auth.getUser returns error', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Auth error'),
      });

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      await expectUnauthorized(response);
    });
  });

  describe('🔒 Authorization Tests', () => {
    it('should return 403 when CLIENT tries to update status', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'client-123' } },
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { type: UserType.CLIENT },
        error: null,
      });

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      await expectForbidden(response, /Only admins, helpdesk, and super admin/i);
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });

    it('should return 403 when VENDOR tries to update status', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'vendor-123' } },
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { type: UserType.VENDOR },
        error: null,
      });

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      await expectForbidden(response);
    });

    it('should return 403 when DRIVER tries to update status', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'driver-123' } },
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { type: UserType.DRIVER },
        error: null,
      });

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      await expectForbidden(response);
    });

    it('should return 403 when user type is undefined', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      await expectForbidden(response);
    });
  });

  describe('✏️ Validation Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { type: UserType.SUPER_ADMIN },
        error: null,
      });
    });

    it('should return 400 when userId is missing', async () => {
      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      await expectErrorResponse(response, 400, /Missing required fields/i);
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });

    it('should return 400 when newStatus is missing', async () => {
      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
        }
      );

      const response = await PUT(request);
      await expectErrorResponse(response, 400, /Missing required fields/i);
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });

    it('should return 400 when both userId and newStatus are missing', async () => {
      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {}
      );

      const response = await PUT(request);
      await expectErrorResponse(response, 400, /Missing required fields/i);
    });

    it('should return 400 when newStatus is invalid', async () => {
      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'invalid-status',
        }
      );

      const response = await PUT(request);
      await expectErrorResponse(
        response,
        400,
        /Invalid status. Must be one of: active, pending, deleted/i
      );
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });

    it('should return 400 for uppercase status (should be lowercase)', async () => {
      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'ACTIVE',
        }
      );

      const response = await PUT(request);
      await expectErrorResponse(response, 400, /Invalid status/i);
    });

    it('should return 400 for mixed case status', async () => {
      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'Active',
        }
      );

      const response = await PUT(request);
      await expectErrorResponse(response, 400, /Invalid status/i);
    });

    it('should return 400 for empty string status', async () => {
      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: '',
        }
      );

      const response = await PUT(request);
      await expectErrorResponse(response, 400, /Missing required fields/i);
    });

    it('should return 400 for empty string userId', async () => {
      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: '',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      await expectErrorResponse(response, 400, /Missing required fields/i);
    });
  });

  describe('❌ Error Handling', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { type: UserType.SUPER_ADMIN },
        error: null,
      });
    });

    it('should return 404 when user is not found (P2025)', async () => {
      // User not found during current status lookup
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'nonexistent-user',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      await expectErrorResponse(response, 404, /User not found/i);
    });

    it('should handle database connection errors', async () => {
      // Mock current user status lookup
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        status: UserStatus.PENDING,
      });

      // Transaction fails
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      await expectErrorResponse(
        response,
        500,
        /Failed to update user status/i
      );
    });

    it('should return 500 when profile lookup fails', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockRejectedValue(
        new Error('Profile query failed')
      );

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      await expectErrorResponse(response, 500, /Internal Server Error/i);
    });

    it('should handle database timeout errors', async () => {
      // Mock current user status lookup
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        status: UserStatus.PENDING,
      });

      // Transaction fails with timeout
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Query timeout exceeded')
      );

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      await expectErrorResponse(response, 500);
    });

    it('should handle constraint violation errors', async () => {
      // Mock current user status lookup
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        status: UserStatus.PENDING,
      });

      // Transaction fails with constraint error
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Unique constraint failed')
      );

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      await expectErrorResponse(response, 500);
    });
  });

  describe('📊 Edge Cases', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { type: UserType.SUPER_ADMIN },
        error: null,
      });
    });

    it('should allow updating user to same status (idempotent)', async () => {
      const mockUpdatedUser = {
        id: 'user-456',
        name: 'Test User',
        email: 'test@example.com',
        type: UserType.CLIENT,
        status: UserStatus.ACTIVE,
      };

      // Mock current status lookup
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        status: UserStatus.ACTIVE,
      });

      // Mock transaction
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = {
          profile: {
            update: jest.fn().mockResolvedValue(mockUpdatedUser),
          },
        };
        return callback(txMock);
      });

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const response = await PUT(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.user.status).toBe(UserStatus.ACTIVE);
    });

    it('should handle all valid status transitions', async () => {
      const statuses = ['active', 'pending', 'deleted'];

      for (const status of statuses) {
        jest.clearAllMocks();

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
        });

        mockSupabaseClient.single.mockResolvedValue({
          data: { type: UserType.SUPER_ADMIN },
          error: null,
        });

        const mockUpdatedUser = {
          id: 'user-456',
          name: 'Test User',
          email: 'test@example.com',
          type: UserType.CLIENT,
          status: status.toUpperCase() as UserStatus,
        };

        // Mock current status lookup
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          status: UserStatus.PENDING,
        });

        // Mock transaction
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          const txMock = {
            profile: {
              update: jest.fn().mockResolvedValue(mockUpdatedUser),
            },
          };
          return callback(txMock);
        });

        const request = createPutRequest(
          'http://localhost:3000/api/users/updateUserStatus',
          {
            userId: 'user-456',
            newStatus: status,
          }
        );

        const response = await PUT(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.user.status).toBe(status.toUpperCase());
      }
    });

    it('should handle concurrent status update requests', async () => {
      const mockUpdatedUser = {
        id: 'user-456',
        name: 'Test User',
        email: 'test@example.com',
        type: UserType.CLIENT,
        status: UserStatus.ACTIVE,
      };

      // Mock current status lookup
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        status: UserStatus.PENDING,
      });

      // Mock transaction
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = {
          profile: {
            update: jest.fn().mockResolvedValue(mockUpdatedUser),
          },
        };
        return callback(txMock);
      });

      const request1 = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'active',
        }
      );

      const request2 = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'pending',
        }
      );

      const [response1, response2] = await Promise.all([
        PUT(request1),
        PUT(request2),
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it('should properly convert lowercase status to uppercase enum', async () => {
      const mockUpdatedUser = {
        id: 'user-456',
        name: 'Test User',
        email: 'test@example.com',
        type: UserType.CLIENT,
        status: UserStatus.DELETED,
      };

      // Mock current status lookup
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        status: UserStatus.ACTIVE,
      });

      // Mock transaction and capture the update call
      const mockUpdate = jest.fn().mockResolvedValue(mockUpdatedUser);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = {
          profile: {
            update: mockUpdate,
          },
        };
        return callback(txMock);
      });

      const request = createPutRequest(
        'http://localhost:3000/api/users/updateUserStatus',
        {
          userId: 'user-456',
          newStatus: 'deleted',
        }
      );

      const response = await PUT(request);
      await expectSuccessResponse(response, 200);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'user-456' },
        data: { status: UserStatus.DELETED },
        select: expect.any(Object),
      });
    });
  });
});
