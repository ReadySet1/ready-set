/**
 * Auth callback / confirm redirects must use the configured site origin.
 *
 * Behind the VPS proxy, Next's standalone server sees `request.url` as
 * `http://0.0.0.0:3000/...`, so any redirect built from the request origin
 * sends the browser to an unreachable host (QA B6, Google sign-in on mobile).
 */

import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/rate-limiting', () => ({
  withRateLimit: jest.fn(() => jest.fn(async () => null)),
  RateLimitConfigs: { authCallback: {} },
}));
jest.mock('@/lib/monitoring/sentry', () => ({ setSentryUser: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

const exchangeCodeForSession = jest.fn();
const verifyOtp = jest.fn();
const getUser = jest.fn();
const maybeSingle = jest.fn();

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { exchangeCodeForSession, verifyOtp, getUser },
    from: jest.fn(() => ({
      select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle })) })),
    })),
  })),
}));

import { GET as callbackGET } from '@/app/(site)/(auth)/auth/callback/route';
import { GET as confirmGET } from '@/app/(site)/(auth)/auth/confirm/route';

const SITE = 'https://dev.readysetllc.com';
const INTERNAL = 'http://0.0.0.0:3000';
const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const originalRedirect = NextResponse.redirect;

function location(response: Response): string {
  return response.headers.get('location') ?? '';
}

beforeAll(() => {
  (NextResponse as any).redirect = jest.fn((url: string | URL) =>
    new Response(null, { status: 307, headers: { location: url.toString() } }),
  );
});

afterAll(() => {
  (NextResponse as any).redirect = originalRedirect;
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SITE_URL = SITE;
});

describe('GET /auth/callback', () => {
  const session = { user: { id: 'u1', email: 'a@b.com', user_metadata: {} } };

  it('redirects to the role home on the site origin, not the internal host', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });
    maybeSingle.mockResolvedValue({ data: { type: 'CLIENT' }, error: null });

    const res = await callbackGET(new NextRequest(`${INTERNAL}/auth/callback?code=abc`));

    expect(location(res)).toBe(`${SITE}/client`);
  });

  it('honours an explicit next path on the site origin', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });

    const res = await callbackGET(
      new NextRequest(`${INTERNAL}/auth/callback?code=abc&next=/update-password`),
    );

    expect(location(res)).toBe(`${SITE}/update-password`);
  });

  it('does not follow a protocol-relative next to another host', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });
    maybeSingle.mockResolvedValue({ data: { type: 'DRIVER' }, error: null });

    const res = await callbackGET(
      new NextRequest(`${INTERNAL}/auth/callback?code=abc&next=//evil.example`),
    );

    expect(new URL(location(res)).origin).toBe(SITE);
  });

  it('sends exchange errors to the error page on the site origin', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: { message: 'bad' } });

    const res = await callbackGET(new NextRequest(`${INTERNAL}/auth/callback?code=abc`));

    expect(location(res)).toBe(`${SITE}/auth/auth-code-error?error=bad`);
  });

  it('sends a missing code to the error page on the site origin', async () => {
    const res = await callbackGET(new NextRequest(`${INTERNAL}/auth/callback`));

    expect(location(res)).toBe(`${SITE}/auth/auth-code-error?error=no_code`);
  });
});

describe('GET /auth/confirm', () => {
  it('redirects to next on the site origin after a valid OTP', async () => {
    verifyOtp.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await confirmGET(
      new NextRequest(`${INTERNAL}/auth/confirm?token_hash=t&type=email&next=/client`),
    );

    expect(location(res)).toBe(`${SITE}/client`);
  });

  it('sends a failed OTP to the error page on the site origin', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'expired' } });

    const res = await confirmGET(
      new NextRequest(`${INTERNAL}/auth/confirm?token_hash=t&type=email`),
    );

    expect(location(res)).toBe(`${SITE}/auth/auth-code-error`);
  });

  it('does not follow a protocol-relative next to another host', async () => {
    verifyOtp.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await confirmGET(
      new NextRequest(`${INTERNAL}/auth/confirm?token_hash=t&type=email&next=//evil.example`),
    );

    expect(new URL(location(res)).origin).toBe(SITE);
  });
});
