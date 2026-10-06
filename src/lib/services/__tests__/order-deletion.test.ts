/**
 * Tests for the order soft-delete service (REA-342 single, REA-343 bulk).
 *
 * - The order row is kept: deletedAt / deletedBy / deletionReason are stamped.
 * - Driver-side rows follow the cancel cascade: dispatch rows are removed and
 *   the live `deliveries` mirror is closed, and an assigned driver is told.
 * - file_uploads rows are removed in the transaction; storage objects are
 *   removed after it commits, from the bucket and path the file really lives
 *   at, and anything left behind is reported as an orphan.
 * - Missing and already-deleted orders are outcomes, not exceptions.
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: { $transaction: jest.fn() },
}));
jest.mock('@/utils/supabase/server', () => ({
  createAdminClient: jest.fn(),
}));
jest.mock('@/lib/state-machine/transition', () => ({
  returnOrderToDispatch: jest.fn(),
}));
jest.mock('@/lib/services/partner-registry', () => ({
  getPartnerByOrderNumber: jest.fn(),
}));
jest.mock('@/services/notifications/driver-cancellation', () => ({
  notifyDriverOrderCancelled: jest.fn().mockResolvedValue({ sms: 'sent' }),
}));
jest.mock('@/lib/realtime/server-broadcast', () => ({
  broadcastDeliveryStatus: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/api/after-response', () => ({
  runAfterResponse: jest.fn((_label: string, work: () => Promise<unknown>) => {
    void work();
  }),
}));

import { prisma } from '@/utils/prismaDB';
import { createAdminClient } from '@/utils/supabase/server';
import { notifyDriverOrderCancelled } from '@/services/notifications/driver-cancellation';
import { broadcastDeliveryStatus } from '@/lib/realtime/server-broadcast';
import {
  parseStorageUrl,
  softDeleteOrder,
  softDeleteOrders,
} from '../order-deletion';

const mockedPrisma = prisma as any;
const mockedCreateAdminClient = createAdminClient as jest.Mock;
const mockedNotify = notifyDriverOrderCancelled as jest.Mock;
const mockedBroadcast = broadcastDeliveryStatus as jest.Mock;

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const DRIVER_ID = '33333333-3333-4333-8333-333333333333';
const ACTOR = { deletedBy: ADMIN_ID };

const makeTx = () => ({
  cateringRequest: { findFirst: jest.fn(), updateMany: jest.fn() },
  onDemand: { findFirst: jest.fn(), updateMany: jest.fn() },
  dispatch: { findMany: jest.fn(), deleteMany: jest.fn() },
  delivery: { updateMany: jest.fn() },
  fileUpload: { findMany: jest.fn(), deleteMany: jest.fn() },
});
let tx: ReturnType<typeof makeTx>;

/** One `remove` mock per bucket, so tests can assert the bucket used. */
let removeByBucket: Record<string, jest.Mock>;
let storageFrom: jest.Mock;

/** Default storage behaviour: every requested object is reported removed. */
const removeEverything = () =>
  jest.fn(async (paths: string[]) => ({
    data: paths.map((name) => ({ name })),
    error: null,
  }));

const liveOrder = {
  id: ORDER_ID,
  orderNumber: 'CAT-001',
  status: 'ASSIGNED',
  driverStatus: 'ASSIGNED',
};

const assignedDispatch = {
  id: 'dispatch-1',
  driver: { id: DRIVER_ID, name: 'Dana Driver', contactNumber: '+15550001111' },
};

/** A live catering order with no driver and no files. */
const primeLiveCatering = () => {
  tx.cateringRequest.findFirst.mockResolvedValueOnce(liveOrder);
  tx.cateringRequest.updateMany.mockResolvedValue({ count: 1 });
  tx.dispatch.findMany.mockResolvedValue([]);
  tx.dispatch.deleteMany.mockResolvedValue({ count: 0 });
  tx.delivery.updateMany.mockResolvedValue({ count: 0 });
  tx.fileUpload.findMany.mockResolvedValue([]);
  tx.fileUpload.deleteMany.mockResolvedValue({ count: 0 });
};

