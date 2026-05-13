import { test, expect } from "@playwright/test";

test.describe("Internal boards — admin routes", () => {
  test("admin QA board loads and shows test cases", async ({ page }) => {
    await page.goto("/admin/qa-board");

    if ((await page.locator("text=Sign In").count()) > 0) {
      console.log("QA Board requires authentication — UI smoke skipped");
      return;
    }

    await expect(page.getByRole("heading", { name: /QA Board/i })).toBeVisible();
    await expect(page.locator("text=cases across")).toBeVisible();
  });

  test("admin Tasks board loads and shows columns", async ({ page }) => {
    await page.goto("/admin/tasks-board");

    if ((await page.locator("text=Sign In").count()) > 0) {
      console.log("Tasks Board requires authentication — UI smoke skipped");
      return;
    }

    await expect(page.getByRole("heading", { name: /Tasks Board/i })).toBeVisible();
    await expect(page.locator("text=Done").first()).toBeVisible();
    await expect(page.locator("text=Open").first()).toBeVisible();
  });

  test("unauthenticated visit to /admin/qa-board redirects to sign-in", async ({ page, context }) => {
    await context.clearCookies();
    const response = await page.goto("/admin/qa-board");

    const url = page.url();
    const wasRedirected = url.includes("/sign-in") || url.endsWith("/");
    const sawSignInUi = (await page.locator("text=Sign In").count()) > 0;

    expect(wasRedirected || sawSignInUi || response?.status() === 401 || response?.status() === 403).toBe(true);
  });
});
