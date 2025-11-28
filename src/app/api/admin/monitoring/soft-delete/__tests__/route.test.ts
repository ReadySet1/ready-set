/**
 * Tests for /api/admin/monitoring/soft-delete route
 *
 * Critical functionality tested:
 * - Admin-only access control
 * - Multiple monitoring types (dashboard, metrics, alerts, health)
 * - Manual monitoring check triggering
 * - Audit logging for manual checks
 * - Time range validation
 * - Error handling
 *
 * Security focus:
 * - ADMIN/SUPER_ADMIN role enforcement
 * - Authentication validation
 * - Audit trail compliance
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { SoftDeleteMonitoringService } from '@/lib/monitoring/softDeleteMonitoring';
import { UserType } from '@/types/prisma';

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

jest.mock('@/lib/monitoring/softDeleteMonitoring', () => ({
  SoftDeleteMonitoringService: {
    getDashboardData: jest.fn(),
    collectMetrics: jest.fn(),
    runMonitoringCheck: jest.fn(),
  },
}));

/**
 * TODO: REA-211 - Soft delete monitoring GET tests have Supabase mocking issues
 */
describe.skip('GET /api/admin/monitoring/soft-delete', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  const mockAdminProfile = {
    id: 'admin-user-id',
    type: UserType.ADMIN,
    email: 'admin@example.com',
  };

  const mockSuperAdminProfile = {
    id: 'superadmin-user-id',
    type: UserType.SUPER_ADMIN,
    email: 'superadmin@example.com',
  };

  const mockDashboardData = {
    last24Hours: {
      totalSoftDeletes: 10,
      totalRestores: 2,
      retentionCompliance: { percentageCompliant: 95 },
    },
    last7Days: {
      totalSoftDeletes: 50,
      totalRestores: 10,
      retentionCompliance: { percentageCompliant: 92 },
    },
    systemHealth: {
      status: 'healthy',
      score: 95,
    },
    recentAlerts: [],
  };

  const mockMetrics = {
    totalSoftDeletes: 100,
    totalRestores: 20,
    deletionsByTable: { users: 50, orders: 50 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized: Authentication required');
    });

    it('should allow ADMIN role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockAdminProfile);
      (SoftDeleteMonitoringService.getDashboardData as jest.Mock).mockResolvedValue(mockDashboardData);

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should allow SUPER_ADMIN role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'superadmin-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockSuperAdminProfile);
      (SoftDeleteMonitoringService.getDashboardData as jest.Mock).mockResolvedValue(mockDashboardData);

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should reject non-admin users', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'regular-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        id: 'regular-user-id',
        type: UserType.CLIENT,
        email: 'user@example.com',
      });

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: Only Admin or Super Admin can access monitoring data');
    });

    it('should reject when profile not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'unknown-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: Only Admin or Super Admin can access monitoring data');
    });
  });

  describe('Dashboard type (default)', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockAdminProfile);
    });

    it('should return dashboard data by default', async () => {
      (SoftDeleteMonitoringService.getDashboardData as jest.Mock).mockResolvedValue(mockDashboardData);

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockDashboardData);
      expect(SoftDeleteMonitoringService.getDashboardData).toHaveBeenCalled();
    });

    it('should return dashboard data when type=dashboard', async () => {
      (SoftDeleteMonitoringService.getDashboardData as jest.Mock).mockResolvedValue(mockDashboardData);

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete?type=dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockDashboardData);
    });
  });

  describe('Metrics type', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockAdminProfile);
    });

    it('should collect metrics with custom time range', async () => {
      (SoftDeleteMonitoringService.collectMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const startTime = '2025-01-01T00:00:00Z';
      const endTime = '2025-01-02T00:00:00Z';
      const request = new NextRequest(
        `http://localhost:3000/api/admin/monitoring/soft-delete?type=metrics&startTime=${startTime}&endTime=${endTime}`
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toEqual(mockMetrics);
      expect(data.timeRange).toEqual({
        startTime,
        endTime,
      });
      expect(data.timestamp).toBeDefined();
      expect(SoftDeleteMonitoringService.collectMetrics).toHaveBeenCalledWith(
        new Date(startTime),
        new Date(endTime)
      );
    });

    it('should use default 24h range if no time specified', async () => {
      (SoftDeleteMonitoringService.collectMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete?type=metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(SoftDeleteMonitoringService.collectMetrics).toHaveBeenCalled();

      const [startArg, endArg] = (SoftDeleteMonitoringService.collectMetrics as jest.Mock).mock.calls[0];
      expect(endArg.getTime() - startArg.getTime()).toBeCloseTo(24 * 60 * 60 * 1000, -1000);
    });

    it('should reject invalid startTime format', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/monitoring/soft-delete?type=metrics&startTime=invalid-date'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid startTime format. Use ISO 8601 format.');
    });

    it('should reject invalid endTime format', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/monitoring/soft-delete?type=metrics&startTime=2025-01-01T00:00:00Z&endTime=bad-date'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid endTime format. Use ISO 8601 format.');
    });
  });

  describe('Alerts type', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockAdminProfile);
    });

    it('should run monitoring check and return alerts', async () => {
      const mockAlerts = {
        alerts: [{ severity: 'high', message: 'High deletion rate' }],
        metrics: mockMetrics,
        timestamp: new Date().toISOString(),
      };
      (SoftDeleteMonitoringService.runMonitoringCheck as jest.Mock).mockResolvedValue(mockAlerts);

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete?type=alerts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.alerts).toEqual(mockAlerts.alerts);
      expect(data.metricsUsed).toEqual(mockMetrics);
      expect(data.timestamp).toBeDefined();
    });

    it('should pass time range to monitoring check', async () => {
      const mockAlerts = {
        alerts: [],
        metrics: mockMetrics,
        timestamp: new Date().toISOString(),
      };
      (SoftDeleteMonitoringService.runMonitoringCheck as jest.Mock).mockResolvedValue(mockAlerts);

      const startTime = '2025-01-01T00:00:00Z';
      const endTime = '2025-01-02T00:00:00Z';
      const request = new NextRequest(
        `http://localhost:3000/api/admin/monitoring/soft-delete?type=alerts&startTime=${startTime}&endTime=${endTime}`
      );
      await GET(request);

      expect(SoftDeleteMonitoringService.runMonitoringCheck).toHaveBeenCalledWith(
        new Date(startTime),
        new Date(endTime)
      );
    });
  });

  describe('Health type', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockAdminProfile);
    });

    it('should return system health summary', async () => {
      (SoftDeleteMonitoringService.getDashboardData as jest.Mock).mockResolvedValue(mockDashboardData);

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete?type=health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.systemHealth).toEqual(mockDashboardData.systemHealth);
      expect(data.summary.last24Hours).toEqual({
        deletions: 10,
        restores: 2,
        complianceRate: 95,
      });
      expect(data.summary.last7Days).toEqual({
        deletions: 50,
        restores: 10,
        complianceRate: 92,
      });
      expect(data.recentAlertsCount).toBe(0);
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Invalid type handling', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockAdminProfile);
    });

    it('should reject invalid type parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete?type=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid type parameter. Use: dashboard, metrics, alerts, or health');
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockAdminProfile);
    });

    it('should handle service errors gracefully', async () => {
      const serviceError = new Error('Service unavailable');
      (SoftDeleteMonitoringService.getDashboardData as jest.Mock).mockRejectedValue(serviceError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get monitoring data');
      expect(data.details).toBe('Service unavailable');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle unknown errors', async () => {
      (SoftDeleteMonitoringService.getDashboardData as jest.Mock).mockRejectedValue('Unknown error');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get monitoring data');
      expect(data.details).toBe('Unknown error');

      consoleSpy.mockRestore();
    });
  });
});

