/**
 * /admin/archive is ADMIN / SUPER_ADMIN only. The role comes from the user's
 * profile (getUserRole), not Supabase app_metadata, which is never populated.
 */
jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getUserRole: jest.fn() }));
jest.mock('../ArchiveClient', () => ({
  __esModule: true,
  default: () => null,
}));

import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUserRole } from '@/lib/auth';
import ArchivePage from '../page';

const mockedCreateClient = createClient as jest.Mock;
const mockedRole = getUserRole as jest.Mock;

function signInAs(user: { id: string; app_metadata: Record<string, unknown> } | null) {
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  });
}

describe('ArchivePage authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders for a SUPER_ADMIN profile without an app_metadata role', async () => {
    signInAs({ id: 'sa-1', app_metadata: {} });
    mockedRole.mockResolvedValue('SUPER_ADMIN');

    await expect(ArchivePage()).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each(['HELPDESK', 'DRIVER'])('redirects a %s profile to /admin', async (role) => {
    signInAs({ id: 'u-1', app_metadata: {} });
    mockedRole.mockResolvedValue(role);

    await expect(ArchivePage()).rejects.toThrow('REDIRECT:/admin');
  });

  it('redirects unauthenticated visitors to /sign-in', async () => {
    signInAs(null);

    await expect(ArchivePage()).rejects.toThrow('REDIRECT:/sign-in');
  });
});
