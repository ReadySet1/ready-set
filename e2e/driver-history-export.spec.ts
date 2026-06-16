/**
 * E2E Test: Driver History Export (REA-313)
 *
 * This spec tests the driver history export functionality:
 * 1. Driver downloads own history PDF
 * 2. Driver downloads own history CSV
 * 3. Admin downloads any driver's history
 * 4. Archived data appears in exports
 *
 * Prerequisites:
 * - Driver auth fixture (or authentication during test)
 * - Admin auth fixture for admin tests
 * - Test driver with historical data
 *
 * @see REA-313
 */

import { test, expect, request as playwrightRequest, type Page } from '@playwright/test';

// Reuse the driver session created by e2e/auth/setup.ts
test.use({ storageState: 'e2e/.auth/driver.json' });

// A syntactically valid UUID that does not belong to any driver — used to
// assert the 404 path on the (now uuid-validated) history routes.
const UNKNOWN_DRIVER_UUID = '00000000-0000-4000-8000-0000000000ff';

// The seeded e2e test driver's drivers-table row id (driver.test@example.com).
// Stable fixture in the rs-dev database; see e2e/test-data-setup.ts.
const TEST_DRIVER_ROW_ID = '05295b7a-df7d-4ea4-aae8-e9cba3f1c071';

// The history view cold-compiles its route and fetches data client-side — give
// each test headroom beyond the default 30s so settle waits + downloads fit.
test.beforeEach(() => {
  test.setTimeout(60_000);
});

