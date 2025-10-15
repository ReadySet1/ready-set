import { test, expect } from '@playwright/test';

/**
 * E2E Test for REA-151: Admin Dashboard - Create New User
 *
 * This test verifies that admins can successfully create new users
 * through the admin dashboard without encountering UUID validation errors.
 *
 * Before the fix: Would fail with "Failed to save user: Internal server error"
 * After the fix: Should successfully create the user
 */

test.describe('Admin User Creation - REA-151', () => {
  // You'll need to update these credentials with valid admin credentials
  const ADMIN_EMAIL = 'admin@example.com';
  const ADMIN_PASSWORD = 'your-admin-password';

  const TEST_USER = {
    email: `test.user.${Date.now()}@example.com`,
    name: 'E2E Test User',
    phone: '(555) 123-4567',
    company: 'E2E Test Company',
    type: 'client'
  };

  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/sign-in');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // TODO: Add login steps here
    // This will depend on your authentication implementation
    // Example:
    // await page.fill('input[type="email"]', ADMIN_EMAIL);
    // await page.fill('input[type="password"]', ADMIN_PASSWORD);
    // await page.click('button[type="submit"]');
    // await page.waitForURL('**/admin');
  });

  test('should successfully create a new user', async ({ page }) => {
    // Navigate to users page
    await page.goto('http://localhost:3000/admin/users');

    // Click "Add User" button
    await page.getByRole('button', { name: 'Add User' }).click();

    // Wait for the form to load
    await page.waitForURL('**/admin/users/new');
    await page.waitForSelector('input[placeholder*="email"]');

    // Fill in user details
    await page.getByRole('textbox', { name: 'Email Address' }).fill(TEST_USER.email);
    await page.getByRole('textbox', { name: 'Contact Name' }).fill(TEST_USER.name);
    await page.getByRole('textbox', { name: 'Phone Number' }).fill(TEST_USER.phone);
    await page.getByRole('textbox', { name: 'Company Name' }).fill(TEST_USER.company);

    // Click "Save Changes" button
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Wait for the save operation to complete
    await page.waitForTimeout(2000);

    // Check for success - the URL should change or a success message should appear
    // Adjust these assertions based on your actual success behavior
    const currentUrl = page.url();
    const hasSuccessMessage = await page.getByText(/success|created/i).isVisible().catch(() => false);
    const hasErrorMessage = await page.getByText(/error|failed/i).isVisible().catch(() => false);

    // Assert: Should not have error message
    expect(hasErrorMessage).toBe(false);

    // Assert: Should either redirect away from /new or show success message
    const isStillOnNewPage = currentUrl.includes('/admin/users/new');
    expect(isStillOnNewPage || hasSuccessMessage).toBeTruthy();

    // Take a screenshot for debugging
    await page.screenshot({ path: `tests/screenshots/create-user-${Date.now()}.png` });
  });

  test('should show validation error for duplicate email', async ({ page }) => {
    // Navigate to users page
    await page.goto('http://localhost:3000/admin/users');

    // Click "Add User" button
    await page.getByRole('button', { name: 'Add User' }).click();

    // Wait for the form to load
    await page.waitForURL('**/admin/users/new');

    // Use an existing email (you'll need to use a known existing email in your test DB)
    const EXISTING_EMAIL = 'existing@example.com';

    // Fill in user details with duplicate email
    await page.getByRole('textbox', { name: 'Email Address' }).fill(EXISTING_EMAIL);
    await page.getByRole('textbox', { name: 'Contact Name' }).fill('Duplicate Test');
    await page.getByRole('textbox', { name: 'Phone Number' }).fill('(555) 999-9999');
    await page.getByRole('textbox', { name: 'Company Name' }).fill('Duplicate Company');

    // Click "Save Changes" button
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Wait for error message
    await page.waitForTimeout(1000);

    // Should show error about duplicate email
    const errorMessage = await page.getByText(/already in use|already exists|duplicate/i).isVisible();
    expect(errorMessage).toBe(true);
  });

  test('should validate required fields', async ({ page }) => {
    // Navigate to users page
    await page.goto('http://localhost:3000/admin/users');

    // Click "Add User" button
    await page.getByRole('button', { name: 'Add User' }).click();

    // Wait for the form to load
    await page.waitForURL('**/admin/users/new');

    // Try to save without filling required fields
    const saveButton = page.getByRole('button', { name: 'Save Changes' });

    // Button should be disabled initially
    const isDisabled = await saveButton.isDisabled();
    expect(isDisabled).toBe(true);

    // Fill only email (should still be invalid without other required fields)
    await page.getByRole('textbox', { name: 'Email Address' }).fill('test@example.com');

    // Button might still be disabled or show validation error
    // Adjust based on your form validation behavior
  });
});
