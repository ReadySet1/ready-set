/**
 * Order purge job.
 *
 * Soft-deleting an order (src/lib/services/order-deletion.ts) keeps the row
 * and every file attached to it. This job is the second half: once an order
 * has been soft-deleted for longer than the retention window it is
 * hard-deleted together with its files.
 *
 * Per order, in one transaction:
 * - `delivery_return_requests` (by order id) and the live `deliveries`
 *   mirror (by order number) — neither has a foreign key to the order, so
 *   nothing would remove them otherwise, and both are read by live driver
 *   code.
 * - `dispatches` (FK is NoAction) and `file_uploads` (FK cascades, deleted
 *   explicitly so the count is known and the purge never relies on the DB
 *   cascade being in place).
 * - The order row itself, conditional on it still being soft-deleted.
 * `order_status_history` cascades from the catering row.
 *
 * Storage cannot join the transaction, so objects are removed after commit;
 * anything that could not be removed is reported as an orphan, never thrown.
 *
 * Triggered by /api/admin/purge-deleted-orders (see docs/deployment/CRON_JOBS.md).
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/utils/prismaDB';
import { createAdminClient } from '@/utils/supabase/server';
import { STORAGE_BUCKETS } from '@/utils/file-service';
import type { DeletableOrderType } from '@/lib/services/order-deletion';

// ============================================================================
// Configuration
// ============================================================================

/** How long a soft-deleted order is kept before it may be purged: 2 years. */
export const DEFAULT_ORDER_PURGE_RETENTION_DAYS = 730;
/** A request override can shorten the window, but never below this. */
export const MINIMUM_ORDER_PURGE_RETENTION_DAYS = 30;
const DEFAULT_BATCH_SIZE = 50;

export interface OrderPurgeConfig {
  /** Days since deletedAt before an order is purged. Default: 730 */
  retentionDays?: number;
  /** Orders per run across both tables. Default: 50 */
  batchSize?: number;
  /** If true, only report what would be purged. Default: false */
  dryRun?: boolean;
}

// ============================================================================
// Result types
// ============================================================================

export type OrphanReason =
  /** The storage call returned an error or threw. */
  | 'REMOVE_FAILED'
  /** Storage answered without error but did not report the object removed. */
  | 'NOT_FOUND_AT_STORED_PATH'
  /** Neither `filePath` nor `fileUrl` yields a storage path. */
  | 'PATH_UNRESOLVED';

/** A storage object whose `file_uploads` row is gone but which was not removed. */
export interface OrphanedFile {
  fileId: string;
  fileName: string;
  bucket: string | null;
  /** Every path tried, in order. Empty when none could be worked out. */
  paths: string[];
  reason: OrphanReason;
  detail?: string;
}

export type OrderPurgeOutcome = 'PURGED' | 'FAILED' | 'WOULD_PURGE';

export interface OrderPurgeOrderResult {
  orderType: DeletableOrderType;
  orderId: string;
  orderNumber: string;
  deletedAt: Date;
  outcome: OrderPurgeOutcome;
  /** `file_uploads` rows attached to the order. */
  files: number;
  /** Only present when some storage object was left behind. */
  orphanedFiles?: OrphanedFile[];
  /** Only present on FAILED. */
  error?: string;
}

export interface OrderPurgeResult {
  /** True when no order FAILED. Orphaned files are reported, not failures. */
  success: boolean;
  dryRun: boolean;
  retentionDays: number;
  cutoff: Date;
  scanned: number;
  purged: number;
  failed: number;
  orphanedFiles: number;
  orders: OrderPurgeOrderResult[];
  durationMs: number;
}

// ============================================================================
// Storage helpers
// ============================================================================

interface OrderIdentity {
  orderType: DeletableOrderType;
  orderId: string;
  orderNumber: string;
}

