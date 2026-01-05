import React from "react";
import { render, screen } from "@testing-library/react";
import OrderPage from "../[order_number]/page";

// Mock Next.js navigation hooks
const mockPush = jest.fn();
const mockParams = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => mockParams(),
}));

// Mock SingleOrder component
jest.mock("@/components/Orders/SingleOrder", () => ({
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
jest.mock("next/link", () => ({
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
jest.mock("lucide-react", () => ({
  ArrowLeft: () => <span data-testid="arrow-left-icon">←</span>,
  Home: () => <span data-testid="home-icon">🏠</span>,
  ClipboardList: () => <span data-testid="clipboard-icon">📋</span>,
}));

// Mock order utility
jest.mock("@/utils/order", () => ({
  decodeOrderNumber: (orderNumber: string) => decodeURIComponent(orderNumber),
}));

// Mock shadcn UI components
jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/breadcrumb", () => ({
  Breadcrumb: ({ children }: { children: React.ReactNode }) => (
    <nav aria-label="Breadcrumb">{children}</nav>
  ),
  BreadcrumbList: ({ children }: { children: React.ReactNode }) => (
    <ol>{children}</ol>
  ),
  BreadcrumbItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  BreadcrumbLink: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <>{children}</>,
  BreadcrumbPage: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  BreadcrumbSeparator: () => <span>/</span>,
}));

describe("CateringOrderPage - URL Decoding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should decode order number with forward slash from URL", async () => {
    // Mock params with encoded order number
    mockParams.mockReturnValue({ order_number: "CV-0GF59K%2F1" });

    render(<OrderPage />);

    // Wait for useEffect to decode the order number
    await screen.findByText("Order CV-0GF59K/1");
    expect(screen.getByText("Order CV-0GF59K/1")).toBeInTheDocument();
  });

  it("should decode order number with multiple slashes from URL", async () => {
    mockParams.mockReturnValue({ order_number: "CV-0GF59K%2F1%2F2" });

    render(<OrderPage />);

    await screen.findByText("Order CV-0GF59K/1/2");
    expect(screen.getByText("Order CV-0GF59K/1/2")).toBeInTheDocument();
  });

  it("should decode order number with various special characters", async () => {
    // Test ampersand
    mockParams.mockReturnValue({ order_number: "CV-0GF59K%261" });
    const { rerender, unmount } = render(<OrderPage />);
    await screen.findByText("Order CV-0GF59K&1");
    expect(screen.getByText("Order CV-0GF59K&1")).toBeInTheDocument();

    // Test plus sign - need to unmount and re-render for state reset
    unmount();
    mockParams.mockReturnValue({ order_number: "CV-0GF59K%2B1" });
    render(<OrderPage />);
    await screen.findByText("Order CV-0GF59K+1");
    expect(screen.getByText("Order CV-0GF59K+1")).toBeInTheDocument();
  });

  it("should handle normal order numbers without special characters", async () => {
    mockParams.mockReturnValue({ order_number: "CV-0GF59K1" });

    render(<OrderPage />);

    await screen.findByText("Order CV-0GF59K1");
    expect(screen.getByText("Order CV-0GF59K1")).toBeInTheDocument();
  });

  it("should handle empty params gracefully", async () => {
    mockParams.mockReturnValue({});

    render(<OrderPage />);

    // Should show empty order number
    expect(screen.getByText("Order")).toBeInTheDocument();
  });

  it("should render SingleOrder component with correct props", async () => {
    mockParams.mockReturnValue({ order_number: "CV-0GF59K%2F1" });

    render(<OrderPage />);

    // Check that SingleOrder is rendered
    expect(screen.getByTestId("single-order")).toBeInTheDocument();
    expect(screen.getByTestId("show-header")).toHaveTextContent("false");
  });

  it("should handle delete success by redirecting to orders list", async () => {
    mockParams.mockReturnValue({ order_number: "CV-0GF59K%2F1" });

    render(<OrderPage />);

    // Simulate delete success
    const deleteHandler = screen.getByTestId("delete-handler");
    deleteHandler.click();

    expect(mockPush).toHaveBeenCalledWith("/admin/catering-orders");
  });

  it("should render navigation breadcrumbs correctly", async () => {
    mockParams.mockReturnValue({ order_number: "CV-0GF59K%2F1" });

    render(<OrderPage />);

    // Wait for order number to be decoded
    await screen.findByText("Order CV-0GF59K/1");

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

  it("should render back button with correct navigation", async () => {
    mockParams.mockReturnValue({ order_number: "CV-0GF59K%2F1" });

    render(<OrderPage />);

    // Check that back button exists
    expect(screen.getByTestId("arrow-left-icon")).toBeInTheDocument();

    // Find and click the back button
    const backButton = screen.getByRole("button");
    backButton.click();

    expect(mockPush).toHaveBeenCalledWith("/admin/catering-orders");
  });

  it("should handle edge case with special characters at the end of URL", async () => {
    mockParams.mockReturnValue({ order_number: "CV-0GF59K%2F1%2F" });

    render(<OrderPage />);

    await screen.findByText("Order CV-0GF59K/1/");
    expect(screen.getByText("Order CV-0GF59K/1/")).toBeInTheDocument();
  });

  it("should handle complex encoded order numbers", async () => {
    // Test with multiple different special characters
    mockParams.mockReturnValue({
      order_number: "CV-0GF59K%2F1%26test%2Bmore%23end",
    });

    render(<OrderPage />);

    await screen.findByText("Order CV-0GF59K/1&test+more#end");
    expect(
      screen.getByText("Order CV-0GF59K/1&test+more#end"),
    ).toBeInTheDocument();
  });
});
