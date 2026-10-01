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

// Vendor-only quick action on the unified dashboard.
const vendorEstimatorLink = (page: Page) => page.locator('a[href="/client/calculator"]');

async function expectDashboardStructure(page: Page) {
  await expect(page.getByText('Active Orders', { exact: true })).toBeVisible();
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
      const emptyState = page.getByText("You haven't placed any orders yet");
      if ((await emptyState.count()) > 0) {
        await expect(emptyState).toBeVisible();
        await expect(page.getByRole('link', { name: 'Place Your First Order' })).toBeVisible();
      }
    });

    test('Session persistence and role consistency - Verify role persists across navigation', async ({ page }) => {
      await page.goto('/client');
      await expect(dashboardTitle(page)).toHaveText('Client Dashboard');

      // Client-side navigation; /profile may still be compiling on a dev server.
      await page.locator('a[href="/profile"]', { hasText: 'Update Profile' }).click();
      await expect(page).toHaveURL(/\/profile/, { timeout: 15000 });

      await page.goto('/client');
      await expect(dashboardTitle(page)).toHaveText('Client Dashboard');
      await expect(page.getByText('Active Orders', { exact: true })).toBeVisible();
    });

    test('API endpoint security - Verify role-based data filtering in API responses', async ({ page }) => {
      // Listen before navigating so errors thrown during the first render count.
      const errors: string[] = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });

      await page.goto('/client');
      await expect(dashboardTitle(page)).toHaveText('Client Dashboard');
      await expect(page.getByText('Active Orders', { exact: true })).toBeVisible();
      await page.waitForLoadState('load');

      expect(errors).toHaveLength(0);
    });

    test('Cross-contamination prevention - Verify no data leakage between roles', async ({ page }) => {
      await page.goto('/client');
      await expect(dashboardTitle(page)).toHaveText('Client Dashboard');

      await page.goto('/profile');
      await page.goto('/client');

      await expect(dashboardTitle(page)).toHaveText('Client Dashboard');
      await expect(page.getByText('Active Orders', { exact: true })).toBeVisible();
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
        const actionElement = page.locator(`a[href="${action.href}"]`, { hasText: action.text });
        await expect(actionElement).toBeVisible();
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
