/**
 * Orders API PATCH — cancel cascade (2026-08-21 drive finding #8).
 *
 * Cancelling an order from admin used to leave the driver-side rows untouched
 * (`dispatches` row kept, `deliveries` mirror still ASSIGNED), so the
 * end-shift guard deadlocked the driver. When a PATCH sets status=CANCELLED
 * (catering or on-demand) the same transaction must:
 *  - delete the order's `dispatches` rows, and
 *  - mark the order's live, non-terminal `deliveries` rows CANCELLED with
 *    `cancelled_at` stamped.
 *
 * Mocking mirrors the sibling completion.test.ts (auto-mocked prisma +
 * supabase; `$transaction` hands back the same mocked client).
 */

jest.mock('@/utils/prismaDB');
jest.mock('@/utils/supabase/server');
jest.mock('@/services/notifications/delivery-status', () => ({
  sendDispatchStatusNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/notifications/driver-cancellation', () => ({
  notifyDriverOrderCancelled: jest.fn().mockResolvedValue({ sms: 'sent' }),
}));

import { NextRequest } from 'next/server';
import { prisma } from '@/utils/prismaDB';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { notifyDriverOrderCancelled } from '@/services/notifications/driver-cancellation';

const mockedPrisma = jest.mocked(prisma);
const mockedCreateClient = jest.mocked(createClient);
const mockedCreateAdminClient = jest.mocked(createAdminClient);
const mockedNotifyDriver = jest.mocked(notifyDriverOrderCancelled);

/** The realtime channel handed out by the mocked admin client (per setupMocks). */
let lastChannel: { send: jest.Mock; subscribe: jest.Mock };

const createMockOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-123',
  orderNumber: 'Test 0821261',
  status: 'ASSIGNED',
  driverStatus: 'ASSIGNED',
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

