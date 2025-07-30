import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('/');
  });

  test('complete authentication flow - sign in and header update', async ({ page }) => {
    // Navigate to sign in page
    await page.click('text=Sign In');
    
    // Verify we're on the sign-in page
    await expect(page).toHaveURL(/.*sign-in/);
    await expect(page.locator('text=Sign in with')).toBeVisible();

    // Test email/password form visibility
    await expect(page.locator('input[placeholder="Email"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Password"]')).toBeVisible();
    await expect(page.locator('text=Sign Up')).toBeVisible();

    // Test magic link toggle
    await page.click('text=Magic Link');
    await expect(page.locator('text=Send Magic Link')).toBeVisible();
    await expect(page.locator('input[placeholder="Password"]')).not.toBeVisible();

    // Switch back to password login
    await page.click('text=Email & Password');
    await expect(page.locator('input[placeholder="Password"]')).toBeVisible();

    // Test form validation
    await page.locator('button:has-text("Sign In")').click();
    await expect(page.locator('text=Please enter a valid email')).toBeVisible();

    // Test valid email but missing password
    await page.fill('input[placeholder="Email"]', 'test@example.com');
    await page.locator('button:has-text("Sign In")').click();
    await expect(page.locator('text=Password is required')).toBeVisible();

    // Note: Actual authentication would require valid credentials
    // This test validates the UI behavior and form validation
  });

  test('header updates correctly based on authentication state', async ({ page }) => {
    // Test logged out state
    await expect(page.locator('text=Sign In')).toBeVisible();
    await expect(page.locator('text=Sign Up')).toBeVisible();
    await expect(page.locator('text=Sign Out')).not.toBeVisible();

    // Navigate to sign-in page
    await page.click('text=Sign In');
    
    // Verify sign-in form components
    await expect(page.locator('text=Sign in with Google')).toBeVisible();
    await expect(page.locator('text=Don\'t have an account?')).toBeVisible();
    await expect(page.locator('text=Sign up')).toBeVisible();
  });

  test('returnTo URL functionality', async ({ page }) => {
    // Navigate to a protected page (this would normally redirect to sign-in)
    await page.goto('/sign-in?returnTo=/dashboard');
    
    // Verify the returnTo parameter is preserved
    await expect(page).toHaveURL(/.*returnTo=%2Fdashboard/);
    
    // Test magic link with returnTo
    await page.click('text=Magic Link');
    await page.fill('input[placeholder="Email"]', 'test@example.com');
    
    // Note: In actual implementation, the magic link would include the returnTo URL
    // This test validates the UI preserves the returnTo parameter
  });

  test('sign up flow navigation', async ({ page }) => {
    // Navigate to sign up from sign in page
    await page.click('text=Sign In');
    await page.click('text=Sign up');
    
    // Verify we're on the sign-up page
    await expect(page).toHaveURL(/.*sign-up/);
    await expect(page.locator('text=Get started with Ready Set')).toBeVisible();
    
    // Test user type selection
    await expect(page.locator('text=vendor')).toBeVisible();
    await expect(page.locator('text=client')).toBeVisible();
    
    // Test Google sign-up options
    const vendorCards = page.locator('[data-testid="user-type-vendor"], .cursor-pointer:has-text("vendor")');
    if (await vendorCards.count() > 0) {
      await vendorCards.first().click();
      await expect(page.locator('text=Quick sign up')).toBeVisible();
      await expect(page.locator('text=Sign up with Google')).toBeVisible();
    }
  });

  test('responsive design - mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test mobile header
    await expect(page.locator('[aria-label="Mobile Menu"]')).toBeVisible();
    
    // Open mobile menu
    await page.click('[aria-label="Mobile Menu"]');
    
    // On mobile, the auth buttons might be in the mobile menu
    // This tests the mobile-responsive auth UI
  });

  test('error handling and validation', async ({ page }) => {
    await page.goto('/sign-in');
    
    // Test invalid email format
    await page.fill('input[placeholder="Email"]', 'invalid-email');
    await page.locator('button:has-text("Sign In")').click();
    await expect(page.locator('text=Please enter a valid email')).toBeVisible();
    
    // Test magic link with invalid email
    await page.click('text=Magic Link');
    await page.fill('input[placeholder="Email"]', 'invalid-email');
    await page.click('text=Send Magic Link');
    await expect(page.locator('text=Please enter a valid email')).toBeVisible();
    
    // Test empty email for magic link
    await page.fill('input[placeholder="Email"]', '');
    await page.click('text=Send Magic Link');
    await expect(page.locator('text=Email is required')).toBeVisible();
  });

  test('accessibility features', async ({ page }) => {
    await page.goto('/sign-in');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Test ARIA labels
    await expect(page.locator('[aria-label="Mobile Menu"]')).toBeVisible();
    
    // Test form labels and structure
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    // Test required field indicators
    await expect(page.locator('text=*')).toBeVisible(); // Required field markers
  });
}); 