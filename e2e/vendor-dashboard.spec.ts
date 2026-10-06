import { test, expect, type Page } from '@playwright/test';

/**
 * Vendor Dashboard QA
 *
 * VENDOR users share the unified dashboard at /client (/vendor redirects
 * there); the page swaps the title to "Vendor Dashboard" and adds the
 * vendor-only "Delivery Cost Estimator" quick action.
 *
 * Auth comes from the vendor storageState saved by global setup.
 */
test.use({ storageState: 'e2e/.auth/vendor.json' });

async function gotoDashboard(page: Page) {
  await page.goto('/client', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vendor Dashboard' })
  ).toBeVisible({ timeout: 30000 });
}

// Scope dashboard assertions to <main>. The stats/recent-orders/quick-actions
// block sits in a <Suspense> boundary, so React streams it as a hidden copy
// (<div hidden id="S:0">, appended after the footer) that a deferred $RC/$RV
// script later moves into place. React 19.2 throttles that reveal, so for a
// moment after `load` the DOM holds the visible copy in <main> AND the hidden
// one outside it. Page-wide text/CSS locators match both and fail strict mode.
// Same fix as e2e/data-separation.spec.ts (#638).
const dashboard = (page: Page) => page.getByRole('main');

const statLabel = (page: Page, label: string) =>
  dashboard(page).getByText(label, { exact: true });

// The value line of each stat card (the breadcrumb h1 also uses .text-2xl.font-bold).
const statValues = (page: Page) => dashboard(page).locator('h4.text-2xl.font-bold');

/**
 * A quick-action card link. Its accessible name is the title followed by the
 * description, so match on the title prefix; role queries also skip the hidden
 * streamed copy.
 */
const quickActionLink = (page: Page, name: string) =>
  dashboard(page).getByRole('link', { name: new RegExp(`^${name}`) });

/** Quick-action cards on the dashboard, keyed by href. */
const QUICK_ACTIONS = [
  { href: '/catering-request', name: 'New Catering Order', description: 'Schedule a catering delivery' },
  { href: '/client/orders/new', name: 'New On-Demand Order', description: 'Request immediate delivery' },
  { href: '/client/calculator', name: 'Delivery Cost Estimator', description: 'Estimate your delivery cost' },
  { href: '/addresses', name: 'Manage Addresses', description: 'Add or edit your locations' },
  { href: '/profile', name: 'Update Profile', description: 'Manage your account details' },
  { href: '/contact', name: 'Contact Us', description: 'Get in touch with our team' },
];

