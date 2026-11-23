import React from "react";
import {
  render,
  screen,
  setupGlobalMocks,
  resetMocks,
} from "@/__tests__/utils/test-utils";
import "@testing-library/jest-dom";
import UserOrderDetail from "@/components/User/UserOrder";

jest.mock("next/navigation", () => ({
  usePathname: () => "/order-status/CV-AUSTIN-1",
}));

/**
 * The client order page header must read the order on the pickup address
 * clock, the same as its delivery timeline, not on the viewer's browser clock.
 */
describe("UserOrderDetail - order date and time on the pickup address clock", () => {
  const originalTz = process.env.TZ;

  // 16:00Z on 15 Jun 2026 = 11:00 AM CDT (Austin) = 9:00 AM PDT.
  const austinOrder = {
    id: "order-austin",
    order_number: "CV-AUSTIN-1",
    order_type: "catering" as const,
    date: "2026-06-15T16:00:00.000Z",
    status: "active",
    driver_status: null,
    order_total: "120.00",
    special_notes: null,
    address: {
      street1: "100 Congress Ave",
      city: "Austin",
      state: "TX",
      zip: "78701",
      timezone: null,
    },
    delivery_address: {
      street1: "1 Main St",
      city: "Austin",
      state: "TX",
      zip: "78702",
    },
    dispatch: [],
    user_id: "user-1",
    pickup_time: "2026-06-15T16:00:00.000Z",
    arrival_time: "2026-06-15T17:00:00.000Z",
    complete_time: null,
    updated_at: null,
    headcount: 20,
  };

  beforeAll(() => {
    process.env.TZ = "America/Los_Angeles";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  beforeEach(() => {
    resetMocks();
    setupGlobalMocks();
    (global.fetch as unknown as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => austinOrder,
    });
  });

  it("shows the order date and time in Central with a CT label", async () => {
    render(<UserOrderDetail />);
    await screen.findByText(/Order Details/i);

    expect(screen.getAllByText("Jun 15, 2026").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("11:00 AM CT")).toBeInTheDocument();
    expect(screen.queryByText(/9:00:00 AM/)).not.toBeInTheDocument();
  });
});
