// src/__tests__/api/users/user-restore.test.ts

import { POST } from '@/app/api/users/[userId]/restore/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { UserType } from '@/types/prisma';
import {
  createPostRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock userSoftDeleteService
const mockRestoreUser = jest.fn();
jest.mock('@/services/userSoftDeleteService', () => ({
  userSoftDeleteService: {
    restoreUser: mockRestoreUser,
  },
}));

describe('/api/users/[userId]/restore API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('POST /api/users/[userId]/restore - Restore Soft-Deleted User', () => {
    describe('✅ Successful Restore', () => {
      it('should restore soft-deleted user by ADMIN', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123', email: 'admin@example.com' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({
            // Requester profile
            type: UserType.ADMIN,
          })
          .mockResolvedValueOnce({
            // Target user profile
            id: 'user-456',
            email: 'deleted@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
            deletedBy: 'admin-999',
            deletionReason: 'Test deletion',
          });

        mockRestoreUser.mockResolvedValue({
          userId: 'user-456',
          restoredAt: new Date('2024-01-20T10:00:00Z'),
          restoredBy: 'admin-123',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.message).toMatch(/restored successfully/i);
        expect(data.summary.restoredUser.id).toBe('user-456');
        expect(data.summary.restoredUser.email).toBe('deleted@example.com');
        expect(data.summary.restoredBy).toBe('admin-123');
        expect(mockRestoreUser).toHaveBeenCalledWith('user-456', 'admin-123');
      });

      it('should restore soft-deleted user by SUPER_ADMIN', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({
            type: UserType.SUPER_ADMIN,
          })
          .mockResolvedValueOnce({
            id: 'user-789',
            email: 'restored@example.com',
            type: UserType.VENDOR,
            deletedAt: new Date('2024-01-10T10:00:00Z'),
            deletedBy: 'admin-555',
            deletionReason: 'Accidental deletion',
          });

        mockRestoreUser.mockResolvedValue({
          userId: 'user-789',
          restoredAt: new Date('2024-01-20T10:00:00Z'),
          restoredBy: 'superadmin-123',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-789/restore',
          {}
        );

        const response = await POST(request);
        expect(response.status).toBe(200);
      });

      it('should return restoration summary with timestamp', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        const restoredAt = new Date('2024-01-20T10:00:00Z');
        mockRestoreUser.mockResolvedValue({
          userId: 'user-456',
          restoredAt,
          restoredBy: 'admin-123',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.summary).toHaveProperty('restoredAt');
        expect(data.summary).toHaveProperty('restoredBy');
        expect(data.summary).toHaveProperty('timestamp');
        expect(data.summary.restoredUser).toHaveProperty('id');
        expect(data.summary.restoredUser).toHaveProperty('email');
        expect(data.summary.restoredUser).toHaveProperty('type');
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: new Error('Unauthorized'),
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        await expectUnauthorized(response, /Authentication required/i);
      });

      it('should return 401 when auth token is invalid', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: new Error('Invalid token'),
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        await expectUnauthorized(response);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 for CLIENT users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'client-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.CLIENT,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        await expectForbidden(
          response,
          /Only Admin or Super Admin can restore users/i
        );
      });

      it('should return 403 for VENDOR users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'vendor-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.VENDOR,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        await expectForbidden(response);
      });

      it('should return 403 for DRIVER users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.DRIVER,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        await expectForbidden(response);
      });

      it('should return 403 for HELPDESK users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'helpdesk-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.HELPDESK,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        await expectForbidden(response);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 when userId is missing from path', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users//restore',
          {}
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, /User ID is required/i);
      });

      it('should return 404 when target user does not exist', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.ADMIN })
          .mockResolvedValueOnce(null); // Target user not found

        const request = createPostRequest(
          'http://localhost:3000/api/users/nonexistent-123/restore',
          {}
        );

        const response = await POST(request);
        await expectErrorResponse(response, 404, /User not found/i);
      });

      it('should return 409 when user is not soft deleted', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'active@example.com',
            type: UserType.CLIENT,
            deletedAt: null, // Not soft deleted
          });

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        await expectErrorResponse(response, 409, /not soft deleted/i);
      });

      it('should handle user with deletedAt as null properly', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: null,
            deletedBy: null,
            deletionReason: null,
          });

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        expect(response.status).toBe(409);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle requester profile fetch errors', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockRejectedValueOnce(
          new Error('Database connection failed')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        await expectErrorResponse(
          response,
          500,
          /Failed to fetch requester profile/i
        );
      });

      it('should handle target user fetch errors', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.ADMIN })
          .mockRejectedValueOnce(new Error('Database timeout'));

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        await expectErrorResponse(response, 500, /Failed to fetch target user/i);
      });

      it('should handle restore service errors', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockRestoreUser.mockRejectedValue(new Error('Restore failed'));

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        await expectErrorResponse(response, 500, /Failed to restore user/i);
      });

      it('should handle "User not found" error from service', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockRestoreUser.mockRejectedValue(new Error('User not found in service'));

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        await expectErrorResponse(response, 404, /User not found/i);
      });

      it('should handle "User is not soft deleted" error from service', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockRestoreUser.mockRejectedValue(
          new Error('User is not soft deleted in system')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        await expectErrorResponse(response, 409, /not soft deleted/i);
      });

      it('should return error code in response', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockRestoreUser.mockRejectedValue(new Error('Database error'));

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        const response = await POST(request);
        const data = await response.json();

        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('code');
        expect(data).toHaveProperty('details');
        expect(data.code).toBe('RESTORE_FAILED');
      });
    });

    describe('🔍 Path Parameter Extraction', () => {
      it('should extract userId correctly from path', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.ADMIN })
          .mockResolvedValueOnce({
            id: 'abc-123-xyz',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockRestoreUser.mockResolvedValue({
          userId: 'abc-123-xyz',
          restoredAt: new Date(),
          restoredBy: 'admin-123',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users/abc-123-xyz/restore',
          {}
        );

        await POST(request);

        expect(mockRestoreUser).toHaveBeenCalledWith('abc-123-xyz', 'admin-123');
      });

      it('should handle UUID format userId', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.ADMIN })
          .mockResolvedValueOnce({
            id: uuid,
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockRestoreUser.mockResolvedValue({
          userId: uuid,
          restoredAt: new Date(),
          restoredBy: 'admin-123',
        });

        const request = createPostRequest(
          `http://localhost:3000/api/users/${uuid}/restore`,
          {}
        );

        await POST(request);

        expect(mockRestoreUser).toHaveBeenCalledWith(uuid, 'admin-123');
      });
    });

    describe('📊 Audit Trail', () => {
      it('should call restore service with correct restorer ID', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-999' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockRestoreUser.mockResolvedValue({
          userId: 'user-456',
          restoredAt: new Date(),
          restoredBy: 'admin-999',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        await POST(request);

        expect(mockRestoreUser).toHaveBeenCalledWith('user-456', 'admin-999');
      });

      it('should include previous deletion details in response context', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        const deletedAt = new Date('2024-01-15T10:00:00Z');
        const deletedBy = 'admin-555';
        const deletionReason = 'Policy violation';

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt,
            deletedBy,
            deletionReason,
          });

        mockRestoreUser.mockResolvedValue({
          userId: 'user-456',
          restoredAt: new Date(),
          restoredBy: 'admin-123',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users/user-456/restore',
          {}
        );

        await POST(request);

        // Verify we fetched user with deletion details
        expect(prisma.profile.findUnique).toHaveBeenCalledWith({
          where: { id: 'user-456' },
          select: {
            id: true,
            email: true,
            type: true,
            deletedAt: true,
            deletedBy: true,
            deletionReason: true,
          },
        });
      });
    });
  });
});
