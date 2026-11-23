/**
 * Data archiving batch loop tests.
 *
 * The archive statement is a data-modifying CTE that ends in
 * `SELECT COUNT(*)`. Run through `$executeRaw` it reported the affected-row
 * count of that final SELECT (always 1), so the loop made one pass per
 * eligible record instead of one pass per batch and the nightly job timed out.
 *
 * The Prisma mock below mirrors the documented contract: `$executeRaw`
 * resolves to the affected-row count (1 for a statement ending in a SELECT),
 * `$queryRaw` resolves to the returned rows (COUNT(*) arrives as a BigInt).
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    archiveBatch: { create: jest.fn(), update: jest.fn() },
    driverLocation: { count: jest.fn() },
    driverShift: { count: jest.fn() },
  },
}));

jest.mock('@/utils/logger', () => ({
  prismaLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));

import { prisma } from '@/utils/prismaDB';
import { DataArchivingService } from '../dataArchiving';

const mockExecuteRaw = prisma.$executeRaw as unknown as jest.Mock;
const mockQueryRaw = prisma.$queryRaw as unknown as jest.Mock;
const mockBatchCreate = prisma.archiveBatch.create as unknown as jest.Mock;
const mockBatchUpdate = prisma.archiveBatch.update as unknown as jest.Mock;
const mockLocationCount = prisma.driverLocation.count as unknown as jest.Mock;
const mockShiftCount = prisma.driverShift.count as unknown as jest.Mock;

const BATCH_ID = '11111111-1111-4111-8111-111111111111';
const MIN_DATE = new Date('2026-01-01T00:00:00Z');
const MAX_DATE = new Date('2026-01-31T00:00:00Z');

type SourceTable = 'driver_locations' | 'driver_shifts';

/** Rows still sitting in the source table, and how many archive passes ran. */
let remaining = 0;
let archivePasses = 0;

function sqlOf(strings: TemplateStringsArray): string {
  return strings.join('?');
}

/**
 * Stand-in for Postgres: every archive statement moves up to `batchSize` rows
 * out of the source table in one atomic pass.
 */
function installFakeDatabase(table: SourceTable, batchSize: number) {
  const isArchiveStatement = (sql: string) =>
    sql.includes(`DELETE FROM ${table}`) && sql.includes(`INSERT INTO ${table}_archive`);

  const archiveOnePass = (): number => {
    archivePasses += 1;
    const moved = Math.min(remaining, batchSize);
    remaining -= moved;
    return moved;
  };

  mockExecuteRaw.mockImplementation(async (strings: TemplateStringsArray) => {
    if (isArchiveStatement(sqlOf(strings))) archiveOnePass();
    // Affected-row count of a statement whose final clause is a SELECT.
    return 1;
  });

  mockQueryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
    const sql = sqlOf(strings);
    if (isArchiveStatement(sql)) return [{ count: BigInt(archiveOnePass()) }];
    if (sql.includes('min_date')) return [{ min_date: MIN_DATE, max_date: MAX_DATE }];
    return [];
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  remaining = 0;
  archivePasses = 0;
  mockBatchCreate.mockResolvedValue({ id: BATCH_ID });
  mockBatchUpdate.mockResolvedValue({});
  // The inter-batch pause is irrelevant here; keep the suite fast.
  jest
    .spyOn(DataArchivingService.prototype as unknown as { delay: () => Promise<void> }, 'delay')
    .mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe.each([
  {
    table: 'driver_locations' as const,
    mockCount: mockLocationCount,
    run: (service: DataArchivingService) => service.archiveDriverLocations(),
  },
  {
    table: 'driver_shifts' as const,
    mockCount: mockShiftCount,
    run: (service: DataArchivingService) => service.archiveDriverShifts(),
  },
])('DataArchivingService batch loop ($table)', ({ table, mockCount, run }) => {
  it('archives N eligible records that fit in one batch in a single pass', async () => {
    remaining = 122;
    mockCount.mockResolvedValue(122);
    installFakeDatabase(table, 1000);

    const result = await run(new DataArchivingService({ batchSize: 1000 }));

    expect(archivePasses).toBe(1);
    expect(remaining).toBe(0);
    expect(result.success).toBe(true);
    expect(result.recordsProcessed).toBe(122);
    expect(result.recordsArchived).toBe(122);
    expect(result.dateRangeStart).toEqual(MIN_DATE);
    expect(result.dateRangeEnd).toEqual(MAX_DATE);
  });

  it('makes one pass per batch when records span several batches', async () => {
    remaining = 2500;
    mockCount.mockResolvedValue(2500);
    installFakeDatabase(table, 1000);

    const result = await run(new DataArchivingService({ batchSize: 1000 }));

    expect(archivePasses).toBe(3);
    expect(remaining).toBe(0);
    expect(result.recordsArchived).toBe(2500);
  });

  it('stops when a batch comes back smaller than the batch size', async () => {
    // The up-front count saw 2500 rows, but only 1200 are still there.
    remaining = 1200;
    mockCount.mockResolvedValue(2500);
    installFakeDatabase(table, 1000);

    const result = await run(new DataArchivingService({ batchSize: 1000 }));

    expect(archivePasses).toBe(2);
    expect(result.success).toBe(true);
    expect(result.recordsArchived).toBe(1200);
  });

  it('stops when a batch comes back empty', async () => {
    remaining = 0;
    mockCount.mockResolvedValue(50);
    installFakeDatabase(table, 1000);

    const result = await run(new DataArchivingService({ batchSize: 1000 }));

    expect(archivePasses).toBe(1);
    expect(result.success).toBe(true);
    expect(result.recordsArchived).toBe(0);
  });

  it('records the real archived total on the batch row', async () => {
    remaining = 122;
    mockCount.mockResolvedValue(122);
    installFakeDatabase(table, 1000);

    await run(new DataArchivingService({ batchSize: 1000 }));

    expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BATCH_ID },
        data: expect.objectContaining({
          status: 'completed',
          recordsProcessed: 122,
          recordsArchived: 122,
        }),
      })
    );
  });

  it('keeps the archive statement parameterized', async () => {
    remaining = 3;
    mockCount.mockResolvedValue(3);
    installFakeDatabase(table, 1000);

    await run(new DataArchivingService({ batchSize: 1000 }));

    const archiveCall = [...mockExecuteRaw.mock.calls, ...mockQueryRaw.mock.calls].find(
      ([strings]) => sqlOf(strings as TemplateStringsArray).includes(`DELETE FROM ${table}`)
    );
    if (!archiveCall) throw new Error('archive statement was not executed');

    const [strings, ...values] = archiveCall as [TemplateStringsArray, ...unknown[]];
    // Tagged-template call: a strings array with `raw`, values passed separately.
    expect(Array.isArray(strings.raw)).toBe(true);
    expect(values).toEqual(expect.arrayContaining([BATCH_ID, 1000]));
    expect(values.some(value => value instanceof Date)).toBe(true);
    expect(sqlOf(strings)).not.toContain(BATCH_ID);
  });
});
