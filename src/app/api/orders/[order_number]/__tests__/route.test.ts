/**
 * Integration tests for Orders API Route - Delivery Status Broadcast
 *
 * Tests that the PATCH endpoint correctly broadcasts delivery status updates
 * to the Supabase Realtime channel.
 *
 * Note: Due to Jest mock hoisting limitations, we use a setup file pattern
 * where the mocks are configured before each test.
 */

// Mock modules must be declared first (they get hoisted)
jest.mock('@/utils/prismaDB');
jest.mock('@/utils/supabase/server');
jest.mock('@/services/notifications/delivery-status', () => ({
  sendDispatchStatusNotification: jest.fn().mockResolvedValue(undefined),
}));
// Mock the partner webhook dispatcher so we can assert the orders PATCH wires
// it on driver-status transitions (the bug this guards: the #447 unification
// moved the driver flow onto this route and left the lifecycle emit orphaned
// on /api/catering-requests/[id]/status). The status map is hardcoded here to
// keep the route's `partnerLifecycle` lookup working without importing the real
// module's DB deps; its values are independently locked by
// src/__tests__/services/partnerWebhookService.test.ts.
jest.mock('@/lib/services/partnerWebhookService', () => ({
  recordAndDispatchLifecycleEvent: jest.fn().mockResolvedValue(undefined),
  DRIVER_STATUS_TO_PARTNER_LIFECYCLE: {
    ASSIGNED: 'ASSIGNED',
    EN_ROUTE_TO_VENDOR: null,
    ARRIVED_AT_VENDOR: null,
    PICKED_UP: 'PICKED_UP',
    EN_ROUTE_TO_CLIENT: 'ON_THE_WAY',
    ARRIVED_TO_CLIENT: 'ARRIVED',
    COMPLETED: 'DELIVERED',
  },
}));

import { NextRequest } from 'next/server';

// Import after mocks
import { prisma } from '@/utils/prismaDB';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { sendDispatchStatusNotification } from '@/services/notifications/delivery-status';
import { recordAndDispatchLifecycleEvent } from '@/lib/services/partnerWebhookService';

// Get mocked versions
const mockedPrisma = jest.mocked(prisma);
const mockedCreateClient = jest.mocked(createClient);
const mockedCreateAdminClient = jest.mocked(createAdminClient);
const mockedSendDispatchStatusNotification = jest.mocked(sendDispatchStatusNotification);
const mockedRecordLifecycle = jest.mocked(recordAndDispatchLifecycleEvent);

// Track calls to channel methods
let channelSendCalls: any[] = [];
let channelSubscribeCalls: any[] = [];
let removeChannelCalls: any[] = [];