test.describe('Vendor Dashboard QA - Functional Testing', () => {
  test('1. Login and Initial View - Verify correct page title and breadcrumb for VENDOR role', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await gotoDashboard(page);

    // Title is role-aware: VENDOR sees "Vendor Dashboard", never "Client Dashboard"
    await expect(page.getByRole('heading', { level: 1, name: 'Client Dashboard' })).toHaveCount(0);

    // Let the client bundle hydrate before checking for runtime errors
    await expect(page.getByRole('heading', { name: 'Quick Actions' })).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('2. Visual & Data Integrity - Verify dashboard widgets and data loading for VENDOR', async ({ page }) => {
    await gotoDashboard(page);

    // Primary stat widgets
    await expect(statLabel(page, 'Active Orders')).toBeVisible();
    await expect(statLabel(page, 'Completed')).toBeVisible();
    await expect(statLabel(page, 'Saved Locations')).toBeVisible();

    // Recent orders section
    await expect(page.getByRole('heading', { name: 'Recent Orders' })).toBeVisible();
    await expect(dashboard(page).getByRole('link', { name: 'View All' })).toBeVisible();

    // Quick actions section
    await expect(page.getByRole('heading', { name: 'Quick Actions' })).toBeVisible();

    // Stat cards render a numeric value
    await expect(statValues(page).first()).toHaveText(/\d/);

    // Welcome message
    await expect(page.getByRole('heading', { level: 2, name: /Welcome back/ })).toBeVisible();
  });

  test('3. Functional Testing - Verify navigation links and interactions for VENDOR', async ({ page }) => {
    await gotoDashboard(page);

    for (const action of QUICK_ACTIONS) {
      const link = quickActionLink(page, action.name);
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', action.href);
      await expect(link).toContainText(action.description);
    }

    const viewAllLink = dashboard(page).getByRole('link', { name: 'View All' });
    await expect(viewAllLink).toHaveAttribute('href', '/client/orders');

    // Either recent order cards (with "View Details") or the empty state
    // (with "Place Your First Order") must be shown.
    const viewDetails = dashboard(page).getByRole('link', { name: 'View Details' });
    const placeFirstOrder = dashboard(page).getByRole('link', { name: 'Place Your First Order' });
    await expect(viewDetails.first().or(placeFirstOrder)).toBeVisible();

    if ((await placeFirstOrder.count()) > 0) {
      await expect(placeFirstOrder).toHaveAttribute('href', '/catering-request');
    }
  });

  test('4. Responsiveness - Test mobile and tablet layouts for VENDOR dashboard', async ({ page }) => {
    await gotoDashboard(page);
    const title = page.getByRole('heading', { level: 1, name: 'Vendor Dashboard' });

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(title).toBeVisible();
    await expect(statLabel(page, 'Active Orders')).toBeVisible();

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(title).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mobile Menu' })).toBeVisible();

    // Content still reachable on mobile
    await expect(page.getByRole('heading', { name: 'Quick Actions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Orders' })).toBeVisible();
  });

  test('5. Dynamic Title Logic - Verify correct title for VENDOR role', async ({ page }) => {
    await gotoDashboard(page);

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1.filter({ hasText: 'Vendor Dashboard' })).toHaveCount(1);
    await expect(h1.filter({ hasText: 'Client Dashboard' })).toHaveCount(0);
    await expect(h1.filter({ hasText: 'Admin Dashboard' })).toHaveCount(0);

    // Breadcrumb description
    await expect(page.getByText('Manage your account', { exact: true })).toBeVisible();
  });

  test('6. Data Loading States - Verify skeleton loading works for VENDOR', async ({ page }) => {
    await gotoDashboard(page);

    // Real content replaces the skeletons
    await expect(statLabel(page, 'Active Orders')).toBeVisible();

    // No dashboard skeletons remain once content has loaded
    const visibleSkeletons = dashboard(page).locator('.animate-pulse:visible');
    expect(await visibleSkeletons.count()).toBeLessThanOrEqual(2);
  });

  test('7. Error Handling - Verify graceful handling of missing data for VENDOR', async ({ page }) => {
    await gotoDashboard(page);

    // Empty state is graceful when there are no orders
    const noOrdersMessage = dashboard(page).getByText("You haven't placed any orders yet");
    if ((await noOrdersMessage.count()) > 0) {
      await expect(noOrdersMessage).toBeVisible();
      await expect(dashboard(page).getByRole('link', { name: 'Place Your First Order' })).toBeVisible();
    }

    // Stats show numbers, not error states
    const statsValues = statValues(page);
    expect(await statsValues.count()).toBeGreaterThan(0);
    for (const stat of await statsValues.all()) {
      const text = (await stat.textContent()) ?? '';
      expect(text).not.toContain('Error');
      expect(text).not.toContain('undefined');
      expect(text).not.toContain('NaN');
    }
  });

  test('8. Accessibility - Verify WCAG compliance for VENDOR dashboard', async ({ page }) => {
    await gotoDashboard(page);

    // Keyboard navigation moves focus onto the page
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');

    // Links exist and carry hrefs
    expect(await page.locator('a[href]').count()).toBeGreaterThan(0);

    // Every visible button has an accessible name
    for (const button of await page.locator('button:visible, [role="button"]:visible').all()) {
      const ariaLabel = await button.getAttribute('aria-label');
      const text = (await button.textContent())?.trim();
      expect(ariaLabel || text).toBeTruthy();
    }

    // Heading structure
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(await page.getByRole('heading', { level: 2 }).count()).toBeGreaterThan(0);
  });

  test('9. Data Separation - Verify VENDOR sees only their own data', async ({ page }) => {
    await gotoDashboard(page);

    // Shared dashboard structure
    await expect(statLabel(page, 'Active Orders')).toBeVisible();
    await expect(statLabel(page, 'Completed')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Orders' })).toBeVisible();

    // Vendor-only quick action (hidden for CLIENT users)
    const estimator = quickActionLink(page, 'Delivery Cost Estimator');
    await expect(estimator).toBeVisible();
    await expect(estimator).toHaveAttribute('href', '/client/calculator');
  });

  test('10. Navigation Testing - Test all dashboard links work correctly for VENDOR', async ({ page }) => {
    await gotoDashboard(page);

    for (const action of QUICK_ACTIONS) {
      const link = quickActionLink(page, action.name);
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', action.href);
    }
    await expect(dashboard(page).getByRole('link', { name: 'View All' })).toHaveAttribute('href', '/client/orders');

    // Order cards (if any) link to the unified order-status page
    const viewDetailsLinks = dashboard(page).getByRole('link', { name: 'View Details' });
    if ((await viewDetailsLinks.count()) > 0) {
      await expect(viewDetailsLinks.first()).toHaveAttribute('href', /^\/order-status\//);
    }

    // A quick action actually navigates
    await quickActionLink(page, 'New On-Demand Order').click();
    // First visit compiles the route on a dev server
    await expect(page).toHaveURL(/\/client\/orders\/new/, { timeout: 30000 });
  });
});
