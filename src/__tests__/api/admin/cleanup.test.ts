// src/__tests__/api/admin/cleanup.test.ts

import { GET, POST } from '@/app/api/admin/cleanup/route';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { UserType } from '@/types/prisma';
import {
  createGetRequest,
  createPostRequest,
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
    },
    userAudit: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

// Mock cleanup service
const mockGenerateCleanupReportFn = jest.fn();

jest.mock('@/jobs/cleanupSoftDeleted');

import {
  getSoftDeleteMetrics,
  runSoftDeleteCleanup,
  SoftDeleteCleanupService,
} from '@/jobs/cleanupSoftDeleted';

const mockGetSoftDeleteMetrics = getSoftDeleteMetrics as jest.Mock;
const mockRunSoftDeleteCleanup = runSoftDeleteCleanup as jest.Mock;
const mockSoftDeleteCleanupService = SoftDeleteCleanupService as jest.Mock;

// Setup the service mock
mockSoftDeleteCleanupService.mockImplementation(() => ({
  generateCleanupReport: mockGenerateCleanupReportFn,
}));

const mockGenerateCleanupReport = mockGenerateCleanupReportFn;

describe('GET/POST /api/admin/cleanup - Admin Cleanup Operations', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('GET /api/admin/cleanup - Get Cleanup Metrics', () => {
    describe('✅ Successful Metrics Retrieval', () => {
      it('should return cleanup metrics for SUPER_ADMIN', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
        });

        const mockMetrics = {
          totalSoftDeleted: 15,
          eligibleForPermanentDelete: 5,
          retentionPeriodDays: 90,
          lastCleanupAt: new Date('2024-01-15T00:00:00Z'),
        };

        mockGetSoftDeleteMetrics.mockResolvedValue(mockMetrics);

        const request = createGetRequest('http://localhost:3000/api/admin/cleanup');

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.metrics).toEqual(mockMetrics);
        expect(data.timestamp).toBeDefined();
        expect(mockGetSoftDeleteMetrics).toHaveBeenCalled();
      });

      it('should include detailed report when includeReport=true', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
        });

        const mockMetrics = {
          totalSoftDeleted: 15,
          eligibleForPermanentDelete: 5,
        };

        const mockReport = {
          users: [
            { id: 'user-1', deletedAt: new Date(), reason: 'Test' },
          ],
          summary: {
            total: 15,
            eligible: 5,
          },
        };

        mockGetSoftDeleteMetrics.mockResolvedValue(mockMetrics);
        mockGenerateCleanupReport.mockResolvedValue(mockReport);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/cleanup?includeReport=true'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.metrics).toEqual(mockMetrics);
        expect(data.report).toEqual(mockReport);
        expect(mockGenerateCleanupReport).toHaveBeenCalled();
      });

      it('should not include report when includeReport is not set', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
        });

        mockGetSoftDeleteMetrics.mockResolvedValue({
          totalSoftDeleted: 10,
        });

        const request = createGetRequest('http://localhost:3000/api/admin/cleanup');

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.report).toBeUndefined();
        expect(mockGenerateCleanupReport).not.toHaveBeenCalled();
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
        });

        const request = createGetRequest('http://localhost:3000/api/admin/cleanup');

        const response = await GET(request);
        await expectUnauthorized(response);

        expect(mockGetSoftDeleteMetrics).not.toHaveBeenCalled();
      });

      it('should return 401 when auth error occurs', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: new Error('Auth failed'),
        });

        const request = createGetRequest('http://localhost:3000/api/admin/cleanup');

        const response = await GET(request);
        await expectUnauthorized(response);
      });
    });

    describe('🔒 Authorization Tests', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        });
      });

      it('should return 403 for ADMIN users', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });

        const request = createGetRequest('http://localhost:3000/api/admin/cleanup');

        const response = await GET(request);
        await expectForbidden(response, /Only Super Admin can access cleanup functions/i);
      });

      it('should return 403 for CLIENT users', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.CLIENT,
        });

        const request = createGetRequest('http://localhost:3000/api/admin/cleanup');

        const response = await GET(request);
        await expectForbidden(response);
      });

      it('should return 403 for VENDOR users', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.VENDOR,
        });

        const request = createGetRequest('http://localhost:3000/api/admin/cleanup');

        const response = await GET(request);
        await expectForbidden(response);
      });

      it('should return 403 for DRIVER users', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.DRIVER,
        });

        const request = createGetRequest('http://localhost:3000/api/admin/cleanup');

        const response = await GET(request);
        await expectForbidden(response);
      });

      it('should return 403 for HELPDESK users', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.HELPDESK,
        });

        const request = createGetRequest('http://localhost:3000/api/admin/cleanup');

        const response = await GET(request);
        await expectForbidden(response);
      });
    });

    describe('❌ Error Handling', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
        });
      });

      it('should handle errors when fetching metrics', async () => {
        mockGetSoftDeleteMetrics.mockRejectedValue(new Error('Database error'));

        const request = createGetRequest('http://localhost:3000/api/admin/cleanup');

        const response = await GET(request);
        await expectErrorResponse(response, 500, /Failed to get cleanup metrics/i);
      });

      it('should handle errors when generating report', async () => {
        mockGetSoftDeleteMetrics.mockResolvedValue({ totalSoftDeleted: 5 });
        mockGenerateCleanupReport.mockRejectedValue(new Error('Report generation failed'));

        const request = createGetRequest(
          'http://localhost:3000/api/admin/cleanup?includeReport=true'
        );

        const response = await GET(request);
        await expectErrorResponse(response, 500);
      });
    });
  });

  describe('POST /api/admin/cleanup - Run Cleanup', () => {
    describe('✅ Successful Cleanup', () => {
      it('should run dry-run cleanup by default', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
          email: 'superadmin@example.com',
        });

        (prisma.userAudit.create as jest.Mock).mockResolvedValue({});

        const mockResult = {
          success: true,
          dryRun: true,
          deletedCount: 0,
          eligibleCount: 5,
          errors: [],
        };

        mockRunSoftDeleteCleanup.mockResolvedValue(mockResult);

        const request = createPostRequest('http://localhost:3000/api/admin/cleanup', {
          retentionDays: 90,
        });

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.message).toMatch(/dry-run/i);
        expect(data.result).toEqual(mockResult);
        expect(data.performedBy.id).toBe('superadmin-123');
        expect(mockRunSoftDeleteCleanup).toHaveBeenCalledWith(
          expect.objectContaining({
            dryRun: true,
            retentionDays: 90,
          })
        );
      });

      it('should run actual cleanup when dryRun=false and force=true', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
          email: 'superadmin@example.com',
        });

        (prisma.userAudit.create as jest.Mock).mockResolvedValue({});

        const mockResult = {
          success: true,
          dryRun: false,
          deletedCount: 5,
          eligibleCount: 5,
          errors: [],
        };

        mockRunSoftDeleteCleanup.mockResolvedValue(mockResult);

        const request = createPostRequest('http://localhost:3000/api/admin/cleanup', {
          dryRun: false,
          force: true,
          retentionDays: 90,
        });

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.message).toMatch(/operation completed/i);
        expect(data.result.deletedCount).toBe(5);
        expect(mockRunSoftDeleteCleanup).toHaveBeenCalledWith(
          expect.objectContaining({
            dryRun: false,
            retentionDays: 90,
          })
        );
      });

      it('should create audit log for cleanup operation', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
          email: 'superadmin@example.com',
        });

        (prisma.userAudit.create as jest.Mock).mockResolvedValue({});

        mockRunSoftDeleteCleanup.mockResolvedValue({
          success: true,
          dryRun: true,
          deletedCount: 0,
        });

        const request = createPostRequest('http://localhost:3000/api/admin/cleanup', {
          retentionDays: 90,
        });

        await POST(request);

        expect(prisma.userAudit.create).toHaveBeenCalledTimes(2);
        expect(prisma.userAudit.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: 'MANUAL_CLEANUP_INITIATED',
              performedBy: 'superadmin-123',
            }),
          })
        );
      });

      it('should pass custom parameters to cleanup function', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
          email: 'superadmin@example.com',
        });

        (prisma.userAudit.create as jest.Mock).mockResolvedValue({});

        mockRunSoftDeleteCleanup.mockResolvedValue({
          success: true,
          dryRun: true,
        });

        const request = createPostRequest('http://localhost:3000/api/admin/cleanup', {
          retentionDays: 60,
          batchSize: 10,
          maxDailyDeletions: 100,
          includeUserTypes: ['CLIENT'],
          excludeUserTypes: ['ADMIN'],
        });

        await POST(request);

        expect(mockRunSoftDeleteCleanup).toHaveBeenCalledWith({
          dryRun: true,
          retentionDays: 60,
          batchSize: 10,
          maxDailyDeletions: 100,
          includeUserTypes: ['CLIENT'],
          excludeUserTypes: ['ADMIN'],
        });
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
        });

        const request = createPostRequest('http://localhost:3000/api/admin/cleanup', {});

        const response = await POST(request);
        await expectUnauthorized(response);

        expect(mockRunSoftDeleteCleanup).not.toHaveBeenCalled();
      });
    });

    describe('🔒 Authorization Tests', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        });
      });

      it('should return 403 for ADMIN users', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });

        const request = createPostRequest('http://localhost:3000/api/admin/cleanup', {});

        const response = await POST(request);
        await expectForbidden(response, /Only Super Admin can run cleanup operations/i);
      });

      it('should return 403 for CLIENT users', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.CLIENT,
        });

        const request = createPostRequest('http://localhost:3000/api/admin/cleanup', {});

        const response = await POST(request);
        await expectForbidden(response);
      });
    });

    describe('✏️ Validation Tests', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
          email: 'superadmin@example.com',
        });
      });

      it('should require force=true for non-dry-run operations', async () => {
        const request = createPostRequest('http://localhost:3000/api/admin/cleanup', {
          dryRun: false,
        });

        const response = await POST(request);
        await expectErrorResponse(
          response,
          400,
          /force.*true.*confirm/i
        );

        expect(mockRunSoftDeleteCleanup).not.toHaveBeenCalled();
      });

      it('should handle empty request body gracefully', async () => {
        (prisma.userAudit.create as jest.Mock).mockResolvedValue({});

        mockRunSoftDeleteCleanup.mockResolvedValue({
          success: true,
          dryRun: true,
        });

        const request = createPostRequest('http://localhost:3000/api/admin/cleanup', {});

        const response = await POST(request);
        await expectSuccessResponse(response, 200);

        expect(mockRunSoftDeleteCleanup).toHaveBeenCalledWith({
          dryRun: true,
          retentionDays: undefined,
          batchSize: undefined,
          maxDailyDeletions: undefined,
          includeUserTypes: undefined,
          excludeUserTypes: undefined,
        });
      });
    });

    describe('❌ Error Handling', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
          email: 'superadmin@example.com',
        });

        (prisma.userAudit.create as jest.Mock).mockResolvedValue({});
      });

      it('should handle cleanup execution errors', async () => {
        mockRunSoftDeleteCleanup.mockRejectedValue(new Error('Cleanup failed'));

        const request = createPostRequest('http://localhost:3000/api/admin/cleanup', {});

        const response = await POST(request);
        await expectErrorResponse(response, 500, /Manual cleanup failed/i);
      });

      it('should handle audit log creation errors', async () => {
        (prisma.userAudit.create as jest.Mock).mockRejectedValue(
          new Error('Audit log failed')
        );

        const request = createPostRequest('http://localhost:3000/api/admin/cleanup', {});

        const response = await POST(request);
        await expectErrorResponse(response, 500);
      });
    });
  });
});
