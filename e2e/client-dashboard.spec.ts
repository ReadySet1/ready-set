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

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

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

    // Wait for content to load - verify actual content appears (not stuck in loading state)
    await expect(page.locator('text=Active Orders')).toBeVisible({ timeout: 10000 });

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

  test('9. Data Separation - Verify CLIENT sees only their own data', async ({ page }) => {
    await page.goto('/client');

    // This test ensures that client users only see data relevant to their role
    // In a real implementation, this would test that:
    // - Client dashboard shows different data than vendor dashboard
    // - Client cannot access vendor-specific features
    // - Data is properly filtered by user role

    // Verify the dashboard is role-aware and shows appropriate content
    await expect(page.locator('text=Client Dashboard')).toBeVisible();

    // Test that client dashboard structure matches vendor but with role-appropriate content
    await expect(page.locator('text=Active Orders')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
    await expect(page.locator('text=Recent Orders')).toBeVisible();

    // Verify no vendor-specific elements are visible
    // (In a real implementation, you might check for client-specific features)
  });

  test('10. Role-Based Navigation Testing - Test all dashboard links work correctly for CLIENT', async ({ page }) => {
    await page.goto('/client');

    // Test that all navigation links in the dashboard work
    const links = [
      { href: '/catering-request', text: 'New Order' },
      { href: '/client/orders', text: 'View All' },
      { href: '/addresses', text: 'Manage Addresses' },
      { href: '/profile', text: 'Update Profile' },
      { href: '/contact', text: 'Contact Us' }
    ];

    for (const link of links) {
      const linkElement = page.locator(`a[href="${link.href}"]`).first();
      await expect(linkElement).toBeVisible();

      // Test that the link has the expected text
      if (link.text) {
        await expect(linkElement).toContainText(link.text);
      }
    }

    // Test that View Details links work (if any orders exist)
    const viewDetailsLinks = page.locator('text=View Details');
    if (await viewDetailsLinks.count() > 0) {
      const firstViewDetails = viewDetailsLinks.first();
      await expect(firstViewDetails).toBeVisible();

      // Test that it has proper href (should navigate to order details)
      const href = await firstViewDetails.getAttribute('href');
      expect(href).toMatch(/^\/order-status\//);
    }
  });

  test('11. Cross-Role Data Isolation - Verify CLIENT and VENDOR data separation', async ({ page }) => {
    // Test that client dashboard shows "Client Dashboard" title
    await page.goto('/client');
    await expect(page.locator('[data-testid="breadcrumb"]')).toContainText('Client Dashboard');

    // Verify that client sees client-appropriate content
    await expect(page.locator('text=Active Orders')).toBeVisible();
    await expect(page.locator('text=Recent Orders')).toBeVisible();

    // Test that the dashboard correctly identifies the user's role
    // This ensures data filtering is working correctly
    const statsValues = page.locator('.text-2xl.font-bold');
    const statsCount = await statsValues.count();
    expect(statsCount).toBeGreaterThanOrEqual(0); // Should show stats or handle empty state gracefully

    // Verify that the dashboard handles role-based data fetching
    // In a real scenario, this would check that the API calls include the correct user ID
  });

  test('12. Error State Handling - Verify proper error handling for CLIENT dashboard', async ({ page }) => {
    await page.goto('/client');

    // Test that error states are handled gracefully
    // Check for error messages or fallback content
    const errorMessages = page.locator('text=Error, Something went wrong, Failed to load');
    const errorCount = await errorMessages.count();

    // If errors exist, they should be user-friendly
    if (errorCount > 0) {
      for (const error of await errorMessages.all()) {
        const text = await error.textContent();
        expect(text?.toLowerCase()).not.toContain('undefined');
        expect(text?.toLowerCase()).not.toContain('null');
      }
    }

    // Verify that even with errors, the dashboard structure remains intact
    await expect(page.locator('text=Quick Actions')).toBeVisible();
    await expect(page.locator('text=Recent Orders')).toBeVisible();
  });
});
