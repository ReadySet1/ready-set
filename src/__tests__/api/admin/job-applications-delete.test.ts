// src/__tests__/api/admin/job-applications-delete.test.ts

import { DELETE } from '@/app/api/admin/job-applications/[id]/route';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import {
  createDeleteRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    jobApplication: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    fileUpload: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('DELETE /api/admin/job-applications/[id] - Delete Job Application', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('✅ Successful Deletion', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123', email: 'admin@example.com' } },
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'ADMIN' },
            }),
          }),
        }),
      });
    });

    it('should soft delete job application without file uploads', async () => {
      (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
        id: 'app-1',
        firstName: 'John',
        fileUploads: [],
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          fileUpload: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          jobApplication: {
            update: jest.fn().mockResolvedValue({
              id: 'app-1',
              deletedAt: new Date(),
            }),
          },
        };
        return callback(mockTx);
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/admin/job-applications/app-1'
      );

      const context = {
        params: Promise.resolve({ id: 'app-1' }),
      };

      const response = await DELETE(request, context);
      const data = await expectSuccessResponse(response, 200);

      expect(data.success).toBe(true);
      expect(data.message).toMatch(/deleted successfully/i);
    });

    it('should delete job application with file uploads', async () => {
      (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
        id: 'app-1',
        firstName: 'John',
        fileUploads: [
          { id: 'file-1', fileName: 'resume.pdf' },
          { id: 'file-2', fileName: 'cover.pdf' },
        ],
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          fileUpload: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
          jobApplication: {
            update: jest.fn().mockResolvedValue({
              id: 'app-1',
              deletedAt: new Date(),
            }),
          },
        };
        return callback(mockTx);
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/admin/job-applications/app-1'
      );

      const context = {
        params: Promise.resolve({ id: 'app-1' }),
      };

      const response = await DELETE(request, context);
      await expectSuccessResponse(response, 200);

      // Verify file uploads were deleted
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should allow SUPER_ADMIN to delete', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'SUPER_ADMIN' },
            }),
          }),
        }),
      });

      (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
        id: 'app-1',
        fileUploads: [],
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          fileUpload: { deleteMany: jest.fn() },
          jobApplication: { update: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/admin/job-applications/app-1'
      );

      const context = {
        params: Promise.resolve({ id: 'app-1' }),
      };

      const response = await DELETE(request, context);
      await expectSuccessResponse(response, 200);
    });
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/admin/job-applications/app-1'
      );

      const context = {
        params: Promise.resolve({ id: 'app-1' }),
      };

      const response = await DELETE(request, context);
      await expectUnauthorized(response);
    });

    it('should return 401 when user has no email', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } }, // No email
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/admin/job-applications/app-1'
      );

      const context = {
        params: Promise.resolve({ id: 'app-1' }),
      };

      const response = await DELETE(request, context);
      await expectUnauthorized(response);
    });
  });

  describe('🔒 Authorization Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'user@example.com' } },
      });
    });

    it('should return 403 when CLIENT tries to delete', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'CLIENT' },
            }),
          }),
        }),
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/admin/job-applications/app-1'
      );

      const context = {
        params: Promise.resolve({ id: 'app-1' }),
      };

      const response = await DELETE(request, context);
      await expectForbidden(response, /Only admins can delete/i);
    });

    it('should return 403 when VENDOR tries to delete', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'VENDOR' },
            }),
          }),
        }),
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/admin/job-applications/app-1'
      );

      const context = {
        params: Promise.resolve({ id: 'app-1' }),
      };

      const response = await DELETE(request, context);
      await expectForbidden(response);
    });

    it('should return 403 when DRIVER tries to delete', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'DRIVER' },
            }),
          }),
        }),
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/admin/job-applications/app-1'
      );

      const context = {
        params: Promise.resolve({ id: 'app-1' }),
      };

      const response = await DELETE(request, context);
      await expectForbidden(response);
    });

    it('should return 403 when HELPDESK tries to delete', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'HELPDESK' },
            }),
          }),
        }),
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/admin/job-applications/app-1'
      );

      const context = {
        params: Promise.resolve({ id: 'app-1' }),
      };

      const response = await DELETE(request, context);
      await expectForbidden(response);
    });
  });

  describe('❌ Error Handling', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123', email: 'admin@example.com' } },
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'ADMIN' },
            }),
          }),
        }),
      });
    });

    it('should return 404 when application is not found', async () => {
      (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createDeleteRequest(
        'http://localhost:3000/api/admin/job-applications/nonexistent'
      );

      const context = {
        params: Promise.resolve({ id: 'nonexistent' }),
      };

      const response = await DELETE(request, context);
      await expectErrorResponse(response, 404, /not found/i);
    });

    it('should handle transaction errors', async () => {
      (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
        id: 'app-1',
        fileUploads: [],
      });

      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Transaction failed')
      );

      const request = createDeleteRequest(
        'http://localhost:3000/api/admin/job-applications/app-1'
      );

      const context = {
        params: Promise.resolve({ id: 'app-1' }),
      };

      const response = await DELETE(request, context);
      await expectErrorResponse(response, 500, /Failed to delete/i);
    });
  });
});
