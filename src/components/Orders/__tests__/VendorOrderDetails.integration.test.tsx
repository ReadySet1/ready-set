import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useRouter, usePathname } from "next/navigation";
import VendorOrderDetails from "../VendorOrderDetails";
import { mockVendorOrderData, mockMinimalOrderData } from "./mocks/orderData";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
};

describe("VendorOrderDetails Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (usePathname as jest.Mock).mockReturnValue("/vendor/deliveries/TEST-1234");
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("API Integration", () => {
    it("should make correct API call on component mount", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVendorOrderData,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/vendor/orders/TEST-1234");
      });
    });

    it("should handle API success response correctly", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVendorOrderData,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Order #TEST-1234")).toBeInTheDocument();
        expect(screen.getByText("Active")).toBeInTheDocument();
        expect(screen.getByText("Catering")).toBeInTheDocument();
      });
    });

    it("should handle API error response correctly", async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error("API Error"));

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(screen.getByText("API Error")).toBeInTheDocument();
      });
    });

    it("should handle 404 response correctly", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(screen.getByText("Failed to fetch order")).toBeInTheDocument();
      });
    });

    it("should handle 500 response correctly", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(screen.getByText("Failed to fetch order")).toBeInTheDocument();
      });
    });

    it("should handle malformed JSON response", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("Malformed JSON");
        },
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(screen.getByText("Malformed JSON")).toBeInTheDocument();
      });
    });

    it("should handle network errors", async () => {
      (fetch as jest.Mock).mockRejectedValue(new TypeError("Network error"));

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("should handle empty response", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Order Not Found")).toBeInTheDocument();
        expect(
          screen.getByText("The requested order could not be found."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("URL Parameter Handling", () => {
    it("should extract order number from simple URL", async () => {
      (usePathname as jest.Mock).mockReturnValue("/vendor/deliveries/ABC-123");
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVendorOrderData,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/vendor/orders/ABC-123");
      });
    });

    it("should handle URL-encoded order numbers", async () => {
      (usePathname as jest.Mock).mockReturnValue(
        "/vendor/deliveries/TEST%201234",
      );
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVendorOrderData,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/vendor/orders/TEST%201234");
      });
    });

    it("should handle order numbers with special characters", async () => {
      (usePathname as jest.Mock).mockReturnValue(
        "/vendor/deliveries/SF-12345-A",
      );
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVendorOrderData,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/vendor/orders/SF-12345-A");
      });
    });

    it("should handle malformed URLs gracefully", async () => {
      (usePathname as jest.Mock).mockReturnValue("/vendor/deliveries/");

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(
          screen.getByText("Could not determine order number from URL."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Data Transformation", () => {
    it("should handle minimal order data", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockMinimalOrderData,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Order #MINIMAL-123")).toBeInTheDocument();
        expect(screen.getByText("Pending")).toBeInTheDocument();
        expect(screen.getByText("On Demand")).toBeInTheDocument();
      });

      // Should not display sections that don't have data
      expect(screen.queryByText("Driver Information")).not.toBeInTheDocument();
      expect(screen.queryByText("Files")).not.toBeInTheDocument();
      expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    });

    it("should handle missing optional fields gracefully", async () => {
      const incompleteOrderData = {
        ...mockVendorOrderData,
        tip: null,
        pickupDateTime: null,
        arrivalDateTime: null,
        dispatches: undefined,
        fileUploads: undefined,
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => incompleteOrderData,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Order #TEST-1234")).toBeInTheDocument();
      });

      // Should not display missing optional data
      expect(screen.queryByText("$15.00")).not.toBeInTheDocument(); // tip
      expect(screen.queryByText("Driver Information")).not.toBeInTheDocument();
      expect(screen.queryByText("Files")).not.toBeInTheDocument();
    });

    it("should handle null and undefined values in addresses", async () => {
      const orderWithNullAddress = {
        ...mockVendorOrderData,
        pickupAddress: {
          ...mockVendorOrderData.pickupAddress,
          street2: null,
          locationNumber: null,
          parkingLoading: null,
        },
        deliveryAddress: {
          ...mockVendorOrderData.deliveryAddress,
          street2: null,
          locationNumber: null,
          parkingLoading: null,
        },
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => orderWithNullAddress,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Order #TEST-1234")).toBeInTheDocument();
        expect(
          screen.getByText("123 Main St, San Francisco, CA, 94105"),
        ).toBeInTheDocument();
      });

      // Should not display null/undefined address details
      expect(screen.queryByText("Location:")).not.toBeInTheDocument();
      expect(screen.queryByText("Parking:")).not.toBeInTheDocument();
    });
  });

  describe("Loading States", () => {
    it("should show loading state during API call", async () => {
      let resolvePromise: (value: any) => void;
      const apiPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (fetch as jest.Mock).mockReturnValue(apiPromise);

      render(<VendorOrderDetails />);

      expect(screen.getByText("Loading order details...")).toBeInTheDocument();

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => mockVendorOrderData,
      });

      await waitFor(() => {
        expect(screen.getByText("Order #TEST-1234")).toBeInTheDocument();
      });
    });

    it("should hide loading state after successful API call", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVendorOrderData,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Order #TEST-1234")).toBeInTheDocument();
      });

      expect(
        screen.queryByText("Loading order details..."),
      ).not.toBeInTheDocument();
    });

    it("should hide loading state after API error", async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error("API Error"));

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
      });

      expect(
        screen.queryByText("Loading order details..."),
      ).not.toBeInTheDocument();
    });
  });

  describe("Error Recovery", () => {
    it("should display try again button after API error", async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });

      // Check that Try Again button is present and clickable
      const tryAgainButton = screen.getByRole("button", { name: /try again/i });
      expect(tryAgainButton).toBeInTheDocument();
      expect(tryAgainButton).toBeEnabled();
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle concurrent API calls gracefully", async () => {
      // Simulate multiple rapid calls
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVendorOrderData,
      });

      const { unmount } = render(<VendorOrderDetails />);

      // Immediately unmount to simulate component cleanup
      unmount();

      // Should not cause errors or memory leaks
      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });
    });

    it("should handle large order data efficiently", async () => {
      const largeOrderData = {
        ...mockVendorOrderData,
        fileUploads: Array.from({ length: 100 }, (_, i) => ({
          id: `file-${i}`,
          fileName: `document-${i}.pdf`,
          fileUrl: `https://example.com/file-${i}.pdf`,
          fileType: "application/pdf",
        })),
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => largeOrderData,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Order #TEST-1234")).toBeInTheDocument();
      });

      // Should handle large file lists
      expect(screen.getByText("Files")).toBeInTheDocument();
      expect(screen.getByText("document-0.pdf")).toBeInTheDocument();
      expect(screen.getByText("document-99.pdf")).toBeInTheDocument();
    });
  });
});
