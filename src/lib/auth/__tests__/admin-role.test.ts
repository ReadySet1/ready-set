/**
 * hasAdminRole gates admin-only pages and routes on the canonical role source
 * (profiles.type via getUserRole), never on Supabase app_metadata.role, which
 * nothing in the app populates.
 */
jest.mock('@/lib/auth', () => ({ getUserRole: jest.fn() }));

import { getUserRole } from '@/lib/auth';
import { hasAdminRole, isAdminRole } from '../admin-role';

const mockedRole = getUserRole as jest.Mock;

describe('isAdminRole', () => {
  it.each(['ADMIN', 'SUPER_ADMIN', 'admin', 'super_admin'])('accepts %s', (role) => {
    expect(isAdminRole(role)).toBe(true);
  });

  it.each(['HELPDESK', 'DRIVER', 'CLIENT', 'VENDOR', '', null, undefined])(
    'rejects %s',
    (role) => {
      expect(isAdminRole(role)).toBe(false);
    }
  );
});

describe('hasAdminRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['ADMIN', 'SUPER_ADMIN', 'super_admin'])(
    'returns true when the profile role is %s',
    async (role) => {
      mockedRole.mockResolvedValue(role);

      await expect(hasAdminRole('user-1')).resolves.toBe(true);
      expect(mockedRole).toHaveBeenCalledWith('user-1');
    }
  );

  it.each(['HELPDESK', 'DRIVER', null])(
    'returns false when the profile role is %s',
    async (role) => {
      mockedRole.mockResolvedValue(role);

      await expect(hasAdminRole('user-1')).resolves.toBe(false);
    }
  );
});
