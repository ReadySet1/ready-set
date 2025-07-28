import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CateringOrderSuccessModal } from "../CateringOrderSuccessModal";

// Mock the Dialog components
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
}));

// Mock the Button component
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

// Mock the Badge component
jest.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    variant,
  }: {
    children: React.ReactNode;
    variant?: string;
  }) => <span data-testid={`badge-${variant || "default"}`}>{children}</span>,
}));

const mockOrderData = {
  orderNumber: "SF-03020",
  clientName: "Lorne Malvo",
  pickupDateTime: new Date("2025-08-08T11:00:00"),
  deliveryDateTime: new Date("2025-08-08T11:45:00"),
  pickupAddress: {
    street1: "25 Winter St",
    city: "South San Francisco",
    state: "CA",
    zip: "94080",
  },
  deliveryAddress: {
    street1: "215 Bada Bing Av",
    city: "Millbrae",
    state: "CA",
    zip: "94040",
  },
  headcount: 45,
  needHost: "YES" as const,
  hoursNeeded: 2,
  numberOfHosts: 2,
};

describe("CateringOrderSuccessModal", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders when open", () => {
    render(
      <CateringOrderSuccessModal
        isOpen={true}
        onClose={mockOnClose}
        orderData={mockOrderData}
      />,
    );

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
  });

  it("displays success message with order number", () => {
    render(
      <CateringOrderSuccessModal
        isOpen={true}
        onClose={mockOnClose}
        orderData={mockOrderData}
      />,
    );

    expect(screen.getByText("Order Created Successfully!")).toBeInTheDocument();
    expect(
      screen.getByText("Order #SF-03020 has been confirmed"),
    ).toBeInTheDocument();
  });

  it("displays order summary information", () => {
    render(
      <CateringOrderSuccessModal
        isOpen={true}
        onClose={mockOnClose}
        orderData={mockOrderData}
      />,
    );

    expect(screen.getByText("Order Summary")).toBeInTheDocument();
    expect(screen.getByText("Lorne Malvo")).toBeInTheDocument();
    expect(screen.getByText("CATERING")).toBeInTheDocument();
  });

  it("displays pickup and delivery details", () => {
    render(
      <CateringOrderSuccessModal
        isOpen={true}
        onClose={mockOnClose}
        orderData={mockOrderData}
      />,
    );

    expect(screen.getByText("Pickup")).toBeInTheDocument();
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(
      screen.getByText(/25 Winter St, South San Francisco, CA 94080/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/215 Bada Bing Av, Millbrae, CA 94040/),
    ).toBeInTheDocument();
  });

  it("displays headcount and host information", () => {
    render(
      <CateringOrderSuccessModal
        isOpen={true}
        onClose={mockOnClose}
        orderData={mockOrderData}
      />,
    );

    expect(screen.getByText("Headcount: 45")).toBeInTheDocument();
    expect(screen.getByText("Hosts needed: 2 for 2 hours")).toBeInTheDocument();
  });

  it("displays next steps", () => {
    render(
      <CateringOrderSuccessModal
        isOpen={true}
        onClose={mockOnClose}
        orderData={mockOrderData}
      />,
    );

    expect(screen.getByText("Next Steps")).toBeInTheDocument();
    expect(screen.getByText("Order Confirmation")).toBeInTheDocument();
    expect(
      screen.getByText("Venue & Logistics Coordination"),
    ).toBeInTheDocument();
    expect(screen.getByText("Event Host Arrival")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    render(
      <CateringOrderSuccessModal
        isOpen={true}
        onClose={mockOnClose}
        orderData={mockOrderData}
      />,
    );

    const closeButton = screen.getByTestId("button-outline");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when view order details button is clicked", () => {
    render(
      <CateringOrderSuccessModal
        isOpen={true}
        onClose={mockOnClose}
        orderData={mockOrderData}
      />,
    );

    const viewDetailsButton = screen.getByTestId("button-default");
    fireEvent.click(viewDetailsButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("does not render when closed", () => {
    render(
      <CateringOrderSuccessModal
        isOpen={false}
        onClose={mockOnClose}
        orderData={mockOrderData}
      />,
    );

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("handles order without host requirements", () => {
    const orderDataWithoutHost = {
      ...mockOrderData,
      needHost: "NO" as const,
      hoursNeeded: undefined,
      numberOfHosts: undefined,
    };

    render(
      <CateringOrderSuccessModal
        isOpen={true}
        onClose={mockOnClose}
        orderData={orderDataWithoutHost}
      />,
    );

    expect(screen.getByText("Headcount: 45")).toBeInTheDocument();
    expect(screen.queryByText(/Hosts needed:/)).not.toBeInTheDocument();
  });
});
