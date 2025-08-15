import React from "react";
import {
  render,
  screen,
  waitFor,
  setupGlobalMocks,
  resetMocks,
} from "@/__tests__/utils/test-utils";
import "@testing-library/jest-dom";
import UserOrderDetail from "@/components/User/UserOrder";

// Mock next/navigation for pathname usage
jest.mock("next/navigation", () => ({
  usePathname: () => "/order-status/TEST%20123",
}));

describe("Order Details - Back to Dashboard link", () => {
  const mockOrder = {
    id: "order-1",
    order_number: "TEST 123",
    order_type: "catering" as const,
    date: new Date("2025-07-31T12:00:00Z").toISOString(),
    status: "active",
    driver_status: null,
    order_total: "500.00",
    special_notes: "Testing Order",
    address: {
      street1: "25 Winter St",
      city: "San Francisco",
      state: "CA",
      zip: "94103",
    },
    delivery_address: {
      street1: "89 Spencer St",
      city: "Burlingame",
      state: "CA",
      zip: "94010",
    },
    dispatch: [],
    user_id: "user-1",
    pickup_time: new Date("2025-07-31T12:00:00Z").toISOString(),
    arrival_time: new Date("2025-07-31T13:00:00Z").toISOString(),
    complete_time: null,
    updated_at: new Date("2025-07-31T11:55:00Z").toISOString(),
    headcount: 30,
  };

  beforeEach(() => {
    resetMocks();
    setupGlobalMocks();
    // Mock the fetch used by UserOrderDetail
    (global.fetch as unknown as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOrder,
    });
  });

  it('renders a "Back to Dashboard" link pointing to /client', async () => {
    render(<UserOrderDetail />);

    // Ensure page content loads (wait for the heading to appear)
    await screen.findByText(/Order Details/i);

    const link = screen.getByText("Back to Dashboard").closest("a");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/client");

    // Sanity check: ensure fetch was called with the per-order API
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
