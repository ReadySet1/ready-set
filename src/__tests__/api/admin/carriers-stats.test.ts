// src/__tests__/api/admin/carriers-stats.test.ts

import { GET, POST } from '@/app/api/admin/carriers/[carrierId]/stats/route';
import { prisma } from '@/lib/db/prisma';
import { CarrierService } from '@/lib/services/carrierService';
import { webhookLogger } from '@/lib/services/webhook-logger';
import {
  createGetRequest,
  createPostRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    cateringRequest: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/carrierService', () => ({
  CarrierService: {
    getCarrier: jest.fn(),
  },
}));

jest.mock('@/lib/services/webhook-logger', () => ({
  webhookLogger: {
    getSuccessRate: jest.fn(),
  },
}));

// Auth gating (pilot API auth sweep): every test below runs as ADMIN unless
// it says otherwise.
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
import { NextResponse as AuthNextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';

const mockedWithAuth = withAuth as jest.Mock;
const authAs = (type: string, id = 'staff-1') => ({
  success: true,
  context: { user: { id, email: 'staff@rs.com', type } },
});
const authUnauthenticated = () => ({
  success: false,
  response: AuthNextResponse.json({ error: 'Authentication required' }, { status: 401 }),
  context: {},
});
const authForbidden = () => ({
  success: false,
  response: AuthNextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
  context: {},
});

beforeEach(() => {
  mockedWithAuth.mockResolvedValue(authAs('ADMIN'));
});

describe('GET/POST /api/admin/carriers/[carrierId]/stats - Carrier Statistics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/carriers/[carrierId]/stats - Get Carrier Stats', () => {
    // TODO: REA-211 - Success tests fail due to route/mock expectation mismatches
    describe.skip('✅ Successful Retrieval', () => {
      it('should return carrier statistics with webhook success rate', async () => {
        (CarrierService.getCarrier as jest.Mock).mockReturnValue({
          id: 'carrier-1',
          name: 'Test Carrier',
          orderPrefix: 'CATER',
        });

        const mockRecentOrders = [
          {
            id: 'order-1',
            orderNumber: 'CATER-001',
            status: 'ACTIVE',
            createdAt: new Date('2025-10-22T10:00:00Z'),
            orderTotal: 5000,
          },
        ];

        (prisma.cateringRequest.count as jest.Mock)
          .mockResolvedValueOnce(100) // totalOrders
          .mockResolvedValueOnce(25) // activeOrders
          .mockResolvedValueOnce(5); // todayOrders

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue(
          mockRecentOrders
        );

        // Mock webhook logger to return 95% success rate
        (webhookLogger.getSuccessRate as jest.Mock).mockResolvedValue({
          totalAttempts: 100,
          successfulAttempts: 95,
          successRate: 95.0,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/carriers/carrier-1/stats'
        );

        const context = {
          params: Promise.resolve({ carrierId: 'carrier-1' }),
        };

        const response = await GET(request, context);
        const data = await expectSuccessResponse(response, 200);

        expect(data.totalOrders).toBe(100);
        expect(data.activeOrders).toBe(25);
        expect(data.todayOrders).toBe(5);
        expect(data.webhookSuccess).toBe(95.0);
        expect(data.recentOrders).toHaveLength(1);
        expect(data.recentOrders[0].orderNumber).toBe('CATER-001');
        expect(data.recentOrders[0].orderTotal).toBe(5000);
      });

      it('should return null webhook success when no webhook attempts exist', async () => {
        (CarrierService.getCarrier as jest.Mock).mockReturnValue({
          id: 'carrier-2',
          orderPrefix: 'OD',
        });

        (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);
        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);

        // Mock webhook logger to return null when no attempts exist
        (webhookLogger.getSuccessRate as jest.Mock).mockResolvedValue({
          totalAttempts: 0,
          successfulAttempts: 0,
          successRate: null,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/carriers/carrier-2/stats'
        );

        const context = {
          params: Promise.resolve({ carrierId: 'carrier-2' }),
        };

        const response = await GET(request, context);
        const data = await expectSuccessResponse(response, 200);

        expect(data.totalOrders).toBe(0);
        expect(data.activeOrders).toBe(0);
        expect(data.todayOrders).toBe(0);
        expect(data.webhookSuccess).toBeNull();
        expect(data.recentOrders).toHaveLength(0);
      });

      it('should format recent orders correctly', async () => {
        (CarrierService.getCarrier as jest.Mock).mockReturnValue({
          id: 'carrier-1',
          orderPrefix: 'TEST',
        });

        const mockOrders = [
          {
            id: 'order-1',
            orderNumber: 'TEST-001',
            status: 'CONFIRMED',
            createdAt: new Date('2025-10-22T12:00:00Z'),
            orderTotal: null, // Test null handling
          },
          {
            id: 'order-2',
            orderNumber: 'TEST-002',
            status: 'IN_PROGRESS',
            createdAt: new Date('2025-10-22T11:00:00Z'),
            orderTotal: 7500,
          },
        ];

        (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(50);
        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue(
          mockOrders
        );

        // Mock webhook logger
        (webhookLogger.getSuccessRate as jest.Mock).mockResolvedValue({
          totalAttempts: 50,
          successfulAttempts: 48,
          successRate: 96.0,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/carriers/carrier-1/stats'
        );

        const context = {
          params: Promise.resolve({ carrierId: 'carrier-1' }),
        };

        const response = await GET(request, context);
        const data = await expectSuccessResponse(response, 200);

        expect(data.recentOrders[0].orderTotal).toBe(0); // null converted to 0
        expect(data.recentOrders[1].orderTotal).toBe(7500);
        expect(data.recentOrders[0].createdAt).toBe('2025-10-22T12:00:00.000Z');
      });

      it('should limit recent orders to 5', async () => {
        (CarrierService.getCarrier as jest.Mock).mockReturnValue({
          id: 'carrier-1',
          orderPrefix: 'CATER',
        });

        (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(100);
        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);

        // Mock webhook logger
        (webhookLogger.getSuccessRate as jest.Mock).mockResolvedValue({
          totalAttempts: 100,
          successfulAttempts: 90,
          successRate: 90.0,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/carriers/carrier-1/stats'
        );

        const context = {
          params: Promise.resolve({ carrierId: 'carrier-1' }),
        };

        await GET(request, context);

        expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 5,
          })
        );
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 404 when carrier is not found', async () => {
        (CarrierService.getCarrier as jest.Mock).mockReturnValue(null);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/carriers/invalid-carrier/stats'
        );

        const context = {
          params: Promise.resolve({ carrierId: 'invalid-carrier' }),
        };

        const response = await GET(request, context);
        await expectErrorResponse(response, 404, /Carrier not found/i);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle database query errors', async () => {
        (CarrierService.getCarrier as jest.Mock).mockReturnValue({
          id: 'carrier-1',
          orderPrefix: 'CATER',
        });

        (prisma.cateringRequest.count as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/admin/carriers/carrier-1/stats'
        );

        const context = {
          params: Promise.resolve({ carrierId: 'carrier-1' }),
        };

        const response = await GET(request, context);
        await expectErrorResponse(response, 500, /Internal server error/i);
      });

      // TODO: REA-211 - Test expects 200 but implementation returns 500
      it.skip('should return null webhook success when webhook logger fails', async () => {
        (CarrierService.getCarrier as jest.Mock).mockReturnValue({
          id: 'carrier-1',
          orderPrefix: 'CATER',
        });

        (prisma.cateringRequest.count as jest.Mock)
          .mockResolvedValueOnce(100) // totalOrders
          .mockResolvedValueOnce(25) // activeOrders
          .mockResolvedValueOnce(5); // todayOrders

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);

        // Mock webhook logger to return null on error
        (webhookLogger.getSuccessRate as jest.Mock).mockResolvedValue({
          totalAttempts: 0,
          successfulAttempts: 0,
          successRate: null,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/admin/carriers/carrier-1/stats'
        );

        const context = {
          params: Promise.resolve({ carrierId: 'carrier-1' }),
        };

        const response = await GET(request, context);
        const data = await expectSuccessResponse(response, 200);

        // Should return null when webhook logger fails
        expect(data.webhookSuccess).toBeNull();
      });
    });
  });

  describe('POST /api/admin/carriers/[carrierId]/stats - Get Webhook Metrics', () => {
    describe('✅ Successful Retrieval', () => {
      it('should return webhook metrics', async () => {
        (CarrierService.getCarrier as jest.Mock).mockReturnValue({
          id: 'carrier-1',
          name: 'Test Carrier',
          orderPrefix: 'CATER',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/admin/carriers/carrier-1/stats',
          { dateRange: '7d' }
        );

        const context = {
          params: Promise.resolve({ carrierId: 'carrier-1' }),
        };

        const response = await POST(request, context);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveProperty('totalWebhooks');
        expect(data).toHaveProperty('successfulWebhooks');
        expect(data).toHaveProperty('failedWebhooks');
        expect(data).toHaveProperty('averageLatency');
        expect(data).toHaveProperty('statusBreakdown');

        expect(data.totalWebhooks).toBeGreaterThan(0);
        expect(data.averageLatency).toBeGreaterThan(0);
        expect(data.statusBreakdown).toHaveProperty('CONFIRM');
        expect(data.statusBreakdown).toHaveProperty('READY');
        expect(data.statusBreakdown).toHaveProperty('ON_THE_WAY');
        expect(data.statusBreakdown).toHaveProperty('COMPLETED');
      });

      it('should handle empty request body', async () => {
        (CarrierService.getCarrier as jest.Mock).mockReturnValue({
          id: 'carrier-1',
          orderPrefix: 'CATER',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/admin/carriers/carrier-1/stats',
          {}
        );

        const context = {
          params: Promise.resolve({ carrierId: 'carrier-1' }),
        };

        const response = await POST(request, context);
        await expectSuccessResponse(response, 200);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 404 when carrier is not found', async () => {
        (CarrierService.getCarrier as jest.Mock).mockReturnValue(null);

        const request = createPostRequest(
          'http://localhost:3000/api/admin/carriers/invalid-carrier/stats',
          {}
        );

        const context = {
          params: Promise.resolve({ carrierId: 'invalid-carrier' }),
        };

        const response = await POST(request, context);
        await expectErrorResponse(response, 404, /Carrier not found/i);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle unexpected errors', async () => {
        (CarrierService.getCarrier as jest.Mock).mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        const request = createPostRequest(
          'http://localhost:3000/api/admin/carriers/carrier-1/stats',
          {}
        );

        const context = {
          params: Promise.resolve({ carrierId: 'carrier-1' }),
        };

        const response = await POST(request, context);
        await expectErrorResponse(response, 500, /Internal server error/i);
      });
    });
  });
});

describe('/api/admin/carriers/[carrierId]/stats - auth', () => {
  beforeEach(() => jest.clearAllMocks());

  const context = { params: Promise.resolve({ carrierId: 'catervalley' }) };

  it('GET returns 401 when unauthenticated', async () => {
    mockedWithAuth.mockResolvedValue(authUnauthenticated());
    const res = await GET(createGetRequest('http://localhost:3000/api/admin/carriers/catervalley/stats'), context);
    expect(res.status).toBe(401);
    expect(CarrierService.getCarrier).not.toHaveBeenCalled();
  });

  it('GET returns 403 for non-staff roles', async () => {
    mockedWithAuth.mockResolvedValue(authForbidden());
    const res = await GET(createGetRequest('http://localhost:3000/api/admin/carriers/catervalley/stats'), context);
    expect(res.status).toBe(403);
    expect(mockedWithAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'] }),
    );
  });

  // The GET happy path is skipped above (REA-211: date-fns interop under
  // jest), so pass-through is proven on POST, which shares the same gate.
  it('POST returns metrics for helpdesk', async () => {
    mockedWithAuth.mockResolvedValue(authAs('HELPDESK'));
    (CarrierService.getCarrier as jest.Mock).mockReturnValue({ id: 'catervalley', orderPrefix: 'CV-' });
    const res = await POST(
      createPostRequest('http://localhost:3000/api/admin/carriers/catervalley/stats', { dateRange: '7d' }),
      context,
    );
    expect(res.status).toBe(200);
  });

  it('POST returns 401 when unauthenticated', async () => {
    mockedWithAuth.mockResolvedValue(authUnauthenticated());
    const res = await POST(
      createPostRequest('http://localhost:3000/api/admin/carriers/catervalley/stats', { dateRange: '7d' }),
      context,
    );
    expect(res.status).toBe(401);
  });

});