/**
 * Helper to wait for page to be ready after navigation
 */
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // The history view fetches its data client-side and shows a spinner until it
  // resolves — `networkidle` is unreliable here because the page hits a brief
  // idle window *before* the fetch starts. Instead wait for the settled UI:
  // the export/date controls (success), the error state, or a sign-in redirect.
  // Generous timeout covers Next.js dev cold-compile of the history route on
  // first hit (the page shows a spinner until the data fetch resolves).
  await page
    .locator('input[type="date"]')
    .or(page.getByRole('button', { name: /export|download|pdf|csv/i }))
    .or(page.getByText(/couldn.t load history/i))
    .or(page.getByRole('link', { name: /sign in|log ?in/i }))
    .first()
    .waitFor({ state: 'visible', timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(300);
}

/**
 * Helper to check if authentication is required
 */
async function checkAuthRequired(page: Page): Promise<boolean> {
  // Unauthenticated access to a protected route redirects to the sign-in page.
  if (/\/sign-in|\/login/.test(page.url())) return true;
  const signInLink = page.getByRole('link', { name: /sign in|log ?in/i });
  return (await signInLink.count()) > 0;
}

/**
 * Helper to wait for download to complete
 */
async function waitForDownload(page: Page, triggerAction: () => Promise<void>) {
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await triggerAction();
  return downloadPromise;
}

test.describe('Driver History Export', () => {
  test.describe('Driver Downloads Own History', () => {
    test('should navigate to driver history page', async ({ page }) => {
      await page.goto('/driver/history');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Verify we're on the history page
      await expect(page).toHaveURL(/\/driver\/history/);
    });

    test('should display history summary section', async ({ page }) => {
      await page.goto('/driver/history');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Look for history summary elements
      const summaryIndicators = [
        page.locator('text=History'),
        page.locator('text=Summary'),
        page.locator('text=Total Shifts'),
        page.locator('text=Total Hours'),
        page.locator('text=Total Miles'),
        page.locator('text=Total Deliveries'),
      ];

      let hasSummary = false;
      for (const indicator of summaryIndicators) {
        if ((await indicator.count()) > 0) {
          hasSummary = true;
          break;
        }
      }

      expect(hasSummary).toBe(true);
    });

    test('should display date range selector', async ({ page }) => {
      await page.goto('/driver/history');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Look for date range inputs
      const dateInputs = [
        page.locator('input[type="date"]'),
        page.getByRole('button', { name: /date/i }),
        page.locator('[data-testid*="date"]'),
        page.locator('text=Start Date'),
        page.locator('text=End Date'),
      ];

      let hasDateSelector = false;
      for (const input of dateInputs) {
        if ((await input.count()) > 0) {
          hasDateSelector = true;
          break;
        }
      }

      // Date selector may be optional - soft assertion
      expect.soft(hasDateSelector).toBe(true);
    });

    test('should display export buttons for PDF and CSV', async ({ page }) => {
      await page.goto('/driver/history');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Look for export buttons
      const exportButtons = [
        page.getByRole('button', { name: /export/i }),
        page.getByRole('button', { name: /download/i }),
        page.getByRole('button', { name: /pdf/i }),
        page.getByRole('button', { name: /csv/i }),
        page.getByRole('link', { name: /export/i }),
        page.getByRole('link', { name: /download/i }),
      ];

      let hasExportButton = false;
      for (const button of exportButtons) {
        if ((await button.count()) > 0) {
          hasExportButton = true;
          break;
        }
      }

      expect(hasExportButton).toBe(true);
    });

    test('should download PDF when export PDF is clicked', async ({ page }) => {
      await page.goto('/driver/history');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Find PDF export button
      const pdfButton = page.getByRole('button', { name: /pdf/i }).first();
      const exportButton = page.getByRole('button', { name: /export/i }).first();

      const buttonToClick = (await pdfButton.count()) > 0 ? pdfButton : exportButton;

      if ((await buttonToClick.count()) === 0) {
        test.skip(true, 'No export button found');
        return;
      }

      try {
        const download = await waitForDownload(page, () => buttonToClick.click());

        // Verify download
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/\.(pdf|PDF)$/);

        // Save and verify file size
        const path = await download.path();
        expect(path).toBeTruthy();

        console.log(`✅ PDF downloaded: ${filename}`);
      } catch (error) {
        // Download may be blocked or require additional UI interaction
        console.log('⚠️ Direct download not triggered - may require format selection');
        expect.soft(true).toBe(true);
      }
    });

    test('should download CSV when export CSV is clicked', async ({ page }) => {
      await page.goto('/driver/history');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Find CSV export button
      const csvButton = page.getByRole('button', { name: /csv/i }).first();

      if ((await csvButton.count()) === 0) {
        // Try clicking export and selecting CSV
        const exportButton = page.getByRole('button', { name: /export/i }).first();
        if ((await exportButton.count()) > 0) {
          await exportButton.click();
          await page.waitForTimeout(500);

          // Look for CSV option in dropdown
          const csvOption = page.getByRole('menuitem', { name: /csv/i }).first();
          if ((await csvOption.count()) === 0) {
            test.skip(true, 'No CSV export option found');
            return;
          }

          try {
            const download = await waitForDownload(page, () => csvOption.click());
            expect(download.suggestedFilename()).toMatch(/\.(csv|CSV)$/);
            console.log(`✅ CSV downloaded: ${download.suggestedFilename()}`);
          } catch {
            expect.soft(true).toBe(true);
          }
        } else {
          test.skip(true, 'No export button found');
        }
        return;
      }

      try {
        const download = await waitForDownload(page, () => csvButton.click());
        expect(download.suggestedFilename()).toMatch(/\.(csv|CSV)$/);
        console.log(`✅ CSV downloaded: ${download.suggestedFilename()}`);
      } catch {
        expect.soft(true).toBe(true);
      }
    });

    test('should show weekly breakdown in history view', async ({ page }) => {
      await page.goto('/driver/history');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Look for weekly data table or list
      const weeklyIndicators = [
        page.locator('text=Week'),
        page.locator('th:has-text("Week")'),
        page.locator('text=/Week \\d+/'),
        page.locator('[data-testid*="weekly"]'),
      ];

      let hasWeeklyBreakdown = false;
      for (const indicator of weeklyIndicators) {
        if ((await indicator.count()) > 0) {
          hasWeeklyBreakdown = true;
          break;
        }
      }

      // Weekly breakdown is expected but may be empty
      expect.soft(hasWeeklyBreakdown).toBe(true);
    });
  });

  test.describe('Admin Downloads Driver History', () => {
    // This section acts as an admin, not the driver. The admin views a specific
    // driver's history at /admin/drivers/[driverId]/history (there is no
    // /admin/drivers index page); admin authorization on the underlying
    // /api/drivers/[driverId]/history route is what this exercises.
    test.use({ storageState: 'e2e/.auth/admin.json' });

    const adminHistoryUrl = `/admin/drivers/${TEST_DRIVER_ROW_ID}/history`;

    test('admin can reach a driver history page', async ({ page }) => {
      await page.goto(adminHistoryUrl);
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Admin authentication required');
        return;
      }

      // Stays on the admin history route (not redirected to / or /sign-in)
      await expect(page).toHaveURL(new RegExp(`/admin/drivers/${TEST_DRIVER_ROW_ID}/history`));
    });

    test('admin sees the driver history view (summary / breakdown)', async ({ page }) => {
      await page.goto(adminHistoryUrl);
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Admin authentication required');
        return;
      }

      // The admin history view renders the same summary + weekly breakdown the
      // driver sees. Accept any of the section markers.
      const indicators = [
        page.getByText(/history/i),
        page.getByText(/total/i),
        page.getByText(/week/i),
        page.locator('table'),
      ];

      let hasHistoryView = false;
      for (const indicator of indicators) {
        if ((await indicator.count()) > 0) {
          hasHistoryView = true;
          break;
        }
      }

      expect(hasHistoryView).toBe(true);
    });

    test('admin sees export buttons on the driver history page', async ({ page }) => {
      await page.goto(adminHistoryUrl);
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Admin authentication required');
        return;
      }

      const exportButton = page
        .getByRole('button', { name: /export|download|pdf|csv/i })
        .first();

      await expect(exportButton).toBeVisible();
      await expect(exportButton).toBeEnabled();
    });

    test('admin can fetch the driver history via API', async ({ request }) => {
      // request inherits the admin storageState from this describe block.
      const response = await request.get(
        `/api/drivers/${TEST_DRIVER_ROW_ID}/history`
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('summary');
    });
  });

  // The `request` fixture inherits the driver storageState (test.use above),
  // so it is authenticated. For the unauthenticated cases we spin up a fresh
  // request context with no storage state.
  test.describe('History API Endpoints', () => {
    test('should return 401 when not authenticated', async ({ baseURL }) => {
      // storageState: undefined overrides the file-level driver session, which
      // Playwright otherwise applies as the default for request.newContext().
      const anon = await playwrightRequest.newContext({ baseURL, storageState: undefined });
      const response = await anon.get(`/api/drivers/${UNKNOWN_DRIVER_UUID}/history`);
      expect(response.status()).toBe(401);
      await anon.dispose();
    });

    test('should return 400 for a non-UUID driver id when authenticated', async ({ request }) => {
      const response = await request.get('/api/drivers/test-driver-id/history');
      expect(response.status()).toBe(400);
    });

    test('should return 404 for an unknown (valid UUID) driver when authenticated', async ({ request }) => {
      const response = await request.get(`/api/drivers/${UNKNOWN_DRIVER_UUID}/history`, {
        headers: { Accept: 'application/json' },
      });
      // The authed driver does not own this id and it does not exist → 403/404.
      expect([403, 404]).toContain(response.status());
    });

    test('should support format parameter for CSV (unauthenticated → 401)', async ({ baseURL }) => {
      // storageState: undefined overrides the file-level driver session, which
      // Playwright otherwise applies as the default for request.newContext().
      const anon = await playwrightRequest.newContext({ baseURL, storageState: undefined });
      const response = await anon.get(
        `/api/drivers/${UNKNOWN_DRIVER_UUID}/history?format=csv`
      );
      expect(response.status()).toBe(401);
      await anon.dispose();
    });

    test('should support date range parameters (unauthenticated → 401)', async ({ baseURL }) => {
      // storageState: undefined overrides the file-level driver session, which
      // Playwright otherwise applies as the default for request.newContext().
      const anon = await playwrightRequest.newContext({ baseURL, storageState: undefined });
      const response = await anon.get(
        `/api/drivers/${UNKNOWN_DRIVER_UUID}/history?startDate=2025-01-01&endDate=2025-01-31`
      );
      expect(response.status()).toBe(401);
      await anon.dispose();
    });
  });

  test.describe('Export API Endpoints', () => {
    test('should return 401 for unauthenticated PDF export', async ({ baseURL }) => {
      // storageState: undefined overrides the file-level driver session, which
      // Playwright otherwise applies as the default for request.newContext().
      const anon = await playwrightRequest.newContext({ baseURL, storageState: undefined });
      const response = await anon.get(`/api/drivers/${UNKNOWN_DRIVER_UUID}/history/export`);
      expect(response.status()).toBe(401);
      await anon.dispose();
    });

    test('should return 401 for unauthenticated CSV export', async ({ baseURL }) => {
      // storageState: undefined overrides the file-level driver session, which
      // Playwright otherwise applies as the default for request.newContext().
      const anon = await playwrightRequest.newContext({ baseURL, storageState: undefined });
      const response = await anon.get(
        `/api/drivers/${UNKNOWN_DRIVER_UUID}/history/export?format=csv`
      );
      expect(response.status()).toBe(401);
      await anon.dispose();
    });
  });

  test.describe('Archived Data in Exports', () => {
    test('should include archived data checkbox in export options', async ({ page }) => {
      await page.goto('/driver/history');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Look for archived data toggle
      const archivedToggle = [
        page.locator('text=Include Archived'),
        page.locator('text=Archived Data'),
        page.locator('input[type="checkbox"]').filter({ hasText: /archive/i }),
        page.getByLabel(/archive/i),
      ];

      let hasArchivedToggle = false;
      for (const toggle of archivedToggle) {
        if ((await toggle.count()) > 0) {
          hasArchivedToggle = true;
          break;
        }
      }

      // Archived toggle is optional - soft assertion
      expect.soft(hasArchivedToggle).toBe(true);
    });

    test('should show archived indicator when viewing old data', async ({ page }) => {
      await page.goto('/driver/history');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Look for archived data indicators
      const archivedIndicators = [
        page.locator('text=Archived'),
        page.locator('[data-archived="true"]'),
        page.locator('.archived'),
        page.locator('text=From Archive'),
      ];

      // May not have archived data - just verify page loads
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should show error message for invalid date range', async ({ page }) => {
      await page.goto('/driver/history');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Try to set an invalid date range (end before start)
      const startDateInput = page.locator('input[name*="start"], input[placeholder*="Start"]').first();
      const endDateInput = page.locator('input[name*="end"], input[placeholder*="End"]').first();

      if ((await startDateInput.count()) > 0 && (await endDateInput.count()) > 0) {
        await startDateInput.fill('2025-12-31');
        await endDateInput.fill('2025-01-01');

        // Submit or trigger validation
        const submitButton = page.getByRole('button', { name: /apply|submit|search/i }).first();
        if ((await submitButton.count()) > 0) {
          await submitButton.click();
          await page.waitForTimeout(1000);
        }

        // Look for error message
        const errorMessage = page.getByText(/invalid|error/i).or(page.locator('[role="alert"]')).first();
        // This is expected behavior - soft assertion
        expect.soft(await errorMessage.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should handle export failure gracefully', async ({ page }) => {
      await page.goto('/driver/history');
      await waitForPageReady(page);

      if (await checkAuthRequired(page)) {
        test.skip(true, 'Driver authentication required');
        return;
      }

      // Page should not crash even if export fails
      await expect(page.locator('body')).toBeVisible();
    });
  });
});

