import { test, expect } from '@playwright/test';
import { authStatePath, hasAuthState, missingAuthReason } from './fixtures/auth-state';

/**
 * Realtime Driver Tracking Flow
 *
 * This spec exercises the admin driver tracking dashboard together with the
 * Test Driver Simulator. It assumes the following feature flags are enabled:
 *
 * - NEXT_PUBLIC_FF_USE_REALTIME_TRACKING=true
 * - NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES=true
 * - NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD=true
 *
 * When the admin-dashboard flag is off in the build, the WebSocket/SSE mode
 * toggle is not rendered and the test skips with that reason.
 */
test.use({ storageState: authStatePath('admin') });

test.describe('Realtime driver tracking with simulator', () => {
  test('admin dashboard shows simulator driver in realtime mode', async ({ page, context }) => {
    test.skip(!hasAuthState('admin'), missingAuthReason('admin'));

    await page.goto('/admin/tracking');
    await expect(page, 'admin session was rejected (redirected away)').toHaveURL(/\/admin\/tracking/);

    // The dashboard has mounted once its connection indicator renders; only
    // then is the absence of the mode toggle meaningful.
    await expect(
      page.getByText(/^(Live Data|Disconnected|SSE Fallback|Connecting\.\.\.)$/).first()
    ).toBeVisible({ timeout: 15000 });

    // The mode toggle renders only when the realtime admin-dashboard flag is on.
    const modeToggle = page.getByRole('button', { name: /^(WebSocket|SSE) Mode$/ });
    test.skip(
      (await modeToggle.count()) === 0,
      'NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD is off in this build'
    );

    // Open the Test Driver Simulator in a second tab
    const simulatorPage = await context.newPage();
    await simulatorPage.goto('/admin/tracking/test-driver');

    await expect(simulatorPage.getByText('Test Driver Simulator').first()).toBeVisible();

    const connectButton = simulatorPage.getByRole('button', { name: 'Connect to Realtime' });
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    // After connecting, start the route simulation
    const startButton = simulatorPage.getByRole('button', { name: 'Start Route Simulation' });
    await expect(startButton).toBeVisible({ timeout: 10_000 });
    await startButton.click();

    // Back on the admin dashboard tab, wait for the realtime connection text
    await page.bringToFront();
    await expect(page.getByText('WebSocket connected', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByText('On Duty', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('GPS Updates', { exact: true })).toBeVisible();
  });
});
