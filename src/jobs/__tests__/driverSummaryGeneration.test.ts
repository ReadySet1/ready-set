/**
 * Driver weekly summary generation job tests.
 *
 * Pins the four defects found in the #637 review (2026-10-05):
 *  1. stale weeks were never refreshed once a summary row existed
 *  2. the current (in-progress) week was never written
 *  3. completed deliveries were always 0 (lowercase literal vs UPPERCASE rows)
 *  4. shift hours were truncated to whole hours
 *
 * `deliveries.status` and `driver_shifts.status` are plain VarChar columns.
 * The app mirrors driver progress into `deliveries` with the DriverStatus
 * enum's UPPERCASE values ('DELIVERED', 'COMPLETED', 'CANCELLED') while older
 * rows and the shift table carry lowercase values, so every comparison must
 * be case-insensitive.
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    driverWeeklySummary: { findUnique: jest.fn(), upsert: jest.fn() },
    driverShift: { findMany: jest.fn(), aggregate: jest.fn() },
    delivery: { findMany: jest.fn(), aggregate: jest.fn() },
    driverLocation: { count: jest.fn() },
    driver: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  prismaLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

// next.config.js modularizeImports rewrites `date-fns` named imports to
// `date-fns/{{member}}`, whose CJS interop leaves `.default` undefined under
// jest. Re-export each real submodule with a `default` so the job (and this
// test) run against the genuine date-fns implementation.
function mockDateFnsModule(name: string) {
  const actual = jest.requireActual(`date-fns/${name}`);
  return { __esModule: true, default: actual[name], ...actual };
}
jest.mock('date-fns/startOfWeek', () => mockDateFnsModule('startOfWeek'));
jest.mock('date-fns/endOfWeek', () => mockDateFnsModule('endOfWeek'));
jest.mock('date-fns/subWeeks', () => mockDateFnsModule('subWeeks'));
jest.mock('date-fns/format', () => mockDateFnsModule('format'));
jest.mock('date-fns/getISOWeek', () => mockDateFnsModule('getISOWeek'));
jest.mock('date-fns/getISOWeekYear', () => mockDateFnsModule('getISOWeekYear'));
jest.mock('date-fns/differenceInHours', () => mockDateFnsModule('differenceInHours'));
jest.mock('date-fns/differenceInMinutes', () => mockDateFnsModule('differenceInMinutes'));
jest.mock('date-fns/parseISO', () => mockDateFnsModule('parseISO'));

import { startOfWeek, subWeeks } from 'date-fns';
import { prisma } from '@/utils/prismaDB';
import { DriverSummaryGenerationService } from '../driverSummaryGeneration';

const db = prisma as unknown as {
  driverWeeklySummary: { findUnique: jest.Mock; upsert: jest.Mock };
  driverShift: { findMany: jest.Mock; aggregate: jest.Mock };
  delivery: { findMany: jest.Mock; aggregate: jest.Mock };
  driverLocation: { count: jest.Mock };
  driver: { findMany: jest.Mock };
  $queryRaw: jest.Mock;
};

// Tuesday 2026-10-06 → current week starts Monday 2026-10-05.
const NOW = new Date('2026-10-06T15:00:00Z');
const DRIVER = 'driver-1';

const weekStartAgo = (weeks: number) => startOfWeek(subWeeks(NOW, weeks), { weekStartsOn: 1 });

const existingSummary = (updatedAt: Date) => ({
  id: 'summary-1',
  driverId: DRIVER,
  updatedAt,
  generatedAt: updatedAt,
});

function upsertPayload() {
  const call = db.driverWeeklySummary.upsert.mock.calls[0];
  if (!call) throw new Error('upsert was not called');
  return call[0].create as Record<string, unknown>;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW });

  db.driverWeeklySummary.findUnique.mockResolvedValue(null);
  db.driverWeeklySummary.upsert.mockResolvedValue({});
  db.driverShift.findMany.mockResolvedValue([]);
  db.delivery.findMany.mockResolvedValue([]);
  db.driverShift.aggregate.mockResolvedValue({ _max: { updatedAt: null } });
  db.delivery.aggregate.mockResolvedValue({ _max: { updatedAt: null } });
  db.driverLocation.count.mockResolvedValue(0);
  db.$queryRaw.mockResolvedValue([{ count: 0n }]);
  db.driver.findMany.mockResolvedValue([{ id: DRIVER }]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('week selection', () => {
  it('includes the current in-progress week as week 0 ahead of the backfill weeks', async () => {
    const service = new DriverSummaryGenerationService({ driverIds: [DRIVER], weeksToBackfill: 2 });

    await service.runGeneration();

    const requested = db.driverWeeklySummary.findUnique.mock.calls.map(
      (c) => (c[0].where.driverId_weekStart.weekStart as Date).toISOString()
    );
    expect(requested).toEqual([
      weekStartAgo(0).toISOString(),
      weekStartAgo(1).toISOString(),
      weekStartAgo(2).toISOString(),
    ]);
  });
});

describe('stale-week refresh rule', () => {
  const service = () => new DriverSummaryGenerationService({ driverIds: [DRIVER] });

  it('always recomputes the current week even when a summary already exists', async () => {
    db.driverWeeklySummary.findUnique.mockResolvedValue(existingSummary(NOW));

    const result = await service().generateWeeklySummary(DRIVER, weekStartAgo(0));

    expect(db.driverWeeklySummary.upsert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ created: false, updated: true });
  });

  it('always recomputes the most recent completed week so late edits land after Sunday', async () => {
    db.driverWeeklySummary.findUnique.mockResolvedValue(existingSummary(NOW));

    await service().generateWeeklySummary(DRIVER, weekStartAgo(1));

    expect(db.driverWeeklySummary.upsert).toHaveBeenCalledTimes(1);
  });

  it('skips an older week whose summary is newer than every shift and delivery in it', async () => {
    const generated = new Date('2026-09-20T04:00:00Z');
    db.driverWeeklySummary.findUnique.mockResolvedValue(existingSummary(generated));
    db.driverShift.aggregate.mockResolvedValue({ _max: { updatedAt: new Date('2026-09-19T10:00:00Z') } });
    db.delivery.aggregate.mockResolvedValue({ _max: { updatedAt: new Date('2026-09-18T10:00:00Z') } });

    const result = await service().generateWeeklySummary(DRIVER, weekStartAgo(3));

    expect(db.driverWeeklySummary.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ created: false, updated: false });
  });

  it('recomputes an older week when a delivery was edited after the summary was generated', async () => {
    const generated = new Date('2026-09-20T04:00:00Z');
    db.driverWeeklySummary.findUnique.mockResolvedValue(existingSummary(generated));
    db.driverShift.aggregate.mockResolvedValue({ _max: { updatedAt: new Date('2026-09-19T10:00:00Z') } });
    db.delivery.aggregate.mockResolvedValue({ _max: { updatedAt: new Date('2026-09-25T10:00:00Z') } });

    const result = await service().generateWeeklySummary(DRIVER, weekStartAgo(3));

    expect(db.driverWeeklySummary.upsert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ created: false, updated: true });
  });

  it('recomputes an older week when a shift was edited after the summary was generated', async () => {
    const generated = new Date('2026-09-20T04:00:00Z');
    db.driverWeeklySummary.findUnique.mockResolvedValue(existingSummary(generated));
    db.driverShift.aggregate.mockResolvedValue({ _max: { updatedAt: new Date('2026-09-21T10:00:00Z') } });

    await service().generateWeeklySummary(DRIVER, weekStartAgo(3));

    expect(db.driverWeeklySummary.upsert).toHaveBeenCalledTimes(1);
  });

  it('counts soft-deleted rows as edits so a deletion also refreshes the week', async () => {
    db.driverWeeklySummary.findUnique.mockResolvedValue(existingSummary(new Date('2026-09-20T04:00:00Z')));

    await service().generateWeeklySummary(DRIVER, weekStartAgo(3));

    for (const aggregate of [db.driverShift.aggregate, db.delivery.aggregate]) {
      const where = aggregate.mock.calls[0]?.[0]?.where ?? {};
      expect(where).not.toHaveProperty('deletedAt');
    }
  });

  it('forceRegenerate recomputes an older week that is otherwise fresh', async () => {
    db.driverWeeklySummary.findUnique.mockResolvedValue(existingSummary(NOW));
    const forced = new DriverSummaryGenerationService({ driverIds: [DRIVER], forceRegenerate: true });

    await forced.generateWeeklySummary(DRIVER, weekStartAgo(3));

    expect(db.driverWeeklySummary.upsert).toHaveBeenCalledTimes(1);
  });

  it('still creates a missing summary for an older week', async () => {
    const result = await service().generateWeeklySummary(DRIVER, weekStartAgo(5));

    expect(db.driverWeeklySummary.upsert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ created: true, updated: false });
  });
});

describe('delivery metrics', () => {
  it('counts DELIVERED and COMPLETED rows as completed, case-insensitively', async () => {
    db.delivery.findMany.mockResolvedValue([
      { id: '1', status: 'DELIVERED' },
      { id: '2', status: 'COMPLETED' },
      { id: '3', status: 'delivered' },
      { id: '4', status: 'CANCELLED' },
      { id: '5', status: 'cancelled' },
      { id: '6', status: 'ASSIGNED' },
    ]);

    await new DriverSummaryGenerationService({ driverIds: [DRIVER] }).generateWeeklySummary(
      DRIVER,
      weekStartAgo(1)
    );

    const payload = upsertPayload();
    expect(payload.totalDeliveries).toBe(6);
    expect(payload.completedDeliveries).toBe(3);
    expect(payload.cancelledDeliveries).toBe(2);
  });
});

describe('shift metrics', () => {
  const shift = (overrides: Record<string, unknown>) => ({
    id: 'shift',
    status: 'completed',
    shiftStart: null,
    shiftEnd: null,
    totalDistanceMiles: null,
    gpsDistanceMiles: null,
    reportedDistanceMiles: null,
    totalBreakDuration: null,
    ...overrides,
  });

  it('keeps partial hours: a 50-minute shift is 0.83 h, not 0', async () => {
    db.driverShift.findMany.mockResolvedValue([
      shift({
        shiftStart: new Date('2026-09-28T09:00:00Z'),
        shiftEnd: new Date('2026-09-28T09:50:00Z'),
      }),
    ]);

    await new DriverSummaryGenerationService({ driverIds: [DRIVER] }).generateWeeklySummary(
      DRIVER,
      weekStartAgo(1)
    );

    expect(String(upsertPayload().totalShiftHours)).toBe('0.83');
  });

  it('sums fractional hours across shifts', async () => {
    db.driverShift.findMany.mockResolvedValue([
      shift({
        id: 'a',
        shiftStart: new Date('2026-09-28T09:00:00Z'),
        shiftEnd: new Date('2026-09-28T10:30:00Z'),
      }),
      shift({
        id: 'b',
        shiftStart: new Date('2026-09-29T09:00:00Z'),
        shiftEnd: new Date('2026-09-29T09:50:00Z'),
      }),
    ]);

    await new DriverSummaryGenerationService({ driverIds: [DRIVER] }).generateWeeklySummary(
      DRIVER,
      weekStartAgo(1)
    );

    expect(String(upsertPayload().totalShiftHours)).toBe('2.33');
  });

  it('matches shift statuses case-insensitively', async () => {
    db.driverShift.findMany.mockResolvedValue([
      shift({ id: 'a', status: 'completed' }),
      shift({ id: 'b', status: 'COMPLETED' }),
      shift({ id: 'c', status: 'cancelled' }),
      shift({ id: 'd', status: 'active' }),
    ]);

    await new DriverSummaryGenerationService({ driverIds: [DRIVER] }).generateWeeklySummary(
      DRIVER,
      weekStartAgo(1)
    );

    const payload = upsertPayload();
    expect(payload.totalShifts).toBe(4);
    expect(payload.completedShifts).toBe(2);
    expect(payload.cancelledShifts).toBe(1);
  });

  it('parses multi-day Postgres interval strings for break time', async () => {
    db.driverShift.findMany.mockResolvedValue([
      shift({ id: 'a', totalBreakDuration: '1 day 02:30:00' }),
      shift({ id: 'b', totalBreakDuration: '00:45:00' }),
    ]);

    await new DriverSummaryGenerationService({ driverIds: [DRIVER] }).generateWeeklySummary(
      DRIVER,
      weekStartAgo(1)
    );

    expect(String(upsertPayload().totalBreakHours)).toBe('27.25');
  });
});
