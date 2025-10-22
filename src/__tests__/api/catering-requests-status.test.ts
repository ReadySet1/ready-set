// src/__tests__/api/catering-requests-status.test.ts
// Tests for /api/catering-requests/[orderId]/status route

import { createGetRequest, createPatchRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    cateringRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    dispatch: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/carrierService', () => ({
  CarrierService: {
    sendStatusUpdate: jest.fn(),
    detectCarrier: jest.fn(),
  },
}));

jest.mock('@/lib/cache/cache-invalidation', () => ({
  invalidateVendorCacheOnStatusUpdate: jest.fn(),
}));

import { GET, PATCH } from '@/app/api/catering-requests/[orderId]/status/route';
import { prisma } from '@/lib/db/prisma';
import { CarrierService } from '@/lib/services/carrierService';
import { invalidateVendorCacheOnStatusUpdate } from '@/lib/cache/cache-invalidation';

describe('/api/catering-requests/[orderId]/status API', () => {
  const mockOrder = {
    id: 'order-123',
    orderNumber: 'CAT001',
    status: 'ACTIVE',
    driverStatus: null,
    userId: 'user-123',
    updatedAt: new Date('2025-01-15'),
    pickupDateTime: new Date('2025-01-20T10:00:00Z'),
    arrivalDateTime: new Date('2025-01-20T11:00:00Z'),
    completeDateTime: null,
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
    pickupAddress: {
      id: 'pickup-addr',
      street1: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
    },
    deliveryAddress: {
      id: 'delivery-addr',
      street1: '456 Oak Ave',
      city: 'San Francisco',
      state: 'CA',
    },
    dispatches: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/catering-requests/[orderId]/status', () => {
    it('should return order status', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        dispatches: [
          {
            id: 'dispatch-1',
            driverId: 'driver-123',
            createdAt: new Date('2025-01-15'),
            driver: {
              id: 'driver-123',
              name: 'John Driver',
              contactNumber: '555-0100',
            },
          },
        ],
      });

      const request = createGetRequest(
        'http://localhost:3000/api/catering-requests/order-123/status'
      );

      const response = await GET(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.order.id).toBe('order-123');
      expect(data.order.orderNumber).toBe('CAT001');
      expect(data.order.dispatches).toHaveLength(1);
    });

    it('should return 404 when order not found', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createGetRequest(
        'http://localhost:3000/api/catering-requests/nonexistent/status'
      );

      const response = await GET(request, {
        params: Promise.resolve({ orderId: 'nonexistent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Order not found');
    });

    it('should handle database errors', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = createGetRequest(
        'http://localhost:3000/api/catering-requests/order-123/status'
      );

      const response = await GET(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error - failed to fetch order status');
    });
  });

  describe('PATCH /api/catering-requests/[orderId]/status', () => {
    it('should update order status to ASSIGNED', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        driverStatus: 'ASSIGNED',
        updatedAt: new Date('2025-01-15T10:00:00Z'),
      });
      (prisma.dispatch.create as jest.Mock).mockResolvedValue({
        id: 'dispatch-1',
        cateringRequestId: 'order-123',
        driverId: 'driver-123',
      });
      (CarrierService.sendStatusUpdate as jest.Mock).mockResolvedValue(null);

      const request = createPatchRequest(
        'http://localhost:3000/api/catering-requests/order-123/status',
        {
          driverStatus: 'ASSIGNED',
          driverId: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID
        }
      );

      const response = await PATCH(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });
      const data = await response.json();

      if (response.status !== 200) {
        console.error('Test error response:', data);
      }

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.order.driverStatus).toBe('ASSIGNED');
      expect(data.message).toContain('successfully updated');
    });

    it('should create dispatch record when status is ASSIGNED', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        driverStatus: 'ASSIGNED',
      });
      (prisma.dispatch.create as jest.Mock).mockResolvedValue({
        id: 'dispatch-new',
        cateringRequestId: 'order-123',
        driverId: 'driver-456',
        userId: 'user-123',
      });
      (CarrierService.sendStatusUpdate as jest.Mock).mockResolvedValue(null);

      const request = createPatchRequest(
        'http://localhost:3000/api/catering-requests/order-123/status',
        {
          driverStatus: 'ASSIGNED',
          driverId: '660e8400-e29b-41d4-a716-446655440001', // Valid UUID
        }
      );

      await PATCH(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });

      expect(prisma.dispatch.create).toHaveBeenCalledWith({
        data: {
          cateringRequestId: 'order-123',
          driverId: '660e8400-e29b-41d4-a716-446655440001',
          userId: 'user-123',
        },
      });
    });

    it('should update status to COMPLETED and set completeDateTime', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        driverStatus: 'ARRIVED_TO_CLIENT',
      });
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        driverStatus: 'COMPLETED',
        status: 'COMPLETED',
        completeDateTime: new Date('2025-01-20T12:00:00Z'),
      });
      (CarrierService.sendStatusUpdate as jest.Mock).mockResolvedValue(null);

      const request = createPatchRequest(
        'http://localhost:3000/api/catering-requests/order-123/status',
        {
          driverStatus: 'COMPLETED',
        }
      );

      const response = await PATCH(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.order.driverStatus).toBe('COMPLETED');
      expect(data.order.status).toBe('COMPLETED');
    });

    it('should validate status transition rules', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        driverStatus: 'COMPLETED',
      });

      const request = createPatchRequest(
        'http://localhost:3000/api/catering-requests/order-123/status',
        {
          driverStatus: 'ASSIGNED',
        }
      );

      const response = await PATCH(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toContain('Cannot transition from COMPLETED');
    });

    it('should allow transitioning from ASSIGNED to ARRIVED_AT_VENDOR', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        driverStatus: 'ASSIGNED',
      });
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        driverStatus: 'ARRIVED_AT_VENDOR',
      });
      (CarrierService.sendStatusUpdate as jest.Mock).mockResolvedValue(null);

      const request = createPatchRequest(
        'http://localhost:3000/api/catering-requests/order-123/status',
        {
          driverStatus: 'ARRIVED_AT_VENDOR',
        }
      );

      const response = await PATCH(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });

      expect(response.status).toBe(200);
    });

    it('should return 404 when order not found', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createPatchRequest(
        'http://localhost:3000/api/catering-requests/nonexistent/status',
        {
          driverStatus: 'ASSIGNED',
        }
      );

      const response = await PATCH(request, {
        params: Promise.resolve({ orderId: 'nonexistent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Order not found');
    });

    it('should return 400 for invalid JSON', async () => {
      const request = new Request(
        'http://localhost:3000/api/catering-requests/order-123/status',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: '{invalid-json}',
        }
      );

      const response = await PATCH(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      // May return either invalid JSON error or validation error depending on JSON parsing
      expect([400]).toContain(response.status);
      expect(data.error).toBeDefined();
    });

    it('should validate driverStatus enum values', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const request = createPatchRequest(
        'http://localhost:3000/api/catering-requests/order-123/status',
        {
          driverStatus: 'INVALID_STATUS',
        }
      );

      const response = await PATCH(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should validate location coordinates when provided', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const request = createPatchRequest(
        'http://localhost:3000/api/catering-requests/order-123/status',
        {
          driverStatus: 'ASSIGNED',
          location: {
            latitude: 91, // Invalid: must be -90 to 90
            longitude: 0,
          },
        }
      );

      const response = await PATCH(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should send CaterValley webhook for CV- orders', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        orderNumber: 'CV-12345',
      });
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        orderNumber: 'CV-12345',
        driverStatus: 'ASSIGNED',
      });
      (CarrierService.sendStatusUpdate as jest.Mock).mockResolvedValue({
        success: true,
        carrierId: 'catervalley',
        attempts: 1,
        lastError: null,
      });

      const request = createPatchRequest(
        'http://localhost:3000/api/catering-requests/order-123/status',
        {
          driverStatus: 'ASSIGNED',
        }
      );

      const response = await PATCH(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.webhookResults?.caterValley).toEqual({
        success: true,
        attempts: 1,
        error: null,
      });
    });

    it('should handle webhook failures gracefully', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        orderNumber: 'CV-12345',
      });
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        orderNumber: 'CV-12345',
        driverStatus: 'ASSIGNED',
      });
      (CarrierService.sendStatusUpdate as jest.Mock).mockRejectedValue(
        new Error('Webhook timeout')
      );
      (CarrierService.detectCarrier as jest.Mock).mockReturnValue({
        id: 'catervalley',
        name: 'CaterValley',
      });

      const request = createPatchRequest(
        'http://localhost:3000/api/catering-requests/order-123/status',
        {
          driverStatus: 'ASSIGNED',
        }
      );

      const response = await PATCH(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.webhookResults?.caterValley).toEqual({
        success: false,
        attempts: 0,
        error: 'Webhook timeout',
      });
    });

    it('should invalidate vendor cache on status update', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        driverStatus: 'ASSIGNED',
      });
      (CarrierService.sendStatusUpdate as jest.Mock).mockResolvedValue(null);

      const request = createPatchRequest(
        'http://localhost:3000/api/catering-requests/order-123/status',
        {
          driverStatus: 'ASSIGNED',
        }
      );

      await PATCH(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });

      expect(invalidateVendorCacheOnStatusUpdate).toHaveBeenCalledWith(
        'user-123',
        'order-123'
      );
    });

    it('should handle database errors gracefully', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.cateringRequest.update as jest.Mock).mockRejectedValue(
        new Error('Record to update not found')
      );

      const request = createPatchRequest(
        'http://localhost:3000/api/catering-requests/order-123/status',
        {
          driverStatus: 'ASSIGNED',
        }
      );

      const response = await PATCH(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Order not found or has been deleted');
    });

    it('should return 500 for unexpected errors', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockRejectedValue(
        new Error('Unexpected database error')
      );

      const request = createPatchRequest(
        'http://localhost:3000/api/catering-requests/order-123/status',
        {
          driverStatus: 'ASSIGNED',
        }
      );

      const response = await PATCH(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error - failed to update order status');
    });
  });
});
