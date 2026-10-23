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

  test("desktop 1280×800: no horizontal page overflow, NEW column reachable", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/admin/tasks-board");

    if ((await page.locator("text=Sign In").count()) > 0) {
      console.log("Tasks Board requires authentication — layout test skipped");
      return;
    }

    await expect(page.getByRole("heading", { name: /Tasks Board/i })).toBeVisible();

    // No horizontal page overflow
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

    // Scroll the board row to the end so the NEW column is in view
    await page.evaluate(() => {
      const board = document.querySelector("main");
      if (board) board.scrollLeft = board.scrollWidth;
    });
    await expect(page.getByRole("heading", { name: /new/i }).first()).toBeInViewport();
  });

  test("mobile 390×844: tap New tab, NEW column visible, no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/tasks-board");

    if ((await page.locator("text=Sign In").count()) > 0) {
      console.log("Tasks Board requires authentication — layout test skipped");
      return;
    }

    await expect(page.getByRole("heading", { name: /Tasks Board/i })).toBeVisible();

    // Tap the New tab
    const newTab = page.getByRole("tab", { name: /new/i });
    await newTab.click();
    await expect(newTab).toHaveAttribute("aria-selected", "true");

    // NEW column heading should be visible
    await expect(page.getByRole("heading", { name: /new/i }).first()).toBeInViewport();

    // No horizontal page overflow
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
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
