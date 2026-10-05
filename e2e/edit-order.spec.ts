// e2e/edit-order.spec.ts
/**
 * E2E tests for the Edit Order feature (Admin)
 *
 * These tests verify the complete edit order flow from the admin perspective:
 * - Opening the edit dialog
 * - Modifying order fields
 * - Saving changes
 * - Verifying updates
 *
 * SAFETY: these tests run against the shared rs-dev database and open real
 * catering orders. Nothing here may change an order: the save tests stub the
 * PATCH /api/orders/:order_number request with page.route, so the request
 * never reaches the server. Every other test only opens the dialog and closes
 * it without saving.
 */

import {
  test,
  expect,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test';

const editOrderButton = (page: Page): Locator =>
  page.getByRole('button', { name: 'Edit Order' });

/** Status tabs on /admin/catering-orders and the query each one sends. */
const STATUS_TABS = {
  new: { label: 'New', query: 'statusFilter=new' },
  completed: { label: 'Completed', query: 'status=COMPLETED' },
} as const;

/**
 * Open /admin/catering-orders on the given status tab. Returns the first order
 * number the tab's API response lists, or null when the tab is empty. Reading
 * it from the response avoids racing the table re-render after the tab switch.
 */
async function firstOrderOnTab(
  page: Page,
  tab: keyof typeof STATUS_TABS
): Promise<string | null> {
  const { label, query } = STATUS_TABS[tab];

  await page.goto('/admin/catering-orders', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const tabButton = page.getByRole('button', { name: label, exact: true });
  await expect(tabButton).toBeVisible({ timeout: 30000 });

  const tabResponse = page.waitForResponse(
    (res) => res.url().includes('/api/orders/catering-orders') && res.url().includes(query),
    { timeout: 30000 }
  );
  await tabButton.click();
  const response = await tabResponse;
  expect(response.ok(), `GET ${response.url()} -> ${response.status()}`).toBe(true);

  const { orders } = (await response.json()) as { orders: { orderNumber: string }[] };
  return orders[0]?.orderNumber ?? null;
}

/** Open the first order on the tab's detail page; returns its order number. */
async function openFirstOrder(page: Page, tab: keyof typeof STATUS_TABS): Promise<string> {
  const orderNumber = await firstOrderOnTab(page, tab);
  test.skip(!orderNumber, `No "${STATUS_TABS[tab].label}" catering orders on this database`);
  if (!orderNumber) throw new Error('unreachable: test skipped above');

  await page.getByRole('link', { name: orderNumber, exact: true }).click();
  await waitForOrderDetail(page);
  return orderNumber;
}

/**
 * Wait for an order detail page to render its sidebar. A failed detail fetch
 * other than a 404 shows "Unable to Load Order"; on a busy dev server that is
 * usually transient, so reload once before failing.
 */
async function waitForOrderDetail(page: Page): Promise<void> {
  const quickActions = page.getByRole('heading', { name: 'Quick Actions' });
  const loadError = page.getByRole('heading', { name: 'Unable to Load Order' });
  await expect(quickActions.or(loadError)).toBeVisible({ timeout: 45000 });
  if (await loadError.isVisible()) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await expect(quickActions).toBeVisible({ timeout: 45000 });
}

/** Open an editable (pending/confirmed) order and its edit dialog. */
async function openEditDialog(page: Page): Promise<{ dialog: Locator; orderNumber: string }> {
  const orderNumber = await openFirstOrder(page, 'new');

  await editOrderButton(page).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });
  return { dialog, orderNumber };
}

/**
 * The pickup date/time popover trigger. Its text is the formatted date, or
 * "Select date and time" when empty, so find it through its field label.
 */
const pickupDateTrigger = (dialog: Locator): Locator =>
  dialog
    .locator('div')
    // `has` is matched inside each div, so root it at the page, not the dialog.
    .filter({ has: dialog.page().getByText('Pickup Date & Time', { exact: true }) })
    .last()
    .getByRole('button');

/** Stub the order PATCH so nothing is written. Other methods pass through. */
async function stubOrderPatch(
  page: Page,
  respond: (route: Route) => Promise<void>
): Promise<{ bodies: unknown[] }> {
  const bodies: unknown[] = [];
  await page.route(
    (url) => url.pathname.startsWith('/api/orders/'),
    async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      bodies.push(route.request().postDataJSON());
      await respond(route);
    }
  );
  return { bodies };
}

