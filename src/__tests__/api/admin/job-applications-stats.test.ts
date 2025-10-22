// src/__tests__/api/admin/job-applications-stats.test.ts

import { GET } from '@/app/api/admin/job-applications/stats/route';
import { prisma } from '@/lib/db/prisma';
import {
  createGetRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    jobApplication: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('GET /api/admin/job-applications/stats - Get Job Application Statistics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('✅ Successful Retrieval', () => {
    it('should return complete statistics', async () => {
      const mockRecentApps = [
        {
          id: 'app-1',
          firstName: 'John',
          lastName: 'Doe',
          position: 'DRIVER',
          status: 'PENDING',
          createdAt: new Date('2025-10-22'),
          fileUploads: [{ category: 'resume' }],
        },
        {
          id: 'app-2',
          firstName: 'Jane',
          lastName: 'Smith',
          position: 'HELPER',
          status: 'APPROVED',
          createdAt: new Date('2025-10-21'),
          fileUploads: [],
        },
      ];

      (prisma.jobApplication.count as jest.Mock)
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(30) // approved
        .mockResolvedValueOnce(5) // rejected
        .mockResolvedValueOnce(5); // interviewing

      (prisma.jobApplication.groupBy as jest.Mock).mockResolvedValue([
        { position: 'DRIVER', _count: { position: 30 } },
        { position: 'HELPER', _count: { position: 20 } },
      ]);

      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue(
        mockRecentApps
      );

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications/stats'
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
      expect(data.recentApplications).toHaveLength(2);
      expect(data.recentApplications[0].name).toBe('John Doe');
      expect(data.recentApplications[0].hasResume).toBe(true);
      expect(data.recentApplications[1].hasResume).toBe(false);
    });

    it('should handle zero applications', async () => {
      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(0);
      (prisma.jobApplication.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications/stats'
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.totalApplications).toBe(0);
      expect(data.pendingApplications).toBe(0);
      expect(data.applicationsByPosition).toEqual({});
      expect(data.recentApplications).toHaveLength(0);
    });

    it('should limit recent applications to 5', async () => {
      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(100);
      (prisma.jobApplication.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications/stats'
      );

      await GET(request);

      expect(prisma.jobApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should exclude deleted applications', async () => {
      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(0);
      (prisma.jobApplication.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications/stats'
      );

      await GET(request);

      expect(prisma.jobApplication.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        })
      );

      expect(prisma.jobApplication.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        })
      );

      expect(prisma.jobApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        })
      );
    });

    it('should format recent applications correctly', async () => {
      const mockApp = {
        id: 'app-1',
        firstName: 'Test',
        lastName: 'User',
        position: 'DRIVER',
        status: 'PENDING',
        createdAt: new Date('2025-10-22T10:00:00Z'),
        fileUploads: [
          { category: 'resume' },
          { category: 'license' },
        ],
      };

      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(1);
      (prisma.jobApplication.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([mockApp]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications/stats'
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.recentApplications[0]).toEqual({
        id: 'app-1',
        name: 'Test User',
        position: 'DRIVER',
        status: 'PENDING',
        createdAt: new Date('2025-10-22T10:00:00Z'),
        hasResume: true,
      });
    });

    it('should handle multiple positions in applicationsByPosition', async () => {
      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(100);

      (prisma.jobApplication.groupBy as jest.Mock).mockResolvedValue([
        { position: 'DRIVER', _count: { position: 40 } },
        { position: 'HELPER', _count: { position: 30 } },
        { position: 'ADMIN', _count: { position: 20 } },
        { position: 'VENDOR', _count: { position: 10 } },
      ]);

      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications/stats'
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.applicationsByPosition).toEqual({
        DRIVER: 40,
        HELPER: 30,
        ADMIN: 20,
        VENDOR: 10,
      });
    });
  });

  describe('❌ Error Handling', () => {
    it('should return 503 when Prisma client is not initialized', async () => {
      // @ts-ignore - Mock undefined prisma
      (prisma as any).jobApplication = undefined;

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications/stats'
      );

      const response = await GET(request);
      await expectErrorResponse(response, 503, /Database connection not available/i);

      // Reset for other tests
      // @ts-ignore
      (prisma as any).jobApplication = {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      };
    });

    it('should handle count query errors', async () => {
      (prisma.jobApplication.count as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications/stats'
      );

      const response = await GET(request);
      await expectErrorResponse(response, 500, /Failed to fetch job application stats/i);
    });

    it('should handle groupBy query errors', async () => {
      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(0);
      (prisma.jobApplication.groupBy as jest.Mock).mockRejectedValue(
        new Error('GroupBy failed')
      );

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications/stats'
      );

      const response = await GET(request);
      await expectErrorResponse(response, 500);
    });

    it('should handle findMany query errors', async () => {
      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(0);
      (prisma.jobApplication.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.jobApplication.findMany as jest.Mock).mockRejectedValue(
        new Error('FindMany failed')
      );

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications/stats'
      );

      const response = await GET(request);
      await expectErrorResponse(response, 500);
    });
  });

  describe('📊 Edge Cases', () => {
    it('should handle applications without fileUploads', async () => {
      const mockApp = {
        id: 'app-1',
        firstName: 'Test',
        lastName: 'User',
        position: 'DRIVER',
        status: 'PENDING',
        createdAt: new Date(),
        fileUploads: null,
      };

      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(1);
      (prisma.jobApplication.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([mockApp]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications/stats'
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.recentApplications[0].hasResume).toBe(false);
    });

    it('should handle file uploads with non-resume categories', async () => {
      const mockApp = {
        id: 'app-1',
        firstName: 'Test',
        lastName: 'User',
        position: 'DRIVER',
        status: 'PENDING',
        createdAt: new Date(),
        fileUploads: [
          { category: 'license' },
          { category: 'certificate' },
        ],
      };

      (prisma.jobApplication.count as jest.Mock).mockResolvedValue(1);
      (prisma.jobApplication.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.jobApplication.findMany as jest.Mock).mockResolvedValue([mockApp]);

      const request = createGetRequest(
        'http://localhost:3000/api/admin/job-applications/stats'
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.recentApplications[0].hasResume).toBe(false);
    });
  });
});
