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
  /* CI serves a production build, so 4 workers (one per runner vCPU) fit.
   * Specs that mutate shared account state run in order via
   * test.describe.configure({ mode: 'default' }). */
  workers: process.env.CI ? 4 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters
   * CI writes html + json so a report exists even when the run is cut short
   * by globalTimeout. The JSON goes to test-results/ because the html
   * reporter owns and clears playwright-report/. */
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }],
      ]
    : 'html',
  /* CI only: stop the whole run gracefully before the job's timeout-minutes
   * kills it, so reporters still flush. Keep below the CI job limit. */
  globalTimeout: process.env.CI ? 25 * 60 * 1000 : undefined,
  /**
   * Global setup for authentication - runs once before all tests
   *
   * SECURITY: This setup generates authentication files in e2e/.auth/
   * These files contain session tokens and MUST NEVER be committed to version control.
   *
   * Protected by:
   * - .gitignore includes /e2e/.auth/
   * - CI does not cache .auth files
   * - CI artifacts exclude .auth files
   *
   * For more information, see e2e/README.md Security section
   */
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

  /* CI serves the production build made by the "Build application" step
   * (`next start`, port 3000) so pages are not compiled on demand; locally we
   * keep the dev server. */
  webServer: {
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes for Next.js to start
  },
});
