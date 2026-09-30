/**
 * Tests for POST /api/auth/sign-out — the server half of sign-out.
 *
 * The browser supabase client only clears cookies through document.cookie; in
 * the iOS WKWebView shell that write is not reliably visible to the next
 * top-level navigation, so the server still saw a session and /sign-in
 * 307-redirected (bouncing the user to Safari). This route clears the auth
 * cookies with Set-Cookie headers on the response.
 */
import { cookies } from 'next/headers';
import { POST } from '../route';
import { createClient } from '@/utils/supabase/server';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
  getDefaultCookieOptions: (options: Record<string, unknown> = {}) => ({
    path: '/',
    sameSite: 'lax',
    ...options,
  }),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

function mockCookieStore(names: string[]) {
  const store = {
    getAll: jest.fn(() => names.map((name) => ({ name, value: 'v' }))),
    set: jest.fn(),
  };
  mockCookies.mockResolvedValue(store as any);
  return store;
}

function expiredNames(store: ReturnType<typeof mockCookieStore>): string[] {
  return store.set.mock.calls
    .filter(([, value, options]) => value === '' && options?.maxAge === 0)
    .map(([name]) => name)
    .sort();
}

describe('POST /api/auth/sign-out', () => {
  const signOut = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    signOut.mockResolvedValue({ error: null });
    mockCreateClient.mockResolvedValue({ auth: { signOut } } as any);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('signs out through the server Supabase client', async () => {
    mockCookieStore([]);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('expires every Supabase auth cookie the request carried (incl. chunks)', async () => {
    const store = mockCookieStore([
      'sb-abc-auth-token.0',
      'sb-abc-auth-token.1',
      'sb-abc-auth-token-code-verifier',
      'user-session-data',
      'theme',
    ]);

    await POST();

    expect(expiredNames(store)).toEqual(
      [
        'sb-abc-auth-token-code-verifier',
        'sb-abc-auth-token.0',
        'sb-abc-auth-token.1',
        'user-session-data',
      ].sort(),
    );
    // Unrelated cookies are left alone.
    expect(store.set).not.toHaveBeenCalledWith('theme', expect.anything(), expect.anything());
  });

  it('still clears the cookies and answers 200 when supabase signOut throws', async () => {
    signOut.mockRejectedValue(new Error('gotrue down'));
    const store = mockCookieStore(['sb-abc-auth-token']);

    const res = await POST();

    expect(res.status).toBe(200);
    expect(expiredNames(store)).toEqual(['sb-abc-auth-token']);
  });

  it('still clears the cookies when supabase signOut returns an error', async () => {
    signOut.mockResolvedValue({ error: new Error('session missing') });
    const store = mockCookieStore(['sb-abc-auth-token']);

    const res = await POST();

    expect(res.status).toBe(200);
    expect(expiredNames(store)).toEqual(['sb-abc-auth-token']);
  });

  it('is not cacheable', async () => {
    mockCookieStore([]);
    const res = await POST();
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
  });
});
