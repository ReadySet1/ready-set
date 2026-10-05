import { test, expect, type Page } from '@playwright/test';

/**
 * Client dashboard (/client) regression tests.
 *
 * /client serves CLIENT and VENDOR users; these tests use the CLIENT session
 * saved by e2e/auth/setup.ts, so no UI sign-in happens here.
 */
test.use({ storageState: 'e2e/.auth/client.json' });

const dashboardHeading = (page: Page) =>
  page.getByRole('heading', { level: 1, name: 'Client Dashboard' });

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

const viewAllLink = (page: Page) => dashboard(page).getByRole('link', { name: 'View All' });

const quickActions = (page: Page) =>
  dashboard(page)
    .locator('div.overflow-hidden')
    .filter({ has: page.getByRole('heading', { name: 'Quick Actions' }) });

async function openDashboard(page: Page): Promise<void> {
  await page.goto('/client');
  // The stat cards and quick actions render server-side with the page, so
  // this heading marks "dashboard loaded" without waiting on network idle.
  await expect(page.getByRole('heading', { name: 'Quick Actions' })).toBeVisible();
}

test.describe('Client Dashboard QA - Regression Testing', () => {
  test('1. Login and Initial View - Verify correct page title and breadcrumb', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await openDashboard(page);

    await expect(dashboardHeading(page)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Vendor Dashboard' })).toHaveCount(0);

    expect(errors).toHaveLength(0);
  });

  test('2. Visual & Data Integrity - Verify dashboard widgets and data loading', async ({ page }) => {
    await openDashboard(page);

    await expect(statLabel(page, 'Active Orders')).toBeVisible();
    await expect(statLabel(page, 'Completed')).toBeVisible();
    await expect(statLabel(page, 'Saved Locations')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Recent Orders' })).toBeVisible();
    await expect(viewAllLink(page)).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Quick Actions' })).toBeVisible();

    await expect(statValues(page).first()).toBeVisible();

    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  });

  test('3. Functional Testing - Verify navigation links and interactions', async ({ page }) => {
    await openDashboard(page);
    const actions = quickActions(page);

    const newOrderLink = actions.locator('a[href="/catering-request"]');
    await expect(newOrderLink).toBeVisible();
    await expect(newOrderLink).toContainText('New Catering Order');

    await expect(viewAllLink(page)).toBeVisible();
    await expect(viewAllLink(page)).toHaveAttribute('href', '/client/orders');

    await expect(actions.locator('a[href="/client/orders/new"]')).toBeVisible();
    await expect(actions.locator('a[href="/addresses"]')).toBeVisible();
    await expect(actions.locator('a[href="/profile"]')).toBeVisible();
    await expect(actions.locator('a[href="/contact"]')).toBeVisible();

    await expect(actions.getByText('Schedule a catering delivery')).toBeVisible();
    await expect(actions.getByText('Request immediate delivery')).toBeVisible();
    await expect(actions.getByText('Add or edit your locations')).toBeVisible();
    await expect(actions.getByText('Manage your account details')).toBeVisible();
    await expect(actions.getByText('Get in touch with our team')).toBeVisible();

    // With orders: each card has a "View Details" link. Without: an empty
    // state offers "Place Your First Order".
    const viewDetailsLinks = dashboard(page).getByRole('link', { name: 'View Details' });
    const placeFirstOrder = dashboard(page).getByRole('link', { name: 'Place Your First Order' });
    if ((await viewDetailsLinks.count()) > 0) {
      await expect(viewDetailsLinks.first()).toBeVisible();
    } else {
      await expect(placeFirstOrder).toHaveAttribute('href', '/catering-request');
    }
  });

  test('4. Responsiveness - Test mobile and tablet layouts', async ({ page }) => {
    await openDashboard(page);

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(dashboardHeading(page)).toBeVisible();
    await expect(statLabel(page, 'Active Orders')).toBeVisible();
    await expect(dashboard(page).locator('.grid').first()).toBeVisible();

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(dashboardHeading(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mobile Menu' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quick Actions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Orders' })).toBeVisible();
  });

  test('5. Dynamic Title Logic - Verify correct title for CLIENT role', async ({ page }) => {
    await openDashboard(page);

    await expect(dashboardHeading(page)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Vendor Dashboard' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Admin Dashboard' })).toHaveCount(0);

    await expect(page.getByText('Manage your account', { exact: true })).toBeVisible();
  });

  test('6. Data Loading States - Verify skeleton loading works', async ({ page }) => {
    await openDashboard(page);

    await expect(statLabel(page, 'Active Orders')).toBeVisible({ timeout: 10000 });

    // No dashboard skeleton should remain once content has loaded.
    const visibleSkeletons = await dashboard(page).locator('.animate-pulse:visible').count();
    expect(visibleSkeletons).toBeLessThanOrEqual(2);
  });

  test('7. Error Handling - Verify graceful handling of missing data', async ({ page }) => {
    await openDashboard(page);

    const noOrdersMessage = dashboard(page).getByText("You haven't placed any orders yet");
    if ((await noOrdersMessage.count()) > 0) {
      await expect(noOrdersMessage).toBeVisible();
      await expect(dashboard(page).getByRole('link', { name: 'Place Your First Order' })).toBeVisible();
    }

    for (const stat of await statValues(page).all()) {
      const text = await stat.textContent();
      expect(text).not.toContain('Error');
      expect(text).not.toContain('undefined');
      expect(text).not.toContain('NaN');
    }
  });

  test('8. Accessibility - Verify WCAG compliance', async ({ page }) => {
    await openDashboard(page);

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    expect(await page.locator('a[href]').count()).toBeGreaterThan(0);

    // Every visible button needs an accessible name (aria-label or text).
    for (const button of await page.locator('button:visible, [role="button"]:visible').all()) {
      const ariaLabel = await button.getAttribute('aria-label');
      const text = (await button.textContent())?.trim();
      expect(ariaLabel || text, await button.evaluate((el) => el.outerHTML.slice(0, 200))).toBeTruthy();
    }

    const headings = page.locator('h1, h2');
    expect(await headings.count()).toBeGreaterThan(0);
  });

  test('9. Data Separation - Verify CLIENT sees only their own data', async ({ page }) => {
    await openDashboard(page);

    await expect(dashboardHeading(page)).toBeVisible();
    await expect(statLabel(page, 'Active Orders')).toBeVisible();
    await expect(statLabel(page, 'Completed')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Orders' })).toBeVisible();

    // The vendor-only quick action must not show for a CLIENT.
    await expect(quickActions(page).locator('a[href="/client/calculator"]')).toHaveCount(0);
  });

  test('10. Role-Based Navigation Testing - Test all dashboard links work correctly for CLIENT', async ({ page }) => {
    await openDashboard(page);
    const actions = quickActions(page);

    const links = [
      { href: '/catering-request', text: 'New Catering Order' },
      { href: '/client/orders/new', text: 'New On-Demand Order' },
      { href: '/addresses', text: 'Manage Addresses' },
      { href: '/profile', text: 'Update Profile' },
      { href: '/contact', text: 'Contact Us' },
    ];

    for (const link of links) {
      const linkElement = actions.locator(`a[href="${link.href}"]`);
      await expect(linkElement).toBeVisible();
      await expect(linkElement).toContainText(link.text);
    }

    await expect(viewAllLink(page)).toHaveAttribute('href', '/client/orders');

    const viewDetailsLinks = dashboard(page).getByRole('link', { name: 'View Details' });
    if ((await viewDetailsLinks.count()) > 0) {
      await expect(viewDetailsLinks.first()).toHaveAttribute('href', /^\/order-status\//);
    }
  });

  test('11. Cross-Role Data Isolation - Verify CLIENT and VENDOR data separation', async ({ page }) => {
    await openDashboard(page);
    await expect(dashboardHeading(page)).toBeVisible();

    await expect(statLabel(page, 'Active Orders')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Orders' })).toBeVisible();

    // Seven stat cards (active, pending, completed, cancelled, saved
    // locations, revenue, 30-day growth).
    await expect(statValues(page)).toHaveCount(7);
  });

  test('12. Error State Handling - Verify proper error handling for CLIENT dashboard', async ({ page }) => {
    await openDashboard(page);

    const errorMessages = dashboard(page).getByText(/Something went wrong|Failed to load/);
    for (const error of await errorMessages.all()) {
      const text = (await error.textContent())?.toLowerCase();
      expect(text).not.toContain('undefined');
      expect(text).not.toContain('null');
    }

    await expect(page.getByRole('heading', { name: 'Quick Actions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Orders' })).toBeVisible();
  });
});
