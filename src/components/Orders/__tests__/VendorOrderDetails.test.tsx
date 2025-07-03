import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useRouter, usePathname } from "next/navigation";
import VendorOrderDetails from "../VendorOrderDetails";
import {
  mockVendorOrderData,
  mockCateringOrderData,
  mockOnDemandOrderData,
} from "./mocks/orderData";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
};

describe("VendorOrderDetails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (usePathname as jest.Mock).mockReturnValue("/vendor/deliveries/TEST-1234");
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockVendorOrderData,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("Loading State", () => {
    it("should display loading state initially", () => {
      render(<VendorOrderDetails />);

      expect(screen.getByText("Loading order details...")).toBeInTheDocument();
      // Check for loading spinner by class instead of role
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("Successful Order Display", () => {
    it("should render order details correctly", async () => {
      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Order #TEST-1234")).toBeInTheDocument();
      });

      // Check order status and type badges
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Catering")).toBeInTheDocument();

      // Check order total
      expect(screen.getByText("$150.00")).toBeInTheDocument();

      // Check addresses
      expect(
        screen.getByText("123 Main St, San Francisco, CA, 94105"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("456 Oak Ave, San Francisco, CA, 94102"),
      ).toBeInTheDocument();
    });

    it("should format currency correctly", async () => {
      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("$150.00")).toBeInTheDocument();
      });

      // Check tip display
      expect(screen.getByText("$15.00")).toBeInTheDocument();
    });

    it("should format dates and times correctly", async () => {
      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getAllByText("12/25/2023")).toHaveLength(2);
        expect(screen.getByText("04:00 AM")).toBeInTheDocument();
        expect(screen.getByText("05:00 AM")).toBeInTheDocument();
      });
    });

    it("should display pickup and delivery addresses with location details", async () => {
      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Pickup Location")).toBeInTheDocument();
        expect(screen.getByText("Delivery Location")).toBeInTheDocument();
        expect(
          screen.getByText("Location: Suite 100 • Parking: Loading dock"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Order Type Specific Details", () => {
    it("should display catering-specific details for catering orders", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockCateringOrderData,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Catering Details")).toBeInTheDocument();
        expect(screen.getByText(/Headcount:/)).toBeInTheDocument();
        expect(screen.getByText(/Need Host:/)).toBeInTheDocument();
        expect(screen.getByText(/Hosts:/)).toBeInTheDocument();
        expect(screen.getByText(/Hours:/)).toBeInTheDocument();
      });
    });

    it("should display on-demand specific details for on-demand orders", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockOnDemandOrderData,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("On-Demand Details")).toBeInTheDocument();
        expect(screen.getByText(/Item:/)).toBeInTheDocument();
        expect(screen.getByText(/Vehicle:/)).toBeInTheDocument();
        expect(screen.getByText(/Size:/)).toBeInTheDocument();
        expect(screen.getByText(/Weight:/)).toBeInTheDocument();
      });
    });
  });

  describe("Notes Section", () => {
    it("should display all types of notes when available", async () => {
      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Notes")).toBeInTheDocument();
        expect(screen.getByText(/Special:/)).toBeInTheDocument();
        expect(screen.getByText(/Pickup:/)).toBeInTheDocument();
        expect(screen.getByText(/Client:/)).toBeInTheDocument();
      });
    });

    it("should not display notes section when no notes are available", async () => {
      const orderWithoutNotes = {
        ...mockVendorOrderData,
        specialNotes: null,
        pickupNotes: null,
        clientAttention: null,
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => orderWithoutNotes,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Order #TEST-1234")).toBeInTheDocument();
      });

      expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    });
  });

  describe("Driver Information", () => {
    it("should display driver information when available", async () => {
      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Driver Information")).toBeInTheDocument();
        expect(screen.getByText("Name: John Driver")).toBeInTheDocument();
        expect(screen.getByText("Email: john@example.com")).toBeInTheDocument();
        expect(screen.getByText("Phone: (555) 123-4567")).toBeInTheDocument();
        expect(screen.getByText("EN ROUTE")).toBeInTheDocument();
      });
    });

    it("should not display driver section when no driver is assigned", async () => {
      const orderWithoutDriver = {
        ...mockVendorOrderData,
        dispatches: undefined,
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => orderWithoutDriver,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Order #TEST-1234")).toBeInTheDocument();
      });

      expect(screen.queryByText("Driver Information")).not.toBeInTheDocument();
    });
  });

  describe("File Uploads", () => {
    it("should display file uploads when available", async () => {
      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Files")).toBeInTheDocument();
        expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
        expect(screen.getByText("receipt.jpg")).toBeInTheDocument();
      });

      // Check that file links are clickable
      const fileLinks = screen.getAllByRole("link");
      expect(fileLinks).toHaveLength(2);
      expect(fileLinks[0]).toHaveAttribute(
        "href",
        "https://example.com/invoice.pdf",
      );
      expect(fileLinks[1]).toHaveAttribute(
        "href",
        "https://example.com/receipt.jpg",
      );
    });

    it("should not display files section when no files are uploaded", async () => {
      const orderWithoutFiles = {
        ...mockVendorOrderData,
        fileUploads: undefined,
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => orderWithoutFiles,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Order #TEST-1234")).toBeInTheDocument();
      });

      expect(screen.queryByText("Files")).not.toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should navigate back to dashboard when back button is clicked", async () => {
      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Order #TEST-1234")).toBeInTheDocument();
      });

      const backButton = screen.getByRole("button", {
        name: /back to dashboard/i,
      });
      fireEvent.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/vendor");
    });
  });

  describe("Status Badges", () => {
    it("should display correct status badge variants", async () => {
      render(<VendorOrderDetails />);

      await waitFor(() => {
        const statusBadge = screen.getByText("Active");
        expect(statusBadge).toBeInTheDocument();
        expect(statusBadge).toHaveClass("bg-slate-900");
      });
    });

    it("should display correct order type badge variants", async () => {
      render(<VendorOrderDetails />);

      await waitFor(() => {
        const typeBadge = screen.getByText("Catering");
        expect(typeBadge).toBeInTheDocument();
        expect(typeBadge).toHaveClass("bg-blue-50");
      });
    });
  });

  describe("Error States", () => {
    it("should display error state when API call fails", async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });

      // Check if Try Again button is present
      expect(
        screen.getByRole("button", { name: /try again/i }),
      ).toBeInTheDocument();
    });

    it("should display error state when API returns non-ok response", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(screen.getByText("Failed to fetch order")).toBeInTheDocument();
      });
    });

    it("should display order not found state when order is null", async () => {
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

  describe("URL Parsing", () => {
    it("should handle different URL patterns correctly", async () => {
      (usePathname as jest.Mock).mockReturnValue("/vendor/deliveries/SF-12345");

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/vendor/orders/SF-12345");
      });
    });

    it("should handle URL-encoded order numbers", async () => {
      (usePathname as jest.Mock).mockReturnValue(
        "/vendor/deliveries/TEST%201234",
      );

      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/vendor/orders/TEST%201234");
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels and roles", async () => {
      render(<VendorOrderDetails />);

      await waitFor(() => {
        expect(screen.getByText("Order #TEST-1234")).toBeInTheDocument();
      });

      // Check for proper heading structure
      expect(
        screen.getByRole("heading", { name: /order details/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /order #TEST-1234/i }),
      ).toBeInTheDocument();
    });
  });
});
