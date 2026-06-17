/**
 * Regression tests for Orders API PATCH — delivery completion.
 *
 * Covers the walk-test bug fixes:
 *  1. `completeDateTime` is stamped when the order reaches a completed state
 *     (driverStatus=COMPLETED or status=COMPLETED), so the driver feed (which
 *     treats "active" as completeDateTime IS NULL) stops showing finished
 *     deliveries as active.
 *  2. The `deliveries` mirror upsert sets `status` on the UPDATE branch (not
 *     just on create), so the admin deliveries view doesn't drift from the
 *     order's driverStatus.
 *
 * Mocking mirrors the sibling route.test.ts (auto-mocked prisma + supabase).
 */

jest.mock('@/utils/prismaDB');
jest.mock('@/utils/supabase/server');
jest.mock('@/services/notifications/delivery-status', () => ({
  sendDispatchStatusNotification: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from 'next/server';
import { prisma } from '@/utils/prismaDB';
import { createClient, createAdminClient } from '@/utils/supabase/server';

const mockedPrisma = jest.mocked(prisma);
const mockedCreateClient = jest.mocked(createClient);
const mockedCreateAdminClient = jest.mocked(createAdminClient);

// An order already at ARRIVED_TO_CLIENT, so the COMPLETED transition is legal
// per the state machine and `completeDateTime` is not yet set.
const createMockOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-123',
  orderNumber: 'CAT-001',
  status: 'IN_PROGRESS',
  driverStatus: 'ARRIVED_TO_CLIENT',
  completeDateTime: null,
  user: { name: 'Test User', email: 'test@example.com' },
  pickupAddress: { id: 'addr-1', street1: '123 Main St' },
  deliveryAddress: { id: 'addr-2', street1: '456 Oak Ave' },
  dispatches: [
    {
      id: 'dispatch-1',
      driver: { id: 'driver-456', name: 'John Driver', email: 'd@e.com', contactNumber: '555' },
    },
  ],
  fileUploads: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createPatchRequest = (body: object, orderNumber = 'CAT-001') =>
  new NextRequest(`http://localhost:3000/api/orders/${orderNumber}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

const setupMocks = (orderOverrides: Record<string, unknown> = {}) => {
  const mockOrder = createMockOrder(orderOverrides);

  (mockedPrisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(mockOrder);
  (mockedPrisma.cateringRequest.update as jest.Mock).mockImplementation(
    ({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...mockOrder, ...data }),
  );
  (mockedPrisma.onDemand.findFirst as jest.Mock).mockResolvedValue(null);
  // Delivery side-effects used by the completion path.
  (mockedPrisma.driver.findFirst as jest.Mock).mockResolvedValue({ id: 'delivery-driver-1' });
  (mockedPrisma.delivery.upsert as jest.Mock).mockResolvedValue({});
  (mockedPrisma.delivery.findFirst as jest.Mock).mockResolvedValue(null);

  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { type: 'ADMIN' }, error: null }),
    }),
  } as any);

  // Admin client: a no-op channel so the broadcast doesn't reject.
  const mockChannel = {
    send: jest.fn().mockResolvedValue('ok'),
    subscribe: jest.fn().mockImplementation((cb: (s: string) => void) => {
      cb('SUBSCRIBED');
      return mockChannel;
    }),
  };
  mockedCreateAdminClient.mockResolvedValue({
    channel: jest.fn().mockReturnValue(mockChannel),
    removeChannel: jest.fn().mockResolvedValue(undefined),
  } as any);
};

const importRoute = async () => import('../route');

describe('Orders API PATCH — completion regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('stamps completeDateTime when driverStatus transitions to COMPLETED', async () => {
    const { PATCH } = await importRoute();

    await PATCH(createPatchRequest({ driverStatus: 'COMPLETED' }), {
      params: Promise.resolve({ order_number: 'CAT-001' }),
    });

    const updateCall = (mockedPrisma.cateringRequest.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.driverStatus).toBe('COMPLETED');
    // The headline fix: completeDateTime must be set on completion.
    expect(updateCall.data.completeDateTime).toBeInstanceOf(Date);
    // And the derived order status should be COMPLETED.
    expect(updateCall.data.status).toBe('COMPLETED');
  });

  it('stamps completeDateTime on an explicit status=COMPLETED follow-up PATCH', async () => {
    // Order already COMPLETED on driverStatus but completeDateTime never set
    // (historical-data shape). A status=COMPLETED PATCH must backfill it.
    setupMocks({ driverStatus: 'COMPLETED', status: 'COMPLETED', completeDateTime: null });
    const { PATCH } = await importRoute();

    await PATCH(createPatchRequest({ status: 'COMPLETED' }), {
      params: Promise.resolve({ order_number: 'CAT-001' }),
    });

    const updateCall = (mockedPrisma.cateringRequest.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.completeDateTime).toBeInstanceOf(Date);
  });

  it('does NOT overwrite an already-set completeDateTime (idempotent)', async () => {
    const existing = new Date('2024-01-01T00:00:00Z');
    setupMocks({ driverStatus: 'ARRIVED_TO_CLIENT', completeDateTime: existing });
    const { PATCH } = await importRoute();

    await PATCH(createPatchRequest({ driverStatus: 'COMPLETED' }), {
      params: Promise.resolve({ order_number: 'CAT-001' }),
    });

    const updateCall = (mockedPrisma.cateringRequest.update as jest.Mock).mock.calls[0][0];
    // completeDateTime guarded by `!existingOrder.completeDateTime` → not re-set.
    expect(updateCall.data.completeDateTime).toBeUndefined();
  });

  it('does NOT stamp completeDateTime on a non-terminal transition', async () => {
    setupMocks({ driverStatus: 'EN_ROUTE_TO_CLIENT', status: 'IN_PROGRESS' });
    const { PATCH } = await importRoute();

    await PATCH(createPatchRequest({ driverStatus: 'ARRIVED_TO_CLIENT' }), {
      params: Promise.resolve({ order_number: 'CAT-001' }),
    });

    const updateCall = (mockedPrisma.cateringRequest.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.completeDateTime).toBeUndefined();
  });

  it('keeps deliveries.status in sync on the upsert UPDATE branch', async () => {
    const { PATCH } = await importRoute();

    await PATCH(createPatchRequest({ driverStatus: 'COMPLETED' }), {
      params: Promise.resolve({ order_number: 'CAT-001' }),
    });

    expect(mockedPrisma.delivery.upsert as jest.Mock).toHaveBeenCalledTimes(1);
    const upsertArg = (mockedPrisma.delivery.upsert as jest.Mock).mock.calls[0][0];
    // The fix: status is set on UPDATE (not only on create) so the admin
    // deliveries mirror doesn't drift from driverStatus.
    expect(upsertArg.update.status).toBe('COMPLETED');
    expect(upsertArg.update.deliveredAt).toBeInstanceOf(Date);
    expect(upsertArg.create.status).toBe('COMPLETED');
  });
});
