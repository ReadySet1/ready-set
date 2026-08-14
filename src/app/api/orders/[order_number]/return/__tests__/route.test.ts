/**
 * Tests for the return-to-dispatch POST route (issue #508 escape hatch).
 *
 * AuthZ matrix under test:
 * - assigned driver, pre-pickup (null/ASSIGNED/EN_ROUTE_TO_VENDOR/ARRIVED_AT_VENDOR) -> 200
 * - assigned driver, post-pickup -> 409 POST_PICKUP
 * - unassigned driver -> 403
 * - ADMIN / SUPER_ADMIN / HELPDESK -> 200 in any non-terminal state
 * - terminal order -> 409; no dispatch rows -> 409 NOT_ASSIGNED; bad reason -> 400
 *
 * The unwind runs in one transaction: mirror tombstone (CANCELLED + deletedAt),
 * dispatch delete, order back to ACTIVE with driverStatus null, and a
 * RETURNED_TO_DISPATCH history row for non-partner catering orders only.
 * The admin push notification fires after the response.
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $transaction: jest.fn(),
    profile: { findUnique: jest.fn() },
    cateringRequest: { findFirst: jest.fn() },
    onDemand: { findFirst: jest.fn() },
  },
}));
jest.mock('@/utils/supabase/server');
jest.mock('@/lib/services/partner-registry', () => ({
  getPartnerByOrderNumber: jest.fn(),
}));
jest.mock('@/services/notifications/delivery-status', () => ({
  sendDispatchStatusNotification: jest.fn(),
}));
jest.mock('@/lib/api/after-response', () => ({
  // Run the deferred work inline so tests can assert on the notification call.
  runAfterResponse: jest.fn((_label: string, work: () => Promise<unknown>) => {
    void work().catch(() => {});
  }),
}));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

import { NextRequest } from 'next/server';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { getPartnerByOrderNumber } from '@/lib/services/partner-registry';
import { sendDispatchStatusNotification } from '@/services/notifications/delivery-status';

const mockedPrisma = prisma as any;
const mockedCreateClient = jest.mocked(createClient);
const mockedGetPartner = getPartnerByOrderNumber as jest.Mock;
const mockedNotify = sendDispatchStatusNotification as jest.Mock;

// Transaction client with its own spies so in-tx writes are assertable.
const makeTx = () => ({
  cateringRequest: { findFirst: jest.fn(), update: jest.fn() },
  onDemand: { findFirst: jest.fn(), update: jest.fn() },
  dispatch: { findMany: jest.fn(), deleteMany: jest.fn() },
  delivery: { updateMany: jest.fn() },
  orderStatusHistory: { create: jest.fn() },
});
let tx: ReturnType<typeof makeTx>;

const DRIVER_ID = 'driver-profile-1';
const ORDER_ID = 'order-123';

const createPostRequest = (
  orderNumber = 'CAT-001',
  body: Record<string, unknown> | null = { reason: 'CANNOT_MAKE_PICKUP' },
) => {
  const req = new NextRequest(
    `http://localhost:3000/api/orders/${orderNumber}/return`,
    { method: 'POST' },
  );
  (req as any).json = jest.fn().mockResolvedValue(body ?? {});
  return req;
};

interface SetupOpts {
  role?: string;
  user?: { id: string } | null;
  orderType?: 'catering' | 'on_demand';
  orderStatus?: string;
  driverStatus?: string | null;
  dispatches?: Array<{ id: string; driverId: string | null }>;
  partner?: unknown;
}

const setupMocks = (opts: SetupOpts = {}) => {
  const role = opts.role ?? 'DRIVER';
  const user = opts.user === undefined ? { id: DRIVER_ID } : opts.user;
  const orderType = opts.orderType ?? 'catering';
  const order = {
    id: ORDER_ID,
    orderNumber: 'CAT-001',
    status: opts.orderStatus ?? 'ASSIGNED',
    driverStatus: opts.driverStatus === undefined ? 'ASSIGNED' : opts.driverStatus,
    userId: 'client-1',
  };

  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as any);

  (mockedPrisma.profile.findUnique as jest.Mock).mockResolvedValue(
    user ? { id: user.id, type: role } : null,
  );
  (mockedPrisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(
    orderType === 'catering' ? { id: ORDER_ID, orderNumber: 'CAT-001' } : null,
  );
  (mockedPrisma.onDemand.findFirst as jest.Mock).mockResolvedValue(
    orderType === 'on_demand' ? { id: ORDER_ID, orderNumber: 'OD-001' } : null,
  );

  tx = makeTx();
  tx.cateringRequest.findFirst.mockResolvedValue(orderType === 'catering' ? order : null);
  tx.onDemand.findFirst.mockResolvedValue(
    orderType === 'on_demand' ? { ...order, orderNumber: 'OD-001' } : null,
  );
  tx.dispatch.findMany.mockResolvedValue(
    opts.dispatches ?? [{ id: 'dispatch-1', driverId: DRIVER_ID }],
  );
  tx.delivery.updateMany.mockResolvedValue({ count: 1 });
  tx.dispatch.deleteMany.mockResolvedValue({ count: 1 });
  tx.cateringRequest.update.mockResolvedValue(order);
  tx.onDemand.update.mockResolvedValue(order);
  tx.orderStatusHistory.create.mockResolvedValue({ id: 'hist-1' });

  (mockedPrisma.$transaction as jest.Mock).mockImplementation(
    async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
  );

  mockedGetPartner.mockResolvedValue(opts.partner ?? null);
  mockedNotify.mockResolvedValue({ success: true });
};

const importRoute = async () => import('../route');
const params = (order_number: string) => ({ params: Promise.resolve({ order_number }) });

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('return-to-dispatch POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setupMocks({ user: null });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-privileged role', async () => {
    setupMocks({ role: 'CLIENT' });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when the order does not exist', async () => {
    setupMocks();
    (mockedPrisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(null);
    (mockedPrisma.onDemand.findFirst as jest.Mock).mockResolvedValue(null);
    const { POST } = await importRoute();
    const res = await POST(createPostRequest('NOPE'), params('NOPE'));
    expect(res.status).toBe(404);
  });

  it('returns 400 for an unknown reason', async () => {
    const { POST } = await importRoute();
    const res = await POST(
      createPostRequest('CAT-001', { reason: 'FELT_LIKE_IT' }),
      params('CAT-001'),
    );
    expect(res.status).toBe(400);
    expect(mockedPrisma.$transaction as jest.Mock).not.toHaveBeenCalled();
  });

  it('returns 400 when details exceed 500 characters', async () => {
    const { POST } = await importRoute();
    const res = await POST(
      createPostRequest('CAT-001', { reason: 'OTHER', details: 'x'.repeat(501) }),
      params('CAT-001'),
    );
    expect(res.status).toBe(400);
    expect(mockedPrisma.$transaction as jest.Mock).not.toHaveBeenCalled();
  });

  it('lets the assigned driver return a pre-pickup order and unwinds the assignment', async () => {
    setupMocks({ driverStatus: 'EN_ROUTE_TO_VENDOR', orderStatus: 'IN_PROGRESS' });
    const { POST } = await importRoute();
    const res = await POST(
      createPostRequest('CAT-001', { reason: 'VEHICLE_ISSUE', details: 'Flat tire' }),
      params('CAT-001'),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Mirror tombstone: CANCELLED + deletedAt (SSE feed filters live rows) + reason.
    expect(tx.delivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orderNumber: 'CAT-001', deletedAt: null }),
        data: expect.objectContaining({
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          deletedAt: expect.any(Date),
          deliveryNotes: expect.stringContaining('VEHICLE_ISSUE'),
        }),
      }),
    );
    expect(tx.delivery.updateMany.mock.calls[0][0].data.deliveryNotes).toContain('Flat tire');

    // Dispatch rows removed (feed, guard, and admin map are dispatch-keyed).
    expect(tx.dispatch.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ cateringRequestId: ORDER_ID }) }),
    );

    // Order back in the assignable pool.
    expect(tx.cateringRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORDER_ID },
        data: expect.objectContaining({ status: 'ACTIVE', driverStatus: null }),
      }),
    );

    // Non-partner catering order gets an audit history row.
    expect(tx.orderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cateringRequestId: ORDER_ID,
          partnerStatus: 'RETURNED_TO_DISPATCH',
          changedBy: DRIVER_ID,
        }),
      }),
    );

    // Admin push fired after the response with the pre-delete dispatch id.
    await flush();
    expect(mockedNotify).toHaveBeenCalledWith({
      status: 'FAILED',
      dispatchId: 'dispatch-1',
      orderId: ORDER_ID,
      recipientType: 'ADMIN',
    });
  });

  it('returns 409 POST_PICKUP for the assigned driver after pickup', async () => {
    setupMocks({ driverStatus: 'PICKED_UP', orderStatus: 'IN_PROGRESS' });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('POST_PICKUP');
    expect(tx.delivery.updateMany).not.toHaveBeenCalled();
    expect(tx.dispatch.deleteMany).not.toHaveBeenCalled();
    expect(tx.cateringRequest.update).not.toHaveBeenCalled();
    expect(mockedNotify).not.toHaveBeenCalled();
  });

  it('returns 403 for a driver who is not assigned to the order', async () => {
    setupMocks({ dispatches: [{ id: 'dispatch-1', driverId: 'someone-else' }] });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));

    expect(res.status).toBe(403);
    expect(tx.dispatch.deleteMany).not.toHaveBeenCalled();
  });

  it('lets an ADMIN force a return after pickup', async () => {
    setupMocks({ role: 'ADMIN', driverStatus: 'PICKED_UP', orderStatus: 'IN_PROGRESS' });
    const { POST } = await importRoute();
    const res = await POST(
      createPostRequest('CAT-001', { reason: 'ADMIN_UNASSIGNED' }),
      params('CAT-001'),
    );

    expect(res.status).toBe(200);
    expect(tx.dispatch.deleteMany).toHaveBeenCalled();
    expect(tx.cateringRequest.update).toHaveBeenCalled();
  });

  it('treats HELPDESK as privileged (mirrors the orders PATCH)', async () => {
    setupMocks({ role: 'HELPDESK', driverStatus: 'PICKED_UP', orderStatus: 'IN_PROGRESS' });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));
    expect(res.status).toBe(200);
  });

  it('returns 409 for a terminal order, even for an admin', async () => {
    setupMocks({ role: 'ADMIN', orderStatus: 'COMPLETED', driverStatus: 'COMPLETED' });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));

    expect(res.status).toBe(409);
    expect(tx.dispatch.deleteMany).not.toHaveBeenCalled();
  });

  it('returns 409 NOT_ASSIGNED when no dispatch rows exist', async () => {
    setupMocks({ dispatches: [] });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('NOT_ASSIGNED');
  });

  it('skips the history row for partner orders (no partner webhook surface)', async () => {
    setupMocks({ partner: { id: 'partner-1', orderPrefix: 'CAT-' } });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));

    expect(res.status).toBe(200);
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it('handles on-demand orders without a history row (no FK to on_demand)', async () => {
    setupMocks({ orderType: 'on_demand' });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest('OD-001'), params('OD-001'));

    expect(res.status).toBe(200);
    expect(tx.onDemand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORDER_ID },
        data: expect.objectContaining({ status: 'ACTIVE', driverStatus: null }),
      }),
    );
    expect(tx.dispatch.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ onDemandId: ORDER_ID }) }),
    );
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it('resolves the user from the Authorization header when cookies are stale', async () => {
    const getUser = jest.fn(async (token?: string) =>
      token === 'tok-123'
        ? { data: { user: { id: DRIVER_ID } }, error: null }
        : { data: { user: null }, error: { message: 'no cookie session' } },
    );
    mockedCreateClient.mockResolvedValue({ auth: { getUser } } as any);

    const req = new NextRequest('http://localhost:3000/api/orders/CAT-001/return', {
      method: 'POST',
      headers: { authorization: 'Bearer tok-123' },
    });
    (req as any).json = jest.fn().mockResolvedValue({ reason: 'CANNOT_MAKE_PICKUP' });

    const { POST } = await importRoute();
    const res = await POST(req, params('CAT-001'));

    expect(res.status).toBe(200);
    expect(getUser).toHaveBeenCalledWith('tok-123');
  });
});
