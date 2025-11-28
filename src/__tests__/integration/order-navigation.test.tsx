import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock Next.js navigation
const mockPush = jest.fn();
const mockPathname = jest.fn();
const mockUseParams = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
  useParams: () => mockUseParams(),
}));

// Mock Next.js Link component
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <a
      href={href}
      className={className}
      data-testid="order-link"
      onClick={(e) => {
        e.preventDefault();
        if (onClick) onClick();
        mockPush(href);
      }}
    >
      {children}
    </a>
  ),
}));

// Mock components to avoid complexity in integration test
jest.mock("@/components/Orders/SingleOrder", () => ({
  __esModule: true,
  default: ({ onDeleteSuccess }: { onDeleteSuccess: () => void }) => (
    <div data-testid="single-order-component">
      <h1>Order Details</h1>
      <button onClick={onDeleteSuccess} data-testid="delete-order-btn">
        Delete Order
      </button>
    </div>
  ),
}));

jest.mock("@/components/Orders/OnDemand/SingleOnDemandOrder", () => ({
  __esModule: true,
  default: ({ onDeleteSuccess }: { onDeleteSuccess: () => void }) => (
    <div data-testid="single-ondemand-order-component">
      <h1>On-Demand Order Details</h1>
      <button onClick={onDeleteSuccess} data-testid="delete-order-btn">
        Delete Order
      </button>
    </div>
  ),
}));

