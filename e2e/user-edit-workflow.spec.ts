import { test, expect } from '@playwright/test';

test.describe('User Edit Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Note: In real tests, you'd need proper authentication setup
    // This is a template for when auth is configured
    await page.goto('/admin/users');
  });

  test('should update vendor name and reflect in users list', async ({ page }) => {
    // Skip this test if we can't authenticate (for CI/CD)
    test.skip(process.env.NODE_ENV !== 'test', 'Requires authentication setup');

    const originalName = 'Original Vendor Name';
    const updatedName = 'Updated Vendor Name Testing';

    // Step 1: Navigate to users list and find a vendor to edit
    await page.waitForSelector('[data-testid="users-table"]', { timeout: 10000 });
    
    // Look for a vendor row and click edit
    const vendorRow = page.locator('[data-type="vendor"]').first();
    await expect(vendorRow).toBeVisible();
    
    const editButton = vendorRow.locator('button:has-text("Edit")');
    await editButton.click();

    // Step 2: Verify we're on the user edit page
    await expect(page).toHaveURL(/\/admin\/users\/edit\/.+/);
    await page.waitForSelector('[data-testid="user-edit-form"]', { timeout: 5000 });

    // Step 3: Update the display name
    const displayNameField = page.locator('input[name="displayName"]');
    await displayNameField.fill('');
    await displayNameField.fill(updatedName);

    // Step 4: Save the changes
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();

    // Step 5: Wait for success toast
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast-success')).toContainText('User saved successfully');

    // Step 6: Verify we stay on the same page (no redirect)
    await expect(page).toHaveURL(/\/admin\/users\/edit\/.+/);
    
    // Step 7: Verify the form still shows updated data
    await expect(displayNameField).toHaveValue(updatedName);

    // Step 8: Navigate back to users list manually to verify the change
    await page.goto('/admin/users');
    await page.waitForSelector('[data-testid="users-table"]', { timeout: 10000 });

    // Step 9: Verify the updated name appears in the users list
    await expect(page.locator(`text=${updatedName}`)).toBeVisible({ timeout: 5000 });
  });

  test('should handle vendor/client field mapping correctly', async ({ page }) => {
    test.skip(process.env.NODE_ENV !== 'test', 'Requires authentication setup');

    // This test verifies that both 'name' and 'contact_name' fields are updated
    // for vendors and clients, ensuring the users list displays the correct name

    await page.goto('/admin/users');
    await page.waitForSelector('[data-testid="users-table"]');

    // Find a vendor to edit
    const vendorRow = page.locator('[data-type="vendor"]').first();
    const editButton = vendorRow.locator('button:has-text("Edit")');
    await editButton.click();

    await page.waitForSelector('[data-testid="user-edit-form"]');

    // Get the current name for comparison
    const displayNameField = page.locator('input[name="displayName"]');
    const originalName = await displayNameField.inputValue();
    const testName = `${originalName} - Field Mapping Test`;

    // Update the name
    await displayNameField.fill('');
    await displayNameField.fill(testName);

    // Save changes
    await page.locator('button:has-text("Save")').click();
    await expect(page.locator('.toast-success')).toBeVisible();

    // Navigate back to users list
    await page.goto('/admin/users');
    await page.waitForSelector('[data-testid="users-table"]');

    // Verify the name appears correctly (this tests that the 'name' field was updated)
    await expect(page.locator(`text=${testName}`)).toBeVisible();
  });

  test('should not redirect after save - stay on form', async ({ page }) => {
    test.skip(process.env.NODE_ENV !== 'test', 'Requires authentication setup');

    await page.goto('/admin/users');
    await page.waitForSelector('[data-testid="users-table"]');

    // Navigate to edit form
    const editButton = page.locator('button:has-text("Edit")').first();
    const editUrl = await editButton.getAttribute('href') || 
                   await editButton.click().then(() => page.url());
    
    if (typeof editUrl === 'string') {
      await page.goto(editUrl);
    }

    await page.waitForSelector('[data-testid="user-edit-form"]');

    // Make a small change
    const displayNameField = page.locator('input[name="displayName"]');
    const currentName = await displayNameField.inputValue();
    await displayNameField.fill(`${currentName} - Stay Test`);

    // Save the form
    await page.locator('button:has-text("Save")').click();

    // Wait for success message
    await expect(page.locator('.toast-success')).toBeVisible();

    // Verify we stayed on the same page (no redirect to users list)
    await expect(page).toHaveURL(/\/admin\/users\/edit\/.+/);
    
    // Verify the form is still interactive (not redirected)
    await expect(displayNameField).toBeEnabled();
    await expect(page.locator('button:has-text("Save")')).toBeEnabled();
  });

  test('should show success toast without redirect', async ({ page }) => {
    test.skip(process.env.NODE_ENV !== 'test', 'Requires authentication setup');

    await page.goto('/admin/users');
    await page.waitForSelector('[data-testid="users-table"]');

    // Navigate to edit a user
    const editButton = page.locator('button:has-text("Edit")').first();
    await editButton.click();

    await page.waitForSelector('[data-testid="user-edit-form"]');

    // Make a change and save
    const displayNameField = page.locator('input[name="displayName"]');
    const originalName = await displayNameField.inputValue();
    await displayNameField.fill(`${originalName} - Toast Test`);
    
    await page.locator('button:has-text("Save")').click();

    // Verify success toast appears
    const successToast = page.locator('.toast-success');
    await expect(successToast).toBeVisible({ timeout: 5000 });
    await expect(successToast).toContainText('User saved successfully');

    // Verify toast disappears after some time but we stay on page
    await expect(successToast).toBeHidden({ timeout: 6000 });
    await expect(page).toHaveURL(/\/admin\/users\/edit\/.+/);
  });
});

// Helper test to verify test data setup (run this first)
test.describe('Test Setup Verification', () => {
  test('should have test users available', async ({ page }) => {
    test.skip(process.env.NODE_ENV !== 'test', 'Requires authentication setup');

    await page.goto('/admin/users');
    
    // Verify the users table loads
    await expect(page.locator('[data-testid="users-table"]')).toBeVisible({ timeout: 10000 });
    
    // Verify we have at least one vendor for testing
    const vendorRows = page.locator('[data-type="vendor"]');
    await expect(vendorRows.first()).toBeVisible();
    
    // Verify edit buttons are present
    const editButtons = page.locator('button:has-text("Edit")');
    await expect(editButtons.first()).toBeVisible();
  });
});
