// src/components/Orders/__tests__/OrdersListRealtimeRefresh.test.tsx
/**
 * The admin orders lists (catering and on-demand) refetch in the background
 * when a `delivery:status:updated` event arrives for an order of their type,
 * e.g. the ASSIGNED broadcast from POST /api/orders/assignDriver (REA-344),
 * so a newly assigned order shows its new status without a reload.
 */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { DeliveryStatusUpdatedPayload } from "@/lib/realtime/schemas";

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, initial, animate, exit, transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({
      data: { session: { access_token: "mock-token" } },
      error: null,
    }),
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    }),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: { type: "ADMIN" }, error: null })),
      })),
    })),
  })),
};

jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => mockSupabase),
}));

type RealtimeOptions = {
  enabled?: boolean;
  onStatusUpdate?: (payload: DeliveryStatusUpdatedPayload) => void;
};
const mockUseDeliveryStatusRealtime = jest.fn((_options: RealtimeOptions) => ({
  latestStatus: null,
  statusByOrder: new Map(),
  isConnected: true,
  isConnecting: false,
  error: null,
  reconnect: jest.fn(),
}));
jest.mock("@/hooks/tracking/useDeliveryStatusRealtime", () => ({
  useDeliveryStatusRealtime: (options: RealtimeOptions) =>
    mockUseDeliveryStatusRealtime(options),
}));

// Render each row as "<order number>:<status>" so status changes are visible.
const mockTable = ({ orders }: { orders: Array<{ order_number: string; status: string }> }) => (
  <ul data-testid="orders-table">
    {orders.map((o) => (
      <li key={o.order_number}>{`${o.order_number}:${o.status}`}</li>
    ))}
  </ul>
);
jest.mock("@/components/Orders/CateringOrders/CateringOrdersTable", () => ({
  CateringOrdersTable: (props: any) => mockTable(props),
}));
jest.mock("@/components/Orders/OnDemand/OnDemandOrdersTable", () => ({
  OnDemandOrdersTable: (props: any) => mockTable(props),
}));
jest.mock("@/components/Orders/OnDemand/OnDemandOrdersPagination", () => ({
  OnDemandOrdersPagination: () => null,
}));

import CateringOrdersPage from "@/components/Orders/CateringOrders/CateringOrdersPage";
import OnDemandOrdersPageNew from "@/components/Orders/OnDemand/OnDemandOrdersPageNew";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const address = {
  id: "addr-1",
  street1: "1 Market St",
  city: "San Francisco",
  state: "CA",
  zip: "94105",
};

const apiOrder = (orderNumber: string, status: string) => ({
  id: `id-${orderNumber}`,
  orderNumber,
  status,
  pickupDateTime: "2026-10-05T17:00:00.000Z",
  createdAt: "2026-10-05T12:00:00.000Z",
  updatedAt: "2026-10-05T12:00:00.000Z",
  orderTotal: 100,
  user: { id: "u-1", name: "Client", email: "client@example.com" },
  pickupAddress: address,
  deliveryAddress: address,
});

const jsonResponse = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const event = (
  overrides: Partial<DeliveryStatusUpdatedPayload> = {},
): DeliveryStatusUpdatedPayload => ({
  orderId: "11111111-1111-4111-8111-111111111111",
  orderNumber: "ORD001",
  orderType: "catering",
  driverId: "22222222-2222-4222-8222-222222222222",
  status: "ASSIGNED",
  timestamp: new Date().toISOString(),
  ...overrides,
});

const emit = (payload: DeliveryStatusUpdatedPayload) => {
  const calls = mockUseDeliveryStatusRealtime.mock.calls;
  act(() => {
    calls[calls.length - 1]![0].onStatusUpdate?.(payload);
  });
};

const listCalls = (endpoint: string) =>
  mockFetch.mock.calls.filter(([url]) => String(url).includes(endpoint)).length;

const cases = [
  {
    name: "catering orders list",
    Component: CateringOrdersPage,
    endpoint: "/api/orders/catering-orders?",
    orderType: "catering" as const,
    otherType: "on_demand" as const,
    initialStatus: "ACTIVE",
  },
  {
    name: "on-demand orders list",
    Component: OnDemandOrdersPageNew,
    endpoint: "/api/orders/on-demand-orders?",
    orderType: "on_demand" as const,
    otherType: "catering" as const,
    initialStatus: "ACTIVE",
  },
];

describe.each(cases)(
  "$name live refresh on delivery status events",
  ({ Component, endpoint, orderType, otherType, initialStatus }) => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockFetch.mockReset();
    });

    it("subscribes to delivery status updates while mounted", async () => {
      mockFetch.mockImplementation(() =>
        jsonResponse({ orders: [apiOrder("ORD001", initialStatus)], totalPages: 1 }),
      );
      render(<Component />);

      await screen.findByText("ORD001:active");
      expect(mockUseDeliveryStatusRealtime).toHaveBeenCalled();
      const calls = mockUseDeliveryStatusRealtime.mock.calls;
      expect(calls[calls.length - 1]![0].enabled).not.toBe(false);
    });

    it("refetches in the background when an event for its order type arrives", async () => {
      let resolveRefetch: (value: unknown) => void = () => {};
      mockFetch
        .mockImplementationOnce(() =>
          jsonResponse({ orders: [apiOrder("ORD001", initialStatus)], totalPages: 1 }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveRefetch = resolve;
            }),
        );
      render(<Component />);
      await screen.findByText("ORD001:active");
      expect(listCalls(endpoint)).toBe(1);

      emit(event({ orderType }));

      await waitFor(() => expect(listCalls(endpoint)).toBe(2), { timeout: 3000 });
      // Background refresh: the current rows stay on screen (no skeleton).
      expect(screen.getByText("ORD001:active")).toBeInTheDocument();

      await act(async () => {
        resolveRefetch({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({ orders: [apiOrder("ORD001", "ASSIGNED")], totalPages: 1 }),
        });
      });

      expect(await screen.findByText("ORD001:assigned")).toBeInTheDocument();
    });

    it("ignores events for the other order type", async () => {
      mockFetch.mockImplementation(() =>
        jsonResponse({ orders: [apiOrder("ORD001", initialStatus)], totalPages: 1 }),
      );
      render(<Component />);
      await screen.findByText("ORD001:active");

      emit(event({ orderType: otherType }));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1600));
      });

      expect(listCalls(endpoint)).toBe(1);
    });
  },
);
