/**
 * E2E Tests for User Soft Delete Functionality
 *
 * Tests the complete user deletion and restoration flows including:
 * - Admin dashboard user management
 * - Soft delete (move to trash) flow
 * - User restoration flow
 * - Permanent deletion flow
 * - Tab switching and UI interactions
 *
 * SAFETY: these tests run against the shared rs-dev database, whose users
 * (including the TEST_* accounts other specs sign in with) must never change.
 * No test here writes to it:
 * - A beforeEach guard aborts EVERY non-GET request to /api/users*, so an
 *   unexpected click can never delete, restore or purge anyone.
 * - The trash / restore / purge flows run end to end in the UI, but the one
 *   mutation each confirms is answered in the browser by page.route (a stubbed
 *   200); the request never reaches the server. The tests then check the UI
 *   reaction and the request the page tried to send.
 *
 * Why not seed a throwaway user and really delete it: rs-dev cannot hard-delete
 * a profile. Its AFTER DELETE audit trigger inserts a user_audits row pointing
 * at the deleted profile and user_audits_userId_fkey is not ON DELETE CASCADE
 * there, so every seeded user would be left behind in the trash for good.
 */

import { test, expect, type Locator, type Page } from '@playwright/test';

// Admin tests run as the TEST_ADMIN user through the storageState saved by
// e2e/auth/setup.ts, so this file carries no admin credentials.
test.use({ storageState: 'e2e/.auth/admin.json' });

// The dev server compiles /admin/users on first hit and the page re-fetches on
// every filter change; give each test room.
test.describe.configure({ timeout: 120000 });

// Permanent deletion needs a SUPER_ADMIN, which global setup does not
// provision. Those tests sign in through the form with credentials read from
// the environment and skip when they are not set. Never hardcode them here.
const SUPER_ADMIN_EMAIL = process.env.TEST_SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = process.env.TEST_SUPER_ADMIN_PASSWORD;

// ---------------------------------------------------------------------------
// Mutation guard and stubs
// ---------------------------------------------------------------------------

type CapturedRequest = { method: string; path: string; body: unknown };

const isUsersApi = (url: URL) => url.pathname.startsWith('/api/users');

/** Abort every non-GET /api/users* request that no test-specific stub answers. */
test.beforeEach(async ({ page }) => {
  await page.route(isUsersApi, (route) =>
    route.request().method() === 'GET' ? route.fallback() : route.abort('blockedbyclient')
  );
});

/**
 * Answer `method` requests whose path ends with `pathSuffix` with a 200, in the
 * browser. Registered after the guard, so it takes precedence for its match.
 */
async function stubUserMutation(
  page: Page,
  method: 'DELETE' | 'POST',
  pathSuffix: RegExp
): Promise<CapturedRequest[]> {
  const calls: CapturedRequest[] = [];
  await page.route(isUsersApi, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== method || !pathSuffix.test(path)) {
      await route.fallback();
      return;
    }
    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    calls.push({ method: request.method(), path, body });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
  return calls;
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

async function loginAsSuperAdmin(page: Page) {
  await page.goto('/sign-in');
  await page.fill('input[name="email"], input[type="email"]', SUPER_ADMIN_EMAIL ?? '');
  await page.fill('input[name="password"], input[type="password"]', SUPER_ADMIN_PASSWORD ?? '');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/);
}

const activeTab = (page: Page): Locator => page.getByRole('tab', { name: 'Active Users' });
const deletedTab = (page: Page): Locator => page.getByRole('tab', { name: 'Deleted Users' });
const typeFilterButton = (page: Page): Locator => page.getByRole('button', { name: /^Type/ });
const statusFilterButton = (page: Page): Locator => page.getByRole('button', { name: /^Status/ });
const tableRows = (page: Page): Locator => page.locator('tbody tr');
const userRow = (page: Page, email: string): Locator => tableRows(page).filter({ hasText: email });

