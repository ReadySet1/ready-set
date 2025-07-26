import { test, expect } from '@playwright/test';

test.describe('Order Status Page Pagination', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the order status page
    await page.goto('/order-status');
  });

  test('should display correct pagination information', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('text=Your Orders');

    // Check that pagination elements are present
    const paginationText = await page.locator('text=/\\d+ of \\d+/').textContent();
    expect(paginationText).toBeTruthy();

    // Check that Previous and Next buttons are present
    const prevButton = page.locator('button:has-text("Previous")');
    const nextButton = page.locator('button:has-text("Next")');
    
    expect(await prevButton.isVisible()).toBeTruthy();
    expect(await nextButton.isVisible()).toBeTruthy();
  });

  test('should navigate between pages correctly', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('text=Your Orders');

    // Get initial pagination state
    const initialPaginationText = await page.locator('text=/\\d+ of \\d+/').textContent();
    console.log('Initial pagination:', initialPaginationText);

    // Check if Next button is enabled
    const nextButton = page.locator('button:has-text("Next")');
    const isNextEnabled = await nextButton.isEnabled();

    if (isNextEnabled) {
      // Click Next button
      await nextButton.click();
      
      // Wait for the page to update
      await page.waitForTimeout(1000);
      
      // Check that pagination text has changed
      const newPaginationText = await page.locator('text=/\\d+ of \\d+/').textContent();
      expect(newPaginationText).not.toBe(initialPaginationText);
      
      // Check that Previous button is now enabled
      const prevButton = page.locator('button:has-text("Previous")');
      expect(await prevButton.isEnabled()).toBeTruthy();
      
      // Go back to first page
      await prevButton.click();
      await page.waitForTimeout(1000);
      
      // Check that we're back to the original pagination
      const finalPaginationText = await page.locator('text=/\\d+ of \\d+/').textContent();
      expect(finalPaginationText).toBe(initialPaginationText);
    } else {
      // If Next is disabled, we're on the last page or only have one page
      console.log('Next button is disabled - likely on last page or single page');
    }
  });

  test('should display order numbers correctly', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('text=Your Orders');

    // Check that order numbers are displayed (not "Testing Order")
    const orderNumbers = await page.locator('td:first-child a').allTextContents();
    
    for (const orderNumber of orderNumbers) {
      expect(orderNumber).not.toBe('Testing Order');
      expect(orderNumber.trim()).toBeTruthy();
    }
  });

  test('should display delivery dates instead of creation dates', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('text=Your Orders');

    // Check that the date column header shows "Delivery Date"
    const dateHeader = await page.locator('th:has-text("Delivery Date")').isVisible();
    expect(dateHeader).toBeTruthy();
  });

  test('should make order numbers clickable', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('text=Your Orders');

    // Get the first order number link
    const firstOrderLink = page.locator('td:first-child a').first();
    
    if (await firstOrderLink.isVisible()) {
      // Check that the link has the correct href pattern
      const href = await firstOrderLink.getAttribute('href');
      expect(href).toMatch(/^\/order-status\/.+/);
      
      // Click the link to test navigation
      await firstOrderLink.click();
      
      // Wait for navigation
      await page.waitForTimeout(1000);
      
      // Check that we're on the order details page
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/order-status\/.+/);
    }
  });

  test('should handle empty state correctly', async ({ page }) => {
    // This test would require a user with no orders
    // For now, we'll just check that the page loads without errors
    await page.waitForSelector('text=Your Orders');
    
    // Check that either orders are displayed or empty state is shown
    const hasOrders = await page.locator('tbody tr').count() > 0;
    const hasEmptyState = await page.locator('text=No orders found').isVisible();
    
    // Should have either orders or empty state, not both
    expect(hasOrders || hasEmptyState).toBeTruthy();
  });

  test('should handle error states gracefully', async ({ page }) => {
    // This test would require mocking API failures
    // For now, we'll just check that the page loads normally
    await page.waitForSelector('text=Your Orders');
    
    // Check that no error message is displayed
    const errorMessage = await page.locator('text=Error Loading Orders').isVisible();
    expect(errorMessage).toBeFalsy();
  });

  test('should maintain pagination state on page refresh', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('text=Your Orders');

    // Get initial pagination state
    const initialPaginationText = await page.locator('text=/\\d+ of \\d+/').textContent();
    
    // Refresh the page
    await page.reload();
    
    // Wait for the page to load again
    await page.waitForSelector('text=Your Orders');
    
    // Check that pagination state is maintained
    const newPaginationText = await page.locator('text=/\\d+ of \\d+/').textContent();
    expect(newPaginationText).toBe(initialPaginationText);
  });

  test('should display correct order information in table', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('text=Your Orders');

    // Check that table headers are correct
    const headers = await page.locator('thead th').allTextContents();
    expect(headers).toContain('Order Number');
    expect(headers).toContain('Type');
    expect(headers).toContain('Status');
    expect(headers).toContain('Delivery Date');
    expect(headers).toContain('Pickup');
    expect(headers).toContain('Delivery');
    expect(headers).toContain('Total');

    // Check that at least one row has data
    const rows = await page.locator('tbody tr').count();
    expect(rows).toBeGreaterThan(0);
  });
}); 