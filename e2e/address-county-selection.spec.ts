import { test, expect } from "@playwright/test";

test.describe("Address Modal County Selection", () => {
  test.beforeEach(async ({ page }) => {
    // Skip these tests if we're not in a test environment with proper auth setup
    test.skip(process.env.NODE_ENV !== 'test', 'Requires authentication setup - address page is protected');
    
    // Navigate to the addresses page
    await page.goto("/addresses");
  });

  test("should allow county selection and save address successfully", async ({
    page,
  }) => {
    // Click the "Add Address" button to open the modal
    await page.click('button:has-text("Add Address")');

    // Verify modal is open
    await expect(page.locator('text="Add Address"')).toBeVisible();

    // Fill out the form
    await page.fill('input[name="name"]', "Test Office");
    await page.fill('input[name="street1"]', "123 Main Street");
    await page.fill('input[name="city"]', "San Francisco");
    await page.fill('input[name="state"]', "CA");
    await page.fill('input[name="zip"]', "94103");
    await page.fill('input[name="locationNumber"]', "4155551234");
    await page.fill('input[name="parkingLoading"]', "Street parking");

    // Test county selection
    await page.click('[role="combobox"]');
    await expect(page.locator("text=San Francisco")).toBeVisible();
    await page.click("text=San Francisco");

    // Verify county is selected
    await expect(page.locator('[role="combobox"]')).toContainText(
      "San Francisco",
    );

    // Submit the form
    await page.click('button:has-text("Save")');

    // Verify success
    await expect(page.locator('text="Address saved successfully"')).toBeVisible();
  });

  test("should edit existing address with county selection", async ({
    page,
  }) => {
    // Assume there's an existing address to edit
    await page.click('button:has-text("Edit")');

    // Verify modal is open for editing
    await expect(page.locator('text="Edit Address"')).toBeVisible();

    // Change the county
    await page.click('[role="combobox"]');
    await page.click("text=San Mateo");

    // Verify county is selected
    await expect(page.locator('[role="combobox"]')).toContainText("San Mateo");

    // Submit the form
    await page.click('button:has-text("Update")');

    // Verify success
    await expect(page.locator('text="Address updated successfully"')).toBeVisible();
  });

  test("should display all available counties in dropdown", async ({
    page,
  }) => {
    // Open the address modal
    await page.click('button:has-text("Add Address")');

    // Click the county dropdown
    await page.click('[role="combobox"]');

    // Verify all counties are available
    const expectedCounties = [
      "San Francisco",
      "San Mateo",
      "Santa Clara",
      "Alameda",
      "Contra Costa",
    ];

    for (const county of expectedCounties) {
      await expect(page.locator(`text=${county}`)).toBeVisible();
    }
  });

  test("should handle authentication errors gracefully", async ({ page }) => {
    // Mock authentication failure
    await page.route("/api/addresses", (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    });

    // Open the address modal
    await page.click('button:has-text("Add Address")');

    // Fill out the form
    await page.fill('input[name="name"]', "Test Office");
    await page.fill('input[name="street1"]', "123 Main Street");
    await page.fill('input[name="city"]', "San Francisco");
    await page.fill('input[name="state"]', "CA");
    await page.fill('input[name="zip"]', "94103");

    // Select county
    await page.click('[role="combobox"]');
    await page.click("text=San Francisco");

    // Submit the form
    await page.click('button:has-text("Save")');

    // Verify error handling
    await expect(page.locator('text="Authentication error"')).toBeVisible();
  });

  test("should validate required fields including county", async ({ page }) => {
    // Open the address modal
    await page.click('button:has-text("Add Address")');

    // Try to submit without filling required fields
    await page.click('button:has-text("Save")');

    // Verify validation messages
    await expect(page.locator('text="Name is required"')).toBeVisible();
    await expect(page.locator('text="Street address is required"')).toBeVisible();
    await expect(page.locator('text="City is required"')).toBeVisible();
    await expect(page.locator('text="State is required"')).toBeVisible();
    await expect(page.locator('text="ZIP code is required"')).toBeVisible();
    await expect(page.locator('text="County is required"')).toBeVisible();
  });

  test("should maintain county selection when switching between form fields", async ({
    page,
  }) => {
    // Open the address modal
    await page.click('button:has-text("Add Address")');

    // Select county first
    await page.click('[role="combobox"]');
    await page.click("text=Santa Clara");

    // Fill other fields
    await page.fill('input[name="name"]', "Test Office");
    await page.fill('input[name="street1"]', "123 Main Street");
    await page.fill('input[name="city"]', "San Jose");
    await page.fill('input[name="state"]', "CA");
    await page.fill('input[name="zip"]', "95113");

    // Verify county selection is maintained
    await expect(page.locator('[role="combobox"]')).toContainText(
      "Santa Clara",
    );

    // Navigate to another field and back
    await page.click('input[name="name"]');
    await page.click('input[name="street1"]');

    // Verify county selection is still maintained
    await expect(page.locator('[role="combobox"]')).toContainText(
      "Santa Clara",
    );
  });
}); 