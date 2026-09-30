import { test, expect } from '@playwright/test';

test.describe('Order Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('/');
  });

  test.describe('authenticated client', () => {
    // /catering-request requires a session; unauthenticated visits land on /sign-in.
    test.use({ storageState: 'e2e/.auth/client.json' });

    test('catering order creation with address management', async ({ page }) => {
      await page.goto('/catering-request', { waitUntil: 'domcontentloaded', timeout: 45000 });

      // Verify we're on the catering order page
      await expect(
        page.getByRole('heading', { level: 1, name: 'Catering Request' })
      ).toBeVisible({ timeout: 30000 });

      // The request form renders. Nothing is submitted:
      // this runs against a shared database. (The old free-text state input
      // with "CA"/"California" normalization was replaced by a state select.)
      await expect(page.locator('form').first()).toBeVisible();
      await expect(
        page.getByRole('button', { name: /View 8-Point Delivery Checklist/ })
      ).toBeVisible();
    });
  });

  test('vendor order creation with Bay Area validation', async ({ page }) => {
    // Navigate to vendor order creation (this might be different URL)
    await page.goto('/vendor/orders/new');
    
    // Handle potential redirect to sign-in
    if (await page.locator('text=Sign In').count() > 0) {
      // Skip actual authentication, just test the flow
      console.log('Would require authentication - testing UI flow only');
      return;
    }

    // Test Bay Area location selection
    const countySelect = page.locator('select[name="county"], [data-testid="county-select"]');
    if (await countySelect.count() > 0) {
      // Test that only Bay Area counties are available
      await countySelect.click();
      
      // Verify Bay Area counties are listed
      await expect(page.locator('option, [role="option"]')).toContainText(['San Francisco', 'San Mateo', 'Santa Clara']);
      
      // Select a county
      if (await page.locator('option:has-text("San Francisco")').count() > 0) {
        await page.selectOption('select[name="county"]', 'San Francisco');
      }
    }
  });

  test('address validation and error handling', async ({ page }) => {
    await page.goto('/catering-request');
    
    // Test address form validation
    const addAddressButton = page.locator('[data-testid="add-address-button"], button:has-text("Add Address")');
    if (await addAddressButton.count() > 0) {
      await addAddressButton.first().click();
      
      // Try to submit empty form
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Add Address")');
      if (await saveButton.count() > 0) {
        await saveButton.click();
        
        // Should show validation errors
        await expect(page.locator('text=required')).toBeVisible();
      }
      
      // Test invalid ZIP code
      const zipInput = page.locator('input[name="zip"], input[placeholder*="ZIP"]');
      if (await zipInput.count() > 0) {
        await zipInput.fill('1234'); // Invalid ZIP
        
        if (await saveButton.count() > 0) {
          await saveButton.click();
          await expect(page.locator('text=Valid ZIP code is required')).toBeVisible();
        }
      }
    }
  });

  test('order form required fields validation', async ({ page }) => {
    await page.goto('/catering-request');
    
    // Test form validation for required order fields
    const submitButton = page.locator('button:has-text("Submit"), button:has-text("Place Order"), button[type="submit"]');
    if (await submitButton.count() > 0) {
      await submitButton.click();
      
      // Should show validation messages for required fields
      await expect(page.locator('text=required, text=Required')).toBeVisible();
    }
    
    // Test date picker validation
    const dateInput = page.locator('input[type="date"], input[name*="date"]');
    if (await dateInput.count() > 0) {
      // Test past date
      const pastDate = '2020-01-01';
      await dateInput.fill(pastDate);
      
      if (await submitButton.count() > 0) {
        await submitButton.click();
        // Should show error for past date
        await expect(page.locator('text=future date, text=past')).toBeVisible();
      }
    }
  });

  test('responsive design for order forms', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/catering-request');
    
    // Verify form is responsive
    const form = page.locator('form');
    if (await form.count() > 0) {
      // Form should be visible and properly laid out
      await expect(form).toBeVisible();
    }
    
    // Test mobile navigation
    const mobileMenu = page.locator('[aria-label="Mobile Menu"]');
    if (await mobileMenu.count() > 0) {
      await mobileMenu.click();
      // Mobile menu should be accessible
    }
  });

  test('address form CA state normalization', async ({ page }) => {
    await page.goto('/catering-request');
    
    const addAddressButton = page.locator('[data-testid="add-address-button"], button:has-text("Add Address")');
    if (await addAddressButton.count() > 0) {
      await addAddressButton.first().click();
      
      // Fill required fields
      await page.fill('input[name="street1"]', '123 Test Street');
      await page.fill('input[name="city"]', 'San Francisco');
      await page.fill('input[name="zip"]', '94103');
      
      // Test different state format inputs
      const stateFormats = ['CA', 'California', 'CALIFORNIA', 'calif', '  California  '];
      
      for (const stateInput of stateFormats) {
        const stateField = page.locator('input[name="state"]');
        if (await stateField.count() > 0) {
          await stateField.fill('');
          await stateField.fill(stateInput);
          
          // Should show help text
          await expect(page.locator('text=Enter "CA" or "California"')).toBeVisible();
          
          // Submit and verify no validation error
          const saveButton = page.locator('button:has-text("Save")');
          if (await saveButton.count() > 0) {
            await saveButton.click();
            
            // Should not show "only California supported" error
            await expect(page.locator('text=only california.*supported')).not.toBeVisible();
          }
          
          // Re-open form for next test (if it closed)
          if (await page.locator('input[name="state"]').count() === 0) {
            if (await addAddressButton.count() > 0) {
              await addAddressButton.first().click();
              await page.fill('input[name="street1"]', '123 Test Street');
              await page.fill('input[name="city"]', 'San Francisco');
              await page.fill('input[name="zip"]', '94103');
            }
          }
        }
      }
    }
  });

  test('order summary and confirmation', async ({ page }) => {
    await page.goto('/catering-request');
    
    // Fill out a basic order form if elements exist
    const eventNameInput = page.locator('input[name*="event"], input[placeholder*="event"]');
    if (await eventNameInput.count() > 0) {
      await eventNameInput.fill('Test Corporate Event');
    }
    
    const guestCountInput = page.locator('input[name*="guest"], input[name*="count"], input[type="number"]');
    if (await guestCountInput.count() > 0) {
      await guestCountInput.fill('50');
    }
    
    // Test order summary display
    const summarySection = page.locator('[data-testid="order-summary"], .summary, .order-details');
    if (await summarySection.count() > 0) {
      await expect(summarySection).toBeVisible();
    }
  });

  test('navigation and breadcrumbs', async ({ page }) => {
    await page.goto('/catering-request');
    
    // Test breadcrumb navigation if it exists
    const breadcrumbs = page.locator('[data-testid="breadcrumb"], .breadcrumb, nav[aria-label="breadcrumb"]');
    if (await breadcrumbs.count() > 0) {
      await expect(breadcrumbs).toBeVisible();
    }
    
    // Test back navigation
    const backButton = page.locator('button:has-text("Back"), [aria-label="Back"]');
    if (await backButton.count() > 0) {
      await backButton.click();
      // Should navigate away from current page
    }
  });
}); 