async function navigateToUsersPage(page: Page) {
  await page.goto('/admin/users', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({
    timeout: 45000,
  });
  await waitForUserList(page);
}

/** Wait for the current tab's fetch to land (rows or its empty state). */
async function waitForUserList(page: Page) {
  const emptyState = page.getByRole('heading', { name: /^No (Active|Deleted) Users Found$/ });
  await expect(tableRows(page).first().or(emptyState)).toBeVisible({ timeout: 45000 });
}

async function switchTab(page: Page, tab: 'active' | 'deleted') {
  const trigger = tab === 'active' ? activeTab(page) : deletedTab(page);
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-selected', 'true');
}

/** Email shown in a row's Name / Email cell. */
async function rowEmail(row: Locator): Promise<string> {
  return (await row.locator('td .text-sm.text-slate-500').first().innerText()).trim();
}

/** First active row whose Move to Trash button is enabled (skips Super Admins). */
async function firstTrashableRow(page: Page): Promise<{ row: Locator; email: string }> {
  const rows = tableRows(page);
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const trash = row.getByRole('button', { name: 'Move to Trash' });
    if ((await trash.count()) > 0 && (await trash.isEnabled())) {
      return { row, email: await rowEmail(row) };
    }
  }
  throw new Error('No active user with an enabled Move to Trash button on the first page');
}

/** First soft-deleted user on the Deleted Users tab; skips the test if there is none. */
async function firstDeletedRow(page: Page): Promise<{ row: Locator; email: string }> {
  // The tab renders "No Deleted Users Found" until its debounced fetch lands.
  const deletedList = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/users/deleted',
    { timeout: 45000 }
  );
  await switchTab(page, 'deleted');
  expect((await deletedList).ok()).toBe(true);
  await waitForUserList(page);
  const emptyState = page.getByRole('heading', { name: 'No Deleted Users Found' });
  test.skip(await emptyState.isVisible(), 'No soft-deleted users on this database');
  const row = tableRows(page).first();
  return { row, email: await rowEmail(row) };
}

