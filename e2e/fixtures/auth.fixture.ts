/**
 * Playwright Authentication Fixtures
 *
 * Provides pre-authenticated page contexts for different user roles.
 * Uses storageState to reuse authentication sessions, eliminating
 * the need for repeated logins.
 *
 * Usage:
 *   import { test as clientTest } from './fixtures/auth.fixture';
 *
 *   clientTest('my test', async ({ authenticatedPage }) => {
 *     // Page is already authenticated as CLIENT
 *     await authenticatedPage.goto('/dashboard');
 *   });
 */

import { test as base, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authDir = path.join(__dirname, '..', '.auth');

type AuthFixtures = {
  authenticatedPage: Page;
  authenticatedContext: BrowserContext;
};

/**
 * Helper to check if auth file exists
 */
function getAuthFile(role: string): string {
  const authFile = path.join(authDir, `${role.toLowerCase()}.json`);
  if (!fs.existsSync(authFile)) {
    throw new Error(
      `Auth file not found for ${role}: ${authFile}\n\n` +
        `Recovery options:\n` +
        `  1. Run authentication setup: pnpm playwright test --project=setup\n` +
        `  2. Delete old auth files and re-run: rm -rf e2e/.auth && pnpm test:e2e\n` +
        `  3. Ensure test users exist in database: pnpm tsx e2e/test-data-setup.ts setup\n` +
        `  4. Verify .env.test has correct credentials\n\n` +
        `See e2e/README.md for troubleshooting details.`
    );
  }
  return authFile;
}

/**
 * CLIENT role fixture
 */
export const clientTest = base.extend<AuthFixtures>({
  authenticatedContext: async ({ browser }, use) => {
    const authFile = getAuthFile('CLIENT');
    const context = await browser.newContext({
      storageState: authFile,
    });
    await use(context);
    await context.close();
  },

  authenticatedPage: async ({ authenticatedContext }, use) => {
    const page = await authenticatedContext.newPage();
    await use(page);
    await page.close();
  },
});

/**
 * VENDOR role fixture
 */
export const vendorTest = base.extend<AuthFixtures>({
  authenticatedContext: async ({ browser }, use) => {
    const authFile = getAuthFile('VENDOR');
    const context = await browser.newContext({
      storageState: authFile,
    });
    await use(context);
    await context.close();
  },

  authenticatedPage: async ({ authenticatedContext }, use) => {
    const page = await authenticatedContext.newPage();
    await use(page);
    await page.close();
  },
});

/**
 * ADMIN role fixture (when available)
 */
export const adminTest = base.extend<AuthFixtures>({
  authenticatedContext: async ({ browser }, use) => {
    const authFile = getAuthFile('ADMIN');
    const context = await browser.newContext({
      storageState: authFile,
    });
    await use(context);
    await context.close();
  },

  authenticatedPage: async ({ authenticatedContext }, use) => {
    const page = await authenticatedContext.newPage();
    await use(page);
    await page.close();
  },
});

/**
 * Generic authenticated test that accepts a role parameter
 * Useful for tests that need to run with different roles
 */
type RoleAuthFixtures = {
  role: 'CLIENT' | 'VENDOR' | 'ADMIN';
  authenticatedPage: Page;
  authenticatedContext: BrowserContext;
};

export const roleBasedTest = base.extend<RoleAuthFixtures>({
  role: ['CLIENT', { option: true }],

  authenticatedContext: async ({ browser, role }, use) => {
    const authFile = getAuthFile(role);
    const context = await browser.newContext({
      storageState: authFile,
    });
    await use(context);
    await context.close();
  },

  authenticatedPage: async ({ authenticatedContext }, use) => {
    const page = await authenticatedContext.newPage();
    await use(page);
    await page.close();
  },
});

/**
 * Export a unified test object with all fixtures
 */
export const test = {
  client: clientTest,
  vendor: vendorTest,
  admin: adminTest,
  withRole: roleBasedTest,
};

/**
 * Re-export expect for convenience
 */
export { expect } from '@playwright/test';
