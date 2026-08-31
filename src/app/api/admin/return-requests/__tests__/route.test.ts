/**
 * Tests for the helpdesk return-request endpoints:
 *
 * - GET  /api/admin/return-requests?status=PENDING — list with driver names.
 * - PATCH /api/admin/return-requests/[id] — approve (executes the return, or
 *   reports VOIDED when the order moved on) / reject. Drivers get a push on
 *   either resolution.
 *
 * Both are ADMIN / SUPER_ADMIN / HELPDESK only via withAuth.
 */

jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    deliveryReturnRequest: { findMany: jest.fn() },
    profile: { findMany: jest.fn() },
  },
}));
jest.mock('@/lib/services/return-requests', () => {
  const actual = jest.requireActual('@/lib/services/return-requests');
  return {
    ...actual,
    approveReturnRequest: jest.fn(),
    rejectReturnRequest: jest.fn(),
  };
});
jest.mock('@/services/notifications/push', () => ({
  sendDeliveryStatusPush: jest.fn(),
}));
jest.mock('@/lib/api/after-response', () => ({
  runAfterResponse: jest.fn((_label: string, work: () => Promise<unknown>) => {
    void work().catch(() => {});
  }),
}));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import {
  ReturnGuardError,
  approveReturnRequest,
  rejectReturnRequest,
} from '@/lib/services/return-requests';
import { sendDeliveryStatusPush } from '@/services/notifications/push';

const mockedWithAuth = withAuth as jest.Mock;
const mockedPrisma = prisma as any;
const mockedApprove = approveReturnRequest as jest.Mock;
const mockedReject = rejectReturnRequest as jest.Mock;
const mockedPush = sendDeliveryStatusPush as jest.Mock;

const RESOLVER_ID = 'helpdesk-1';
const REQUEST_ID = 'request-1';

const authOk = (type = 'HELPDESK') => ({
  success: true,
  context: { user: { id: RESOLVER_ID, email: 'h@rs.com', type } },
});
const authDenied = () => ({
  success: false,
  response: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
  context: {},
});

const listRequest = (query = '') =>
  new NextRequest(`http://localhost:3000/api/admin/return-requests${query}`);

const patchRequest = (body: Record<string, unknown> | null) => {
  const req = new NextRequest(
    `http://localhost:3000/api/admin/return-requests/${REQUEST_ID}`,
    { method: 'PATCH' },
  );
  (req as any).json = jest.fn().mockResolvedValue(body ?? {});
  return req;
};
const patchParams = { params: Promise.resolve({ id: REQUEST_ID }) };

const dbRow = {
  id: REQUEST_ID,
  orderType: 'catering',
  orderId: 'order-123',
  orderNumber: 'CAT-001',
  driverId: 'driver-1',
  reason: 'VEHICLE_ISSUE',
  details: 'Flat tire',
  status: 'PENDING',
  requestedAt: new Date('2026-08-14T10:00:00Z'),
  resolvedAt: null,
  resolvedBy: null,
  resolutionNotes: null,
};

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  jest.clearAllMocks();
  mockedWithAuth.mockResolvedValue(authOk());
  mockedPrisma.deliveryReturnRequest.findMany.mockResolvedValue([dbRow]);
  mockedPrisma.profile.findMany.mockResolvedValue([
    { id: 'driver-1', name: 'Test Driver', email: 'driver@rs.com' },
  ]);
  mockedPush.mockResolvedValue(undefined);
});

describe('GET /api/admin/return-requests', () => {
  const importRoute = async () => import('../route');

  it('rejects non-admin callers via withAuth', async () => {
    mockedWithAuth.mockResolvedValue(authDenied());
    const { GET } = await importRoute();
    const res = await GET(listRequest());
    expect(res!.status).toBe(403);
    expect(mockedWithAuth).toHaveBeenCalledWith(expect.anything(), {
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
      requireAuth: true,
    });
  });

  it('lists PENDING requests by default with driver context', async () => {
    const { GET } = await importRoute();
    const res = await GET(listRequest());

    expect(res!.status).toBe(200);
    const data = await res!.json();
    expect(data.success).toBe(true);
    expect(data.requests).toHaveLength(1);
    expect(data.requests[0]).toMatchObject({
      id: REQUEST_ID,
      orderNumber: 'CAT-001',
      orderType: 'catering',
      driverName: 'Test Driver',
      reason: 'VEHICLE_ISSUE',
      details: 'Flat tire',
      status: 'PENDING',
    });

    expect(mockedPrisma.deliveryReturnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING' },
        orderBy: { requestedAt: 'asc' },
      }),
    );
    // Driver lookup filters soft-deleted profiles.
    expect(mockedPrisma.profile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('accepts an explicit status filter', async () => {
    const { GET } = await importRoute();
    await GET(listRequest('?status=REJECTED'));
    expect(mockedPrisma.deliveryReturnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'REJECTED' } }),
    );
  });

  it('rejects an unknown status filter (400)', async () => {
    const { GET } = await importRoute();
    const res = await GET(listRequest('?status=BOGUS'));
    expect(res!.status).toBe(400);
  });
});

