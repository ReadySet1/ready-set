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

import { NextRequest } from 'next/server';

// Import after mocks
import { prisma } from '@/utils/prismaDB';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { sendDispatchStatusNotification } from '@/services/notifications/delivery-status';

// Get mocked versions
const mockedPrisma = jest.mocked(prisma);
const mockedCreateClient = jest.mocked(createClient);
const mockedCreateAdminClient = jest.mocked(createAdminClient);
const mockedSendDispatchStatusNotification = jest.mocked(sendDispatchStatusNotification);

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
