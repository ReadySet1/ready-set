/**
 * syncCaterValleyOrderStatusAction is a server action (a public POST
 * endpoint). It must refuse callers that are not ADMIN / SUPER_ADMIN /
 * HELPDESK before touching the CaterValley API.
 */
jest.mock('@/lib/auth/driver-ownership', () => ({ getActionCaller: jest.fn() }));
jest.mock('@/services/caterValleyService', () => ({
  updateCaterValleyOrderStatus: jest.fn(),
}));

import { getActionCaller } from '@/lib/auth/driver-ownership';
import { getUserRole } from '@/lib/auth';
import { updateCaterValleyOrderStatus } from '@/services/caterValleyService';
import { syncCaterValleyOrderStatusAction } from '../sync-cater-valley-order-status';

const mockedCaller = getActionCaller as jest.Mock;
const mockedRole = getUserRole as jest.Mock;
const mockedUpdate = updateCaterValleyOrderStatus as jest.Mock;

describe('syncCaterValleyOrderStatusAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUpdate.mockResolvedValue({ success: true, orderFound: true });
  });

  it('refuses unauthenticated callers', async () => {
    mockedCaller.mockResolvedValue(null);
    const result = await syncCaterValleyOrderStatusAction('CV-1', 'CONFIRM');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('refuses non-staff callers', async () => {
    mockedCaller.mockResolvedValue({ userId: 'driver-1', isPrivileged: false });
    mockedRole.mockResolvedValue('DRIVER');
    const result = await syncCaterValleyOrderStatusAction('CV-1', 'CONFIRM');
    expect(result.success).toBe(false);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('allows admins', async () => {
    mockedCaller.mockResolvedValue({ userId: 'admin-1', isPrivileged: true });
    const result = await syncCaterValleyOrderStatusAction('CV-1', 'CONFIRM');
    expect(result.success).toBe(true);
    expect(mockedUpdate).toHaveBeenCalledWith('CV-1', 'CONFIRM');
  });

  it('allows helpdesk (they change order status in the admin UI)', async () => {
    mockedCaller.mockResolvedValue({ userId: 'hd-1', isPrivileged: false });
    mockedRole.mockResolvedValue('HELPDESK');
    const result = await syncCaterValleyOrderStatusAction('CV-1', 'CONFIRM');
    expect(result.success).toBe(true);
    expect(mockedUpdate).toHaveBeenCalledWith('CV-1', 'CONFIRM');
  });
});
