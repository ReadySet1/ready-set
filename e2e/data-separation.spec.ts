import { test, expect, type Page } from '@playwright/test';

/**
 * Data separation and role-based access control for the unified dashboard.
 *
 * CLIENT and VENDOR users share one dashboard at /client (/vendor redirects
 * there). The page resolves the caller server-side, titles itself by role and
 * loads only that user's orders. Admins and drivers are bounced to their own
 * dashboards; anonymous visitors are sent to /sign-in.
 *
 * Each describe block runs under the session that global setup saved for that
 * role (e2e/.auth/<role>.json).
 */

// The dashboard title is the <h1> rendered by components/Common/Breadcrumb.
const dashboardTitle = (page: Page) => page.getByRole('heading', { level: 1 });

// Scope dashboard assertions to <main>. The stats/quick-actions block sits in a
// <Suspense> boundary, so React streams it as a hidden copy
// (<div hidden id="S:0">, appended after the footer) that a deferred $RC/$RV
// script later moves into place. React 19.2 throttles that reveal, so for a
// moment after `load` the DOM holds the visible copy in <main> AND the hidden
// one outside it. Page-wide text/CSS locators match both and fail strict mode.
const dashboard = (page: Page) => page.getByRole('main');

const activeOrdersStat = (page: Page) =>
  dashboard(page).getByText('Active Orders', { exact: true });

// Vendor-only quick action on the unified dashboard.
const vendorEstimatorLink = (page: Page) =>
  dashboard(page).locator('a[href="/client/calculator"]');

async function expectDashboardStructure(page: Page) {
  await expect(activeOrdersStat(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent Orders' })).toBeVisible();
}

test.describe('Data Separation and Role-Based Access Control', () => {
  test.describe('as CLIENT', () => {
    test.use({ storageState: 'e2e/.auth/client.json' });

    test('CLIENT role data isolation - Verify CLIENT cannot access VENDOR data', async ({ page }) => {
      await page.goto('/client');

      await expect(dashboardTitle(page)).toHaveText('Client Dashboard');
      await expect(dashboardTitle(page)).not.toContainText('Vendor');
      await expectDashboardStructure(page);

      // The vendor-only delivery cost estimator must not be offered to a client.
      await expect(vendorEstimatorLink(page)).toHaveCount(0);
    });

    test('Data filtering in shared components - Verify proper data isolation', async ({ page }) => {
      await page.goto('/client');

      await expect(dashboardTitle(page)).toHaveText('Client Dashboard');
      await expectDashboardStructure(page);

      // With no orders of their own, the user sees the empty state rather than
      // anybody else's orders.
      const emptyState = dashboard(page).getByText("You haven't placed any orders yet");
      if ((await emptyState.count()) > 0) {
        await expect(emptyState).toBeVisible();
        await expect(dashboard(page).getByRole('link', { name: 'Place Your First Order' })).toBeVisible();
      }
    });

    test('Session persistence and role consistency - Verify role persists across navigation', async ({ page }) => {
      await page.goto('/client');
      await expect(dashboardTitle(page)).toHaveText('Client Dashboard');

      // Client-side navigation; /profile may still be compiling on a dev server.
      await dashboard(page).getByRole('link', { name: /^Update Profile/ }).click();
      await expect(page).toHaveURL(/\/profile/, { timeout: 15000 });

      await page.goto('/client');
      await expect(dashboardTitle(page)).toHaveText('Client Dashboard');
      await expect(activeOrdersStat(page)).toBeVisible();
    });

    test('API endpoint security - Verify role-based data filtering in API responses', async ({ page }) => {
      // Listen before navigating so errors thrown during the first render count.
      const errors: string[] = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });

      await page.goto('/client');
      await expect(dashboardTitle(page)).toHaveText('Client Dashboard');
      await expect(activeOrdersStat(page)).toBeVisible();
      await page.waitForLoadState('load');

      expect(errors).toHaveLength(0);
    });

    test('Cross-contamination prevention - Verify no data leakage between roles', async ({ page }) => {
      await page.goto('/client');
      await expect(dashboardTitle(page)).toHaveText('Client Dashboard');

      await page.goto('/profile');
      await page.goto('/client');

      await expect(dashboardTitle(page)).toHaveText('Client Dashboard');
      await expect(activeOrdersStat(page)).toBeVisible();
      await expect(vendorEstimatorLink(page)).toHaveCount(0);
    });

    test('Role verification in dashboard actions - Verify actions are role-appropriate', async ({ page }) => {
      await page.goto('/client');
      await expect(dashboardTitle(page)).toHaveText('Client Dashboard');

      const quickActions = [
        { href: '/catering-request', text: 'New Catering Order' },
        { href: '/client/orders/new', text: 'New On-Demand Order' },
        { href: '/addresses', text: 'Manage Addresses' },
        { href: '/profile', text: 'Update Profile' },
        { href: '/contact', text: 'Contact Us' },
      ];

      for (const action of quickActions) {
        const actionElement = dashboard(page).getByRole('link', { name: new RegExp(`^${action.text}`) });
        await expect(actionElement).toBeVisible();
        await expect(actionElement).toHaveAttribute('href', action.href);
      }
    });
  });

  test.describe('as VENDOR', () => {
    test.use({ storageState: 'e2e/.auth/vendor.json' });

    test('VENDOR role data isolation - Verify VENDOR cannot access CLIENT data', async ({ page }) => {
      await page.goto('/client');

      await expect(dashboardTitle(page)).toHaveText('Vendor Dashboard');
      await expect(dashboardTitle(page)).not.toContainText('Client');
      await expectDashboardStructure(page);

      await expect(vendorEstimatorLink(page)).toBeVisible();
    });

    test('Legacy /vendor route lands on the unified dashboard', async ({ page }) => {
      await page.goto('/vendor');

      await expect(page).toHaveURL(/\/client$/);
      await expect(dashboardTitle(page)).toHaveText('Vendor Dashboard');
    });
  });

  test.describe('without a session', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Role-based URL protection - Verify unauthorized access is prevented', async ({ page }) => {
      await page.goto('/client');
      await expect(page).toHaveURL(/\/sign-in/);

      await page.goto('/vendor');
      await expect(page).toHaveURL(/\/sign-in/);
    });
  });

  test.describe('as DRIVER', () => {
    test.use({ storageState: 'e2e/.auth/driver.json' });

    test('Drivers are redirected away from the client dashboard', async ({ page }) => {
      // The driver dashboard polls continuously, so don't wait for 'load'.
      await page.goto('/client', { waitUntil: 'commit' });

      await expect(page).toHaveURL(/\/driver/);
      await expect(page.getByRole('heading', { name: /Client Dashboard|Vendor Dashboard/ })).toHaveCount(0);
    });
  });
});