async function selectTypeFilter(page: Page, label: string) {
  await typeFilterButton(page).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  await expect(typeFilterButton(page)).toContainText(label);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('User Soft Delete E2E Tests', () => {
  test.describe('Admin Dashboard User Management', () => {
    test('should display users management interface with tabs', async ({ page }) => {
      await navigateToUsersPage(page);

      await expect(activeTab(page)).toBeVisible();
      await expect(deletedTab(page)).toBeVisible();
      await expect(activeTab(page)).toHaveAttribute('aria-selected', 'true');

      await expect(page.getByPlaceholder('Search active users...')).toBeVisible();
      await expect(statusFilterButton(page)).toBeVisible();
      await expect(typeFilterButton(page)).toBeVisible();
      await expect(page.getByRole('link', { name: 'Add User' })).toBeVisible();
    });

    test('should switch between Active and Deleted Users tabs', async ({ page }) => {
      await navigateToUsersPage(page);

      await expect(activeTab(page)).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByPlaceholder('Search active users...')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Add User' })).toBeVisible();

      await switchTab(page, 'deleted');

      await expect(page.getByPlaceholder('Search deleted users...')).toBeVisible();
      // Add User and the Status filter only exist on the Active tab.
      await expect(page.getByRole('link', { name: 'Add User' })).toBeHidden();
      await expect(statusFilterButton(page)).toBeHidden();
    });
  });

  test.describe('Soft Delete Flow', () => {
    test('should successfully move user to trash with reason', async ({ page }) => {
      const deleteCalls = await stubUserMutation(page, 'DELETE', /^\/api\/users\/[^/]+$/);
      await navigateToUsersPage(page);

      const { row, email } = await firstTrashableRow(page);
      await row.hover();
      await row.getByRole('button', { name: 'Move to Trash' }).click();

      const dialog = page.getByRole('dialog', { name: 'Move User to Trash' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('will move');
      await expect(dialog).toContainText('can be restored later');

      const deletionReason = 'E2E test deletion - user request';
      await dialog.getByLabel('Reason for deletion (optional)').fill(deletionReason);
      // Stubbed: answered in the browser, the user is not touched.
      await dialog.getByRole('button', { name: 'Move to Trash' }).click();

      await expect(dialog).toBeHidden({ timeout: 30000 });
      await expect(page.getByText('User moved to trash', { exact: true })).toBeVisible();
      await expect(userRow(page, email)).toBeHidden();

      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0]?.body).toEqual({ reason: deletionReason });
    });

    test('should prevent deletion of super admin users', async ({ page }) => {
      await navigateToUsersPage(page);
      await selectTypeFilter(page, 'Super Admin');

      const superAdminRows = tableRows(page).filter({ hasText: 'Super Admin' });
      const emptyState = page.getByRole('heading', { name: 'No Active Users Found' });
      await expect(superAdminRows.first().or(emptyState)).toBeVisible({ timeout: 30000 });
      test.skip(await emptyState.isVisible(), 'No Super Admin users on this database');

      // Read-only: the trash button is rendered disabled, so nothing is clicked.
      const row = superAdminRows.first();
      await row.hover();
      await expect(row.getByRole('button', { name: 'Move to Trash' })).toBeDisabled();
    });

    // Needs a HELPDESK session to hit the permission-denied path; global setup
    // provisions none (only driver/admin/vendor/client).
    test.skip('should show validation when trying to delete without proper permissions', async () => {});
  });

  test.describe('User Restoration Flow', () => {
    test('should successfully restore a deleted user', async ({ page }) => {
      const restoreCalls = await stubUserMutation(page, 'POST', /^\/api\/users\/[^/]+\/restore$/);
      await navigateToUsersPage(page);

      const { row, email } = await firstDeletedRow(page);
      await expect(row).toHaveClass(/bg-red-50/);
      await row.hover();
      await row.getByRole('button', { name: 'Restore' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Restore User' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('will restore');
      await expect(dialog).toContainText('make them active again');

      // Stubbed: answered in the browser, the user stays in the trash.
      await dialog.getByRole('button', { name: 'Restore User' }).click();

      await expect(dialog).toBeHidden({ timeout: 30000 });
      await expect(page.getByText('User restored', { exact: true })).toBeVisible();
      await expect(userRow(page, email)).toBeHidden();
      expect(restoreCalls).toHaveLength(1);
    });
  });

  test.describe('Permanent Deletion Flow', () => {
    test('should not show permanent delete option for regular admin', async ({ page }) => {
      // Signed in as a regular ADMIN via the file-level storageState. Read-only.
      await navigateToUsersPage(page);

      const { row } = await firstDeletedRow(page);
      await row.hover();

      await expect(row.getByRole('button', { name: 'Restore' })).toBeVisible();
      await expect(row.getByRole('button', { name: 'Permanently Delete' })).toHaveCount(0);
    });

    test.describe('as super admin', () => {
      // Start signed out: these tests sign in through the form as a SUPER_ADMIN.
      test.use({ storageState: { cookies: [], origins: [] } });
      test.skip(
        !SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD,
        'TEST_SUPER_ADMIN_EMAIL / TEST_SUPER_ADMIN_PASSWORD not set',
      );

      async function openPermanentDeleteDialog(
        page: Page
      ): Promise<{ dialog: Locator; email: string }> {
        await loginAsSuperAdmin(page);
        await navigateToUsersPage(page);

        const { row, email } = await firstDeletedRow(page);
        await row.hover();
        await row.getByRole('button', { name: 'Permanently Delete' }).click();

        const dialog = page.getByRole('dialog', { name: 'Permanently Delete User' });
        await expect(dialog).toBeVisible();
        return { dialog, email };
      }

      const reasonField = (dialog: Locator) =>
        dialog.getByLabel('Reason for permanent deletion (required - minimum 10 characters)');

      test('should permanently delete user as super admin with proper warnings', async ({ page }) => {
        const purgeCalls = await stubUserMutation(page, 'DELETE', /^\/api\/users\/[^/]+\/purge$/);
        const { dialog, email } = await openPermanentDeleteDialog(page);

        await expect(dialog).toContainText('DANGER');
        await expect(dialog).toContainText('cannot be undone');
        await expect(dialog).toContainText('permanently removed');
        const warning = dialog.getByRole('alert').filter({ hasText: 'Warning' });
        await expect(warning).toContainText('irreversible');
        await expect(warning).toContainText('GDPR compliance');

        const confirm = dialog.getByRole('button', { name: 'Permanently Delete' });
        await expect(confirm).toBeDisabled();

        const permanentReason = 'GDPR data deletion request - user requested complete data removal';
        await reasonField(dialog).fill(permanentReason);
        await expect(dialog.getByText(`${permanentReason.length}/10 characters minimum`)).toBeVisible();
        await expect(confirm).toBeEnabled();

        // Stubbed: answered in the browser, nothing is purged.
        await confirm.click();

        await expect(dialog).toBeHidden({ timeout: 30000 });
        await expect(page.getByText('User permanently deleted', { exact: true })).toBeVisible();
        await expect(userRow(page, email)).toBeHidden();
        expect(purgeCalls).toHaveLength(1);
        expect(purgeCalls[0]?.body).toEqual({ reason: permanentReason });
      });

      test('should require minimum character count for permanent deletion reason', async ({ page }) => {
        const { dialog } = await openPermanentDeleteDialog(page);
        const confirm = dialog.getByRole('button', { name: 'Permanently Delete' });

        await reasonField(dialog).fill('short');
        await expect(dialog.getByText('5/10 characters minimum')).toBeVisible();
        await expect(confirm).toBeDisabled();

        await reasonField(dialog).fill('1234567890');
        await expect(dialog.getByText('10/10 characters minimum')).toBeVisible();
        await expect(confirm).toBeEnabled();

        // Never confirm here: cancel out.
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog).toBeHidden();
      });
    });
  });

  test.describe('Search and Filter Functionality', () => {
    test('should search in both active and deleted users', async ({ page }) => {
      await navigateToUsersPage(page);

      // Search the active list for the first user it shows.
      const firstEmail = await rowEmail(tableRows(page).first());
      const activeSearch = page.waitForResponse(
        (res) =>
          new URL(res.url()).pathname === '/api/users' &&
          new URL(res.url()).searchParams.get('search') === firstEmail,
        { timeout: 30000 }
      );
      await page.getByPlaceholder('Search active users...').fill(firstEmail);
      await activeSearch;
      await expect(userRow(page, firstEmail)).toBeVisible();

      // Switching tabs clears the search and retargets it at deleted users.
      await switchTab(page, 'deleted');
      const deletedInput = page.getByPlaceholder('Search deleted users...');
      await expect(deletedInput).toBeVisible();
      await expect(deletedInput).toHaveValue('');

      const deletedSearch = page.waitForResponse(
        (res) =>
          new URL(res.url()).pathname === '/api/users/deleted' &&
          new URL(res.url()).searchParams.get('search') === 'deleted',
        { timeout: 30000 }
      );
      await deletedInput.fill('deleted');
      expect((await deletedSearch).ok()).toBe(true);
    });

    test('should filter by user type in both tabs', async ({ page }) => {
      await navigateToUsersPage(page);

      await selectTypeFilter(page, 'Client');

      // The type filter carries over to the Deleted Users tab...
      await switchTab(page, 'deleted');
      await expect(typeFilterButton(page)).toContainText('Client');

      // ...and can be changed there.
      await selectTypeFilter(page, 'Vendor');
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Fail the users list request in the browser; nothing reaches the server.
      await page.route(
        (url) => url.pathname === '/api/users',
        (route) =>
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'E2E simulated server error' }),
          })
      );

      await page.goto('/admin/users', { waitUntil: 'domcontentloaded', timeout: 60000 });

      const errorAlert = page.getByRole('alert').filter({ hasText: 'E2E simulated server error' });
      await expect(errorAlert).toBeVisible({ timeout: 45000 });
      await expect(page.getByRole('heading', { name: 'No Active Users Found' })).toBeVisible();
    });

    // No concurrency guard to exercise: the page only disables a dialog's own
    // buttons while its request is in flight.
    test.skip('should prevent concurrent operations on same user', async () => {});

    test('should maintain state when switching tabs', async ({ page }) => {
      await navigateToUsersPage(page);

      await page.getByPlaceholder('Search active users...').fill('test');
      await selectTypeFilter(page, 'Client');

      await switchTab(page, 'deleted');
      await switchTab(page, 'active');

      // The type filter survives the round trip; the search box is reset.
      await expect(typeFilterButton(page)).toContainText('Client');
      await expect(page.getByPlaceholder('Search active users...')).toHaveValue('');
    });
  });
});
