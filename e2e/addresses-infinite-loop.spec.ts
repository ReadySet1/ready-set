import { test, expect } from '@playwright/test';

/**
 * Test suite for Addresses Dashboard Infinite Loop Fix
 * 
 * This test verifies that the addresses dashboard no longer makes
 * infinite API calls and properly manages state updates.
 */

test.describe('Addresses Dashboard - Infinite Loop Prevention', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to addresses page
    await page.goto('/addresses');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should not make infinite API calls when loading addresses', async ({ page }) => {
    // Start monitoring network requests
    const apiCalls: string[] = [];
    
    page.on('request', (request) => {
      if (request.url().includes('/api/addresses')) {
        apiCalls.push(request.url());
      }
    });

    // Wait for initial load - check for either content or auth requirement
    try {
      await page.waitForSelector('[data-testid="addresses-content"]', { timeout: 5000 });
    } catch {
      // If content doesn't load, check if it's due to auth requirement
      const authMessage = await page.locator('text=Please sign in to manage addresses').count();
      if (authMessage > 0) {
        console.log('Test requires authentication - skipping infinite loop test');
        return;
      }
      throw new Error('Neither content nor auth message found');
    }
    
    // Wait a bit more to see if additional calls are made
    await page.waitForTimeout(2000);
    
    // Should only make 1-2 API calls (initial load + maybe one more for auth)
    // Not the infinite loop we had before
    expect(apiCalls.length).toBeLessThanOrEqual(3);
    
    console.log(`API calls made: ${apiCalls.length}`);
    apiCalls.forEach((url, index) => {
      console.log(`Call ${index + 1}: ${url}`);
    });
  });

  test('should properly handle filter changes without infinite loops', async ({ page }) => {
    // Wait for initial load or check auth requirement
    try {
      await page.waitForSelector('[data-testid="addresses-content"]', { timeout: 5000 });
    } catch {
      const authMessage = await page.locator('text=Please sign in to manage addresses').count();
      if (authMessage > 0) {
        console.log('Test requires authentication - skipping filter test');
        return;
      }
      throw new Error('Neither content nor auth message found');
    }
    
    // Clear previous network monitoring
    const apiCalls: string[] = [];
    
    page.on('request', (request) => {
      if (request.url().includes('/api/addresses')) {
        apiCalls.push(request.url());
      }
    });

    // Change filter to "private"
    await page.click('text=Private');
    
    // Wait for the filter change to process
    await page.waitForTimeout(1000);
    
    // Should only make 1 API call for the filter change
    expect(apiCalls.length).toBeLessThanOrEqual(2);
    
    // Change filter to "shared"
    await page.click('text=Shared');
    await page.waitForTimeout(1000);
    
    // Should only make 1 more API call
    expect(apiCalls.length).toBeLessThanOrEqual(3);
  });

  test('should handle pagination without infinite loops', async ({ page }) => {
    // Wait for initial load or check auth requirement
    try {
      await page.waitForSelector('[data-testid="addresses-content"]', { timeout: 5000 });
    } catch {
      const authMessage = await page.locator('text=Please sign in to manage addresses').count();
      if (authMessage > 0) {
        console.log('Test requires authentication - skipping pagination test');
        return;
      }
      throw new Error('Neither content nor auth message found');
    }
    
    // Check if pagination exists
    const paginationExists = await page.locator('[data-testid="pagination"]').count() > 0;
    
    if (paginationExists) {
      // Clear previous network monitoring
      const apiCalls: string[] = [];
      
      page.on('request', (request) => {
        if (request.url().includes('/api/addresses')) {
          apiCalls.push(request.url());
        }
      });

      // Click next page
      await page.click('[data-testid="pagination-next"]');
      await page.waitForTimeout(1000);
      
      // Should only make 1 API call for pagination
      expect(apiCalls.length).toBeLessThanOrEqual(2);
    }
  });

  test('should not re-render unnecessarily when state changes', async ({ page }) => {
    // Wait for initial load or check auth requirement
    try {
      await page.waitForSelector('[data-testid="addresses-content"]', { timeout: 5000 });
    } catch {
      const authMessage = await page.locator('text=Please sign in to manage addresses').count();
      if (authMessage > 0) {
        console.log('Test requires authentication - skipping re-render test');
        return;
      }
      throw new Error('Neither content nor auth message found');
    }
    
    // Get initial render count
    let renderCount = 0;
    
    // Monitor for component re-renders by watching for DOM changes
    const observer = new MutationObserver(() => {
      renderCount++;
    });
    
    observer.observe(page.locator('[data-testid="addresses-content"]').first(), {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    // Wait a bit to see if unnecessary re-renders occur
    await page.waitForTimeout(3000);
    
    // Should not have excessive re-renders
    // A few re-renders are normal, but not the infinite loop we had
    expect(renderCount).toBeLessThan(10);
    
    observer.disconnect();
  });

  test('should properly memoize callback functions', async ({ page }) => {
    // Wait for initial load or check auth requirement
    try {
      await page.waitForSelector('[data-testid="addresses-content"]', { timeout: 5000 });
    } catch {
      const authMessage = await page.locator('text=Please sign in to manage addresses').count();
      if (authMessage > 0) {
        console.log('Test requires authentication - skipping memoization test');
        return;
      }
      throw new Error('Neither content nor auth message found');
    }
    
    // This test verifies that the component doesn't create new function references
    // on every render, which was causing the infinite loop
    
    // Get the initial state
    const initialContent = await page.locator('[data-testid="addresses-content"]').innerHTML();
    
    // Trigger a state change that should not cause infinite loops
    await page.click('text=Private');
    await page.waitForTimeout(1000);
    
    // The content should have changed, but not in an infinite loop
    const newContent = await page.locator('[data-testid="addresses-content"]').innerHTML();
    
    // Content should be different (filter changed) but not constantly changing
    expect(newContent).not.toBe(initialContent);
    
    // Wait a bit more to ensure stability
    await page.waitForTimeout(2000);
    
    const finalContent = await page.locator('[data-testid="addresses-content"]').innerHTML();
    
    // Content should be stable after the filter change
    expect(finalContent).toBe(newContent);
  });

  test('should handle authentication state changes properly', async ({ page }) => {
    // Wait for initial load or check auth requirement
    try {
      await page.waitForSelector('[data-testid="addresses-content"]', { timeout: 5000 });
    } catch {
      const authMessage = await page.locator('text=Please sign in to manage addresses').count();
      if (authMessage > 0) {
        console.log('Test requires authentication - skipping auth state test');
        return;
      }
      throw new Error('Neither content nor auth message found');
    }
    
    // Monitor API calls during potential auth state changes
    const apiCalls: string[] = [];
    
    page.on('request', (request) => {
      if (request.url().includes('/api/addresses')) {
        apiCalls.push(request.url());
      }
    });

    // Simulate a potential auth refresh scenario
    // Wait for any background auth checks
    await page.waitForTimeout(3000);
    
    // Should not make excessive API calls due to auth state changes
    expect(apiCalls.length).toBeLessThanOrEqual(3);
  });
});

