// src/__tests__/api/admin/job-applications-list.test.ts

import { GET } from '@/app/api/admin/job-applications/route';
import { prisma, withDatabaseRetry } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { createMockSupabaseClient } from '@/__tests__/helpers/supabase-mock-helpers';
import { ApplicationStatus } from '@/types/job-application';
import {
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    jobApplication: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
  withDatabaseRetry: jest.fn((callback) => callback()),
}));

const { createClient, createAdminClient } = jest.requireMock('@/utils/supabase/server');

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}));

describe('GET /api/admin/job-applications - List Job Applications', () => {
  let mockSupabaseClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
    (createAdminClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('✅ Successful Retrieval', () => {
    beforeEach(() => {
      mockSupabaseClient.from('profiles').single.mockResolvedValue({
        data: { type: 'ADMIN' },
        error: null,
      });
    });

    it('should return paginated job applications', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      const mockApplications = [
        {
          id: 'app-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          position: 'DRIVER',
          status: ApplicationStatus.PENDING,
          createdAt: new Date('2025-10-22'),
          fileUploads: [
            { id: 'file-1', fileName: 'resume.pdf', category: 'resume' },
          ],
        },
      ];

      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(1);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue(
        mockApplications
      );

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.applications).toHaveLength(1);
      expect(data.applications[0].id).toBe('app-1');
      expect(data.applications[0].hasFileUploads).toBe(true);
      expect(data.applications[0].fileUploadCount).toBe(1);
      expect(data.totalCount).toBe(1);
      expect(data.totalPages).toBe(1);
      expect(data.currentPage).toBe(1);
    });

    it('should filter by status', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(0);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest(
        `http://localhost:3000/api/admin/job-applications?status=${ApplicationStatus.APPROVED}`,
        { authorization: 'Bearer test-token' }
      );

      await GET(request);

      expect(prisma.jobApplication.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ApplicationStatus.APPROVED,
          }),
        })
      );
    });

    it('should filter by position', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(0);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications?position=DRIVER',
        { authorization: 'Bearer test-token' }
      );

      await GET(request);

      expect(prisma.jobApplication.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            position: 'DRIVER',
          }),
        })
      );
    });

    it('should search by name and email', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(0);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications?search=john',
        { authorization: 'Bearer test-token' }
      );

      await GET(request);

      expect(prisma.jobApplication.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { firstName: { contains: 'john', mode: 'insensitive' } },
              { lastName: { contains: 'john', mode: 'insensitive' } },
              { email: { contains: 'john', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should support custom pagination', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(100);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications?page=3&limit=20',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(prisma.jobApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40, // (page 3 - 1) * 20
          take: 20,
        })
      );
      expect(data.totalPages).toBe(5); // 100 / 20
      expect(data.currentPage).toBe(3);
    });

    it('should return stats when statsOnly=true', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      const mockRecentApps = [
        {
          id: 'app-1',
          firstName: 'Jane',
          lastName: 'Smith',
          createdAt: new Date(),
        },
      ];

      (prisma.jobApplication.count as jest.Mock)
        .mockResolvedValueOnce(50) // totalApplications
        .mockResolvedValueOnce(10) // pendingApplications
        .mockResolvedValueOnce(30) // approvedApplications
        .mockResolvedValueOnce(5) // rejectedApplications
        .mockResolvedValueOnce(5); // interviewingApplications

      (prisma.jobApplication.groupBy as jest.Mock).mockResolvedValue([
        { position: 'DRIVER', _count: { position: 30 } },
        { position: 'HELPER', _count: { position: 20 } },
      ]);

      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue(
        mockRecentApps
      );

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications?statsOnly=true',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.totalApplications).toBe(50);
      expect(data.pendingApplications).toBe(10);
      expect(data.approvedApplications).toBe(30);
      expect(data.rejectedApplications).toBe(5);
      expect(data.interviewingApplications).toBe(5);
      expect(data.applicationsByPosition).toEqual({
        DRIVER: 30,
        HELPER: 20,
      });
      expect(data.recentApplications).toHaveLength(1);
    });

    it('should handle applications without file uploads', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      const mockApplications = [
        {
          id: 'app-1',
          firstName: 'John',
          lastName: 'Doe',
          fileUploads: [],
        },
      ];

      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(1);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue(
        mockApplications
      );

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.applications[0].hasFileUploads).toBe(false);
      expect(data.applications[0].fileUploadCount).toBe(0);
    });

    it('should allow HELPDESK to access', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'helpdesk-123' } },
        error: null,
      });

      mockSupabaseClient.from('profiles').single.mockResolvedValue({
        data: { type: 'HELPDESK' },
        error: null,
      });

      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(0);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      await expectSuccessResponse(response, 200);
    });

    it('should allow SUPER_ADMIN to access', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'superadmin-123' } },
        error: null,
      });

      mockSupabaseClient.from('profiles').single.mockResolvedValue({
        data: { type: 'SUPER_ADMIN' },
        error: null,
      });

      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(0);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      await expectSuccessResponse(response, 200);
    });
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 when authorization header is missing', async () => {
      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications'
      );

      const response = await GET(request);
      await expectUnauthorized(response);
    });

    it('should return 401 when authorization header is invalid', async () => {
      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications',
        { authorization: 'Invalid header' }
      );

      const response = await GET(request);
      await expectUnauthorized(response);
    });

    it('should return 401 when token is invalid', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications',
        { authorization: 'Bearer invalid-token' }
      );

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

    it('should return 403 when CLIENT tries to access', async () => {
      mockSupabaseClient.from('profiles').single.mockResolvedValue({
        data: { type: 'CLIENT' },
        error: null,
      });

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      await expectForbidden(response);
    });

    it('should return 403 when VENDOR tries to access', async () => {
      mockSupabaseClient.from('profiles').single.mockResolvedValue({
        data: { type: 'VENDOR' },
        error: null,
      });

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      await expectForbidden(response);
    });

    it('should return 403 when DRIVER tries to access', async () => {
      mockSupabaseClient.from('profiles').single.mockResolvedValue({
        data: { type: 'DRIVER' },
        error: null,
      });

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      await expectForbidden(response);
    });
  });

  describe('❌ Error Handling', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
        error: null,
      });

      mockSupabaseClient.from('profiles').single.mockResolvedValue({
        data: { type: 'ADMIN' },
        error: null,
      });
    });

    it('should handle database query errors', async () => {
      (prisma.jobApplication.count as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      await expectErrorResponse(response, 500, /Failed to fetch job applications/i);
    });

    it('should handle statsOnly query errors', async () => {
      (prisma.jobApplication.count as jest.Mock).mockRejectedValue(
        new Error('Stats fetch failed')
      );

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications?statsOnly=true',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      await expectErrorResponse(response, 500);
    });
  });

  describe('📊 Edge Cases', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
        error: null,
      });

      mockSupabaseClient.from('profiles').single.mockResolvedValue({
        data: { type: 'ADMIN' },
        error: null,
      });
    });

    it('should handle empty results', async () => {
      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(0);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.applications).toHaveLength(0);
      expect(data.totalCount).toBe(0);
      expect(data.totalPages).toBe(0);
    });

    it('should handle page beyond total pages', async () => {
      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(5);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications?page=10&limit=10',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.applications).toHaveLength(0);
      expect(data.currentPage).toBe(10);
    });

    it('should use default pagination values', async () => {
      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(100);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications',
        { authorization: 'Bearer test-token' }
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.currentPage).toBe(1);
      expect(data.totalPages).toBe(10); // 100 / 10
    });
  });
});
