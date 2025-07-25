import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import ClientOrders from "@/components/User/UserOrdersTable";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe("ClientOrders Component", () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup default router mock
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  const mockOrders = [
    {
      id: "1",
      order_number: "ORD-001",
      order_type: "catering",
      status: "active",
      date: "2023-06-15",
      pickup_time: "10:00 AM",
      arrival_time: "11:00 AM",
      order_total: "100.00",
      client_attention: "Test Order",
      address: {
        street1: "123 Test St",
        city: "Test City",
        state: "TS",
      },
      delivery_address: null,
    },
    {
      id: "2",
      order_number: "ORD-002",
      order_type: "on_demand",
      status: "completed",
      date: "2023-06-16",
      pickup_time: "02:00 PM",
      arrival_time: "03:00 PM",
      order_total: "75.50",
      client_attention: "Another Test Order",
      address: {
        street1: "456 Mock Ave",
        city: "Mock City",
        state: "MC",
      },
      delivery_address: {
        street1: "789 Delivery Rd",
        city: "Delivery City",
        state: "DL",
      },
    },
  ];

  test("renders loading state initially", async () => {
    // Setup fetch to simulate loading
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise(() => {}), // Never resolves to keep loading state
    );

    render(<ClientOrders />);

    // Check for loading spinner
    const loadingSpinner = screen.getByRole("status");
    expect(loadingSpinner).toBeInTheDocument();
  });

  test("renders orders successfully", async () => {
    // Mock successful fetch
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockOrders),
    });

    render(<ClientOrders />);

    // Wait for orders to load
    await waitFor(() => {
      expect(screen.getByText("ORD-001")).toBeInTheDocument();
      expect(screen.getByText("ORD-002")).toBeInTheDocument();
    });
  });

  test("renders empty state when no orders", async () => {
    // Mock fetch with empty array
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<ClientOrders />);

    // Wait for and check empty state
    await waitFor(() => {
      expect(screen.getByText("No orders found")).toBeInTheDocument();
      expect(
        screen.getByText(
          "You don't have any orders at the moment. Check back soon or contact us if you need support.",
        ),
      ).toBeInTheDocument();
    });
  });

  test("handles fetch error", async () => {
    // Mock fetch error
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Fetch failed"),
    );

    render(<ClientOrders />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText("Error Loading Orders")).toBeInTheDocument();
      expect(
        screen.getByText("An unexpected error occurred while fetching orders"),
      ).toBeInTheDocument();
    });
  });

  test("back to dashboard button works correctly", async () => {
    // Mock fetch to return orders
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockOrders),
    });

    render(<ClientOrders />);

    // Wait for orders to load
    await waitFor(() => {
      expect(screen.getByText("ORD-001")).toBeInTheDocument();
    });

    // Find and click back to dashboard button
    const backButton = screen.getByRole("button", {
      name: /back to dashboard/i,
    });
    await userEvent.click(backButton);

    // Check router.push was called with correct route
    expect(mockRouter.push).toHaveBeenCalledWith("/client");
  });

  test("renders correct order details", async () => {
    // Mock fetch to return orders
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockOrders),
    });

    render(<ClientOrders />);

    // Wait for orders to load
    await waitFor(() => {
      // Check first order details
      expect(screen.getByText("ORD-001")).toBeInTheDocument();
      expect(screen.getByText("catering")).toBeInTheDocument();
      expect(screen.getByText("$100.00")).toBeInTheDocument();

      // Check second order details
      expect(screen.getByText("ORD-002")).toBeInTheDocument();
      expect(screen.getByText("on_demand")).toBeInTheDocument();
      expect(screen.getByText("$75.50")).toBeInTheDocument();
    });
  });

  test("page title and description are correct", async () => {
    // Mock fetch to return orders
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockOrders),
    });

    render(<ClientOrders />);

    // Wait for page to load
    await waitFor(() => {
      // Check page title
      expect(screen.getByText("Your Orders")).toBeInTheDocument();

      // Check page description
      expect(
        screen.getByText("View and manage your orders."),
      ).toBeInTheDocument();
    });
  });

  test("pagination bar is visible when there are more than 5 orders", async () => {
    const manyOrders = Array.from({ length: 10 }, (_, i) => ({
      ...mockOrders[0],
      id: `${i + 1}`,
      order_number: `ORD-00${i + 1}`,
    }));
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(manyOrders),
    });
    render(<ClientOrders />);
    await waitFor(() => {
      expect(screen.getByText("ORD-001")).toBeInTheDocument();
    });
    // Pagination state and buttons should be visible
    expect(screen.getByText(/1 of 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
  });

  test("pagination state updates and buttons work", async () => {
    const manyOrders = Array.from({ length: 10 }, (_, i) => ({
      ...mockOrders[0],
      id: `${i + 1}`,
      order_number: `ORD-00${i + 1}`,
    }));
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(manyOrders),
    });
    render(<ClientOrders />);
    await waitFor(() => {
      expect(screen.getByText("ORD-001")).toBeInTheDocument();
    });
    // Click next page
    const nextButton = screen.getByRole("button", { name: /next/i });
    await userEvent.click(nextButton);
    // Should show page 2 of 2
    await waitFor(() => {
      expect(screen.getByText(/2 of 2/)).toBeInTheDocument();
    });
    // Previous button should be enabled
    const prevButton = screen.getByRole("button", { name: /previous/i });
    expect(prevButton).not.toBeDisabled();
    // Next button should be disabled on last page
    expect(nextButton).toBeDisabled();
    // Click previous page
    await userEvent.click(prevButton);
    await waitFor(() => {
      expect(screen.getByText(/1 of 2/)).toBeInTheDocument();
    });
  });

  test("pagination bar is hidden when there are no orders", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });
    render(<ClientOrders />);
    await waitFor(() => {
      expect(screen.getByText("No orders found")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /previous/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/of/)).not.toBeInTheDocument();
  });
});