beforeEach(() => {
  jest.clearAllMocks();
  tx = makeTx();
  mockedPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

  removeByBucket = {};
  storageFrom = jest.fn((bucket: string) => {
    removeByBucket[bucket] ??= removeEverything();
    return { remove: removeByBucket[bucket] };
  });
  mockedCreateAdminClient.mockResolvedValue({ storage: { from: storageFrom } });

  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('parseStorageUrl', () => {
  it('reads bucket and full path from a signed URL, dropping the token', () => {
    expect(
      parseStorageUrl(
        'https://proj.supabase.co/storage/v1/object/sign/fileUploader/orders/catering/abc/menu.pdf?token=secret',
      ),
    ).toEqual({ bucket: 'fileUploader', path: 'orders/catering/abc/menu.pdf' });
  });

  it('reads bucket and full path from a public URL and decodes it', () => {
    expect(
      parseStorageUrl(
        'https://proj.supabase.co/storage/v1/object/public/delivery-proofs/deliveries/abc/proof%20one.jpg',
      ),
    ).toEqual({ bucket: 'delivery-proofs', path: 'deliveries/abc/proof one.jpg' });
  });

  it('returns null for anything that is not a storage object URL', () => {
    expect(parseStorageUrl('https://utfs.io/f/some-key.pdf')).toBeNull();
    expect(parseStorageUrl('menu.pdf')).toBeNull();
    expect(parseStorageUrl('')).toBeNull();
  });
});

describe('softDeleteOrder', () => {
  it('soft-deletes a catering order: stamps deletedAt/deletedBy/deletionReason and keeps the row', async () => {
    primeLiveCatering();

    const result = await softDeleteOrder(
      { orderType: 'catering', orderId: ORDER_ID },
      { deletedBy: ADMIN_ID, reason: 'Duplicate order' },
    );

    expect(tx.cateringRequest.updateMany).toHaveBeenCalledWith({
      where: { id: ORDER_ID, deletedAt: null },
      data: {
        deletedAt: expect.any(Date),
        deletedBy: ADMIN_ID,
        deletionReason: 'Duplicate order',
      },
    });
    expect(result).toMatchObject({
      outcome: 'DELETED',
      orderType: 'catering',
      orderId: ORDER_ID,
      orderNumber: 'CAT-001',
      deletedAt: expect.any(Date),
      deletedBy: ADMIN_ID,
      deletedDispatches: 0,
      deletedFiles: 0,
      orphanedFiles: [],
    });
    // The row is never physically deleted.
    expect((tx.cateringRequest as any).delete).toBeUndefined();
  });

  it('soft-deletes an on-demand order through its own table', async () => {
    tx.onDemand.findFirst.mockResolvedValueOnce({ ...liveOrder, orderNumber: 'OD-001' });
    tx.onDemand.updateMany.mockResolvedValue({ count: 1 });
    tx.dispatch.findMany.mockResolvedValue([]);
    tx.fileUpload.findMany.mockResolvedValue([]);

    const result = await softDeleteOrder({ orderType: 'on_demand', orderId: ORDER_ID }, ACTOR);

    expect(tx.onDemand.updateMany).toHaveBeenCalledWith({
      where: { id: ORDER_ID, deletedAt: null },
      data: { deletedAt: expect.any(Date), deletedBy: ADMIN_ID, deletionReason: null },
    });
    expect(tx.cateringRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.dispatch.deleteMany).toHaveBeenCalledWith({ where: { onDemandId: ORDER_ID } });
    expect(tx.fileUpload.deleteMany).toHaveBeenCalledWith({ where: { onDemandId: ORDER_ID } });
    expect(result).toMatchObject({ outcome: 'DELETED', orderType: 'on_demand', orderNumber: 'OD-001' });
  });

  it('runs the cancel cascade: removes dispatch rows and closes the live deliveries mirror', async () => {
    primeLiveCatering();
    tx.dispatch.findMany.mockResolvedValue([assignedDispatch]);

    const result = await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(tx.dispatch.deleteMany).toHaveBeenCalledWith({
      where: { cateringRequestId: ORDER_ID },
    });
    // Same statement as the admin cancel: a leftover ASSIGNED mirror row is
    // what deadlocks the driver's End Shift.
    expect(tx.delivery.updateMany).toHaveBeenCalledWith({
      where: {
        orderNumber: 'CAT-001',
        deletedAt: null,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'DELIVERED'] },
      },
      data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
    });
    expect(result).toMatchObject({ outcome: 'DELETED', deletedDispatches: 1 });
  });

  it('tells the assigned driver exactly as a cancel does (SMS + realtime CANCELLED)', async () => {
    primeLiveCatering();
    tx.dispatch.findMany.mockResolvedValue([assignedDispatch]);

    await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(mockedNotify).toHaveBeenCalledWith({
      driverProfileId: DRIVER_ID,
      driverName: 'Dana Driver',
      phone: '+15550001111',
      orderNumber: 'CAT-001',
      orderType: 'catering',
    });
    expect(mockedBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        orderNumber: 'CAT-001',
        orderType: 'catering',
        driverId: DRIVER_ID,
        status: 'CANCELLED',
        previousStatus: 'ASSIGNED',
      }),
    );
  });

  it('does not alert anyone when no driver is assigned', async () => {
    primeLiveCatering();

    await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(mockedNotify).not.toHaveBeenCalled();
    expect(mockedBroadcast).not.toHaveBeenCalled();
  });

  it('does not send a "cancelled" alert for an order that was already finished', async () => {
    tx.cateringRequest.findFirst.mockResolvedValueOnce({
      ...liveOrder,
      status: 'COMPLETED',
      driverStatus: 'COMPLETED',
    });
    tx.cateringRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.dispatch.findMany.mockResolvedValue([assignedDispatch]);
    tx.fileUpload.findMany.mockResolvedValue([]);

    const result = await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(result).toMatchObject({ outcome: 'DELETED', deletedDispatches: 1 });
    expect(mockedNotify).not.toHaveBeenCalled();
    expect(mockedBroadcast).not.toHaveBeenCalled();
  });

  it('removes file rows in the transaction and the objects from fileUploader at their stored path', async () => {
    primeLiveCatering();
    tx.fileUpload.findMany.mockResolvedValue([
      {
        id: 'file-1',
        fileName: 'menu.pdf',
        filePath: `orders/catering/${ORDER_ID}/menu.pdf`,
        fileUrl: `https://proj.supabase.co/storage/v1/object/sign/fileUploader/orders/catering/${ORDER_ID}/menu.pdf?token=t`,
      },
    ]);
    tx.fileUpload.deleteMany.mockResolvedValue({ count: 1 });

    const result = await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(tx.fileUpload.deleteMany).toHaveBeenCalledWith({
      where: { cateringRequestId: ORDER_ID },
    });
    expect(storageFrom).toHaveBeenCalledTimes(1);
    expect(storageFrom).toHaveBeenCalledWith('fileUploader');
    expect(storageFrom).not.toHaveBeenCalledWith('order-files');
    expect(removeByBucket.fileUploader).toHaveBeenCalledWith([
      `orders/catering/${ORDER_ID}/menu.pdf`,
    ]);
    expect(result).toMatchObject({ outcome: 'DELETED', deletedFiles: 1, orphanedFiles: [] });
  });

  it('parses the full path from fileUrl when filePath is missing — never just the file name', async () => {
    primeLiveCatering();
    tx.fileUpload.findMany.mockResolvedValue([
      {
        id: 'file-1',
        fileName: 'menu.pdf',
        filePath: null,
        fileUrl: `https://proj.supabase.co/storage/v1/object/public/fileUploader/catering_order/${ORDER_ID}/menu.pdf`,
      },
    ]);

    const result = await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(removeByBucket.fileUploader).toHaveBeenCalledWith([
      `catering_order/${ORDER_ID}/menu.pdf`,
    ]);
    expect(removeByBucket.fileUploader).not.toHaveBeenCalledWith(['menu.pdf']);
    expect(result).toMatchObject({ outcome: 'DELETED', orphanedFiles: [] });
  });

  it('also tries the fileUrl path when filePath went stale after a move', async () => {
    primeLiveCatering();
    const stalePath = 'orders/catering/temp-123/menu.pdf';
    const movedPath = `catering_order/${ORDER_ID}/menu.pdf`;
    tx.fileUpload.findMany.mockResolvedValue([
      {
        id: 'file-1',
        fileName: 'menu.pdf',
        filePath: stalePath,
        fileUrl: `https://proj.supabase.co/storage/v1/object/public/fileUploader/${movedPath}`,
      },
    ]);
    // Only the moved object exists; the stale path removes nothing.
    removeByBucket.fileUploader = jest.fn(async () => ({
      data: [{ name: movedPath }],
      error: null,
    }));

    const result = await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(removeByBucket.fileUploader).toHaveBeenCalledWith([stalePath, movedPath]);
    expect(result).toMatchObject({ outcome: 'DELETED', orphanedFiles: [] });
  });

  it('removes proof-of-delivery files from the bucket named in their URL', async () => {
    primeLiveCatering();
    tx.fileUpload.findMany.mockResolvedValue([
      {
        id: 'file-pod',
        fileName: 'proof.jpg',
        filePath: `deliveries/${ORDER_ID}/proof.jpg`,
        fileUrl: `https://proj.supabase.co/storage/v1/object/public/delivery-proofs/deliveries/${ORDER_ID}/proof.jpg`,
      },
    ]);

    await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(storageFrom).toHaveBeenCalledWith('delivery-proofs');
    expect(removeByBucket['delivery-proofs']).toHaveBeenCalledWith([
      `deliveries/${ORDER_ID}/proof.jpg`,
    ]);
    expect(storageFrom).not.toHaveBeenCalledWith('fileUploader');
  });

  it('touches storage only after the database transaction has committed', async () => {
    primeLiveCatering();
    tx.fileUpload.findMany.mockResolvedValue([
      { id: 'file-1', fileName: 'menu.pdf', filePath: 'orders/catering/x/menu.pdf', fileUrl: 'x' },
    ]);
    let committed = false;
    mockedPrisma.$transaction.mockImplementation(async (cb: any) => {
      const value = await cb(tx);
      committed = true;
      return value;
    });
    storageFrom.mockImplementation(() => ({
      remove: jest.fn(async (paths: string[]) => {
        expect(committed).toBe(true);
        return { data: paths.map((name) => ({ name })), error: null };
      }),
    }));

    const result = await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(storageFrom).toHaveBeenCalled();
    expect(result).toMatchObject({ outcome: 'DELETED', orphanedFiles: [] });
  });

  it('leaves storage alone when the transaction fails', async () => {
    primeLiveCatering();
    tx.fileUpload.findMany.mockResolvedValue([
      { id: 'file-1', fileName: 'menu.pdf', filePath: 'orders/catering/x/menu.pdf', fileUrl: 'x' },
    ]);
    tx.fileUpload.deleteMany.mockRejectedValue(new Error('db down'));

    await expect(
      softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR),
    ).rejects.toThrow('db down');

    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
    expect(mockedNotify).not.toHaveBeenCalled();
  });

  it('reports a storage error as an orphan instead of swallowing it', async () => {
    primeLiveCatering();
    const path = `orders/catering/${ORDER_ID}/menu.pdf`;
    tx.fileUpload.findMany.mockResolvedValue([
      { id: 'file-1', fileName: 'menu.pdf', filePath: path, fileUrl: 'x' },
    ]);
    removeByBucket.fileUploader = jest.fn(async () => ({
      data: null,
      error: { message: 'permission denied' },
    }));

    const result = await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(result).toMatchObject({
      outcome: 'DELETED',
      deletedFiles: 1,
      orphanedFiles: [
        {
          fileId: 'file-1',
          fileName: 'menu.pdf',
          bucket: 'fileUploader',
          paths: [path],
          reason: 'REMOVE_FAILED',
          detail: 'permission denied',
        },
      ],
    });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[order-deletion] orphaned storage object'),
      expect.objectContaining({ orderId: ORDER_ID, fileId: 'file-1', bucket: 'fileUploader' }),
    );
  });

  it('reports an orphan when the storage call throws', async () => {
    primeLiveCatering();
    tx.fileUpload.findMany.mockResolvedValue([
      { id: 'file-1', fileName: 'menu.pdf', filePath: 'orders/catering/x/menu.pdf', fileUrl: 'x' },
    ]);
    removeByBucket.fileUploader = jest.fn(async () => {
      throw new Error('network down');
    });

    const result = await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(result).toMatchObject({
      outcome: 'DELETED',
      orphanedFiles: [{ fileId: 'file-1', reason: 'REMOVE_FAILED', detail: 'network down' }],
    });
  });

  it('reports an orphan when storage did not confirm removing the object', async () => {
    primeLiveCatering();
    tx.fileUpload.findMany.mockResolvedValue([
      { id: 'file-1', fileName: 'menu.pdf', filePath: 'orders/catering/x/menu.pdf', fileUrl: 'x' },
      { id: 'file-2', fileName: 'map.pdf', filePath: 'orders/catering/x/map.pdf', fileUrl: 'x' },
    ]);
    removeByBucket.fileUploader = jest.fn(async () => ({
      data: [{ name: 'orders/catering/x/map.pdf' }],
      error: null,
    }));

    const result = await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(result).toMatchObject({
      outcome: 'DELETED',
      orphanedFiles: [{ fileId: 'file-1', reason: 'NOT_FOUND_AT_STORED_PATH' }],
    });
  });

  it('reports an orphan when no storage path can be worked out, without guessing from the file name', async () => {
    primeLiveCatering();
    tx.fileUpload.findMany.mockResolvedValue([
      { id: 'file-1', fileName: 'menu.pdf', filePath: null, fileUrl: 'https://utfs.io/f/menu.pdf' },
    ]);

    const result = await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(storageFrom).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      outcome: 'DELETED',
      orphanedFiles: [
        { fileId: 'file-1', fileName: 'menu.pdf', bucket: null, paths: [], reason: 'PATH_UNRESOLVED' },
      ],
    });
  });

  it('returns NOT_FOUND for an order that does not exist and writes nothing', async () => {
    tx.cateringRequest.findFirst.mockResolvedValue(null);

    const result = await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(result).toEqual({ outcome: 'NOT_FOUND' });
    expect(tx.cateringRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.dispatch.deleteMany).not.toHaveBeenCalled();
    expect(tx.fileUpload.deleteMany).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND for a malformed id without querying the database', async () => {
    const result = await softDeleteOrder({ orderType: 'catering', orderId: 'not-a-uuid' }, ACTOR);

    expect(result).toEqual({ outcome: 'NOT_FOUND' });
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns ALREADY_DELETED for a soft-deleted order and leaves it untouched', async () => {
    tx.cateringRequest.findFirst
      .mockResolvedValueOnce(null) // no live row
      .mockResolvedValueOnce({ ...liveOrder }); // a deleted one exists

    const result = await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(tx.cateringRequest.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: ORDER_ID, deletedAt: null } }),
    );
    expect(tx.cateringRequest.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: ORDER_ID, deletedAt: { not: null } } }),
    );
    expect(result).toEqual({
      outcome: 'ALREADY_DELETED',
      orderType: 'catering',
      orderId: ORDER_ID,
      orderNumber: 'CAT-001',
    });
    expect(tx.cateringRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.dispatch.deleteMany).not.toHaveBeenCalled();
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns ALREADY_DELETED when a concurrent delete wins the race', async () => {
    primeLiveCatering();
    tx.cateringRequest.updateMany.mockResolvedValue({ count: 0 });

    const result = await softDeleteOrder({ orderType: 'catering', orderId: ORDER_ID }, ACTOR);

    expect(result).toMatchObject({ outcome: 'ALREADY_DELETED', orderId: ORDER_ID });
    expect(tx.dispatch.deleteMany).not.toHaveBeenCalled();
    expect(tx.fileUpload.deleteMany).not.toHaveBeenCalled();
  });

  it('resolves an order number to an on-demand order when no catering order has it', async () => {
    tx.cateringRequest.findFirst.mockResolvedValue(null);
    tx.onDemand.findFirst.mockResolvedValueOnce({ ...liveOrder, orderNumber: 'OD-777' });
    tx.onDemand.updateMany.mockResolvedValue({ count: 1 });
    tx.dispatch.findMany.mockResolvedValue([]);
    tx.fileUpload.findMany.mockResolvedValue([]);

    const result = await softDeleteOrder({ orderNumber: 'OD-777' }, ACTOR);

    expect(tx.onDemand.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderNumber: 'OD-777', deletedAt: null } }),
    );
    expect(result).toMatchObject({
      outcome: 'DELETED',
      orderType: 'on_demand',
      orderId: ORDER_ID,
      orderNumber: 'OD-777',
    });
  });
});

