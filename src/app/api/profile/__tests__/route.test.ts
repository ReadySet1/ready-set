import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { POST } from '../route';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

const mockedCreateClient = jest.mocked(createClient);

/** A session whose profiles lookup returns `profile` and whose user carries `userMetadata`. */
const mockSession = (
  profile: { type: string } | null,
  userMetadata: Record<string, unknown> = {},
) => {
  const insert = jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue({ data: [{}], error: null }),
  });
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'caller-1', user_metadata: userMetadata } },
        error: null,
      }),
      updateUser: jest.fn().mockResolvedValue({ error: null }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: profile, error: null }),
        }),
      }),
      insert,
    }),
  } as any);
  return { insert };
};

const postProfile = () =>
  POST(
    new NextRequest('http://localhost:3000/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        profileData: { auth_user_id: 'someone-else', type: 'SUPER_ADMIN' },
        userTableData: { type: 'SUPER_ADMIN' },
      }),
    }),
  );

describe('POST /api/profile authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('decides admin from the profile, not user_metadata', async () => {
    // No profile row.
    const { insert } = mockSession(null, { role: 'SUPER_ADMIN', type: 'SUPER_ADMIN' });

    const response = await postProfile();

    expect(response.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a non-admin profile', async () => {
    const { insert } = mockSession({ type: 'CLIENT' });

    const response = await postProfile();

    expect(response.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });
});
