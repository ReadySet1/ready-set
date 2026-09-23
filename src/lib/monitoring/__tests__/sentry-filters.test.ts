import type { ErrorEvent, EventHint } from '@sentry/nextjs';
import { createBeforeSend, getSentryEnvironment } from '../sentry-filters';

const beforeSend = createBeforeSend({ includeClientFilters: true });
const noHint = {} as EventHint;

function abortEvent(value: string, withAuthJsFrame = false): ErrorEvent {
  return {
    exception: {
      values: [
        {
          type: 'AbortError',
          value,
          stacktrace: withAuthJsFrame
            ? { frames: [{ filename: 'node_modules/@supabase/auth-js/dist/locks.js' }] }
            : undefined,
        },
      ],
    },
  } as unknown as ErrorEvent;
}

describe('createBeforeSend — Supabase auth navigator-lock AbortErrors', () => {
  it('drops the "steal" variant even with no stacktrace (READY-SET-NEXTJS-1M)', () => {
    const event = abortEvent("Lock broken by another request with the 'steal' option.");
    expect(beforeSend(event, noHint)).toBeNull();
  });

  it('drops the lock-timeout variant when it has auth-js frames (READY-SET-NEXTJS-1D)', () => {
    const event = abortEvent('signal is aborted without reason', true);
    expect(beforeSend(event, noHint)).toBeNull();
  });

  it('keeps the lock-timeout variant when it does NOT originate from auth-js', () => {
    const event = abortEvent('signal is aborted without reason', false);
    expect(beforeSend(event, noHint)).not.toBeNull();
  });

  it('keeps unrelated AbortErrors', () => {
    const event = abortEvent('The user aborted a request.');
    expect(beforeSend(event, noHint)).not.toBeNull();
  });
});

describe('createBeforeSend — crawler traffic', () => {
  const CHROME_141 =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
  const BYTESPIDER =
    'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)';

  function eventWithUa(
    userAgent: string,
    exception: { type: string; value: string } = {
      type: 'TypeError',
      value: 'x is not a function',
    },
    headerName = 'User-Agent'
  ): ErrorEvent {
    return {
      exception: { values: [exception] },
      request: { headers: { [headerName]: userAgent } },
    } as unknown as ErrorEvent;
  }

  const chunkTimeout = {
    type: 'ChunkLoadError',
    value:
      'Loading chunk app/global-error-3f1a failed.\n(timeout: https://www.readysetllc.com/_next/static/chunks/app/global-error-3f1a.js)',
  };

  it('drops any event from a known crawler UA', () => {
    expect(beforeSend(eventWithUa(BYTESPIDER), noHint)).toBeNull();
  });

  it('reads a lower-cased user-agent header too', () => {
    expect(
      beforeSend(eventWithUa(BYTESPIDER, undefined, 'user-agent'), noHint)
    ).toBeNull();
  });

  it('drops a crawler ChunkLoadError timeout', () => {
    expect(beforeSend(eventWithUa(BYTESPIDER, chunkTimeout), noHint)).toBeNull();
  });

  it('KEEPS a real-user ChunkLoadError timeout', () => {
    expect(
      beforeSend(eventWithUa(CHROME_141, chunkTimeout), noHint)
    ).not.toBeNull();
  });

  it('keeps ordinary errors from a real browser', () => {
    expect(beforeSend(eventWithUa(CHROME_141), noHint)).not.toBeNull();
  });

  it('keeps events with no user agent at all', () => {
    const event = {
      exception: { values: [{ type: 'TypeError', value: 'boom' }] },
    } as unknown as ErrorEvent;
    expect(beforeSend(event, noHint)).not.toBeNull();
  });
});

describe('getSentryEnvironment — environment tag resolution', () => {
  const ENV_KEYS = [
    'NEXT_PUBLIC_SENTRY_ENVIRONMENT',
    'NEXT_PUBLIC_VERCEL_ENV',
    'VERCEL_ENV',
    'NODE_ENV',
  ] as const;
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('prefers the explicit NEXT_PUBLIC_SENTRY_ENVIRONMENT override', () => {
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = 'development';
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production';
    process.env.NODE_ENV = 'production';
    expect(getSentryEnvironment()).toBe('development');
  });

  it('falls back to NEXT_PUBLIC_VERCEL_ENV in the browser bundle', () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview';
    process.env.NODE_ENV = 'production';
    expect(getSentryEnvironment()).toBe('preview');
  });

  it('falls back to VERCEL_ENV on server/edge when no public var is set', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.NODE_ENV = 'production';
    expect(getSentryEnvironment()).toBe('preview');
  });

  it('does NOT report production from NODE_ENV alone when a Vercel env is present', () => {
    // The core NEXTJS-1F mis-tag: dev deploy had NODE_ENV=production but
    // VERCEL_ENV=preview — it must not surface as "production".
    process.env.VERCEL_ENV = 'preview';
    process.env.NODE_ENV = 'production';
    expect(getSentryEnvironment()).not.toBe('production');
  });

  it('uses NODE_ENV only as a local-dev fallback', () => {
    process.env.NODE_ENV = 'development';
    expect(getSentryEnvironment()).toBe('development');
  });

  it('defaults to development when nothing is set', () => {
    expect(getSentryEnvironment()).toBe('development');
  });
});
