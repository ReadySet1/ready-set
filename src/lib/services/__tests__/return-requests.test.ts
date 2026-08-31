/**
 * Tests for the return-request domain service (helpdesk approval flow).
 *
 * - createReturnRequest: driver guards (own dispatch, pre-pickup, non-terminal),
 *   PENDING insert, idempotent repeat, partial-unique-index race.
 * - approveReturnRequest: executes the shared unwind and marks APPROVED; a
 *   stale request (order advanced / unassigned / terminal) is VOIDED instead.
 * - rejectReturnRequest: marks REJECTED without touching the assignment.
 * - voidPendingReturnRequests: bulk-voids PENDING rows for an order.
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $transaction: jest.fn(),
    deliveryReturnRequest: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));
jest.mock('@/lib/state-machine/transition', () => ({
  returnOrderToDispatch: jest.fn(),
}));
jest.mock('@/lib/services/partner-registry', () => ({
  getPartnerByOrderNumber: jest.fn(),
}));

import { Prisma } from '@prisma/client';
import { prisma } from '@/utils/prismaDB';
import { returnOrderToDispatch } from '@/lib/state-machine/transition';
import { getPartnerByOrderNumber } from '@/lib/services/partner-registry';
import {
  ReturnGuardError,
  approveReturnRequest,
  createReturnRequest,
  rejectReturnRequest,
  voidPendingReturnRequests,
} from '../return-requests';

const mockedPrisma = prisma as any;
const mockedReturnOrder = returnOrderToDispatch as jest.Mock;
const mockedGetPartner = getPartnerByOrderNumber as jest.Mock;

const ORDER_ID = 'order-123';
const DRIVER_ID = 'driver-profile-1';
const RESOLVER_ID = 'helpdesk-1';
const REQUEST_ID = 'request-1';

const makeTx = () => ({
  cateringRequest: { findFirst: jest.fn() },
  onDemand: { findFirst: jest.fn() },
  dispatch: { findMany: jest.fn(), deleteMany: jest.fn() },
  delivery: { updateMany: jest.fn() },
  orderStatusHistory: { create: jest.fn() },
  deliveryReturnRequest: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});
let tx: ReturnType<typeof makeTx>;

const baseOrder = {
  id: ORDER_ID,
  orderNumber: 'CAT-001',
  status: 'ASSIGNED',
  driverStatus: 'ASSIGNED',
};

const pendingRequest = {
  id: REQUEST_ID,
  orderType: 'catering',
  orderId: ORDER_ID,
  orderNumber: 'CAT-001',
  driverId: DRIVER_ID,
  reason: 'VEHICLE_ISSUE',
  details: 'Flat tire',
  status: 'PENDING',
  requestedAt: new Date('2026-08-14T10:00:00Z'),
  resolvedAt: null,
  resolvedBy: null,
  resolutionNotes: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  tx = makeTx();
  tx.cateringRequest.findFirst.mockResolvedValue(baseOrder);
  tx.onDemand.findFirst.mockResolvedValue(null);
  tx.dispatch.findMany.mockResolvedValue([{ id: 'dispatch-1', driverId: DRIVER_ID }]);
  tx.dispatch.deleteMany.mockResolvedValue({ count: 1 });
  tx.delivery.updateMany.mockResolvedValue({ count: 1 });
  tx.orderStatusHistory.create.mockResolvedValue({ id: 'hist-1' });
  tx.deliveryReturnRequest.findFirst.mockResolvedValue(null);
  tx.deliveryReturnRequest.findUnique.mockResolvedValue(pendingRequest);
  tx.deliveryReturnRequest.create.mockResolvedValue(pendingRequest);
  tx.deliveryReturnRequest.update.mockImplementation(async ({ data }: any) => ({
    ...pendingRequest,
    ...data,
  }));
  (mockedPrisma.$transaction as jest.Mock).mockImplementation(
    async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
  );
  mockedGetPartner.mockResolvedValue(null);
});

const baseParams = {
  orderType: 'catering' as const,
  orderId: ORDER_ID,
  driverId: DRIVER_ID,
  reason: 'VEHICLE_ISSUE' as const,
  details: 'Flat tire',
};

describe('createReturnRequest', () => {
  it('inserts a PENDING row for the assigned driver pre-pickup', async () => {
    const result = await createReturnRequest(baseParams);

    expect(result.created).toBe(true);
    expect(result.dispatchId).toBe('dispatch-1');
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
    // The request does NOT unwind anything.
    expect(tx.dispatch.deleteMany).not.toHaveBeenCalled();
    expect(tx.delivery.updateMany).not.toHaveBeenCalled();
  });

  it('is idempotent: returns the existing PENDING request without creating', async () => {
    tx.deliveryReturnRequest.findFirst.mockResolvedValue(pendingRequest);

    const result = await createReturnRequest(baseParams);

    expect(result.created).toBe(false);
    expect(result.request.id).toBe(REQUEST_ID);
    expect(tx.deliveryReturnRequest.create).not.toHaveBeenCalled();
  });

  it('recovers from the partial-unique-index race by returning the winner', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('unique violation', {
      code: 'P2002',
      clientVersion: 'test',
    });
    tx.deliveryReturnRequest.create.mockRejectedValue(p2002);
    (mockedPrisma.deliveryReturnRequest.findFirst as jest.Mock).mockResolvedValue(
      pendingRequest,
    );

    const result = await createReturnRequest(baseParams);

    expect(result.created).toBe(false);
    expect(result.request.id).toBe(REQUEST_ID);
    // Re-read happens OUTSIDE the aborted transaction.
    expect(mockedPrisma.deliveryReturnRequest.findFirst).toHaveBeenCalledWith({
      where: { orderId: ORDER_ID, status: 'PENDING' },
    });
  });

  it('rejects when the order has no dispatch rows (NOT_ASSIGNED)', async () => {
    tx.dispatch.findMany.mockResolvedValue([]);
    await expect(createReturnRequest(baseParams)).rejects.toMatchObject({
      status: 409,
      code: 'NOT_ASSIGNED',
    });
  });

  it('rejects a driver who is not assigned to the order (403)', async () => {
    tx.dispatch.findMany.mockResolvedValue([{ id: 'dispatch-1', driverId: 'someone-else' }]);
    await expect(createReturnRequest(baseParams)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_YOUR_ORDER',
    });
  });

  it('rejects post-pickup requests (409 POST_PICKUP)', async () => {
    tx.cateringRequest.findFirst.mockResolvedValue({
      ...baseOrder,
      driverStatus: 'PICKED_UP',
    });
    await expect(createReturnRequest(baseParams)).rejects.toMatchObject({
      status: 409,
      code: 'POST_PICKUP',
    });
    expect(tx.deliveryReturnRequest.create).not.toHaveBeenCalled();
  });

  it('rejects terminal orders (409 TERMINAL)', async () => {
    tx.cateringRequest.findFirst.mockResolvedValue({
      ...baseOrder,
      status: 'COMPLETED',
    });
    await expect(createReturnRequest(baseParams)).rejects.toMatchObject({
      status: 409,
      code: 'TERMINAL',
    });
  });
});

describe('approveReturnRequest', () => {
  it('executes the shared unwind and marks the request APPROVED', async () => {
    const result = await approveReturnRequest(REQUEST_ID, RESOLVER_ID);

    expect(result.outcome).toBe('APPROVED');
    if (result.outcome !== 'APPROVED') throw new Error('unreachable');
    expect(result.orderNumber).toBe('CAT-001');
    expect(result.driverId).toBe(DRIVER_ID);
    expect(result.dispatchId).toBe('dispatch-1');

    // Mirror tombstone with the durable reason from the request.
    expect(tx.delivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orderNumber: 'CAT-001', deletedAt: null }),
        data: expect.objectContaining({
          status: 'CANCELLED',
          deliveryNotes: expect.stringContaining('VEHICLE_ISSUE'),
        }),
      }),
    );
    expect(tx.delivery.updateMany.mock.calls[0][0].data.deliveryNotes).toContain('Flat tire');

    expect(tx.dispatch.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cateringRequestId: ORDER_ID } }),
    );
    expect(mockedReturnOrder).toHaveBeenCalledWith(tx, 'catering', ORDER_ID);

    // Non-partner catering order gets the audit row, attributed to the resolver.
    expect(tx.orderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cateringRequestId: ORDER_ID,
          partnerStatus: 'RETURNED_TO_DISPATCH',
          changedBy: RESOLVER_ID,
        }),
      }),
    );

    expect(tx.deliveryReturnRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REQUEST_ID },
        data: expect.objectContaining({
          status: 'APPROVED',
          resolvedBy: RESOLVER_ID,
          resolvedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('voids the request instead when the driver advanced past pickup', async () => {
    tx.cateringRequest.findFirst.mockResolvedValue({
      ...baseOrder,
      driverStatus: 'PICKED_UP',
    });

    const result = await approveReturnRequest(REQUEST_ID, RESOLVER_ID);

    expect(result.outcome).toBe('VOIDED');
    if (result.outcome !== 'VOIDED') throw new Error('unreachable');
    expect(result.reason).toBe('ORDER_ADVANCED');
    // No unwind ran.
    expect(tx.dispatch.deleteMany).not.toHaveBeenCalled();
    expect(mockedReturnOrder).not.toHaveBeenCalled();
    expect(tx.deliveryReturnRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'VOIDED', resolvedBy: RESOLVER_ID }),
      }),
    );
  });

  it('voids the request when the requesting driver is no longer assigned', async () => {
    tx.dispatch.findMany.mockResolvedValue([{ id: 'dispatch-2', driverId: 'another-driver' }]);

    const result = await approveReturnRequest(REQUEST_ID, RESOLVER_ID);

    expect(result.outcome).toBe('VOIDED');
    if (result.outcome !== 'VOIDED') throw new Error('unreachable');
    expect(result.reason).toBe('NOT_ASSIGNED');
    expect(tx.dispatch.deleteMany).not.toHaveBeenCalled();
  });

  it('voids the request when the order became terminal', async () => {
    tx.cateringRequest.findFirst.mockResolvedValue({
      ...baseOrder,
      status: 'CANCELLED',
    });

    const result = await approveReturnRequest(REQUEST_ID, RESOLVER_ID);

    expect(result.outcome).toBe('VOIDED');
    if (result.outcome !== 'VOIDED') throw new Error('unreachable');
    expect(result.reason).toBe('TERMINAL');
  });

  it('throws 404 for an unknown request id', async () => {
    tx.deliveryReturnRequest.findUnique.mockResolvedValue(null);
    await expect(approveReturnRequest(REQUEST_ID, RESOLVER_ID)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('throws 409 ALREADY_RESOLVED for a non-PENDING request', async () => {
    tx.deliveryReturnRequest.findUnique.mockResolvedValue({
      ...pendingRequest,
      status: 'REJECTED',
    });
    await expect(approveReturnRequest(REQUEST_ID, RESOLVER_ID)).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_RESOLVED',
    });
    expect(tx.deliveryReturnRequest.update).not.toHaveBeenCalled();
  });
});

describe('rejectReturnRequest', () => {
  it('marks the request REJECTED with the resolver and notes', async () => {
    const rejected = await rejectReturnRequest(REQUEST_ID, RESOLVER_ID, 'Too close to pickup');

    expect(rejected.status).toBe('REJECTED');
    expect(tx.deliveryReturnRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REQUEST_ID },
        data: expect.objectContaining({
          status: 'REJECTED',
          resolvedBy: RESOLVER_ID,
          resolutionNotes: 'Too close to pickup',
        }),
      }),
    );
    // The assignment stays untouched.
    expect(tx.dispatch.deleteMany).not.toHaveBeenCalled();
    expect(tx.delivery.updateMany).not.toHaveBeenCalled();
  });

  it('throws 409 ALREADY_RESOLVED for a non-PENDING request', async () => {
    tx.deliveryReturnRequest.findUnique.mockResolvedValue({
      ...pendingRequest,
      status: 'APPROVED',
    });
    await expect(rejectReturnRequest(REQUEST_ID, RESOLVER_ID)).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_RESOLVED',
    });
  });
});

describe('voidPendingReturnRequests', () => {
  it('voids every PENDING request for the order', async () => {
    (mockedPrisma.deliveryReturnRequest.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    const count = await voidPendingReturnRequests(ORDER_ID);

    expect(count).toBe(1);
    expect(mockedPrisma.deliveryReturnRequest.updateMany).toHaveBeenCalledWith({
      where: { orderId: ORDER_ID, status: 'PENDING' },
      data: expect.objectContaining({
        status: 'VOIDED',
        resolvedAt: expect.any(Date),
        resolutionNotes: expect.stringContaining('Auto-voided'),
      }),
    });
  });
});

describe('ReturnGuardError', () => {
  it('carries the HTTP status and code', () => {
    const err = new ReturnGuardError(409, 'TERMINAL', 'done');
    expect(err.status).toBe(409);
    expect(err.code).toBe('TERMINAL');
    expect(err.name).toBe('ReturnGuardError');
  });
});
