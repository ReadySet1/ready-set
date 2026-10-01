/**
 * Admin Demo Calculator E2E Tests
 *
 * Tests for the admin-facing demo calculator at /admin/calculator/demo
 *
 * This calculator:
 * - REQUIRES authentication (admin, super_admin, helpdesk)
 * - SHOWS driver earnings (visible to internal users)
 * - Uses flat fee pricing (Ready Set Food Standard)
 * - Supports multi-stop deliveries
 */

import { test, expect, Page } from '@playwright/test';

/**
 * Navigate to the admin demo calculator. The admin session comes from the
 * storageState saved by e2e/auth/setup.ts (TEST_ADMIN_* env), so there is no
 * UI login here and no credentials in this file.
 */
async function navigateToAdminDemoCalculator(page: Page): Promise<void> {
  await page.goto('/admin/calculator/demo');

  // Wait for the calculator to load
  await page.waitForSelector('h1:has-text("Delivery Cost Calculator")', { timeout: 15000 });
}

test.describe('Admin Demo Calculator', () => {
  // Signed in as the TEST_ADMIN user via the session saved by global setup.
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await navigateToAdminDemoCalculator(page);
  });

  test('1. Calculator page loads successfully with authentication', async ({ page }) => {
    // Verify the page loaded with key elements
    await expect(page.locator('h1:has-text("Delivery Cost Calculator")')).toBeVisible();
    await expect(page.locator('text=Interactive Demo')).toBeVisible();
    await expect(page.locator('text=Delivery Details')).toBeVisible();
    await expect(page.locator('text=Multi-Stop Delivery')).toBeVisible();
  });

  test('2. Should SHOW driver earnings section', async ({ page }) => {
    // Driver Earnings section SHOULD be visible for admin users
    await expect(page.locator('text=Driver Earnings')).toBeVisible();
    await expect(page.locator('text=Total Driver Pay:')).toBeVisible();
    await expect(page.locator('text=Base Pay:')).toBeVisible();
  });

  test('3. Should show customer charges section', async ({ page }) => {
    // Customer Charges section should also be visible
    await expect(page.locator('text=Customer Charges')).toBeVisible();
    await expect(page.locator('text=Base Delivery Fee:')).toBeVisible();
    await expect(page.locator('text=Total Delivery Fee:')).toBeVisible();
  });

  test('4. All input fields render correctly', async ({ page }) => {
    // Verify headcount input
    const headcountInput = page.locator('#headcount');
    await expect(headcountInput).toBeVisible();
    await expect(headcountInput).toHaveValue('50'); // Default value

    // Verify food cost input
    const foodCostInput = page.locator('#foodCost');
    await expect(foodCostInput).toBeVisible();
    await expect(foodCostInput).toHaveValue('500'); // Default value

    // Verify number of stops input
    const stopsInput = page.locator('#stops');
    await expect(stopsInput).toBeVisible();
    await expect(stopsInput).toHaveValue('1'); // Default value

    // Verify bridge crossing switch
    const bridgeSwitch = page.locator('#bridge');
    await expect(bridgeSwitch).toBeVisible();
  });

  test('5. Multi-stop controls show driver bonus', async ({ page }) => {
    const stopsInput = page.locator('#stops');
    await expect(stopsInput).toHaveValue('1');

    // Click increment button
    const incrementButton = page.locator('button:has-text("+")');
    await incrementButton.click();
    await expect(stopsInput).toHaveValue('2');

    // Should show extra stops info WITH driver bonus
    await expect(page.locator('text=1 Extra Stop')).toBeVisible();
    await expect(page.locator('text=Customer charge:')).toBeVisible();
    // Driver bonus SHOULD be visible for admin
    await expect(page.locator('text=Driver bonus:')).toBeVisible();
  });

  test('6. Pricing explanation shows 3 columns (with driver bonus)', async ({ page }) => {
    // Should show First Stop, Additional Stops, AND Driver Bonus
    const heading = page.getByRole('heading', { name: 'How Multi-Stop Pricing Works' });
    await expect(heading).toBeVisible();
    const pricing = heading.locator('..');

    await expect(pricing.getByText('First Stop', { exact: true })).toBeVisible();
    await expect(pricing.getByText(/Included in the base delivery fee/)).toBeVisible();
    await expect(pricing.getByText('Additional Stops', { exact: true })).toBeVisible();
    await expect(pricing.getByText(/\$5\.00 per extra stop/)).toBeVisible();
    // Driver Bonus column SHOULD exist for admin
    await expect(pricing.getByText('Driver Bonus', { exact: true })).toBeVisible();
    await expect(pricing.getByText(/\$2\.50 bonus/)).toBeVisible();
  });

  test('7. Driver earnings calculation is correct', async ({ page }) => {
    // Enable manual mileage mode
    const manualToggle = page.locator('#manual-mileage');
    await manualToggle.click();

    // Set values
    await page.fill('#headcount', '50');
    await page.fill('#foodCost', '700');
    await page.fill('#mileage', '15');

    // Wait for calculation
    await page.waitForTimeout(500);

    // Driver Earnings section should show base pay and mileage pay
    await expect(page.locator('text=Driver Earnings')).toBeVisible();
    await expect(page.locator('text=Base Pay:')).toBeVisible();

    // Check for mileage in driver section (15 mi)
    const driverMileage = page.locator('text=Mileage (15 mi)').first();
    await expect(driverMileage).toBeVisible();
  });

  test('8. Extra stops bonus appears in driver earnings', async ({ page }) => {
    // Enable manual mileage mode
    const manualToggle = page.locator('#manual-mileage');
    await manualToggle.click();

    // Set values
    await page.fill('#headcount', '50');
    await page.fill('#foodCost', '700');
    await page.fill('#mileage', '8');

    // Add 2 extra stops
    const incrementButton = page.locator('button:has-text("+")');
    await incrementButton.click();
    await incrementButton.click();

    // Wait for calculation
    await page.waitForTimeout(500);

    // Should show extra stops bonus in driver earnings
    await expect(page.locator('text=Extra Stops Bonus (2):')).toBeVisible();
    const extraStopsBonus = page.locator('text=Extra Stops Bonus (2):').locator('..').locator('span').last();
    // 2 extra stops * $2.50 = $5.00
    await expect(extraStopsBonus).toContainText('$5.00');
  });

  test('9. Flat fee pricing matches public calculator', async ({ page }) => {
    // Enable manual mileage mode
    const manualToggle = page.locator('#manual-mileage');
    await manualToggle.click();

    // Set tier 2 values: headcount 30, food cost $400, 8 miles
    await page.fill('#headcount', '30');
    await page.fill('#foodCost', '400');
    await page.fill('#mileage', '8');

    // Wait for calculation
    await page.waitForTimeout(500);

    // Tier 2 flat fee should be $70 (same as public calculator)
    const baseFee = page.locator('text=Base Delivery Fee:').locator('..').locator('span').last();
    await expect(baseFee).toContainText('$70.00');
  });

  test('10. Bridge toll appears in both customer and driver sections', async ({ page }) => {
    // Enable manual mileage mode
    const manualToggle = page.locator('#manual-mileage');
    await manualToggle.click();

    // Set values
    await page.fill('#headcount', '50');
    await page.fill('#foodCost', '700');
    await page.fill('#mileage', '8');

    // Enable bridge crossing
    const bridgeSwitch = page.locator('#bridge');
    await bridgeSwitch.click();

    // Wait for calculation
    await page.waitForTimeout(500);

    // Each result card is heading (h3) → CardHeader → Card; scope to the card.
    const cardFor = (title: string) =>
      page.getByRole('heading', { name: title }).locator('xpath=../..');

    // Bridge toll should appear in customer section
    await expect(cardFor('Customer Charges').getByText('Bridge Toll:')).toBeVisible();

    // Bridge toll should also appear in driver section
    await expect(cardFor('Driver Earnings').getByText('Bridge Toll:')).toBeVisible();
  });

  test('11. No console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];

    // Load in a fresh tab with the listener attached first. Re-navigating the
    // beforeEach tab aborts its in-flight Supabase getUser call, which logs a
    // "Failed to fetch" that has nothing to do with this page.
    const freshPage = await page.context().newPage();
    freshPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await freshPage.goto('/admin/calculator/demo');
    await expect(
      freshPage.getByRole('heading', { name: 'Delivery Cost Calculator' })
    ).toBeVisible({ timeout: 15000 });
    await freshPage.waitForTimeout(1000);
    await freshPage.close();

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(error => {
      const ignoredPatterns = [
        'ResizeObserver loop',
        'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT',
        'Download the React DevTools',
        'Failed to fetch orders',
        'Dashboard data fetch error',
        'TypeError: Failed to fetch',
        'supabase.co',
        'GoTrueClient',
      ];
      return !ignoredPatterns.some(pattern => error.includes(pattern));
    });

    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Admin Demo Calculator - Access Control', () => {
  test('Should redirect unauthenticated users to sign-in', async ({ page }) => {
    // Try to access admin demo calculator without logging in
    await page.goto('/admin/calculator/demo');

    // Should redirect to sign-in
    await page.waitForURL(/\/sign-in/, { timeout: 15000 });
    await expect(page.url()).toContain('/sign-in');
  });
});
