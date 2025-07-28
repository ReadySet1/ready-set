import { test, expect } from '@playwright/test';

test.describe('Order Status Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the client dashboard
    await page.goto('http://localhost:3000/client');
    
    // Wait for the page to load
    await page.waitForSelector('text=Welcome back');
  });

  test('complete order status workflow from dashboard to order details', async ({ page }) => {
    // 1. Verify dashboard loads with orders
    await expect(page.locator('text=Recent Orders')).toBeVisible();
    await expect(page.locator('text=View All')).toBeVisible();
    
    // Check if there are order cards
    const orderCards = page.locator('[data-testid="order-card"]').or(page.locator('text=View Details').first());
    await expect(orderCards.first()).toBeVisible();

    // 2. Click "View All" to go to order status page
    await page.click('text=View All');
    await page.waitForURL('**/order-status');
    
    // Verify order status page loads
    await expect(page.locator('text=Your Orders')).toBeVisible();
    await expect(page.locator('text=View and manage your orders.')).toBeVisible();
    
    // Check pagination is displayed
    await expect(page.locator('text=Page 1 of')).toBeVisible();
    await expect(page.locator('text=total orders')).toBeVisible();

    // 3. Click "View Details" on an order to go to order details
    const viewDetailsLink = page.locator('text=View Details').first();
    await expect(viewDetailsLink).toBeVisible();
    
    // Get the href to verify it points to the correct order status page
    const href = await viewDetailsLink.getAttribute('href');
    expect(href).toMatch(/^\/order-status\/SF-/);
    
    // Click the link
    await viewDetailsLink.click();
    await page.waitForURL('**/order-status/**');

    // 4. Verify order details page loads correctly
    await expect(page.locator('text=Order Details')).toBeVisible();
    await expect(page.locator('text=Back to Orders')).toBeVisible();
    
    // Check that order information is displayed (not N/A values)
    const orderNumber = page.locator('text=Order #').first();
    await expect(orderNumber).toBeVisible();
    
    // Verify it's not showing "N/A"
    const orderNumberText = await orderNumber.textContent();
    expect(orderNumberText).not.toContain('N/A');
    
    // Check for order type badge
    await expect(page.locator('text=Catering').or(page.locator('text=On Demand'))).toBeVisible();
    
    // Check for status badge
    await expect(page.locator('text=active').or(page.locator('text=completed'))).toBeVisible();
    
    // Check for total amount (should not be NaN)
    const totalElement = page.locator('text=$').first();
    await expect(totalElement).toBeVisible();
    const totalText = await totalElement.textContent();
    expect(totalText).not.toContain('NaN');

    // 5. Test navigation back to orders
    await page.click('text=Back to Orders');
    await page.waitForURL('**/order-status');
    
    // Verify we're back on the order status page
    await expect(page.locator('text=Your Orders')).toBeVisible();
  });

  test('pagination works correctly', async ({ page }) => {
    // Go to order status page
    await page.goto('http://localhost:3000/order-status');
    await page.waitForSelector('text=Your Orders');

    // Check pagination controls
    const prevButton = page.locator('button:has-text("Previous")');
    const nextButton = page.locator('button:has-text("Next")');
    
    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();

    // Check pagination info
    const paginationInfo = page.locator('text=Page 1 of');
    await expect(paginationInfo).toBeVisible();

    // Test pagination if there are multiple pages
    const paginationText = await paginationInfo.textContent();
    if (paginationText && paginationText.includes('of') && !paginationText.includes('of 1')) {
      // There are multiple pages, test next button
      await nextButton.click();
      await page.waitForTimeout(1000); // Wait for data to load
      
      // Should now be on page 2
      await expect(page.locator('text=Page 2 of')).toBeVisible();
      
      // Previous button should now be enabled
      await expect(prevButton).toBeEnabled();
      
      // Go back to page 1
      await prevButton.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('text=Page 1 of')).toBeVisible();
    } else {
      // Only one page, buttons should be disabled appropriately
      await expect(prevButton).toBeDisabled();
    }
  });

  test('order details displays correct information', async ({ page }) => {
    // Go directly to an order details page
    await page.goto('http://localhost:3000/order-status/SF-12360');
    await page.waitForSelector('text=Order Details');

    // Verify all sections are present
    await expect(page.locator('text=Pickup Location')).toBeVisible();
    await expect(page.locator('text=Delivery Location')).toBeVisible();
    await expect(page.locator('text=Total')).toBeVisible();
    await expect(page.locator('text=Order Date')).toBeVisible();
    await expect(page.locator('text=Order Time')).toBeVisible();
    await expect(page.locator('text=Special Notes')).toBeVisible();

    // Check that addresses are displayed (not N/A)
    const pickupAddress = page.locator('text=Pickup Location').locator('..').locator('text=,');
    await expect(pickupAddress.first()).toBeVisible();
    
    const deliveryAddress = page.locator('text=Delivery Location').locator('..').locator('text=,');
    await expect(deliveryAddress.first()).toBeVisible();

    // Check for driver details section
    await expect(page.locator('text=Driver Details')).toBeVisible();
  });

  test('handles invalid order gracefully', async ({ page }) => {
    // Try to access a non-existent order
    await page.goto('http://localhost:3000/order-status/INVALID-ORDER');
    
    // Should show an error message
    await expect(page.locator('text=Order not found').or(page.locator('text=Sorry, order not found'))).toBeVisible();
  });

  test('dashboard navigation links work correctly', async ({ page }) => {
    // Verify "View All" link on dashboard
    await expect(page.locator('text=View All')).toBeVisible();
    const viewAllLink = page.locator('text=View All');
    const viewAllHref = await viewAllLink.getAttribute('href');
    expect(viewAllHref).toBe('/order-status');

    // Verify "View Details" links on dashboard
    const viewDetailsLinks = page.locator('text=View Details');
    await expect(viewDetailsLinks.first()).toBeVisible();
    
    // Check that View Details links point to order status pages
    const viewDetailsHref = await viewDetailsLinks.first().getAttribute('href');
    expect(viewDetailsHref).toMatch(/^\/order-status\/SF-/);
  });

  test('responsive design works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test dashboard on mobile
    await page.goto('http://localhost:3000/client');
    await expect(page.locator('text=Recent Orders')).toBeVisible();
    
    // Test order status page on mobile
    await page.goto('http://localhost:3000/order-status');
    await expect(page.locator('text=Your Orders')).toBeVisible();
    
    // Test order details page on mobile
    await page.goto('http://localhost:3000/order-status/SF-12360');
    await expect(page.locator('text=Order Details')).toBeVisible();
  });

  test('loading states are displayed', async ({ page }) => {
    // Navigate to order status page
    await page.goto('http://localhost:3000/order-status');
    
    // Should show loading state briefly
    await expect(page.locator('text=Loading...').or(page.locator('[data-testid="loading"]'))).toBeVisible({ timeout: 1000 });
    
    // Then should show content
    await expect(page.locator('text=Your Orders')).toBeVisible({ timeout: 5000 });
  });
}); 