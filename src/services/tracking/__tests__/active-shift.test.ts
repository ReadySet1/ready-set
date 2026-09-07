/**
 * Tests for resolveOpenShiftIdForDriver / resolveOpenShiftIdForUser — the
 * shift lookup the orders PATCH uses both to gate driver movement statuses and
 * to stamp `deliveries.shift_id` on the mirror upsert so the delivery-count
 * trigger has a shift to count against.
 *
 * "Open" means `status IN ('active', 'paused') AND deleted_at IS NULL` — the
 * same definition the client (`useDriverShift.isShiftActive`) and the
 * one-open-shift-per-driver index use. A driver on break keeps sending GPS,
 * so a paused shift must satisfy the gate.
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

jest.mock('@/lib/auth/driver-ownership', () => ({
  getDriverForUser: jest.fn(),
}));

import {
  resolveOpenShiftIdForDriver,
  resolveOpenShiftIdForUser,
} from '../active-shift';
import { prisma } from '@/utils/prismaDB';
import { getDriverForUser } from '@/lib/auth/driver-ownership';

const mockGetDriverForUser = getDriverForUser as jest.Mock;

const mockFindFirst = prisma.driverShift.findFirst as jest.Mock;

const DRIVER_ID = '11111111-1111-4111-8111-111111111111';
const SHIFT_ID = '22222222-2222-4222-8222-222222222222';

const OPEN_SHIFT_WHERE = {
  driverId: DRIVER_ID,
  status: { in: ['active', 'paused'] },
  deletedAt: null,
};

describe('resolveOpenShiftIdForDriver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the most recent OPEN (active or paused), non-deleted shift for the driver', async () => {
    mockFindFirst.mockResolvedValue({ id: SHIFT_ID });

    const result = await resolveOpenShiftIdForDriver(DRIVER_ID);

    expect(result).toBe(SHIFT_ID);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: OPEN_SHIFT_WHERE,
      orderBy: { shiftStart: 'desc' },
      select: { id: true },
    });
  });

  it('resolves a PAUSED shift (driver on break still records GPS)', async () => {
    // The lookup filters by status; the row it returns is the paused one.
    mockFindFirst.mockImplementation(async ({ where }: { where: typeof OPEN_SHIFT_WHERE }) =>
      where.status.in.includes('paused') ? { id: SHIFT_ID } : null,
    );

    await expect(resolveOpenShiftIdForDriver(DRIVER_ID)).resolves.toBe(SHIFT_ID);
  });

  it('returns null when the driver has no open shift', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(resolveOpenShiftIdForDriver(DRIVER_ID)).resolves.toBeNull();
  });

  it('returns null without querying when the driver id is missing', async () => {
    await expect(resolveOpenShiftIdForDriver(null)).resolves.toBeNull();
    await expect(resolveOpenShiftIdForDriver(undefined)).resolves.toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('fails open to null when the lookup throws', async () => {
    mockFindFirst.mockRejectedValue(new Error('db down'));

    await expect(resolveOpenShiftIdForDriver(DRIVER_ID)).resolves.toBeNull();
  });
});

describe('resolveOpenShiftIdForUser', () => {
  const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves the caller to their drivers row (either link column) and returns the open shift', async () => {
    mockGetDriverForUser.mockResolvedValue({ id: DRIVER_ID, isActive: true, currentShiftId: null });
    mockFindFirst.mockResolvedValue({ id: SHIFT_ID });

    const result = await resolveOpenShiftIdForUser(AUTH_USER_ID);

    expect(result).toBe(SHIFT_ID);
    expect(mockGetDriverForUser).toHaveBeenCalledWith(AUTH_USER_ID);
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: OPEN_SHIFT_WHERE }),
    );
  });

  it('returns null when the user has no drivers row (no row, no shift)', async () => {
    mockGetDriverForUser.mockResolvedValue(null);

    const result = await resolveOpenShiftIdForUser(AUTH_USER_ID);

    expect(result).toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('returns null when the driver has no open shift', async () => {
    mockGetDriverForUser.mockResolvedValue({ id: DRIVER_ID, isActive: true, currentShiftId: null });
    mockFindFirst.mockResolvedValue(null);

    await expect(resolveOpenShiftIdForUser(AUTH_USER_ID)).resolves.toBeNull();
  });
});
