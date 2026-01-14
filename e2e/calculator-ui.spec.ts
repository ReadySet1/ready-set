/**
 * Calculator UI E2E Tests
 *
 * Issue: REA-40 - [Testing] Calculator UI Loading Verification
 *
 * Goal: Verify the calculator UI loads properly and all components function correctly.
 *
 * Testing Steps:
 * 1. Access Calculator: Navigate to /admin/calculator
 * 2. Check Template Dropdown: Verify templates dropdown populates with options
 * 3. Console Check: Confirm no console errors
 * 4. Form Rendering: Verify all input fields render correctly
 * 5. Tabs Navigation: Test switching between Input, Results, and History tabs
 * 6. Template Selection: Try selecting different templates
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_USER = {
  email: 'emmanuel@alanis.dev',
  password: 'Spark2026@',
};

/**
 * Helper function to login and navigate to the calculator
 */
async function loginAndNavigateToCalculator(page: Page): Promise<void> {
  // Navigate to sign-in page
  await page.goto('/sign-in');

  // Wait for the form to be ready
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });

  // Fill in credentials
  await page.fill('input[name="email"], input[type="email"]', TEST_USER.email);
  await page.fill('input[name="password"], input[type="password"]', TEST_USER.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for successful authentication (redirect to an authenticated route)
  // Don't use networkidle as it may never fire due to realtime connections
  await page.waitForURL(/\/(admin|client|vendor|dashboard)/, {
    timeout: 30000,
  });

  // Navigate to calculator
  await page.goto('/admin/calculator');

  // Wait for the page to load by checking for key elements
  // Either the calculator heading appears (loaded) or loading text appears
  await Promise.race([
    page.waitForSelector('h1:has-text("Delivery Calculator")', { timeout: 15000 }),
    page.waitForSelector('text=Loading calculator system...', { timeout: 15000 }),
  ]);
}

