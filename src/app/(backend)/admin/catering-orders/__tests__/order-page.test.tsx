import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import OrderPage from "../[order_number]/page";

// Mock Next.js navigation hooks
const mockPush = vi.fn();
const mockPathname = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
}));

// Mock SingleOrder component
vi.mock("@/components/Orders/SingleOrder", () => ({
  __esModule: true,
  default: ({
    onDeleteSuccess,
    showHeader,
  }: {
    onDeleteSuccess: () => void;
    showHeader: boolean;
  }) => (
    <div data-testid="single-order">
      <div data-testid="delete-handler" onClick={onDeleteSuccess}>
        Delete Order
      </div>
      <div data-testid="show-header">{showHeader ? "true" : "false"}</div>
    </div>
  ),
}));

// Mock Next.js Link component
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  ArrowLeft: () => <span data-testid="arrow-left-icon">←</span>,
  Home: () => <span data-testid="home-icon">🏠</span>,
  ClipboardList: () => <span data-testid="clipboard-icon">📋</span>,
}));

describe("CateringOrderPage - URL Decoding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should decode order number with forward slash from URL", () => {
    // Mock pathname to simulate encoded URL
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%2F1");

    render(<OrderPage />);

    // Check that the breadcrumb displays the decoded order number
    expect(screen.getByText("Order CV-0GF59K/1")).toBeInTheDocument();
  });

  it("should decode order number with multiple slashes from URL", () => {
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%2F1%2F2");

    render(<OrderPage />);

    expect(screen.getByText("Order CV-0GF59K/1/2")).toBeInTheDocument();
  });

  it("should decode order number with various special characters", () => {
    // Test ampersand
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%261");
    const { rerender } = render(<OrderPage />);
    expect(screen.getByText("Order CV-0GF59K&1")).toBeInTheDocument();

    // Test plus sign
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%2B1");
    rerender(<OrderPage />);
    expect(screen.getByText("Order CV-0GF59K+1")).toBeInTheDocument();

    // Test hash symbol
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%231");
    rerender(<OrderPage />);
    expect(screen.getByText("Order CV-0GF59K#1")).toBeInTheDocument();
  });

  it("should handle normal order numbers without special characters", () => {
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K1");

    render(<OrderPage />);

    expect(screen.getByText("Order CV-0GF59K1")).toBeInTheDocument();
  });

  it("should handle empty or invalid pathnames gracefully", () => {
    mockPathname.mockReturnValue("");

    render(<OrderPage />);

    // Should show empty order number
    expect(screen.getByText("Order ")).toBeInTheDocument();
  });

  it("should render SingleOrder component with correct props", () => {
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%2F1");

    render(<OrderPage />);

    // Check that SingleOrder is rendered
    expect(screen.getByTestId("single-order")).toBeInTheDocument();
    expect(screen.getByTestId("show-header")).toHaveTextContent("false");
  });

  it("should handle delete success by redirecting to orders list", () => {
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%2F1");

    render(<OrderPage />);

    // Simulate delete success
    const deleteHandler = screen.getByTestId("delete-handler");
    deleteHandler.click();

    expect(mockPush).toHaveBeenCalledWith("/admin/catering-orders");
  });

  it("should render navigation breadcrumbs correctly", () => {
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%2F1");

    render(<OrderPage />);

    // Check navigation links
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Catering Orders")).toBeInTheDocument();
    expect(screen.getByText("Order CV-0GF59K/1")).toBeInTheDocument();

    // Check that links have correct hrefs
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    const ordersLink = screen.getByText("Catering Orders").closest("a");

    expect(dashboardLink).toHaveAttribute("href", "/admin/");
    expect(ordersLink).toHaveAttribute("href", "/admin/catering-orders");
  });

  it("should render back button with correct navigation", () => {
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%2F1");

    render(<OrderPage />);

    // Check that back button exists
    expect(screen.getByTestId("arrow-left-icon")).toBeInTheDocument();

    // Find and click the back button
    const backButton = screen.getByRole("button");
    backButton.click();

    expect(mockPush).toHaveBeenCalledWith("/admin/catering-orders");
  });

  it("should handle edge case with special characters at the end of URL", () => {
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%2F1%2F");

    render(<OrderPage />);

    expect(screen.getByText("Order CV-0GF59K/1/")).toBeInTheDocument();
  });

  it("should handle complex encoded order numbers", () => {
    // Test with multiple different special characters
    mockPathname.mockReturnValue(
      "/admin/catering-orders/CV-0GF59K%2F1%26test%2Bmore%23end",
    );

    render(<OrderPage />);

    expect(
      screen.getByText("Order CV-0GF59K/1&test+more#end"),
    ).toBeInTheDocument();
  });
});
