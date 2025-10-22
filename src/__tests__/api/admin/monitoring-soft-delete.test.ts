// src/__tests__/api/admin/monitoring-soft-delete.test.ts

import { GET, POST } from '@/app/api/admin/monitoring/soft-delete/route';
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

// Mock monitoring service
jest.mock('@/lib/monitoring/softDeleteMonitoring');

import { SoftDeleteMonitoringService } from '@/lib/monitoring/softDeleteMonitoring';

const mockGetDashboardData = SoftDeleteMonitoringService.getDashboardData as jest.Mock;
const mockCollectMetrics = SoftDeleteMonitoringService.collectMetrics as jest.Mock;
const mockRunMonitoringCheck = SoftDeleteMonitoringService.runMonitoringCheck as jest.Mock;

describe('GET/POST /api/admin/monitoring/soft-delete - Soft Delete Monitoring', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('GET /api/admin/monitoring/soft-delete - Get Monitoring Data', () => {
    describe('✅ Successful Retrieval', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });
      });

      it('should return dashboard data by default', async () => {
        const mockDashboard = {
          systemHealth: { status: 'healthy' },
          last24Hours: { totalSoftDeletes: 10 },
          recentAlerts: [],
        };

        mockGetDashboardData.mockResolvedValue(mockDashboard);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete'
        );
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toEqual(mockDashboard);
        expect(mockGetDashboardData).toHaveBeenCalled();
      });

      it('should return dashboard data when type=dashboard', async () => {
        const mockDashboard = {
          systemHealth: { status: 'healthy' },
          last24Hours: { totalSoftDeletes: 5 },
        };

        mockGetDashboardData.mockResolvedValue(mockDashboard);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete?type=dashboard'
        );
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toEqual(mockDashboard);
      });

      it('should return metrics with custom time range', async () => {
        const mockMetrics = {
          totalDeletes: 100,
          totalRestores: 20,
        };

        mockCollectMetrics.mockResolvedValue(mockMetrics);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete?type=metrics&startTime=2025-10-20T00:00:00Z&endTime=2025-10-22T00:00:00Z'
        );
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.metrics).toEqual(mockMetrics);
        expect(data.timeRange).toBeDefined();
        expect(data.timeRange.startTime).toBe('2025-10-20T00:00:00.000Z');
        expect(data.timeRange.endTime).toBe('2025-10-22T00:00:00.000Z');
        expect(mockCollectMetrics).toHaveBeenCalledWith(
          new Date('2025-10-20T00:00:00Z'),
          new Date('2025-10-22T00:00:00Z')
        );
      });

      it('should return metrics with default 24h range if no dates provided', async () => {
        const mockMetrics = { totalDeletes: 50 };
        mockCollectMetrics.mockResolvedValue(mockMetrics);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete?type=metrics'
        );
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.metrics).toEqual(mockMetrics);
        expect(mockCollectMetrics).toHaveBeenCalled();

        // Verify it was called with date objects (24h range)
        const calls = mockCollectMetrics.mock.calls[0];
        expect(calls[0]).toBeInstanceOf(Date);
        expect(calls[1]).toBeInstanceOf(Date);
      });

      it('should return alerts data', async () => {
        const mockAlerts = {
          alerts: [
            { severity: 'high', message: 'High deletion rate' },
          ],
          metrics: { deletionRate: 150 },
          timestamp: new Date().toISOString(),
        };

        mockRunMonitoringCheck.mockResolvedValue(mockAlerts);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete?type=alerts'
        );
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.alerts).toEqual(mockAlerts.alerts);
        expect(data.metricsUsed).toEqual(mockAlerts.metrics);
        expect(data.timestamp).toBeDefined();
      });

      it('should return health summary', async () => {
        const mockDashboard = {
          systemHealth: { status: 'degraded' },
          last24Hours: {
            totalSoftDeletes: 15,
            totalRestores: 5,
            retentionCompliance: { percentageCompliant: 98.5 },
          },
          last7Days: {
            totalSoftDeletes: 100,
            totalRestores: 30,
            retentionCompliance: { percentageCompliant: 97.2 },
          },
          recentAlerts: [{ id: '1' }, { id: '2' }],
        };

        mockGetDashboardData.mockResolvedValue(mockDashboard);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete?type=health'
        );
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.systemHealth).toEqual(mockDashboard.systemHealth);
        expect(data.summary.last24Hours.deletions).toBe(15);
        expect(data.summary.last24Hours.restores).toBe(5);
        expect(data.summary.last24Hours.complianceRate).toBe(98.5);
        expect(data.summary.last7Days.deletions).toBe(100);
        expect(data.recentAlertsCount).toBe(2);
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete'
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

      it('should allow ADMIN to access monitoring data', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });

        mockGetDashboardData.mockResolvedValue({ data: 'test' });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete'
        );
        const response = await GET(request);
        await expectSuccessResponse(response, 200);
      });

      it('should allow SUPER_ADMIN to access monitoring data', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.SUPER_ADMIN,
        });

        mockGetDashboardData.mockResolvedValue({ data: 'test' });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete'
        );
        const response = await GET(request);
        await expectSuccessResponse(response, 200);
      });

      it('should return 403 when CLIENT tries to access', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.CLIENT,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete'
        );
        const response = await GET(request);
        await expectForbidden(response, /Only Admin or Super Admin/i);
      });

      it('should return 403 when VENDOR tries to access', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.VENDOR,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete'
        );
        const response = await GET(request);
        await expectForbidden(response);
      });

      it('should return 403 when DRIVER tries to access', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.DRIVER,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete'
        );
        const response = await GET(request);
        await expectForbidden(response);
      });

      it('should return 403 when HELPDESK tries to access', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.HELPDESK,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete'
        );
        const response = await GET(request);
        await expectForbidden(response);
      });
    });

    describe('✏️ Validation Tests', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });
      });

      it('should return 400 for invalid type parameter', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete?type=invalid'
        );
        const response = await GET(request);
        await expectErrorResponse(
          response,
          400,
          /Invalid type parameter.*dashboard, metrics, alerts, or health/i
        );
      });

      it('should return 400 for invalid startTime format', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete?type=metrics&startTime=invalid-date'
        );
        const response = await GET(request);
        await expectErrorResponse(response, 400, /Invalid startTime format/i);
      });

      it('should return 400 for invalid endTime format', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete?type=metrics&endTime=not-a-date'
        );
        const response = await GET(request);
        await expectErrorResponse(response, 400, /Invalid endTime format/i);
      });
    });

    describe('❌ Error Handling', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
        });
      });

      it('should handle dashboard data retrieval errors', async () => {
        mockGetDashboardData.mockRejectedValue(new Error('Service unavailable'));

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete'
        );
        const response = await GET(request);
        await expectErrorResponse(response, 500, /Failed to get monitoring data/i);
      });

      it('should handle metrics collection errors', async () => {
        mockCollectMetrics.mockRejectedValue(new Error('Metrics collection failed'));

        const request = createGetRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete?type=metrics'
        );
        const response = await GET(request);
        await expectErrorResponse(response, 500);
      });
    });
  });

  describe('POST /api/admin/monitoring/soft-delete - Manual Monitoring Check', () => {
    describe('✅ Successful Monitoring Check', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
          email: 'admin@example.com',
        });

        (prisma.userAudit.create as jest.Mock).mockResolvedValue({});
      });

      it('should run full monitoring check by default', async () => {
        const mockDashboard = {
          systemHealth: { status: 'healthy' },
          recentAlerts: [],
        };

        mockGetDashboardData.mockResolvedValue(mockDashboard);

        const request = createPostRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete',
          {}
        );
        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.message).toMatch(/completed/i);
        expect(data.result.type).toBe('full');
        expect(data.result.data).toEqual(mockDashboard);
        expect(data.performedBy.email).toBe('admin@example.com');

        // Verify audit logs created (start and completion)
        expect(prisma.userAudit.create).toHaveBeenCalledTimes(2);
      });

      it('should run metrics check when checkType=metrics', async () => {
        const mockMetrics = { totalDeletes: 50 };
        mockCollectMetrics.mockResolvedValue(mockMetrics);

        const request = createPostRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete',
          { checkType: 'metrics' }
        );
        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.result.type).toBe('metrics');
        expect(data.result.data).toEqual(mockMetrics);
        expect(mockCollectMetrics).toHaveBeenCalled();
      });

      it('should run alerts check when checkType=alerts', async () => {
        const mockAlerts = {
          alerts: [{ severity: 'medium' }],
          metrics: { rate: 10 },
        };

        mockRunMonitoringCheck.mockResolvedValue(mockAlerts);

        const request = createPostRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete',
          { checkType: 'alerts' }
        );
        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.result.type).toBe('alerts');
        expect(data.result.data.alerts).toEqual(mockAlerts.alerts);
      });

      it('should handle custom time range for metrics check', async () => {
        mockCollectMetrics.mockResolvedValue({ data: 'test' });

        const request = createPostRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete',
          {
            checkType: 'metrics',
            startTime: '2025-10-20T00:00:00Z',
            endTime: '2025-10-22T00:00:00Z',
          }
        );
        await POST(request);

        expect(mockCollectMetrics).toHaveBeenCalledWith(
          new Date('2025-10-20T00:00:00Z'),
          new Date('2025-10-22T00:00:00Z')
        );
      });

      it('should create audit log for monitoring check', async () => {
        mockGetDashboardData.mockResolvedValue({ recentAlerts: [] });

        const request = createPostRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete',
          { checkType: 'full' }
        );
        await POST(request);

        const auditCalls = (prisma.userAudit.create as jest.Mock).mock.calls;

        // First call - initiation
        expect(auditCalls[0][0].data.action).toBe('MANUAL_MONITORING_CHECK');
        expect(auditCalls[0][0].data.userId).toBe('admin-123');

        // Second call - completion
        expect(auditCalls[1][0].data.action).toBe('MANUAL_MONITORING_CHECK_COMPLETED');
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
        });

        const request = createPostRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete',
          {}
        );
        const response = await POST(request);
        await expectUnauthorized(response);
      });
    });

    describe('🔒 Authorization Tests', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        });
      });

      it('should return 403 when CLIENT tries to trigger check', async () => {
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.CLIENT,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete',
          {}
        );
        const response = await POST(request);
        await expectForbidden(response, /Only Admin or Super Admin can trigger/i);
      });
    });

    describe('✏️ Validation Tests', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
          email: 'admin@example.com',
        });
      });

      it('should return 400 for invalid startTime', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete',
          {
            checkType: 'metrics',
            startTime: 'invalid-date',
          }
        );
        const response = await POST(request);
        await expectErrorResponse(response, 400, /Invalid startTime format/i);
      });

      it('should return 400 for invalid endTime', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete',
          {
            checkType: 'metrics',
            endTime: 'not-a-date',
          }
        );
        const response = await POST(request);
        await expectErrorResponse(response, 400, /Invalid endTime format/i);
      });
    });

    describe('❌ Error Handling', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.ADMIN,
          email: 'admin@example.com',
        });

        (prisma.userAudit.create as jest.Mock).mockResolvedValue({});
      });

      it('should handle monitoring service errors', async () => {
        mockGetDashboardData.mockRejectedValue(new Error('Service down'));

        const request = createPostRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete',
          {}
        );
        const response = await POST(request);
        await expectErrorResponse(response, 500, /Manual monitoring check failed/i);
      });

      it('should handle audit log creation errors', async () => {
        (prisma.userAudit.create as jest.Mock).mockRejectedValue(
          new Error('Audit log failed')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/admin/monitoring/soft-delete',
          {}
        );
        const response = await POST(request);
        await expectErrorResponse(response, 500);
      });
    });
  });
});