describe('softDeleteOrders (bulk)', () => {
  it('reports a per-order result for a mix of live, deleted, missing and failing orders', async () => {
    const byNumber: Record<string, 'live' | 'deleted' | 'missing' | 'boom'> = {
      'CAT-LIVE': 'live',
      'CAT-GONE': 'deleted',
      'CAT-NOPE': 'missing',
      'CAT-BOOM': 'boom',
    };
    tx.cateringRequest.findFirst.mockImplementation(async ({ where }: any) => {
      const kind = byNumber[where.orderNumber];
      if (kind === 'boom') throw new Error('connection reset');
      const wantsLive = where.deletedAt === null;
      if (kind === 'live' && wantsLive) return { ...liveOrder, orderNumber: where.orderNumber };
      if (kind === 'deleted' && !wantsLive) return { ...liveOrder, orderNumber: where.orderNumber };
      return null;
    });
    tx.onDemand.findFirst.mockResolvedValue(null);
    tx.cateringRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.dispatch.findMany.mockResolvedValue([]);
    tx.fileUpload.findMany.mockResolvedValue([]);

    const results = await softDeleteOrders(
      ['CAT-LIVE', 'CAT-GONE', 'CAT-NOPE', 'CAT-BOOM'],
      ACTOR,
    );

    expect(results.map((r) => [r.orderNumber, r.outcome])).toEqual([
      ['CAT-LIVE', 'DELETED'],
      ['CAT-GONE', 'ALREADY_DELETED'],
      ['CAT-NOPE', 'NOT_FOUND'],
      ['CAT-BOOM', 'FAILED'],
    ]);
    expect(results[3]).toMatchObject({ outcome: 'FAILED', reason: 'connection reset' });
    // One failing order does not stop the rest, and only the live one is written.
    expect(tx.cateringRequest.updateMany).toHaveBeenCalledTimes(1);
  });

  it('processes a repeated order number once', async () => {
    primeLiveCatering();

    const results = await softDeleteOrders(['CAT-001', 'CAT-001'], ACTOR);

    expect(results).toHaveLength(1);
    expect(tx.cateringRequest.updateMany).toHaveBeenCalledTimes(1);
  });
});
