// src/__tests__/api/cater-valley/orders-confirm.test.ts

import { POST } from '@/app/api/cater-valley/orders/confirm/route';
import { prisma } from '@/lib/db/prisma';
import { notifyOrderCreated } from '@/services/orders/notifyOrderCreated';
import { recordAndDispatchLifecycleEvent } from '@/lib/services/partnerWebhookService';
import { runAfterResponse } from '@/lib/api/after-response';
import {
  createPostRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => {
  const mockPrisma: any = {
    cateringRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    orderStatusHistory: {
      create: jest.fn(async () => ({ id: 'hist-confirmed' })),
    },
  };
  // The transaction hands the callback the same mock client.
  mockPrisma.$transaction = jest.fn((callback: (tx: any) => unknown) => callback(mockPrisma));
  return { prisma: mockPrisma };
});

jest.mock('@/services/orders/notifyOrderCreated');
jest.mock('@/lib/services/partnerWebhookService', () => ({
  recordAndDispatchLifecycleEvent: jest.fn(async () => undefined),
}));
jest.mock('@/lib/api/after-response', () => ({
  runAfterResponse: jest.fn((_label: string, work: () => Promise<unknown>) => { void work(); }),
}));

jest.mock('@/lib/services/partner-registry', () => ({
  authenticatePartner: jest.fn(async (req: Request) => {
    const slug = req.headers.get('partner');
    const apiKey = req.headers.get('x-api-key');
    if (!slug) return { ok: false, reason: 'missing_partner_header' };
    if (!apiKey) return { ok: false, reason: 'missing_api_key' };
    if (slug === 'catervalley' && apiKey === 'test-api-key') {
      return {
        ok: true,
        partner: {
          id: 'partner-cv-id',
          slug: 'catervalley',
          displayName: 'CaterValley',
          orderPrefix: 'CV-',
          webhookUrl: null,
          webhookSecret: null,
          rateLimitPerMin: 100,
          isActive: true,
        },
      };
    }
    return { ok: false, reason: 'invalid_key' };
  }),
  getPartnerBySlug: jest.fn(),
  computeApiKeyHash: jest.fn((k: string) => `hash:${k}`),
  _resetPartnerCacheForTests: jest.fn(),
}));

