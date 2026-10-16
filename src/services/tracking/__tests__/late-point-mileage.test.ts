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
import { recomputeClosedShiftMileageForPoint } from '../late-point-mileage';

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
