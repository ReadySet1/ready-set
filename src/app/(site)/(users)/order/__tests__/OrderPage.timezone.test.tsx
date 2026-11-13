import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import VendorPage from "../page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn() }),
  usePathname: () => "/order",
}));

jest.mock("@/components/Common/Breadcrumb", () => ({
  __esModule: true,
  default: ({ pageName }: { pageName: string }) => (
    <div data-testid="breadcrumb">{pageName}</div>
  ),
}));

jest.mock("@/components/Orders/AllOrdersModal", () => ({
  AllOrdersModal: () => null,
}));

/**
 * The vendor order table must show pickup/arrival on the pickup address clock
 * with its label, not on the viewer's browser clock.
 */
describe("Vendor order table - order times on the pickup address clock", () => {
  const originalTz = process.env.TZ;
  const originalFetch = global.fetch;

  const austinOrder = {
    id: "o-austin",
    orderNumber: "CV-AUSTIN-1",
    orderType: "catering",
    status: "ACTIVE",
    // 16:00Z / 17:30Z on 15 Jun 2026 = 11:00 AM / 12:30 PM CDT
    pickupDateTime: "2026-06-15T16:00:00.000Z",
    arrivalDateTime: "2026-06-15T17:30:00.000Z",
    orderTotal: 120,
    pickupAddress: {
      id: "addr-austin",
      street1: "100 Congress Ave",
      city: "Austin",
      state: "TX",
      zip: "78701",
      timezone: null,
      latitude: null,
      longitude: null,
    },
    deliveryAddress: {
      id: "addr-drop",
      street1: "1 Main St",
      city: "Austin",
      state: "TX",
      zip: "78702",
    },
  };

  beforeAll(() => {
    process.env.TZ = "America/Los_Angeles";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      const body = String(url).includes("/api/vendor/metrics")
        ? { activeOrders: 1, completedOrders: 0, cancelledOrders: 0, pendingOrders: 0, totalRevenue: 0, orderGrowth: 0 }
        : { orders: [austinOrder], hasMore: false, total: 1, page: 1, limit: 10 };
      return { ok: true, json: async () => body } as Response;
    }) as unknown as typeof fetch;
  });

  it("renders pickup and arrival in Central with a CT label", async () => {
    render(<VendorPage />);

    await waitFor(() => {
      expect(screen.getByText("Jun 15, 11:00 AM CT")).toBeInTheDocument();
    });
    expect(screen.getByText("Jun 15, 12:30 PM CT")).toBeInTheDocument();
  });
});
