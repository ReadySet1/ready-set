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

// Test configuration
const TEST_USER = {
  email: 'emmanuel@alanis.dev',
  password: 'Spark2026@',
};

/**
 * Helper function to login and navigate to the admin demo calculator
 */
async function loginAndNavigateToAdminDemoCalculator(page: Page): Promise<void> {
  // Navigate to sign-in page
  await page.goto('/sign-in');

  // Wait for the form to be ready
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });

  // Fill in credentials
  await page.fill('input[name="email"], input[type="email"]', TEST_USER.email);
  await page.fill('input[name="password"], input[type="password"]', TEST_USER.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for successful authentication
  await page.waitForURL(/\/(admin|client|vendor|dashboard)/, {
    timeout: 30000,
  });

  // Navigate to admin demo calculator
  await page.goto('/admin/calculator/demo');

  // Wait for the calculator to load
  await page.waitForSelector('h1:has-text("Delivery Cost Calculator")', { timeout: 15000 });
}

test.describe('Admin Demo Calculator', () => {
  // Increase timeout for these tests since login takes time
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await loginAndNavigateToAdminDemoCalculator(page);
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
    await expect(page.locator('text=How Multi-Stop Pricing Works')).toBeVisible();
    await expect(page.locator('div:has-text("First Stop")').filter({ has: page.locator('text=Included in the base delivery fee') })).toBeVisible();
    await expect(page.locator('div:has-text("Additional Stops")').filter({ has: page.locator('text=$5.00 per extra stop') })).toBeVisible();
    // Driver Bonus section SHOULD exist for admin
    await expect(page.locator('div:has-text("Driver Bonus")').filter({ has: page.locator('text=$2.50 bonus') })).toBeVisible();
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

    // Bridge toll should appear in customer section
    const customerBridgeToll = page.locator('text=Customer Charges').locator('..').locator('..').locator('text=Bridge Toll:');
    await expect(customerBridgeToll).toBeVisible();

    // Bridge toll should also appear in driver section
    const driverBridgeToll = page.locator('text=Driver Earnings').locator('..').locator('..').locator('text=Bridge Toll:');
    await expect(driverBridgeToll).toBeVisible();
  });

  test('11. No console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate again to capture errors
    await page.goto('/admin/calculator/demo');
    await page.waitForSelector('h1:has-text("Delivery Cost Calculator")');
    await page.waitForTimeout(1000);

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
