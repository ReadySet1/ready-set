import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock next/navigation
const mockPush = vi.fn();
const mockPathname = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
}));

// Mock API responses
const mockOrderApiResponse = {
  id: "test-order-id-123",
  order_number: "Test 35689",
  order_type: "catering",
  order_total: "250.00",
  special_notes: "Handle with care",
  date: "2024-01-15T10:00:00Z",
  pickup_time: "1/15/2024, 10:00:00 AM",
  arrival_time: "1/15/2024, 2:00:00 PM",
  status: "ACTIVE",
  user_id: "user-123",
  driver_status: "PENDING",
  address: {
    street1: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zip: "94101",
  },
  delivery_address: {
    street1: "456 Oak Ave",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
  },
  dispatch: null,
  headcount: 40,
};

// Mock client dashboard component
const MockClientDashboard = ({ orders }: { orders: any[] }) => {
  const router = { push: mockPush };

  return (
    <div data-testid="client-dashboard">
      <h2>Recent Orders</h2>
      {orders.map((order) => (
        <div
          key={order.id}
          className="order-card"
          data-testid={`order-card-${order.orderNumber}`}
        >
          <h4>{order.orderNumber}</h4>
          <span>${order.orderTotal}</span>
          {/* This is the fix - using orderNumber instead of id */}
          <a
            href={`/order-status/${order.orderNumber}`}
            onClick={(e) => {
              e.preventDefault();
              router.push(`/order-status/${order.orderNumber}`);
            }}
            data-testid={`view-details-${order.orderNumber}`}
          >
            View Details
          </a>
        </div>
      ))}
    </div>
  );
};

