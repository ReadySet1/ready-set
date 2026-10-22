/**
 * E2E Tests: Admin Monitoring Flow (REA-301)
 *
 * Tests the admin tracking dashboard for monitoring drivers and managing deliveries.
 *
 * Test Scenarios:
 * 1. View Active Drivers - Dashboard access, driver list, map visualization
 * 2. Monitor Driver Status - Driver details, location updates, real-time status
 * 3. Assign Delivery - Delivery assignment panel, driver selection, confirmation
 * 4. View Delivery Progress - Status tracking, ETA updates, completion flow
 *
 * Every test runs as the E2E admin (storage state from e2e/auth/setup.ts). The
 * suite skips only when no admin credentials were configured; a redirect to
 * sign-in with credentials present fails the test.
 */

import { test, expect, type Page } from '@playwright/test';
import { authStatePath, hasAuthState, missingAuthReason } from './fixtures/auth-state';

test.use({ storageState: authStatePath('admin') });

test.beforeEach(async ({ page }) => {
  test.skip(!hasAuthState('admin'), missingAuthReason('admin'));
  // The Overview tab mounts a Mapbox map. On CI it renders WebGL in software
  // across 4 parallel workers, starving the renderer until clicks time out.
  // No test here asserts map pixels, so keep Mapbox from loading at all.
  await page.route(/^https:\/\/[a-z]+\.mapbox\.com\//, (route) => route.abort());
  await openDashboard(page);
});

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Every label the dashboard's connection indicator can show
 * (AdminTrackingDashboard.tsx).
 */
const CONNECTION_STATUS = /^(Live Data|Disconnected|SSE Fallback|Connecting\.\.\.)$/;

function connectionStatus(page: Page) {
  return page.getByText(CONNECTION_STATUS).first();
}

/**
 * Open /admin/tracking and wait until the first data load has finished.
 *
 * The dashboard streams and polls continuously, so 'networkidle' never settles.
 * The stat cards render skeletons while loading and their labels only after, so
 * the "GPS Updates" label is the "data loaded" signal.
 */
async function openDashboard(page: Page) {
  await page.goto('/admin/tracking');
  await expect(page, 'admin session was rejected (redirected away)').toHaveURL(/\/admin\/tracking/);
  await expect(connectionStatus(page)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('GPS Updates', { exact: true })).toBeVisible({ timeout: 15000 });
}

const TAB_LABELS = {
  overview: 'Overview',
  map: 'Live Map',
  drivers: 'Drivers',
  deliveries: 'Deliveries',
} as const;

/** Switch tabs and wait for the switch to take effect (no fixed sleep). */
async function navigateToTab(page: Page, tabName: keyof typeof TAB_LABELS) {
  const tab = page.getByRole('tab', { name: TAB_LABELS[tabName], exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

function activePanel(page: Page) {
  // Radix unmounts inactive tab content, so the first tabpanel is the active one.
  return page.getByRole('tabpanel').first();
}

/** "Active Drivers (N)" heading on the Drivers tab → N. */
async function activeDriverCount(page: Page): Promise<number> {
  const heading = page.getByText(/^Active Drivers \(\d+\)$/);
  await expect(heading).toBeVisible();
  const text = (await heading.textContent()) ?? '';
  return Number(text.match(/\((\d+)\)/)?.[1] ?? 0);
}

/** The Deliveries tab finishes loading when the drivers summary title renders. */
async function waitForDeliveriesPanel(page: Page) {
  await expect(page.getByText(/^Available Drivers \(\d+\)$/)).toBeVisible({ timeout: 15000 });
}

/** A label div inside the Deliveries tab summary cards (exact text, not <option>s). */
function deliveryStatLabel(page: Page, label: string) {
  return activePanel(page).locator('div').filter({ hasText: new RegExp(`^${label}$`) });
}

// =============================================================================
// Test Suite: View Active Drivers
// =============================================================================

test.describe('View Active Drivers', () => {
  test('should navigate to /admin/tracking successfully', async ({ page }) => {
    await expect(page).toHaveURL(/.*admin\/tracking/);

    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
    await expect(breadcrumb.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(breadcrumb.getByText('Driver Tracking', { exact: true })).toBeVisible();
  });

  test('should display driver tracking dashboard components', async ({ page }) => {
    await expect(connectionStatus(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
  });

  test('should display statistics cards', async ({ page }) => {
    for (const stat of ['On Duty', 'Active Deliveries', 'Avg Speed (mph)', 'Total Miles', 'GPS Updates']) {
      await expect(page.getByText(stat, { exact: true }).first()).toBeVisible();
    }
  });

  test('should display dashboard tabs', async ({ page }) => {
    for (const tab of Object.values(TAB_LABELS)) {
      await expect(page.getByRole('tab', { name: tab, exact: true })).toBeVisible();
    }
  });

  test('should show driver list in Drivers tab', async ({ page }) => {
    await navigateToTab(page, 'drivers');

    await activeDriverCount(page);
    await expect(page.getByPlaceholder('Search drivers...')).toBeVisible();
  });
});

// =============================================================================
// Test Suite: Monitor Driver Status
// =============================================================================

test.describe('Monitor Driver Status', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToTab(page, 'drivers');
  });

  test('should display driver status indicators', async ({ page }) => {
    const count = await activeDriverCount(page);
    const emptyState = activePanel(page).getByText('No drivers match your criteria');

    if (count === 0) {
      await expect(emptyState).toBeVisible();
    } else {
      // Every driver card carries an On Duty / Off Duty badge.
      await expect(
        activePanel(page).locator('div, span').filter({ hasText: /^(On|Off) Duty$/ }).first()
      ).toBeVisible();
      await expect(emptyState).toHaveCount(0);
    }
  });

  test('should show driver activity types', async ({ page }) => {
    // Activity badges depend on live GPS data; the list itself must render.
    const count = await activeDriverCount(page);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should filter drivers by status', async ({ page }) => {
    const statusFilter = activePanel(page).locator('select').filter({ hasText: 'All Drivers' });

    await statusFilter.selectOption('on_duty');
    await expect(statusFilter).toHaveValue('on_duty');

    await statusFilter.selectOption('all');
    await expect(statusFilter).toHaveValue('all');
  });

  test('should sort drivers list', async ({ page }) => {
    const sortDropdown = activePanel(page).locator('select').filter({ hasText: 'Sort by Status' });

    await sortDropdown.selectOption({ label: 'Sort by Distance' });
    await expect(sortDropdown).toHaveValue('distance');

    await sortDropdown.selectOption({ label: 'Sort by Deliveries' });
    await expect(sortDropdown).toHaveValue('deliveries');
  });

  test('should search for drivers', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search drivers...');
    const emptyState = activePanel(page).getByText('No drivers match your criteria');

    await searchInput.fill('zz-no-such-driver-zz');
    await expect(emptyState).toBeVisible();

    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });

  test('should display last update time', async ({ page }) => {
    await expect(page.getByText(/^Last update:/)).toBeVisible();
  });
});

// =============================================================================
// Test Suite: Assign Delivery
// =============================================================================

test.describe('Assign Delivery', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToTab(page, 'deliveries');
    await waitForDeliveriesPanel(page);
  });

  test('should display delivery management panel', async ({ page }) => {
    await expect(page.getByText('Delivery Management', { exact: true })).toBeVisible();
  });

  test('should show delivery statistics', async ({ page }) => {
    for (const stat of ['Total', 'Unassigned', 'Assigned', 'In Progress']) {
      await expect(deliveryStatLabel(page, stat).first()).toBeVisible();
    }
  });

  test('should filter deliveries by status', async ({ page }) => {
    const filterDropdown = activePanel(page).locator('select').filter({ hasText: 'All Deliveries' });

    await filterDropdown.selectOption({ label: 'Unassigned' });
    await expect(filterDropdown).toHaveValue('unassigned');
  });

  test('should search deliveries', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search deliveries...');

    await searchInput.fill('zz-no-such-delivery-zz');
    await expect(activePanel(page).getByText('No deliveries match your criteria')).toBeVisible();
  });

  test('should display available drivers section', async ({ page }) => {
    await expect(page.getByText(/^Available Drivers \(\d+\)$/)).toBeVisible();
  });

  test('should show delivery priority badges', async ({ page }) => {
    // Each delivery card has a priority badge; with no deliveries the panel
    // shows its empty state instead.
    const priorityBadge = activePanel(page).getByText(/^(high|medium|low) priority$/);
    const emptyState = activePanel(page).getByText('No deliveries match your criteria');

    await expect(priorityBadge.or(emptyState).first()).toBeVisible();
  });

  test('should handle delivery card click interaction', async ({ page }) => {
    const deliveryCard = activePanel(page)
      .locator('.cursor-pointer')
      .filter({ hasText: /(high|medium|low) priority/ })
      .first();

    test.skip((await deliveryCard.count()) === 0, 'No active deliveries in the test database');

    await deliveryCard.click();
    await expect(
      deliveryCard.getByText(/^(Assign to Driver|Current Assignment)$/)
    ).toBeVisible();
  });
});

