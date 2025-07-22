import { test, expect } from '@playwright/test';

test.describe('Client Dashboard to Order Details E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up any necessary authentication or navigation
    // This assumes you have authentication set up for the client dashboard
  });

  test('should navigate from dashboard to order details and back successfully', async ({ page }) => {
    // Navigate to client dashboard
    await page.goto('/client');
    
    // Wait for the dashboard to load
    await expect(page.locator('h2')).toContainText('Welcome back');
    
    // Look for an order in the Recent Orders section
    const recentOrdersSection = page.locator('text=Recent Orders').locator('..');
    await expect(recentOrdersSection).toBeVisible();
    
    // Find the first "View Details" link
    const viewDetailsLink = page.locator('a:has-text("View Details")').first();
    
    // Verify the link exists
    await expect(viewDetailsLink).toBeVisible();
    
    // Get the href attribute to verify it's using orderNumber (not UUID)
    const href = await viewDetailsLink.getAttribute('href');
    expect(href).toMatch(/\/order-status\/[A-Z0-9-]+/); // Should match order number pattern, not UUID
    expect(href).not.toMatch(/\/order-status\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/); // Should NOT match UUID pattern
    
    // Click the View Details link
    await viewDetailsLink.click();
    
    // Wait for the order details page to load
    await expect(page.locator('h1:has-text("Order Details")')).toBeVisible();
    
    // Verify order information is displayed (not showing N/A everywhere)
    await expect(page.locator('text=Order #')).toBeVisible();
    
    // Check that actual data is displayed, not N/A values
    const orderCard = page.locator('.w-full.max-w-3xl'); // The main order card
    await expect(orderCard).toBeVisible();
    
    // Verify specific order details are showing real data
    const orderNumberElement = page.locator('text=/Order #[A-Z0-9-]+/');
    await expect(orderNumberElement).toBeVisible();
    
    // Check for address information (should not be N/A)
    await expect(page.locator('text=Pickup Location').locator('..')).not.toContainText('N/A');
    await expect(page.locator('text=Delivery Location').locator('..')).not.toContainText('N/A');
    
    // Check for order total (should not be NaN)
    await expect(page.locator('text=Total').locator('..')).not.toContainText('$NaN');
    const totalText = await page.locator('text=Total').locator('..').textContent();
    expect(totalText).toMatch(/\$\d+\.\d{2}/);
    
    // Verify the "Back to Dashboard" button exists and is positioned correctly
    const backButton = page.locator('button:has-text("Back to Dashboard")');
    await expect(backButton).toBeVisible();
    
    // Verify the button is on the left side (has appropriate classes or position)
    const buttonContainer = backButton.locator('..');
    await expect(buttonContainer).toHaveClass(/justify-start/);
    
    // Click the back button
    await backButton.click();
    
    // Verify we're back on the client dashboard
    await expect(page).toHaveURL('/client');
    await expect(page.locator('h2')).toContainText('Welcome back');
  });

  test('should handle order details with special characters in order numbers', async ({ page }) => {
    // Navigate to client dashboard
    await page.goto('/client');
    
    // Look for an order with special characters (like slashes)
    const specialOrderLink = page.locator('a[href*="/order-status/"]').first();
    
    if (await specialOrderLink.count() > 0) {
      const href = await specialOrderLink.getAttribute('href');
      
      // Click the link
      await specialOrderLink.click();
      
      // Verify the page loads correctly even with encoded URLs
      await expect(page.locator('h1:has-text("Order Details")')).toBeVisible();
      
      // Verify the URL encoding is handled properly
      expect(page.url()).toContain('/order-status/');
      
      // Verify order details load correctly
      await expect(page.locator('text=Order #')).toBeVisible();
    }
  });

  test('should display proper error handling for non-existent orders', async ({ page }) => {
    // Try to navigate to a non-existent order directly
    await page.goto('/order-status/NONEXISTENT-ORDER-123');
    
    // Should see either a 404 page or an error message
    // Wait for page to load and check for error indicators
    await page.waitForLoadState('networkidle');
    
    // Check for common error indicators
    const possibleErrorSelectors = [
      'text=Order not found',
      'text=404',
      'text=Error',
      'text=No order found',
      '[data-testid="error"]'
    ];
    
    let errorFound = false;
    for (const selector of possibleErrorSelectors) {
      if (await page.locator(selector).count() > 0) {
        errorFound = true;
        break;
      }
    }
    
    expect(errorFound).toBe(true);
  });

  test('should verify API calls use correct order number encoding', async ({ page }) => {
    // Monitor network requests
    const apiRequests: string[] = [];
    
    page.on('request', request => {
      if (request.url().includes('/api/orders/')) {
        apiRequests.push(request.url());
      }
    });
    
    // Navigate to client dashboard and click view details
    await page.goto('/client');
    
    const viewDetailsLink = page.locator('a:has-text("View Details")').first();
    if (await viewDetailsLink.count() > 0) {
      await viewDetailsLink.click();
      
      // Wait for the order details page to load
      await expect(page.locator('h1:has-text("Order Details")')).toBeVisible();
      
      // Verify API was called with encoded order number
      expect(apiRequests.length).toBeGreaterThan(0);
      
      // Check that the API call used encoded order numbers (with %20 for spaces, etc.)
      const orderApiCall = apiRequests.find(url => url.includes('/api/orders/'));
      expect(orderApiCall).toBeDefined();
      
      if (orderApiCall) {
        // Should use proper URL encoding for special characters
        expect(orderApiCall).toMatch(/\/api\/orders\/[A-Z0-9%\-]+/);
      }
    }
  });

  test('should maintain responsive design on mobile viewports', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to client dashboard
    await page.goto('/client');
    await page.waitForLoadState('networkidle');
    
    // Click view details
    const viewDetailsLink = page.locator('a:has-text("View Details")').first();
    if (await viewDetailsLink.count() > 0) {
      await viewDetailsLink.click();
      
      // Wait for order details page
      await expect(page.locator('h1:has-text("Order Details")')).toBeVisible();
      
      // Verify back button is still visible and accessible on mobile
      const backButton = page.locator('button:has-text("Back to Dashboard")');
      await expect(backButton).toBeVisible();
      
      // Verify the order details card is responsive
      const orderCard = page.locator('.w-full.max-w-3xl');
      await expect(orderCard).toBeVisible();
      
      // Test back button functionality on mobile
      await backButton.click();
      await expect(page).toHaveURL('/client');
    }
  });

  test('should handle loading states appropriately', async ({ page }) => {
    // Navigate to client dashboard
    await page.goto('/client');
    
    // Click view details
    const viewDetailsLink = page.locator('a:has-text("View Details")').first();
    if (await viewDetailsLink.count() > 0) {
      await viewDetailsLink.click();
      
      // Check if there's a loading state (this might be very fast in tests)
      // But if present, it should be replaced by actual content
      await page.waitForLoadState('networkidle');
      
      // Ensure loading indicators are gone and content is visible
      await expect(page.locator('text=Loading')).not.toBeVisible();
      await expect(page.locator('h1:has-text("Order Details")')).toBeVisible();
    }
  });
}); 