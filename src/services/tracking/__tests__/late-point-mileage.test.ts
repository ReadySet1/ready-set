/**
 * A GPS point that reaches the server after its shift was closed (offline
 * queue replay) must be folded into that shift's stored mileage.
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: { $queryRawUnsafe: jest.fn() },
}));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));
jest.mock('../mileage', () => ({
  calculateShiftMileage: jest.fn(),
  calculateShiftMileageWithValidation: jest.fn(),
}));

import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/utils/prismaDB';
import { calculateShiftMileage, calculateShiftMileageWithValidation } from '../mileage';
import {
  recomputeClosedShiftMileageForPoint,
  recomputeClosedShiftsMileageForPoints,
} from '../late-point-mileage';

const mockQuery = prisma.$queryRawUnsafe as jest.Mock;
const mockCalc = calculateShiftMileage as jest.Mock;
const mockCalcValidated = calculateShiftMileageWithValidation as jest.Mock;
const mockCaptureException = Sentry.captureException as jest.Mock;

const DRIVER_ID = '11111111-1111-4111-8111-111111111111';
const SHIFT_ID = '22222222-2222-4222-8222-222222222222';
const RECORDED_AT = '2026-10-15T21:04:00.000Z';

describe('recomputeClosedShiftMileageForPoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCalc.mockResolvedValue({ totalMiles: 12.3 });
    mockCalcValidated.mockResolvedValue({ totalMiles: 14 });
  });

  it('recomputes GPS mileage for the closed shift whose window holds the point', async () => {
    mockQuery.mockResolvedValue([
      { id: SHIFT_ID, mileage_source: 'gps', reported_distance_miles: null },
    ]);

    const result = await recomputeClosedShiftMileageForPoint(DRIVER_ID, RECORDED_AT);

    expect(result).toEqual({ shiftId: SHIFT_ID, recomputed: true });
    expect(mockCalc).toHaveBeenCalledWith(SHIFT_ID);
    const [sql, ...params] = mockQuery.mock.calls[0]!;
    expect(sql).toMatch(/shift_end IS NOT NULL/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(sql).toMatch(/shift_start <= \$2::timestamptz/);
    expect(sql).toMatch(/shift_end >= \$2::timestamptz/);
    expect(params).toEqual([DRIVER_ID, RECORDED_AT]);
  });

  it('treats a never-computed shift (null source) like GPS', async () => {
    mockQuery.mockResolvedValue([
      { id: SHIFT_ID, mileage_source: null, reported_distance_miles: null },
    ]);

    await recomputeClosedShiftMileageForPoint(DRIVER_ID, RECORDED_AT);

    expect(mockCalc).toHaveBeenCalledWith(SHIFT_ID);
  });

  it('keeps the odometer reading and refreshes only the GPS audit value', async () => {
    mockQuery.mockResolvedValue([
      { id: SHIFT_ID, mileage_source: 'odometer', reported_distance_miles: 14 },
    ]);

    const result = await recomputeClosedShiftMileageForPoint(DRIVER_ID, RECORDED_AT);

    expect(result.recomputed).toBe(true);
    expect(mockCalcValidated).toHaveBeenCalledWith(SHIFT_ID, 14);
    expect(mockCalc).not.toHaveBeenCalled();
  });

  it('never overwrites manual mileage', async () => {
    mockQuery.mockResolvedValue([
      { id: SHIFT_ID, mileage_source: 'manual', reported_distance_miles: 9 },
    ]);

    const result = await recomputeClosedShiftMileageForPoint(DRIVER_ID, RECORDED_AT);

    expect(result).toEqual({ shiftId: SHIFT_ID, recomputed: false });
    expect(mockCalc).not.toHaveBeenCalled();
    expect(mockCalcValidated).not.toHaveBeenCalled();
  });

  it('does nothing when the point is not inside a closed shift (open shift or no shift)', async () => {
    mockQuery.mockResolvedValue([]);

    const result = await recomputeClosedShiftMileageForPoint(DRIVER_ID, RECORDED_AT);

    expect(result).toEqual({ shiftId: null, recomputed: false });
    expect(mockCalc).not.toHaveBeenCalled();
    expect(mockCalcValidated).not.toHaveBeenCalled();
  });
});

describe('recomputeClosedShiftsMileageForPoints', () => {
  const OUTBOUND = '33333333-3333-4333-8333-333333333333';
  const GAP = '44444444-4444-4444-8444-444444444444';
  const MIDDLE = '55555555-5555-4555-8555-555555555555';
  const RETURN = '66666666-6666-4666-8666-666666666666';

  /** A closed shift row as Postgres returns it (timestamptz → Date). */
  const shift = (
    id: string,
    start: string,
    end: string,
    mileage_source: string | null = 'gps',
    reported_distance_miles: number | null = null,
  ) => ({
    id,
    shift_start: new Date(start),
    shift_end: new Date(end),
    mileage_source,
    reported_distance_miles,
  });

  // Four closed shifts the backlog window [18:05, 20:55] overlaps:
  //   OUTBOUND 18:00-18:30  holds the oldest late point
  //   GAP      18:40-18:50  holds no late point (the phone was online then)
  //   MIDDLE   19:00-20:00  holds neither end, only points in between
  //   RETURN   20:30-21:00  holds the newest late point
  const SHIFTS = [
    shift(OUTBOUND, '2026-10-15T18:00:00.000Z', '2026-10-15T18:30:00.000Z'),
    shift(GAP, '2026-10-15T18:40:00.000Z', '2026-10-15T18:50:00.000Z'),
    shift(MIDDLE, '2026-10-15T19:00:00.000Z', '2026-10-15T20:00:00.000Z'),
    shift(RETURN, '2026-10-15T20:30:00.000Z', '2026-10-15T21:00:00.000Z', 'odometer', 20),
  ];
  const LATE_POINTS = [
    '2026-10-15T19:30:00.000Z', // MIDDLE (unsorted on purpose)
    '2026-10-15T18:05:00.000Z', // OUTBOUND, oldest
    '2026-10-15T20:55:00.000Z', // RETURN, newest
    '2026-10-15T19:15:00.000Z', // MIDDLE
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalc.mockResolvedValue({ totalMiles: 12.3 });
    mockCalcValidated.mockResolvedValue({ totalMiles: 14 });
  });

  it('recomputes each closed shift that holds a late point, including one holding neither end', async () => {
    mockQuery.mockResolvedValue(SHIFTS);

    const results = await recomputeClosedShiftsMileageForPoints(DRIVER_ID, LATE_POINTS);

    expect(results).toEqual([
      { shiftId: OUTBOUND, recomputed: true },
      { shiftId: MIDDLE, recomputed: true },
      { shiftId: RETURN, recomputed: true },
    ]);
    expect(mockCalc.mock.calls).toEqual([[OUTBOUND], [MIDDLE]]);
    expect(mockCalcValidated.mock.calls).toEqual([[RETURN, 20]]);
  });

  it('leaves a closed shift inside the window that received no late point untouched', async () => {
    // Recomputing it would apply today's tracking settings to an old shift and
    // silently rewrite its miles, though no new point reached it.
    mockQuery.mockResolvedValue(SHIFTS);

    await recomputeClosedShiftsMileageForPoints(DRIVER_ID, LATE_POINTS);

    expect(mockCalc).not.toHaveBeenCalledWith(GAP);
    expect(mockCalcValidated).not.toHaveBeenCalledWith(GAP, expect.anything());
  });

  it('counts a point on the shift boundary as inside the shift', async () => {
    mockQuery.mockResolvedValue([SHIFTS[2]!]);

    const results = await recomputeClosedShiftsMileageForPoints(DRIVER_ID, [
      '2026-10-15T19:00:00.000Z',
    ]);

    expect(results).toEqual([{ shiftId: MIDDLE, recomputed: true }]);
  });

  it('loads the candidate shifts once, bounded by the oldest and newest late point', async () => {
    mockQuery.mockResolvedValue([]);

    await recomputeClosedShiftsMileageForPoints(DRIVER_ID, LATE_POINTS);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, ...params] = mockQuery.mock.calls[0]!;
    expect(sql).toMatch(/shift_start, shift_end/);
    expect(sql).toMatch(/shift_end IS NOT NULL/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(sql).toMatch(/shift_start <= \$3::timestamptz/);
    expect(sql).toMatch(/shift_end >= \$2::timestamptz/);
    expect(params).toEqual([DRIVER_ID, '2026-10-15T18:05:00.000Z', '2026-10-15T20:55:00.000Z']);
  });

  it('keeps going when one shift fails, and reports that shift to Sentry', async () => {
    mockQuery.mockResolvedValue(SHIFTS);
    const boom = new Error('mileage exploded');
    mockCalc.mockImplementation((id: string) =>
      id === OUTBOUND ? Promise.reject(boom) : Promise.resolve({ totalMiles: 1 }),
    );

    const results = await recomputeClosedShiftsMileageForPoints(DRIVER_ID, LATE_POINTS);

    expect(results).toEqual([
      { shiftId: OUTBOUND, recomputed: false, failed: true },
      { shiftId: MIDDLE, recomputed: true },
      { shiftId: RETURN, recomputed: true },
    ]);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({
        tags: expect.objectContaining({ component: 'late-gps-point-mileage' }),
        extra: expect.objectContaining({ driverId: DRIVER_ID, shiftId: OUTBOUND }),
      }),
    );
  });

  it('skips manual mileage, and does nothing without late points or overlapping shifts', async () => {
    mockQuery.mockResolvedValueOnce([
      shift(MIDDLE, '2026-10-15T19:00:00.000Z', '2026-10-15T20:00:00.000Z', 'manual', 9),
    ]);
    expect(await recomputeClosedShiftsMileageForPoints(DRIVER_ID, LATE_POINTS)).toEqual([
      { shiftId: MIDDLE, recomputed: false },
    ]);

    mockQuery.mockResolvedValueOnce([]);
    expect(await recomputeClosedShiftsMileageForPoints(DRIVER_ID, LATE_POINTS)).toEqual([]);

    mockQuery.mockClear();
    expect(await recomputeClosedShiftsMileageForPoints(DRIVER_ID, [])).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockCalc).not.toHaveBeenCalled();
    expect(mockCalcValidated).not.toHaveBeenCalled();
  });
});
