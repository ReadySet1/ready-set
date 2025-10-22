// src/__tests__/api/storage/storage-delete.test.ts

import { DELETE } from '@/app/api/storage/delete/route';
import { deleteFile } from '@/utils/file-service';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import {
  createDeleteRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/auth-middleware');
jest.mock('@/utils/file-service');
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

describe('/api/storage/delete API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DELETE /api/storage/delete - File Deletion', () => {
    describe('✅ Successful Deletion', () => {
      it('should delete file for admin users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
            isAdmin: true,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=user-123/file.pdf&bucket=user-files'
        );

        const response = await DELETE(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.message).toMatch(/deleted successfully/i);
        expect(deleteFile).toHaveBeenCalledWith('user-123/file.pdf', 'user-files');
      });

      it('should delete file for SUPER_ADMIN users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'superadmin-123', type: 'SUPER_ADMIN' },
            isAdmin: false,
            isSuperAdmin: true,
            isHelpdesk: false,
          },
        });

        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=file.pdf&bucket=default'
        );

        const response = await DELETE(request);
        expect(response.status).toBe(200);
      });

      it('should delete file for HELPDESK users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'helpdesk-123', type: 'HELPDESK' },
            isAdmin: false,
            isSuperAdmin: false,
            isHelpdesk: true,
          },
        });

        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=file.pdf&bucket=default'
        );

        const response = await DELETE(request);
        expect(response.status).toBe(200);
      });

      it('should delete file when user owns it (catering order)', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'user-123', type: 'CLIENT' },
            isAdmin: false,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ exists: 1 }]);
        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=user-123/file.pdf&bucket=user-files'
        );

        const response = await DELETE(request);
        expect(response.status).toBe(200);
      });

      it('should delete file when user owns it (job application)', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'user-123', type: 'CLIENT' },
            isAdmin: false,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ exists: 1 }]);
        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=resume.pdf&bucket=documents'
        );

        const response = await DELETE(request);
        expect(response.status).toBe(200);
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 for unauthenticated requests', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: false,
          response: new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401 }
          ),
        });

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=file.pdf&bucket=default'
        );

        const response = await DELETE(request);
        expect(response.status).toBe(401);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 when non-admin user tries to delete file they do not own', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'user-123', type: 'CLIENT' },
            isAdmin: false,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=other-user/file.pdf&bucket=user-files'
        );

        const response = await DELETE(request);
        await expectForbidden(
          response,
          /do not have permission to delete this file/i
        );
      });

      it('should return 403 when user does not have access to file entity', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'user-123', type: 'VENDOR' },
            isAdmin: false,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        (prisma.$queryRaw as jest.Mock).mockResolvedValue(null);

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=file.pdf&bucket=default'
        );

        const response = await DELETE(request);
        await expectForbidden(response);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 when file key is missing', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
            isAdmin: true,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?bucket=default'
        );

        const response = await DELETE(request);
        await expectErrorResponse(
          response,
          400,
          /File key and bucket name are required/i
        );
      });

      it('should return 400 when bucket name is missing', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
            isAdmin: true,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=file.pdf'
        );

        const response = await DELETE(request);
        await expectErrorResponse(response, 400, /required/i);
      });

      it('should return 400 when both parameters are missing', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
            isAdmin: true,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete'
        );

        const response = await DELETE(request);
        await expectErrorResponse(response, 400);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle file deletion errors', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
            isAdmin: true,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        (deleteFile as jest.Mock).mockRejectedValue(
          new Error('Storage service unavailable')
        );

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=file.pdf&bucket=default'
        );

        const response = await DELETE(request);
        await expectErrorResponse(
          response,
          500,
          /Storage service unavailable/i
        );
      });

      it('should handle database query errors', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'user-123', type: 'CLIENT' },
            isAdmin: false,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        (prisma.$queryRaw as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=file.pdf&bucket=default'
        );

        const response = await DELETE(request);
        await expectErrorResponse(
          response,
          500,
          /Database connection failed/i
        );
      });

      it('should handle authentication service errors', async () => {
        (withAuth as jest.Mock).mockRejectedValue(
          new Error('Auth service error')
        );

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=file.pdf&bucket=default'
        );

        const response = await DELETE(request);
        await expectErrorResponse(response, 500);
      });
    });

    describe('🔍 Security Tests', () => {
      it('should verify file ownership through catering orders', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'user-123', type: 'CLIENT' },
            isAdmin: false,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ exists: 1 }]);
        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=catering-file.pdf&bucket=orders'
        );

        await DELETE(request);

        // Verify ownership query was executed
        expect(prisma.$queryRaw).toHaveBeenCalled();
      });

      it('should verify file ownership through on-demand orders', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'user-123', type: 'CLIENT' },
            isAdmin: false,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ exists: 1 }]);
        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=ondemand-file.pdf&bucket=orders'
        );

        await DELETE(request);

        expect(prisma.$queryRaw).toHaveBeenCalled();
      });

      it('should verify file ownership through job applications', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'user-123', type: 'CLIENT' },
            isAdmin: false,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ exists: 1 }]);
        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=resume.pdf&bucket=applications'
        );

        await DELETE(request);

        expect(prisma.$queryRaw).toHaveBeenCalled();
      });

      it('should skip ownership check for admin users', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'admin-123', type: 'ADMIN' },
            isAdmin: true,
            isSuperAdmin: false,
            isHelpdesk: false,
          },
        });

        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        const request = createDeleteRequest(
          'http://localhost:3000/api/storage/delete?key=any-file.pdf&bucket=any-bucket'
        );

        await DELETE(request);

        // Admin should not trigger ownership check
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
      });
    });
  });
});