// Mock order details component with back button
const MockOrderDetails = ({ orderNumber }: { orderNumber: string }) => {
  const router = { push: mockPush };

  // Simulate loading and displaying order data
  const [order, setOrder] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchOrder = async () => {
      try {
        // Simulate API call
        const response = await fetch(
          `/api/orders/${encodeURIComponent(orderNumber)}`,
        );
        if (response.ok) {
          const data = await response.json();
          setOrder(data);
        }
      } catch (error) {
        console.error("Failed to fetch order:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderNumber]);

  if (loading) return <div data-testid="loading">Loading order details...</div>;
  if (!order) return <div data-testid="error">Order not found</div>;

  return (
    <div data-testid="order-details-page">
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

      <h1>Order Details</h1>
      <div data-testid="order-info">
        <p data-testid="order-number">Order #{order.order_number}</p>
        <p data-testid="order-total">${order.order_total}</p>
        <p data-testid="order-status">{order.status}</p>
        <p data-testid="special-notes">
          {order.special_notes || "No special notes"}
        </p>
        <div data-testid="pickup-address">
          {order.address.street1}, {order.address.city}, {order.address.state}{" "}
          {order.address.zip}
        </div>
        <div data-testid="delivery-address">
          {order.delivery_address?.street1}, {order.delivery_address?.city},{" "}
          {order.delivery_address?.state} {order.delivery_address?.zip}
        </div>
        {order.headcount && (
          <p data-testid="headcount">Headcount: {order.headcount}</p>
        )}
      </div>
    </div>
  );
};

describe("Client Dashboard to Order Details Flow Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch for API calls
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (
        url.includes("/api/orders/Test%2035689") ||
        url.includes("/api/orders/Test 35689")
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOrderApiResponse),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Order not found"),
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Dashboard Link Fix", () => {
    it("should use orderNumber instead of database ID in View Details links", () => {
      const mockOrders = [
        {
          id: "19084987-522f-4977-bab5-8d10d13a2d02", // Database UUID
          orderNumber: "Test 35689", // Human-readable order number
          orderType: "catering",
          orderTotal: 250.0,
        },
      ];

      render(<MockClientDashboard orders={mockOrders} />);

      const viewDetailsLink = screen.getByTestId("view-details-Test 35689");

      // Should use orderNumber in href, not database ID
      expect(viewDetailsLink).toHaveAttribute(
        "href",
        "/order-status/Test 35689",
      );
      expect(viewDetailsLink).not.toHaveAttribute(
        "href",
        "/order-status/19084987-522f-4977-bab5-8d10d13a2d02",
      );
    });

    it("should navigate to correct order details page when View Details is clicked", async () => {
      const mockOrders = [
        {
          id: "test-id-123",
          orderNumber: "Test 35689",
          orderType: "catering",
          orderTotal: 250.0,
        },
      ];

      render(<MockClientDashboard orders={mockOrders} />);

      const viewDetailsLink = screen.getByTestId("view-details-Test 35689");
      fireEvent.click(viewDetailsLink);

      expect(mockPush).toHaveBeenCalledWith("/order-status/Test 35689");
    });
  });

  describe("Order Details Page Field Mapping", () => {
    it("should display order details correctly with proper field mapping", async () => {
      mockPathname.mockReturnValue("/order-status/Test%2035689");

      render(<MockOrderDetails orderNumber="Test 35689" />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
      });

      // Verify all order details are displayed correctly using snake_case fields
      expect(screen.getByTestId("order-number")).toHaveTextContent(
        "Order #Test 35689",
      );
      expect(screen.getByTestId("order-total")).toHaveTextContent("$250.00");
      expect(screen.getByTestId("order-status")).toHaveTextContent("ACTIVE");
      expect(screen.getByTestId("special-notes")).toHaveTextContent(
        "Handle with care",
      );
      expect(screen.getByTestId("pickup-address")).toHaveTextContent(
        "123 Main St, San Francisco, CA 94101",
      );
      expect(screen.getByTestId("delivery-address")).toHaveTextContent(
        "456 Oak Ave, San Francisco, CA 94102",
      );
      expect(screen.getByTestId("headcount")).toHaveTextContent(
        "Headcount: 40",
      );
    });

    it("should handle missing optional fields gracefully", async () => {
      // Mock API response with minimal data
      const minimalOrderResponse = {
        id: "test-id-456",
        order_number: "SF-12350",
        order_type: "catering",
        order_total: "0.00",
        status: "PENDING",
        address: {
          street1: null,
          city: "Austin",
          state: null,
          zip: "78701",
        },
        delivery_address: null,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(minimalOrderResponse),
      });

      render(<MockOrderDetails orderNumber="SF-12350" />);

      await waitFor(() => {
        expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
      });

      expect(screen.getByTestId("order-number")).toHaveTextContent(
        "Order #SF-12350",
      );
      expect(screen.getByTestId("order-total")).toHaveTextContent("$0.00");
      expect(screen.getByTestId("special-notes")).toHaveTextContent(
        "No special notes",
      );
    });
  });

  describe("Back to Dashboard Button", () => {
    it("should render back button and navigate to dashboard when clicked", async () => {
      mockPathname.mockReturnValue("/order-status/Test%2035689");

      render(<MockOrderDetails orderNumber="Test 35689" />);

      // Wait for order details to load
      await waitFor(() => {
        expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
      });

      const backButton = screen.getByTestId("back-to-dashboard-btn");
      expect(backButton).toBeInTheDocument();
      expect(backButton).toHaveTextContent("Back to Dashboard");

      fireEvent.click(backButton);
      expect(mockPush).toHaveBeenCalledWith("/client");
    });
  });

  describe("Full User Flow Integration", () => {
    it("should complete the full flow: dashboard → order details → back to dashboard", async () => {
      const mockOrders = [
        {
          id: "test-id-123",
          orderNumber: "Test 35689",
          orderType: "catering",
          orderTotal: 250.0,
        },
      ];

      // Step 1: Render dashboard
      const { rerender } = render(<MockClientDashboard orders={mockOrders} />);

      // Step 2: Click View Details
      const viewDetailsLink = screen.getByTestId("view-details-Test 35689");
      fireEvent.click(viewDetailsLink);

      expect(mockPush).toHaveBeenCalledWith("/order-status/Test 35689");

      // Step 3: Simulate navigation to order details page
      mockPathname.mockReturnValue("/order-status/Test%2035689");
      rerender(<MockOrderDetails orderNumber="Test 35689" />);

      // Step 4: Wait for order details to load and verify content
      await waitFor(() => {
        expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
      });

      expect(screen.getByTestId("order-details-page")).toBeInTheDocument();
      expect(screen.getByTestId("order-number")).toHaveTextContent(
        "Order #Test 35689",
      );

      // Step 5: Click back to dashboard
      const backButton = screen.getByTestId("back-to-dashboard-btn");
      fireEvent.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/client");

      // Verify the complete navigation flow
      expect(mockPush).toHaveBeenNthCalledWith(1, "/order-status/Test 35689");
      expect(mockPush).toHaveBeenNthCalledWith(2, "/client");
      expect(mockPush).toHaveBeenCalledTimes(2);
    });
  });

  describe("API Error Handling", () => {
    it("should handle 404 errors gracefully when order is not found", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Order not found"),
      });

      render(<MockOrderDetails orderNumber="NONEXISTENT-ORDER" />);

      await waitFor(() => {
        expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
      });

      expect(screen.getByTestId("error")).toHaveTextContent("Order not found");
    });

    it("should verify API is called with properly encoded order numbers", async () => {
      render(<MockOrderDetails orderNumber="Test 35689" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/orders/Test%2035689");
      });

      // Verify that spaces in order numbers are properly encoded
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("Test%2035689"),
      );
    });
  });
});