/** Local-time yyyy-MM-dd, matching react-day-picker's data-day attribute. */
function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

test.describe('Edit Order Flow', () => {
  // Admin session saved by global setup (paths resolve from the repo root).
  test.use({ storageState: 'e2e/.auth/admin.json' });
  // The dev server compiles these pages on first hit; give each test room.
  test.describe.configure({ timeout: 120000 });

  test.describe('Edit Button Visibility', () => {
    test('should show edit button for admin users on order detail page', async ({ page }) => {
      await openFirstOrder(page, 'new');

      await expect(editOrderButton(page)).toBeVisible();
    });

    test('should not show edit button for completed orders', async ({ page }) => {
      await openFirstOrder(page, 'completed');

      // Completed is a terminal status: the Quick Actions card omits the button.
      await expect(page.getByRole('button', { name: 'Print Order' })).toBeVisible();
      await expect(editOrderButton(page)).toHaveCount(0);
    });
  });

  test.describe('Edit Dialog', () => {
    test('should open edit dialog when clicking edit button', async ({ page }) => {
      const { dialog } = await openEditDialog(page);

      await expect(dialog.getByRole('heading', { name: /^Edit .* Order$/ })).toBeVisible();
    });

    test('should display all tabs in edit dialog', async ({ page }) => {
      const { dialog } = await openEditDialog(page);

      for (const name of ['Schedule', 'Details', 'Addresses', 'Pricing', 'Notes']) {
        await expect(dialog.getByRole('tab', { name })).toBeVisible();
      }
    });

    test('should populate form with existing order data', async ({ page }) => {
      const { dialog, orderNumber } = await openEditDialog(page);

      await expect(dialog).toContainText(`Order #${orderNumber}`);
    });

    test('should close dialog when clicking Cancel', async ({ page }) => {
      const { dialog } = await openEditDialog(page);

      await dialog.getByRole('button', { name: 'Cancel' }).click();

      await expect(dialog).toBeHidden();
    });
  });

  test.describe('Edit Form Interactions', () => {
    test('should navigate between tabs', async ({ page }) => {
      const { dialog } = await openEditDialog(page);

      await dialog.getByRole('tab', { name: 'Addresses' }).click();
      await expect(dialog.getByText('Pickup Address', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Delivery Address', { exact: true })).toBeVisible();

      await dialog.getByRole('tab', { name: 'Pricing' }).click();
      await expect(dialog.getByLabel('Order Total ($)')).toBeVisible();
    });

    test('should show unsaved changes indicator when form is modified', async ({ page }) => {
      const { dialog } = await openEditDialog(page);
      const unsaved = dialog.getByText('You have unsaved changes');

      await expect(unsaved).toBeHidden();

      await dialog.getByRole('tab', { name: 'Notes' }).click();
      await dialog.getByLabel('Client Attention / Contact Name').fill(`E2E contact ${Date.now()}`);

      await expect(unsaved).toBeVisible();

      // Discard: close without saving.
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
    });

    test('should enable Save button when changes are made', async ({ page }) => {
      const { dialog } = await openEditDialog(page);
      const saveButton = dialog.getByRole('button', { name: 'Save Changes' });

      await expect(saveButton).toBeDisabled();

      await dialog.getByRole('tab', { name: 'Notes' }).click();
      await dialog.getByLabel('Special Notes').fill(`E2E special notes ${Date.now()}`);

      await expect(saveButton).toBeEnabled();

      // Discard: close without saving.
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
    });
  });

  test.describe('Date/Time Picker', () => {
    test('should open date picker for pickup date/time', async ({ page }) => {
      const { dialog } = await openEditDialog(page);

      await pickupDateTrigger(dialog).click();

      await expect(page.getByRole('grid')).toBeVisible();
    });

    test('should block selection of past dates', async ({ page }) => {
      const { dialog } = await openEditDialog(page);

      await pickupDateTrigger(dialog).click();

      const grid = page.getByRole('grid');
      await expect(grid).toBeVisible();

      const days = await grid.getByRole('gridcell').evaluateAll((cells) =>
        cells.map((cell) => ({
          day: cell.getAttribute('data-day') ?? '',
          disabled: cell.getAttribute('data-disabled') === 'true',
        }))
      );
      expect(days.length).toBeGreaterThan(0);

      const today = isoDay(new Date());
      const enabledPastDays = days.filter((d) => d.day < today && !d.disabled).map((d) => d.day);
      expect(enabledPastDays).toEqual([]);
    });
  });

  test.describe('Save Order Changes', () => {
    test('should save order changes successfully', async ({ page }) => {
      const { dialog } = await openEditDialog(page);

      // Stubbed: the real order is never modified.
      const patch = await stubOrderPatch(page, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })
      );

      await dialog.getByRole('tab', { name: 'Notes' }).click();
      const uniqueNote = `E2E Test Note - ${Date.now()}`;
      await dialog.getByLabel('Special Notes').fill(uniqueNote);
      await dialog.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByText('Order updated successfully!')).toBeVisible();
      await expect(dialog).toBeHidden();
      expect(patch.bodies).toHaveLength(1);
      expect(patch.bodies[0]).toMatchObject({ specialNotes: uniqueNote });
    });

    test('should display error toast on save failure', async ({ page }) => {
      const { dialog } = await openEditDialog(page);

      // Stubbed failure: nothing reaches the server.
      await stubOrderPatch(page, (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'E2E simulated save failure' }),
        })
      );

      await dialog.getByRole('tab', { name: 'Notes' }).click();
      await dialog.getByLabel('Special Notes').fill(`E2E failing save ${Date.now()}`);
      await dialog.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByText('E2E simulated save failure')).toBeVisible();
      // The dialog stays open so the admin can retry.
      await expect(dialog).toBeVisible();
    });
  });

  test.describe('On-Demand Order Edit', () => {
    test('should display on-demand specific fields for on-demand orders', async ({ page }) => {
      // The list opens on the Active tab, so its first order is editable.
      const listResponse = page.waitForResponse(
        (res) =>
          res.url().includes('/api/orders/on-demand-orders') && res.url().includes('status=ACTIVE'),
        { timeout: 30000 }
      );
      await page.goto('/admin/on-demand-orders', { waitUntil: 'domcontentloaded', timeout: 60000 });
      const response = await listResponse;
      expect(response.ok(), `GET ${response.url()} -> ${response.status()}`).toBe(true);

      const { orders } = (await response.json()) as { orders: { orderNumber: string }[] };
      const orderNumber = orders[0]?.orderNumber;
      test.skip(!orderNumber, 'No active on-demand orders on this database');
      if (!orderNumber) throw new Error('unreachable: test skipped above');

      await page.goto(`/admin/on-demand-orders/${encodeURIComponent(orderNumber)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await waitForOrderDetail(page);
      await editOrderButton(page).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: /On-Demand/ })).toBeVisible();

      await dialog.getByRole('tab', { name: 'Details' }).click();
      await expect(dialog.getByLabel('Item Delivered')).toBeVisible();
      await expect(dialog.getByText('Vehicle Type')).toBeVisible();
      await expect(dialog.getByText('Package Dimensions')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels and roles', async ({ page }) => {
      const { dialog } = await openEditDialog(page);

      await expect(dialog.getByRole('tablist')).toBeVisible();
      await expect(dialog.getByRole('tab').first()).toBeVisible();

      // Form fields are reachable by their visible labels.
      await dialog.getByRole('tab', { name: 'Notes' }).click();
      await expect(dialog.getByLabel('Client Attention / Contact Name')).toBeVisible();
      await expect(dialog.getByLabel('Pickup Notes')).toBeVisible();
      await expect(dialog.getByLabel('Special Notes')).toBeVisible();
    });

    test('should support keyboard navigation', async ({ page }) => {
      const { dialog } = await openEditDialog(page);

      // Arrow keys move between tabs once the tab list has focus.
      await dialog.getByRole('tab', { name: 'Schedule' }).focus();
      await page.keyboard.press('ArrowRight');
      await expect(dialog.getByRole('tab', { name: 'Details' })).toBeFocused();

      // Escape closes the dialog.
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  });
});
