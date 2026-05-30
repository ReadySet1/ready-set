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
