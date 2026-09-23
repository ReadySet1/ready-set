/**
 * Driver mileage recalculation job tests.
 *
 * The job ran every night against columns that do not exist on
 * `driver_shifts` (`end_time`, `total_distance_km`) and failed with
 * `column "end_time" does not exist`. These tests pin the candidate query to
 * the real schema by reading the DriverShift model from prisma/schema.prisma.
 */

import fs from 'fs';
import path from 'path';

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));

jest.mock('@/lib/logging/realtime-logger', () => ({
  realtimeLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/services/tracking/mileage', () => ({
  calculateShiftMileage: jest.fn(),
}));

import { prisma } from '@/utils/prismaDB';
import { calculateShiftMileage } from '@/services/tracking/mileage';
import { runDriverMileageRecalculation } from '../driverMileageRecalculation';

const mockQuery = prisma.$queryRawUnsafe as jest.Mock;
const mockCalculate = calculateShiftMileage as jest.Mock;

/** Real column names of the `driver_shifts` table, read from the Prisma model. */
function driverShiftColumns(): Set<string> {
  const schema = fs.readFileSync(
    path.join(process.cwd(), 'prisma/schema.prisma'),
    'utf8'
  );
  const model = schema.match(/model DriverShift \{([\s\S]*?)\n\}/);
  if (!model?.[1]) throw new Error('DriverShift model not found in schema.prisma');

  // Only scalar fields are columns; relation fields (driver, deliveries) are not.
  const scalarTypes = new Set([
    'String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal', 'DateTime', 'Json', 'Bytes',
  ]);
  const columns = new Set<string>();
  for (const line of model[1].split('\n')) {
    const field = line.trim().match(/^([a-zA-Z]\w*)\s+(\w+)/);
    if (!field?.[1] || !field[2]) continue;
    const isUnsupported = field[2] === 'Unsupported';
    if (!scalarTypes.has(field[2]) && !isUnsupported) continue;
    const mapped = line.match(/@map\("([^"]+)"\)/);
    columns.add(mapped?.[1] ?? field[1]);
  }
  if (columns.has('driver') || columns.has('deliveries')) {
    throw new Error('relation fields leaked into the column set');
  }
  return columns;
}

function emittedSql(): string {
  const call = mockQuery.mock.calls[0];
  if (!call) throw new Error('candidate query was not executed');
  return call[0] as string;
}

describe('runDriverMileageRecalculation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('selects candidate shifts using only real driver_shifts columns', async () => {
    mockQuery.mockResolvedValue([]);

    await runDriverMileageRecalculation();

    const sql = emittedSql();
    const selectList = sql.match(/SELECT([\s\S]*?)FROM/i)?.[1] ?? '';
    const selected = selectList
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const columns = driverShiftColumns();
    expect(selected.length).toBeGreaterThan(0);
    for (const column of selected) {
      expect(columns).toContain(column);
    }

    expect(sql).not.toMatch(/\bend_time\b|\btotal_distance_km\b/);
    expect(sql).toMatch(/shift_end IS NOT NULL/);
    expect(sql).toMatch(/shift_end >= \$1::timestamptz/);
    expect(sql).toMatch(/ORDER BY shift_end DESC/);
  });

  it('skips soft-deleted shifts and never overwrites odometer/manual/hybrid mileage', async () => {
    mockQuery.mockResolvedValue([]);

    await runDriverMileageRecalculation();

    const sql = emittedSql();
    expect(sql).toMatch(/deleted_at IS NULL/);
    // calculateShiftMileage writes mileage_source = 'gps'; only GPS (or
    // never-computed) shifts may be recalculated.
    expect(sql).toMatch(/mileage_source IS NULL OR mileage_source = 'gps'/);
  });

  it('passes the lookback start and batch size as bound parameters', async () => {
    mockQuery.mockResolvedValue([]);
    const before = Date.now();

    await runDriverMileageRecalculation({ batchSize: 7, lookbackHours: 2 });

    const [, lookbackStart, batchSize] = mockQuery.mock.calls[0]!;
    expect(batchSize).toBe(7);
    expect(lookbackStart).toBeInstanceOf(Date);
    const expected = before - 2 * 60 * 60 * 1000;
    expect(Math.abs((lookbackStart as Date).getTime() - expected)).toBeLessThan(5000);
  });

  it('recalculates each candidate shift and reports success', async () => {
    mockQuery.mockResolvedValue([
      { id: 'shift-1', driver_id: 'driver-1', shift_end: new Date(), total_distance: 12 },
      { id: 'shift-2', driver_id: 'driver-2', shift_end: new Date(), total_distance: null },
    ]);
    mockCalculate.mockResolvedValue({ totalMiles: 5 });

    const result = await runDriverMileageRecalculation();

    expect(mockCalculate).toHaveBeenCalledTimes(2);
    expect(mockCalculate).toHaveBeenCalledWith('shift-1');
    expect(mockCalculate).toHaveBeenCalledWith('shift-2');
    expect(result).toEqual({ success: true, processed: 2, errors: [] });
  });

  it('records per-shift failures without aborting the batch', async () => {
    mockQuery.mockResolvedValue([
      { id: 'shift-1', driver_id: 'driver-1', shift_end: new Date(), total_distance: null },
      { id: 'shift-2', driver_id: 'driver-2', shift_end: new Date(), total_distance: null },
    ]);
    mockCalculate
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ totalMiles: 3 });

    const result = await runDriverMileageRecalculation();

    expect(result.success).toBe(false);
    expect(result.processed).toBe(1);
    expect(result.errors).toEqual([{ shiftId: 'shift-1', message: 'boom' }]);
  });

  it('reports a failed run when the candidate query throws', async () => {
    mockQuery.mockRejectedValue(new Error('column "end_time" does not exist'));

    const result = await runDriverMileageRecalculation();

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      { shiftId: 'N/A', message: 'column "end_time" does not exist' },
    ]);
  });
});
