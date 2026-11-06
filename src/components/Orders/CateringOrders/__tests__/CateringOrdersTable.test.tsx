import React from "react";
import { render, screen } from "@testing-library/react";
import { CateringOrdersTable } from "../CateringOrdersTable";
import { simulateBrowserTimezone } from "@/__tests__/utils/browser-timezone";
import { Order, StatusFilter, UserRole } from "../types";

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
    <a href={href} className={className} data-testid="order-link">
      {children}
    </a>
  ),
}));

// Mock CarrierOrdersBadge component
jest.mock("@/components/Dashboard/CarrierManagement/CarrierOrdersBadge", () => ({
  CarrierOrdersBadge: () => (
    <div data-testid="carrier-badge">Carrier Badge</div>
  ),
}));

describe("CateringOrdersTable - URL Encoding", () => {
  const mockUserRoles: UserRole = {
    isAdmin: true,
    isSuperAdmin: false,
    helpdesk: false,
  };

  const mockOnStatusFilterChange = jest.fn();
  const mockOnOrderDeleted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should encode order numbers with forward slashes in URLs", () => {
    const mockOrders: Order[] = [
      {
        id: "1",
        order_number: "CV-0GF59K/1",
        status: "active",
        date: "2024-01-15T10:00:00Z",
        order_total: "250.00",
        client_attention: "John Doe",
      },
      {
        id: "2",
        order_number: "CV-0GF59K/1/2",
        status: "pending",
        date: "2024-01-16T11:00:00Z",
        order_total: "300.00",
        client_attention: "Jane Smith",
      },
    ];

    render(
      <CateringOrdersTable
        orders={mockOrders}
        isLoading={false}
        statusFilter="all"
        onStatusFilterChange={mockOnStatusFilterChange}
        userRoles={mockUserRoles}
        onOrderDeleted={mockOnOrderDeleted}
      />,
    );

    // Get all order links
    const orderLinks = screen.getAllByTestId("order-link");

    // Verify first order link - single slash
    expect(orderLinks[0]).toHaveAttribute(
      "href",
      "/admin/catering-orders/CV-0GF59K%2F1",
    );
    expect(orderLinks[0]).toHaveTextContent("CV-0GF59K/1");

    // Verify second order link - multiple slashes
    expect(orderLinks[1]).toHaveAttribute(
      "href",
      "/admin/catering-orders/CV-0GF59K%2F1%2F2",
    );
    expect(orderLinks[1]).toHaveTextContent("CV-0GF59K/1/2");
  });

  it("should handle order numbers with various special characters", () => {
    const mockOrders: Order[] = [
      {
        id: "1",
        order_number: "CV-0GF59K&1",
        status: "active",
        date: "2024-01-15T10:00:00Z",
        order_total: "250.00",
        client_attention: "John Doe",
      },
      {
        id: "2",
        order_number: "CV-0GF59K+1",
        status: "pending",
        date: "2024-01-16T11:00:00Z",
        order_total: "300.00",
        client_attention: "Jane Smith",
      },
      {
        id: "3",
        order_number: "CV-0GF59K#1",
        status: "confirmed",
        date: "2024-01-17T12:00:00Z",
        order_total: "400.00",
        client_attention: "Bob Johnson",
      },
    ];

    render(
      <CateringOrdersTable
        orders={mockOrders}
        isLoading={false}
        statusFilter="all"
        onStatusFilterChange={mockOnStatusFilterChange}
        userRoles={mockUserRoles}
        onOrderDeleted={mockOnOrderDeleted}
      />,
    );

    const orderLinks = screen.getAllByTestId("order-link");

    // Verify ampersand encoding
    expect(orderLinks[0]).toHaveAttribute(
      "href",
      "/admin/catering-orders/CV-0GF59K%261",
    );
    expect(orderLinks[0]).toHaveTextContent("CV-0GF59K&1");

    // Verify plus sign encoding
    expect(orderLinks[1]).toHaveAttribute(
      "href",
      "/admin/catering-orders/CV-0GF59K%2B1",
    );
    expect(orderLinks[1]).toHaveTextContent("CV-0GF59K+1");

    // Verify hash encoding
    expect(orderLinks[2]).toHaveAttribute(
      "href",
      "/admin/catering-orders/CV-0GF59K%231",
    );
    expect(orderLinks[2]).toHaveTextContent("CV-0GF59K#1");
  });

  it("should handle normal order numbers without special characters", () => {
    const mockOrders: Order[] = [
      {
        id: "1",
        order_number: "CV-0GF59K1",
        status: "active",
        date: "2024-01-15T10:00:00Z",
        order_total: "250.00",
        client_attention: "John Doe",
      },
    ];

    render(
      <CateringOrdersTable
        orders={mockOrders}
        isLoading={false}
        statusFilter="all"
        onStatusFilterChange={mockOnStatusFilterChange}
        userRoles={mockUserRoles}
        onOrderDeleted={mockOnOrderDeleted}
      />,
    );

    const orderLink = screen.getByTestId("order-link");

    // Normal order numbers should still be encoded but remain the same
    expect(orderLink).toHaveAttribute(
      "href",
      "/admin/catering-orders/CV-0GF59K1",
    );
    expect(orderLink).toHaveTextContent("CV-0GF59K1");
  });

  it("should display orders correctly when loading is false", () => {
    const mockOrders: Order[] = [
      {
        id: "1",
        order_number: "CV-0GF59K/1",
        status: "active",
        date: "2024-01-15T10:00:00Z",
        order_total: "250.00",
        client_attention: "John Doe",
      },
    ];

    render(
      <CateringOrdersTable
        orders={mockOrders}
        isLoading={false}
        statusFilter="all"
        onStatusFilterChange={mockOnStatusFilterChange}
        userRoles={mockUserRoles}
        onOrderDeleted={mockOnOrderDeleted}
      />,
    );

    // Verify table content is displayed (use getAllByText since order number appears multiple times)
    expect(screen.getAllByText("CV-0GF59K/1").length).toBeGreaterThan(0);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("$250.00")).toBeInTheDocument();
  });

  it("should show loading message when isLoading is true", () => {
    render(
      <CateringOrdersTable
        orders={[]}
        isLoading={true}
        statusFilter="all"
        onStatusFilterChange={mockOnStatusFilterChange}
        userRoles={mockUserRoles}
        onOrderDeleted={mockOnOrderDeleted}
      />,
    );

    expect(screen.getByText("Loading catering orders...")).toBeInTheDocument();
  });

  it("should show no orders message when orders array is empty", () => {
    render(
      <CateringOrdersTable
        orders={[]}
        isLoading={false}
        statusFilter="all"
        onStatusFilterChange={mockOnStatusFilterChange}
        userRoles={mockUserRoles}
        onOrderDeleted={mockOnOrderDeleted}
      />,
    );

    expect(screen.getByText("No orders found.")).toBeInTheDocument();
  });
});

describe("CateringOrdersTable - order date timezone", () => {
  // 06:30Z = Oct 7, 11:30 PM in Pacific, but Oct 8 in Tokyo (and in UTC).
  const ORDER_DATE = "2026-10-08T06:30:00.000Z";

  beforeEach(() => {
    simulateBrowserTimezone("Asia/Tokyo");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows the order date in the app timezone (Pacific), not the browser timezone", () => {
    const orders: Order[] = [
      {
        id: "tz-1",
        order_number: "CAT-TZ-1",
        status: "active",
        date: ORDER_DATE,
        order_total: "10.00",
        client_attention: "Tz Tester",
      },
    ];

    render(
      <CateringOrdersTable
        orders={orders}
        isLoading={false}
        statusFilter="all"
        onStatusFilterChange={jest.fn()}
        userRoles={{ isAdmin: true, isSuperAdmin: false, helpdesk: false }}
        onOrderDeleted={jest.fn()}
      />,
    );

    expect(screen.getByText("Oct 7, 2026")).toBeInTheDocument();
    expect(screen.queryByText("10/8/2026")).not.toBeInTheDocument();
  });
});