// Mock Framer Motion
jest.mock("framer-motion", () => ({
  motion: {
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

/**
 * TODO: REA-211 - Integration tests need complete mock infrastructure
 * These tests have issues with:
 * 1. API fetch mocking not being applied correctly
 * 2. URL encoding errors in test data
 * 3. Complex component dependency chains
 */
describe.skip("Order Navigation Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/orders/catering-orders")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: [
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
                {
                  id: "3",
                  order_number: "CV-0GF59K&1",
                  status: "confirmed",
                  date: "2024-01-17T12:00:00Z",
                  order_total: "400.00",
                  client_attention: "Bob Johnson",
                },
              ],
              totalPages: 1,
            }),
        });
      }

      if (url.includes("/api/orders/on-demand-orders")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: [
                {
                  id: "1",
                  order_number: "OD-0GF59K/1",
                  status: "active",
                  date: "2024-01-15",
                  pickup_time: "10:00:00",
                  order_total: "150.00",
                  user: { name: "John Doe" },
                },
                {
                  id: "2",
                  order_number: "OD-0GF59K+1",
                  status: "assigned",
                  date: "2024-01-16",
                  pickup_time: "11:00:00",
                  order_total: "200.00",
                  user: { name: "Jane Smith" },
                },
              ],
              totalPages: 1,
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  describe("Catering Orders Navigation Flow", () => {
    it("should navigate from catering orders list to order details with encoded URLs", async () => {
      // Import and render CateringOrdersTable
      const { CateringOrdersTable } = await import(
        "@/components/Orders/CateringOrders/CateringOrdersTable"
      );

      const mockUserRoles = {
        isAdmin: true,
        isSuperAdmin: false,
        helpdesk: false,
      };

      const orders = [
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
          orders={orders}
          isLoading={false}
          statusFilter="all"
          onStatusFilterChange={() => {}}
          userRoles={mockUserRoles}
          onOrderDeleted={() => {}}
        />,
      );

      // Find and click the order link
      const orderLink = screen.getByText("CV-0GF59K/1").closest("a");
      expect(orderLink).toHaveAttribute(
        "href",
        "/admin/catering-orders/CV-0GF59K%252F1",
      );

      // Click the link
      await userEvent.click(orderLink!);

      // Verify navigation was called with encoded URL
      expect(mockPush).toHaveBeenCalledWith(
        "/admin/catering-orders/CV-0GF59K%252F1",
      );
    });

    it("should handle the complete flow from table to detail page", async () => {
      // Step 1: Simulate being on the catering orders detail page
      mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%252F1");

      // Mock useParams to return the order_number parameter
      mockUseParams.mockReturnValue({
        order_number: "CV-0GF59K%252F1",
      });

      // Import and render the order detail page
      const OrderPage = await import(
        "@/app/(backend)/admin/catering-orders/[order_number]/page"
      );

      render(<OrderPage.default />);

      // Wait for the component to update with the decoded order number
      await waitFor(() => {
        expect(screen.getByText("Order CV-0GF59K/1")).toBeInTheDocument();
      });

      // Verify SingleOrder component is rendered
      expect(screen.getByTestId("single-order-component")).toBeInTheDocument();
    });

    it("should handle navigation back to orders list after delete", async () => {
      mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%252F1");

      // Mock useParams to return the order_number parameter
      mockUseParams.mockReturnValue({
        order_number: "CV-0GF59K%252F1",
      });

      const OrderPage = await import(
        "@/app/(backend)/admin/catering-orders/[order_number]/page"
      );

      render(<OrderPage.default />);

      // Click delete button to trigger onDeleteSuccess
      const deleteButton = screen.getByTestId("delete-order-btn");
      await userEvent.click(deleteButton);

      // Verify navigation back to orders list
      expect(mockPush).toHaveBeenCalledWith("/admin/catering-orders");
    });
  });

  describe("On-Demand Orders Navigation Flow", () => {
    it("should navigate from on-demand orders list to order details with encoded URLs", async () => {
      // Mock the OnDemandOrders component's fetch behavior
      const OnDemandOrdersPage = await import(
        "@/components/Orders/OnDemand/OnDemandOrders"
      );

      render(<OnDemandOrdersPage.default />);

      // Wait for orders to load
      await waitFor(() => {
        expect(screen.getByText("OD-0GF59K/1")).toBeInTheDocument();
      });

      // Find the order link
      const orderLinks = screen.getAllByTestId("order-link");
      const targetLink = orderLinks.find(
        (link) => link.textContent === "OD-0GF59K/1",
      );

      expect(targetLink).toHaveAttribute(
        "href",
        "/admin/on-demand-orders/OD-0GF59K%2F1",
      );

      // Click the link
      await userEvent.click(targetLink!);

      expect(mockPush).toHaveBeenCalledWith(
        "/admin/on-demand-orders/OD-0GF59K%2F1",
      );
    });

    it("should handle plus signs in order numbers", async () => {
      const OnDemandOrdersPage = await import(
        "@/components/Orders/OnDemand/OnDemandOrders"
      );

      render(<OnDemandOrdersPage.default />);

      await waitFor(() => {
        expect(screen.getByText("OD-0GF59K+1")).toBeInTheDocument();
      });

      const orderLinks = screen.getAllByTestId("order-link");
      const targetLink = orderLinks.find(
        (link) => link.textContent === "OD-0GF59K+1",
      );

      expect(targetLink).toHaveAttribute(
        "href",
        "/admin/on-demand-orders/OD-0GF59K%2B1",
      );
    });
  });

  describe("Cross-Component Consistency", () => {
    it("should maintain consistent encoding/decoding across different components", async () => {
      const testOrderNumber = "CV-0GF59K/1&test+more#end";
      const encodedOrderNumber = "CV-0GF59K%252F1%2526test%252Bmore%2523end";

      // Test table component encoding
      const { CateringOrdersTable } = await import(
        "@/components/Orders/CateringOrders/CateringOrdersTable"
      );

      const orders = [
        {
          id: "1",
          order_number: testOrderNumber,
          status: "active",
          date: "2024-01-15T10:00:00Z",
          order_total: "250.00",
          client_attention: "John Doe",
        },
      ];

      const { rerender } = render(
        <CateringOrdersTable
          orders={orders}
          isLoading={false}
          statusFilter="all"
          onStatusFilterChange={() => {}}
          userRoles={{ isAdmin: true, isSuperAdmin: false, helpdesk: false }}
          onOrderDeleted={() => {}}
        />,
      );

      // Verify table encodes correctly
      const tableLink = screen.getByText(testOrderNumber).closest("a");
      expect(tableLink).toHaveAttribute(
        "href",
        `/admin/catering-orders/${encodedOrderNumber}`,
      );

      // Test page component decoding
      mockPathname.mockReturnValue(
        `/admin/catering-orders/${encodedOrderNumber}`,
      );

      // Mock useParams to return the order_number parameter
      mockUseParams.mockReturnValue({
        order_number: encodedOrderNumber,
      });

      const OrderPage = await import(
        "@/app/(backend)/admin/catering-orders/[order_number]/page"
      );

      rerender(<OrderPage.default />);

      // Wait for the component to update with the decoded order number
      await waitFor(() => {
        expect(
          screen.getByText(`Order ${testOrderNumber}`),
        ).toBeInTheDocument();
      });
    });

    it("should handle empty and edge case order numbers", async () => {
      const edgeCases = [
        { orderNumber: "", encoded: "" },
        { orderNumber: "/", encoded: "%252F" },
        { orderNumber: "///", encoded: "%252F%252F%252F" },
        { orderNumber: "normal-order", encoded: "normal-order" },
      ];

      for (const testCase of edgeCases) {
        if (testCase.orderNumber) {
          const { CateringOrdersTable } = await import(
            "@/components/Orders/CateringOrders/CateringOrdersTable"
          );

          const orders = [
            {
              id: "1",
              order_number: testCase.orderNumber,
              status: "active",
              date: "2024-01-15T10:00:00Z",
              order_total: "250.00",
              client_attention: "John Doe",
            },
          ];

          const { unmount } = render(
            <CateringOrdersTable
              orders={orders}
              isLoading={false}
              statusFilter="all"
              onStatusFilterChange={() => {}}
              userRoles={{
                isAdmin: true,
                isSuperAdmin: false,
                helpdesk: false,
              }}
              onOrderDeleted={() => {}}
            />,
          );

          if (testCase.orderNumber) {
            const link = screen.getByText(testCase.orderNumber).closest("a");
            expect(link).toHaveAttribute(
              "href",
              `/admin/catering-orders/${testCase.encoded || testCase.orderNumber}`,
            );
          }

          unmount();
        }
      }
    });
  });

  describe("Error Handling in Navigation", () => {
    it("should handle API errors gracefully during navigation", async () => {
      // Mock API error
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const OnDemandOrdersPage = await import(
        "@/components/Orders/OnDemand/OnDemandOrders"
      );

      render(<OnDemandOrdersPage.default />);

      // Wait for the debounced fetch call (300ms + buffer)
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );
    });

    it("should handle malformed URLs gracefully", async () => {
      // Test with malformed encoded URL
      mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%");

      // Mock useParams to return the malformed order_number parameter
      mockUseParams.mockReturnValue({
        order_number: "CV-0GF59K%",
      });

      const OrderPage = await import(
        "@/app/(backend)/admin/catering-orders/[order_number]/page"
      );

      // Should not throw error even with malformed encoding
      expect(() => render(<OrderPage.default />)).not.toThrow();
    });
  });
});
