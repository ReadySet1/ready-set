// src/__tests__/api/users/deleted.test.ts

import { GET } from '@/app/api/users/deleted/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import {
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';
import { UserType } from '@/types/prisma';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock the soft delete service
jest.mock('@/services/userSoftDeleteService', () => ({
  userSoftDeleteService: {
    getDeletedUsers: jest.fn(),
  },
}));

import { userSoftDeleteService } from '@/services/userSoftDeleteService';

describe('/api/users/deleted API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('GET /api/users/deleted - List Deleted Users', () => {
    describe('✅ Successful Retrieval', () => {
      it('should return deleted users for admin', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123', email: 'admin@example.com' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });

        const mockDeletedUsers = [
          {
            id: 'user-1',
            email: 'deleted1@example.com',
            name: 'Deleted User 1',
            type: UserType.CLIENT,
            status: 'DELETED',
            deletedAt: new Date('2024-01-15'),
            deletedBy: 'admin-123',
          },
          {
            id: 'user-2',
            email: 'deleted2@example.com',
            name: 'Deleted User 2',
            type: UserType.VENDOR,
            status: 'DELETED',
            deletedAt: new Date('2024-01-20'),
            deletedBy: 'superadmin-456',
          },
        ];

        (userSoftDeleteService.getDeletedUsers as jest.Mock).mockResolvedValue({
          users: mockDeletedUsers,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 2,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.message).toBe('Deleted users retrieved successfully');
        expect(data.data).toHaveLength(2);
        expect(data.pagination.totalCount).toBe(2);
        expect(data.data[0]).toMatchObject({
          id: 'user-1',
          email: 'deleted1@example.com',
          status: 'DELETED',
        });
      });

      it('should support pagination', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
        });

        (userSoftDeleteService.getDeletedUsers as jest.Mock).mockResolvedValue({
          users: [],
          pagination: {
            currentPage: 2,
            totalPages: 5,
            totalCount: 50,
            hasNextPage: true,
            hasPrevPage: true,
          },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted?page=2&limit=10'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.pagination.currentPage).toBe(2);
        expect(data.pagination.totalPages).toBe(5);
        expect(data.pagination.hasNextPage).toBe(true);
        expect(data.pagination.hasPrevPage).toBe(true);

        // Verify service was called with correct filters
        expect(userSoftDeleteService.getDeletedUsers).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
            limit: 10,
          })
        );
      });

      it('should support filtering by user type', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });

        (userSoftDeleteService.getDeletedUsers as jest.Mock).mockResolvedValue({
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted?type=VENDOR'
        );

        await GET(request);

        expect(userSoftDeleteService.getDeletedUsers).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'VENDOR',
          })
        );
      });

      it('should support filtering by status', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.HELPDESK,
        });

        (userSoftDeleteService.getDeletedUsers as jest.Mock).mockResolvedValue({
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted?status=DELETED'
        );

        await GET(request);

        expect(userSoftDeleteService.getDeletedUsers).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'DELETED',
          })
        );
      });

      it('should support search filtering', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });

        (userSoftDeleteService.getDeletedUsers as jest.Mock).mockResolvedValue({
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted?search=john'
        );

        await GET(request);

        expect(userSoftDeleteService.getDeletedUsers).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'john',
          })
        );
      });

      it('should support filtering by deletedBy', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
        });

        (userSoftDeleteService.getDeletedUsers as jest.Mock).mockResolvedValue({
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted?deletedBy=admin-456'
        );

        await GET(request);

        expect(userSoftDeleteService.getDeletedUsers).toHaveBeenCalledWith(
          expect.objectContaining({
            deletedBy: 'admin-456',
          })
        );
      });

      it('should support date range filtering', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });

        (userSoftDeleteService.getDeletedUsers as jest.Mock).mockResolvedValue({
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted?deletedAfter=2024-01-01&deletedBefore=2024-12-31'
        );

        await GET(request);

        expect(userSoftDeleteService.getDeletedUsers).toHaveBeenCalledWith(
          expect.objectContaining({
            deletedAfter: expect.any(Date),
            deletedBefore: expect.any(Date),
          })
        );
      });

      it('should include available filter options in response', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });

        (userSoftDeleteService.getDeletedUsers as jest.Mock).mockResolvedValue({
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.filters).toBeDefined();
        expect(data.filters.available).toBeDefined();
        expect(data.filters.available.types).toContain('ADMIN');
        expect(data.filters.available.types).toContain('CLIENT');
        expect(data.filters.available.types).toContain('VENDOR');
        expect(data.filters.available.statuses).toContain('DELETED');
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 for unauthenticated requests', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted'
        );

        const response = await GET(request);
        await expectUnauthorized(response, /Authentication required/i);
      });

      it('should return 401 for invalid token', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid JWT' },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted'
        );

        const response = await GET(request);
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

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted'
        );

        const response = await GET(request);
        await expectForbidden(
          response,
          /Only Admin, Super Admin, or Helpdesk can view deleted users/i
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

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted'
        );

        const response = await GET(request);
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

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted'
        );

        const response = await GET(request);
        await expectForbidden(response);
      });

      it('should allow ADMIN users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });

        (userSoftDeleteService.getDeletedUsers as jest.Mock).mockResolvedValue({
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);
      });

      it('should allow SUPER_ADMIN users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
        });

        (userSoftDeleteService.getDeletedUsers as jest.Mock).mockResolvedValue({
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);
      });

      it('should allow HELPDESK users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'helpdesk-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.HELPDESK,
        });

        (userSoftDeleteService.getDeletedUsers as jest.Mock).mockResolvedValue({
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle errors when fetching requester profile', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted'
        );

        const response = await GET(request);
        await expectErrorResponse(
          response,
          500,
          /Failed to fetch requester profile/i
        );
      });

      it('should handle errors from soft delete service', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });

        (userSoftDeleteService.getDeletedUsers as jest.Mock).mockRejectedValue(
          new Error('Service error')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted'
        );

        const response = await GET(request);
        await expectErrorResponse(
          response,
          500,
          /Failed to retrieve deleted users/i
        );
      });

      it('should include error code in response', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });

        (userSoftDeleteService.getDeletedUsers as jest.Mock).mockRejectedValue(
          new Error('Something went wrong')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/users/deleted'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(data.code).toBe('FETCH_DELETED_USERS_FAILED');
        expect(data.details).toBe('Something went wrong');
      });
    });
  });
});
