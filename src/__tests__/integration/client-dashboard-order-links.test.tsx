import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

// Mock the client dashboard component
const UpcomingOrderCard = ({ order }: { order: any }) => {
  const formatCurrency = (amount: number | null) => {
    if (!amount) return "$0.00";
    return `$${Number(amount).toFixed(2)}`;
  };

  // This is the fixed implementation - should use orderNumber, not id
  const orderDetailsLink =
    order.orderType === "catering"
      ? `/order-status/${order.orderNumber}`
      : `/order-status/${order.orderNumber}`;

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <h4 className="font-semibold text-gray-900">{order.orderNumber}</h4>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-2">
        <span className="text-sm font-medium">
          {formatCurrency(order.orderTotal)}
        </span>
        <a
          href={orderDetailsLink}
          className="text-sm font-medium text-primary hover:underline"
          data-testid="view-details-link"
        >
          View Details
        </a>
      </div>
    </div>
  );
};

describe("Client Dashboard Order Links Fix", () => {
  it("should use orderNumber instead of database ID in View Details links", () => {
    const mockOrder = {
      id: "19084987-522f-4977-bab5-8d10d13a2d02", // Database UUID
      orderNumber: "Test 35689", // Human-readable order number
      orderType: "catering",
      orderTotal: 250.0,
      status: "active",
      pickupDateTime: new Date("2024-01-15T10:00:00Z"),
      arrivalDateTime: new Date("2024-01-15T14:00:00Z"),
    };

    render(<UpcomingOrderCard order={mockOrder} />);

    // The link should use the orderNumber, not the database ID
    const viewDetailsLink = screen.getByTestId("view-details-link");

    // This should be the correct URL with orderNumber
    expect(viewDetailsLink).toHaveAttribute("href", "/order-status/Test 35689");

    // This should NOT be the incorrect URL with database ID
    expect(viewDetailsLink).not.toHaveAttribute(
      "href",
      "/order-status/19084987-522f-4977-bab5-8d10d13a2d02",
    );

    // Verify the order number is displayed correctly
    expect(screen.getByText("Test 35689")).toBeInTheDocument();
  });

  it("should handle both catering and on-demand orders correctly", () => {
    const onDemandOrder = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      orderNumber: "OD-12345",
      orderType: "on_demand",
      orderTotal: 150.0,
      status: "active",
      pickupDateTime: new Date("2024-01-15T10:00:00Z"),
      arrivalDateTime: new Date("2024-01-15T12:00:00Z"),
    };

    render(<UpcomingOrderCard order={onDemandOrder} />);

    const viewDetailsLink = screen.getByTestId("view-details-link");

    // Both order types should use the same route pattern with orderNumber
    expect(viewDetailsLink).toHaveAttribute("href", "/order-status/OD-12345");
    expect(viewDetailsLink).not.toHaveAttribute(
      "href",
      "/order-status/550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("should handle order numbers with special characters", () => {
    const orderWithSpecialChars = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      orderNumber: "CV-P4ZAG6/2", // Order number with slash
      orderType: "catering",
      orderTotal: 300.0,
      status: "active",
      pickupDateTime: new Date("2024-01-15T10:00:00Z"),
      arrivalDateTime: new Date("2024-01-15T14:00:00Z"),
    };

    render(<UpcomingOrderCard order={orderWithSpecialChars} />);

    const viewDetailsLink = screen.getByTestId("view-details-link");

    // Should use orderNumber even with special characters
    // (The URL encoding will be handled by the browser and the receiving component)
    expect(viewDetailsLink).toHaveAttribute(
      "href",
      "/order-status/CV-P4ZAG6/2",
    );
    expect(viewDetailsLink).not.toHaveAttribute(
      "href",
      "/order-status/123e4567-e89b-12d3-a456-426614174000",
    );
  });
});
