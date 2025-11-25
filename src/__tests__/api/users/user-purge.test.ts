// src/__tests__/api/users/user-purge.test.ts

import { DELETE } from '@/app/api/users/[userId]/purge/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { UserType } from '@/types/prisma';
import {
  createDeleteRequest,
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
const mockPermanentlyDeleteUser = jest.fn();
jest.mock('@/services/userSoftDeleteService', () => ({
  userSoftDeleteService: {
    permanentlyDeleteUser: mockPermanentlyDeleteUser,
  },
}));

describe('/api/users/[userId]/purge API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('DELETE /api/users/[userId]/purge - Permanently Delete User', () => {
    describe('✅ Successful Deletion', () => {
      it('should permanently delete soft-deleted user by SUPER_ADMIN', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123', email: 'superadmin@example.com' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({
            // Requester profile
            type: UserType.SUPER_ADMIN,
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

        mockPermanentlyDeleteUser.mockResolvedValue({
          userId: 'user-456',
          deletedAt: new Date('2024-01-20T10:00:00Z'),
          deletedBy: 'superadmin-123',
          affectedRecords: 15,
        });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'GDPR right to be forgotten request from user',
            }),
          }
        );

        const response = await DELETE(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.message).toMatch(/permanently deleted successfully/i);
        expect(data.summary.deletedUser.id).toBe('user-456');
        expect(data.summary.deletedUser.email).toBe('deleted@example.com');
        expect(data.summary.affectedRecords).toBe(15);
        expect(data.summary.reason).toBe('GDPR right to be forgotten request from user');
        expect(data.warning).toMatch(/irreversible/i);
        expect(mockPermanentlyDeleteUser).toHaveBeenCalledWith('user-456');
      });

      it('should return deletion summary with affected records', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.VENDOR,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockPermanentlyDeleteUser.mockResolvedValue({
          userId: 'user-456',
          deletedAt: new Date('2024-01-20T10:00:00Z'),
          deletedBy: 'superadmin-123',
          affectedRecords: 42,
        });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Data retention policy expired',
            }),
          }
        );

        const response = await DELETE(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.summary).toHaveProperty('deletedUser');
        expect(data.summary).toHaveProperty('deletedAt');
        expect(data.summary).toHaveProperty('deletedBy');
        expect(data.summary).toHaveProperty('reason');
        expect(data.summary).toHaveProperty('affectedRecords');
        expect(data.summary).toHaveProperty('timestamp');
        expect(data.summary.affectedRecords).toBe(42);
      });

      it('should include irreversibility warning in response', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockPermanentlyDeleteUser.mockResolvedValue({
          userId: 'user-456',
          deletedAt: new Date(),
          deletedBy: 'superadmin-123',
          affectedRecords: 5,
        });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Legal requirement',
            }),
          }
        );

        const response = await DELETE(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveProperty('warning');
        expect(data.warning).toContain('irreversible');
        expect(data.warning).toContain('permanently removed');
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: new Error('Unauthorized'),
        });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason for deletion',
            }),
          }
        );

        const response = await DELETE(request);
        await expectUnauthorized(response, /Unauthorized.*Authentication required/i);
      });

      it('should return 401 when auth token is invalid', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: new Error('Invalid token'),
        });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason for deletion',
            }),
          }
        );

        const response = await DELETE(request);
        await expectUnauthorized(response);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 for ADMIN users (SUPER_ADMIN only)', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason for deletion',
            }),
          }
        );

        const response = await DELETE(request);
        await expectForbidden(
          response,
          /Forbidden.*Only Super Admin can permanently delete users/i
        );
      });

      it('should return 403 for CLIENT users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'client-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.CLIENT,
        });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason for deletion',
            }),
          }
        );

        const response = await DELETE(request);
        await expectForbidden(response);
      });

      it('should return 403 for VENDOR users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'vendor-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.VENDOR,
        });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason for deletion',
            }),
          }
        );

        const response = await DELETE(request);
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

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason for deletion',
            }),
          }
        );

        const response = await DELETE(request);
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

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason for deletion',
            }),
          }
        );

        const response = await DELETE(request);
        await expectForbidden(response);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 when userId is missing from path', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        const request = new Request(
          'http://localhost:3000/api/users//purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason for deletion',
            }),
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(response, 400, /User ID is required/i);
      });

      it('should return 400 when request body is missing', async () => {
        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(
          response,
          400,
          /Confirmation required.*confirmed.*true/i
        );
      });

      it('should return 400 when request body is malformed JSON', async () => {
        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: 'invalid json{',
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(response, 400, /confirmation is required/i);
      });

      it('should return 400 when confirmed flag is false', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: false,
              reason: 'Test reason for deletion',
            }),
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(
          response,
          400,
          /Confirmation required.*"confirmed": true/i
        );
      });

      it('should return 400 when confirmed flag is missing', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason: 'Test reason for deletion',
            }),
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(response, 400, /Confirmation required/i);
      });

      it('should return 400 when reason is missing', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
            }),
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(
          response,
          400,
          /Detailed reason.*is required.*minimum 10 characters/i
        );
      });

      it('should return 400 when reason is too short (< 10 characters)', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Short',
            }),
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(response, 400, /minimum 10 characters/i);
      });

      it('should return 400 when reason is only whitespace', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: '          ',
            }),
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(response, 400, /minimum 10 characters/i);
      });

      it('should return 404 when target user does not exist', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce(null); // Target user not found

        const request = new Request(
          'http://localhost:3000/api/users/nonexistent-123/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason for deletion',
            }),
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(response, 404, /User not found/i);
      });

      it('should return 409 when user is not soft deleted', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'active@example.com',
            type: UserType.CLIENT,
            deletedAt: null, // Not soft deleted
          });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason for deletion',
            }),
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(
          response,
          409,
          /must be soft deleted before permanent deletion/i
        );
      });
    });

    describe('🔍 Protection Tests', () => {
      it('should return 403 when attempting to delete SUPER_ADMIN user', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'superadmin-target',
            email: 'other-superadmin@example.com',
            type: UserType.SUPER_ADMIN, // Target is also SUPER_ADMIN
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        const request = new Request(
          'http://localhost:3000/api/users/superadmin-target/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Attempting to delete super admin',
            }),
          }
        );

        const response = await DELETE(request);
        await expectForbidden(
          response,
          /Super Admin users cannot be permanently deleted/i
        );
      });

      it('should prevent self-deletion of SUPER_ADMIN', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'superadmin-123', // Same as requester
            email: 'superadmin@example.com',
            type: UserType.SUPER_ADMIN,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        const request = new Request(
          'http://localhost:3000/api/users/superadmin-123/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Attempting self-deletion',
            }),
          }
        );

        const response = await DELETE(request);
        await expectForbidden(response);
      });

      it('should allow deletion of ADMIN user by SUPER_ADMIN', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'admin-456',
            email: 'admin@example.com',
            type: UserType.ADMIN, // ADMIN can be deleted
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockPermanentlyDeleteUser.mockResolvedValue({
          userId: 'admin-456',
          deletedAt: new Date(),
          deletedBy: 'superadmin-123',
          affectedRecords: 10,
        });

        const request = new Request(
          'http://localhost:3000/api/users/admin-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Removing former admin from system',
            }),
          }
        );

        const response = await DELETE(request);
        expect(response.status).toBe(200);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle requester profile fetch errors', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockRejectedValueOnce(
          new Error('Database connection failed')
        );

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason that is long enough',
            }),
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(
          response,
          500,
          /Failed to fetch requester profile/i
        );
      });

      it('should handle target user fetch errors', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockRejectedValueOnce(new Error('Database timeout'));

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason that is long enough',
            }),
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(response, 500, /Failed to fetch target user/i);
      });

      it('should handle deletion service errors', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockPermanentlyDeleteUser.mockRejectedValue(
          new Error('Deletion failed')
        );

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason that is long enough',
            }),
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(
          response,
          500,
          /Failed to permanently delete user/i
        );
      });

      it('should return error code in response', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockPermanentlyDeleteUser.mockRejectedValue(
          new Error('Database error')
        );

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason that is long enough',
            }),
          }
        );

        const response = await DELETE(request);
        const data = await response.json();

        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('code');
        expect(data).toHaveProperty('details');
        expect(data.code).toBe('PERMANENT_DELETE_FAILED');
      });

      it('should handle "User not found" error from service', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockPermanentlyDeleteUser.mockRejectedValue(
          new Error('User not found in service')
        );

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'Test reason that is long enough',
            }),
          }
        );

        const response = await DELETE(request);
        await expectErrorResponse(response, 404, /User not found/i);
      });
    });

    describe('📊 GDPR Compliance', () => {
      it('should accept GDPR right to be forgotten as reason', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockPermanentlyDeleteUser.mockResolvedValue({
          userId: 'user-456',
          deletedAt: new Date(),
          deletedBy: 'superadmin-123',
          affectedRecords: 20,
        });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: 'GDPR Article 17 - Right to erasure (right to be forgotten)',
            }),
          }
        );

        const response = await DELETE(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.summary.reason).toContain('GDPR');
        expect(data.summary.reason).toContain('right to be forgotten');
      });

      it('should track reason in deletion summary', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock)
          .mockResolvedValueOnce({ type: UserType.SUPER_ADMIN })
          .mockResolvedValueOnce({
            id: 'user-456',
            email: 'user@example.com',
            type: UserType.CLIENT,
            deletedAt: new Date('2024-01-15T10:00:00Z'),
          });

        mockPermanentlyDeleteUser.mockResolvedValue({
          userId: 'user-456',
          deletedAt: new Date(),
          deletedBy: 'superadmin-123',
          affectedRecords: 10,
        });

        const deletionReason = 'Data retention period expired per company policy';

        const request = new Request(
          'http://localhost:3000/api/users/user-456/purge',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmed: true,
              reason: deletionReason,
            }),
          }
        );

        const response = await DELETE(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.summary.reason).toBe(deletionReason);
      });
    });
  });
});
