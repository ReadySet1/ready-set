import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ClientOrdersPage from "../page";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock Breadcrumb component
jest.mock("@/components/Common/Breadcrumb", () => {
  return function MockBreadcrumb({ pageName }: { pageName: string }) {
    return <div data-testid="breadcrumb">{pageName}</div>;
  };
});

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("ClientOrdersPage", () => {
  const mockOrders = [
    {
      id: "1",
      orderNumber: "CAT001",
      order_type: "catering" as const,
      status: "ACTIVE",
      pickupDateTime: "2025-01-15T10:00:00Z",
      arrivalDateTime: "2025-01-15T11:00:00Z",
      orderTotal: 150.0,
      createdAt: "2025-01-15T09:00:00Z",
      pickupAddress: {
        address: "123 Pickup St",
        city: "San Francisco",
        state: "CA",
      },
      deliveryAddress: {
        address: "456 Delivery Ave",
        city: "San Francisco",
        state: "CA",
      },
    },
    {
      id: "2",
      orderNumber: "OND001",
      order_type: "on_demand" as const,
      status: "PENDING",
      pickupDateTime: "2025-01-16T10:00:00Z",
      arrivalDateTime: "2025-01-16T11:00:00Z",
      orderTotal: 75.5,
      createdAt: "2025-01-16T09:00:00Z",
      pickupAddress: {
        address: "789 Pickup Blvd",
        city: "Oakland",
        state: "CA",
      },
      deliveryAddress: {
        address: "012 Delivery Way",
        city: "Oakland",
        state: "CA",
      },
    },
  ];

  const mockPagination = {
    currentPage: 1,
    totalPages: 3,
    totalOrders: 12,
    hasNextPage: true,
    hasPrevPage: false,
    ordersPerPage: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should show loading spinner initially", () => {
      mockFetch.mockImplementation(
        () => new Promise(() => {}), // Never resolves to keep loading state
      );

      render(<ClientOrdersPage />);

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe("Successful Data Loading", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          orders: mockOrders,
          pagination: mockPagination,
        }),
      } as Response);
    });

    it("should render page title and description", async () => {
      render(<ClientOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText("Your Orders")).toBeInTheDocument();
        expect(
          screen.getByText("View and manage your orders."),
        ).toBeInTheDocument();
      });
    });

    it("should render back to dashboard link", async () => {
      render(<ClientOrdersPage />);

      await waitFor(() => {
        const backLink = screen.getByText("Back to Dashboard");
        expect(backLink).toBeInTheDocument();
        expect(backLink.closest("a")).toHaveAttribute("href", "/client");
      });
    });

    it("should render orders table with correct headers", async () => {
      render(<ClientOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText("Order Number")).toBeInTheDocument();
        expect(screen.getByText("Type")).toBeInTheDocument();
        expect(screen.getByText("Status")).toBeInTheDocument();
        expect(screen.getByText("Date")).toBeInTheDocument();
        expect(screen.getByText("Pickup")).toBeInTheDocument();
        expect(screen.getByText("Delivery")).toBeInTheDocument();
        expect(screen.getByText("Total")).toBeInTheDocument();
      });
    });

    it("should render order data correctly", async () => {
      render(<ClientOrdersPage />);

      await waitFor(() => {
        // Check order numbers
        expect(screen.getByText("CAT001")).toBeInTheDocument();
        expect(screen.getByText("OND001")).toBeInTheDocument();

        // Check order types
        expect(screen.getByText("catering")).toBeInTheDocument();
        expect(screen.getByText("on_demand")).toBeInTheDocument();

        // Check statuses
        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
        expect(screen.getByText("PENDING")).toBeInTheDocument();

        // Check dates
        expect(screen.getByText("1/15/2025")).toBeInTheDocument();
        expect(screen.getByText("1/16/2025")).toBeInTheDocument();

        // Check addresses
        expect(
          screen.getByText("123 Pickup St, San Francisco, CA"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("456 Delivery Ave, San Francisco, CA"),
        ).toBeInTheDocument();

        // Check totals
        expect(screen.getByText("$150.00")).toBeInTheDocument();
        expect(screen.getByText("$75.50")).toBeInTheDocument();
      });
    });

    it("should render pagination controls", async () => {
      render(<ClientOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText("Previous")).toBeInTheDocument();
        expect(screen.getByText("Next")).toBeInTheDocument();
        expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
      });
    });

    it("should disable Previous button on first page", async () => {
      render(<ClientOrdersPage />);

      await waitFor(() => {
        const prevButton = screen.getByText("Previous");
        expect(prevButton).toBeDisabled();
      });
    });

    it("should enable Next button when hasNextPage is true", async () => {
      render(<ClientOrdersPage />);

      await waitFor(() => {
        const nextButton = screen.getByText("Next");
        expect(nextButton).not.toBeDisabled();
      });
    });
  });

  describe("Pagination", () => {
    it("should handle next page navigation", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          orders: mockOrders,
          pagination: mockPagination,
        }),
      } as Response);

      render(<ClientOrdersPage />);

      await waitFor(() => {
        const nextButton = screen.getByText("Next");
        fireEvent.click(nextButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/user-orders?page=2&limit=5",
        );
      });
    });

    it("should handle previous page navigation", async () => {
      // Mock second page data
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          orders: mockOrders,
          pagination: {
            ...mockPagination,
            currentPage: 2,
            hasNextPage: true,
            hasPrevPage: true,
          },
        }),
      } as Response);

      render(<ClientOrdersPage />);

      await waitFor(() => {
        const prevButton = screen.getByText("Previous");
        fireEvent.click(prevButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/user-orders?page=1&limit=5",
        );
      });
    });

    it("should update pagination display when page changes", async () => {
      // Mock second page data
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          orders: mockOrders,
          pagination: {
            ...mockPagination,
            currentPage: 2,
            hasNextPage: true,
            hasPrevPage: true,
          },
        }),
      } as Response);

      render(<ClientOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
      });
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no orders", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          orders: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalOrders: 0,
            hasNextPage: false,
            hasPrevPage: false,
            ordersPerPage: 5,
          },
        }),
      } as Response);

      render(<ClientOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText("No Orders Found")).toBeInTheDocument();
        expect(
          screen.getByText(/You haven't placed any orders yet/),
        ).toBeInTheDocument();
        expect(screen.getByText("Create New Order")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should show error message when API call fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
      } as Response);

      render(<ClientOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(
          screen.getByText(/We encountered a problem loading your dashboard/),
        ).toBeInTheDocument();
        expect(screen.getByText("Try Again")).toBeInTheDocument();
      });
    });

    it("should show error message when fetch throws an error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      render(<ClientOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(
          screen.getByText(/Failed to load dashboard data/),
        ).toBeInTheDocument();
      });
    });

    it("should handle retry functionality", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
      } as Response);

      render(<ClientOrdersPage />);

      await waitFor(() => {
        const retryButton = screen.getByText("Try Again");
        fireEvent.click(retryButton);
      });

      // Should call fetch again
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Order Links", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          orders: mockOrders,
          pagination: mockPagination,
        }),
      } as Response);
    });

    it("should render order number as clickable link", async () => {
      render(<ClientOrdersPage />);

      await waitFor(() => {
        const orderLink = screen.getByText("CAT001");
        expect(orderLink.closest("a")).toHaveAttribute(
          "href",
          "/client/deliveries/CAT001",
        );
      });
    });

    it("should render order number links with hover styles", async () => {
      render(<ClientOrdersPage />);

      await waitFor(() => {
        const orderLink = screen.getByText("CAT001");
        expect(orderLink.closest("a")).toHaveClass("hover:underline");
      });
    });
  });

  describe("Status Badges", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          orders: mockOrders,
          pagination: mockPagination,
        }),
      } as Response);
    });

    it("should render status badges with correct variants", async () => {
      render(<ClientOrdersPage />);

      await waitFor(() => {
        const activeBadge = screen.getByText("ACTIVE");
        const pendingBadge = screen.getByText("PENDING");

        expect(activeBadge).toBeInTheDocument();
        expect(pendingBadge).toBeInTheDocument();
      });
    });
  });

  describe("Order Type Badges", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          orders: mockOrders,
          pagination: mockPagination,
        }),
      } as Response);
    });

    it("should render order type badges with correct styling", async () => {
      render(<ClientOrdersPage />);

      await waitFor(() => {
        const cateringBadge = screen.getByText("catering");
        const onDemandBadge = screen.getByText("on_demand");

        expect(cateringBadge).toBeInTheDocument();
        expect(onDemandBadge).toBeInTheDocument();
      });
    });
  });

  describe("Currency Formatting", () => {
    it("should format currency correctly", async () => {
      const ordersWithDifferentAmounts = [
        {
          ...mockOrders[0],
          orderTotal: 0,
        },
        {
          ...mockOrders[1],
          orderTotal: 1234.56,
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          orders: ordersWithDifferentAmounts,
          pagination: mockPagination,
        }),
      } as Response);

      render(<ClientOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText("$0.00")).toBeInTheDocument();
        expect(screen.getByText("$1,234.56")).toBeInTheDocument();
      });
    });

    it("should handle null order total", async () => {
      const orderWithNullTotal = [
        {
          ...mockOrders[0],
          orderTotal: null,
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          orders: orderWithNullTotal,
          pagination: mockPagination,
        }),
      } as Response);

      render(<ClientOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText("$0.00")).toBeInTheDocument();
      });
    });
  });

  describe("Address Formatting", () => {
    it("should format addresses correctly", async () => {
      render(<ClientOrdersPage />);

      await waitFor(() => {
        expect(
          screen.getByText("123 Pickup St, San Francisco, CA"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("456 Delivery Ave, San Francisco, CA"),
        ).toBeInTheDocument();
      });
    });

    it("should handle missing address data", async () => {
      const orderWithMissingAddress = [
        {
          ...mockOrders[0],
          pickupAddress: null,
          deliveryAddress: null,
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          orders: orderWithMissingAddress,
          pagination: mockPagination,
        }),
      } as Response);

      render(<ClientOrdersPage />);

      await waitFor(() => {
        const naElements = screen.getAllByText("N/A");
        expect(naElements).toHaveLength(2); // One for pickup, one for delivery
      });
    });
  });
});
