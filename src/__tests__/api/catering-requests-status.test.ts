// src/__tests__/api/catering-requests-status.test.ts
// Tests for /api/catering-requests/[orderId]/status route

import { createGetRequest, createPatchRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/lib/db/prisma', () => {
  const cateringRequest = {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  };
  const onDemand = {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  };
  const dispatch = { create: jest.fn() };
  const driver = { findFirst: jest.fn() };
  const mock = {
    cateringRequest,
    onDemand,
    dispatch,
    driver,
    // $transaction runs the callback synchronously against the same mock so
    // calls to tx.cateringRequest.update land on the same jest.fn instances.
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mock)),
  };
  return { prisma: mock };
});

jest.mock('@/lib/services/carrierService', () => ({
  CarrierService: {
    sendStatusUpdate: jest.fn(),
    detectCarrier: jest.fn(),
  },
}));

jest.mock('@/lib/cache/cache-invalidation', () => ({
  invalidateVendorCacheOnStatusUpdate: jest.fn(),
}));

jest.mock('@/lib/email-preferences', () => ({
  getEmailPreferencesForUser: jest.fn(async () => ({ deliveryNotifications: true })),
}));

jest.mock('@/services/notifications/email', () => ({
  sendDeliveryStatusEmail: jest.fn(async () => undefined),
}));

// The history-row position resolver is unit-tested on its own; here we only
// check WHOSE position the route asks for.
jest.mock('@/lib/services/status-history-location', () => ({
  ...jest.requireActual('@/lib/services/status-history-location'),
  resolveStatusHistoryLocation: jest.fn(async () => null),
}));

// Partner lifecycle recording is unit-tested on its own; here we only check
// the `changedBy` the route hands it.
jest.mock('@/lib/services/partnerWebhookService', () => ({
  ...jest.requireActual('@/lib/services/partnerWebhookService'),
  recordAndDispatchLifecycleEvent: jest.fn(async () => undefined),
}));

// Post-response work runs inline by default; a test can capture it instead.
jest.mock('@/lib/api/after-response', () => ({
  runAfterResponse: jest.fn((_label: string, work: () => Promise<unknown>) => {
    void work();
  }),
}));

