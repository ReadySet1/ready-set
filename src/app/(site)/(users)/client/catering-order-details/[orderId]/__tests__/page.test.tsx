import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter, useParams } from "next/navigation";
import CateringOrderDetailsPage from "../page";

// Mock Next.js router and params
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock UI components
jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card">{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-title">{children}</div>
  ),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
  }) => (
    <button data-testid={`button-${variant || "default"}`} onClick={onClick}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <span data-testid="badge" className={className}>{children}</span>,
}));

jest.mock("@/components/ui/separator", () => ({
  Separator: () => <div data-testid="separator" />,
}));

const mockOrderDetails = {
  id: "test-order-id-123",
  orderNumber: "TEST-123",
  status: "ACTIVE",
  driverStatus: "ASSIGNED",
  pickupDateTime: "2025-08-01T16:15:00Z",
  arrivalDateTime: "2025-08-01T16:45:00Z",
  completeDateTime: "2025-08-01T17:00:00Z",
  updatedAt: "2025-07-28T17:40:00Z",
  headcount: 12,
  needHost: "YES" as const,
  hoursNeeded: 3,
  numberOfHosts: 3,
  brokerage: "Platterz",
  orderTotal: "130.00",
  tip: "15.00",
  clientAttention: "Rachel Sanz",
  pickupNotes: "Testing Order",
  specialNotes: null,
  pickupAddress: {
    street1: "3 Santa Ana Av",
    street2: null,
    city: "San Bruno",
    state: "California",
    zip: "94020",
    locationNumber: null,
    parkingLoading: null,
  },
  deliveryAddress: {
    street1: "3 Santa Ana Av",
    street2: null,
    city: "San Bruno",
    state: "California",
    zip: "94020",
    locationNumber: null,
    parkingLoading: null,
  },
  dispatches: [
    {
      id: "dispatch-1",
      driverId: "driver-1",
      createdAt: "2025-07-28T17:40:00Z",
      driver: {
        id: "driver-1",
        name: "John Driver",
        contactNumber: "555-1234",
      },
    },
  ],
};

describe("CateringOrderDetailsPage", () => {
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useParams as jest.Mock).mockReturnValue({ orderId: "test-order-id-123" });
  });

  it("renders loading state initially", () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<CateringOrderDetailsPage />);

    expect(screen.getByText("Loading order details...")).toBeInTheDocument();
  });

  it("renders order details after successful fetch", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, order: mockOrderDetails }),
    });

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText("Order Details")).toBeInTheDocument();
      expect(screen.getByText("Order #TEST-123")).toBeInTheDocument();
    });

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Platterz")).toBeInTheDocument();
    expect(screen.getByText("Rachel Sanz")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("displays order information correctly", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, order: mockOrderDetails }),
    });

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText("Order Information")).toBeInTheDocument();
    });

    expect(screen.getByText("TEST-123")).toBeInTheDocument();
    expect(screen.getByText("Platterz")).toBeInTheDocument();
    expect(screen.getByText("Rachel Sanz")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("$130.00")).toBeInTheDocument();
    expect(screen.getByText("$15.00")).toBeInTheDocument();
  });

  it("displays host services when needed", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, order: mockOrderDetails }),
    });

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText("Host Services")).toBeInTheDocument();
      expect(screen.getByText("3 hosts for 3 hours")).toBeInTheDocument();
    });
  });

  it("displays timing information", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, order: mockOrderDetails }),
    });

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText("Timing Information")).toBeInTheDocument();
    });

    expect(screen.getByText(/Pickup Time/)).toBeInTheDocument();
    expect(screen.getByText(/Delivery Time/)).toBeInTheDocument();
    expect(screen.getByText(/Completion Time/)).toBeInTheDocument();
    expect(screen.getByText(/Last Updated/)).toBeInTheDocument();
  });

  it("displays pickup and delivery locations", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, order: mockOrderDetails }),
    });

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText("Pickup Location")).toBeInTheDocument();
      expect(screen.getByText("Delivery Location")).toBeInTheDocument();
    });

    expect(screen.getByText(/3 Santa Ana Av, San Bruno, California 94020/)).toBeInTheDocument();
  });

  it("displays additional notes when available", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, order: mockOrderDetails }),
    });

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText("Additional Notes")).toBeInTheDocument();
      expect(screen.getByText("Pickup Notes")).toBeInTheDocument();
      expect(screen.getByText("Testing Order")).toBeInTheDocument();
    });
  });

  it("displays driver information when available", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, order: mockOrderDetails }),
    });

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText("Driver Details")).toBeInTheDocument();
      expect(screen.getByText("John Driver")).toBeInTheDocument();
      expect(screen.getByText("Contact: 555-1234")).toBeInTheDocument();
    });
  });

  it("navigates to client dashboard when back button is clicked", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, order: mockOrderDetails }),
    });

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
    });

    const backButton = screen.getByTestId("button-ghost");
    fireEvent.click(backButton);

    expect(mockRouter.push).toHaveBeenCalledWith("/client");
  });

  it("handles API error gracefully", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Order not found" }),
    });

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText("Order not found")).toBeInTheDocument();
      expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
    });
  });

  it("handles network error gracefully", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText("An error occurred")).toBeInTheDocument();
      expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
    });
  });

  it("shows correct status badge", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, order: mockOrderDetails }),
    });

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      const badge = screen.getByTestId("badge");
      expect(badge).toHaveClass("bg-blue-100", "text-blue-800");
      expect(badge).toHaveTextContent("Active");
    });
  });

  it("handles order without host services", async () => {
    const orderWithoutHost = {
      ...mockOrderDetails,
      needHost: "NO" as const,
      hoursNeeded: null,
      numberOfHosts: null,
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, order: orderWithoutHost }),
    });

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText("Order Information")).toBeInTheDocument();
    });

    expect(screen.queryByText("Host Services")).not.toBeInTheDocument();
  });

  it("handles order without additional notes", async () => {
    const orderWithoutNotes = {
      ...mockOrderDetails,
      pickupNotes: null,
      specialNotes: null,
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, order: orderWithoutNotes }),
    });

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText("Order Details")).toBeInTheDocument();
    });

    expect(screen.queryByText("Additional Notes")).not.toBeInTheDocument();
  });

  it("handles order without driver information", async () => {
    const orderWithoutDriver = {
      ...mockOrderDetails,
      dispatches: [],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, order: orderWithoutDriver }),
    });

    render(<CateringOrderDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText("Order Details")).toBeInTheDocument();
    });

    expect(screen.queryByText("Driver Details")).not.toBeInTheDocument();
  });
}); 