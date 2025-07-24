import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { BackToDashboard } from "./BackToDashboard";

// Top-level push mock
let push = vi.fn();

// Mock useRouter from next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// Mock useUser context
const mockUseUser = vi.fn();
vi.mock("@/contexts/UserContext", () => ({
  useUser: () => mockUseUser(),
}));

// Mock getDashboardRouteByRole
const mockGetDashboardRouteByRole = vi.fn();
vi.mock("@/utils/navigation", () => ({
  getDashboardRouteByRole: (...args) => mockGetDashboardRouteByRole(...args),
}));

describe("BackToDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    push = vi.fn();
  });

  const roles = [
    { role: "ADMIN", name: "Admin Dashboard", path: "/admin/dashboard" },
    { role: "CLIENT", name: "Client Dashboard", path: "/client/dashboard" },
    { role: "VENDOR", name: "Vendor Dashboard", path: "/vendor/dashboard" },
    {
      role: "HELPDESK",
      name: "Helpdesk Dashboard",
      path: "/helpdesk/dashboard",
    },
    {
      role: "SUPER_ADMIN",
      name: "Super Admin Dashboard",
      path: "/super-admin/dashboard",
    },
    { role: "DRIVER", name: "Driver Dashboard", path: "/driver/dashboard" },
  ];

  roles.forEach(({ role, name, path }) => {
    it(`renders and navigates for user role ${role}`, () => {
      mockUseUser.mockReturnValue({
        user: { id: "test" },
        userRole: role,
        isLoading: false,
      });
      mockGetDashboardRouteByRole.mockReturnValue({ name, path });
      render(<BackToDashboard />);
      const button = screen.getByRole("button", {
        name: new RegExp(name, "i"),
      });
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(push).toHaveBeenCalledWith(path);
    });
  });

  it("navigates to home if no user role", () => {
    mockUseUser.mockReturnValue({
      user: { id: "test" },
      userRole: null,
      isLoading: false,
    });
    mockGetDashboardRouteByRole.mockReturnValue({ name: "", path: "/" });
    render(<BackToDashboard />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("shows loading state if loading", () => {
    mockUseUser.mockReturnValue({
      user: null,
      userRole: null,
      isLoading: true,
    });
    render(<BackToDashboard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
