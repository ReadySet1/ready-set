import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only - reduced from 2 to 1 to save time */
  retries: process.env.CI ? 1 : 0,
  /* Optimize workers for CI - increased from 1 to 2 for better performance */
  workers: process.env.CI ? 2 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Global setup for authentication - runs once before all tests */
  globalSetup: require.resolve('./e2e/auth/setup'),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot when a test fails */
    screenshot: 'only-on-failure',

    /* Record video when a test fails */
    video: 'retain-on-failure',

    /* Reduce default timeout from 30s to 15s */
    actionTimeout: 15000,
    navigationTimeout: 15000,
  },

  /* Configure projects for major browsers */
  projects: [
    // Always run Chromium (fastest and most reliable)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Only run additional browsers locally (not in CI)
    ...(process.env.CI
      ? []
      : [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
          /* Test against mobile viewports locally */
          {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
          },
          {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 12'] },
          },
        ]),
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes for Next.js to start
  },
});
