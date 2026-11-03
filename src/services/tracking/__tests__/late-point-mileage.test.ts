/**
 * A GPS point that reaches the server after its shift was closed (offline
 * queue replay) must be folded into that shift's stored mileage.
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: { $queryRawUnsafe: jest.fn() },
}));
jest.mock('../mileage', () => ({
  calculateShiftMileage: jest.fn(),
  calculateShiftMileageWithValidation: jest.fn(),
}));

import { prisma } from '@/utils/prismaDB';
import { calculateShiftMileage, calculateShiftMileageWithValidation } from '../mileage';
import {
  recomputeClosedShiftMileageForPoint,
  recomputeClosedShiftsMileageInWindow,
} from '../late-point-mileage';

const mockQuery = prisma.$queryRawUnsafe as jest.Mock;
const mockCalc = calculateShiftMileage as jest.Mock;
const mockCalcValidated = calculateShiftMileageWithValidation as jest.Mock;

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

describe('recomputeClosedShiftsMileageInWindow', () => {
  const FROM = '2026-10-15T18:00:00.000Z';
  const TO = '2026-10-15T21:00:00.000Z';
  const OUTBOUND = '33333333-3333-4333-8333-333333333333';
  const MIDDLE = '44444444-4444-4444-8444-444444444444';
  const RETURN = '55555555-5555-4555-8555-555555555555';

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalc.mockResolvedValue({ totalMiles: 12.3 });
    mockCalcValidated.mockResolvedValue({ totalMiles: 14 });
  });

  it('recomputes every closed shift a backlog spans, including one wholly inside it', async () => {
    // A backlog whose oldest point is in the outbound shift and newest in the
    // return shift also covers the whole middle shift: checking only its two
    // ends would leave the middle shift's miles stale.
    mockQuery.mockResolvedValue([
      { id: OUTBOUND, mileage_source: 'gps', reported_distance_miles: null },
      { id: MIDDLE, mileage_source: 'gps', reported_distance_miles: null },
      { id: RETURN, mileage_source: 'odometer', reported_distance_miles: 20 },
    ]);

    const results = await recomputeClosedShiftsMileageInWindow(DRIVER_ID, FROM, TO);

    expect(results).toEqual([
      { shiftId: OUTBOUND, recomputed: true },
      { shiftId: MIDDLE, recomputed: true },
      { shiftId: RETURN, recomputed: true },
    ]);
    expect(mockCalc.mock.calls).toEqual([[OUTBOUND], [MIDDLE]]);
    expect(mockCalcValidated).toHaveBeenCalledWith(RETURN, 20);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, ...params] = mockQuery.mock.calls[0]!;
    expect(sql).toMatch(/shift_end IS NOT NULL/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(sql).toMatch(/shift_start <= \$3::timestamptz/);
    expect(sql).toMatch(/shift_end >= \$2::timestamptz/);
    expect(params).toEqual([DRIVER_ID, FROM, TO]);
  });

  it('skips manual mileage and does nothing when no closed shift overlaps', async () => {
    mockQuery.mockResolvedValueOnce([
      { id: MIDDLE, mileage_source: 'manual', reported_distance_miles: 9 },
    ]);
    expect(await recomputeClosedShiftsMileageInWindow(DRIVER_ID, FROM, TO)).toEqual([
      { shiftId: MIDDLE, recomputed: false },
    ]);

    mockQuery.mockResolvedValueOnce([]);
    expect(await recomputeClosedShiftsMileageInWindow(DRIVER_ID, FROM, TO)).toEqual([]);
    expect(mockCalc).not.toHaveBeenCalled();
    expect(mockCalcValidated).not.toHaveBeenCalled();
  });
});
