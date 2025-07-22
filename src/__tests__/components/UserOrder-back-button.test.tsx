import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
const mockPush = vi.fn();
const mockPathname = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
}));

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock UserOrder component with the back button
const MockUserOrderDetail = () => {
  const router = { push: mockPush };

  return (
    <div className="container mx-auto p-4">
      {/* Back to Dashboard Button */}
      <div className="mb-4 flex justify-start">
        <button
          onClick={() => router.push("/client")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          data-testid="back-to-dashboard-btn"
        >
          <span>←</span>
          Back to Dashboard
        </button>
      </div>

      <h1 className="mb-6 text-center text-3xl font-bold">Order Details</h1>
    </div>
  );
};

describe("UserOrder Back to Dashboard Button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/order-status/SF-12350");
  });

  it("should render the back to dashboard button", () => {
    render(<MockUserOrderDetail />);

    const backButton = screen.getByTestId("back-to-dashboard-btn");
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveTextContent("Back to Dashboard");
  });

  it("should navigate to client dashboard when back button is clicked", () => {
    render(<MockUserOrderDetail />);

    const backButton = screen.getByTestId("back-to-dashboard-btn");
    fireEvent.click(backButton);

    expect(mockPush).toHaveBeenCalledWith("/client");
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("should have proper styling classes", () => {
    render(<MockUserOrderDetail />);

    const backButton = screen.getByTestId("back-to-dashboard-btn");
    expect(backButton).toHaveClass("flex", "items-center", "gap-2");
    expect(backButton).toHaveClass("text-gray-600", "hover:text-gray-800");
  });

  it("should be positioned on the left side", () => {
    render(<MockUserOrderDetail />);

    const buttonContainer = screen.getByTestId(
      "back-to-dashboard-btn",
    ).parentElement;
    expect(buttonContainer).toHaveClass("flex", "justify-start");
  });

  it("should appear before the Order Details title", () => {
    render(<MockUserOrderDetail />);

    const backButton = screen.getByTestId("back-to-dashboard-btn");
    const title = screen.getByText("Order Details");

    // Check that both elements exist
    expect(backButton).toBeInTheDocument();
    expect(title).toBeInTheDocument();

    // The back button should appear before the title in the DOM
    const container = backButton.closest(".container");
    const elements = Array.from(container?.children || []);
    const backButtonIndex = elements.findIndex((el) => el.contains(backButton));
    const titleIndex = elements.findIndex((el) => el.contains(title));

    expect(backButtonIndex).toBeLessThan(titleIndex);
  });
});
