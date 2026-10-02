/**
 * getStaffCaller gates admin-dashboard server actions (plain POST endpoints):
 * only ADMIN / SUPER_ADMIN / HELPDESK callers get through.
 */
jest.mock('@/lib/auth/driver-ownership', () => ({ getActionCaller: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getUserRole: jest.fn() }));

import { getActionCaller } from '@/lib/auth/driver-ownership';
import { getUserRole } from '@/lib/auth';
import { getStaffCaller } from '../staff-caller';

const mockedCaller = getActionCaller as jest.Mock;
const mockedRole = getUserRole as jest.Mock;

describe('getStaffCaller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null for unauthenticated callers', async () => {
    mockedCaller.mockResolvedValue(null);

    await expect(getStaffCaller()).resolves.toBeNull();
    expect(mockedRole).not.toHaveBeenCalled();
  });

  it('returns the caller for ADMIN / SUPER_ADMIN without a second role lookup', async () => {
    const caller = { userId: 'admin-1', isPrivileged: true };
    mockedCaller.mockResolvedValue(caller);

    await expect(getStaffCaller()).resolves.toEqual(caller);
    expect(mockedRole).not.toHaveBeenCalled();
  });

  it('returns the caller for HELPDESK', async () => {
    const caller = { userId: 'hd-1', isPrivileged: false };
    mockedCaller.mockResolvedValue(caller);
    mockedRole.mockResolvedValue('HELPDESK');

    await expect(getStaffCaller()).resolves.toEqual(caller);
    expect(mockedRole).toHaveBeenCalledWith('hd-1');
  });

  it.each(['CLIENT', 'VENDOR', 'DRIVER', null])(
    'returns null for non-staff role %s',
    async (role) => {
      mockedCaller.mockResolvedValue({ userId: 'u-1', isPrivileged: false });
      mockedRole.mockResolvedValue(role);

      await expect(getStaffCaller()).resolves.toBeNull();
    }
  );
});
