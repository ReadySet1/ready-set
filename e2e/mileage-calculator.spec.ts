/**
 * Mileage Calculator E2E Tests
 *
 * Verifies the Total Mileage Calculation tool loads correctly,
 * renders all UI components, and handles user interactions.
 *
 * /admin/mileage-calculator is limited to ADMIN, SUPER_ADMIN and HELPDESK
 * (see src/app/(backend)/admin/mileage-calculator/page.tsx), so these tests
 * use the ADMIN session saved by e2e/auth/setup.ts instead of a UI sign-in.
 *
 * Testing Steps:
 * 1. Navigate to /admin/mileage-calculator as an admin
 * 2. Verify page title and layout render
 * 3. Verify form inputs (pickup, drop-off, add/remove stops)
 * 4. Verify tab switching between Calculator and History
 * 5. Verify sidebar navigation link exists
 * 6. Verify auth gate redirects unauthenticated users
 */

import { test, expect, Page } from '@playwright/test';

// Headless Chromium has no GPU. MileageMap falls back to a "Map unavailable"
// card when WebGL is missing (covered below); software WebGL lets the rest of
// the suite exercise the real map as a browser with a GPU would.
test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });

const pageHeading = (page: Page) =>
  page.getByRole('heading', { level: 1, name: 'Total Mileage Calculation' });

async function openMileageCalculator(page: Page): Promise<void> {
  await page.goto('/admin/mileage-calculator');
  await expect(pageHeading(page)).toBeVisible({ timeout: 15000 });
}

test.describe('Mileage Calculator', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  test.setTimeout(60000);

  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await openMileageCalculator(page);
  });

  test('should display page title and description', async ({ page }) => {
    await expect(pageHeading(page)).toBeVisible();

    await expect(page.getByText('Calculate driving distance')).toBeVisible();
  });

  test('should render pickup and drop-off inputs', async ({ page }) => {
    await expect(page.getByText('Pickup Location', { exact: true })).toBeVisible();
    await expect(page.getByText('Drop-off 1', { exact: true })).toBeVisible();
  });

  test('should render the Calculate Mileage button', async ({ page }) => {
    const calcButton = page.getByRole('button', { name: 'Calculate Mileage' });
    await expect(calcButton).toBeVisible();
    await expect(calcButton).toBeDisabled();
  });

  test('should render Add Stop button', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /Add Stop/ });
    await expect(addButton).toBeVisible();
    await expect(addButton).toContainText('1/5');
  });

  test('should add a second drop-off when Add Stop is clicked', async ({
    page,
  }) => {
    const addButton = page.getByRole('button', { name: /Add Stop/ });
    await addButton.click();

    await expect(page.getByText('Drop-off 2', { exact: true })).toBeVisible();
    await expect(addButton).toContainText('2/5');
  });

  test('should show remove button for extra drop-offs', async ({ page }) => {
    await page.getByRole('button', { name: /Add Stop/ }).click();

    await expect(
      page.getByRole('button', { name: /Remove drop-off/ }).first(),
    ).toBeVisible();
  });

  test('should switch between Mileage Calculator and Recent Calculations tabs', async ({
    page,
  }) => {
    const calcTab = page.getByRole('tab', { name: /Calculator/ });
    const historyTab = page.getByRole('tab', { name: /Recent/ });

    await expect(calcTab).toBeVisible();
    await expect(historyTab).toBeVisible();

    await historyTab.click();

    await expect(page.getByText('No calculations yet')).toBeVisible();

    await calcTab.click();

    await expect(page.getByText('Pickup Location', { exact: true })).toBeVisible();
  });

  test('should show the map container', async ({ page }) => {
    // Map may or may not render depending on Mapbox token availability.
    // At minimum the map card (or its fallback message) should exist.
    const mapContainer = page.locator('.mapboxgl-map, [class*="mapbox"]');
    const mapCard = page.getByText('Map unavailable').or(mapContainer);
    await expect(mapCard.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display "No calculation yet" placeholder', async ({ page }) => {
    await expect(page.getByText('No calculation yet')).toBeVisible();
  });

  test('should show Google Maps badge', async ({ page }) => {
    await expect(page.getByText('Google Maps', { exact: true })).toBeVisible();
  });

  test('should not have critical console errors', async () => {
    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('hydration') &&
        !err.includes('Warning:') &&
        // Third-party analytics script; whether it loads depends on the
        // network, not on this page.
        !err.includes('Umami analytics'),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Mileage Calculator - Without WebGL', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.setTimeout(60000);

  test(
    'should still render the calculator when WebGL is unavailable',
    // Regression: an unguarded new mapboxgl.Map() used to throw "Failed to
    // initialize WebGL" into AuthErrorBoundary and replace the whole page.
    async ({ page }) => {
      await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          type: string,
          ...args: unknown[]
        ) {
          if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
          return (getContext as (...a: unknown[]) => unknown).call(this, type, ...args);
        } as typeof getContext;
      });

      await openMileageCalculator(page);
      await expect(page.getByRole('button', { name: 'Calculate Mileage' })).toBeVisible();
      await expect(page.getByText('Pickup Location', { exact: true })).toBeVisible();
      await expect(page.getByText(/Map unavailable.*WebGL/)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Authentication Error')).toHaveCount(0);
    },
  );
});

test.describe('Mileage Calculator - Auth Gate', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should redirect unauthenticated users to sign-in', async ({
    page,
  }) => {
    await page.goto('/admin/mileage-calculator');

    await page.waitForURL(/\/sign-in/, { timeout: 15000 });

    expect(page.url()).toContain('/sign-in');
  });
});

test.describe('Mileage Calculator - Sidebar Navigation', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  test.setTimeout(60000);

  test('should have Total Mileage Calculation link in sidebar', async ({
    page,
  }) => {
    await openMileageCalculator(page);

    const sidebarLink = page.locator(
      'a[href="/admin/mileage-calculator"]:has-text("Total Mileage Calculation")',
    );
    await expect(sidebarLink).toBeVisible();
  });
});
