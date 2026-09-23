/**
 * Round-trip budget for the driver status PATCH (2026-09-22 field feedback:
 * every driver transition got slow once the app moved to a VPS ~150 ms from
 * the database). Independent lookups must be in flight together; the
 * authorization and gate outcomes are covered by order-by-number.test.ts.
 */

import { PATCH } from '@/app/api/orders/[order_number]/route';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { createPatchRequest } from '@/__tests__/helpers/api-test-helpers';
import {
  resolveOpenShiftIdForDriver,
  resolveOpenShiftIdForUser,
} from '@/services/tracking/active-shift';
import { voidPendingReturnRequests } from '@/lib/services/return-requests';

jest.mock('@/utils/prismaDB', () => {
  const prisma: any = {
    cateringRequest: { findFirst: jest.fn(), update: jest.fn() },
    onDemand: { findFirst: jest.fn(), update: jest.fn() },
    delivery: { findFirst: jest.fn(), upsert: jest.fn(), findUnique: jest.fn() },
    driver: { findFirst: jest.fn() },
    fileUpload: { findFirst: jest.fn() },
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  return { prisma };
});

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(async () => {
    const channel = {
      subscribe: (cb: (status: string) => void) => {
        cb('SUBSCRIBED');
        return channel;
      },
      send: async () => 'ok',
    };
    return { channel: () => channel, removeChannel: async () => undefined };
  }),
}));

jest.mock('@/services/tracking/active-shift', () => ({
  resolveOpenShiftIdForDriver: jest.fn(),
  resolveOpenShiftIdForUser: jest.fn(),
}));

jest.mock('@/lib/services/return-requests', () => ({
  ...jest.requireActual('@/lib/services/return-requests'),
  voidPendingReturnRequests: jest.fn(),
}));

jest.mock('@/services/notifications/delivery-status', () => ({
  sendDispatchStatusNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api/after-response', () => ({ runAfterResponse: jest.fn() }));

const DRIVER_USER = 'driver-profile-1';

const order = {
  id: 'order-1',
  orderNumber: 'CATER-001',
  status: 'ASSIGNED',
  driverStatus: 'ARRIVED_AT_VENDOR',
  user: { name: 'Client', email: 'c@example.com' },
  pickupAddress: {},
  deliveryAddress: { street1: '1 Main St' },
  dispatches: [{ driver: { id: DRIVER_USER, name: 'D' } }],
  fileUploads: [],
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

const profileSingle = jest.fn();
const supabase = {
  auth: { getUser: jest.fn() },
  from: jest.fn(() => ({
    select: () => ({ eq: () => ({ single: profileSingle }) }),
  })),
};

const patch = (body: Record<string, unknown>) =>
  PATCH(createPatchRequest('http://localhost:3000/api/orders/CATER-001', body), {
    params: Promise.resolve({ order_number: 'CATER-001' }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (createClient as jest.Mock).mockResolvedValue(supabase);
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: DRIVER_USER } } });
  profileSingle.mockResolvedValue({ data: { type: 'DRIVER' }, error: null });
  (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(order);
  (prisma.onDemand.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.cateringRequest.update as jest.Mock).mockImplementation(async ({ data }: any) => ({
    ...order,
    ...data,
  }));
  (prisma.delivery.upsert as jest.Mock).mockResolvedValue({});
  (prisma.delivery.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.fileUpload.findFirst as jest.Mock).mockResolvedValue({ id: 'sig' });
  (prisma.delivery.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.driver.findFirst as jest.Mock).mockResolvedValue({ id: 'driver-row-1' });
  (resolveOpenShiftIdForUser as jest.Mock).mockResolvedValue('shift-1');
  (resolveOpenShiftIdForDriver as jest.Mock).mockResolvedValue('shift-1');
  (voidPendingReturnRequests as jest.Mock).mockResolvedValue(0);
});

describe('PATCH /api/orders/[order_number] round trips', () => {
  it('looks up the caller role and both order tables together', async () => {
    const catering = deferred<unknown>();
    (prisma.cateringRequest.findFirst as jest.Mock).mockReturnValue(catering.promise);

    const pending = patch({ driverStatus: 'PICKED_UP' });
    await flush();
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(prisma.onDemand.findFirst).toHaveBeenCalledTimes(1);

    catering.resolve(order);
    expect((await pending).status).toBe(200);
    // One role lookup per request, even though it is used by two checks.
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('still prefers the catering order when both tables match', async () => {
    (prisma.onDemand.findFirst as jest.Mock).mockResolvedValue({ ...order, id: 'od-1' });
    const res = await patch({ driverStatus: 'PICKED_UP' });
    expect(res.status).toBe(200);
    expect(prisma.cateringRequest.update).toHaveBeenCalled();
    expect(prisma.onDemand.update).not.toHaveBeenCalled();
  });

  it('ignores an on-demand lookup failure when the catering order matched', async () => {
    (prisma.onDemand.findFirst as jest.Mock).mockRejectedValue(new Error('on-demand down'));
    const res = await patch({ driverStatus: 'PICKED_UP' });
    expect(res.status).toBe(200);
    expect(prisma.cateringRequest.update).toHaveBeenCalled();
  });

  it('surfaces an on-demand lookup failure when no catering order matched', async () => {
    (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.onDemand.findFirst as jest.Mock).mockRejectedValue(new Error('on-demand down'));
    const res = await patch({ driverStatus: 'PICKED_UP' });
    expect(res.status).toBe(500);
  });

  it('resolves the deliveries-mirror driver and shift while the shift gate runs', async () => {
    const gate = deferred<string | null>();
    (resolveOpenShiftIdForUser as jest.Mock).mockReturnValue(gate.promise);

    const pending = patch({ driverStatus: 'PICKED_UP' });
    await flush();
    expect(prisma.driver.findFirst).toHaveBeenCalledTimes(1);

    gate.resolve('shift-1');
    expect((await pending).status).toBe(200);
    expect(prisma.delivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ driverId: 'driver-row-1', shiftId: 'shift-1' }),
      }),
    );
  });

  it('keeps the shift gate authoritative when the mirror lookup ran early', async () => {
    (resolveOpenShiftIdForUser as jest.Mock).mockResolvedValue(null);
    const res = await patch({ driverStatus: 'PICKED_UP' });
    expect(res.status).toBe(422);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reads back delivery timestamps while pending return requests are voided', async () => {
    const voided = deferred<number>();
    (voidPendingReturnRequests as jest.Mock).mockReturnValue(voided.promise);

    const pending = patch({ driverStatus: 'PICKED_UP' });
    await flush();
    expect(prisma.delivery.findFirst).toHaveBeenCalledTimes(1);

    voided.resolve(1);
    expect((await pending).status).toBe(200);
  });
});
