/**
 * Public Demo Calculator E2E Tests
 *
 * Tests for the public-facing demo calculator at /demo/calculator
 *
 * This calculator:
 * - Does NOT require authentication
 * - Does NOT show driver earnings (hidden from vendors/clients)
 * - Uses flat fee pricing (Ready Set Food Standard)
 * - Supports multi-stop deliveries
 */

import { test, expect } from '@playwright/test';

test.describe('Public Demo Calculator', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the public demo calculator (no auth required)
    await page.goto('/demo/calculator');

    // Wait for the calculator to load
    await page.waitForSelector('h1:has-text("Delivery Cost Calculator")', { timeout: 15000 });
  });

  test('1. Calculator page loads successfully without authentication', async ({ page }) => {
    // Verify the page loaded with key elements
    await expect(page.locator('h1:has-text("Delivery Cost Calculator")')).toBeVisible();
    await expect(page.locator('text=Interactive Demo')).toBeVisible();
    await expect(page.locator('text=Delivery Details')).toBeVisible();
    await expect(page.locator('text=Multi-Stop Delivery')).toBeVisible();
  });

  test('2. Should NOT show driver earnings section', async ({ page }) => {
    // Driver Earnings section should NOT be visible
    await expect(page.locator('text=Driver Earnings')).not.toBeVisible();
    await expect(page.locator('text=Total Driver Pay:')).not.toBeVisible();
    await expect(page.locator('text=Base Pay:')).not.toBeVisible();
  });

  test('3. Should show customer charges section', async ({ page }) => {
    // Customer Charges section should be visible
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

  test('5. Manual mileage toggle works', async ({ page }) => {
    // By default, should show address inputs
    await expect(page.locator('text=Pickup Address')).toBeVisible();
    await expect(page.locator('text=Delivery Address')).toBeVisible();

    // Enable manual mileage mode
    const manualToggle = page.locator('#manual-mileage');
    await manualToggle.click();

    // Should now show mileage input
    const mileageInput = page.locator('#mileage');
    await expect(mileageInput).toBeVisible();
    await expect(mileageInput).toHaveValue('15'); // Default value

    // Address inputs should be hidden
    await expect(page.locator('text=Pickup Address')).not.toBeVisible();
  });

  test('6. Multi-stop controls work correctly', async ({ page }) => {
    const stopsInput = page.locator('#stops');
    await expect(stopsInput).toHaveValue('1');

    // Click increment button
    const incrementButton = page.locator('button:has-text("+")');
    await incrementButton.click();
    await expect(stopsInput).toHaveValue('2');

    // Should show extra stops info (without driver bonus)
    await expect(page.locator('text=1 Extra Stop')).toBeVisible();
    await expect(page.locator('text=Customer charge:')).toBeVisible();
    // Driver bonus should NOT be visible
    await expect(page.locator('text=Driver bonus:')).not.toBeVisible();

    // Click decrement button
    const decrementButton = page.locator('button:has-text("-")');
    await decrementButton.click();
    await expect(stopsInput).toHaveValue('1');
  });

  test('7. Bridge crossing toggle affects calculation', async ({ page }) => {
    // Enable manual mileage mode first
    const manualToggle = page.locator('#manual-mileage');
    await manualToggle.click();

    // Get initial total
    const totalBefore = await page.locator('text=Total Delivery Fee:').locator('..').textContent();

    // Enable bridge crossing
    const bridgeSwitch = page.locator('#bridge');
    await bridgeSwitch.click();

    // Wait for calculation to update
    await page.waitForTimeout(500);

    // Check that Bridge Toll appears in results
    await expect(page.locator('text=Bridge Toll:')).toBeVisible();

    // Total should have changed
    const totalAfter = await page.locator('text=Total Delivery Fee:').locator('..').textContent();
    expect(totalAfter).not.toBe(totalBefore);
  });

  test('8. Pricing explanation shows only 2 columns (no driver bonus)', async ({ page }) => {
    // Should show First Stop and Additional Stops
    await expect(page.locator('text=How Multi-Stop Pricing Works')).toBeVisible();
    await expect(page.locator('div:has-text("First Stop")').filter({ has: page.locator('text=Included in the base delivery fee') })).toBeVisible();
    await expect(page.locator('div:has-text("Additional Stops")').filter({ has: page.locator('text=$5.00 per extra stop') })).toBeVisible();

    // Driver Bonus section should NOT exist
    await expect(page.locator('div:has-text("Driver Bonus")').filter({ has: page.locator('text=$2.50 bonus') })).not.toBeVisible();
  });

  test('9. CTA buttons are present and have correct links', async ({ page }) => {
    // Sign Up button
    const signUpLink = page.locator('a:has-text("Sign Up Free")');
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toHaveAttribute('href', '/sign-up');

    // Contact Sales button
    const contactLink = page.locator('a:has-text("Contact Sales")');
    await expect(contactLink).toBeVisible();
    await expect(contactLink).toHaveAttribute('href', '/contact');
  });

  test('10. Flat fee pricing calculation is correct', async ({ page }) => {
    // Enable manual mileage mode
    const manualToggle = page.locator('#manual-mileage');
    await manualToggle.click();

    // Set tier 2 values: headcount 30, food cost $400, 8 miles
    await page.fill('#headcount', '30');
    await page.fill('#foodCost', '400');
    await page.fill('#mileage', '8');

    // Wait for calculation
    await page.waitForTimeout(500);

    // Tier 2 flat fee should be $70 (within 10 miles)
    const baseFee = page.locator('text=Base Delivery Fee:').locator('..').locator('span').last();
    await expect(baseFee).toContainText('$70.00');
  });

  test('11. Mileage charge applies only beyond 10 miles', async ({ page }) => {
    // Enable manual mileage mode
    const manualToggle = page.locator('#manual-mileage');
    await manualToggle.click();

    // Set tier 3 values: headcount 50, food cost $700, 15 miles
    await page.fill('#headcount', '50');
    await page.fill('#foodCost', '700');
    await page.fill('#mileage', '15');

    // Wait for calculation
    await page.waitForTimeout(500);

    // Base fee should be $90 (tier 3)
    const baseFee = page.locator('text=Base Delivery Fee:').locator('..').locator('span').last();
    await expect(baseFee).toContainText('$90.00');

    // Mileage charge should appear (5 miles beyond 10 = $15)
    const mileageCharge = page.locator('text=Mileage').locator('..').locator('span').last();
    await expect(mileageCharge).toContainText('$15.00');

    // Total should be $105
    const totalFee = page.locator('text=Total Delivery Fee:').locator('..').locator('span').last();
    await expect(totalFee).toContainText('$105.00');
  });

  test('12. Extra stops charge is calculated correctly', async ({ page }) => {
    // Enable manual mileage mode
    const manualToggle = page.locator('#manual-mileage');
    await manualToggle.click();

    // Set values
    await page.fill('#headcount', '50');
    await page.fill('#foodCost', '700');
    await page.fill('#mileage', '8');

    // Add 2 extra stops (total 3 stops)
    const incrementButton = page.locator('button:has-text("+")');
    await incrementButton.click();
    await incrementButton.click();

    // Wait for calculation
    await page.waitForTimeout(500);

    // Should show extra stops in results (2 extra stops = $10)
    await expect(page.locator('text=Extra Stops (2):')).toBeVisible();
    const extraStopsCharge = page.locator('text=Extra Stops (2):').locator('..').locator('span').last();
    await expect(extraStopsCharge).toContainText('$10.00');
  });

  test('13. Form accepts address input for distance calculation', async ({ page }) => {
    // By default, address mode is active
    await expect(page.locator('text=Pickup Address')).toBeVisible();
    await expect(page.locator('text=Delivery Address')).toBeVisible();

    // Should have Check buttons
    const checkButtons = page.locator('button:has-text("Check")');
    await expect(checkButtons).toHaveCount(2);

    // Should show helper text
    await expect(page.locator('text=Enter both addresses and click "Check" to auto-calculate distance')).toBeVisible();
  });

  test('14. No console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate again to capture errors
    await page.goto('/demo/calculator');
    await page.waitForSelector('h1:has-text("Delivery Cost Calculator")');
    await page.waitForTimeout(1000);

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(error => {
      const ignoredPatterns = [
        'ResizeObserver loop',
        'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT',
        'Download the React DevTools',
      ];
      return !ignoredPatterns.some(pattern => error.includes(pattern));
    });

    expect(criticalErrors).toHaveLength(0);
  });
});
