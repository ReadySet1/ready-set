import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/users/[userId]/route';
import { UserType } from '@/types/prisma';

// Valid UUID constants for testing (required by route's UUID validation)
const ADMIN_USER_ID = '11111111-1111-1111-1111-111111111111';
const SUPER_ADMIN_USER_ID = '22222222-2222-2222-2222-222222222222';
const TARGET_USER_ID = '33333333-3333-3333-3333-333333333333';
const HELPDESK_USER_ID = '44444444-4444-4444-4444-444444444444';
const SELF_USER_ID = '55555555-5555-5555-5555-555555555555';
const NONEXISTENT_USER_ID = '99999999-9999-9999-9999-999999999999';

// Mock the soft delete service - define mock inside jest.mock to handle hoisting
const mockSoftDeleteUser = jest.fn();

jest.mock('@/services/userSoftDeleteService', () => ({
  userSoftDeleteService: {
    softDeleteUser: mockSoftDeleteUser,
  },
}));

// Import the actual PrismaClientKnownRequestError from @/types/prisma
// (used by the route for instanceof checks)
import { PrismaClientKnownRequestError } from '@/types/prisma';

// Mocks
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
};

jest.mock('@/utils/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}));

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '@/utils/prismaDB';

// Test helpers
const createRequest = (userId: string): NextRequest => {
  return new Request(`http://localhost:3000/api/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'x-forwarded-for': '127.0.0.1',
      'user-agent': 'test-agent'
    }
  }) as NextRequest;
};

const mockAuthenticatedUser = (userId: string, userType: UserType = UserType.ADMIN) => {
  (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
  
  (prisma.profile.findUnique as jest.Mock).mockResolvedValueOnce({
    type: userType,
  });
};

const mockTargetUser = (
  userId: string,
  userType: UserType = UserType.VENDOR,
  email: string = 'target@example.com'
) => {
  (prisma.profile.findUnique as jest.Mock).mockResolvedValueOnce({
    type: userType,
    email: email,
  });
};

describe('/api/users/[userId] DELETE API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset soft delete service mock
    mockSoftDeleteUser.mockReset();
  });

  describe('🔐 Authorization Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = createRequest(TARGET_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized: Authentication required');
    });

    it('should allow ADMIN to delete users', async () => {
      mockAuthenticatedUser(ADMIN_USER_ID, UserType.ADMIN);
      mockTargetUser(TARGET_USER_ID, UserType.VENDOR);

      // Mock successful soft delete
      mockSoftDeleteUser.mockResolvedValue({
        userId: TARGET_USER_ID,
        deletedAt: new Date(),
        deletedBy: ADMIN_USER_ID,
        deletionReason: undefined,
      });

      const req = createRequest(TARGET_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('User soft deleted successfully');
    });

    it('should allow SUPER_ADMIN to delete users', async () => {
      mockAuthenticatedUser(SUPER_ADMIN_USER_ID, UserType.SUPER_ADMIN);
      mockTargetUser(TARGET_USER_ID, UserType.VENDOR);

      mockSoftDeleteUser.mockResolvedValue({
        userId: TARGET_USER_ID,
        deletedAt: new Date(),
        deletedBy: SUPER_ADMIN_USER_ID,
        deletionReason: undefined,
      });

      const req = createRequest(TARGET_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(200);
    });

    it('should deny HELPDESK from deleting users', async () => {
      mockAuthenticatedUser(HELPDESK_USER_ID, UserType.HELPDESK);

      const req = createRequest(TARGET_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden: Only Admin or Super Admin can delete users');
    });

    it('should deny VENDOR from deleting users', async () => {
      mockAuthenticatedUser(TARGET_USER_ID, UserType.VENDOR);

      const req = createRequest(NONEXISTENT_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden: Only Admin or Super Admin can delete users');
    });

    it('should prevent deletion of SUPER_ADMIN users', async () => {
      mockAuthenticatedUser(ADMIN_USER_ID, UserType.ADMIN);
      mockTargetUser(SUPER_ADMIN_USER_ID, UserType.SUPER_ADMIN);

      const req = createRequest(SUPER_ADMIN_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden: Super Admin users cannot be deleted');
    });

    it('should prevent self-deletion', async () => {
      mockAuthenticatedUser(SELF_USER_ID, UserType.ADMIN);
      mockTargetUser(SELF_USER_ID, UserType.ADMIN);

      const req = createRequest(SELF_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden: Cannot delete your own account');
    });
  });

  describe('🗄️ Service Integration Tests', () => {
    beforeEach(() => {
      mockAuthenticatedUser(ADMIN_USER_ID, UserType.ADMIN);
      mockTargetUser(TARGET_USER_ID, UserType.VENDOR);
    });

    it('should call soft delete service with correct parameters', async () => {
      mockSoftDeleteUser.mockResolvedValue({
        userId: TARGET_USER_ID,
        deletedAt: new Date(),
        deletedBy: ADMIN_USER_ID,
        deletionReason: undefined,
      });

      const req = createRequest(TARGET_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      expect(mockSoftDeleteUser).toHaveBeenCalledWith(
        TARGET_USER_ID,
        ADMIN_USER_ID,
        undefined
      );
    });

    it('should pass deletion reason to soft delete service', async () => {
      mockSoftDeleteUser.mockResolvedValue({
        userId: TARGET_USER_ID,
        deletedAt: new Date(),
        deletedBy: ADMIN_USER_ID,
        deletionReason: 'User requested account deletion',
      });

      const req = new Request(
        `http://localhost:3000/api/users/${TARGET_USER_ID}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'User requested account deletion' }),
        }
      ) as NextRequest;

      const res = await DELETE(req);

      expect(res.status).toBe(200);
      expect(mockSoftDeleteUser).toHaveBeenCalledWith(
        TARGET_USER_ID,
        ADMIN_USER_ID,
        'User requested account deletion'
      );
    });

    it('should return summary with soft delete result', async () => {
      const deletedAt = new Date('2024-01-15T10:30:00Z');
      mockSoftDeleteUser.mockResolvedValue({
        userId: TARGET_USER_ID,
        deletedAt,
        deletedBy: ADMIN_USER_ID,
        deletionReason: 'Test deletion',
      });

      const req = createRequest(TARGET_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.summary).toMatchObject({
        deletedUser: {
          id: TARGET_USER_ID,
          type: UserType.VENDOR,
        },
        deletedBy: ADMIN_USER_ID,
        deletionReason: 'Test deletion',
      });
    });

    it('should handle service errors gracefully', async () => {
      mockSoftDeleteUser.mockRejectedValue(
        new Error('Service unavailable')
      );

      const req = createRequest(TARGET_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Failed to soft delete user');
    });
  });

  describe('🚫 Edge Case Testing', () => {
    beforeEach(() => {
      mockAuthenticatedUser(ADMIN_USER_ID, UserType.ADMIN);
    });

    it('should return 400 when userId is missing', async () => {
      const req = new Request('http://localhost:3000/api/users/', {
        method: 'DELETE',
      }) as NextRequest;

      const res = await DELETE(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('User ID is required');
    });

    it('should return 400 for invalid UUID format', async () => {
      const req = createRequest('invalid-uuid-format');
      const res = await DELETE(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid user ID format');
    });

    it('should return 404 when target user does not exist', async () => {
      // Reset and re-setup all mocks for this specific test case
      (prisma.profile.findUnique as jest.Mock).mockReset();

      // Setup profile queries in sequence:
      // 1. Requester profile check (returns admin)
      // 2. Target user check (returns null - user doesn't exist)
      (prisma.profile.findUnique as jest.Mock)
        .mockResolvedValueOnce({ type: UserType.ADMIN }) // requester profile
        .mockResolvedValueOnce(null); // target user doesn't exist

      const req = createRequest(NONEXISTENT_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('User not found');
    });

    it('should handle Prisma P2025 error (record not found)', async () => {
      // Note: beforeEach already calls mockAuthenticatedUser
      // Just add the target user mock
      mockTargetUser(TARGET_USER_ID, UserType.VENDOR);

      const prismaError = new PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        meta: { cause: 'Record to delete does not exist.' },
      });

      mockSoftDeleteUser.mockRejectedValue(prismaError);

      const req = createRequest(TARGET_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.code).toBe('USER_NOT_FOUND');
      expect(data.error).toBe('User not found');
    });

    it('should handle Prisma P2003 error (foreign key constraint)', async () => {
      // Note: beforeEach already calls mockAuthenticatedUser
      // Just add the target user mock
      mockTargetUser(TARGET_USER_ID, UserType.VENDOR);

      const prismaError = new PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          meta: { field_name: 'user_id' },
        }
      );

      mockSoftDeleteUser.mockRejectedValue(prismaError);

      const req = createRequest(TARGET_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe('FOREIGN_KEY_VIOLATION');
      expect(data.error).toBe('Cannot delete user: referenced by other records');
    });

    it('should handle unexpected errors gracefully', async () => {
      // Note: beforeEach already calls mockAuthenticatedUser
      // Just add the target user mock
      mockTargetUser(TARGET_USER_ID, UserType.VENDOR);

      const unexpectedError = new Error('Unexpected database error');
      mockSoftDeleteUser.mockRejectedValue(unexpectedError);

      const req = createRequest(TARGET_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Failed to soft delete user');
    });
  });

  describe('📊 Response Structure Testing', () => {
    beforeEach(() => {
      mockAuthenticatedUser(ADMIN_USER_ID, UserType.ADMIN);
      mockTargetUser(TARGET_USER_ID, UserType.VENDOR, 'target@example.com');
    });

    it('should include all expected fields in success response', async () => {
      const deletedAt = new Date('2024-01-15T10:30:00Z');
      mockSoftDeleteUser.mockResolvedValue({
        userId: TARGET_USER_ID,
        deletedAt,
        deletedBy: ADMIN_USER_ID,
        deletionReason: 'Inactive account',
      });

      const req = createRequest(TARGET_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data).toHaveProperty('message', 'User soft deleted successfully');
      expect(data).toHaveProperty('summary');
      expect(data.summary).toHaveProperty('deletedUser');
      expect(data.summary).toHaveProperty('deletedAt');
      expect(data.summary).toHaveProperty('deletedBy');
      expect(data.summary).toHaveProperty('deletionReason');
      expect(data.summary).toHaveProperty('duration');
      expect(data.summary).toHaveProperty('timestamp');
    });

    it('should include user details in deleted user summary', async () => {
      mockSoftDeleteUser.mockResolvedValue({
        userId: TARGET_USER_ID,
        deletedAt: new Date(),
        deletedBy: ADMIN_USER_ID,
        deletionReason: undefined,
      });

      const req = createRequest(TARGET_USER_ID);
      const res = await DELETE(req);

      const data = await res.json();

      expect(data.summary.deletedUser).toEqual({
        id: TARGET_USER_ID,
        email: 'target@example.com',
        type: UserType.VENDOR,
      });
    });
  });

  describe('⚡ Error Logging', () => {
    beforeEach(() => {
      mockAuthenticatedUser(ADMIN_USER_ID, UserType.ADMIN);
      mockTargetUser(TARGET_USER_ID, UserType.VENDOR);
    });

    it('should log error when soft delete fails', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();

      const error = new Error('Service unavailable');
      mockSoftDeleteUser.mockRejectedValue(error);

      const req = createRequest(TARGET_USER_ID);
      await DELETE(req);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[DELETE\] Soft delete failed after \d+ms:/),
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle already deleted user error', async () => {
      // Note: beforeEach sets up auth but NOT target user - we override it here
      // Need to clear and re-setup the profile mock
      (prisma.profile.findUnique as jest.Mock).mockReset();
      (prisma.profile.findUnique as jest.Mock)
        .mockResolvedValueOnce({ type: UserType.ADMIN }) // requester profile
        .mockResolvedValueOnce({
          type: UserType.VENDOR,
          email: 'target@example.com',
          deletedAt: new Date(), // Already deleted
        });

      const req = createRequest(TARGET_USER_ID);
      const res = await DELETE(req);

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe('User is already soft deleted');
    });
  });
});
