/**
 * Storage-state paths written by e2e/auth/setup.ts, plus a guard for specs that
 * need one.
 *
 * Specs must skip ONLY when the role's credentials were never configured (the
 * auth file is missing). A redirect to /sign-in while the file exists is a real
 * failure — the session expired or the login broke — and must fail the test,
 * not quietly skip it.
 */

import fs from 'fs';
import path from 'path';

export type AuthRole = 'admin' | 'client' | 'driver' | 'vendor';

/** Path relative to the repo root, as `test.use({ storageState })` expects. */
export function authStatePath(role: AuthRole): string {
  return `e2e/.auth/${role}.json`;
}

export function hasAuthState(role: AuthRole): boolean {
  return fs.existsSync(path.join(__dirname, '..', '.auth', `${role}.json`));
}

export function missingAuthReason(role: AuthRole): string {
  return `No ${role} auth state: set TEST_${role.toUpperCase()}_EMAIL / TEST_${role.toUpperCase()}_PASSWORD`;
}
