// src/__tests__/api/cater-valley/orders-confirm.test.ts

import { POST } from '@/app/api/cater-valley/orders/confirm/route';
import { prisma } from '@/lib/db/prisma';
import {
  createPostRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    cateringRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
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
      await expectErrorResponse(response, 403, /cannot be confirmed via CaterValley API/i);
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
