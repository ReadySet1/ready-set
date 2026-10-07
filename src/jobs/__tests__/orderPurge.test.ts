/**
 * Order purge job: hard-deletes orders soft-deleted longer ago than the
 * retention window and removes their files from storage.
 *
 * - Only orders with deletedAt before the cutoff are selected, oldest first.
 * - Dry run selects and reports; nothing is written and storage is untouched.
 * - Per order, one transaction: dependent rows first, then the order row.
 * - Storage objects are removed after commit, from the bucket and path the
 *   file really lives at; anything left behind is reported as an orphan.
 * - One failing order never stops the batch.
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    cateringRequest: { findMany: jest.fn() },
    onDemand: { findMany: jest.fn() },
    fileUpload: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/utils/supabase/server', () => ({
  createAdminClient: jest.fn(),
}));

import { prisma } from '@/utils/prismaDB';
import { createAdminClient } from '@/utils/supabase/server';
import {
  DEFAULT_ORDER_PURGE_RETENTION_DAYS,
  parseStorageUrl,
  runOrderPurge,
} from '../orderPurge';

const mockedPrisma = prisma as any;
const mockedCreateAdminClient = createAdminClient as jest.Mock;

const CAT_ID = '11111111-1111-4111-8111-111111111111';
const OD_ID = '44444444-4444-4444-8444-444444444444';
const NOW = new Date('2026-10-06T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

const makeTx = () => ({
  deliveryReturnRequest: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  delivery: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  fileUpload: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  cateringRequest: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  onDemand: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
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

const cateringOrder = { id: CAT_ID, orderNumber: 'CAT-001', deletedAt: daysAgo(800) };
const onDemandOrder = { id: OD_ID, orderNumber: 'OD-001', deletedAt: daysAgo(900) };

const menuFile = {
  id: 'file-1',
  fileName: 'menu.pdf',
  filePath: `catering_order/${CAT_ID}/menu.pdf`,
  fileUrl: `https://proj.supabase.co/storage/v1/object/sign/fileUploader/catering_order/${CAT_ID}/menu.pdf?token=t`,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  tx = makeTx();
  mockedPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
  mockedPrisma.cateringRequest.findMany.mockResolvedValue([]);
  mockedPrisma.onDemand.findMany.mockResolvedValue([]);
  mockedPrisma.fileUpload.findMany.mockResolvedValue([]);

  removeByBucket = {};
  storageFrom = jest.fn((bucket: string) => {
    removeByBucket[bucket] ??= removeEverything();
    return { remove: removeByBucket[bucket] };
  });
  mockedCreateAdminClient.mockResolvedValue({ storage: { from: storageFrom } });

  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('parseStorageUrl', () => {
  it('reads bucket and full path from a signed URL, dropping the token', () => {
    expect(
      parseStorageUrl(
        'https://proj.supabase.co/storage/v1/object/sign/fileUploader/catering_order/temp-abc/menu.pdf?token=secret',
      ),
    ).toEqual({ bucket: 'fileUploader', path: 'catering_order/temp-abc/menu.pdf' });
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

describe('runOrderPurge selection', () => {
  it('defaults to a two-year retention window', () => {
    expect(DEFAULT_ORDER_PURGE_RETENTION_DAYS).toBe(730);
  });

  it('selects only soft-deleted orders past the cutoff, oldest first, up to the batch size', async () => {
    mockedPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
    mockedPrisma.onDemand.findMany.mockResolvedValue([onDemandOrder]);

    const result = await runOrderPurge({ retentionDays: 730, batchSize: 10 });

    const cutoff = daysAgo(730);
    for (const model of [mockedPrisma.cateringRequest, mockedPrisma.onDemand]) {
      expect(model.findMany).toHaveBeenCalledWith({
        where: { deletedAt: { not: null, lt: cutoff } },
        select: { id: true, orderNumber: true, deletedAt: true },
        orderBy: { deletedAt: 'asc' },
        take: 10,
      });
    }
    expect(result.cutoff).toEqual(cutoff);
    expect(result.retentionDays).toBe(730);
    expect(result.scanned).toBe(2);
    // The on-demand order was deleted earlier, so it goes first.
    expect(result.orders.map((o) => o.orderNumber)).toEqual(['OD-001', 'CAT-001']);
  });

  it('caps the merged batch at batchSize across both tables', async () => {
    mockedPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
    mockedPrisma.onDemand.findMany.mockResolvedValue([onDemandOrder]);

    const result = await runOrderPurge({ batchSize: 1, dryRun: true });

    expect(result.scanned).toBe(1);
    expect(result.orders.map((o) => o.orderNumber)).toEqual(['OD-001']);
  });

  it('never purges more recently than the minimum retention, whatever the override', async () => {
    const result = await runOrderPurge({ retentionDays: 0, dryRun: true });

    expect(result.retentionDays).toBeGreaterThanOrEqual(30);
    expect(mockedPrisma.cateringRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: { not: null, lt: daysAgo(result.retentionDays) } },
      }),
    );
  });

  it('succeeds with nothing to do when no order is past the cutoff', async () => {
    const result = await runOrderPurge();

    expect(result).toMatchObject({
      success: true,
      dryRun: false,
      retentionDays: DEFAULT_ORDER_PURGE_RETENTION_DAYS,
      scanned: 0,
      purged: 0,
      failed: 0,
      orphanedFiles: 0,
      orders: [],
    });
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('runOrderPurge dry run', () => {
  it('reports what would be purged and writes nothing', async () => {
    mockedPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
    mockedPrisma.fileUpload.findMany.mockResolvedValue([menuFile]);

    const result = await runOrderPurge({ dryRun: true });

    expect(result).toMatchObject({
      success: true,
      dryRun: true,
      scanned: 1,
      purged: 0,
      failed: 0,
      orphanedFiles: 0,
    });
    expect(result.orders).toEqual([
      {
        orderType: 'catering',
        orderId: CAT_ID,
        orderNumber: 'CAT-001',
        deletedAt: cateringOrder.deletedAt,
        outcome: 'WOULD_PURGE',
        files: 1,
      },
    ]);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });
});

describe('runOrderPurge hard delete', () => {
  it('deletes the dependent rows and then the catering order row in one transaction', async () => {
    mockedPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
    const calls: string[] = [];
    tx.deliveryReturnRequest.deleteMany.mockImplementation(async () => (calls.push('returnRequests'), { count: 1 }));
    tx.delivery.deleteMany.mockImplementation(async () => (calls.push('deliveries'), { count: 1 }));
    tx.dispatch.deleteMany.mockImplementation(async () => (calls.push('dispatches'), { count: 2 }));
    tx.fileUpload.deleteMany.mockImplementation(async () => (calls.push('files'), { count: 0 }));
    tx.cateringRequest.deleteMany.mockImplementation(async () => (calls.push('order'), { count: 1 }));

    const result = await runOrderPurge();

    expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.deliveryReturnRequest.deleteMany).toHaveBeenCalledWith({ where: { orderId: CAT_ID } });
    // The live mirror is keyed by order number and has its own soft delete:
    // every row for the order goes, deleted or not.
    expect(tx.delivery.deleteMany).toHaveBeenCalledWith({ where: { orderNumber: 'CAT-001' } });
    expect(tx.dispatch.deleteMany).toHaveBeenCalledWith({ where: { cateringRequestId: CAT_ID } });
    expect(tx.fileUpload.deleteMany).toHaveBeenCalledWith({ where: { cateringRequestId: CAT_ID } });
    // Only a row that is still soft-deleted is removed: a restore wins the race.
    expect(tx.cateringRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: CAT_ID, deletedAt: { not: null } },
    });
    expect(tx.onDemand.deleteMany).not.toHaveBeenCalled();
    expect(calls.indexOf('order')).toBe(calls.length - 1);
    expect(result).toMatchObject({ success: true, purged: 1, failed: 0 });
    expect(result.orders[0]).toMatchObject({
      orderType: 'catering',
      orderId: CAT_ID,
      orderNumber: 'CAT-001',
      outcome: 'PURGED',
      files: 0,
    });
  });

  it('deletes an on-demand order through its own table and foreign key', async () => {
    mockedPrisma.onDemand.findMany.mockResolvedValue([onDemandOrder]);

    const result = await runOrderPurge();

    expect(tx.dispatch.deleteMany).toHaveBeenCalledWith({ where: { onDemandId: OD_ID } });
    expect(tx.fileUpload.deleteMany).toHaveBeenCalledWith({ where: { onDemandId: OD_ID } });
    expect(tx.delivery.deleteMany).toHaveBeenCalledWith({ where: { orderNumber: 'OD-001' } });
    expect(tx.onDemand.deleteMany).toHaveBeenCalledWith({
      where: { id: OD_ID, deletedAt: { not: null } },
    });
    expect(tx.cateringRequest.deleteMany).not.toHaveBeenCalled();
    expect(result.orders[0]).toMatchObject({ orderType: 'on_demand', outcome: 'PURGED' });
  });

  it('fails the order without touching storage when it was restored before the purge', async () => {
    mockedPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
    mockedPrisma.fileUpload.findMany.mockResolvedValue([menuFile]);
    tx.cateringRequest.deleteMany.mockResolvedValue({ count: 0 });

    const result = await runOrderPurge();

    expect(result).toMatchObject({ success: false, purged: 0, failed: 1 });
    expect(result.orders[0]).toMatchObject({
      outcome: 'FAILED',
      error: expect.stringMatching(/no longer soft-deleted/i),
    });
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });
});

describe('runOrderPurge file removal', () => {
  it('reads the file rows before the transaction and removes the objects after commit from the right bucket and path', async () => {
    mockedPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
    mockedPrisma.fileUpload.findMany.mockResolvedValue([
      menuFile,
      {
        id: 'file-pod',
        fileName: 'proof.jpg',
        filePath: `deliveries/${CAT_ID}/proof.jpg`,
        fileUrl: `https://proj.supabase.co/storage/v1/object/public/delivery-proofs/deliveries/${CAT_ID}/proof.jpg`,
      },
    ]);
    let committed = false;
    mockedPrisma.$transaction.mockImplementation(async (cb: any) => {
      expect(mockedPrisma.fileUpload.findMany).toHaveBeenCalledTimes(1);
      const value = await cb(tx);
      committed = true;
      return value;
    });
    storageFrom.mockImplementation((bucket: string) => ({
      remove: jest.fn(async (paths: string[]) => {
        expect(committed).toBe(true);
        removeByBucket[bucket] = removeByBucket[bucket] ?? jest.fn();
        removeByBucket[bucket](paths);
        return { data: paths.map((name) => ({ name })), error: null };
      }),
    }));

    const result = await runOrderPurge();

    expect(mockedPrisma.fileUpload.findMany).toHaveBeenCalledWith({
      where: { cateringRequestId: CAT_ID },
      select: { id: true, fileName: true, filePath: true, fileUrl: true },
    });
    expect(removeByBucket.fileUploader).toHaveBeenCalledWith([`catering_order/${CAT_ID}/menu.pdf`]);
    expect(removeByBucket['delivery-proofs']).toHaveBeenCalledWith([`deliveries/${CAT_ID}/proof.jpg`]);
    expect(result).toMatchObject({ success: true, purged: 1, orphanedFiles: 0 });
    expect(result.orders[0]).toMatchObject({ outcome: 'PURGED', files: 2 });
    expect(result.orders[0]).not.toHaveProperty('orphanedFiles');
  });

  it('tries both the stored path and the signed-URL path when a temp upload was moved', async () => {
    mockedPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
    const stalePath = 'catering_order/temp-123/menu.pdf';
    const movedPath = `catering_order/${CAT_ID}/menu.pdf`;
    mockedPrisma.fileUpload.findMany.mockResolvedValue([
      {
        id: 'file-1',
        fileName: 'menu.pdf',
        filePath: stalePath,
        fileUrl: `https://proj.supabase.co/storage/v1/object/sign/fileUploader/${movedPath}?token=t`,
      },
    ]);
    removeByBucket.fileUploader = jest.fn(async () => ({ data: [{ name: movedPath }], error: null }));

    const result = await runOrderPurge();

    expect(removeByBucket.fileUploader).toHaveBeenCalledWith([stalePath, movedPath]);
    expect(result.orphanedFiles).toBe(0);
  });

  it('reports a storage failure as an orphan on a PURGED order instead of throwing', async () => {
    mockedPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
    mockedPrisma.fileUpload.findMany.mockResolvedValue([menuFile]);
    removeByBucket.fileUploader = jest.fn(async () => ({
      data: null,
      error: { message: 'permission denied' },
    }));

    const result = await runOrderPurge();

    expect(result).toMatchObject({ success: true, purged: 1, failed: 0, orphanedFiles: 1 });
    expect(result.orders[0]).toMatchObject({
      outcome: 'PURGED',
      files: 1,
      orphanedFiles: [
        {
          fileId: 'file-1',
          fileName: 'menu.pdf',
          bucket: 'fileUploader',
          paths: [`catering_order/${CAT_ID}/menu.pdf`],
          reason: 'REMOVE_FAILED',
          detail: 'permission denied',
        },
      ],
    });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('orphaned storage object'),
      expect.objectContaining({ orderId: CAT_ID, fileId: 'file-1', bucket: 'fileUploader' }),
    );
  });

  it('reports an orphan when no storage path can be worked out, without guessing from the file name', async () => {
    mockedPrisma.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
    mockedPrisma.fileUpload.findMany.mockResolvedValue([
      { id: 'file-1', fileName: 'menu.pdf', filePath: null, fileUrl: 'https://utfs.io/f/menu.pdf' },
    ]);

    const result = await runOrderPurge();

    expect(storageFrom).not.toHaveBeenCalled();
    expect(result.orders[0]).toMatchObject({
      outcome: 'PURGED',
      orphanedFiles: [{ fileId: 'file-1', bucket: null, paths: [], reason: 'PATH_UNRESOLVED' }],
    });
  });
});

describe('runOrderPurge batch resilience', () => {
  it('keeps going when one order fails and reports it', async () => {
    mockedPrisma.cateringRequest.findMany.mockResolvedValue([
      { id: CAT_ID, orderNumber: 'CAT-BOOM', deletedAt: daysAgo(900) },
      cateringOrder,
    ]);
    tx.dispatch.deleteMany
      .mockRejectedValueOnce(new Error('deadlock detected'))
      .mockResolvedValue({ count: 0 });

    const result = await runOrderPurge();

    expect(result).toMatchObject({ success: false, scanned: 2, purged: 1, failed: 1 });
    expect(result.orders.map((o) => [o.orderNumber, o.outcome])).toEqual([
      ['CAT-BOOM', 'FAILED'],
      ['CAT-001', 'PURGED'],
    ]);
    expect(result.orders[0]).toMatchObject({ error: 'deadlock detected' });
    expect(typeof result.durationMs).toBe('number');
  });
});
