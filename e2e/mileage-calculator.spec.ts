/**
 * Mileage Calculator E2E Tests
 *
 * Verifies the Total Mileage Calculation tool loads correctly,
 * renders all UI components, and handles user interactions.
 *
 * Testing Steps:
 * 1. Navigate to /admin/mileage-calculator (requires auth)
 * 2. Verify page title and layout render
 * 3. Verify form inputs (pickup, drop-off, add/remove stops)
 * 4. Verify tab switching between Calculator and History
 * 5. Verify sidebar navigation link exists
 * 6. Verify auth gate redirects unauthenticated users
 */

import { test, expect, Page } from '@playwright/test';

const TEST_USER = {
  email: process.env.E2E_TEST_USER_EMAIL || '',
  password: process.env.E2E_TEST_USER_PASSWORD || '',
};

async function loginAndNavigateToMileageCalc(page: Page): Promise<void> {
  await page.goto('/sign-in');

  await page.waitForSelector('input[type="email"], input[name="email"]', {
    timeout: 15000,
  });

  await page.fill('input[name="email"], input[type="email"]', TEST_USER.email);
  await page.fill(
    'input[name="password"], input[type="password"]',
    TEST_USER.password,
  );

  await page.click('button[type="submit"]');

  await page.waitForURL(/\/(admin|client|vendor|dashboard)/, {
    timeout: 30000,
  });

  await page.goto('/admin/mileage-calculator');

  await page.waitForSelector('h1:has-text("Total Mileage Calculation")', {
    timeout: 15000,
  });
}

test.describe('Mileage Calculator', () => {
  test.setTimeout(60000);

  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await loginAndNavigateToMileageCalc(page);
  });

  test('should display page title and description', async ({ page }) => {
    await expect(
      page.locator('h1:has-text("Total Mileage Calculation")'),
    ).toBeVisible();

    await expect(
      page.locator('text=Calculate driving distance'),
    ).toBeVisible();
  });

  test('should render pickup and drop-off inputs', async ({ page }) => {
    await expect(page.locator('text=Pickup Location')).toBeVisible();
    await expect(page.locator('text=Drop-off 1')).toBeVisible();
  });

  test('should render the Calculate Mileage button', async ({ page }) => {
    const calcButton = page.locator('button:has-text("Calculate Mileage")');
    await expect(calcButton).toBeVisible();
    await expect(calcButton).toBeDisabled();
  });

  test('should render Add Stop button', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add Stop")');
    await expect(addButton).toBeVisible();
    await expect(addButton).toContainText('1/5');
  });

  test('should add a second drop-off when Add Stop is clicked', async ({
    page,
  }) => {
    await page.click('button:has-text("Add Stop")');

    await expect(page.locator('text=Drop-off 2')).toBeVisible();
    await expect(page.locator('button:has-text("Add Stop")')).toContainText(
      '2/5',
    );
  });

  test('should show remove button for extra drop-offs', async ({ page }) => {
    await page.click('button:has-text("Add Stop")');

    const removeButtons = page.locator('button[aria-label*="Remove drop-off"]');
    await expect(removeButtons.first()).toBeVisible();
  });

  test('should switch between Mileage Calculator and Recent Calculations tabs', async ({
    page,
  }) => {
    const calcTab = page.locator('button[role="tab"]:has-text("Mileage Calculator"), button[role="tab"]:has-text("Calculator")');
    const historyTab = page.locator(
      'button[role="tab"]:has-text("Recent Calculations"), button[role="tab"]:has-text("Recent")',
    );

    await expect(calcTab).toBeVisible();
    await expect(historyTab).toBeVisible();

    await historyTab.click();

    await expect(page.locator('text=No calculations yet')).toBeVisible();

    await calcTab.click();

    await expect(page.locator('text=Pickup Location')).toBeVisible();
  });

  test('should show the map container', async ({ page }) => {
    const mapContainer = page.locator('.mapboxgl-map, [class*="mapbox"]');
    // Map may or may not render depending on Mapbox token availability
    // At minimum the map card should exist
    const mapCard = page.locator('text=Map unavailable').or(mapContainer);
    await expect(mapCard.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display "No calculation yet" placeholder', async ({ page }) => {
    await expect(page.locator('text=No calculation yet')).toBeVisible();
  });

  test('should show Google Maps badge', async ({ page }) => {
    await expect(page.locator('text=Google Maps')).toBeVisible();
  });

  test('should not have critical console errors', async () => {
    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('hydration') &&
        !err.includes('Warning:'),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Mileage Calculator - Auth Gate', () => {
  test('should redirect unauthenticated users to sign-in', async ({
    page,
  }) => {
    await page.goto('/admin/mileage-calculator');

    await page.waitForURL(/\/sign-in/, { timeout: 15000 });

    expect(page.url()).toContain('/sign-in');
  });
});

test.describe('Mileage Calculator - Sidebar Navigation', () => {
  test.setTimeout(60000);

  test('should have Total Mileage Calculation link in sidebar', async ({
    page,
  }) => {
    await loginAndNavigateToMileageCalc(page);

    const sidebarLink = page.locator(
      'a[href="/admin/mileage-calculator"]:has-text("Total Mileage Calculation")',
    );
    await expect(sidebarLink).toBeVisible();
  });
});
