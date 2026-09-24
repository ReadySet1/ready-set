/**
 * Forms QA E2: on phones the admin sidebar is an off-canvas sheet, but no
 * admin page rendered a working trigger, so every sidebar link (including
 * "New On-Demand Order") was unreachable.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AdminMobileTopBar } from "../admin-mobile-top-bar";

let pathname = "/admin";
jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));
jest.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));

function MobileState() {
  const { openMobile } = useSidebar();
  return <output data-testid="open-mobile">{String(openMobile)}</output>;
}

function renderBar() {
  return render(
    <SidebarProvider>
      <AdminMobileTopBar />
      <MobileState />
    </SidebarProvider>,
  );
}

describe("AdminMobileTopBar", () => {
  beforeEach(() => {
    pathname = "/admin";
  });

  it("opens the mobile sidebar from the menu button", () => {
    renderBar();

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));

    expect(screen.getByTestId("open-mobile")).toHaveTextContent("true");
  });

  it("closes the mobile sidebar after navigating", () => {
    const { rerender } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));

    pathname = "/admin/on-demand-orders/new";
    act(() => {
      rerender(
        <SidebarProvider>
          <AdminMobileTopBar />
          <MobileState />
        </SidebarProvider>,
      );
    });

    expect(screen.getByTestId("open-mobile")).toHaveTextContent("false");
  });

  it("is hidden from md breakpoint up, where the desktop sidebar shows", () => {
    renderBar();

    expect(screen.getByRole("banner")).toHaveClass("md:hidden");
  });
});
