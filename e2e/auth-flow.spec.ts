import { test, expect, Page } from '@playwright/test';

/**
 * Signed-out auth UI: header entry points, the sign-in form (password and
 * magic link), and navigation to sign-up. No credentials are used here.
 *
 * The home page ("/") renders its own hero with no site header (see
 * ClientLayout), so header checks start from a regular content page.
 */
const PAGE_WITH_HEADER = '/about';

const header = (page: Page) => page.getByRole('banner');
const main = (page: Page) => page.getByRole('main');
const passwordForm = (page: Page) =>
  main(page).locator('form').filter({ has: page.getByPlaceholder('Password') });
const magicLinkForm = (page: Page) =>
  main(page).locator('form').filter({ has: page.getByPlaceholder('Your email address') });

/** The browser's native constraint-validation message for an input ('' when valid). */
const validationMessage = (page: Page, placeholder: string) =>
  main(page).getByPlaceholder(placeholder, { exact: true }).evaluate(
    (el) => (el as HTMLInputElement).validationMessage,
  );

test.describe('Authentication Flow', () => {
  test('complete authentication flow - sign in and header update', async ({ page }) => {
    await page.goto(PAGE_WITH_HEADER);

    // Navigate to sign in page from the header
    await header(page).getByRole('link', { name: 'Sign In', exact: true }).click();

    // Verify we're on the sign-in page
    await expect(page).toHaveURL(/.*sign-in/);
    await expect(main(page).getByRole('heading', { name: 'Sign in with', exact: true })).toBeVisible();

    // Email/password form visibility
    await expect(main(page).getByPlaceholder('Email', { exact: true })).toBeVisible();
    await expect(main(page).getByPlaceholder('Password', { exact: true })).toBeVisible();
    await expect(main(page).getByRole('link', { name: 'Sign up', exact: true })).toBeVisible();

    // Magic link toggle
    await main(page).getByRole('button', { name: 'Magic Link', exact: true }).click();
    await expect(main(page).getByRole('button', { name: 'Send Magic Link' })).toBeVisible();
    await expect(main(page).getByPlaceholder('Password', { exact: true })).not.toBeVisible();

    // Switch back to password login
    await main(page).getByRole('button', { name: 'Email & Password' }).click();
    await expect(main(page).getByPlaceholder('Password', { exact: true })).toBeVisible();

    // The password form relies on native constraint validation (required +
    // type=email), so an empty submit is blocked by the browser.
    const submit = main(page).getByRole('button', { name: 'Sign in', exact: true });
    await submit.click();
    await expect(page).toHaveURL(/.*sign-in/);
    expect(await validationMessage(page, 'Email')).not.toBe('');

    // Valid email but missing password: the password field blocks the submit
    await main(page).getByPlaceholder('Email', { exact: true }).fill('test@example.com');
    await submit.click();
    await expect(page).toHaveURL(/.*sign-in/);
    expect(await validationMessage(page, 'Email')).toBe('');
    expect(await validationMessage(page, 'Password')).not.toBe('');
  });

  test('header updates correctly based on authentication state', async ({ page }) => {
    await page.goto(PAGE_WITH_HEADER);

    // Logged out state
    await expect(header(page).getByRole('link', { name: 'Sign In', exact: true })).toBeVisible();
    await expect(header(page).getByRole('link', { name: 'Sign Up', exact: true })).toBeVisible();
    await expect(header(page).getByRole('button', { name: 'Sign Out' })).toHaveCount(0);

    // Navigate to sign-in page
    await header(page).getByRole('link', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/.*sign-in/);

    // Sign-in form components
    await expect(main(page).getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
    await expect(main(page).getByText("Don't have an account?")).toBeVisible();
    await expect(main(page).getByRole('link', { name: 'Sign up', exact: true })).toBeVisible();
  });

  test('returnTo URL functionality', async ({ page }) => {
    await page.goto('/sign-in?returnTo=/dashboard');

    // The returnTo parameter is preserved (encoded or not)
    await expect(page).toHaveURL(/returnTo=(%2F|\/)dashboard/);

    // Magic link form accepts an email with returnTo in place
    await main(page).getByRole('button', { name: 'Magic Link', exact: true }).click();
    const magicEmail = main(page).getByPlaceholder('Your email address');
    await magicEmail.fill('test@example.com');
    await expect(magicEmail).toHaveValue('test@example.com');
    await expect(page).toHaveURL(/returnTo=(%2F|\/)dashboard/);
  });

  test('sign up flow navigation', async ({ page }) => {
    await page.goto(PAGE_WITH_HEADER);

    // Navigate to sign up from the sign in page
    await header(page).getByRole('link', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/.*sign-in/);
    await main(page).getByRole('link', { name: 'Sign up', exact: true }).click();

    // Verify we're on the sign-up page
    await expect(page).toHaveURL(/.*sign-up/, { timeout: 15000 });
    await expect(main(page).getByText('Get started with Ready Set')).toBeVisible();

    // User type selection
    const vendorButton = main(page).getByRole('button', { name: /^vendor$/i });
    await expect(vendorButton).toBeVisible();
    await expect(main(page).getByRole('button', { name: /^client$/i })).toBeVisible();

    // Google sign-up option for vendors
    await vendorButton.click();
    await expect(main(page).getByText('Quick sign up')).toBeVisible();
    await expect(main(page).getByRole('button', { name: 'Sign up with Google' })).toBeVisible();
  });

  test('responsive design - mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(PAGE_WITH_HEADER);

    // Mobile header toggle
    const toggle = page.getByRole('button', { name: 'Mobile Menu' });
    await expect(toggle).toBeVisible();

    // Open mobile menu: the auth links live there on mobile. `goto` resolves on
    // `load`, which can fire before React hydrates the toggle, so a single early
    // click is a no-op. Retry the click until the menu actually opens.
    const signIn = page.getByRole('link', { name: 'Sign In', exact: true });
    await expect(async () => {
      if (!(await signIn.isVisible())) await toggle.click();
      await expect(signIn).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await expect(page.getByRole('link', { name: 'Sign Up', exact: true })).toBeVisible();
  });

  test('error handling and validation', async ({ page }) => {
    await page.goto('/sign-in');

    // Invalid email format on the password form: blocked by native validation
    await main(page).getByPlaceholder('Email', { exact: true }).fill('invalid-email');
    await main(page).getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/.*sign-in/);
    expect(await validationMessage(page, 'Email')).not.toBe('');

    // Magic link with invalid email (form is noValidate, so the app validates)
    await main(page).getByRole('button', { name: 'Magic Link', exact: true }).click();
    const magicEmail = main(page).getByPlaceholder('Your email address');
    const sendMagicLink = main(page).getByRole('button', { name: 'Send Magic Link' });
    await magicEmail.fill('invalid-email');
    await sendMagicLink.click();
    await expect(magicLinkForm(page).getByText('Please enter a valid email')).toBeVisible();

    // Empty email for magic link
    await magicEmail.fill('');
    await sendMagicLink.click();
    await expect(magicLinkForm(page).getByText('Email is required')).toBeVisible();
  });

  test('accessibility features', async ({ page }) => {
    await page.goto('/sign-in');

    // Keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // ARIA label on the mobile menu toggle (only rendered visibly below lg)
    await expect(page.locator('[aria-label="Mobile Menu"]')).toHaveCount(1);

    // Form structure
    const email = passwordForm(page).locator('input[type="email"]');
    const password = passwordForm(page).locator('input[type="password"]');
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();

    // Required fields are marked as required
    await expect(email).toHaveAttribute('required', '');
    await expect(password).toHaveAttribute('required', '');
  });
});