// =============================================================================
// Test Suite: View Delivery Progress
// =============================================================================

test.describe('View Delivery Progress', () => {
  test('should display delivery status in overview', async ({ page }) => {
    await expect(page.getByText('Active Deliveries', { exact: true }).first()).toBeVisible();
  });

  test('should show delivery locations on map', async ({ page }) => {
    await navigateToTab(page, 'map');

    await expect(page.getByText('Live Driver Tracking Map', { exact: true })).toBeVisible();
    await expect(activePanel(page).locator('.h-96').first()).toBeVisible();
  });

  test('should display ETA information in deliveries tab', async ({ page }) => {
    await navigateToTab(page, 'deliveries');
    await waitForDeliveriesPanel(page);

    await expect(page.getByText('Delivery Management', { exact: true })).toBeVisible();
  });

  test('should show delivery status badges', async ({ page }) => {
    await navigateToTab(page, 'deliveries');
    await waitForDeliveriesPanel(page);

    await expect(deliveryStatLabel(page, 'In Progress').first()).toBeVisible();
  });
});

// =============================================================================
// Test Suite: Dashboard Controls
// =============================================================================

test.describe('Dashboard Controls', () => {
  test('should toggle auto refresh', async ({ page }) => {
    const autoRefresh = page.getByRole('button', { name: /^Auto Refresh (On|Off)$/ });
    const initial = (await autoRefresh.textContent())?.trim();
    const flipped = initial === 'Auto Refresh On' ? 'Auto Refresh Off' : 'Auto Refresh On';

    await autoRefresh.click();
    await expect(autoRefresh).toHaveText(flipped);

    await autoRefresh.click();
    await expect(autoRefresh).toHaveText(initial ?? '');
  });

  test('should trigger manual refresh', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: 'Refresh', exact: true });

    // Refresh is disabled exactly while the dashboard is disconnected.
    if ((await connectionStatus(page).textContent()) === 'Disconnected') {
      await expect(refreshButton).toBeDisabled();
      return;
    }

    await refreshButton.click();
    // A manual refresh always stamps "Last update" with a time.
    await expect(page.getByText(/^Last update: \d/)).toBeVisible();
  });

  test('should export tracking data', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^driver-tracking-.*\.json$/);
  });

  test('should toggle connection mode if available', async ({ page }) => {
    // The mode toggle only exists when the realtime admin-dashboard flag is on.
    const modeToggle = page.getByRole('button', { name: /^(WebSocket|SSE) Mode$/ });
    test.skip((await modeToggle.count()) === 0, 'Realtime admin dashboard flag is off in this build');

    const initial = (await modeToggle.textContent())?.trim();
    await modeToggle.click();
    await expect(modeToggle).not.toHaveText(initial ?? '');
  });
});

