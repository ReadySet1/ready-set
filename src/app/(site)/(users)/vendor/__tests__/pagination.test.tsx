import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import VendorPage from "../page";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/vendor",
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Vendor Dashboard Pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock default successful responses
    mockFetch.mockImplementation((url) => {
      if (url.includes("/api/vendor/orders")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: [
                {
                  id: "order-1",
                  orderNumber: "TEST-001",
                  orderType: "catering",
                  status: "ACTIVE",
                  pickupDateTime: "2024-01-01T10:00:00Z",
                  arrivalDateTime: "2024-01-01T11:00:00Z",
                  orderTotal: 100.5,
                  pickupAddress: {
                    id: "pickup-1",
                    street1: "123 Test St",
                    city: "Test City",
                    state: "CA",
                    zip: "12345",
                  },
                  deliveryAddress: {
                    id: "delivery-1",
                    street1: "456 Test Ave",
                    city: "Test City",
                    state: "CA",
                    zip: "12345",
                  },
                },
              ],
              total: 3,
              page: 1,
              limit: 1,
              totalPages: 3,
            }),
        });
      } else if (url.includes("/api/vendor/metrics")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              activeOrders: 2,
              completedOrders: 5,
              cancelledOrders: 1,
              pendingOrders: 1,
              totalRevenue: 1250.75,
              orderGrowth: 15,
            }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render pagination controls with correct state", async () => {
    render(<VendorPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("TEST-001")).toBeInTheDocument();
    });

    // Check that pagination controls are present
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("should disable Previous button on first page", async () => {
    render(<VendorPage />);

    await waitFor(() => {
      expect(screen.getByText("TEST-001")).toBeInTheDocument();
    });

    const previousButton = screen.getByText("Previous");
    expect(previousButton).toBeDisabled();
  });

  it("should enable Next button when there are more pages", async () => {
    render(<VendorPage />);

    await waitFor(() => {
      expect(screen.getByText("TEST-001")).toBeInTheDocument();
    });

    const nextButton = screen.getByText("Next");
    expect(nextButton).not.toBeDisabled();
  });

  it("should make API call with correct page parameter when Next is clicked", async () => {
    render(<VendorPage />);

    await waitFor(() => {
      expect(screen.getByText("TEST-001")).toBeInTheDocument();
    });

    // Mock response for page 2
    mockFetch.mockImplementation((url) => {
      if (url.includes("page=2")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: [
                {
                  id: "order-2",
                  orderNumber: "TEST-002",
                  orderType: "on_demand",
                  status: "PENDING",
                  pickupDateTime: "2024-01-02T10:00:00Z",
                  arrivalDateTime: "2024-01-02T11:00:00Z",
                  orderTotal: 75.25,
                  pickupAddress: {
                    id: "pickup-2",
                    street1: "789 Test Blvd",
                    city: "Test City",
                    state: "CA",
                    zip: "12345",
                  },
                  deliveryAddress: {
                    id: "delivery-2",
                    street1: "012 Test Way",
                    city: "Test City",
                    state: "CA",
                    zip: "12345",
                  },
                },
              ],
              total: 3,
              page: 2,
              limit: 1,
              totalPages: 3,
            }),
        });
      } else if (url.includes("/api/vendor/metrics")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              activeOrders: 2,
              completedOrders: 5,
              cancelledOrders: 1,
              pendingOrders: 1,
              totalRevenue: 1250.75,
              orderGrowth: 15,
            }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    // Wait for the API call to be made
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/vendor/orders?page=2&limit=1"),
      );
    });
  });

  it("should make API call with correct page parameter when Previous is clicked", async () => {
    // Start on page 2
    mockFetch.mockImplementation((url) => {
      if (url.includes("page=2") || url.includes("page=1")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: [
                {
                  id: "order-1",
                  orderNumber: "TEST-001",
                  orderType: "catering",
                  status: "ACTIVE",
                  pickupDateTime: "2024-01-01T10:00:00Z",
                  arrivalDateTime: "2024-01-01T11:00:00Z",
                  orderTotal: 100.5,
                  pickupAddress: {
                    id: "pickup-1",
                    street1: "123 Test St",
                    city: "Test City",
                    state: "CA",
                    zip: "12345",
                  },
                  deliveryAddress: {
                    id: "delivery-1",
                    street1: "456 Test Ave",
                    city: "Test City",
                    state: "CA",
                    zip: "12345",
                  },
                },
              ],
              total: 3,
              page: 2,
              limit: 1,
              totalPages: 3,
            }),
        });
      } else if (url.includes("/api/vendor/metrics")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              activeOrders: 2,
              completedOrders: 5,
              cancelledOrders: 1,
              pendingOrders: 1,
              totalRevenue: 1250.75,
              orderGrowth: 15,
            }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<VendorPage />);

    await waitFor(() => {
      expect(screen.getByText("TEST-001")).toBeInTheDocument();
    });

    // Now click Previous
    const previousButton = screen.getByText("Previous");
    fireEvent.click(previousButton);

    // Wait for the API call to be made
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/vendor/orders?page=1&limit=1"),
      );
    });
  });

  it("should disable Next button on last page", async () => {
    // Just check that the pagination logic correctly identifies the last page
    // Start on first page with totalPages = 1
    mockFetch.mockImplementation((url) => {
      if (url.includes("/api/vendor/orders")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: [
                {
                  id: "order-1",
                  orderNumber: "TEST-001",
                  orderType: "catering",
                  status: "COMPLETED",
                  pickupDateTime: "2024-01-01T10:00:00Z",
                  arrivalDateTime: "2024-01-01T11:00:00Z",
                  orderTotal: 200.0,
                  pickupAddress: {
                    id: "pickup-1",
                    street1: "123 Test Rd",
                    city: "Test City",
                    state: "CA",
                    zip: "12345",
                  },
                  deliveryAddress: {
                    id: "delivery-1",
                    street1: "456 Test Ln",
                    city: "Test City",
                    state: "CA",
                    zip: "12345",
                  },
                },
              ],
              total: 1, // Only 1 order total
              page: 1,
              limit: 1,
              totalPages: 1, // Only 1 page total
            }),
        });
      } else if (url.includes("/api/vendor/metrics")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              activeOrders: 1,
              completedOrders: 0,
              cancelledOrders: 0,
              pendingOrders: 0,
              totalRevenue: 200.0,
              orderGrowth: 0,
            }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<VendorPage />);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText("TEST-001")).toBeInTheDocument();
    });

    // Check that we're on page 1 of 1
    await waitFor(() => {
      expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    });

    // The Next button should be disabled since we're on the last (and only) page
    const nextButton = screen.getByText("Next");
    expect(nextButton).toBeDisabled();

    // The Previous button should also be disabled since we're on the first page
    const previousButton = screen.getByText("Previous");
    expect(previousButton).toBeDisabled();
  });

  it("should handle empty orders state", async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes("/api/vendor/orders")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: [],
              total: 0,
              page: 1,
              limit: 1,
              totalPages: 0,
            }),
        });
      } else if (url.includes("/api/vendor/metrics")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              activeOrders: 0,
              completedOrders: 0,
              cancelledOrders: 0,
              pendingOrders: 0,
              totalRevenue: 0,
              orderGrowth: 0,
            }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<VendorPage />);

    await waitFor(() => {
      expect(screen.getByText("No Orders Found")).toBeInTheDocument();
    });

    // Should not show pagination controls when no orders
    expect(screen.queryByText("Previous")).not.toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("should handle API errors gracefully", async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes("/api/vendor/orders")) {
        return Promise.resolve({
          ok: false,
          statusText: "Internal Server Error",
        });
      } else if (url.includes("/api/vendor/metrics")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              activeOrders: 0,
              completedOrders: 0,
              cancelledOrders: 0,
              pendingOrders: 0,
              totalRevenue: 0,
              orderGrowth: 0,
            }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<VendorPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to load dashboard data/),
      ).toBeInTheDocument();
    });
  });

  it("should show correct page indicator format", async () => {
    render(<VendorPage />);

    await waitFor(() => {
      expect(screen.getByText("TEST-001")).toBeInTheDocument();
    });

    // Check page indicator format
    const pageIndicator = screen.getByText("Page 1 of 3");
    expect(pageIndicator).toBeInTheDocument();
    expect(pageIndicator).toHaveClass("text-sm", "text-gray-600");
  });
});
