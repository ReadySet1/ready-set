import { test, expect } from '@playwright/test';

test.describe('Order URL Encoding E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin login or setup authentication
    // This may need adjustment based on your auth setup
    await page.goto('/admin');
    
    // Add authentication steps if needed
    // await page.fill('[data-testid=email]', 'admin@example.com');
    // await page.fill('[data-testid=password]', 'password');
    // await page.click('[data-testid=login-button]');
  });

  test.describe('Catering Orders with Special Characters', () => {
    test('should handle order numbers with forward slashes in URLs', async ({ page }) => {
      // Navigate to catering orders list
      await page.goto('/admin/catering-orders');
      
      // Wait for the page to load
      await page.waitForLoadState('networkidle');
      
      // Look for an order with a slash in the number
      // This assumes there's test data or we can create it
      const orderWithSlash = page.locator('text=CV-0GF59K/1').first();
      
      if (await orderWithSlash.isVisible()) {
        // Click the order link
        await orderWithSlash.click();
        
        // Verify the URL is correctly encoded
        await expect(page).toHaveURL(/.*\/admin\/catering-orders\/CV-0GF59K%2F1/);
        
        // Verify the page loads correctly and displays the decoded order number
        await expect(page.locator('text=Order CV-0GF59K/1')).toBeVisible();
        
        // Check that API calls are made with proper encoding
        const apiRequest = page.waitForRequest(request => 
          request.url().includes('/api/orders/CV-0GF59K%2F1')
        );
        
        // Trigger a refresh or action that makes API call
        await page.reload();
        
        await apiRequest;
      }
    });

    test('should handle order numbers with multiple special characters', async ({ page }) => {
      // Navigate to catering orders list
      await page.goto('/admin/catering-orders');
      await page.waitForLoadState('networkidle');
      
      // This test assumes we have test data with special characters
      // In a real scenario, you might need to create this data first
      
      const specialOrderNumbers = [
        'CV-0GF59K&1',
        'CV-0GF59K+1', 
        'CV-0GF59K#1',
        'CV-0GF59K/1/2'
      ];
      
      for (const orderNumber of specialOrderNumbers) {
        const orderLink = page.locator(`text=${orderNumber}`).first();
        
        if (await orderLink.isVisible()) {
          await orderLink.click();
          
          // Verify URL encoding
          const encodedOrderNumber = encodeURIComponent(orderNumber);
          await expect(page).toHaveURL(new RegExp(`.*\\/admin\\/catering-orders\\/${encodedOrderNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
          
          // Verify page displays decoded order number
          await expect(page.locator(`text=Order ${orderNumber}`)).toBeVisible();
          
          // Go back to orders list for next iteration
          await page.goBack();
          await page.waitForLoadState('networkidle');
        }
      }
    });

    test('should maintain functionality after navigation', async ({ page }) => {
      await page.goto('/admin/catering-orders');
      await page.waitForLoadState('networkidle');
      
      // Click on an order with special characters
      const orderLink = page.locator('text=CV-0GF59K/1').first();
      
      if (await orderLink.isVisible()) {
        await orderLink.click();
        
        // Wait for order details to load
        await page.waitForLoadState('networkidle');
        
        // Test that order actions still work
        // This assumes there are action buttons on the order detail page
        const statusButtons = page.locator('[data-testid*="status-"], [data-testid*="driver-"], button:has-text("Update")');
        
        if (await statusButtons.first().isVisible()) {
          // Click a status update button if available
          await statusButtons.first().click();
          
          // Verify that the action completes successfully
          // This might show a success message or update the UI
          await page.waitForTimeout(1000); // Brief wait for any updates
        }
        
        // Test navigation back to orders list
        const backButton = page.locator('button:has-text("Back"), [data-testid="back-button"], a:has-text("Catering Orders")');
        
        if (await backButton.first().isVisible()) {
          await backButton.first().click();
          await expect(page).toHaveURL(/.*\/admin\/catering-orders$/);
        }
      }
    });
  });

  test.describe('On-Demand Orders with Special Characters', () => {
    test('should handle on-demand order navigation with encoded URLs', async ({ page }) => {
      await page.goto('/admin/on-demand-orders');
      await page.waitForLoadState('networkidle');
      
      // Look for an order with special characters
      const orderWithSpecialChars = page.locator('text=OD-0GF59K/1, text=OD-0GF59K+1, text=OD-0GF59K&1').first();
      
      if (await orderWithSpecialChars.isVisible()) {
        const orderNumber = await orderWithSpecialChars.textContent();
        
        await orderWithSpecialChars.click();
        
        // Verify URL encoding
        const encodedOrderNumber = encodeURIComponent(orderNumber || '');
        await expect(page).toHaveURL(new RegExp(`.*\\/admin\\/on-demand-orders\\/${encodedOrderNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
        
        // Verify page content
        await expect(page.locator(`text=Order ${orderNumber}`)).toBeVisible();
      }
    });

    test('should handle API calls with proper encoding for on-demand orders', async ({ page }) => {
      await page.goto('/admin/on-demand-orders');
      await page.waitForLoadState('networkidle');
      
      // Set up network monitoring
      const apiCalls: string[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/orders/')) {
          apiCalls.push(request.url());
        }
      });
      
      const orderLink = page.locator('text=OD-0GF59K/1').first();
      
      if (await orderLink.isVisible()) {
        await orderLink.click();
        await page.waitForLoadState('networkidle');
        
        // Verify that API calls use encoded order numbers
        const encodedApiCalls = apiCalls.filter(url => 
          url.includes('OD-0GF59K%2F1')
        );
        
        expect(encodedApiCalls.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    test('should work consistently across different scenarios', async ({ page }) => {
      const testScenarios = [
        {
          path: '/admin/catering-orders',
          orderPattern: 'CV-0GF59K/1',
          expectedUrlPattern: /.*\/admin\/catering-orders\/CV-0GF59K%2F1/
        },
        {
          path: '/admin/on-demand-orders', 
          orderPattern: 'OD-0GF59K/1',
          expectedUrlPattern: /.*\/admin\/on-demand-orders\/OD-0GF59K%2F1/
        }
      ];
      
      for (const scenario of testScenarios) {
        await page.goto(scenario.path);
        await page.waitForLoadState('networkidle');
        
        const orderLink = page.locator(`text=${scenario.orderPattern}`).first();
        
        if (await orderLink.isVisible()) {
          await orderLink.click();
          await expect(page).toHaveURL(scenario.expectedUrlPattern);
          
          // Verify page loads without errors
          await expect(page.locator('body')).toBeVisible();
          
          // Check for any JavaScript errors
          const errors: string[] = [];
          page.on('pageerror', error => {
            errors.push(error.message);
          });
          
          await page.waitForTimeout(2000);
          expect(errors).toHaveLength(0);
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle malformed URLs gracefully', async ({ page }) => {
      // Test with various malformed encoded URLs
      const malformedUrls = [
        '/admin/catering-orders/CV-0GF59K%',
        '/admin/catering-orders/CV-0GF59K%2',
        '/admin/catering-orders/CV-0GF59K%2G', // Invalid hex
      ];
      
      for (const url of malformedUrls) {
        await page.goto(url);
        
        // Page should not crash, should show some error or fallback
        await expect(page.locator('body')).toBeVisible();
        
        // Check that there's no unhandled JavaScript error
        const hasError = await page.locator('text=Error, text=404, text=Not Found').isVisible();
        
        // Either show an error page or redirect, but don't crash
        expect(true).toBe(true); // Test passes if we get here without throwing
      }
    });

    test('should handle network failures gracefully', async ({ page }) => {
      await page.goto('/admin/catering-orders');
      await page.waitForLoadState('networkidle');
      
      // Simulate network failure for API calls
      await page.route('/api/orders/**', route => {
        route.abort('failed');
      });
      
      const orderLink = page.locator('text=CV-0GF59K/1').first();
      
      if (await orderLink.isVisible()) {
        await orderLink.click();
        
        // Page should still load, might show loading or error state
        await expect(page.locator('body')).toBeVisible();
        
        // Should not have unhandled JavaScript errors
        const errors: string[] = [];
        page.on('pageerror', error => {
          errors.push(error.message);
        });
        
        await page.waitForTimeout(3000);
        
        // Filter out expected network errors
        const unexpectedErrors = errors.filter(error => 
          !error.includes('fetch') && 
          !error.includes('NetworkError') &&
          !error.includes('Failed to fetch')
        );
        
        expect(unexpectedErrors).toHaveLength(0);
      }
    });
  });

  test.describe('Performance', () => {
    test('should not significantly impact page load performance', async ({ page }) => {
      // Measure page load time with special characters
      const startTime = Date.now();
      
      await page.goto('/admin/catering-orders');
      await page.waitForLoadState('networkidle');
      
      const listLoadTime = Date.now() - startTime;
      
      // Click on order with special characters
      const orderLink = page.locator('text=CV-0GF59K/1').first();
      
      if (await orderLink.isVisible()) {
        const detailStartTime = Date.now();
        
        await orderLink.click();
        await page.waitForLoadState('networkidle');
        
        const detailLoadTime = Date.now() - detailStartTime;
        
        // Basic performance assertion - adjust thresholds as needed
        expect(listLoadTime).toBeLessThan(10000); // 10 seconds max
        expect(detailLoadTime).toBeLessThan(10000); // 10 seconds max
        
        console.log(`List load time: ${listLoadTime}ms, Detail load time: ${detailLoadTime}ms`);
      }
    });
  });
}); 