import { GET, PATCH } from '@/app/api/catering-requests/[orderId]/status/route';
import { runAfterResponse } from '@/lib/api/after-response';
import { resolveStatusHistoryLocation } from '@/lib/services/status-history-location';
import { recordAndDispatchLifecycleEvent } from '@/lib/services/partnerWebhookService';
import { prisma } from '@/lib/db/prisma';
import { CarrierService } from '@/lib/services/carrierService';
import { invalidateVendorCacheOnStatusUpdate } from '@/lib/cache/cache-invalidation';
import { sendDeliveryStatusEmail } from '@/services/notifications/email';

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
    // Default findUniqueOrThrow: returns whatever the most-recent update call
    // produced — mirrors the route reading the "after" row from the same tx.
    (prisma.cateringRequest.findUniqueOrThrow as jest.Mock).mockImplementation(
      async () => {
        const results = (prisma.cateringRequest.update as jest.Mock).mock.results;
        const last = results[results.length - 1]?.value;
        return last ?? mockOrder;
      },
    );
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

    it('should return 404 for a soft-deleted order', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        deletedAt: new Date('2026-10-06T12:00:00Z'),
      });

      const request = createGetRequest(
        'http://localhost:3000/api/catering-requests/order-123/status'
      );

      const response = await GET(request, {
        params: Promise.resolve({ orderId: 'order-123' }),
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
        status: 'IN_PROGRESS',
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

    it('emails the customer a tracking link to the public order-status page', async () => {
      // The customer-facing tracking page lives at /order-status/<order_number>;
      // /orders/<order_number> does not exist and 404s from the email footer.
      const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      process.env.NEXT_PUBLIC_SITE_URL = 'https://readysetllc.com';
      try {
        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
          ...mockOrder,
          status: 'IN_PROGRESS',
          driverStatus: 'ARRIVED_TO_CLIENT',
        });
        (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
          ...mockOrder,
          orderNumber: 'CV-46NF6X/1',
          driverStatus: 'COMPLETED',
          status: 'COMPLETED',
          completeDateTime: new Date('2025-01-20T12:00:00Z'),
        });
        (CarrierService.sendStatusUpdate as jest.Mock).mockResolvedValue(null);

        const request = createPatchRequest(
          'http://localhost:3000/api/catering-requests/order-123/status',
          { driverStatus: 'COMPLETED' }
        );
        const response = await PATCH(request, {
          params: Promise.resolve({ orderId: 'order-123' }),
        });

        expect(response.status).toBe(200);
        expect(sendDeliveryStatusEmail).toHaveBeenCalledTimes(1);
        const { details } = (sendDeliveryStatusEmail as jest.Mock).mock.calls[0][0];
        expect(details.trackingLink).toBe(
          'https://readysetllc.com/order-status/CV-46NF6X%2F1'
        );
        expect(details.trackingLink).not.toContain('/orders/');
      } finally {
        process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
      }
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
        status: 'ASSIGNED',
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

    it('should return 404 for a soft-deleted order and change nothing', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        deletedAt: new Date('2026-10-06T12:00:00Z'),
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

      expect(response.status).toBe(404);
      expect(data.error).toBe('Order not found');
      expect(prisma.cateringRequest.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
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

    // TODO: REA-211 - CarrierService mock not being called correctly in route
    it.skip('should send CaterValley webhook for CV- orders', async () => {
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

    // TODO: REA-211 - CarrierService mock not being called correctly in route
    it.skip('should handle webhook failures gracefully', async () => {
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

describe('/api/catering-requests/[orderId]/status - auth', () => {
  beforeEach(() => jest.clearAllMocks());
  const context = { params: Promise.resolve({ orderId: 'order-123' }) };
  const order = {
    id: 'order-123',
    orderNumber: 'CV-1',
    status: 'ACTIVE',
    driverStatus: null,
    userId: 'client-1',
    user: { email: 'c@example.com', name: 'C' },
    pickupAddress: null,
    deliveryAddress: null,
    dispatches: [{ id: 'd-1', driverId: 'driver-1', driver: { id: 'driver-1', name: 'D', contactNumber: '555' } }],
  };
  const patchRequest = () =>
    createPatchRequest('http://localhost:3000/api/catering-requests/order-123/status', {
      driverStatus: 'ASSIGNED',
    });
  const getRequest = () => createGetRequest('http://localhost:3000/api/catering-requests/order-123/status');

  beforeEach(() => {
    (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(order);
    (prisma.cateringRequest.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      ...order,
      driverStatus: 'ASSIGNED',
      updatedAt: new Date(),
    });
    (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({ ...order, driverStatus: 'ASSIGNED', updatedAt: new Date() });
  });

  it('PATCH returns 401 when unauthenticated', async () => {
    mockedWithAuth.mockResolvedValue(authUnauthenticated());
    const res = await PATCH(patchRequest(), context);
    expect(res.status).toBe(401);
    expect(prisma.cateringRequest.findUnique).not.toHaveBeenCalled();
  });

  it('PATCH returns 403 for roles outside staff + driver', async () => {
    mockedWithAuth.mockResolvedValue(authForbidden());
    const res = await PATCH(patchRequest(), context);
    expect(res.status).toBe(403);
    expect(mockedWithAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'HELPDESK', 'DRIVER'] }),
    );
  });

  it('PATCH returns 403 for a driver not assigned to the order', async () => {
    mockedWithAuth.mockResolvedValue(authAs('DRIVER', 'driver-2'));
    const res = await PATCH(patchRequest(), context);
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('PATCH lets the assigned driver update', async () => {
    mockedWithAuth.mockResolvedValue(authAs('DRIVER', 'driver-1'));
    // Drivers can't send ASSIGNED (staff-only); they advance an assigned order.
    (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
      ...order,
      status: 'ASSIGNED',
      driverStatus: 'ASSIGNED',
    });
    const res = await PATCH(
      createPatchRequest('http://localhost:3000/api/catering-requests/order-123/status', {
        driverStatus: 'ARRIVED_AT_VENDOR',
      }),
      context,
    );
    expect(res.status).toBe(200);
  });

  it('PATCH lets helpdesk update', async () => {
    mockedWithAuth.mockResolvedValue(authAs('HELPDESK'));
    const res = await PATCH(patchRequest(), context);
    expect(res.status).toBe(200);
  });

  it('GET returns 401 when unauthenticated', async () => {
    mockedWithAuth.mockResolvedValue(authUnauthenticated());
    const res = await GET(getRequest(), context);
    expect(res.status).toBe(401);
  });

  it('GET returns 403 for a driver not assigned to the order', async () => {
    mockedWithAuth.mockResolvedValue(authAs('DRIVER', 'driver-2'));
    const res = await GET(getRequest(), context);
    expect(res.status).toBe(403);
  });

  it('GET returns the order to the assigned driver', async () => {
    mockedWithAuth.mockResolvedValue(authAs('DRIVER', 'driver-1'));
    const res = await GET(getRequest(), context);
    expect(res.status).toBe(200);
  });
});

describe('/api/catering-requests/[orderId]/status - history-row position driver', () => {
  const OTHER_DRIVER = '22222222-2222-4222-8222-222222222222';
  const ASSIGNEE = '33333333-3333-4333-8333-333333333333';
  const context = { params: Promise.resolve({ orderId: 'order-123' }) };
  const mockedResolve = jest.mocked(resolveStatusHistoryLocation);
  const orderAt = (driverStatus: string | null) => ({
    id: 'order-123',
    orderNumber: 'CAT-9',
    status: driverStatus ? 'IN_PROGRESS' : 'ACTIVE',
    driverStatus,
    userId: 'client-1',
    user: { email: 'c@example.com', name: 'C' },
    pickupAddress: null,
    deliveryAddress: null,
    dispatches: [
      {
        id: 'd-1',
        driverId: 'driver-1',
        createdAt: new Date('2026-11-01T10:00:00Z'),
        driver: { id: 'driver-1', name: 'D', contactNumber: '555' },
      },
    ],
  });
  const arrange = (driverStatus: string | null) => {
    const order = orderAt(driverStatus);
    (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(order);
    (prisma.cateringRequest.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      ...order,
      updatedAt: new Date(),
    });
  };
  const patch = (body: object) =>
    PATCH(
      createPatchRequest('http://localhost:3000/api/catering-requests/order-123/status', body),
      context,
    );

  beforeEach(() => jest.clearAllMocks());

  it("a driver cannot get ANOTHER driver's position written by naming them in the body", async () => {
    mockedWithAuth.mockResolvedValue(authAs('DRIVER', 'driver-1'));
    arrange('ARRIVED_AT_VENDOR');

    const res = await patch({ driverStatus: 'PICKED_UP', driverId: OTHER_DRIVER });

    expect(res.status).toBe(200);
    expect(mockedResolve).toHaveBeenCalledTimes(1);
    expect(mockedResolve.mock.calls[0]![0].driverProfileId).toBe('driver-1');
  });

  it("staff: the order's dispatched driver, not the body driverId, outside ASSIGNED", async () => {
    mockedWithAuth.mockResolvedValue(authAs('ADMIN'));
    arrange('ARRIVED_AT_VENDOR');

    await patch({ driverStatus: 'PICKED_UP', driverId: OTHER_DRIVER });

    expect(mockedResolve.mock.calls[0]![0].driverProfileId).toBe('driver-1');
  });

  it('staff: the body driverId is used on an ASSIGNED call (the driver being assigned)', async () => {
    mockedWithAuth.mockResolvedValue(authAs('ADMIN'));
    arrange(null);

    await patch({ driverStatus: 'ASSIGNED', driverId: ASSIGNEE });

    expect(mockedResolve.mock.calls[0]![0].driverProfileId).toBe(ASSIGNEE);
  });
});

describe('/api/catering-requests/[orderId]/status - a driver acts only as themselves', () => {
  const ASSIGNED_DRIVER = '11111111-1111-4111-8111-111111111111';
  const OTHER_DRIVER = '22222222-2222-4222-8222-222222222222';
  const ASSIGNEE = '33333333-3333-4333-8333-333333333333';
  const context = { params: Promise.resolve({ orderId: 'order-123' }) };
  const mockedRecord = jest.mocked(recordAndDispatchLifecycleEvent);
  const arrange = (driverStatus: string | null) => {
    const order = {
      id: 'order-123',
      orderNumber: 'CAT-9',
      status: driverStatus ? 'IN_PROGRESS' : 'ACTIVE',
      driverStatus,
      userId: 'client-1',
      user: { email: 'c@example.com', name: 'C' },
      pickupAddress: null,
      deliveryAddress: null,
      dispatches: [
        {
          id: 'd-1',
          driverId: ASSIGNED_DRIVER,
          createdAt: new Date('2026-11-01T10:00:00Z'),
          driver: { id: ASSIGNED_DRIVER, name: 'D', contactNumber: '555' },
        },
      ],
    };
    (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(order);
    (prisma.cateringRequest.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      ...order,
      updatedAt: new Date(),
    });
  };
  const patch = (body: object) =>
    PATCH(
      createPatchRequest('http://localhost:3000/api/catering-requests/order-123/status', body),
      context,
    );

  beforeEach(() => jest.clearAllMocks());

  it('records the calling driver as changedBy, ignoring a body driverId naming someone else', async () => {
    mockedWithAuth.mockResolvedValue(authAs('DRIVER', ASSIGNED_DRIVER));
    arrange('ARRIVED_AT_VENDOR');

    const res = await patch({ driverStatus: 'PICKED_UP', driverId: OTHER_DRIVER });

    expect(res.status).toBe(200);
    expect(mockedRecord).toHaveBeenCalledTimes(1);
    expect(mockedRecord.mock.calls[0]![0].changedBy).toBe(ASSIGNED_DRIVER);
  });

  it('rejects a driver ASSIGNED call that names another driver, without assigning anyone', async () => {
    mockedWithAuth.mockResolvedValue(authAs('DRIVER', ASSIGNED_DRIVER));
    arrange(null);

    const res = await patch({ driverStatus: 'ASSIGNED', driverId: OTHER_DRIVER });

    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.dispatch.create).not.toHaveBeenCalled();
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it('rejects a driver ASSIGNED call even without a body driverId (assignment is staff-only)', async () => {
    mockedWithAuth.mockResolvedValue(authAs('DRIVER', ASSIGNED_DRIVER));
    arrange(null);

    const res = await patch({ driverStatus: 'ASSIGNED' });

    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.dispatch.create).not.toHaveBeenCalled();
  });

  it('rejects a driver on an order they are not dispatched to, even naming themselves', async () => {
    mockedWithAuth.mockResolvedValue(authAs('DRIVER', OTHER_DRIVER));
    arrange('ARRIVED_AT_VENDOR');

    const res = await patch({ driverStatus: 'PICKED_UP', driverId: OTHER_DRIVER });

    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it('staff ASSIGNED still assigns the body driver and records them as changedBy', async () => {
    mockedWithAuth.mockResolvedValue(authAs('ADMIN'));
    arrange(null);

    const res = await patch({ driverStatus: 'ASSIGNED', driverId: ASSIGNEE });

    expect(res.status).toBe(200);
    expect(prisma.dispatch.create).toHaveBeenCalledWith({
      data: { cateringRequestId: 'order-123', driverId: ASSIGNEE, userId: 'client-1' },
    });
    expect(mockedRecord.mock.calls[0]![0].changedBy).toBe(ASSIGNEE);
  });

  it('dispatches the partner lifecycle event after the response, not inline', async () => {
    mockedWithAuth.mockResolvedValue(authAs('DRIVER', ASSIGNED_DRIVER));
    arrange('ARRIVED_AT_VENDOR');
    const deferred: Array<() => Promise<unknown>> = [];
    (runAfterResponse as jest.Mock).mockImplementationOnce((_label, work) => {
      deferred.push(work);
    });

    const res = await patch({ driverStatus: 'PICKED_UP' });

    expect(res.status).toBe(200);
    expect(mockedRecord).not.toHaveBeenCalled();
    await Promise.all(deferred.map((work) => work()));
    expect(mockedRecord).toHaveBeenCalledTimes(1);
    expect(mockedRecord.mock.calls[0]![0].partnerStatus).toBe('PICKED_UP');
  });

  it('does not emit a partner event again when the driver re-sends the status they hold', async () => {
    mockedWithAuth.mockResolvedValue(authAs('DRIVER', ASSIGNED_DRIVER));
    arrange('PICKED_UP');

    const res = await patch({ driverStatus: 'PICKED_UP' });

    expect(res.status).toBe(200);
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it('staff re-assigning an ASSIGNED order still emits ASSIGNED (new driver)', async () => {
    mockedWithAuth.mockResolvedValue(authAs('ADMIN'));
    arrange('ASSIGNED');

    const res = await patch({ driverStatus: 'ASSIGNED', driverId: ASSIGNEE });

    expect(res.status).toBe(200);
    expect(mockedRecord).toHaveBeenCalledTimes(1);
    expect(mockedRecord.mock.calls[0]![0].partnerStatus).toBe('ASSIGNED');
  });

  it('staff outside ASSIGNED keep the body driverId as changedBy (unchanged behavior)', async () => {
    mockedWithAuth.mockResolvedValue(authAs('HELPDESK'));
    arrange('ARRIVED_AT_VENDOR');

    const res = await patch({ driverStatus: 'PICKED_UP', driverId: OTHER_DRIVER });

    expect(res.status).toBe(200);
    expect(mockedRecord.mock.calls[0]![0].changedBy).toBe(OTHER_DRIVER);
    expect(prisma.dispatch.create).not.toHaveBeenCalled();
  });
});
