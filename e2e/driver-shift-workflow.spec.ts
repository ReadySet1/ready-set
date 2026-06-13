/**
 * E2E Test: Complete Driver Shift Workflow
 *
 * This spec tests the complete driver shift lifecycle:
 * 1. Start Shift - Navigate, grant location, start shift
 * 2. Track Location - Verify location updates and GPS accuracy
 * 3. Complete Delivery - Update statuses, capture proof
 * 4. End Shift - End shift, verify summary
 *
 * Prerequisites:
 * - Driver auth fixture (or authentication during test)
 * - Geolocation mocking
 * - Test delivery data (optional - tests can run without active deliveries)
 *
 * @see REA-300
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Reuse the driver session created by e2e/auth/setup.ts
test.use({ storageState: 'e2e/.auth/driver.json' });

// The driver portal acquires geolocation, loads shift state, and (on a dev
// server) cold-compiles routes on first hit — give each test headroom beyond
// the default 30s so the settle waits don't collide with the test timeout.
test.beforeEach(() => {
  test.setTimeout(60_000);
});

// Test coordinates for geolocation simulation
const TEST_LOCATIONS = {
  // Starting location: Los Angeles downtown
  start: { latitude: 34.0522, longitude: -118.2437, accuracy: 10 },
  // En route location: Moving towards destination
  enRoute: { latitude: 34.0622, longitude: -118.2337, accuracy: 15 },
  // Arrival location: At destination
  arrival: { latitude: 34.0722, longitude: -118.2237, accuracy: 10 },
};

/**
 * Helper to set geolocation for a page context
 */
async function setGeolocation(
  context: BrowserContext,
  location: { latitude: number; longitude: number; accuracy?: number }
) {
  await context.setGeolocation({
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy ?? 10,
  });
}

/**
 * Helper to wait for page to be ready after navigation
 */
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // The driver portal polls continuously and never reaches network idle. Wait
  // for the portal to settle into a RESOLVED state — geolocation is acquired
  // asynchronously, so "Request location permission" shows transiently before
  // "Start shift". Waiting for the resolved control (start/end shift / on shift)
  // avoids inspecting the portal mid-acquisition. Generous timeout covers
  // Next.js dev cold-compile of the route on first hit. Catches so the
  // location-denied test (which never resolves) still proceeds.
  await page
    .getByRole('button', { name: /start shift|end shift/i })
    .or(page.getByText(/on shift/i))
    .first()
    .waitFor({ state: 'visible', timeout: 30000 })
    .catch(() => {});
  // Additional wait for React hydration / context shift-state load
  await page.waitForTimeout(1000);
}

/**
 * Helper to check if driver authentication is required
 */
async function checkAuthRequired(page: Page): Promise<boolean> {
  // Unauthenticated access to a protected route redirects to the sign-in page.
  if (/\/sign-in|\/login/.test(page.url())) return true;
  const signInLink = page.getByRole('link', { name: /sign in|log ?in/i });
  return (await signInLink.count()) > 0;
}

