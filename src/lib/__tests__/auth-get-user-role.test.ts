import { createClient } from '@/utils/supabase/server';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

// jest.setup.ts mocks @/lib/auth globally; this suite tests the real one.
const { getUserRole } = jest.requireActual<typeof import('@/lib/auth')>('@/lib/auth');

const mockedCreateClient = jest.mocked(createClient);

/**
 * A Supabase client whose `profiles` lookup returns `profile` and whose
 * auth user carries `userMetadata` (which the user can set themselves).
 */
const mockSupabase = (
  profile: { type: string | null } | null,
  userMetadata: Record<string, unknown> = {},
) => {
  const single = jest.fn().mockResolvedValue({
    data: profile,
    error: profile ? null : { code: 'PGRST116', message: 'Row not found' },
  });
  mockedCreateClient.mockResolvedValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ single }),
      }),
    }),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1', user_metadata: userMetadata } },
        error: null,
      }),
    },
  } as any);
};

describe('getUserRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns the role from the profile', async () => {
    mockSupabase({ type: 'SUPER_ADMIN' });

    await expect(getUserRole('user-1')).resolves.toBe('SUPER_ADMIN');
  });

  it('returns null when there is no profile, even with user_metadata.role set', async () => {
    mockSupabase(null, { role: 'SUPER_ADMIN' });

    await expect(getUserRole('user-1')).resolves.toBeNull();
  });

  it('ignores user_metadata.role when the profile has no type', async () => {
    mockSupabase({ type: null }, { role: 'ADMIN' });

    await expect(getUserRole('user-1')).resolves.toBeNull();
  });

  it('prefers the profile role over user_metadata', async () => {
    mockSupabase({ type: 'DRIVER' }, { role: 'SUPER_ADMIN' });

    await expect(getUserRole('user-1')).resolves.toBe('DRIVER');
  });
});