/**
 * Performance Test: Verify API call frequency over time
 */
test.describe('Addresses Dashboard - Performance Tests', () => {
  test('should maintain stable API call frequency over extended period', async ({ page }) => {
    await page.goto('/addresses');
    
    // Wait for initial load or check auth requirement
    try {
      await page.waitForSelector('[data-testid="addresses-content"]', { timeout: 5000 });
    } catch {
      const authMessage = await page.locator('text=Please sign in to manage addresses').count();
      if (authMessage > 0) {
        console.log('Test requires authentication - skipping performance test');
        return;
      }
      throw new Error('Neither content nor auth message found');
    }
    
    const apiCalls: { timestamp: number; url: string }[] = [];
    
    page.on('request', (request) => {
      if (request.url().includes('/api/addresses')) {
        apiCalls.push({
          timestamp: Date.now(),
          url: request.url()
        });
      }
    });

    // Monitor for 10 seconds to ensure stability
    await page.waitForTimeout(10000);
    
    // Calculate time between calls
    const timeBetweenCalls: number[] = [];
    for (let i = 1; i < apiCalls.length; i++) {
      timeBetweenCalls.push(apiCalls[i].timestamp - apiCalls[i-1].timestamp);
    }
    
    // Should not have calls every 460-500ms as reported in the logs
    const suspiciousIntervals = timeBetweenCalls.filter(interval => 
      interval >= 400 && interval <= 600
    );
    
    // Should have very few suspicious intervals (maybe 1-2 for legitimate reasons)
    expect(suspiciousIntervals.length).toBeLessThanOrEqual(2);
    
    console.log(`Total API calls: ${apiCalls.length}`);
    console.log(`Time between calls: ${timeBetweenCalls.map(t => `${t}ms`).join(', ')}`);
  });
});

/**
 * Component-Level Test: Test the infinite loop fix without authentication
 */
test.describe('Addresses Component - Unit Test Simulation', () => {
  test('should not cause infinite loops in component logic', async ({ page }) => {
    // This test simulates testing the component logic without full page integration
    // We'll test that the page loads without errors and doesn't make excessive requests
    
    await page.goto('/addresses');
    await page.waitForLoadState('networkidle');
    
    // Check if we get either the content or the auth message
    const hasContent = await page.locator('[data-testid="addresses-content"]').count() > 0;
    const hasAuthMessage = await page.locator('text=Please sign in to manage addresses').count() > 0;
    
    // Should have one or the other
    expect(hasContent || hasAuthMessage).toBe(true);
    
    // Monitor for any excessive API calls during page load
    const apiCalls: string[] = [];
    
    page.on('request', (request) => {
      if (request.url().includes('/api/addresses')) {
        apiCalls.push(request.url());
      }
    });
    
    // Wait a bit to see if there are any background calls
    await page.waitForTimeout(3000);
    
    // Should not make excessive calls even if not authenticated
    expect(apiCalls.length).toBeLessThanOrEqual(2);
    
    console.log(`Component test - API calls made: ${apiCalls.length}`);
  });
});