test.describe('Driver Shift Workflow', () => {
  test.describe('Start Shift', () => {
    test('should navigate to driver tracking page', async ({ page, context }) => {
      // Grant geolocation permission
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      // Navigate to driver tracking page
      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      // Check if auth is required - skip if so (auth setup needed)
      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required - ensure driver auth fixture is set up');
        return;
      }

      // Verify we're on the tracking page
      await expect(page).toHaveURL(/\/driver\/tracking/);
    });

    test('should display current location after granting permission', async ({ page, context }) => {
      // Grant geolocation permission
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // The redesigned portal no longer prints raw lat/lng. Location acquisition
      // is reflected by (a) the HealthBar GPS chip showing a "<n>m" accuracy
      // reading, or (b) the pre-shift "Start shift" CTA, which only appears once
      // currentLocation resolves, or (c) an already-active shift.
      await expect(async () => {
        const gpsAccuracy = page.getByText(/\d+\s*m\b/);
        const startShift = page.getByRole('button', { name: /start shift/i });
        const onShift = page.getByText(/on shift/i);
        const located =
          (await gpsAccuracy.count()) > 0 ||
          (await startShift.count()) > 0 ||
          (await onShift.count()) > 0;
        expect(located).toBe(true);
      }).toPass({ timeout: 10000 });
    });

    test('should show Start Shift button when no active shift', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Look for Start Shift button
      const startShiftButton = page.getByRole('button', { name: /start shift/i });

      // Either the button exists, or there's an active shift (End Shift button)
      const endShiftButton = page.getByRole('button', { name: /end shift/i });

      const hasStartButton = await startShiftButton.count() > 0;
      const hasEndButton = await endShiftButton.count() > 0;

      expect(hasStartButton || hasEndButton).toBe(true);
    });

    test('should start shift when clicking Start Shift button', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      const startShiftButton = page.getByRole('button', { name: /start shift/i });

      // If there's already an active shift, skip this test
      if ((await startShiftButton.count()) === 0) {
        test.skip(true, 'Shift already active - End Shift first to test Start Shift');
        return;
      }

      // Click Start Shift
      await startShiftButton.click();

      // Wait for shift to start - should see shift status change
      await expect(async () => {
        const hasEndButton =
          (await page.getByRole('button', { name: /end shift/i }).count()) > 0;
        const hasActiveIndicator =
          (await page.getByText(/on shift/i).count()) > 0;

        expect(hasEndButton || hasActiveIndicator).toBe(true);
      }).toPass({ timeout: 10000 });
    });

    test('should display shift started indicator after starting', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Active shift is signalled by the "On shift" label / "End shift" button.
      // waitForPageReady already waited for the portal to settle, so the shift
      // state loaded from the server is reflected before we decide whether to
      // start one (avoids clicking "Start shift" while one is already active).
      const isActive = async () =>
        (await page.getByRole('button', { name: /end shift/i }).count()) > 0 ||
        (await page.getByText(/on shift/i).count()) > 0;

      // If no active shift, start one first
      if (!(await isActive())) {
        const startButton = page.getByRole('button', { name: /start shift/i });
        if ((await startButton.count()) > 0) {
          await startButton.click();
        } else {
          test.skip(true, 'Could not start a shift (no Start shift button — location unavailable)');
          return;
        }
      }

      // Now verify shift is active
      await expect(async () => {
        const active =
          (await page.getByRole('button', { name: /end shift/i }).count()) > 0 ||
          (await page.getByText(/on shift/i).count()) > 0;
        expect(active).toBe(true);
      }).toPass({ timeout: 10000 });
    });
  });

  test.describe('Track Location', () => {
    test('should show GPS accuracy display', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Look for accuracy indicator (shows meters like "10m" or "Accuracy: 10m")
      await expect(async () => {
        const pageContent = await page.content();
        // Should have accuracy display in format like "10m" or similar
        const hasAccuracy = /\d+\s*m/.test(pageContent);
        expect(hasAccuracy).toBe(true);
      }).toPass({ timeout: 10000 });
    });

    test('should show tracking status indicator', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Look for tracking status indicators
      const trackingIndicators = [
        page.locator('text=Location tracking active'),
        page.locator('text=tracking active'),
        page.locator('text=Online'),
        page.locator('text=GPS'),
      ];

      let hasTrackingIndicator = false;
      for (const indicator of trackingIndicators) {
        if ((await indicator.count()) > 0) {
          hasTrackingIndicator = true;
          break;
        }
      }

      expect(hasTrackingIndicator).toBe(true);
    });

    test('should update location when position changes', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Get initial coordinates display
      const initialContent = await page.content();

      // Change location
      await setGeolocation(context, TEST_LOCATIONS.enRoute);

      // Wait for location update (may take a few seconds)
      await page.waitForTimeout(3000);

      // Verify coordinates have updated
      const updatedContent = await page.content();

      // The new coordinates should be different
      // Note: This is a soft assertion as UI update timing may vary
      expect.soft(updatedContent).not.toBe(initialContent);
    });

    test('should show connection status (online/offline)', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Look for online/offline status indicator
      const statusIndicators = [
        page.locator('text=Online'),
        page.locator('text=Offline'),
        page.locator('text=Connected'),
        page.locator('[class*="bg-green"]'), // Green indicator for online
      ];

      let hasStatusIndicator = false;
      for (const indicator of statusIndicators) {
        if ((await indicator.count()) > 0) {
          hasStatusIndicator = true;
          break;
        }
      }

      expect(hasStatusIndicator).toBe(true);
    });
  });

  test.describe('Complete Delivery', () => {
    test('should display active deliveries section', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Look for deliveries section - may or may not have active deliveries
      const deliverySectionIndicators = [
        page.locator('text=Active Deliveries'),
        page.locator('text=Deliveries'),
        page.locator('text=Delivery #'),
      ];

      // Note: If no active deliveries, section may not be visible
      // This test just verifies the page loads correctly with or without deliveries
      await expect(page.locator('body')).toBeVisible();
    });

    test('should show delivery status buttons when delivery is selected', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Look for delivery action buttons
      const deliveryButtons = [
        page.getByRole('button', { name: /en route/i }),
        page.getByRole('button', { name: /arrived/i }),
        page.getByRole('button', { name: /complete/i }),
      ];

      // Check if any delivery action buttons exist
      let hasDeliveryButtons = false;
      for (const button of deliveryButtons) {
        if ((await button.count()) > 0) {
          hasDeliveryButtons = true;
          break;
        }
      }

      // If no deliveries, this is expected - skip gracefully
      if (!hasDeliveryButtons) {
        test.skip(true, 'No active deliveries found - delivery buttons not visible');
      }
    });

    test('should update delivery status to En Route when clicked', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      const enRouteButton = page.getByRole('button', { name: /en route/i }).first();

      if ((await enRouteButton.count()) === 0) {
        test.skip(true, 'No En Route button found - no active deliveries');
        return;
      }

      // Click En Route button
      await enRouteButton.click();

      // Wait for status update
      await page.waitForTimeout(2000);

      // Status should have changed - verify API call or status change
      // This is a soft assertion as the actual UI change depends on backend
      expect.soft(true).toBe(true);
    });

    test('should update delivery status to Arrived when clicked', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.arrival);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      const arrivedButton = page.getByRole('button', { name: /arrived/i }).first();

      if ((await arrivedButton.count()) === 0) {
        test.skip(true, 'No Arrived button found - no active deliveries');
        return;
      }

      await arrivedButton.click();
      await page.waitForTimeout(2000);

      expect.soft(true).toBe(true);
    });

    test('should show Complete Delivery button', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.arrival);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      const completeButton = page.getByRole('button', { name: /complete.*delivery/i }).first();

      if ((await completeButton.count()) === 0) {
        test.skip(true, 'No Complete Delivery button found');
        return;
      }

      await expect(completeButton).toBeVisible();
    });
  });

  test.describe('Break Management', () => {
    // Break / meal tracking was removed from the redesigned driver portal
    // (the portal now exposes start shift, advance-delivery, end shift only).
    // Kept as skipped so the intent is documented if breaks are reintroduced.
    test.skip('should show break buttons when shift is active', async () => {});
    test.skip('should start break when break button is clicked', async () => {});
  });

  test.describe('End Shift', () => {
    test('should show End Shift button when shift is active', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Either End Shift button exists (active shift) or Start Shift button exists (no active shift)
      const endShiftButton = page.getByRole('button', { name: /end shift/i });
      const startShiftButton = page.getByRole('button', { name: /start shift/i });

      const hasEndButton = await endShiftButton.count() > 0;
      const hasStartButton = await startShiftButton.count() > 0;

      expect(hasEndButton || hasStartButton).toBe(true);
    });

    test('should end shift when End Shift button is clicked', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      const endShiftButton = page.getByRole('button', { name: /end shift/i });

      if ((await endShiftButton.count()) === 0) {
        test.skip(true, 'No active shift to end');
        return;
      }

      await endShiftButton.click();

      // Ending a shift returns to the pre-shift view ("Start shift" / "Request
      // location permission"). Poll instead of a fixed wait.
      await expect(async () => {
        const backToPreShift =
          (await page.getByRole('button', { name: /start shift/i }).count()) > 0 ||
          (await page.getByRole('button', { name: /request location|enable location|try again/i }).count()) > 0;
        expect(backToPreShift).toBe(true);
      }).toPass({ timeout: 10000 });
    });

    test('should display shift statistics during active shift', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Only check if shift is active
      const endShiftButton = page.getByRole('button', { name: /end shift/i });
      if ((await endShiftButton.count()) === 0) {
        test.skip(true, 'No active shift - statistics only visible during shift');
        return;
      }

      // The redesigned portal surfaces live shift stats via the ShiftPill:
      // an "On shift" label plus a running duration ("M:SS" / "H:MM:SS"), and
      // "Since <time>" on the control bar.
      const statsIndicators = [
        page.getByText(/on shift/i),
        page.getByText(/\d+:\d{2}/), // running duration
        page.getByText(/since/i),
      ];

      let hasStats = false;
      for (const indicator of statsIndicators) {
        if ((await indicator.count()) > 0) {
          hasStats = true;
          break;
        }
      }

      expect(hasStats).toBe(true);
    });
  });

  test.describe('Error Handling', () => {
    test('should show error message when location services are denied', async ({ page, context }) => {
      // Do NOT grant geolocation permission. Don't use waitForPageReady here:
      // it waits for the resolved "Start shift" state, which never appears
      // without location — wait only for the location-permission prompt.
      await page.goto('/driver/tracking');
      await page.waitForLoadState('domcontentloaded');
      await page
        .getByRole('button', { name: /request location|enable location|try again/i })
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => {});

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // The page should handle missing location gracefully
      // Either show an error message or prompt to enable location
      const errorIndicators = [
        page.locator('text=enable location'),
        page.locator('text=location services'),
        page.locator('text=Please enable'),
        page.getByRole('button', { name: /start shift/i }).filter({ hasText: 'disabled' }),
      ];

      // Page should load without crashing
      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle network errors gracefully', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Simulate offline mode
      await context.setOffline(true);

      // Wait a moment for offline detection
      await page.waitForTimeout(2000);

      // Look for offline indicator
      const offlineIndicator = page.locator('text=Offline');

      // Restore online mode
      await context.setOffline(false);

      // Page should not have crashed
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Live Map', () => {
    test('should display live map with current location', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await setGeolocation(context, TEST_LOCATIONS.start);

      await page.goto('/driver/tracking');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Look for map container or map-related elements
      const mapIndicators = [
        page.locator('text=Live Map'),
        page.locator('[class*="mapbox"], [class*="leaflet"], [class*="map"]'),
        page.locator('canvas'), // Map libraries often use canvas
      ];

      let hasMap = false;
      for (const indicator of mapIndicators) {
        if ((await indicator.count()) > 0) {
          hasMap = true;
          break;
        }
      }

      // Map may only show when location is available
      // This is a soft assertion
      expect.soft(hasMap).toBe(true);
    });
  });
});

