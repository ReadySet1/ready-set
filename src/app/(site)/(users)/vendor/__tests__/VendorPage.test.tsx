import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// Using standard Jest globals
import VendorPage from "../page";

// Mock Next.js router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => "/vendor",
}));

// Mock components
jest.mock("@/components/Common/Breadcrumb", () => ({
  default: ({ pageName }: { pageName: string }) => (
    <div data-testid="breadcrumb">{pageName}</div>
  ),
}));

vi.mock("@/components/Orders/AllOrdersModal", () => ({
  AllOrdersModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="all-orders-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock order data
const mockOrdersPage1 = {
  orders: [
    {
      id: "1",
      orderNumber: "TEST-001",
      orderType: "catering",
      status: "ACTIVE",
      pickupDateTime: "2024-07-08T10:00:00Z",
      arrivalDateTime: "2024-07-08T11:00:00Z",
      orderTotal: 200.0,
      tip: 20.0,
      clientAttention: "John Doe",
      pickupAddress: {
        id: "addr1",
        street1: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zip: "94102",
      },
      deliveryAddress: {
        id: "addr2",
        street1: "456 Oak St",
        city: "San Francisco",
        state: "CA",
        zip: "94103",
      },
    },
  ],
  hasMore: true,
  total: 3,
  page: 1,
  limit: 1,
};

const mockOrdersPage2 = {
  orders: [
    {
      id: "2",
      orderNumber: "TEST-002",
      orderType: "on_demand",
      status: "PENDING",
      pickupDateTime: "2024-07-08T14:00:00Z",
      arrivalDateTime: "2024-07-08T15:00:00Z",
      orderTotal: 150.0,
      tip: 15.0,
      clientAttention: "Jane Smith",
      pickupAddress: {
        id: "addr3",
        street1: "789 Pine St",
        city: "San Francisco",
        state: "CA",
        zip: "94104",
      },
      deliveryAddress: {
        id: "addr4",
        street1: "321 Elm St",
        city: "San Francisco",
        state: "CA",
        zip: "94105",
      },
    },
  ],
  hasMore: true,
  total: 3,
  page: 2,
  limit: 1,
};

const mockOrdersLastPage = {
  orders: [
    {
      id: "3",
      orderNumber: "TEST-003",
      orderType: "catering",
      status: "COMPLETED",
      pickupDateTime: "2024-07-07T09:00:00Z",
      arrivalDateTime: "2024-07-07T10:00:00Z",
      orderTotal: 300.0,
      tip: 30.0,
      clientAttention: "Bob Johnson",
      pickupAddress: {
        id: "addr5",
        street1: "555 Market St",
        city: "San Francisco",
        state: "CA",
        zip: "94106",
      },
      deliveryAddress: {
        id: "addr6",
        street1: "777 Broadway",
        city: "San Francisco",
        state: "CA",
        zip: "94107",
      },
    },
  ],
  hasMore: false, // Last page
  total: 3,
  page: 3,
  limit: 1,
};

const mockMetrics = {
  activeOrders: 1,
  completedOrders: 1,
  cancelledOrders: 0,
  pendingOrders: 1,
  totalRevenue: 650.0,
  orderGrowth: 15.5,
};

describe("VendorPage Pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();

    // Default mock for metrics (always successful)
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/api/vendor/metrics")) {
        return new Response(JSON.stringify(mockMetrics), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Default orders response (page 1)
      if (url.includes("/api/vendor/orders")) {
        return new Response(JSON.stringify(mockOrdersPage1), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), { status: 404 });
    });
  });

  it("renders vendor dashboard with initial pagination state", async () => {
    await act(async () => {
      render(<VendorPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("Vendor Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Recent Orders")).toBeInTheDocument();
      expect(screen.getByText("Page 1")).toBeInTheDocument();
    });

    // Check button states on first page
    const prevButton = screen.getByText("Previous");
    const nextButton = screen.getByText("Next");

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeEnabled();
  });

  it("displays order data correctly on first page", async () => {
    await act(async () => {
      render(<VendorPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("TEST-001")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("$200.00")).toBeInTheDocument();
    });
  });

  it("navigates to next page when Next button is clicked", async () => {
    const user = userEvent.setup();

    // Mock different responses for different pages
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/api/vendor/metrics")) {
        return new Response(JSON.stringify(mockMetrics), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("page=1")) {
        return new Response(JSON.stringify(mockOrdersPage1), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("page=2")) {
        return new Response(JSON.stringify(mockOrdersPage2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), { status: 404 });
    });

    await act(async () => {
      render(<VendorPage />);
    });

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("TEST-001")).toBeInTheDocument();
    });

    // Click next button
    const nextButton = screen.getByText("Next");
    await user.click(nextButton);

    // Check that page 2 data loads
    await waitFor(() => {
      expect(screen.getByText("Page 2")).toBeInTheDocument();
      expect(screen.getByText("TEST-002")).toBeInTheDocument();
    });

    // Check button states on page 2
    const prevButton = screen.getByText("Previous");
    expect(prevButton).toBeEnabled();
    expect(nextButton).toBeEnabled();
  });

  it("navigates to previous page when Previous button is clicked", async () => {
    const user = userEvent.setup();

    // Start on page 2
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/api/vendor/metrics")) {
        return new Response(JSON.stringify(mockMetrics), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("page=1")) {
        return new Response(JSON.stringify(mockOrdersPage1), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("page=2")) {
        return new Response(JSON.stringify(mockOrdersPage2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), { status: 404 });
    });

    await act(async () => {
      render(<VendorPage />);
    });

    // Navigate to page 2 first
    const nextButton = screen.getByText("Next");
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText("Page 2")).toBeInTheDocument();
    });

    // Click previous button
    const prevButton = screen.getByText("Previous");
    await user.click(prevButton);

    // Check that we're back on page 1
    await waitFor(() => {
      expect(screen.getByText("Page 1")).toBeInTheDocument();
      expect(screen.getByText("TEST-001")).toBeInTheDocument();
    });
  });

  it("disables Next button on last page", async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/api/vendor/metrics")) {
        return new Response(JSON.stringify(mockMetrics), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("page=1")) {
        return new Response(JSON.stringify(mockOrdersPage1), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("page=2")) {
        return new Response(JSON.stringify(mockOrdersPage2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("page=3")) {
        return new Response(JSON.stringify(mockOrdersLastPage), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), { status: 404 });
    });

    await act(async () => {
      render(<VendorPage />);
    });

    // Navigate to last page
    const nextButton = screen.getByText("Next");
    await user.click(nextButton); // Page 2
    await user.click(nextButton); // Page 3 (last page)

    await waitFor(() => {
      expect(screen.getByText("Page 3")).toBeInTheDocument();
      expect(screen.getByText("TEST-003")).toBeInTheDocument();
    });

    // Check that Next button is disabled on last page
    expect(nextButton).toBeDisabled();

    // Previous button should still be enabled
    const prevButton = screen.getByText("Previous");
    expect(prevButton).toBeEnabled();
  });

  it("opens All Orders Modal when View All Orders button is clicked", async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<VendorPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("Recent Orders")).toBeInTheDocument();
    });

    // Click the View All Orders button
    const viewAllButton = screen.getByText("View All Orders");
    await user.click(viewAllButton);

    // Check that modal opens
    expect(screen.getByTestId("all-orders-modal")).toBeInTheDocument();
  });

  it("shows View All Orders button in header, not in pagination area", async () => {
    await act(async () => {
      render(<VendorPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("Recent Orders")).toBeInTheDocument();
    });

    // Get the View All Orders button
    const viewAllButton = screen.getByText("View All Orders");

    // Get the Create New Order button (should be next to each other in header)
    const createButton = screen.getByText("Create New Order");

    // Both buttons should exist
    expect(viewAllButton).toBeInTheDocument();
    expect(createButton).toBeInTheDocument();

    // Check that pagination area only has Previous, Page, Next
    const paginationArea = screen.getByText("Page 1").closest("div");
    expect(paginationArea).toBeInTheDocument();
    expect(paginationArea).not.toHaveTextContent("View All Orders");
  });

  it("handles API errors gracefully", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/api/vendor/orders")) {
        return new Response(JSON.stringify({ error: "Server Error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/vendor/metrics")) {
        return new Response(JSON.stringify({ error: "Server Error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), { status: 404 });
    });

    await act(async () => {
      render(<VendorPage />);
    });

    // Should show error state
    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });
  });

  it("shows empty state when no orders exist", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/api/vendor/metrics")) {
        return new Response(JSON.stringify(mockMetrics), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/vendor/orders")) {
        return new Response(
          JSON.stringify({
            orders: [],
            hasMore: false,
            total: 0,
            page: 1,
            limit: 1,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify({}), { status: 404 });
    });

    await act(async () => {
      render(<VendorPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("No Orders Found")).toBeInTheDocument();
      expect(
        screen.getByText(
          "There are no orders to display at the moment. Check back later or create a new order.",
        ),
      ).toBeInTheDocument();
    });
  });
});

describe("Vendor Order Detail Navigation", () => {
  it("renders a single BackToDashboard button at the top of the order detail page", async () => {
    // Simulate the order detail page rendering the BackToDashboard at the parent level
    // We'll mock the DriverOrder to NOT render the button (as per new logic)
    jest.mock("@/components/Driver/DriverOrder", () => () => (
      <div>Order Details</div>
    ));
    const { default: OrderPage } = await import(
      "../deliveries/[order_number]/page"
    );
    render(<OrderPage />);
    // The button should be present once
    expect(
      screen.getAllByText(/Back to Vendor Dashboard|Back to Dashboard/i),
    ).toHaveLength(1);
  });
});
