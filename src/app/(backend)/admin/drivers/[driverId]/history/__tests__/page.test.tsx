/**
 * /admin/drivers/[driverId]/history is ADMIN / SUPER_ADMIN only. The role
 * comes from the user's profile (getUserRole), not Supabase app_metadata,
 * which is never populated.
 */
jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: jest.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getUserRole: jest.fn() }));
jest.mock('@/utils/prismaDB', () => ({
  prisma: { driver: { findUnique: jest.fn() } },
}));
jest.mock('../AdminHistoryClient', () => ({
  __esModule: true,
  default: () => null,
}));

import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUserRole } from '@/lib/auth';
import { prisma } from '@/utils/prismaDB';
import AdminDriverHistoryPage from '../page';

const mockedCreateClient = createClient as jest.Mock;
const mockedRole = getUserRole as jest.Mock;
const mockedFindDriver = prisma.driver.findUnique as jest.Mock;

const params = Promise.resolve({ driverId: 'driver-1' });

function signInAs(user: { id: string; app_metadata: Record<string, unknown> } | null) {
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  });
}

describe('AdminDriverHistoryPage authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFindDriver.mockResolvedValue({
      id: 'driver-1',
      employeeId: 'E-1',
      profile: { name: 'Test Driver', email: 'driver@example.com' },
    });
  });

  it('renders for a SUPER_ADMIN profile without an app_metadata role', async () => {
    signInAs({ id: 'sa-1', app_metadata: {} });
    mockedRole.mockResolvedValue('SUPER_ADMIN');

    await expect(AdminDriverHistoryPage({ params })).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each(['HELPDESK', 'DRIVER'])('redirects a %s profile to /admin', async (role) => {
    signInAs({ id: 'u-1', app_metadata: {} });
    mockedRole.mockResolvedValue(role);

    await expect(AdminDriverHistoryPage({ params })).rejects.toThrow('REDIRECT:/admin');
    expect(mockedFindDriver).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated visitors to /sign-in', async () => {
    signInAs(null);

    await expect(AdminDriverHistoryPage({ params })).rejects.toThrow('REDIRECT:/sign-in');
  });
});
