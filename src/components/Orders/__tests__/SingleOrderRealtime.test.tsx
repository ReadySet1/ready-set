// src/components/Orders/__tests__/SingleOrderRealtime.test.tsx
/**
 * The catering order page (SingleOrder) patches driverStatus on
 * `delivery:status:updated` events for its own order and, on ASSIGNED (the
 * broadcast from POST /api/orders/assignDriver, REA-344), reloads the order in
 * place so the newly assigned driver shows up without a page refresh.
 */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { DeliveryStatusUpdatedPayload } from "@/lib/realtime/schemas";

// Stable router identity, as in Next: fetchOrderDetails depends on it.
const mockRouter = { push: jest.fn() };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/admin/catering-orders/CAT001",
  useParams: () => ({ order_number: "CAT001" }),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

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
  storage: {
    listBuckets: jest.fn().mockResolvedValue({
      data: [{ name: "user-assets" }],
      error: null,
    }),
  },
};

jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => mockSupabase),
}));

type RealtimeOptions = {
  orderId?: string | null;
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

jest.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ userRole: "admin" }),
}));

jest.mock("@/hooks/tracking/useDriverRealtimeLocation", () => ({
  useDriverRealtimeLocation: () => ({ location: null, isConnected: false }),
}));

jest.mock("@/lib/services/brokerSyncService", () => ({
  syncOrderStatusWithBroker: jest.fn(),
}));

// Surface the assigned driver and driver status so the test can see them change.
jest.mock("@/components/Orders/DriverStatus", () => ({
  DriverStatusCard: ({ driverInfo, order }: any) => (
    <div data-testid="driver-card">
      <span>{driverInfo?.name ?? "No driver"}</span>
      <span data-testid="driver-status">{order.driver_status ?? "none"}</span>
    </div>
  ),
}));
jest.mock("@/components/Orders/OrderStatus", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/Orders/ui/OrderFiles", () => ({
  OrderFilesManager: () => null,
}));
jest.mock("@/components/Orders/ui/OrderDetails", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/Orders/ui/AddressInfo", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/Orders/ui/AdditionalInfo", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/Orders/ui/CustomerInfo", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/Orders/ui/OrderHeader", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/Orders/ui/OrderLocationMap", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/Orders/ui/RealtimeStatusIndicator", () => ({
  RealtimeStatusIndicator: () => null,
}));
jest.mock("@/components/Delivery/DeliveryTimeline", () => ({
  DeliveryTimeline: () => null,
}));
jest.mock("@/components/Orders/ui/DriverAssignmentDialog", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/Orders/ui/EditOrderDialog", () => ({
  __esModule: true,
  default: () => null,
}));

import SingleOrder from "@/components/Orders/SingleOrder";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ORDER_ID = "44444444-4444-4444-8444-444444444444";

const jsonResponse = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const cateringOrder = (overrides: Record<string, unknown> = {}) => ({
  id: ORDER_ID,
  orderNumber: "CAT001",
  order_type: "catering",
  status: "ACTIVE",
  dispatches: [],
  ...overrides,
});

const assignedOrder = () =>
  cateringOrder({
    status: "ASSIGNED",
    driverStatus: "ASSIGNED",
    dispatches: [
      {
        driver: {
          id: "55555555-5555-4555-8555-555555555555",
          name: "Dana Driver",
          email: "dana@example.com",
          contactNumber: "5550001111",
        },
      },
    ],
  });

/** Serve the order detail from `details` in order; files/drivers are empty. */
const mockOrderApi = (...details: Array<() => unknown>) => {
  let call = 0;
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("?include=dispatch.driver")) {
      const next = details[Math.min(call, details.length - 1)]!;
      call++;
      return jsonResponse(next());
    }
    return jsonResponse([]);
  });
};

const detailCalls = () =>
  mockFetch.mock.calls.filter(([url]) => String(url).includes("?include=dispatch.driver"))
    .length;

const lastRealtimeOptions = (): RealtimeOptions => {
  const calls = mockUseDeliveryStatusRealtime.mock.calls;
  return calls[calls.length - 1]![0];
};

const event = (
  overrides: Partial<DeliveryStatusUpdatedPayload> = {},
): DeliveryStatusUpdatedPayload => ({
  orderId: ORDER_ID,
  orderNumber: "CAT001",
  orderType: "catering",
  driverId: "55555555-5555-4555-8555-555555555555",
  status: "ASSIGNED",
  driverName: "Dana Driver",
  timestamp: new Date().toISOString(),
  ...overrides,
});

const renderPage = () =>
  render(<SingleOrder onDeleteSuccess={jest.fn()} showHeader={false} />);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SingleOrder live delivery status updates", () => {
  it("subscribes to delivery status updates for its own order", async () => {
    mockOrderApi(() => cateringOrder());
    renderPage();

    await screen.findByTestId("driver-card");
    await waitFor(() => expect(lastRealtimeOptions().orderId).toBe(ORDER_ID));
  });

  it("reloads the order in place when its driver is assigned", async () => {
    let resolveReload: (value: unknown) => void = () => {};
    const pendingReload = new Promise((resolve) => {
      resolveReload = resolve;
    });
    mockOrderApi(() => cateringOrder(), () => pendingReload);
    renderPage();

    expect(await screen.findByTestId("driver-card")).toHaveTextContent("No driver");
    expect(detailCalls()).toBe(1);

    await act(async () => {
      lastRealtimeOptions().onStatusUpdate?.(event());
    });

    await waitFor(() => expect(detailCalls()).toBe(2));
    // Silent refresh: the page stays rendered while the reload is in flight,
    // and the status patch already landed.
    expect(screen.getByRole("heading", { name: "Quick Actions" })).toBeInTheDocument();
    expect(screen.getByTestId("driver-status")).toHaveTextContent("ASSIGNED");

    await act(async () => {
      resolveReload(assignedOrder());
    });
    expect(await screen.findByText("Dana Driver")).toBeInTheDocument();
  });

  it("updates the driver status without reloading on non-ASSIGNED events", async () => {
    mockOrderApi(() => assignedOrder(), () => assignedOrder());
    renderPage();
    await screen.findByText("Dana Driver");

    await act(async () => {
      lastRealtimeOptions().onStatusUpdate?.(event({ status: "PICKED_UP" }));
    });

    expect(screen.getByTestId("driver-status")).toHaveTextContent("PICKED_UP");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(detailCalls()).toBe(1);
  });

  it("ignores events for other orders", async () => {
    mockOrderApi(() => cateringOrder(), () => assignedOrder());
    renderPage();
    await screen.findByTestId("driver-card");

    await act(async () => {
      lastRealtimeOptions().onStatusUpdate?.(event({ orderId: OTHER_ORDER_ID }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(detailCalls()).toBe(1);
    expect(screen.getByTestId("driver-card")).toHaveTextContent("No driver");
    expect(screen.getByTestId("driver-status")).toHaveTextContent("none");
  });
});
