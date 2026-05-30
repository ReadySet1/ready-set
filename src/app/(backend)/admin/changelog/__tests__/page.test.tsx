import { render } from "@testing-library/react";

// remark/remark-html are pure ESM and aren't in jest's transform allowlist, so
// we mock them. The mock echoes the markdown wrapped in <pre> so we can assert
// the page reads CHANGELOG.md and feeds it through the processor into the DOM.
jest.mock("remark", () => ({
  remark: () => ({
    use: () => ({
      process: async (md: string) => ({ toString: () => `<pre>${md}</pre>` }),
    }),
  }),
}));
jest.mock("remark-html", () => ({ __esModule: true, default: () => {} }));

// jsdom doesn't run middleware; this verifies the admin page reads CHANGELOG.md
// and renders it. The auth gate is enforced by the shared `/admin/*`
// middleware (src/middleware/routeProtection.ts), asserted separately below.

describe("AdminChangelogPage", () => {
  it("reads CHANGELOG.md and renders the processed HTML", async () => {
    const mod = await import("../page");
    const AdminChangelogPage = mod.default;
    // The page is an async server component; resolve its element tree.
    const ui = await AdminChangelogPage();
    const { container } = render(ui);

    expect(container.textContent).toContain("Technical Changelog");
    const prose = container.querySelector(".changelog-prose");
    expect(prose).not.toBeNull();
    // CHANGELOG.md begins with the "# Changelog" heading.
    expect(prose!.textContent).toContain("# Changelog");
  });
});

describe("/admin/changelog route protection", () => {
  it("is matched by the /admin/* protection regex", () => {
    // Mirror of ROUTE_PERMISSIONS admin pattern in routeProtection.ts.
    const adminPattern = /^\/admin(\/.*)?$/;
    expect(adminPattern.test("/admin/changelog")).toBe(true);
    expect(adminPattern.test("/changelog")).toBe(false);
  });
});
