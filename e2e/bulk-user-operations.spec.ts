/**
 * E2E Tests for Bulk User Operations
 *
 * Tests the full UI workflow for bulk user operations including:
 * - Checkbox selection (single, all, toggle)
 * - Bulk action bar functionality
 * - Bulk status change
 * - Bulk delete (soft delete)
 * - Bulk restore
 * - CSV export
 *
 * Uses the adminTest fixture for authenticated admin access.
 *
 * SAFETY: these tests run against the shared rs-dev database, whose users
 * (including the TEST_* accounts other specs log in with) must never change.
 * Every mutating bulk action (status change, delete, restore) goes through
 * BulkConfirmDialog; the tests only open that dialog and then Cancel it —
 * nothing is ever confirmed. Export is a read-only GET, and the error-path
 * test stubs the export endpoint so no request reaches the server.
 */

import type { Locator, Page } from '@playwright/test';
import { adminTest as test, expect } from './fixtures/auth.fixture';

/** "1 user selected" / "9 users selected" text in the floating bulk action bar. */
const selectionCount = (page: Page): Locator => page.getByText(/^\d+ users? selected$/);

const selectionLabel = (n: number): string => `${n} ${n === 1 ? 'user' : 'users'} selected`;

/** The floating bulk action bar (the element holding both the count and the Clear button). */
const bulkBar = (page: Page): Locator =>
  page
    .locator('div')
    .filter({ has: selectionCount(page) })
    .filter({ has: page.getByRole('button', { name: 'Clear', exact: true }) })
    .last();

/** Selectable row checkboxes (Super Admin rows render a disabled "Cannot select" checkbox). */
const rowCheckboxes = (page: Page): Locator =>
  page.locator('tbody').getByRole('checkbox', { name: /^Select (?!all )/ });

const deletedTab = (page: Page): Locator => page.getByRole('tab', { name: 'Deleted Users' });

