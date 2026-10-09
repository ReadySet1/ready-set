// src/components/Orders/__tests__/OrderPageTimezone.test.tsx
/**
 * Order pages must show pickup/arrival times in the app timezone
 * (TIMEZONE_CONFIG.LOCAL_TIMEZONE, Pacific), the same zone the edit dialog
 * uses (#658) — never in the viewer's browser timezone.
 *
 * The browser timezone is simulated by defaulting every Date#toLocale*String
 * call to Asia/Tokyo unless the caller passes its own `timeZone`, so the test
 * is deterministic on any machine (CI runs in UTC, devs anywhere).
 */

import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => {
  const router = { push: jest.fn() };
  return {
    useRouter: () => router,
    usePathname: () => "/admin/catering-orders/CAT001",
    useParams: () => ({ order_number: "CAT001" }),
  };
});

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

jest.mock("@/hooks/tracking/useDeliveryStatusRealtime", () => ({
  useDeliveryStatusRealtime: () => ({
    latestStatus: null,
    statusByOrder: new Map(),
    isConnected: true,
    isConnecting: false,
    error: null,
    reconnect: jest.fn(),
  }),
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

jest.mock("@/components/Orders/DriverStatus", () => ({
  DriverStatusCard: () => <div data-testid="driver-card" />,
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
import SingleOnDemandOrder from "@/components/Orders/OnDemand/SingleOnDemandOrder";

const PACIFIC = "America/Los_Angeles";
const BROWSER_TZ = "Asia/Tokyo";

// 03:30Z = Oct 7, 8:30 PM PDT, but Oct 8, 12:30 PM in Tokyo: day and time differ.
const PICKUP = "2026-10-08T03:30:00.000Z";
// 05:15Z = Oct 7, 10:15 PM PDT, but Oct 8, 2:15 PM in Tokyo.
const ARRIVAL = "2026-10-08T05:15:00.000Z";

type LocaleMethod = "toLocaleString" | "toLocaleDateString" | "toLocaleTimeString";
const LOCALE_METHODS: LocaleMethod[] = [
  "toLocaleString",
  "toLocaleDateString",
  "toLocaleTimeString",
];
const originals = Object.fromEntries(
  LOCALE_METHODS.map((m) => [m, Date.prototype[m]]),
) as Record<LocaleMethod, (this: Date, ...args: unknown[]) => string>;

/** Same call the component makes, but pinned to an explicit zone. */
const inZone = (
  iso: string,
  method: LocaleMethod,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {},
) => originals[method].call(new Date(iso), undefined, { ...options, timeZone });

beforeEach(() => {
  jest.clearAllMocks();
  // Simulate a browser outside Pacific: an explicit `timeZone` still wins.
  for (const method of LOCALE_METHODS) {
    jest
      .spyOn(Date.prototype, method)
      .mockImplementation(function (
        this: Date,
        locales?: Intl.LocalesArgument,
        options?: Intl.DateTimeFormatOptions,
      ) {
        return originals[method].call(this, locales, {
          timeZone: BROWSER_TZ,
          ...options,
        });
      });
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const serveOrder = (order: Record<string, unknown>) => {
  mockFetch.mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve(url.includes("?include=dispatch.driver") ? order : []),
    }),
  );
};

describe("SingleOrder header times", () => {
  it("shows the pickup date and time in Pacific, not the browser timezone", async () => {
    serveOrder({
      id: "33333333-3333-4333-8333-333333333333",
      orderNumber: "CAT001",
      order_type: "catering",
      status: "ACTIVE",
      pickupDateTime: PICKUP,
      dispatches: [],
    });

    render(<SingleOrder onDeleteSuccess={jest.fn()} showHeader={false} />);
    await screen.findByTestId("driver-card");

    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    };

    expect(
      screen.getByText(inZone(PICKUP, "toLocaleDateString", PACIFIC, dateOptions)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(inZone(PICKUP, "toLocaleTimeString", PACIFIC, timeOptions)),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(inZone(PICKUP, "toLocaleTimeString", BROWSER_TZ, timeOptions)),
    ).not.toBeInTheDocument();
  });
});

describe("SingleOnDemandOrder timeline times", () => {
  it("shows scheduled pickup and driver arrival in Pacific, not the browser timezone", async () => {
    serveOrder({
      id: "33333333-3333-4333-8333-333333333333",
      orderNumber: "OND001",
      order_type: "on_demand",
      status: "ACTIVE",
      vehicleType: "VAN",
      itemDelivered: "Medical supplies",
      pickupDateTime: PICKUP,
      arrivalDateTime: ARRIVAL,
      dispatches: [],
    });

    render(<SingleOnDemandOrder onDeleteSuccess={jest.fn()} showHeader={false} />);
    await screen.findByTestId("driver-card");

    for (const iso of [PICKUP, ARRIVAL]) {
      expect(
        screen.getByText(inZone(iso, "toLocaleString", PACIFIC)),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(inZone(iso, "toLocaleString", BROWSER_TZ)),
      ).not.toBeInTheDocument();
    }
  });
});
