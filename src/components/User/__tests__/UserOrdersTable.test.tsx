import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import UserOrdersTable from "../UserOrdersTable";

// Mock fetch used by the component
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

/**
 * TODO: REA-211 - UserOrdersTable tests have fetch mocking issues
 */
describe.skip("UserOrdersTable - Address rendering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render the literal 'undefined' and collapses missing parts", async () => {
    const orders = [
      {
        id: "1",
        order_number: "A100",
        order_type: "catering" as const,
        status: "active",
        date: "2025-01-15T00:00:00Z",
        pickup_time: "10:00",
        arrival_time: "11:00",
        order_total: "45.00",
        client_attention: "John Doe",
        address: { street1: "10 Market St", city: null, state: "CA" },
        delivery_address: { street1: null, city: "San Jose", state: "CA" },
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => orders,
    } as Response);

    render(<UserOrdersTable />);

    await waitFor(() => {
      // No literal undefined anywhere
      expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
      // Pickup shows only present parts
      expect(screen.getByText("10 Market St, CA")).toBeInTheDocument();
      // Delivery shows only present parts
      expect(screen.getByText("San Jose, CA")).toBeInTheDocument();
    });
  });

  it("shows N/A when all parts are missing or are the string 'undefined'", async () => {
    const orders = [
      {
        id: "2",
        order_number: "A101",
        order_type: "catering" as const,
        status: "active",
        date: "2025-01-15T00:00:00Z",
        order_total: "12.00",
        client_attention: "Jane Doe",
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

    render(<UserOrdersTable />);

    await waitFor(() => {
      const naCells = screen.getAllByText("N/A");
      expect(naCells.length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
    });
  });
});
