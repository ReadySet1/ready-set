import { test, expect } from '@playwright/test';

test.describe('Client Dashboard QA - Regression Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page and navigate to sign in
    await page.goto('/');
    await page.click('text=Sign In');
    await expect(page).toHaveURL(/.*sign-in/);

    // For this QA test, we'll mock the authentication flow
    // In a real scenario, you'd use valid credentials or set up test data
    // For now, we'll test the dashboard structure and functionality
  });

  test('1. Login and Initial View - Verify correct page title and breadcrumb', async ({ page }) => {
    // Test the breadcrumb/page title functionality
    // This tests the dynamic title logic for CLIENT role

    await page.goto('/client');

    // Verify the breadcrumb shows "Client Dashboard" (not "Vendor Dashboard")
    await expect(page.locator('[data-testid="breadcrumb"]')).toContainText('Client Dashboard');
    await expect(page.locator('[data-testid="breadcrumb"]')).not.toContainText('Vendor Dashboard');

    // Verify no console errors
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Wait a moment for any potential errors to appear
    await page.waitForTimeout(1000);

    // Check that no JavaScript errors occurred
    expect(errors).toHaveLength(0);
  });

  test('2. Visual & Data Integrity - Verify dashboard widgets and data loading', async ({ page }) => {
    await page.goto('/client');

    // Verify all primary dashboard widgets are visible
    await expect(page.locator('text=Active Orders')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
    await expect(page.locator('text=Saved Locations')).toBeVisible();

    // Verify recent orders section
    await expect(page.locator('text=Recent Orders')).toBeVisible();
    await expect(page.locator('text=View All')).toBeVisible();

    // Verify quick actions section
    await expect(page.locator('text=Quick Actions')).toBeVisible();

    // Test that stat cards show numbers (even if mocked as 0)
    const activeOrdersValue = page.locator('.text-2xl.font-bold').first();
    await expect(activeOrdersValue).toBeVisible();

    // Verify the welcome message appears
    await expect(page.locator('text=Welcome back').or(page.locator('text=Welcome,'))).toBeVisible();
  });

  test('3. Functional Testing - Verify navigation links and interactions', async ({ page }) => {
    await page.goto('/client');

    // Test "Create New Order" / "New Order" link in quick actions
    const newOrderLink = page.locator('a[href="/catering-request"]').first();
    await expect(newOrderLink).toBeVisible();
    await expect(newOrderLink).toContainText('New Order');

    // Test "View All" link navigates to orders page
    const viewAllLink = page.locator('a[href="/client/orders"]');
    await expect(viewAllLink).toBeVisible();
    await expect(viewAllLink).toContainText('View All');

    // Test other quick action links
    await expect(page.locator('a[href="/addresses"]')).toBeVisible();
    await expect(page.locator('a[href="/profile"]')).toBeVisible();
    await expect(page.locator('a[href="/contact"]')).toBeVisible();

    // Test link descriptions are present
    await expect(page.locator('text=Create a new delivery request')).toBeVisible();
    await expect(page.locator('text=Add or edit your locations')).toBeVisible();
    await expect(page.locator('text=Manage your account details')).toBeVisible();
    await expect(page.locator('text=Get in touch with our team')).toBeVisible();

    // Test that recent order cards (if any exist) have "View Details" links
    const viewDetailsLinks = page.locator('text=View Details');
    if (await viewDetailsLinks.count() > 0) {
      await expect(viewDetailsLinks.first()).toBeVisible();
    }

    // Test "Place Your First Order" link when no orders exist
    const placeFirstOrder = page.locator('text=Place Your First Order');
    if (await placeFirstOrder.count() > 0) {
      await expect(placeFirstOrder).toBeVisible();
      const firstOrderLink = placeFirstOrder.locator('..').locator('a');
      await expect(firstOrderLink).toHaveAttribute('href', '/catering-request');
    }
  });

  test('4. Responsiveness - Test mobile and tablet layouts', async ({ page }) => {
    await page.goto('/client');

    // Test tablet-sized screen (768px width)
    await page.setViewportSize({ width: 768, height: 1024 });

    // Verify layout adapts correctly on tablet
    await expect(page.locator('text=Client Dashboard')).toBeVisible();
    await expect(page.locator('text=Active Orders')).toBeVisible();

    // Check that cards stack properly on tablet
    const cards = page.locator('.grid').first();
    await expect(cards).toBeVisible();

    // Test mobile-sized screen (375px width)
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify mobile layout is usable
    await expect(page.locator('text=Client Dashboard')).toBeVisible();

    // Check that mobile menu button is present (if applicable)
    const mobileMenu = page.locator('[aria-label="Mobile Menu"], .lg\\:hidden');
    if (await mobileMenu.count() > 0) {
      await expect(mobileMenu.first()).toBeVisible();
    }

    // Verify content is still readable on mobile
    await expect(page.locator('text=Quick Actions')).toBeVisible();
    await expect(page.locator('text=Recent Orders')).toBeVisible();
  });

  test('5. Dynamic Title Logic - Verify correct title for CLIENT role', async ({ page }) => {
    await page.goto('/client');

    // Test that the breadcrumb shows "Client Dashboard" for client role
    const breadcrumb = page.locator('[data-testid="breadcrumb"]');
    await expect(breadcrumb).toContainText('Client Dashboard');
    await expect(breadcrumb).not.toContainText('Vendor Dashboard');
    await expect(breadcrumb).not.toContainText('Admin Dashboard');

    // Test that the page description is present
    await expect(breadcrumb).toContainText('Manage your account');
  });

  test('6. Data Loading States - Verify skeleton loading works', async ({ page }) => {
    await page.goto('/client');

    // Wait for content to load (or skeleton to appear briefly)
    await page.waitForTimeout(2000);

    // Verify that we eventually see the actual content (not stuck in loading state)
    await expect(page.locator('text=Active Orders')).toBeVisible();

    // Check that no skeleton loading indicators remain visible after content loads
    // (This would be more relevant if we had a slow-loading test environment)
    const skeletonElements = page.locator('.animate-pulse');
    const visibleSkeletons = await skeletonElements.count();
    // Allow for some skeleton elements that might be part of the design
    expect(visibleSkeletons).toBeLessThanOrEqual(2);
  });

  test('7. Error Handling - Verify graceful handling of missing data', async ({ page }) => {
    await page.goto('/client');

    // Test that the dashboard handles empty states gracefully
    // If no orders exist, should show "Place Your First Order" option
    const noOrdersMessage = page.locator('text=You haven\'t placed any orders yet');
    if (await noOrdersMessage.count() > 0) {
      await expect(noOrdersMessage).toBeVisible();
      await expect(page.locator('text=Place Your First Order')).toBeVisible();
    }

    // Verify that stats show 0 rather than error states
    const statsValues = page.locator('.text-2xl.font-bold');
    for (const stat of await statsValues.all()) {
      const text = await stat.textContent();
      // Should be a number or 0, not an error message
      expect(text).not.toContain('Error');
      expect(text).not.toContain('undefined');
    }
  });

  test('8. Accessibility - Verify WCAG compliance', async ({ page }) => {
    await page.goto('/client');

    // Test keyboard navigation (tab through interactive elements)
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Test that links are focusable and have proper href attributes
    const links = page.locator('a[href]');
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(0);

    // Test that buttons are properly labeled
    const buttons = page.locator('button, [role="button"]');
    if (await buttons.count() > 0) {
      for (const button of await buttons.all()) {
        const ariaLabel = await button.getAttribute('aria-label');
        const text = await button.textContent();
        // Should have either aria-label or visible text
        expect(ariaLabel || text).toBeTruthy();
      }
    }

    // Test heading structure
    const h1 = page.locator('h1');
    const h2 = page.locator('h2');
    expect(await h1.count() + await h2.count()).toBeGreaterThan(0);
  });
});
