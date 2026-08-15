/**
 * Tests for the return-to-dispatch route (issue #508 escape hatch + the
 * helpdesk-approval flow).
 *
 * AuthZ matrix under test:
 * - assigned DRIVER, pre-pickup -> 202 PENDING_APPROVAL (a DeliveryReturnRequest
 *   row is created; the assignment is NOT unwound). Idempotent on repeat.
 * - assigned DRIVER, post-pickup -> 409 POST_PICKUP
 * - unassigned driver -> 403
 * - ADMIN / SUPER_ADMIN / HELPDESK -> 200 immediate return in any non-terminal
 *   state (unchanged pre-approval behavior).
 * - terminal order -> 409; no dispatch rows -> 409 NOT_ASSIGNED; bad reason -> 400
 *
 * The privileged unwind runs in one transaction: mirror tombstone (CANCELLED +
 * deletedAt), dispatch delete, order back to ACTIVE with driverStatus null, and
 * a RETURNED_TO_DISPATCH history row for non-partner catering orders only.
 * Push notifications fire after the response: RETURN_REQUESTED for a new driver
 * request, FAILED for a privileged unwind.
 *
 * GET returns the caller's PENDING request for the order (drivers see only
 * their own) so the driver UI can render the "Return requested" state.
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $transaction: jest.fn(),
    profile: { findUnique: jest.fn() },
    cateringRequest: { findFirst: jest.fn() },
    onDemand: { findFirst: jest.fn() },
    deliveryReturnRequest: { findFirst: jest.fn() },
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
  deliveryReturnRequest: { findFirst: jest.fn(), create: jest.fn() },
});
let tx: ReturnType<typeof makeTx>;

const DRIVER_ID = 'driver-profile-1';
const ORDER_ID = 'order-123';
const REQUEST_ID = 'return-request-1';

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

const createGetRequest = (orderNumber = 'CAT-001') =>
  new NextRequest(`http://localhost:3000/api/orders/${orderNumber}/return`, {
    method: 'GET',
  });

interface SetupOpts {
  role?: string;
  user?: { id: string } | null;
  orderType?: 'catering' | 'on_demand';
  orderStatus?: string;
  driverStatus?: string | null;
  dispatches?: Array<{ id: string; driverId: string | null }>;
  partner?: unknown;
  existingPending?: Record<string, unknown> | null;
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
  (mockedPrisma.deliveryReturnRequest.findFirst as jest.Mock).mockResolvedValue(null);

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
  tx.deliveryReturnRequest.findFirst.mockResolvedValue(opts.existingPending ?? null);
  tx.deliveryReturnRequest.create.mockImplementation(async ({ data }: any) => ({
    id: REQUEST_ID,
    status: 'PENDING',
    requestedAt: new Date(),
    ...data,
  }));

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

  it('files a PENDING request (202) for the assigned driver instead of unwinding', async () => {
    setupMocks({ driverStatus: 'EN_ROUTE_TO_VENDOR', orderStatus: 'IN_PROGRESS' });
    const { POST } = await importRoute();
    const res = await POST(
      createPostRequest('CAT-001', { reason: 'VEHICLE_ISSUE', details: 'Flat tire' }),
      params('CAT-001'),
    );

    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe('PENDING_APPROVAL');
    expect(data.requestId).toBe(REQUEST_ID);
    expect(data.alreadyPending).toBe(false);

    // The request row carries the driver, order, and durable reason.
    expect(tx.deliveryReturnRequest.create).toHaveBeenCalledWith({
      data: {
        orderType: 'catering',
        orderId: ORDER_ID,
        orderNumber: 'CAT-001',
        driverId: DRIVER_ID,
        reason: 'VEHICLE_ISSUE',
        details: 'Flat tire',
      },
    });

    // NOTHING is unwound until dispatch approves.
    expect(tx.delivery.updateMany).not.toHaveBeenCalled();
    expect(tx.dispatch.deleteMany).not.toHaveBeenCalled();
    expect(tx.cateringRequest.update).not.toHaveBeenCalled();
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();

    // Dispatch gets the action-required "return requested" push.
    await flush();
    expect(mockedNotify).toHaveBeenCalledWith({
      status: 'RETURN_REQUESTED',
      dispatchId: 'dispatch-1',
      orderId: ORDER_ID,
      recipientType: 'ADMIN',
    });
  });

  it('is idempotent: a second driver request returns the existing PENDING row', async () => {
    const existing = {
      id: 'existing-request',
      status: 'PENDING',
      orderNumber: 'CAT-001',
      requestedAt: new Date(),
    };
    setupMocks({ existingPending: existing });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));

    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.requestId).toBe('existing-request');
    expect(data.alreadyPending).toBe(true);
    expect(tx.deliveryReturnRequest.create).not.toHaveBeenCalled();
    // No duplicate push for an idempotent repeat.
    await flush();
    expect(mockedNotify).not.toHaveBeenCalled();
  });

  it('returns 409 POST_PICKUP for the assigned driver after pickup', async () => {
    setupMocks({ driverStatus: 'PICKED_UP', orderStatus: 'IN_PROGRESS' });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('POST_PICKUP');
    expect(tx.deliveryReturnRequest.create).not.toHaveBeenCalled();
    expect(tx.delivery.updateMany).not.toHaveBeenCalled();
    expect(tx.dispatch.deleteMany).not.toHaveBeenCalled();
    expect(mockedNotify).not.toHaveBeenCalled();
  });

  it('returns 403 for a driver who is not assigned to the order', async () => {
    setupMocks({ dispatches: [{ id: 'dispatch-1', driverId: 'someone-else' }] });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));

    expect(res.status).toBe(403);
    expect(tx.deliveryReturnRequest.create).not.toHaveBeenCalled();
    expect(tx.dispatch.deleteMany).not.toHaveBeenCalled();
  });

  it('returns 409 NOT_ASSIGNED to a driver when no dispatch rows exist', async () => {
    setupMocks({ dispatches: [] });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('NOT_ASSIGNED');
  });

  it('lets an ADMIN return immediately (no approval step) and unwinds the assignment', async () => {
    setupMocks({ role: 'ADMIN', driverStatus: 'EN_ROUTE_TO_VENDOR', orderStatus: 'IN_PROGRESS' });
    const { POST } = await importRoute();
    const res = await POST(
      createPostRequest('CAT-001', { reason: 'VEHICLE_ISSUE', details: 'Flat tire' }),
      params('CAT-001'),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe('ACTIVE');

    // No request row for privileged callers.
    expect(tx.deliveryReturnRequest.create).not.toHaveBeenCalled();

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

  it('returns 409 for a terminal order on the driver request path too', async () => {
    setupMocks({ orderStatus: 'CANCELLED', driverStatus: null });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('TERMINAL');
    expect(tx.deliveryReturnRequest.create).not.toHaveBeenCalled();
  });

  it('returns 409 NOT_ASSIGNED for an admin when no dispatch rows exist', async () => {
    setupMocks({ role: 'ADMIN', dispatches: [] });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('NOT_ASSIGNED');
  });

  it('skips the history row for partner orders (no partner webhook surface)', async () => {
    setupMocks({ role: 'ADMIN', partner: { id: 'partner-1', orderPrefix: 'CAT-' } });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));

    expect(res.status).toBe(200);
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it('handles on-demand orders without a history row (no FK to on_demand)', async () => {
    setupMocks({ role: 'ADMIN', orderType: 'on_demand' });
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

  it('files an on-demand request with the right orderType for a driver', async () => {
    setupMocks({ orderType: 'on_demand' });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest('OD-001'), params('OD-001'));

    expect(res.status).toBe(202);
    expect(tx.deliveryReturnRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderType: 'on_demand', orderNumber: 'OD-001' }),
      }),
    );
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

    // Driver path now files a request (202) — auth still resolved via Bearer.
    expect(res.status).toBe(202);
    expect(getUser).toHaveBeenCalledWith('tok-123');
  });
});

describe('return-to-dispatch GET (pending request lookup)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setupMocks({ user: null });
    const { GET } = await importRoute();
    const res = await GET(createGetRequest(), params('CAT-001'));
    expect(res.status).toBe(401);
  });

  it("returns the driver's own PENDING request", async () => {
    const pending = {
      id: REQUEST_ID,
      status: 'PENDING',
      reason: 'VEHICLE_ISSUE',
      details: null,
      requestedAt: new Date('2026-08-14T10:00:00Z'),
    };
    (mockedPrisma.deliveryReturnRequest.findFirst as jest.Mock).mockResolvedValue(pending);

    const { GET } = await importRoute();
    const res = await GET(createGetRequest(), params('CAT-001'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.request.id).toBe(REQUEST_ID);
    // Drivers are scoped to their own request.
    expect(mockedPrisma.deliveryReturnRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PENDING',
          driverId: DRIVER_ID,
        }),
      }),
    );
  });

  it('returns null when nothing is pending', async () => {
    const { GET } = await importRoute();
    const res = await GET(createGetRequest(), params('CAT-001'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.request).toBeNull();
  });

  it('does not scope by driver for privileged callers', async () => {
    setupMocks({ role: 'HELPDESK' });
    const { GET } = await importRoute();
    await GET(createGetRequest(), params('CAT-001'));

    const where = (mockedPrisma.deliveryReturnRequest.findFirst as jest.Mock).mock
      .calls[0][0].where;
    expect(where.driverId).toBeUndefined();
  });
});