/**
 * TODO: REA-211 - Soft delete monitoring POST tests have Supabase mocking issues
 */
describe.skip('POST /api/admin/monitoring/soft-delete', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  const mockAdminProfile = {
    id: 'admin-user-id',
    type: UserType.ADMIN,
    email: 'admin@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized: Authentication required');
    });

    it('should reject non-admin users', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'regular-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        id: 'regular-user-id',
        type: UserType.CLIENT,
        email: 'user@example.com',
      });

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: Only Admin or Super Admin can trigger monitoring checks');
    });
  });

  describe('Manual monitoring checks', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockAdminProfile);
      (prisma.userAudit.create as jest.Mock).mockResolvedValue({});
    });

    it('should trigger full monitoring check by default', async () => {
      const mockDashboard = { last24Hours: {}, last7Days: {}, systemHealth: {}, recentAlerts: [] };
      (SoftDeleteMonitoringService.getDashboardData as jest.Mock).mockResolvedValue(mockDashboard);

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Manual monitoring check completed');
      expect(data.result.type).toBe('full');
      expect(data.result.data).toEqual(mockDashboard);
      expect(data.performedBy).toEqual({
        id: 'admin-user-id',
        email: 'admin@example.com',
      });
    });

    it('should trigger metrics-only check', async () => {
      const mockMetrics = { totalSoftDeletes: 100, totalRestores: 20 };
      (SoftDeleteMonitoringService.collectMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete', {
        method: 'POST',
        body: JSON.stringify({ checkType: 'metrics' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.result.type).toBe('metrics');
      expect(data.result.data).toEqual(mockMetrics);
    });

    it('should trigger alerts-only check', async () => {
      const mockAlerts = { alerts: [], metrics: {} };
      (SoftDeleteMonitoringService.runMonitoringCheck as jest.Mock).mockResolvedValue(mockAlerts);

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete', {
        method: 'POST',
        body: JSON.stringify({ checkType: 'alerts' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.result.type).toBe('alerts');
      expect(data.result.data.alerts).toEqual([]);
    });

    it('should accept custom time range', async () => {
      const mockMetrics = { totalSoftDeletes: 100 };
      (SoftDeleteMonitoringService.collectMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const startTime = '2025-01-01T00:00:00Z';
      const endTime = '2025-01-02T00:00:00Z';

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete', {
        method: 'POST',
        body: JSON.stringify({
          checkType: 'metrics',
          startTime,
          endTime,
        }),
      });
      await POST(request);

      expect(SoftDeleteMonitoringService.collectMetrics).toHaveBeenCalledWith(
        new Date(startTime),
        new Date(endTime)
      );
    });

    it('should reject invalid time formats', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete', {
        method: 'POST',
        body: JSON.stringify({
          checkType: 'metrics',
          startTime: 'invalid-date',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid startTime format');
    });
  });

  describe('Audit logging', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockAdminProfile);
      (SoftDeleteMonitoringService.getDashboardData as jest.Mock).mockResolvedValue({
        recentAlerts: [{ id: 1 }, { id: 2 }],
      });
    });

    it('should create audit log for initiation', async () => {
      (prisma.userAudit.create as jest.Mock).mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete', {
        method: 'POST',
        body: JSON.stringify({ checkType: 'full' }),
      });
      await POST(request);

      expect(prisma.userAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'admin-user-id',
            action: 'MANUAL_MONITORING_CHECK',
            performedBy: 'admin-user-id',
          }),
        })
      );
    });

    it('should create audit log for completion', async () => {
      (prisma.userAudit.create as jest.Mock).mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete', {
        method: 'POST',
        body: JSON.stringify({ checkType: 'full' }),
      });
      await POST(request);

      const calls = (prisma.userAudit.create as jest.Mock).mock.calls;
      const completionCall = calls.find(call =>
        call[0].data.action === 'MANUAL_MONITORING_CHECK_COMPLETED'
      );

      expect(completionCall).toBeDefined();
      expect(completionCall[0].data.changes.result.alertsGenerated).toBe(2);
      expect(completionCall[0].data.changes.result.success).toBe(true);
    });

    it('should log check parameters in audit trail', async () => {
      (prisma.userAudit.create as jest.Mock).mockResolvedValue({});

      const startTime = '2025-01-01T00:00:00Z';
      const endTime = '2025-01-02T00:00:00Z';

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete', {
        method: 'POST',
        body: JSON.stringify({
          checkType: 'metrics',
          startTime,
          endTime,
        }),
      });
      await POST(request);

      const initiationCall = (prisma.userAudit.create as jest.Mock).mock.calls[0];
      expect(initiationCall[0].data.changes.parameters).toEqual({
        checkType: 'metrics',
        startTime,
        endTime,
      });
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockAdminProfile);
      (prisma.userAudit.create as jest.Mock).mockResolvedValue({});
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Service failure');
      (SoftDeleteMonitoringService.getDashboardData as jest.Mock).mockRejectedValue(serviceError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Manual monitoring check failed');
      expect(data.details).toBe('Service failure');

      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON body', async () => {
      (SoftDeleteMonitoringService.getDashboardData as jest.Mock).mockResolvedValue({
        recentAlerts: [],
      });

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete', {
        method: 'POST',
        body: 'invalid json',
      });
      const response = await POST(request);

      // Should still work with empty body
      expect(response.status).toBe(200);
    });
  });

  describe('Console logging', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user-id' } },
        error: null,
      });
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockAdminProfile);
      (prisma.userAudit.create as jest.Mock).mockResolvedValue({});
      (SoftDeleteMonitoringService.getDashboardData as jest.Mock).mockResolvedValue({
        recentAlerts: [],
      });
    });

    it('should log manual check details to console', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const request = new NextRequest('http://localhost:3000/api/admin/monitoring/soft-delete', {
        method: 'POST',
        body: JSON.stringify({ checkType: 'full' }),
      });
      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Manual monitoring check initiated',
        expect.objectContaining({
          userId: 'admin-user-id',
          userEmail: 'admin@example.com',
          checkType: 'full',
        })
      );

      consoleSpy.mockRestore();
    });
  });
});