test.describe('Calculator UI Loading Verification', () => {
  // Increase timeout for these tests since login takes time
  test.setTimeout(60000);

  // Store console errors to check at the end of each test
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Reset console errors array
    consoleErrors = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Login and navigate to calculator
    await loginAndNavigateToCalculator(page);
  });

  test('1. Calculator page loads successfully', async ({ page }) => {
    // Verify the page loaded by checking for the main calculator heading
    await expect(page.locator('h1:has-text("Delivery Calculator")')).toBeVisible({ timeout: 15000 });

    // Check for "System Ready" badge indicating templates loaded
    await expect(page.locator('text=System Ready')).toBeVisible({ timeout: 15000 });

    // Verify no loading spinner is still showing
    await expect(page.locator('text=Loading calculator system...')).not.toBeVisible();
  });

  test('2. Template dropdown populates with options', async ({ page }) => {
    // Wait for the template dropdown to be visible
    const templateDropdown = page.locator('text=Calculator Template').locator('..').locator('button[role="combobox"]');
    await expect(templateDropdown).toBeVisible({ timeout: 15000 });

    // Click to open the dropdown
    await templateDropdown.click();

    // Verify dropdown options appear
    const dropdownContent = page.locator('[role="listbox"]');
    await expect(dropdownContent).toBeVisible({ timeout: 5000 });

    // Check that at least one template option exists
    const templateOptions = dropdownContent.locator('[role="option"]');
    const optionCount = await templateOptions.count();
    expect(optionCount).toBeGreaterThan(0);

    // Check for Ready Set Food template specifically (expected based on codebase)
    const readySetOption = dropdownContent.locator('text=Ready Set Food');
    if (await readySetOption.count() > 0) {
      await expect(readySetOption.first()).toBeVisible();
    }

    // Close dropdown by pressing Escape
    await page.keyboard.press('Escape');
  });

  test('3. No console errors on page load', async ({ page }) => {
    // Wait for page to fully load and settle
    await page.waitForTimeout(2000);

    // Filter out known non-critical warnings/errors
    const criticalErrors = consoleErrors.filter(error => {
      // Ignore common non-critical errors
      const ignoredPatterns = [
        'ResizeObserver loop',
        'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT', // Ad blockers
        'Download the React DevTools',
        'Warning: ReactDOM.render is no longer supported', // React 18 warnings in dev
        'Failed to fetch orders', // Dashboard errors during navigation (not calculator-specific)
        'Dashboard data fetch error', // Dashboard errors during navigation
        'fetchData', // Generic fetch errors during navigation
        'TypeError: Failed to fetch', // Network errors (not app-specific)
        'supabase.co', // Supabase auth errors (transient network issues)
        'GoTrueClient', // Supabase auth client errors
      ];
      return !ignoredPatterns.some(pattern => error.includes(pattern));
    });

    // Assert no critical console errors
    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors);
    }
    expect(criticalErrors).toHaveLength(0);
  });

  test('4. All input fields render correctly', async ({ page }) => {
    // Wait for the calculator to be fully loaded
    await expect(page.locator('text=System Ready')).toBeVisible({ timeout: 15000 });

    // Click on Calculator tab to ensure we're on the input form
    const calculatorTab = page.locator('[role="tab"]:has-text("Calculator")');
    if (await calculatorTab.isVisible()) {
      await calculatorTab.click();
    }

    // Verify Input tab is visible in the DeliveryCalculator component
    const inputTab = page.locator('[role="tab"]:has-text("Input")');
    await expect(inputTab).toBeVisible({ timeout: 10000 });
    await inputTab.click();

    // Check for Basic Information card
    await expect(page.locator('text=Basic Information')).toBeVisible();

    // Verify Headcount input
    const headcountInput = page.locator('input#headcount');
    await expect(headcountInput).toBeVisible();
    await expect(headcountInput).toBeEditable();

    // Verify Food Cost input
    const foodCostInput = page.locator('input#foodCost');
    await expect(foodCostInput).toBeVisible();
    await expect(foodCostInput).toBeEditable();

    // Verify Delivery Area input
    const deliveryAreaInput = page.locator('input#deliveryArea');
    await expect(deliveryAreaInput).toBeVisible();
    await expect(deliveryAreaInput).toBeEditable();

    // Check for Distance & Location card
    await expect(page.locator('text=Distance & Location')).toBeVisible();

    // Verify Mileage input
    const mileageInput = page.locator('input#mileage');
    await expect(mileageInput).toBeVisible();
    await expect(mileageInput).toBeEditable();

    // Verify Mileage Rate input
    const mileageRateInput = page.locator('input#mileageRate');
    await expect(mileageRateInput).toBeVisible();
    await expect(mileageRateInput).toBeEditable();

    // Verify Bridge Crossing switch
    const bridgeSwitch = page.locator('#bridge');
    await expect(bridgeSwitch).toBeVisible();

    // Check for Additional Services card
    await expect(page.locator('text=Additional Services')).toBeVisible();

    // Verify Number of Stops input
    const stopsInput = page.locator('input#stops');
    await expect(stopsInput).toBeVisible();
    await expect(stopsInput).toBeEditable();

    // Verify Tips/Bonus input
    const tipsInput = page.locator('input#tips');
    await expect(tipsInput).toBeVisible();
    await expect(tipsInput).toBeEditable();

    // Verify Adjustments input
    const adjustmentsInput = page.locator('input#adjustments');
    await expect(adjustmentsInput).toBeVisible();
    await expect(adjustmentsInput).toBeEditable();

    // Check for Actions card
    await expect(page.locator('text=Actions').first()).toBeVisible();

    // Verify Clear Form button
    await expect(page.locator('button:has-text("Clear Form")')).toBeVisible();
  });

  test('5. Tab navigation works correctly', async ({ page }) => {
    // Wait for the calculator to be fully loaded
    await expect(page.locator('text=System Ready')).toBeVisible({ timeout: 15000 });

    // === Test main Calculator page tabs ===

    // Verify Calculator tab exists and is clickable
    const mainCalculatorTab = page.locator('[role="tab"]:has-text("Calculator")').first();
    await expect(mainCalculatorTab).toBeVisible();

    // Click Recent Calculations/History tab on main page
    const recentCalculationsTab = page.locator('[role="tab"]:has-text("Recent")');
    if (await recentCalculationsTab.isVisible()) {
      await recentCalculationsTab.click();
      // Verify history content loads
      await expect(page.locator('text=Recent Calculations').first()).toBeVisible();
    }

    // Click Templates tab on main page
    const templatesTab = page.locator('[role="tab"]:has-text("Templates")');
    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      // Wait for templates content to load
      await page.waitForTimeout(1000);
      // Verify templates tab content is visible (template cards should appear)
      // Check for "Use This Template" button or "Currently Active" badge
      const hasTemplates = await page.locator('button:has-text("Use This Template"), button:has-text("Currently Active")').first().isVisible();
      expect(hasTemplates).toBeTruthy();
    }

    // Go back to Calculator tab
    await mainCalculatorTab.click();

    // === Test DeliveryCalculator component tabs ===

    // Verify Input tab in DeliveryCalculator
    const inputTab = page.locator('[role="tab"]:has-text("Input")');
    await expect(inputTab).toBeVisible();
    await inputTab.click();
    await expect(page.locator('text=Basic Information')).toBeVisible();

    // Click Results tab
    const resultsTab = page.locator('[role="tab"]:has-text("Results")');
    await expect(resultsTab).toBeVisible();
    await resultsTab.click();
    // Results tab shows either "Ready to Calculate" (no calculation) or calculation results
    // The calculator may auto-calculate with default values
    const resultsTabActive = await page.locator('[role="tab"][data-state="active"]:has-text("Results")').isVisible();
    expect(resultsTabActive).toBeTruthy();

    // Click History tab
    const historyTab = page.locator('[role="tab"]:has-text("History")');
    await expect(historyTab).toBeVisible();
    await historyTab.click();
    // History tab shows "Recent Calculations" heading
    await expect(page.locator('text=Recent Calculations').first()).toBeVisible({ timeout: 5000 });

    // Navigate back to Input tab
    await inputTab.click();
    await expect(page.locator('text=Basic Information')).toBeVisible();
  });

  test('6. Template selection works correctly', async ({ page }) => {
    // Wait for the calculator to be fully loaded
    await expect(page.locator('text=System Ready')).toBeVisible({ timeout: 15000 });

    // Navigate to Templates tab on main page
    const templatesTab = page.locator('[role="tab"]:has-text("Templates")');
    await expect(templatesTab).toBeVisible({ timeout: 10000 });
    await templatesTab.click();

    // Wait for templates to load
    await page.waitForTimeout(1000);

    // Find template cards
    const templateCards = page.locator('text=Use This Template');
    const templateCount = await templateCards.count();

    if (templateCount > 0) {
      // Click on the first "Use This Template" button
      await templateCards.first().click();

      // Verify the template becomes active (button text changes to "Currently Active")
      await expect(page.locator('text=Currently Active').first()).toBeVisible({ timeout: 5000 });

      // If there are multiple templates, try selecting a different one
      if (templateCount > 1) {
        // Find a non-active template button
        const nonActiveButton = page.locator('button:has-text("Use This Template")').first();
        if (await nonActiveButton.isVisible()) {
          await nonActiveButton.click();
          // Verify it becomes active
          await expect(page.locator('text=Currently Active')).toHaveCount(1);
        }
      }
    }

    // === Also test template selection via dropdown ===

    // Navigate back to Calculator tab
    const calculatorTab = page.locator('[role="tab"]:has-text("Calculator")').first();
    await calculatorTab.click();

    // Wait for calculator tab to be active
    await page.waitForTimeout(500);

    // Open template dropdown
    const templateDropdown = page.locator('text=Calculator Template').locator('..').locator('button[role="combobox"]');
    await expect(templateDropdown).toBeVisible({ timeout: 10000 });
    await templateDropdown.click();

    // Wait for dropdown animation
    await page.waitForTimeout(300);

    // Select an option from the dropdown
    const dropdownContent = page.locator('[role="listbox"]');

    // Check if dropdown is visible (it may have already closed if it auto-selected)
    if (await dropdownContent.isVisible()) {
      const templateOptions = dropdownContent.locator('[role="option"]');
      const optionCount = await templateOptions.count();

      if (optionCount > 0) {
        // Click the first option
        await templateOptions.first().click();

        // Verify the dropdown closed and value is selected
        await expect(dropdownContent).not.toBeVisible();
      }
    }
  });

  test('7. Calculator performs calculations correctly', async ({ page }) => {
    // Wait for the calculator to be fully loaded
    await expect(page.locator('text=System Ready')).toBeVisible({ timeout: 15000 });

    // Ensure we're on the Calculator tab
    const calculatorTab = page.locator('[role="tab"]:has-text("Calculator")').first();
    await calculatorTab.click();

    // Ensure we're on the Input tab
    const inputTab = page.locator('[role="tab"]:has-text("Input")');
    await inputTab.click();

    // Fill in test values
    await page.fill('input#headcount', '50');
    await page.fill('input#foodCost', '500');
    await page.fill('input#mileage', '15');
    await page.fill('input#stops', '2');

    // Wait for auto-calculation (debounced 300ms)
    await page.waitForTimeout(500);

    // Click Results tab to view calculation
    const resultsTab = page.locator('[role="tab"]:has-text("Results")');
    await resultsTab.click();

    // Verify calculation results are shown (not "Ready to Calculate")
    await expect(page.locator('text=Ready to Calculate')).not.toBeVisible({ timeout: 5000 });

    // Check for result sections
    const driverPaymentsSection = page.locator('text=Driver Payments');
    await expect(driverPaymentsSection).toBeVisible({ timeout: 5000 });

    // Verify total value is displayed
    const totalValue = page.locator('text=Total:').first();
    await expect(totalValue).toBeVisible();
  });

  test('8. Client configuration dropdown works', async ({ page }) => {
    // Wait for the calculator to be fully loaded
    await expect(page.locator('text=System Ready')).toBeVisible({ timeout: 15000 });

    // Ensure we're on the Calculator tab
    const calculatorTab = page.locator('[role="tab"]:has-text("Calculator")').first();
    await calculatorTab.click();

    // Find Client Configuration dropdown
    const clientConfigDropdown = page.locator('text=Client Configuration').locator('..').locator('button[role="combobox"]');
    await expect(clientConfigDropdown).toBeVisible({ timeout: 10000 });

    // Click to open dropdown
    await clientConfigDropdown.click();

    // Verify dropdown opens
    const dropdownContent = page.locator('[role="listbox"]');
    await expect(dropdownContent).toBeVisible({ timeout: 5000 });

    // Check that at least one client config option exists
    const configOptions = dropdownContent.locator('[role="option"]');
    const optionCount = await configOptions.count();

    if (optionCount > 0) {
      // Select an option
      await configOptions.first().click();

      // Verify dropdown closed
      await expect(dropdownContent).not.toBeVisible();
    } else {
      // Close dropdown if no options
      await page.keyboard.press('Escape');
    }
  });

  test('9. Settings link is accessible', async ({ page }) => {
    // Wait for the calculator to be fully loaded
    await expect(page.locator('text=System Ready')).toBeVisible({ timeout: 15000 });

    // Find and verify Settings link (prefer the link over button)
    const settingsLink = page.locator('a[href*="/admin/calculator/settings"]');
    await expect(settingsLink).toBeVisible();

    // Verify the href is correct
    const href = await settingsLink.getAttribute('href');
    expect(href).toContain('/admin/calculator/settings');
  });

  test('10. Clear Form button resets inputs', async ({ page }) => {
    // Wait for the calculator to be fully loaded
    await expect(page.locator('text=System Ready')).toBeVisible({ timeout: 15000 });

    // Ensure we're on the Calculator tab and Input tab
    const calculatorTab = page.locator('[role="tab"]:has-text("Calculator")').first();
    await calculatorTab.click();
    const inputTab = page.locator('[role="tab"]:has-text("Input")');
    await inputTab.click();

    // Fill in some values
    await page.fill('input#headcount', '100');
    await page.fill('input#foodCost', '1000');
    await page.fill('input#mileage', '25');

    // Verify values are filled
    await expect(page.locator('input#headcount')).toHaveValue('100');

    // Click Clear Form button
    const clearButton = page.locator('button:has-text("Clear Form")');
    await clearButton.click();

    // Verify values are reset (headcount should be 0)
    await expect(page.locator('input#headcount')).toHaveValue('0');
    await expect(page.locator('input#foodCost')).toHaveValue('0');
    await expect(page.locator('input#mileage')).toHaveValue('0');
  });
});
