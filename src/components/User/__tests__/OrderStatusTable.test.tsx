import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrderStatusTable from "../OrderStatusTable";

// Mock fetch used by the component
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("OrderStatusTable - Address rendering for driver", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const props = {
    userType: "driver" as const,
    apiEndpoint: "/api/driver/orders",
    title: "Driver Orders",
    description: "Recent driver orders",
  };

  it("does not render the literal 'undefined' and collapses missing parts", async () => {
    const orders = [
      {
        id: "1",
        order_number: "D200",
        order_type: "on_demand",
        status: "active",
        date: "2025-01-15T00:00:00Z",
        order_total: "89.50",
        client_attention: "",
        address: { street1: "55 Howard", city: null, state: "CA" },
        delivery_address: { street1: null, city: "Oakland", state: "CA" },
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => orders,
    } as Response);

    render(<OrderStatusTable {...props} />);

    await waitFor(() => {
      expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
      expect(screen.getByText("55 Howard, CA")).toBeInTheDocument();
      expect(screen.getByText("Oakland, CA")).toBeInTheDocument();
    });
  });

  it("shows N/A when all parts are missing or are the string 'undefined'", async () => {
    const orders = [
      {
        id: "2",
        order_number: "D201",
        order_type: "on_demand",
        status: "active",
        date: "2025-01-15T00:00:00Z",
        order_total: "10.00",
        client_attention: "",
        address: { street1: null, city: null, state: null },
        delivery_address: {
          street1: "undefined" as any,
          city: "undefined" as any,
          state: "undefined" as any,
        },
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => orders,
    } as Response);

    render(<OrderStatusTable {...props} />);

    await waitFor(() => {
      const naCells = screen.getAllByText("N/A");
      expect(naCells.length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
    });
  });
});

describe("OrderStatusTable - order date on the pickup address clock", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    // A UTC browser would roll this late-evening Austin order into the next day.
    process.env.TZ = "UTC";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows an Austin summer order on its Central date", async () => {
    const orders = [
      {
        id: "3",
        order_number: "C300",
        order_type: "catering",
        status: "active",
        // 03:30Z on 15 Jun = 10:30 PM CDT on 14 Jun
        date: "2026-06-15T03:30:00Z",
        order_total: "50.00",
        address: { street1: "100 Congress Ave", city: "Austin", state: "TX", zip: "78701" },
        delivery_address: { street1: "1 Main St", city: "Austin", state: "TX" },
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => orders,
    } as Response);

    render(
      <OrderStatusTable
        userType="client"
        apiEndpoint="/api/client/orders"
        title="Orders"
        description="Recent orders"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Jun 14, 2026")).toBeInTheDocument();
    });
  });
});