// Helper to create a mock order
const createMockOrder = (overrides = {}) => ({
  id: 'order-123',
  orderNumber: 'CAT-001',
  status: 'ACTIVE',
  driverStatus: 'ASSIGNED',
  user: { name: 'Test User', email: 'test@example.com' },
  pickupAddress: { id: 'addr-1', street1: '123 Main St', city: 'SF', state: 'CA', zip: '94102' },
  deliveryAddress: { id: 'addr-2', street1: '456 Oak Ave', city: 'SF', state: 'CA', zip: '94103' },
  dispatches: [
    {
      id: 'dispatch-1',
      driver: {
        id: 'driver-456',
        name: 'John Driver',
        email: 'driver@example.com',
        contactNumber: '555-1234',
      },
    },
  ],
  fileUploads: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper to create NextRequest
const createPatchRequest = (body: object, orderNumber = 'CAT-001') => {
  return new NextRequest(`http://localhost:3000/api/orders/${orderNumber}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
};

// Setup mocks before importing route
const setupMocks = (orderOverrides = {}) => {
  // Reset tracking arrays
  channelSendCalls = [];
  channelSubscribeCalls = [];
  removeChannelCalls = [];

  const mockOrder = createMockOrder(orderOverrides);

  // Reset notification mock
  mockedSendDispatchStatusNotification.mockResolvedValue(undefined);

  // Mock Prisma
  (mockedPrisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(mockOrder);
  (mockedPrisma.cateringRequest.update as jest.Mock).mockResolvedValue(mockOrder);
  (mockedPrisma.onDemand.findFirst as jest.Mock).mockResolvedValue(null);

  // Mock createClient
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { type: 'ADMIN' },
        error: null,
      }),
    }),
  } as any);

  // Mock createAdminClient with tracking
  const mockChannel = {
    send: jest.fn().mockImplementation((data) => {
      channelSendCalls.push(data);
      return Promise.resolve('ok');
    }),
    subscribe: jest.fn().mockImplementation((callback) => {
      channelSubscribeCalls.push(callback);
      // Simulate async subscription by calling callback immediately
      // This resolves the Promise wrapper in the route
      callback('SUBSCRIBED');
      return mockChannel; // Return self for chaining
    }),
  };

  mockedCreateAdminClient.mockResolvedValue({
    channel: jest.fn().mockReturnValue(mockChannel),
    removeChannel: jest.fn().mockImplementation(() => {
      removeChannelCalls.push(true);
      return Promise.resolve();
    }),
  } as any);
};

describe('Orders API Route - Delivery Status Broadcast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  // Import route dynamically to ensure mocks are applied
  const importRoute = async () => {
    // Use require to get fresh import after mocks are setup
    const route = await import('../route');
    return route;
  };

  describe('PATCH with driverStatus', () => {
    it('should trigger broadcast when driverStatus is updated', async () => {
      // Realistic transition: ARRIVED_AT_VENDOR → EN_ROUTE_TO_CLIENT, with the
      // order already in IN_PROGRESS. The default fixture (ACTIVE + ASSIGNED)
      // would be rejected by the state machine.
      setupMocks({ status: 'IN_PROGRESS', driverStatus: 'ARRIVED_AT_VENDOR' });
      const { PATCH } = await importRoute();

      const request = createPatchRequest({ driverStatus: 'EN_ROUTE_TO_CLIENT' });
      const params = Promise.resolve({ order_number: 'CAT-001' });

      await PATCH(request, { params });

      // Give time for async broadcast
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify channel send was called
      expect(channelSendCalls.length).toBeGreaterThan(0);
      expect(channelSendCalls[0]).toMatchObject({
        type: 'broadcast',
        event: 'delivery:status:updated',
      });
    });

    it('should not trigger broadcast when driverStatus is not in request', async () => {
      const { PATCH } = await importRoute();

      const request = createPatchRequest({ status: 'IN_PROGRESS' });
      const params = Promise.resolve({ order_number: 'CAT-001' });

      await PATCH(request, { params });

      // Give time for any potential async broadcast
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Channel send should not have been called for delivery status
      const deliveryStatusSends = channelSendCalls.filter(
        (call) => call.event === 'delivery:status:updated'
      );
      expect(deliveryStatusSends.length).toBe(0);
    });

    it('should not fail API request if broadcast fails', async () => {
      // Setup all required mocks first
      setupMocks();

      // Override with failing channel send
      const failingChannel = {
        send: jest.fn().mockRejectedValue(new Error('Broadcast failed')),
        subscribe: jest.fn().mockImplementation((callback) => {
          callback('SUBSCRIBED');
          return failingChannel;
        }),
      };

      mockedCreateAdminClient.mockResolvedValue({
        channel: jest.fn().mockReturnValue(failingChannel),
        removeChannel: jest.fn().mockResolvedValue(undefined),
      } as any);

      const { PATCH } = await importRoute();

      const request = createPatchRequest({ driverStatus: 'COMPLETED' });
      const params = Promise.resolve({ order_number: 'CAT-001' });

      const response = await PATCH(request, { params });

      // Give time for async broadcast to fail (but not affect response)
      await new Promise((resolve) => setTimeout(resolve, 150));

      // API should still return success
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orderNumber).toBe('CAT-001');
    });
  });

  describe('Partner lifecycle webhook (registry partners, e.g. CaterCow)', () => {
    it('dispatches the partner lifecycle event on a client-leg driver transition', async () => {
      // CC- order, ARRIVED_AT_VENDOR → EN_ROUTE_TO_CLIENT (maps to ON_THE_WAY).
      setupMocks({
        orderNumber: 'CC-12345',
        status: 'IN_PROGRESS',
        driverStatus: 'ARRIVED_AT_VENDOR',
      });
      const { PATCH } = await importRoute();

      const request = createPatchRequest({ driverStatus: 'EN_ROUTE_TO_CLIENT' }, 'CC-12345');
      const params = Promise.resolve({ order_number: 'CC-12345' });

      const response = await PATCH(request, { params });
      expect(response.status).toBe(200);

      expect(mockedRecordLifecycle).toHaveBeenCalledTimes(1);
      expect(mockedRecordLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({
          orderNumber: 'CC-12345',
          partnerStatus: 'ON_THE_WAY',
          driverStatus: 'EN_ROUTE_TO_CLIENT',
          driver: { name: 'John Driver', phone: '555-1234' },
        }),
      );
    });

    it('does NOT dispatch on a vendor-leg transition (no partner-facing event)', async () => {
      // ASSIGNED → EN_ROUTE_TO_VENDOR maps to null — vendor-leg detail isn't
      // surfaced to partners, so no webhook should fire.
      setupMocks({ orderNumber: 'CC-12345', status: 'ACTIVE', driverStatus: 'ASSIGNED' });
      const { PATCH } = await importRoute();

      const request = createPatchRequest({ driverStatus: 'EN_ROUTE_TO_VENDOR' }, 'CC-12345');
      const params = Promise.resolve({ order_number: 'CC-12345' });

      await PATCH(request, { params });

      expect(mockedRecordLifecycle).not.toHaveBeenCalled();
    });

    it('does NOT dispatch on a status-only PATCH (no driverStatus)', async () => {
      setupMocks({ orderNumber: 'CC-12345', status: 'ACTIVE', driverStatus: 'ASSIGNED' });
      const { PATCH } = await importRoute();

      const request = createPatchRequest({ status: 'IN_PROGRESS' }, 'CC-12345');
      const params = Promise.resolve({ order_number: 'CC-12345' });

      await PATCH(request, { params });

      expect(mockedRecordLifecycle).not.toHaveBeenCalled();
    });

    it('does not fail the driver request if the partner dispatch rejects', async () => {
      // Fire-and-forget: even a thrown dispatch must not break the PATCH.
      setupMocks({
        orderNumber: 'CC-12345',
        status: 'IN_PROGRESS',
        driverStatus: 'ARRIVED_TO_CLIENT',
      });
      mockedRecordLifecycle.mockRejectedValueOnce(new Error('partner down'));
      const { PATCH } = await importRoute();

      const request = createPatchRequest({ driverStatus: 'COMPLETED' }, 'CC-12345');
      const params = Promise.resolve({ order_number: 'CC-12345' });

      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(mockedRecordLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({ partnerStatus: 'DELIVERED' }),
      );
    });
  });

  describe('Authorization', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockedCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: new Error('Not authenticated'),
          }),
        },
        from: jest.fn(),
      } as any);

      const { PATCH } = await importRoute();

      const request = createPatchRequest({ driverStatus: 'EN_ROUTE_TO_CLIENT' });
      const params = Promise.resolve({ order_number: 'CAT-001' });

      const response = await PATCH(request, { params });

      expect(response.status).toBe(401);
    });

    it('should return 404 if order not found', async () => {
      (mockedPrisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.onDemand.findFirst as jest.Mock).mockResolvedValue(null);

      const { PATCH } = await importRoute();

      const request = createPatchRequest({ driverStatus: 'EN_ROUTE_TO_CLIENT' });
      const params = Promise.resolve({ order_number: 'NONEXISTENT' });

      const response = await PATCH(request, { params });

      expect(response.status).toBe(404);
    });
  });

  describe('Status-changing PATCH authorization (IDOR)', () => {
    // Helper to mock the supabase auth client for a given caller. `userId` is the
    // authenticated user; `type` is their profile.type (drives the privileged
    // check); the profiles select/eq/single chain mirrors how the route resolves
    // the caller's role (supabase.from('profiles').select('type').eq('id', user.id).single()).
    const mockCaller = (userId: string, type: string) => {
      mockedCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { type },
            error: null,
          }),
        }),
      } as any);
    };

    it('returns 403 for a status-only PATCH from a non-assigned, non-privileged user (IDOR closed)', async () => {
      // Order is assigned to driver 'driver-456' via dispatch; caller is a
      // DIFFERENT driver. A bare { status: "COMPLETED" } previously skipped the
      // ownership check entirely — now it must be rejected.
      setupMocks({ status: 'IN_PROGRESS', driverStatus: 'ARRIVED_TO_CLIENT' });
      mockCaller('attacker-user-id', 'DRIVER');

      const { PATCH } = await importRoute();

      const request = createPatchRequest({ status: 'COMPLETED' });
      const params = Promise.resolve({ order_number: 'CAT-001' });

      const response = await PATCH(request, { params });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.message).toBe('You are not assigned to this delivery');
      // The order must never be updated when authorization fails.
      expect(mockedPrisma.cateringRequest.update).not.toHaveBeenCalled();
    });

    it('still allows the same status-only PATCH from a privileged (ADMIN) user', async () => {
      // Same body, same order — but an admin manages all orders, so the legit
      // completion path must keep working (proves the IDOR fix is not a blanket block).
      setupMocks({ status: 'IN_PROGRESS', driverStatus: 'ARRIVED_TO_CLIENT' });
      mockCaller('some-admin-id', 'ADMIN');

      const { PATCH } = await importRoute();

      const request = createPatchRequest({ status: 'COMPLETED' });
      const params = Promise.resolve({ order_number: 'CAT-001' });

      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orderNumber).toBe('CAT-001');
      expect(mockedPrisma.cateringRequest.update).toHaveBeenCalled();
    });

    it('still allows the same status-only PATCH from the assigned driver', async () => {
      // The driver client sends { status: "COMPLETED" } on completion; the
      // assigned driver (dispatch.driver.id === caller user id) must be allowed.
      setupMocks({ status: 'IN_PROGRESS', driverStatus: 'ARRIVED_TO_CLIENT' });
      mockCaller('driver-456', 'DRIVER');

      const { PATCH } = await importRoute();

      const request = createPatchRequest({ status: 'COMPLETED' });
      const params = Promise.resolve({ order_number: 'CAT-001' });

      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orderNumber).toBe('CAT-001');
      expect(mockedPrisma.cateringRequest.update).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle order without assigned driver', async () => {
      setupMocks({ dispatches: [] });

      const { PATCH } = await importRoute();

      const request = createPatchRequest({ driverStatus: 'ASSIGNED' });
      const params = Promise.resolve({ order_number: 'CAT-001' });

      const response = await PATCH(request, { params });

      // API should still succeed
      expect(response.status).toBe(200);

      // Give time for async operations
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Broadcast should not be sent without driver
      const deliveryStatusSends = channelSendCalls.filter(
        (call) => call.event === 'delivery:status:updated'
      );
      expect(deliveryStatusSends.length).toBe(0);
    });

    it('should return 400 when no update data provided', async () => {
      const { PATCH } = await importRoute();

      const request = createPatchRequest({});
      const params = Promise.resolve({ order_number: 'CAT-001' });

      const response = await PATCH(request, { params });

      expect(response.status).toBe(400);
    });
  });
});
