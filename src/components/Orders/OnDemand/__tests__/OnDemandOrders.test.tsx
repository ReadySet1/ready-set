import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import OnDemandOrdersPage from "../OnDemandOrders";

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

// Mock Framer Motion components
jest.mock("framer-motion", () => ({
  motion: {
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("OnDemandOrders - URL Encoding", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful fetch response with orders containing special characters
    mockFetch.mockResolvedValue({
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
              order_number: "OD-0GF59K/1/2",
              status: "assigned",
              date: "2024-01-16",
              pickup_time: "11:00:00",
              order_total: "200.00",
              user: { name: "Jane Smith" },
            },
            {
              id: "3",
              order_number: "OD-0GF59K&1",
              status: "completed",
              date: "2024-01-17",
              pickup_time: "12:00:00",
              order_total: "300.00",
              user: { name: "Bob Johnson" },
            },
          ],
          totalPages: 1,
        }),
    });
  });

  it("should encode order numbers with forward slashes in URLs", async () => {
    render(<OnDemandOrdersPage />);

    // Wait for orders to load
    await waitFor(() => {
      expect(screen.getByText("OD-0GF59K/1")).toBeInTheDocument();
    });

    const orderLinks = screen.getAllByTestId("order-link");

    // Find the link for order with single slash
    const singleSlashLink = orderLinks.find(
      (link) => link.textContent === "OD-0GF59K/1",
    );
    expect(singleSlashLink).toHaveAttribute(
      "href",
      "/admin/on-demand-orders/OD-0GF59K%2F1",
    );

    // Find the link for order with multiple slashes
    const multipleSlashLink = orderLinks.find(
      (link) => link.textContent === "OD-0GF59K/1/2",
    );
    expect(multipleSlashLink).toHaveAttribute(
      "href",
      "/admin/on-demand-orders/OD-0GF59K%2F1%2F2",
    );
  });

  it("should encode order numbers with various special characters", async () => {
    render(<OnDemandOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText("OD-0GF59K&1")).toBeInTheDocument();
    });

    const orderLinks = screen.getAllByTestId("order-link");

    // Find the link for order with ampersand
    const ampersandLink = orderLinks.find(
      (link) => link.textContent === "OD-0GF59K&1",
    );
    expect(ampersandLink).toHaveAttribute(
      "href",
      "/admin/on-demand-orders/OD-0GF59K%261",
    );
  });

  it("should display order information correctly", async () => {
    render(<OnDemandOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText("OD-0GF59K/1")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("$150.00")).toBeInTheDocument();
    });
  });

  it("should handle orders with plus signs and hash symbols", async () => {
    // Update mock to include more special characters
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          orders: [
            {
              id: "1",
              order_number: "OD-0GF59K+1",
              status: "active",
              date: "2024-01-15",
              pickup_time: "10:00:00",
              order_total: "150.00",
              user: { name: "John Doe" },
            },
            {
              id: "2",
              order_number: "OD-0GF59K#1",
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

    render(<OnDemandOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText("OD-0GF59K+1")).toBeInTheDocument();
      expect(screen.getByText("OD-0GF59K#1")).toBeInTheDocument();
    });

    const orderLinks = screen.getAllByTestId("order-link");

    // Check plus sign encoding
    const plusLink = orderLinks.find(
      (link) => link.textContent === "OD-0GF59K+1",
    );
    expect(plusLink).toHaveAttribute(
      "href",
      "/admin/on-demand-orders/OD-0GF59K%2B1",
    );

    // Check hash encoding
    const hashLink = orderLinks.find(
      (link) => link.textContent === "OD-0GF59K#1",
    );
    expect(hashLink).toHaveAttribute(
      "href",
      "/admin/on-demand-orders/OD-0GF59K%231",
    );
  });

  it("should handle normal order numbers without special characters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          orders: [
            {
              id: "1",
              order_number: "OD-0GF59K1",
              status: "active",
              date: "2024-01-15",
              pickup_time: "10:00:00",
              order_total: "150.00",
              user: { name: "John Doe" },
            },
          ],
          totalPages: 1,
        }),
    });

    render(<OnDemandOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText("OD-0GF59K1")).toBeInTheDocument();
    });

    // Get all order links and find the one that contains the order number
    const orderLinks = screen.getAllByTestId("order-link");
    const orderLink = orderLinks.find(
      (link) => link.textContent === "OD-0GF59K1",
    );

    expect(orderLink).toBeDefined();

    // Normal order numbers should work fine
    expect(orderLink).toHaveAttribute(
      "href",
      "/admin/on-demand-orders/OD-0GF59K1",
    );
    expect(orderLink).toHaveTextContent("OD-0GF59K1");
  });

  it("should call API with correct parameters", async () => {
    render(<OnDemandOrdersPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders/on-demand-orders?"),
      );
    });

    // Verify the API was called
    expect(mockFetch.mock.calls).toHaveLength(1);
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall).toBeDefined();
    const url = fetchCall![0];
    expect(url).toContain("page=1");
    expect(url).toContain("limit=10");
    expect(url).toContain("sort=date");
    expect(url).toContain("direction=desc");
  });

  it("should handle loading state", async () => {
    // Mock a pending promise to simulate loading
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<OnDemandOrdersPage />);

    // Wait for the debounced fetch to be called (component uses 300ms debounce)
    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );

    // The component should show some loading state
    // Since the fetch is pending, the component should be in a loading state
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/orders/on-demand-orders?"),
    );
  });

  it("should handle empty orders list", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          orders: [],
          totalPages: 0,
        }),
    });

    render(<OnDemandOrdersPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/no on demand orders found/i),
      ).toBeInTheDocument();
    });
  });
});
