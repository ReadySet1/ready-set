import React from "react";
import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import MobileMenu from "../MobileMenu";
import menuData from "../menuData";

// Mock useUser context
vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ user: null, userRole: null, isLoading: false }),
}));

// Mock next/navigation for navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("MobileMenu", () => {
  it("renders all main menu items", () => {
    render(
      <MobileMenu
        navbarOpen={true}
        menuData={menuData}
        openIndex={-1}
        handleSubmenu={() => {}}
        closeNavbarOnNavigate={() => {}}
        navbarToggleHandler={() => {}}
        pathUrl="/"
        sticky={false}
        isHomePage={false}
        isVirtualAssistantPage={false}
      />,
    );
    // Select the last nav (mobile)
    const navs = screen.getAllByRole("navigation");
    const nav = navs[navs.length - 1];
    menuData.forEach((item) => {
      expect(
        within(nav).queryAllByText((content, node) =>
          node?.textContent?.match(new RegExp(item.title, "i")),
        ).length,
      ).toBeGreaterThan(0);
    });
  });

  it("renders menu links or buttons with correct text/href", () => {
    render(
      <MobileMenu
        navbarOpen={true}
        menuData={menuData}
        openIndex={-1}
        handleSubmenu={() => {}}
        closeNavbarOnNavigate={() => {}}
        navbarToggleHandler={() => {}}
        pathUrl="/"
        sticky={false}
        isHomePage={false}
        isVirtualAssistantPage={false}
      />,
    );
    const navs = screen.getAllByRole("navigation");
    const nav = navs[navs.length - 1];
    menuData.forEach((item) => {
      const links = within(nav).queryAllByRole("link", {
        name: new RegExp(item.title, "i"),
      });
      if (item.path && links.length > 0) {
        expect(links[0]).toHaveAttribute("href", item.path);
      } else {
        const buttons = within(nav).queryAllByRole("button", {
          name: new RegExp(item.title, "i"),
        });
        expect(buttons.length).toBeGreaterThan(0);
      }
    });
  });
});