const createPatchRequest = (body: object, orderNumber = 'Test%200821261') =>
  new NextRequest(`http://localhost:3000/api/orders/${orderNumber}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

const params = { params: Promise.resolve({ order_number: 'Test%200821261' }) };

const setupMocks = (
  orderType: 'catering' | 'on_demand' = 'catering',
  orderOverrides: Record<string, unknown> = {},
) => {
  const mockOrder = createMockOrder(orderOverrides);

  const updateImpl = ({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...mockOrder, ...data });

  (mockedPrisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(
    orderType === 'catering' ? mockOrder : null,
  );
  (mockedPrisma.onDemand.findFirst as jest.Mock).mockResolvedValue(
    orderType === 'on_demand' ? mockOrder : null,
  );
  (mockedPrisma.cateringRequest.update as jest.Mock).mockImplementation(updateImpl);
  (mockedPrisma.onDemand.update as jest.Mock).mockImplementation(updateImpl);
  (mockedPrisma.driver.findFirst as jest.Mock).mockResolvedValue({ id: 'delivery-driver-1' });
  (mockedPrisma.delivery.upsert as jest.Mock).mockResolvedValue({});
  (mockedPrisma.delivery.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  (mockedPrisma.dispatch.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-user-id' } }, error: null }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { type: 'ADMIN' }, error: null }),
    }),
  } as any);

  const mockChannel = {
    send: jest.fn().mockResolvedValue('ok'),
    subscribe: jest.fn().mockImplementation((cb: (s: string) => void) => {
      cb('SUBSCRIBED');
      return mockChannel;
    }),
  };
  lastChannel = mockChannel;
  mockedCreateAdminClient.mockResolvedValue({
    channel: jest.fn().mockReturnValue(mockChannel),
    removeChannel: jest.fn().mockResolvedValue(undefined),
  } as any);
};

const expectDriverNotified = (orderType: 'catering' | 'on_demand') => {
  expect(mockedNotifyDriver).toHaveBeenCalledTimes(1);
  expect(mockedNotifyDriver).toHaveBeenCalledWith(
    expect.objectContaining({
      driverProfileId: 'driver-456',
      phone: '555',
      orderNumber: 'Test 0821261',
      orderType,
    }),
  );

  expect(lastChannel.send).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'broadcast',
      event: 'delivery:status:updated',
      payload: expect.objectContaining({
        driverId: 'driver-456',
        orderId: 'order-123',
        orderNumber: 'Test 0821261',
        orderType,
        status: 'CANCELLED',
        timestamp: expect.any(String),
      }),
    }),
  );
};

const importRoute = async () => import('../route');

const expectCascade = (dispatchWhere: Record<string, string>) => {
  expect(mockedPrisma.dispatch.deleteMany as jest.Mock).toHaveBeenCalledTimes(1);
  expect(mockedPrisma.dispatch.deleteMany as jest.Mock).toHaveBeenCalledWith({
    where: dispatchWhere,
  });

  expect(mockedPrisma.delivery.updateMany as jest.Mock).toHaveBeenCalledTimes(1);
  const updateManyArg = (mockedPrisma.delivery.updateMany as jest.Mock).mock.calls[0][0];
  expect(updateManyArg.where).toEqual({
    orderNumber: 'Test 0821261',
    deletedAt: null,
    status: { notIn: expect.arrayContaining(['COMPLETED', 'CANCELLED', 'DELIVERED']) },
  });
  expect(updateManyArg.data.status).toBe('CANCELLED');
  expect(updateManyArg.data.cancelledAt).toBeInstanceOf(Date);
};

describe('Orders API PATCH — cancel cascade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancels the deliveries mirror and deletes dispatches for a catering order', async () => {
    setupMocks('catering');
    const { PATCH } = await importRoute();

    const res = await PATCH(createPatchRequest({ status: 'CANCELLED' }), params);

    expect(res.status).toBe(200);
    const updateCall = (mockedPrisma.cateringRequest.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.status).toBe('CANCELLED');
    expectCascade({ cateringRequestId: 'order-123' });
  });

  it('cancels the deliveries mirror and deletes dispatches for an on-demand order', async () => {
    setupMocks('on_demand');
    const { PATCH } = await importRoute();

    const res = await PATCH(createPatchRequest({ status: 'CANCELLED' }), params);

    expect(res.status).toBe(200);
    expect(mockedPrisma.onDemand.update as jest.Mock).toHaveBeenCalledTimes(1);
    expectCascade({ onDemandId: 'order-123' });
  });

  it('runs the cascade inside the order-update transaction', async () => {
    setupMocks('catering');
    const { PATCH } = await importRoute();

    await PATCH(createPatchRequest({ status: 'CANCELLED' }), params);

    // The global mock resolves $transaction by calling the callback; the
    // cascade writes must happen inside it (after the transaction started).
    const txOrder = (mockedPrisma.$transaction as jest.Mock).mock.invocationCallOrder[0]!;
    const deleteOrder = (mockedPrisma.dispatch.deleteMany as jest.Mock).mock.invocationCallOrder[0]!;
    const updateManyOrder = (mockedPrisma.delivery.updateMany as jest.Mock).mock.invocationCallOrder[0]!;
    expect(deleteOrder).toBeGreaterThan(txOrder);
    expect(updateManyOrder).toBeGreaterThan(txOrder);
  });

  it('fails the whole PATCH when the cascade throws (no half-cancelled order)', async () => {
    setupMocks('catering');
    (mockedPrisma.dispatch.deleteMany as jest.Mock).mockRejectedValue(new Error('boom'));
    const { PATCH } = await importRoute();

    const res = await PATCH(createPatchRequest({ status: 'CANCELLED' }), params);

    expect(res.status).toBe(500);
  });

  it('does NOT touch dispatches or the mirror on a non-cancel status change', async () => {
    setupMocks('catering', { status: 'ACTIVE', driverStatus: null, dispatches: [] });
    const { PATCH } = await importRoute();

    await PATCH(createPatchRequest({ status: 'ASSIGNED' }), params);

    expect(mockedPrisma.dispatch.deleteMany as jest.Mock).not.toHaveBeenCalled();
    expect(mockedPrisma.delivery.updateMany as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('Orders API PATCH — driver cancellation notification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('texts and broadcasts to the assigned driver when a catering order is cancelled', async () => {
    setupMocks('catering');
    const { PATCH } = await importRoute();

    const res = await PATCH(createPatchRequest({ status: 'CANCELLED' }), params);

    expect(res.status).toBe(200);
    expectDriverNotified('catering');
  });

  it('texts and broadcasts to the assigned driver when an on-demand order is cancelled', async () => {
    setupMocks('on_demand');
    const { PATCH } = await importRoute();

    const res = await PATCH(createPatchRequest({ status: 'CANCELLED' }), params);

    expect(res.status).toBe(200);
    expectDriverNotified('on_demand');
  });

  it('does NOT notify the driver on a non-cancel status change', async () => {
    setupMocks('catering', { status: 'ACTIVE', driverStatus: null });
    const { PATCH } = await importRoute();

    const res = await PATCH(createPatchRequest({ status: 'ASSIGNED' }), params);

    expect(res.status).toBe(200);
    expect(mockedNotifyDriver).not.toHaveBeenCalled();
    expect(lastChannel.send).not.toHaveBeenCalled();
  });

  it('does NOT notify anyone when the cancelled order has no driver', async () => {
    setupMocks('catering', { dispatches: [] });
    const { PATCH } = await importRoute();

    const res = await PATCH(createPatchRequest({ status: 'CANCELLED' }), params);

    expect(res.status).toBe(200);
    expect(mockedNotifyDriver).not.toHaveBeenCalled();
    expect(lastChannel.send).not.toHaveBeenCalled();
  });

  it('still returns 200 when the SMS notifier rejects', async () => {
    setupMocks('catering');
    mockedNotifyDriver.mockRejectedValueOnce(new Error('twilio down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { PATCH } = await importRoute();

    const res = await PATCH(createPatchRequest({ status: 'CANCELLED' }), params);

    expect(res.status).toBe(200);
    expect(mockedNotifyDriver).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('still returns 200 when the realtime broadcast fails', async () => {
    setupMocks('catering');
    lastChannel.send.mockRejectedValue(new Error('channel down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { PATCH } = await importRoute();

    const res = await PATCH(createPatchRequest({ status: 'CANCELLED' }), params);

    expect(res.status).toBe(200);
    errorSpy.mockRestore();
  });
});
