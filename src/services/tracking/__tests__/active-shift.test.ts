/**
 * Tests for resolveActiveShiftIdForDriver — the shift lookup the orders PATCH
 * uses to stamp `deliveries.shift_id` on the mirror upsert so the
 * delivery-count trigger has a shift to count against.
 *
 * NOTE: the input is the `drivers.id` (the same id `deliveries.driver_id`
 * references), NOT the profile id that dispatches carry.
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    driverShift: {
      findFirst: jest.fn(),
    },
  },
}));

import { resolveActiveShiftIdForDriver } from '../active-shift';
import { prisma } from '@/utils/prismaDB';

const mockFindFirst = prisma.driverShift.findFirst as jest.Mock;

const DRIVER_ID = '11111111-1111-4111-8111-111111111111';
const SHIFT_ID = '22222222-2222-4222-8222-222222222222';

describe('resolveActiveShiftIdForDriver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the most recent ACTIVE, non-deleted shift for the driver', async () => {
    mockFindFirst.mockResolvedValue({ id: SHIFT_ID });

    const result = await resolveActiveShiftIdForDriver(DRIVER_ID);

    expect(result).toBe(SHIFT_ID);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { driverId: DRIVER_ID, status: 'active', deletedAt: null },
      orderBy: { shiftStart: 'desc' },
      select: { id: true },
    });
  });

  it('returns null when the driver has no active shift', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(resolveActiveShiftIdForDriver(DRIVER_ID)).resolves.toBeNull();
  });

  it('returns null without querying when the driver id is missing', async () => {
    await expect(resolveActiveShiftIdForDriver(null)).resolves.toBeNull();
    await expect(resolveActiveShiftIdForDriver(undefined)).resolves.toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('fails open to null when the lookup throws', async () => {
    mockFindFirst.mockRejectedValue(new Error('db down'));

    await expect(resolveActiveShiftIdForDriver(DRIVER_ID)).resolves.toBeNull();
  });
});