test.describe('Bulk User Operations', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Pre-answer the cookie banner: it is fixed to the bottom of the viewport
    // and would sit on top of the floating bulk action bar.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('cookieConsentStatus', 'rejected');
      } catch {
        // storage unavailable — the banner just stays visible
      }
    });

    await page.goto('/admin/users');

    // The page keeps polling, so networkidle never settles: wait for real content.
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({
      timeout: 30000,
    });
    await expect(rowCheckboxes(page).first()).toBeVisible({ timeout: 30000 });
  });

  test.describe('Selection UI', () => {
    test('should select a single user via checkbox', async ({ authenticatedPage: page }) => {
      const firstCheckbox = rowCheckboxes(page).first();
      await firstCheckbox.click();

      await expect(firstCheckbox).toBeChecked();
      await expect(bulkBar(page)).toBeVisible();
      await expect(selectionCount(page)).toHaveText(selectionLabel(1));
    });

    test('should select all users on page via header checkbox', async ({
      authenticatedPage: page,
    }) => {
      const selectableOnPage = await rowCheckboxes(page).count();
      expect(selectableOnPage).toBeGreaterThan(0);

      await page.getByRole('checkbox', { name: 'Select all users on this page' }).click();

      await expect(selectionCount(page)).toHaveText(selectionLabel(selectableOnPage));
    });

    test('should deselect user via toggle', async ({ authenticatedPage: page }) => {
      const firstCheckbox = rowCheckboxes(page).first();

      await firstCheckbox.click();
      await expect(selectionCount(page)).toHaveText(selectionLabel(1));

      await firstCheckbox.click();

      await expect(firstCheckbox).not.toBeChecked();
      await expect(selectionCount(page)).toBeHidden();
    });

    test('should clear all selections via clear button', async ({ authenticatedPage: page }) => {
      const firstCheckbox = rowCheckboxes(page).first();
      await firstCheckbox.click();
      await expect(selectionCount(page)).toBeVisible();

      await bulkBar(page).getByRole('button', { name: 'Clear', exact: true }).click();

      await expect(selectionCount(page)).toBeHidden();
      await expect(firstCheckbox).not.toBeChecked();
    });
  });

  test.describe('Bulk Status Change', () => {
    test('should open confirmation dialog when changing status', async ({
      authenticatedPage: page,
    }) => {
      await rowCheckboxes(page).first().click();
      await expect(selectionCount(page)).toHaveText(selectionLabel(1));

      await bulkBar(page).getByRole('button', { name: 'Status' }).click();
      await page.getByRole('menuitem', { name: 'Set Active' }).click();

      const dialog = page.getByRole('dialog', { name: 'Change User Status' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Change the status of 1 user to "ACTIVE"');

      // Never confirm on shared data — cancel and make sure nothing ran.
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
      await expect(selectionCount(page)).toHaveText(selectionLabel(1));
    });
  });

  test.describe('Bulk Delete', () => {
    test('should show confirmation dialog with warning when deleting', async ({
      authenticatedPage: page,
    }) => {
      await rowCheckboxes(page).first().click();
      await expect(selectionCount(page)).toHaveText(selectionLabel(1));

      await bulkBar(page).getByRole('button', { name: 'Delete', exact: true }).click();

      const dialog = page.getByRole('dialog', { name: 'Move Users to Trash' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('This action will affect 1 user');
      await expect(dialog.getByRole('button', { name: 'Move to Trash' })).toBeVisible();

      // Never confirm on shared data — cancel and make sure nothing ran.
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
      await expect(selectionCount(page)).toHaveText(selectionLabel(1));
    });
  });

  test.describe('Bulk Restore (Deleted Users Tab)', () => {
    test('should navigate to deleted users tab and show restore option', async ({
      authenticatedPage: page,
    }) => {
      const deletedUsersResponse = page.waitForResponse(
        (res) => res.url().includes('/api/users/deleted') && res.request().method() === 'GET',
        { timeout: 30000 }
      );
      await deletedTab(page).click();
      await expect(deletedTab(page)).toHaveAttribute('data-state', 'active');
      await deletedUsersResponse;

      const deletedRows = rowCheckboxes(page);
      const emptyState = page.getByRole('heading', { name: 'No Deleted Users Found' });
      await expect(deletedRows.first().or(emptyState)).toBeVisible({ timeout: 30000 });

      test.skip(await emptyState.isVisible(), 'No soft-deleted users on this database');

      await deletedRows.first().click();
      await expect(selectionCount(page)).toHaveText(selectionLabel(1));

      // Only check the action is offered — clicking it would open a restore dialog.
      const restoreButton = bulkBar(page).getByRole('button', { name: 'Restore' });
      await expect(restoreButton).toBeVisible();
      await expect(restoreButton).toBeEnabled();
      await expect(bulkBar(page).getByRole('button', { name: 'Delete', exact: true })).toHaveCount(
        0
      );
    });
  });

  test.describe('CSV Export', () => {
    test('should trigger export when clicking export button', async ({
      authenticatedPage: page,
    }) => {
      await rowCheckboxes(page).first().click();
      await expect(selectionCount(page)).toHaveText(selectionLabel(1));

      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      await bulkBar(page).getByRole('button', { name: 'Export' }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename().toLowerCase()).toMatch(/\.csv$/);
    });
  });

  test.describe('Selection Persistence', () => {
    test('should clear selection when switching between tabs', async ({
      authenticatedPage: page,
    }) => {
      await rowCheckboxes(page).first().click();
      await expect(selectionCount(page)).toHaveText(selectionLabel(1));

      await deletedTab(page).click();

      await expect(deletedTab(page)).toHaveAttribute('data-state', 'active');
      await expect(selectionCount(page)).toBeHidden();
    });
  });

  test.describe('Error Handling', () => {
    test('should show error toast when bulk operation fails', async ({
      authenticatedPage: page,
    }) => {
      // Stub the (read-only) export endpoint with a server error so the failure
      // path runs without touching any data.
      await page.route('**/api/users/bulk/export**', (route) =>
        route.fulfill({ status: 500, json: { error: 'Simulated export failure' } })
      );

      await rowCheckboxes(page).first().click();
      await expect(selectionCount(page)).toHaveText(selectionLabel(1));

      await bulkBar(page).getByRole('button', { name: 'Export' }).click();

      await expect(page.getByText('Export failed', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Simulated export failure').first()).toBeVisible();
      // The bar stays usable after a failure.
      await expect(bulkBar(page).getByRole('button', { name: 'Export' })).toBeEnabled();
    });
  });
});

test.describe('Bulk User Operations - Permissions', () => {
  test('should not show bulk selection checkboxes for non-admin users', async ({ page }) => {
    // Navigate to admin users page without authentication
    await page.goto('/admin/users');

    // Should redirect to sign-in or show unauthorized
    const signInVisible = (await page.locator('text=Sign In').count()) > 0;
    const unauthorizedVisible =
      (await page.locator('text=Unauthorized').count()) > 0 ||
      (await page.locator('text=403').count()) > 0 ||
      (await page.locator('text=Access Denied').count()) > 0;

    // Either redirect to sign-in or show unauthorized
    expect(signInVisible || unauthorizedVisible).toBeTruthy();
    await expect(page.getByRole('checkbox', { name: 'Select all users on this page' })).toHaveCount(
      0
    );
  });
});