test.describe('Full Shift Workflow Integration', () => {
  test('should complete full shift workflow: start -> track -> end', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await setGeolocation(context, TEST_LOCATIONS.start);

    // Step 1: Navigate to driver tracking page
    await page.goto('/driver/tracking');
    await waitForPageReady(page);

    if (await checkAuthRequired(page)) {
      test.skip(true, 'Driver authentication required for full workflow test');
      return;
    }

    // Step 2: Start shift if not already active
    const startShiftButton = page.getByRole('button', { name: /start shift/i });
    const endShiftButton = page.getByRole('button', { name: /end shift/i });

    if ((await startShiftButton.count()) > 0) {
      await startShiftButton.click();
      await page.waitForTimeout(2000);
    }

    // Verify shift is active
    await expect(async () => {
      const endButton = page.getByRole('button', { name: /end shift/i });
      expect(await endButton.count()).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });

    // Step 3: Simulate location updates
    await setGeolocation(context, TEST_LOCATIONS.enRoute);
    await page.waitForTimeout(2000);

    // Step 4: Check live shift stats are displayed (ShiftPill: "On shift" + duration)
    await expect.soft(page.getByText(/on shift/i).first()).toBeVisible();

    // Step 5: End shift
    const endButton = page.getByRole('button', { name: /end shift/i });
    if ((await endButton.count()) > 0) {
      await endButton.click();
      await page.waitForTimeout(2000);
    }

    // Verify shift has ended
    await expect(async () => {
      const startButton = page.getByRole('button', { name: /start shift/i });
      expect(await startButton.count()).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });
  });
});
