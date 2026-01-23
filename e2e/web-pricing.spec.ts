/**
 * Web Development Pricing Tool E2E Tests
 *
 * Tests for the public-facing web pricing tool at /demo/web-pricing
 *
 * This tool:
 * - Does NOT require authentication
 * - Allows selection of 4 package tiers (2 marketing, 2 e-commerce)
 * - Supports add-on feature selection
 * - Displays real-time pricing calculations
 * - Shows discount badges for limited offers
 */

import { test, expect } from '@playwright/test';

test.describe('Web Development Pricing Tool', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the public web pricing tool (no auth required)
    await page.goto('/demo/web-pricing');

    // Wait for the page to load
    await page.waitForSelector('h1:has-text("Web Development Pricing")', {
      timeout: 15000,
    });
  });

  test('1. Page loads successfully without authentication', async ({ page }) => {
    // Verify the page loaded with key elements
    await expect(
      page.locator('h1:has-text("Web Development Pricing")')
    ).toBeVisible();
    await expect(page.locator('text=Interactive Pricing Tool')).toBeVisible();
    await expect(page.locator('text=Choose Your Package')).toBeVisible();
  });

  test('2. All four package tiers are displayed', async ({ page }) => {
    await expect(page.locator('text=Marketing Essential')).toBeVisible();
    await expect(page.locator('text=Marketing Professional')).toBeVisible();
    await expect(page.locator('text=E-commerce Starter')).toBeVisible();
    await expect(page.locator('text=E-commerce Growth')).toBeVisible();
  });

  test('3. Marketing tiers show discount badges', async ({ page }) => {
    // Check for savings badges
    await expect(page.locator('text=Save $625')).toBeVisible();
    await expect(page.locator('text=Save $1,250')).toBeVisible();
  });

  test('4. Package pricing is displayed correctly', async ({ page }) => {
    // Marketing Essential: $2,500 (was $3,125)
    await expect(page.locator('text=$2,500').first()).toBeVisible();
    await expect(page.locator('text=$3,125')).toBeVisible();

    // Marketing Professional: $5,000 (was $6,250)
    await expect(page.locator('text=$5,000').first()).toBeVisible();
    await expect(page.locator('text=$6,250')).toBeVisible();

    // E-commerce Starter: $7,500
    await expect(page.locator('text=$7,500').first()).toBeVisible();

    // E-commerce Growth: $15,000
    await expect(page.locator('text=$15,000').first()).toBeVisible();
  });

  test('5. Selecting a package updates the quote', async ({ page }) => {
    // Initially, quote should show placeholder
    await expect(
      page.locator('text=Select a package to see pricing')
    ).toBeVisible();

    // Click on Marketing Essential
    await page.click('text=Marketing Essential');

    // Quote should update
    await expect(page.locator('text=Base package')).toBeVisible();
    await expect(page.locator('text=One-time')).toBeVisible();
    await expect(page.locator('text=Monthly')).toBeVisible();
    await expect(page.locator('text=Year 1 Total')).toBeVisible();
  });

  test('6. Year 1 total calculation is correct for Marketing Essential', async ({
    page,
  }) => {
    // Click on Marketing Essential
    await page.click('text=Marketing Essential');

    // Wait for calculation
    await page.waitForTimeout(500);

    // Year 1 total: $2,500 + ($75 × 12) = $3,400
    await expect(page.locator('text=$3,400')).toBeVisible();
  });

  test('7. Year 1 total calculation is correct for E-commerce Growth', async ({
    page,
  }) => {
    // Click on E-commerce Growth
    await page.click('text=E-commerce Growth');

    // Wait for calculation
    await page.waitForTimeout(500);

    // Year 1 total: $15,000 + ($350 × 12) = $19,200
    await expect(page.locator('text=$19,200')).toBeVisible();
  });

  test('8. Add-on section appears after package selection', async ({ page }) => {
    // Initially should show placeholder
    await expect(
      page.locator('text=Select a package above to customize with add-ons')
    ).toBeVisible();

    // Select a package
    await page.click('text=Marketing Essential');

    // Add-on categories should appear
    await expect(page.locator('text=Design').first()).toBeVisible();
    await expect(page.locator('text=Development').first()).toBeVisible();
    await expect(page.locator('text=Integrations')).toBeVisible();
    await expect(page.locator('text=Hosting & Infrastructure')).toBeVisible();
    await expect(page.locator('text=Maintenance & Support')).toBeVisible();
  });

  test('9. Selecting an add-on updates the pricing', async ({ page }) => {
    // Select Marketing Essential
    await page.click('text=Marketing Essential');
    await page.waitForTimeout(300);

    // Check initial one-time cost
    await expect(page.locator('text=$2,500').first()).toBeVisible();

    // Select Custom Design Package add-on ($1,500)
    await page.click('text=Custom Design Package');
    await page.waitForTimeout(300);

    // One-time should now be $4,000
    await expect(page.locator('text=$4,000')).toBeVisible();
  });

  test('10. Add-on count updates in quote', async ({ page }) => {
    // Select Marketing Essential
    await page.click('text=Marketing Essential');
    await page.waitForTimeout(300);

    // Initially 0 add-ons
    await expect(page.locator('text=0 add-ons selected')).toBeVisible();

    // Select an add-on
    await page.click('text=Custom Design Package');
    await page.waitForTimeout(300);

    // Should show 1 add-on
    await expect(page.locator('text=1 add-on selected')).toBeVisible();
  });

  test('11. E-commerce-only add-ons are disabled for marketing tiers', async ({
    page,
  }) => {
    // Select Marketing Essential
    await page.click('text=Marketing Essential');
    await page.waitForTimeout(300);

    // ERP Integration should be disabled
    const erpCheckbox = page.locator('input[id="erp-integration"]');
    await expect(erpCheckbox).toBeDisabled();

    // Should show reason
    await expect(
      page.locator('text=Not available for this package')
    ).toBeVisible();
  });

  test('12. E-commerce-only add-ons are enabled for e-commerce tiers', async ({
    page,
  }) => {
    // Select E-commerce Starter
    await page.click('text=E-commerce Starter');
    await page.waitForTimeout(300);

    // ERP Integration should be enabled
    const erpCheckbox = page.locator('input[id="erp-integration"]');
    await expect(erpCheckbox).toBeEnabled();
  });

  test('13. Incompatible add-ons are disabled', async ({ page }) => {
    // Select Marketing Professional
    await page.click('text=Marketing Professional');
    await page.waitForTimeout(300);

    // Select Logo Design
    await page.click('text=Logo Design');
    await page.waitForTimeout(300);

    // Brand Kit should now be disabled (incompatible with Logo Design)
    const brandKitCheckbox = page.locator('input[id="brand-kit"]');
    await expect(brandKitCheckbox).toBeDisabled();

    // Should show conflict reason
    await expect(
      page.locator('text=Conflicts with "Logo Design"')
    ).toBeVisible();
  });

  test('14. Switching packages clears incompatible add-ons', async ({
    page,
  }) => {
    // Select E-commerce Starter
    await page.click('text=E-commerce Starter');
    await page.waitForTimeout(300);

    // Select Payment Gateways (e-commerce only)
    await page.click('text=Additional Payment Gateways');
    await page.waitForTimeout(300);

    // Verify it's selected
    await expect(page.locator('text=1 add-on selected')).toBeVisible();

    // Switch to Marketing Essential
    await page.click('text=Marketing Essential');
    await page.waitForTimeout(300);

    // Add-on should be cleared (incompatible)
    await expect(page.locator('text=0 add-ons selected')).toBeVisible();
  });

  test('15. CTA buttons have correct links', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact Sales")');
    await expect(contactLink).toBeVisible();
    await expect(contactLink).toHaveAttribute('href', '/contact');

    const scheduleLink = page.locator('a:has-text("Schedule a Call")');
    await expect(scheduleLink).toBeVisible();
    await expect(scheduleLink).toHaveAttribute('href', '/sign-up');
  });

  test('16. What\'s Included section is displayed', async ({ page }) => {
    await expect(
      page.locator("text=What's Included in Every Project")
    ).toBeVisible();
    await expect(page.locator('text=Development Process')).toBeVisible();
    await expect(page.locator('text=Training & Handoff')).toBeVisible();
    await expect(page.locator('text=Post-Launch Support')).toBeVisible();
  });

  test('17. Page specs show correctly', async ({ page }) => {
    // Marketing Essential shows 5 pages
    await expect(page.locator('text=5').first()).toBeVisible();

    // E-commerce Starter shows 50 products
    await expect(page.locator('text=50').first()).toBeVisible();
  });

  test('18. Popular badges are displayed', async ({ page }) => {
    // Marketing Professional and E-commerce Growth should have Most Popular badges
    const popularBadges = page.locator('text=Most Popular');
    await expect(popularBadges.first()).toBeVisible();
  });

  test('19. Multiple add-ons can be selected', async ({ page }) => {
    // Select Marketing Professional
    await page.click('text=Marketing Professional');
    await page.waitForTimeout(300);

    // Select multiple add-ons
    await page.click('text=Custom Design Package'); // $1,500
    await page.waitForTimeout(200);
    await page.click('text=Member Portal'); // $2,500 + $50/mo
    await page.waitForTimeout(200);
    await page.click('text=Priority Support'); // $150/mo
    await page.waitForTimeout(300);

    // Should show 3 add-ons
    await expect(page.locator('text=3 add-ons selected')).toBeVisible();

    // Calculate expected totals
    // One-time: $5,000 + $1,500 + $2,500 = $9,000
    // Monthly: $125 + $50 + $150 = $325
    // Year 1: $9,000 + ($325 × 12) = $12,900
    await expect(page.locator('text=$12,900')).toBeVisible();
  });

  test('20. Deselecting add-on removes it from calculation', async ({
    page,
  }) => {
    // Select Marketing Essential
    await page.click('text=Marketing Essential');
    await page.waitForTimeout(300);

    // Select Custom Design Package
    await page.click('text=Custom Design Package');
    await page.waitForTimeout(300);

    // Verify it's added
    await expect(page.locator('text=1 add-on selected')).toBeVisible();

    // Deselect it
    await page.click('text=Custom Design Package');
    await page.waitForTimeout(300);

    // Should be back to 0
    await expect(page.locator('text=0 add-ons selected')).toBeVisible();

    // Price should be back to base
    await expect(page.locator('text=$3,400')).toBeVisible(); // Year 1 total
  });

  test('21. Quote card is sticky and visible on scroll', async ({ page }) => {
    // Select a package
    await page.click('text=Marketing Essential');
    await page.waitForTimeout(300);

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);

    // Quote card should still be visible
    await expect(page.locator('text=Your Quote')).toBeVisible();
    await expect(page.locator('text=Year 1 Total')).toBeVisible();
  });

  test('22. No console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate again to capture errors
    await page.goto('/demo/web-pricing');
    await page.waitForSelector('h1:has-text("Web Development Pricing")');
    await page.waitForTimeout(1000);

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter((error) => {
      const ignoredPatterns = [
        'ResizeObserver loop',
        'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT',
        'Download the React DevTools',
      ];
      return !ignoredPatterns.some((pattern) => error.includes(pattern));
    });

    expect(criticalErrors).toHaveLength(0);
  });

  test('23. Page is responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Reload page
    await page.goto('/demo/web-pricing');
    await page.waitForSelector('h1:has-text("Web Development Pricing")');

    // Key elements should still be visible
    await expect(page.locator('text=Choose Your Package')).toBeVisible();
    await expect(page.locator('text=Marketing Essential')).toBeVisible();
    await expect(page.locator('text=Your Quote')).toBeVisible();
  });

  test('24. Add-on with monthly-only pricing displays correctly', async ({
    page,
  }) => {
    // Select Marketing Essential
    await page.click('text=Marketing Essential');
    await page.waitForTimeout(300);

    // Premium Hosting is monthly-only ($75/mo)
    await expect(page.locator('text=Premium Hosting')).toBeVisible();
    await expect(page.locator('text=$75/mo').first()).toBeVisible();
  });
});
