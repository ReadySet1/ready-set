/**
 * Regression guard for REA-DRT-07.
 *
 * Supabase auth cookies (`sb-<ref>-auth-token` chunks) are written through the
 * cookie-option factories in `src/utils/supabase/{server,middleware}.ts`. The
 * browser supabase-js client reads the session via `document.cookie`, which by
 * spec cannot see HttpOnly cookies. If either factory ever sets
 * `httpOnly: true` again, `getSession()` returns null in the browser, all
 * Supabase Realtime flows silently fail to authenticate, and the token-refresh
 * service throws REFRESH_FAILED (Sentry READY-SET-NEXTJS-1S).
 *
 * These tests fail loudly if anyone re-introduces `httpOnly: true`.
 */

import { describe, it, expect } from '@jest/globals';

// `@/utils/supabase/server` is globally auto-mocked in jest.setup.ts (for query
// builders), which strips this pure helper. Pull the real implementations so we
// assert against shipped behavior, not the mock. `getCookieOptions` is not
// globally mocked, but we requireActual both for symmetry + future-proofing.
const { getDefaultCookieOptions } = jest.requireActual<
  typeof import('@/utils/supabase/server')
>('@/utils/supabase/server');
const { getCookieOptions } = jest.requireActual<
  typeof import('@/utils/supabase/middleware')
>('@/utils/supabase/middleware');

describe('Supabase auth cookie options (REA-DRT-07 regression guard)', () => {
  describe('server.ts getDefaultCookieOptions', () => {
    it('must NOT mark cookies httpOnly — auth cookies have to be JS-readable', () => {
      expect(getDefaultCookieOptions().httpOnly).toBeFalsy();
    });

    it('must not let caller options re-introduce httpOnly silently', () => {
      // Even when @supabase/ssr passes through options, the default merge must
      // not be the thing that stamps httpOnly. (supabase/ssr does not set it.)
      const opts = getDefaultCookieOptions({ maxAge: 0 });
      expect(opts.httpOnly).toBeFalsy();
    });

    it('preserves the other Safari/ITP-friendly hardening', () => {
      const opts = getDefaultCookieOptions();
      expect(opts.path).toBe('/');
      expect(opts.sameSite).toBe('lax');
      // secure follows NODE_ENV; just assert the key is computed, not dropped.
      expect(opts).toHaveProperty('secure');
    });

    it('still lets callers override individual fields', () => {
      const opts = getDefaultCookieOptions({ path: '/scoped', maxAge: 60 });
      expect(opts.path).toBe('/scoped');
      expect(opts.maxAge).toBe(60);
    });
  });

  describe('middleware.ts getCookieOptions', () => {
    it('must NOT mark cookies httpOnly — auth cookies have to be JS-readable', () => {
      expect(getCookieOptions().httpOnly).toBeFalsy();
    });

    it('must not let caller options re-introduce httpOnly silently', () => {
      const opts = getCookieOptions({ maxAge: 0 });
      expect(opts.httpOnly).toBeFalsy();
    });

    it('preserves the other Safari/ITP-friendly hardening', () => {
      const opts = getCookieOptions();
      expect(opts.path).toBe('/');
      expect(opts.sameSite).toBe('lax');
      expect(opts).toHaveProperty('secure');
    });
  });
});
