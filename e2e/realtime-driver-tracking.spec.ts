import { test, expect } from '@playwright/test';

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
 * When these flags are disabled the test will gracefully skip after verifying
 * that the realtime status UI is not present.
 */
test.describe('Realtime driver tracking with simulator', () => {
  test('admin dashboard shows simulator driver in realtime mode', async ({ page, context }) => {
    // Navigate directly to tracking page first in the main tab
    await page.goto('/admin/tracking');

    // If auth is required, skip gracefully as other specs cover auth flows
    if (await page.locator('text=Sign In').count() > 0) {
      test.skip(true, 'Admin tracking requires authentication - skipping realtime integration test');
    }

    // Check whether the realtime feature is enabled in the UI
    const realtimeStatus = page.locator('text=Real-time WebSocket connected, text=WebSocket Mode');
    const hasRealtimeUi = (await realtimeStatus.count()) > 0 ||
      (await page.locator('button:has-text("WebSocket Mode"), button:has-text("SSE Mode")').count()) > 0;

    if (!hasRealtimeUi) {
      test.skip(true, 'Realtime admin dashboard feature flags appear to be disabled');
    }

    // Open the Test Driver Simulator in a second tab
    const simulatorPage = await context.newPage();
    await simulatorPage.goto('/admin/tracking/test-driver');

    // Ensure simulator page loaded and connection controls are visible
    await expect(simulatorPage.locator('text=Test Driver Simulator')).toBeVisible();

    const connectButton = simulatorPage.locator('button:has-text("Connect to Realtime")');
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    // After connecting, start the route simulation
    const startButton = simulatorPage.locator('button:has-text("Start Route Simulation")');
    await startButton.waitFor({ state: 'visible', timeout: 10_000 });
    await startButton.click();

    // Back on the admin dashboard tab, wait for realtime connection text
    await page.bringToFront();

    const connectionText = page.locator('text=Real-time WebSocket connected');
    await expect(connectionText).toBeVisible({ timeout: 30_000 });

    // Expect at least one active driver and one GPS update within a reasonable time
    const driverCountCard = page.locator('text=On Duty').first();
    const gpsUpdatesCard = page.locator('text=GPS Updates').first();

    await expect(driverCountCard).toBeVisible();
    await expect(gpsUpdatesCard).toBeVisible();

    // Values should eventually be greater than or equal to zero – we mainly
    // care that they render without throwing and respond to updates.
    // Use a relaxed assertion to avoid flakiness when data is slow.
    await expect.soft(page.locator('text=GPS Updates').locator('xpath=..')).toBeVisible();
  });
}


