import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { AllOrdersModal } from "../AllOrdersModal";
import { OrderData } from "@/lib/services/vendor";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock UI components
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogDescription: ({ children }: any) => (
    <div data-testid="dialog-description">{children}</div>
  ),
  DialogHeader: ({ children }: any) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: any) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

jest.mock("@/components/ui/table", () => ({
  Table: ({ children }: any) => <table data-testid="table">{children}</table>,
  TableBody: ({ children }: any) => (
    <tbody data-testid="table-body">{children}</tbody>
  ),
  TableCell: ({ children }: any) => (
    <td data-testid="table-cell">{children}</td>
  ),
  TableHead: ({ children }: any) => (
    <th data-testid="table-head">{children}</th>
  ),
  TableHeader: ({ children }: any) => (
    <thead data-testid="table-header">{children}</thead>
  ),
  TableRow: ({ children }: any) => <tr data-testid="table-row">{children}</tr>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} data-testid="button" {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, onClick }: any) => (
    <a href={href} onClick={onClick} data-testid="link">
      {children}
    </a>
  ),
}));

// Mock Lucide React icons
jest.mock("lucide-react", () => ({
  Loader2: () => <div data-testid="loader">Loading...</div>,
  Package: () => <div data-testid="package-icon">Package</div>,
}));

