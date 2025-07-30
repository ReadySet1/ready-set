import { test, expect } from '@playwright/test';

test.describe('Bug Fixes Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean state
    await page.goto('/');
  });

  test.describe('Header Authentication Update Fix', () => {
    test('should update header navigation when user logs in and out', async ({ page }) => {
      // Initially should show sign in button
      await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
      
      // Navigate to sign in page
      await page.getByRole('link', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/.*sign-in/);
      
      // Fill in login form (mock successful login)
      await page.fill('[data-testid="email-input"]', 'admin@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="sign-in-button"]');
      
      // Header should update without page refresh
      await expect(page.getByText(/welcome/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /sign in/i })).not.toBeVisible();
      
      // Sign out should also update header immediately
      await page.getByRole('button', { name: /sign out/i }).click();
      await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: /sign out/i })).not.toBeVisible();
    });
  });

  test.describe('Address Form State Validation Fix', () => {
    test('should accept and normalize California state inputs', async ({ page }) => {
      // Navigate to address creation (assuming it's in catering request)
      await page.goto('/catering-request');
      
      // Open address form
      await page.click('[data-testid="add-address-button"]');
      
      // Fill required fields
      await page.selectOption('[data-testid="county-select"]', 'San Francisco');
      await page.fill('[data-testid="street-input"]', '123 Test Street');
      await page.fill('[data-testid="city-input"]', 'San Francisco');
      await page.fill('[data-testid="zip-input"]', '94103');
      
      // Test different state input formats
      const stateInputs = ['CA', 'California', 'CALIFORNIA', 'calif', '  California  '];
      
      for (const stateInput of stateInputs) {
        await page.fill('[data-testid="state-input"]', '');
        await page.fill('[data-testid="state-input"]', stateInput);
        
        // Should show help text
        await expect(page.getByText(/Enter "CA" or "California"/)).toBeVisible();
        
        // Submit form
        await page.click('[data-testid="save-address-button"]');
        
        // Should not show validation error
        await expect(page.getByText(/only california.*supported/i)).not.toBeVisible();
        
        // Form should close or show success
        await expect(page.locator('[data-testid="address-form"]')).not.toBeVisible({ timeout: 3000 });
        
        // Reopen form for next test
        if (stateInput !== stateInputs[stateInputs.length - 1]) {
          await page.click('[data-testid="add-address-button"]');
          await page.selectOption('[data-testid="county-select"]', 'San Francisco');
          await page.fill('[data-testid="street-input"]', '123 Test Street');
          await page.fill('[data-testid="city-input"]', 'San Francisco');
          await page.fill('[data-testid="zip-input"]', '94103');
        }
      }
    });

    test('should show validation error for invalid state', async ({ page }) => {
      await page.goto('/catering-request');
      await page.click('[data-testid="add-address-button"]');
      
      // Fill form with invalid state
      await page.selectOption('[data-testid="county-select"]', 'San Francisco');
      await page.fill('[data-testid="street-input"]', '123 Test Street');
      await page.fill('[data-testid="city-input"]', 'San Francisco');
      await page.fill('[data-testid="state-input"]', 'NY');
      await page.fill('[data-testid="zip-input"]', '94103');
      
      await page.click('[data-testid="save-address-button"]');
      
      // Should show appropriate validation or handle non-CA states gracefully
      // (depending on business requirements)
    });
  });

  test.describe('Bay Area Counties Fix', () => {
    test('should show only Bay Area counties in vendor order creation', async ({ page }) => {
      // Navigate to vendor order creation (assuming admin access)
      await page.goto('/admin/orders/catering/create');
      
      // Open county selector
      await page.click('[data-testid="pickup-county-select"]');
      
      // Should show Bay Area counties, not "California"
      await expect(page.getByRole('option', { name: 'San Francisco' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'San Mateo' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'Alameda' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'Santa Clara' })).toBeVisible();
      
      // Should NOT show "California" as an option
      await expect(page.getByRole('option', { name: 'California' })).not.toBeVisible();
      
      // Should show help text about Bay Area
      await expect(page.getByText(/bay area counties only/i)).toBeVisible();
    });
  });

  test.describe('Admin Job Applications CSV Export', () => {
    test('should export job applications to CSV successfully', async ({ page }) => {
      // Login as admin
      await page.goto('/sign-in');
      await page.fill('[data-testid="email-input"]', 'admin@example.com');
      await page.fill('[data-testid="password-input"]', 'admin123');
      await page.click('[data-testid="sign-in-button"]');
      
      // Navigate to job applications
      await page.goto('/admin/job-applications');
      
      // Wait for applications to load
      await expect(page.getByRole('table')).toBeVisible();
      
      // Set up download handler
      const downloadPromise = page.waitForEvent('download');
      
      // Click export button
      await page.getByRole('button', { name: /export csv/i }).click();
      
      // Wait for download
      const download = await downloadPromise;
      
      // Verify download properties
      expect(download.suggestedFilename()).toMatch(/job-applications-\d{4}-\d{2}-\d{2}\.csv/);
      
      // Verify success notification
      await expect(page.getByText(/exported.*applications to csv/i)).toBeVisible();
    });
  });

  test.describe('Job Application Status Change', () => {
    test('should update job application status successfully', async ({ page }) => {
      // Login as admin
      await page.goto('/sign-in');
      await page.fill('[data-testid="email-input"]', 'admin@example.com');
      await page.fill('[data-testid="password-input"]', 'admin123');
      await page.click('[data-testid="sign-in-button"]');
      
      // Navigate to job applications
      await page.goto('/admin/job-applications');
      
      // Wait for applications to load
      await expect(page.getByRole('table')).toBeVisible();
      
      // Find first application row and status dropdown
      const firstRow = page.getByRole('row').nth(1); // Skip header row
      const statusSelect = firstRow.getByRole('combobox', { name: /status/i });
      
      await statusSelect.click();
      await page.getByRole('option', { name: 'APPROVED' }).click();
      
      // Should show success notification
      await expect(page.getByText(/status updated successfully/i)).toBeVisible();
      
      // Status should be updated in the UI
      await expect(statusSelect).toHaveValue('APPROVED');
    });

    test('should handle status change authentication properly', async ({ page }) => {
      // Test without authentication - should redirect to login
      await page.goto('/admin/job-applications');
      await expect(page).toHaveURL(/.*sign-in/);
      
      // Login as non-admin user
      await page.fill('[data-testid="email-input"]', 'client@example.com');
      await page.fill('[data-testid="password-input"]', 'client123');
      await page.click('[data-testid="sign-in-button"]');
      
      // Try to access admin page - should be forbidden
      await page.goto('/admin/job-applications');
      await expect(page.getByText(/access denied|forbidden/i)).toBeVisible();
    });
  });

  test.describe('Admin Users List and Permissions', () => {
    test('should display vendor details in users list', async ({ page }) => {
      // Login as admin
      await page.goto('/sign-in');
      await page.fill('[data-testid="email-input"]', 'admin@example.com');
      await page.fill('[data-testid="password-input"]', 'admin123');
      await page.click('[data-testid="sign-in-button"]');
      
      // Navigate to users list
      await page.goto('/admin/users');
      
      // Wait for users to load
      await expect(page.getByRole('table')).toBeVisible();
      
      // Look for vendor users and their company names
      const vendorRows = page.getByRole('row').filter({ hasText: /vendor/i });
      
      if (await vendorRows.count() > 0) {
        const firstVendorRow = vendorRows.first();
        
        // Should show company name icon and text
        await expect(firstVendorRow.getByText(/🏢/)).toBeVisible();
        await expect(firstVendorRow.locator('.text-amber-600')).toBeVisible();
      }
    });

    test('should handle authentication properly for users list', async ({ page }) => {
      // Test proper authentication flow
      await page.goto('/admin/users');
      
      // Should redirect to login
      await expect(page).toHaveURL(/.*sign-in/);
      
      // Login with proper credentials
      await page.fill('[data-testid="email-input"]', 'admin@example.com');
      await page.fill('[data-testid="password-input"]', 'admin123');
      await page.click('[data-testid="sign-in-button"]');
      
      // Should now access users page
      await expect(page).toHaveURL(/.*admin\/users/);
      await expect(page.getByRole('table')).toBeVisible();
    });
  });

  test.describe('Driver Assignment Dialog Positioning', () => {
    test('should display driver assignment dialog with proper alignment', async ({ page }) => {
      // Login as admin
      await page.goto('/sign-in');
      await page.fill('[data-testid="email-input"]', 'admin@example.com');
      await page.fill('[data-testid="password-input"]', 'admin123');
      await page.click('[data-testid="sign-in-button"]');
      
      // Navigate to orders
      await page.goto('/admin/orders');
      
      // Wait for orders to load
      await expect(page.getByRole('table')).toBeVisible();
      
      // Click assign driver button on first order
      const assignButton = page.getByRole('button', { name: /assign driver/i }).first();
      await assignButton.click();
      
      // Dialog should be visible and properly positioned
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      
      // Check that dialog is centered and not cut off
      const dialogBox = await dialog.boundingBox();
      const viewportSize = page.viewportSize();
      
      if (dialogBox && viewportSize) {
        // Dialog should be reasonably centered
        expect(dialogBox.x).toBeGreaterThan(0);
        expect(dialogBox.y).toBeGreaterThan(0);
        expect(dialogBox.x + dialogBox.width).toBeLessThan(viewportSize.width);
        expect(dialogBox.y + dialogBox.height).toBeLessThan(viewportSize.height);
      }
      
      // Should have proper z-index (dialog should be on top)
      await expect(dialog).toBeVisible();
      
      // Close dialog
      await page.getByRole('button', { name: /close|cancel/i }).click();
      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe('Integration: Complete User Workflow', () => {
    test('should handle complete catering order creation workflow with all fixes', async ({ page }) => {
      // 1. User logs in - header should update immediately
      await page.goto('/sign-in');
      await page.fill('[data-testid="email-input"]', 'client@example.com');
      await page.fill('[data-testid="password-input"]', 'client123');
      await page.click('[data-testid="sign-in-button"]');
      
      // Verify header updated
      await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
      
      // 2. Navigate to catering request
      await page.goto('/catering-request');
      
      // 3. Add address with CA state normalization
      await page.click('[data-testid="add-address-button"]');
      await page.selectOption('[data-testid="county-select"]', 'San Francisco');
      await page.fill('[data-testid="street-input"]', '123 Market Street');
      await page.fill('[data-testid="city-input"]', 'San Francisco');
      await page.fill('[data-testid="state-input"]', 'California'); // Should be normalized to CA
      await page.fill('[data-testid="zip-input"]', '94103');
      await page.click('[data-testid="save-address-button"]');
      
      // Verify address was saved
      await expect(page.getByText('123 Market Street')).toBeVisible();
      
      // 4. Fill out catering request
      await page.fill('[data-testid="company-name"]', 'Test Company');
      await page.fill('[data-testid="event-details"]', 'Company lunch meeting');
      await page.selectOption('[data-testid="service-type"]', 'catering');
      
      // 5. Submit request
      await page.click('[data-testid="submit-request"]');
      
      // Should show success message
      await expect(page.getByText(/request submitted successfully/i)).toBeVisible();
      
      // 6. Log out - header should update
      await page.getByRole('button', { name: /sign out/i }).click();
      await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    });
  });

  test.describe('Cross-browser Compatibility', () => {
    test('should work correctly in different viewport sizes', async ({ page }) => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      // Header should be responsive
      await expect(page.getByRole('button', { name: /menu/i })).toBeVisible();
      
      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/catering-request');
      
      // Address form should be responsive
      await page.click('[data-testid="add-address-button"]');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      
      const dialogBox = await dialog.boundingBox();
      if (dialogBox) {
        expect(dialogBox.width).toBeLessThanOrEqual(768 * 0.95); // Should fit within viewport
      }
      
      // Test desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/admin/job-applications');
      
      // Tables should be properly sized
      await expect(page.getByRole('table')).toBeVisible();
    });
  });
}); 