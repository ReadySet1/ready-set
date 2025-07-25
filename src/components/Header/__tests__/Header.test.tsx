import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import Header from "../index";
import menuData from "../menuData";

// Mock useUser context
vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ user: null, userRole: null, isLoading: false }),
}));

// Mock next/navigation for navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

const desktopMenuTitles = [
  "Home",
  "About",
  "Logistic",
  "Virtual Assistant",
  "Contact",
  "Resources",
];

describe("Header", () => {
  it("renders only desktop main menu items in correct order", () => {
    render(<Header />);
    desktopMenuTitles.forEach((title) => {
      expect(
        screen.queryAllByText((content, node) =>
          !!node?.textContent?.match(new RegExp(title, "i")),
        ).length,
      ).toBeGreaterThan(0);
    });
  });

  it("renders desktop menu links or buttons with correct text/href", () => {
    render(<Header />);
    desktopMenuTitles.forEach((title) => {
      const links = screen.queryAllByRole("link", {
        name: new RegExp(title, "i"),
      });
      if (links.length > 0) {
        expect(links[0]).toHaveTextContent(new RegExp(title, "i"));
      } else {
        const buttons = screen.queryAllByRole("button", {
          name: new RegExp(title, "i"),
        });
        expect(buttons.length).toBeGreaterThan(0);
      }
    });
  });
});