describe('POST /api/cater-valley/orders/confirm - Confirm/Cancel Order', () => {
  const mockOrder = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    orderNumber: 'CV-TEST-001',
    status: 'ACTIVE',
    pickupDateTime: new Date('2025-10-25T13:15:00Z'),
    user: {
      id: 'user-1',
      email: 'system@catervalley.com',
    },
    pickupAddress: { id: 'addr-1' },
    deliveryAddress: { id: 'addr-2' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CATERVALLEY_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.CATERVALLEY_API_KEY;
  });

  describe('✅ Successful Confirmation', () => {
    it('should confirm order successfully', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CONFIRMED',
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: true,
        }),
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.status).toBe('CONFIRMED');
      expect(data.id).toBe(mockOrder.id);
      expect(data.orderNumber).toBe('CV-TEST-001');
      expect(data.message).toContain('confirmed');
      expect(data.estimatedDeliveryTime).toBeDefined();
      expect(data.driverAssignment).toBeDefined();
      expect(data.driverAssignment.trackingAvailable).toBe(true);

      // Admin notification dispatched on confirm with partner_api source
      expect(notifyOrderCreated).toHaveBeenCalledWith({
        orderId: mockOrder.id,
        orderType: 'catering',
        source: 'partner_api',
      });
    });

    it('should update order status to CONFIRMED', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CONFIRMED',
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: true,
        }),
      });

      await POST(request);

      expect(prisma.cateringRequest.update).toHaveBeenCalledWith({
        where: { id: mockOrder.id },
        data: {
          status: 'CONFIRMED',
          updatedAt: expect.any(Date),
        },
        include: {
          pickupAddress: true,
          deliveryAddress: true,
        },
      });
    });

    it('should provide estimated delivery time', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CONFIRMED',
        pickupDateTime: new Date('2025-10-25T13:15:00Z'),
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: true,
        }),
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.estimatedDeliveryTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('✅ Successful Cancellation', () => {
    it('should cancel order successfully', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: false,
          reason: 'Customer request',
        }),
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.status).toBe('CANCELLED');
      expect(data.message).toContain('cancelled');

      // Admin notification must NOT fire on cancellation
      expect(notifyOrderCreated).not.toHaveBeenCalled();
    });

    it('sends the CANCELLED webhook after the response, not inline', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });
      const deferred: Array<() => Promise<unknown>> = [];
      (runAfterResponse as jest.Mock).mockImplementation((_label, work) => {
        deferred.push(work);
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({ id: mockOrder.id, isAccepted: false, reason: 'Customer request' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      // The partner's server never sits on our response path.
      expect(recordAndDispatchLifecycleEvent).not.toHaveBeenCalled();

      await Promise.all(deferred.map((work) => work()));
      expect(recordAndDispatchLifecycleEvent).toHaveBeenCalledWith({
        orderId: mockOrder.id,
        orderNumber: 'CV-TEST-001',
        partnerStatus: 'CANCELLED',
        notes: 'Customer request',
      });
      (runAfterResponse as jest.Mock).mockImplementation((_label, work) => {
        void work();
      });
    });

    it('should append cancellation reason to notes', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        specialNotes: 'Existing notes',
      });
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: false,
          reason: 'Out of stock',
        }),
      });

      await POST(request);

      expect(prisma.cateringRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            specialNotes: expect.stringContaining('Cancellation reason: Out of stock'),
          }),
        })
      );
    });

    it('should cancel without reason', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: false,
        }),
      });

      const response = await POST(request);
      await expectSuccessResponse(response, 200);
    });
  });

  describe('🔐 Authentication', () => {
    it('should reject without partner header', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: true,
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 401, /Unauthorized/i);
    });

    it('should reject with wrong API key', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'wrong-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: true,
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 401, /Unauthorized/i);
    });
  });

  describe('❌ Validation Errors', () => {
    it('should reject invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: 'invalid json{',
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Invalid JSON/i);
    });

    it('should reject invalid UUID format', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: 'not-a-uuid',
          isAccepted: true,
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Validation failed|Invalid order ID format/i);
    });

    it('should reject missing isAccepted field', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Validation failed/i);
    });
  });

  describe('❌ Business Logic Errors', () => {
    it('should return 404 for non-existent order', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: true,
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 404, /Order not found/i);
    });

    it('should reject non-CaterValley orders', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        orderNumber: 'REG-001',
        user: { email: 'regular@user.com' },
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: true,
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 403, /cannot be confirmed via the partner API/i);
    });

    it('should reject orders not in confirmable state', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'COMPLETED',
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: true,
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 422, /cannot be confirmed in current status/i);
    });

    const orderWithHistory = (rows: Array<{ id: string; partnerStatus: string }>) => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockImplementation(async (args: any) => {
        const probe = args?.include?.statusHistory;
        const wanted = probe?.where?.partnerStatus;
        const matching = rows.filter((r) => !wanted || r.partnerStatus === wanted);
        return {
          ...mockOrder,
          statusHistory: probe ? matching.slice(0, probe.take ?? matching.length) : undefined,
        };
      });
    };
    const confirmRequest = (isAccepted: boolean) =>
      new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({ id: mockOrder.id, isAccepted }),
      });

    it.each([
      [true, 'CONFIRMED'],
      [false, 'CANCELLED'],
    ])(
      'still confirms a draft ops assigned a driver to before the partner confirmed (isAccepted=%s)',
      async (isAccepted, expected) => {
        // assignDriver wrote an ASSIGNED row; the order is still an ACTIVE draft.
        orderWithHistory([{ id: 'hist-a', partnerStatus: 'ASSIGNED' }]);
        (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
          ...mockOrder,
          status: expected,
        });

        const response = await POST(confirmRequest(isAccepted));
        const data = await expectSuccessResponse(response, 200);
        expect(data.status).toBe(expected);
      },
    );

    it.each([true, false])(
      'rejects a confirmed order that return-to-dispatch put back to ACTIVE (isAccepted=%s)',
      async (isAccepted) => {
        orderWithHistory([
          { id: 'hist-a', partnerStatus: 'ASSIGNED' },
          { id: 'hist-c', partnerStatus: 'CONFIRMED' },
        ]);

        const response = await POST(confirmRequest(isAccepted));
        await expectErrorResponse(response, 422, /already been confirmed/i);
        expect(prisma.cateringRequest.update).not.toHaveBeenCalled();
      },
    );

    it('records a CONFIRMED history row with the status update and sends no webhook', async () => {
      orderWithHistory([]);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CONFIRMED',
      });

      const response = await POST(confirmRequest(true));

      expect(response.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledTimes(1);
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: {
          cateringRequestId: mockOrder.id,
          partnerStatus: 'CONFIRMED',
          driverStatus: null,
          changedBy: null,
        },
      });
      // A CONFIRMED event is ours to lock on, not a partner webhook.
      expect(recordAndDispatchLifecycleEvent).not.toHaveBeenCalled();
    });

    it('does not record a CONFIRMED row when the partner rejects the order', async () => {
      orderWithHistory([]);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      await POST(confirmRequest(false));

      expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
    });

    it('fails the confirm (500, retryable) when the CONFIRMED row cannot be written', async () => {
      orderWithHistory([]);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CONFIRMED',
      });
      (prisma.orderStatusHistory.create as jest.Mock).mockRejectedValueOnce(new Error('db down'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const response = await POST(confirmRequest(true));

      expect(response.status).toBe(500);
      expect(notifyOrderCreated).not.toHaveBeenCalled();
    });

    it('should handle database update errors', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.cateringRequest.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: true,
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 500, /Internal server error|failed to confirm order/i);
    });
  });

  describe('📊 Edge Cases', () => {
    it('should accept order in PENDING status', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'PENDING',
      });
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CONFIRMED',
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: true,
        }),
      });

      const response = await POST(request);
      await expectSuccessResponse(response, 200);
    });

    it('should handle order without pickup time', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CONFIRMED',
        pickupDateTime: null,
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: true,
        }),
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.estimatedDeliveryTime).toBeUndefined();
    });

    it('should include metadata in request', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CONFIRMED',
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({
          id: mockOrder.id,
          isAccepted: true,
          metadata: { source: 'web', version: '2.0' },
        }),
      });

      const response = await POST(request);
      await expectSuccessResponse(response, 200);
    });
  });
});