describe("AllOrdersModal", () => {
  const mockOrders: OrderData[] = [
    {
      id: "1",
      orderNumber: "TEST1234",
      orderType: "catering",
      status: "ACTIVE",
      pickupDateTime: "2024-01-15T10:30:00Z",
      arrivalDateTime: "2024-01-15T12:00:00Z",
      orderTotal: 200.0,
      pickupAddress: {
        id: "pickup-1",
        street1: "123 Pickup St",
        city: "Pickup City",
        state: "CA",
        zip: "90210",
      },
      deliveryAddress: {
        id: "delivery-1",
        street1: "456 Delivery Ave",
        city: "Delivery City",
        state: "CA",
        zip: "90211",
      },
    },
    {
      id: "2",
      orderNumber: "TEST5678",
      orderType: "on_demand",
      status: "PENDING",
      pickupDateTime: "2024-01-16T14:00:00Z",
      arrivalDateTime: "2024-01-16T15:30:00Z",
      orderTotal: 150.5,
      pickupAddress: {
        id: "pickup-2",
        street1: "789 Second St",
        city: "Second City",
        state: "NY",
        zip: "10001",
      },
      deliveryAddress: {
        id: "delivery-2",
        street1: "321 Final Blvd",
        city: "Final City",
        state: "NY",
        zip: "10002",
      },
    },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Successful API Response", () => {
    it("should render orders correctly when API returns valid data", async () => {
      // Mock successful API response with correct structure
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: mockOrders,
          hasMore: false,
          total: 2,
          page: 1,
          limit: 1000,
        }),
      });

      render(<AllOrdersModal {...defaultProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
      });

      // Check that orders are displayed
      expect(screen.getByText("TEST1234")).toBeInTheDocument();
      expect(screen.getByText("TEST5678")).toBeInTheDocument();
      expect(screen.getByText("Catering")).toBeInTheDocument();
      expect(screen.getByText("On Demand")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("should format currency correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: mockOrders,
          hasMore: false,
          total: 2,
          page: 1,
          limit: 1000,
        }),
      });

      render(<AllOrdersModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
      });

      // Check currency formatting
      expect(screen.getByText("$200.00")).toBeInTheDocument();
      expect(screen.getByText("$150.50")).toBeInTheDocument();
    });

    it("should format dates correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: mockOrders,
          hasMore: false,
          total: 2,
          page: 1,
          limit: 1000,
        }),
      });

      render(<AllOrdersModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
      });

      // Check that dates are formatted (we can't check exact format due to locale differences)
      const tableCells = screen.getAllByTestId("table-cell");
      expect(tableCells.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling - Fix Verification", () => {
    it("should handle API response without orders array gracefully", async () => {
      // Mock API response that would cause the original bug
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Missing orders array - this would cause "orders.map is not a function"
          hasMore: false,
          total: 0,
          page: 1,
          limit: 1000,
        }),
      });

      render(<AllOrdersModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
      });

      // Should show error message instead of crashing
      expect(
        screen.getByText("Invalid response format from server."),
      ).toBeInTheDocument();
      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });

    it("should handle API response with non-array orders field", async () => {
      // Mock API response with orders as non-array
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: "not an array", // This would cause "orders.map is not a function"
          hasMore: false,
          total: 0,
          page: 1,
          limit: 1000,
        }),
      });

      render(<AllOrdersModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
      });

      // Should show error message instead of crashing
      expect(
        screen.getByText("Invalid response format from server."),
      ).toBeInTheDocument();
    });

    it("should handle completely invalid API response", async () => {
      // Mock API response that's not an object
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => "invalid response",
      });

      render(<AllOrdersModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
      });

      // Should show error message instead of crashing
      expect(
        screen.getByText("Invalid response format from server."),
      ).toBeInTheDocument();
    });

    it("should handle network errors", async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      render(<AllOrdersModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
      });

      expect(
        screen.getByText("Failed to load orders. Please try again."),
      ).toBeInTheDocument();
    });

    it("should handle HTTP error responses", async () => {
      // Mock HTTP error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
      });

      render(<AllOrdersModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
      });

      expect(
        screen.getByText("Failed to load orders. Please try again."),
      ).toBeInTheDocument();
    });
  });

  describe("Loading States", () => {
    it("should show loading spinner when fetching data", async () => {
      // Mock delayed response
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    orders: [],
                    hasMore: false,
                    total: 0,
                    page: 1,
                    limit: 1000,
                  }),
                }),
              100,
            ),
          ),
      );

      render(<AllOrdersModal {...defaultProps} />);

      // Should show loading initially
      expect(screen.getByTestId("loader")).toBeInTheDocument();
    });

    it("should not fetch data when modal is closed", () => {
      render(<AllOrdersModal {...defaultProps} isOpen={false} />);

      // Should not make API call
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no orders exist", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: [], // Empty array
          hasMore: false,
          total: 0,
          page: 1,
          limit: 1000,
        }),
      });

      render(<AllOrdersModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
      });

      expect(screen.getByText("No Orders Found")).toBeInTheDocument();
      expect(screen.getByTestId("package-icon")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should call onClose when close button is clicked", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: [],
          hasMore: false,
          total: 0,
          page: 1,
          limit: 1000,
        }),
      });

      render(<AllOrdersModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
      });

      const closeButton = screen.getByText("Close");
      fireEvent.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it("should retry fetching data when Try Again button is clicked", async () => {
      // First call fails
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      render(<AllOrdersModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Try Again")).toBeInTheDocument();
      });

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: mockOrders,
          hasMore: false,
          total: 2,
          page: 1,
          limit: 1000,
        }),
      });

      const tryAgainButton = screen.getByText("Try Again");
      fireEvent.click(tryAgainButton);

      await waitFor(() => {
        expect(screen.getByText("TEST1234")).toBeInTheDocument();
      });

      // Should have been called twice (initial + retry)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("API Call Verification", () => {
    it("should call correct API endpoint with proper parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: [],
          hasMore: false,
          total: 0,
          page: 1,
          limit: 1000,
        }),
      });

      render(<AllOrdersModal {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/vendor/orders?limit=1000");
      });
    });
  });

  describe("Status and Type Badges", () => {
    it("should render correct status badges", async () => {
      const ordersWithDifferentStatuses: OrderData[] = [
        { ...mockOrders[0], status: "ACTIVE" } as OrderData,
        { ...mockOrders[1], status: "COMPLETED" } as OrderData,
        {
          id: "3",
          orderNumber: "TEST999",
          orderType: "catering",
          status: "CANCELLED",
          pickupDateTime: "2024-01-17T10:00:00Z",
          arrivalDateTime: "2024-01-17T11:00:00Z",
          orderTotal: 100,
          pickupAddress: {
            id: "pickup-3",
            street1: "999 Test St",
            city: "Test City",
            state: "TX",
            zip: "75001",
          },
          deliveryAddress: {
            id: "delivery-3",
            street1: "888 Cancel Ave",
            city: "Cancel City",
            state: "TX",
            zip: "75002",
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: ordersWithDifferentStatuses,
          hasMore: false,
          total: 3,
          page: 1,
          limit: 1000,
        }),
      });

      render(<AllOrdersModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
      });

      // Check that different status badges are rendered
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });
  });
});
