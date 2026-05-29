import type { ErrorEvent, EventHint } from '@sentry/nextjs';
import { createBeforeSend } from '../sentry-filters';

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
