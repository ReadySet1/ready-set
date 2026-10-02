/**
 * @jest-environment jsdom
 */
import { performSignOut, SERVER_SIGN_OUT_ENDPOINT } from '../sign-out';

const mockClientSignOut = jest.fn();
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: { signOut: (...args: unknown[]) => mockClientSignOut(...args) },
  }),
}));

const mockClearAuthCookies = jest.fn();
jest.mock('@/utils/auth/cookies', () => ({
  clearAuthCookies: () => mockClearAuthCookies(),
}));

const mockIsNative = jest.fn();
jest.mock('@/lib/tracking/native-shift-tracking', () => ({
  isCapacitorNative: () => mockIsNative(),
}));

describe('performSignOut', () => {
  const navigate = jest.fn();
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNative.mockReturnValue(false);
    mockClientSignOut.mockResolvedValue({ error: null });
    fetchMock.mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('POSTs to the server sign-out endpoint so the auth cookies are cleared server-side', async () => {
    await performSignOut({ navigate });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SERVER_SIGN_OUT_ENDPOINT);
    expect(init).toEqual(
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
  });

  it('also signs out the browser client and clears legacy cookies', async () => {
    await performSignOut({ navigate });

    expect(mockClientSignOut).toHaveBeenCalledTimes(1);
    expect(mockClearAuthCookies).toHaveBeenCalledTimes(1);
  });

  it('runs the caller-provided cleanup (e.g. UserContext logout)', async () => {
    const cleanup = jest.fn().mockResolvedValue(undefined);
    await performSignOut({ navigate, cleanup });
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('lands on /sign-in on plain web', async () => {
    await performSignOut({ navigate });
    expect(navigate).toHaveBeenCalledWith('/sign-in');
  });

  it('lands on /native-launch inside the native shell (never a redirecting URL)', async () => {
    mockIsNative.mockReturnValue(true);
    await performSignOut({ navigate });
    expect(navigate).toHaveBeenCalledWith('/native-launch');
  });

  it('honours a custom web destination but still uses /native-launch in the shell', async () => {
    await performSignOut({ navigate, webDestination: '/' });
    expect(navigate).toHaveBeenLastCalledWith('/');

    mockIsNative.mockReturnValue(true);
    await performSignOut({ navigate, webDestination: '/' });
    expect(navigate).toHaveBeenLastCalledWith('/native-launch');
  });

  it('still signs out the client and navigates when the server call throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await performSignOut({ navigate });

    expect(mockClientSignOut).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/sign-in');
  });

  it('still navigates when the client sign-out and cleanup throw', async () => {
    mockClientSignOut.mockRejectedValue(new Error('lock timeout'));
    const cleanup = jest.fn().mockRejectedValue(new Error('boom'));
    mockClearAuthCookies.mockImplementation(() => {
      throw new Error('cookie');
    });

    await performSignOut({ navigate, cleanup });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/sign-in');
  });

  it('navigates only after the server has answered', async () => {
    const order: string[] = [];
    fetchMock.mockImplementation(async () => {
      order.push('server');
      return { ok: true };
    });
    navigate.mockImplementation(() => order.push('navigate'));

    await performSignOut({ navigate });
    expect(order).toEqual(['server', 'navigate']);
  });
});
