// src/__tests__/api/storage/storage-cleanup.test.ts

import { POST, GET } from '@/app/api/storage/cleanup/route';
import { createClient } from '@/utils/supabase/server';
import { cleanupOrphanedFiles } from '@/utils/file-service';
import {
  createGetRequest,
  createPostRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/file-service');

describe('/api/storage/cleanup API', () => {
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('POST /api/storage/cleanup - Cleanup Orphaned Files', () => {
    describe('✅ Successful Cleanup', () => {
      it('should cleanup orphaned files with default hours for ADMIN', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'admin-123', email: 'admin@example.com' },
            },
          },
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        (cleanupOrphanedFiles as jest.Mock).mockResolvedValue({
          deleted: 10,
          errors: 0,
          orphanedFiles: [],
        });

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          {}
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.message).toMatch(/Cleanup completed successfully/i);
        expect(data.deleted).toBe(10);
        expect(data.errors).toBe(0);
        expect(cleanupOrphanedFiles).toHaveBeenCalledWith(24);
      });

      it('should cleanup orphaned files with custom hours', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'admin-123' },
            },
          },
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        (cleanupOrphanedFiles as jest.Mock).mockResolvedValue({
          deleted: 5,
          errors: 0,
          orphanedFiles: [],
        });

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          { hours: 48 }
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(cleanupOrphanedFiles).toHaveBeenCalledWith(48);
        expect(data.deleted).toBe(5);
      });

      it('should allow SUPER_ADMIN to cleanup files', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'superadmin-123' },
            },
          },
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'SUPER_ADMIN' },
          error: null,
        });

        (cleanupOrphanedFiles as jest.Mock).mockResolvedValue({
          deleted: 15,
          errors: 0,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          {}
        );

        const response = await POST(request);
        expect(response.status).toBe(200);
      });

      it('should return cleanup results with errors', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'admin-123' },
            },
          },
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        (cleanupOrphanedFiles as jest.Mock).mockResolvedValue({
          deleted: 8,
          errors: 2,
          orphanedFiles: ['file1.pdf', 'file2.jpg'],
        });

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          { hours: 12 }
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.deleted).toBe(8);
        expect(data.errors).toBe(2);
        expect(data.orphanedFiles).toHaveLength(2);
      });

      it('should handle invalid hours parameter gracefully', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'admin-123' },
            },
          },
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        (cleanupOrphanedFiles as jest.Mock).mockResolvedValue({
          deleted: 5,
          errors: 0,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          { hours: 'invalid' }
        );

        const response = await POST(request);
        expect(response.status).toBe(200);

        // Should default to 24 hours when invalid
        expect(cleanupOrphanedFiles).toHaveBeenCalledWith(24);
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: null },
        });

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          {}
        );

        const response = await POST(request);
        await expectUnauthorized(response, /Authentication required/i);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 for CLIENT users', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'client-123' },
            },
          },
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'CLIENT' },
          error: null,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          {}
        );

        const response = await POST(request);
        await expectForbidden(response, /Admin privileges required/i);
      });

      it('should return 403 for VENDOR users', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'vendor-123' },
            },
          },
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'VENDOR' },
          error: null,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          {}
        );

        const response = await POST(request);
        await expectForbidden(response);
      });

      it('should return 403 for DRIVER users', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'driver-123' },
            },
          },
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'DRIVER' },
          error: null,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          {}
        );

        const response = await POST(request);
        await expectForbidden(response);
      });

      it('should return 403 for HELPDESK users', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'helpdesk-123' },
            },
          },
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'HELPDESK' },
          error: null,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          {}
        );

        const response = await POST(request);
        await expectForbidden(response);
      });

      it('should return 403 when user profile not found', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'unknown-123' },
            },
          },
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: null,
          error: { message: 'Profile not found' },
        });

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          {}
        );

        const response = await POST(request);
        await expectForbidden(response);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle cleanup service errors', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'admin-123' },
            },
          },
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        (cleanupOrphanedFiles as jest.Mock).mockRejectedValue(
          new Error('Storage service unavailable')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          {}
        );

        const response = await POST(request);
        await expectErrorResponse(
          response,
          500,
          /Storage service unavailable/i
        );
      });

      it('should handle database query errors', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'admin-123' },
            },
          },
        });

        mockSupabaseClient.from().single.mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          {}
        );

        const response = await POST(request);
        await expectErrorResponse(
          response,
          500,
          /Database connection failed/i
        );
      });

      it('should handle authentication service errors', async () => {
        mockSupabaseClient.auth.getSession.mockRejectedValue(
          new Error('Auth service error')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          {}
        );

        const response = await POST(request);
        await expectErrorResponse(response, 500);
      });
    });

    describe('📊 Cleanup Results', () => {
      it('should return detailed cleanup statistics', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'admin-123' },
            },
          },
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        (cleanupOrphanedFiles as jest.Mock).mockResolvedValue({
          deleted: 25,
          errors: 3,
          orphanedFiles: ['old-file-1.pdf', 'old-file-2.jpg', 'old-file-3.png'],
          totalScanned: 100,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/storage/cleanup',
          { hours: 72 }
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveProperty('deleted');
        expect(data).toHaveProperty('errors');
        expect(data).toHaveProperty('orphanedFiles');
        expect(data.deleted).toBe(25);
        expect(data.errors).toBe(3);
      });
    });
  });

  describe('GET /api/storage/cleanup - Cleanup via GET', () => {
    it('should support GET requests for cleanup', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'admin-123' },
          },
        },
      });

      mockSupabaseClient.from().single.mockResolvedValue({
        data: { type: 'ADMIN' },
        error: null,
      });

      (cleanupOrphanedFiles as jest.Mock).mockResolvedValue({
        deleted: 5,
        errors: 0,
      });

      const request = createGetRequest(
        'http://localhost:3000/api/storage/cleanup'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it('should reject GET requests from non-admin users', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'client-123' },
          },
        },
      });

      mockSupabaseClient.from().single.mockResolvedValue({
        data: { type: 'CLIENT' },
        error: null,
      });

      const request = createGetRequest(
        'http://localhost:3000/api/storage/cleanup'
      );

      const response = await GET(request);
      await expectForbidden(response);
    });
  });
});