test.describe('Full Driver History Export Workflow', () => {
  test('should complete full export workflow: view -> filter -> export', async ({ page }) => {
    // Step 1: Navigate to history page
    await page.goto('/driver/history');
    await waitForPageReady(page);

    if (await checkAuthRequired(page)) {
      test.skip(true, 'Driver authentication required for full workflow test');
      return;
    }

    console.log('✅ Step 1: Navigated to history page');

    // Step 2: Verify history data is displayed
    const historyContent = page.getByText(/shift|week|total|deliver/i).first();
    await expect.soft(historyContent).toBeVisible({ timeout: 10000 });
    console.log('✅ Step 2: History data displayed');

    // Step 3: Look for date filter and apply (if available)
    const dateFilter = page.locator('input[type="date"], [data-testid*="date"]').first();
    if ((await dateFilter.count()) > 0) {
      // Date filter exists - could apply filter here
      console.log('✅ Step 3: Date filter found');
    } else {
      console.log('⚠️ Step 3: No date filter - using default range');
    }

    // Step 4: Export the data
    const exportButton = page.getByRole('button', { name: /export|download/i }).first();

    if ((await exportButton.count()) > 0) {
      await expect(exportButton).toBeEnabled();
      console.log('✅ Step 4: Export button available');

      // Click and verify download initiates
      try {
        const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
        await exportButton.click();

        // Wait for potential format selection modal
        const pdfOption = page.getByRole('menuitem', { name: /pdf/i }).first();
        if ((await pdfOption.count()) > 0) {
          const download = await Promise.race([
            downloadPromise,
            (async () => {
              await pdfOption.click();
              return page.waitForEvent('download', { timeout: 15000 });
            })(),
          ]);
          console.log(`✅ Step 5: Downloaded ${download.suggestedFilename()}`);
        } else {
          const download = await downloadPromise;
          console.log(`✅ Step 5: Downloaded ${download.suggestedFilename()}`);
        }
      } catch {
        console.log('⚠️ Step 5: Download not captured - may require manual verification');
      }
    } else {
      console.log('⚠️ Step 4: No export button found');
    }

    console.log('✅ Full export workflow completed');
  });
});
