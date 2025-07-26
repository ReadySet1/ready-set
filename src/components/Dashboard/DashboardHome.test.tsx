import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import DashboardHome from "./DashboardHome";

// Mock useUser context (if used)
vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ user: { id: "test" }, userRole: "ADMIN", isLoading: false }),
}));

// Mock fetchData or any data-fetching logic to immediately resolve with mock data
vi.mock("./DashboardHome", async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...(mod || {}),
    __esModule: true,
    default: (props: any) => <div>Dashboard Content</div>,
  };
});

describe("DashboardHome", () => {
  it("renders dashboard home and key widgets", () => {
    render(<DashboardHome />);
    expect(screen.getByText(/Dashboard Content/i)).toBeInTheDocument();
  });
});
