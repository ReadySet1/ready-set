import { test, expect } from '@playwright/test';

// Helper: Log in as a test user
async function login(page, email = 'test@example.com', password = 'password') {
  await page.goto('/sign-in');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/client');
}

test.describe('Order Status Page', () => {
  test('displays correct order number and delivery date', async ({ page }) => {
    await login(page);

    await page.goto('/client/orders'); // Adjust path as needed

    await expect(page.getByText('Order Number')).toBeVisible();
    await expect(page.getByText('Delivery Date')).toBeVisible();

    // Check for at least one order row (adjust selectors as needed)
    const orderNumberCell = page.locator('td', { hasText: 'ORD-' });
    await expect(orderNumberCell).toBeVisible();

    // Check for formatted delivery date (e.g., 'Jun 20, 2025')
    const deliveryDateCell = page.locator('td', { hasText: /[A-Z][a-z]{2} \d{1,2}, 20\d{2}/ });
    await expect(deliveryDateCell).toBeVisible();
  });

  test('shows N/A for missing order number or delivery date', async ({ page }) => {
    await login(page);

    await page.goto('/client/orders');
    await expect(page.getByText('N/A')).toBeVisible();
  });
});

test.describe('Header Authentication Display', () => {
  test('shows user name and sign out when logged in', async ({ page }) => {
    await login(page);

    await page.goto('/');
    await expect(page.getByRole('link', { name: /test user/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  test('shows sign in/up when logged out', async ({ page }) => {
    await page.goto('/');
    if (await page.getByRole('button', { name: /sign out/i }).isVisible()) {
      await page.click('button:has-text("Sign Out")');
      await page.waitForURL('/');
    }
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
  });

  test('persists authentication after refresh', async ({ page }) => {
    await login(page);

    await page.goto('/');
    await expect(page.getByRole('link', { name: /test user/i })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('link', { name: /test user/i })).toBeVisible();
  });
}); 