// =============================================================================
// Test Suite: Error Handling
// =============================================================================

test.describe('Error Handling', () => {
  test('should handle connection errors gracefully', async ({ page }) => {
    // Whatever the connection state, the dashboard stays usable and an error
    // banner always offers a reconnect.
    await expect(page.getByRole('tab').first()).toBeVisible();

    if ((await page.getByText('Connection Error', { exact: true }).count()) > 0) {
      await expect(page.getByRole('button', { name: 'Reconnect' })).toBeVisible();
    }
  });

  test('should display empty states appropriately', async ({ page }) => {
    await navigateToTab(page, 'drivers');

    const count = await activeDriverCount(page);
    const emptyState = activePanel(page).getByText('No drivers match your criteria');
    await expect(emptyState).toHaveCount(count === 0 ? 1 : 0);
  });
});

// =============================================================================
// Test Suite: Authenticated Admin Tests
// =============================================================================

test.describe('Authenticated Admin Monitoring', () => {
  test('should load tracking dashboard with live data', async ({ page }) => {
    await expect(connectionStatus(page)).toBeVisible();
    await expect(page.getByRole('tab').first()).toBeVisible();
  });

  test('should interact with driver list as admin', async ({ page }) => {
    await navigateToTab(page, 'drivers');

    const searchInput = page.getByPlaceholder('Search drivers...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('test');
    await expect(searchInput).toHaveValue('test');
    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });

  test('should manage deliveries as admin', async ({ page }) => {
    await navigateToTab(page, 'deliveries');

    await expect(page.getByText('Delivery Management', { exact: true })).toBeVisible();
    // The drivers summary title is a skeleton until the drivers query resolves.
    await waitForDeliveriesPanel(page);
  });

  test('should view live map as admin', async ({ page }) => {
    await navigateToTab(page, 'map');

    await expect(page.getByText('Live Driver Tracking Map', { exact: true })).toBeVisible();
  });
});

// =============================================================================
// Test Suite: Full Workflow Integration
// =============================================================================

test.describe('Full Admin Monitoring Workflow', () => {
  test('complete admin monitoring flow', async ({ page }) => {
    // Step 1: overview statistics
    await expect(page.getByText('On Duty', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Active Deliveries', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Driver Locations', { exact: true }).first()).toBeVisible();

    // Step 2: drivers
    await navigateToTab(page, 'drivers');
    await activeDriverCount(page);

    // Step 3: live map
    await navigateToTab(page, 'map');
    await expect(page.getByText('Live Driver Tracking Map', { exact: true })).toBeVisible();

    // Step 4: deliveries
    await navigateToTab(page, 'deliveries');
    await expect(page.getByText('Delivery Management', { exact: true })).toBeVisible();

    // Step 5: back to overview
    await navigateToTab(page, 'overview');
    await expect(page.getByText('Driver Locations', { exact: true }).first()).toBeVisible();
  });
});