interface StoredFile {
  id: string;
  fileName: string;
  filePath: string | null;
  fileUrl: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const STORAGE_OBJECT_URL = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/;

/**
 * Bucket and object path from a Supabase Storage object URL (public, signed
 * or authenticated). Returns null for anything else — callers must not fall
 * back to the bare file name, which points at nothing and orphans the object.
 */
export function parseStorageUrl(
  fileUrl: string | null | undefined,
): { bucket: string; path: string } | null {
  if (!fileUrl) return null;
  try {
    // `pathname` excludes the query string, so a signed URL's token is dropped.
    const match = new URL(fileUrl).pathname.match(STORAGE_OBJECT_URL);
    if (!match?.[1] || !match[2]) return null;
    return {
      bucket: decodeURIComponent(match[1]),
      path: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

/**
 * Where a file lives. The URL names the bucket (order attachments are in
 * `fileUploader`, proof-of-delivery and pickup signatures in
 * `delivery-proofs`); `filePath` is the stored path. Both paths are tried
 * when they differ: the temp-upload move (`catering_order/temp-<uuid>/…`)
 * rewrites `fileUrl` but leaves `filePath` pointing at the old location.
 */
function resolveStorageTarget(file: StoredFile): { bucket: string; paths: string[] } | null {
  const fromUrl = parseStorageUrl(file.fileUrl);
  const candidates = [file.filePath, fromUrl?.path]
    .map((path) => path?.trim().replace(/^\/+/, ''))
    .filter((path): path is string => !!path);
  const paths = [...new Set(candidates)];
  if (paths.length === 0) return null;
  return { bucket: fromUrl?.bucket ?? STORAGE_BUCKETS.FILE_UPLOADER, paths };
}

/**
 * Remove the storage objects behind already-deleted `file_uploads` rows.
 * Never throws: every object that was not confirmed removed comes back as an
 * orphan and is logged with enough context to clean it up by hand.
 */
export async function removeStoredFiles(
  order: OrderIdentity,
  files: StoredFile[],
): Promise<OrphanedFile[]> {
  const orphans: OrphanedFile[] = [];
  const byBucket = new Map<string, { file: StoredFile; paths: string[] }[]>();

  for (const file of files) {
    const target = resolveStorageTarget(file);
    if (!target) {
      orphans.push({
        fileId: file.id,
        fileName: file.fileName,
        bucket: null,
        paths: [],
        reason: 'PATH_UNRESOLVED',
      });
      continue;
    }
    const entries = byBucket.get(target.bucket) ?? [];
    entries.push({ file, paths: target.paths });
    byBucket.set(target.bucket, entries);
  }

  if (byBucket.size > 0) {
    // Service-role client, as in the upload and file-delete routes: the
    // buckets are private and this runs without a user session.
    let storage: Awaited<ReturnType<typeof createAdminClient>>['storage'] | null = null;
    let clientFailure: string | null = null;
    try {
      storage = (await createAdminClient()).storage;
    } catch (error) {
      clientFailure = errorMessage(error);
    }

    for (const [bucket, entries] of byBucket) {
      let failure = clientFailure;
      let removed: Set<string> | null = null;

      if (storage) {
        try {
          const paths = [...new Set(entries.flatMap((entry) => entry.paths))];
          const { data, error } = await storage.from(bucket).remove(paths);
          if (error) {
            failure = error.message || 'Storage remove failed';
          } else if (Array.isArray(data)) {
            removed = new Set(data.map((object) => object.name));
          }
        } catch (error) {
          failure = errorMessage(error);
        }
      }

      for (const { file, paths } of entries) {
        const base = { fileId: file.id, fileName: file.fileName, bucket, paths };
        if (failure) {
          orphans.push({ ...base, reason: 'REMOVE_FAILED', detail: failure });
        } else if (removed && !paths.some((path) => removed.has(path))) {
          orphans.push({ ...base, reason: 'NOT_FOUND_AT_STORED_PATH' });
        }
      }
    }
  }

  for (const orphan of orphans) {
    console.error('[order-purge] orphaned storage object', {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      ...orphan,
    });
  }
  return orphans;
}

// ============================================================================
// Selection
// ============================================================================

interface PurgeCandidate extends OrderIdentity {
  deletedAt: Date;
}

interface CandidateRow {
  id: string;
  orderNumber: string;
  deletedAt: Date | null;
}

/**
 * Soft-deleted orders past the cutoff from both tables, oldest first, capped
 * at `batchSize` overall. The explicit `deletedAt` filter also keeps the
 * soft-delete client extension from hiding the rows.
 */
async function selectCandidates(
  db: typeof prisma,
  cutoff: Date,
  batchSize: number,
): Promise<PurgeCandidate[]> {
  const args = {
    where: { deletedAt: { not: null, lt: cutoff } },
    select: { id: true, orderNumber: true, deletedAt: true },
    orderBy: { deletedAt: 'asc' as const },
    take: batchSize,
  };
  const [catering, onDemand]: [CandidateRow[], CandidateRow[]] = await Promise.all([
    db.cateringRequest.findMany(args),
    db.onDemand.findMany(args),
  ]);

  const toCandidate = (orderType: DeletableOrderType) => (row: CandidateRow) => ({
    orderType,
    orderId: row.id,
    orderNumber: row.orderNumber,
    // The filter guarantees a value; the fallback only satisfies the type.
    deletedAt: row.deletedAt ?? cutoff,
  });

  return [...catering.map(toCandidate('catering')), ...onDemand.map(toCandidate('on_demand'))]
    .sort((a, b) => a.deletedAt.getTime() - b.deletedAt.getTime())
    .slice(0, batchSize);
}

// ============================================================================
// Purge
// ============================================================================

const FILE_SELECT = { id: true, fileName: true, filePath: true, fileUrl: true } as const;

function orderForeignKey(order: OrderIdentity) {
  return order.orderType === 'catering'
    ? { cateringRequestId: order.orderId }
    : { onDemandId: order.orderId };
}

/** Dependent rows first, the order row last. Throws when the order is gone or live again. */
async function hardDeleteOrder(tx: Prisma.TransactionClient, order: OrderIdentity): Promise<void> {
  const orderFk = orderForeignKey(order);

  await tx.deliveryReturnRequest.deleteMany({ where: { orderId: order.orderId } });
  await tx.delivery.deleteMany({ where: { orderNumber: order.orderNumber } });
  await tx.dispatch.deleteMany({ where: orderFk });
  await tx.fileUpload.deleteMany({ where: orderFk });

  const claim = { where: { id: order.orderId, deletedAt: { not: null } } };
  const deleted =
    order.orderType === 'catering'
      ? await tx.cateringRequest.deleteMany(claim)
      : await tx.onDemand.deleteMany(claim);
  if (deleted.count === 0) {
    throw new Error('Order is no longer soft-deleted (restored or already purged)');
  }
}

async function purgeOne(
  db: typeof prisma,
  candidate: PurgeCandidate,
  dryRun: boolean,
): Promise<OrderPurgeOrderResult> {
  const base = { ...candidate };

  try {
    // Read before the transaction removes the rows: the storage paths are
    // only known from here.
    const files: StoredFile[] = await db.fileUpload.findMany({
      where: orderForeignKey(candidate),
      select: FILE_SELECT,
    });

    if (dryRun) {
      return { ...base, outcome: 'WOULD_PURGE', files: files.length };
    }

    await db.$transaction((tx) => hardDeleteOrder(tx, candidate));

    const orphanedFiles = await removeStoredFiles(candidate, files);
    return {
      ...base,
      outcome: 'PURGED',
      files: files.length,
      ...(orphanedFiles.length > 0 ? { orphanedFiles } : {}),
    };
  } catch (error) {
    console.error(`[order-purge] failed to purge order ${candidate.orderNumber}:`, error);
    return { ...base, outcome: 'FAILED', files: 0, error: errorMessage(error) };
  }
}

export async function runOrderPurge(
  config: OrderPurgeConfig = {},
  db: typeof prisma = prisma,
): Promise<OrderPurgeResult> {
  const startedAt = Date.now();
  const dryRun = config.dryRun ?? false;
  const retentionDays = Math.max(
    Math.floor(config.retentionDays ?? DEFAULT_ORDER_PURGE_RETENTION_DAYS),
    MINIMUM_ORDER_PURGE_RETENTION_DAYS,
  );
  const batchSize = Math.max(1, Math.floor(config.batchSize ?? DEFAULT_BATCH_SIZE));
  const cutoff = new Date(startedAt - retentionDays * 24 * 60 * 60 * 1000);

  const candidates = await selectCandidates(db, cutoff, batchSize);

  const orders: OrderPurgeOrderResult[] = [];
  for (const candidate of candidates) {
    orders.push(await purgeOne(db, candidate, dryRun));
  }

  const purged = orders.filter((o) => o.outcome === 'PURGED').length;
  const failed = orders.filter((o) => o.outcome === 'FAILED').length;
  const orphanedFiles = orders.reduce((sum, o) => sum + (o.orphanedFiles?.length ?? 0), 0);

  return {
    success: failed === 0,
    dryRun,
    retentionDays,
    cutoff,
    scanned: candidates.length,
    purged,
    failed,
    orphanedFiles,
    orders,
    durationMs: Date.now() - startedAt,
  };
}