describe('PATCH /api/admin/return-requests/[id]', () => {
  const importRoute = async () => import('../[id]/route');

  it('rejects non-admin callers via withAuth', async () => {
    mockedWithAuth.mockResolvedValue(authDenied());
    const { PATCH } = await importRoute();
    const res = await PATCH(patchRequest({ action: 'approve' }), patchParams);
    expect(res!.status).toBe(403);
    expect(mockedApprove).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown action', async () => {
    const { PATCH } = await importRoute();
    const res = await PATCH(patchRequest({ action: 'shrug' }), patchParams);
    expect(res!.status).toBe(400);
    expect(mockedApprove).not.toHaveBeenCalled();
    expect(mockedReject).not.toHaveBeenCalled();
  });

  it('approves: executes the return and pushes to the driver', async () => {
    mockedApprove.mockResolvedValue({
      outcome: 'APPROVED',
      request: { ...dbRow, status: 'APPROVED' },
      orderId: 'order-123',
      orderNumber: 'CAT-001',
      driverId: 'driver-1',
      dispatchId: 'dispatch-1',
    });

    const { PATCH } = await importRoute();
    const res = await PATCH(patchRequest({ action: 'approve' }), patchParams);

    expect(res!.status).toBe(200);
    const data = await res!.json();
    expect(data.status).toBe('APPROVED');
    expect(data.orderNumber).toBe('CAT-001');
    expect(mockedApprove).toHaveBeenCalledWith(REQUEST_ID, RESOLVER_ID);

    await flush();
    expect(mockedPush).toHaveBeenCalledWith({
      profileId: 'driver-1',
      event: 'delivery:return_approved',
      orderId: 'order-123',
      orderNumber: 'CAT-001',
    });
  });

  it('reports VOIDED when the order moved on (no return executed, no push)', async () => {
    mockedApprove.mockResolvedValue({
      outcome: 'VOIDED',
      request: { ...dbRow, status: 'VOIDED' },
      reason: 'ORDER_ADVANCED',
    });

    const { PATCH } = await importRoute();
    const res = await PATCH(patchRequest({ action: 'approve' }), patchParams);

    expect(res!.status).toBe(200);
    const data = await res!.json();
    expect(data.status).toBe('VOIDED');
    expect(data.reason).toBe('ORDER_ADVANCED');

    await flush();
    expect(mockedPush).not.toHaveBeenCalled();
  });

  it('rejects: marks the request and pushes to the driver', async () => {
    mockedReject.mockResolvedValue({ ...dbRow, status: 'REJECTED' });

    const { PATCH } = await importRoute();
    const res = await PATCH(
      patchRequest({ action: 'reject', notes: 'Too close to pickup' }),
      patchParams,
    );

    expect(res!.status).toBe(200);
    const data = await res!.json();
    expect(data.status).toBe('REJECTED');
    expect(mockedReject).toHaveBeenCalledWith(REQUEST_ID, RESOLVER_ID, 'Too close to pickup');

    await flush();
    expect(mockedPush).toHaveBeenCalledWith({
      profileId: 'driver-1',
      event: 'delivery:return_rejected',
      orderId: 'order-123',
      orderNumber: 'CAT-001',
    });
  });

  it('maps ReturnGuardError to its HTTP status (e.g. already resolved)', async () => {
    mockedApprove.mockRejectedValue(
      new ReturnGuardError(409, 'ALREADY_RESOLVED', 'This request was already rejected.'),
    );

    const { PATCH } = await importRoute();
    const res = await PATCH(patchRequest({ action: 'approve' }), patchParams);

    expect(res!.status).toBe(409);
    const data = await res!.json();
    expect(data.code).toBe('ALREADY_RESOLVED');
  });

  it('maps a 404 for an unknown request id', async () => {
    mockedApprove.mockRejectedValue(
      new ReturnGuardError(404, 'NOT_FOUND', 'Return request not found'),
    );
    const { PATCH } = await importRoute();
    const res = await PATCH(patchRequest({ action: 'approve' }), patchParams);
    expect(res!.status).toBe(404);
  });
});
