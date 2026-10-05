// src/components/Orders/__tests__/EditOrderButton.test.tsx
/**
 * The admin order detail pages (catering: SingleOrder, on-demand:
 * SingleOnDemandOrder) must both offer "Edit Order" to admin/helpdesk users on
 * non-terminal orders, and open EditOrderDialog with the loaded order so the
 * save goes through the right order-type branch.
 *
 * They also tell a missing order (404) apart from any other load failure.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = jest.fn();
const mockPathname = jest.fn();
const mockParams = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname(),
  useParams: () => mockParams(),
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

// The on-demand page reads the caller's role from their profile row.
let mockProfileType = "ADMIN";
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
        single: jest.fn(() =>
          Promise.resolve({ data: { type: mockProfileType }, error: null }),
        ),
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

// The catering page reads the caller's role from UserContext.
let mockUserRole: string | null = "admin";
jest.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ userRole: mockUserRole }),
}));

jest.mock("@/hooks/tracking/useDriverRealtimeLocation", () => ({
  useDriverRealtimeLocation: () => ({ location: null, isConnected: false }),
}));
jest.mock("@/hooks/tracking/useDeliveryStatusRealtime", () => ({
  useDeliveryStatusRealtime: () => ({
    latestStatus: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnect: jest.fn(),
  }),
}));
jest.mock("@/lib/services/brokerSyncService", () => ({
  syncOrderStatusWithBroker: jest.fn(),
}));

// Heavy children are irrelevant to the Quick Actions sidebar.
jest.mock("@/components/Orders/DriverStatus", () => ({
  DriverStatusCard: () => null,
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
  default: ({ isOpen, order }: any) =>
    isOpen ? (
      <div
        role="dialog"
        data-testid="edit-order-dialog"
        data-order-type={order.order_type}
        data-order-number={order.orderNumber}
      />
    ) : null,
}));

import SingleOrder from "@/components/Orders/SingleOrder";
import SingleOnDemandOrder from "@/components/Orders/OnDemand/SingleOnDemandOrder";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const jsonResponse = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

/** Answer the order-detail request with `detail`; files/drivers are empty. */
const mockOrderApi = (detail: () => Promise<unknown>) => {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("?include=dispatch.driver")) return detail();
    return jsonResponse(200, []);
  });
};

const onDemandOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 456,
  orderNumber: "OND001",
  order_type: "on_demand",
  status: "ACTIVE",
  vehicleType: "VAN",
  itemDelivered: "Medical supplies",
  dispatches: [],
  ...overrides,
});

const cateringOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 123,
  orderNumber: "CAT001",
  order_type: "catering",
  status: "ACTIVE",
  dispatches: [],
  ...overrides,
});

const renderOnDemand = (props: { canEditOrder?: boolean } = {}) =>
  render(<SingleOnDemandOrder onDeleteSuccess={jest.fn()} showHeader={false} {...props} />);

const renderCatering = () =>
  render(
    <SingleOrder onDeleteSuccess={jest.fn()} showHeader={false} canEditOrder={true} />,
  );

const editOrderButton = () => screen.queryByRole("button", { name: /Edit Order/i });

beforeEach(() => {
  jest.clearAllMocks();
  mockProfileType = "ADMIN";
  mockUserRole = "admin";
});

describe("Edit Order button on the admin order detail pages", () => {
  describe("on-demand order (SingleOnDemandOrder)", () => {
    beforeEach(() => {
      mockPathname.mockReturnValue("/admin/on-demand-orders/OND001");
      mockParams.mockReturnValue({ order_number: "OND001" });
    });

    it("shows Edit Order to an admin and opens the dialog with the on-demand order", async () => {
      mockOrderApi(() => jsonResponse(200, onDemandOrder()));
      renderOnDemand({ canEditOrder: true });

      const button = await screen.findByRole("button", { name: /Edit Order/i });
      await userEvent.click(button);

      const dialog = screen.getByTestId("edit-order-dialog");
      expect(dialog).toHaveAttribute("data-order-type", "on_demand");
      expect(dialog).toHaveAttribute("data-order-number", "OND001");
    });

    it("shows Edit Order to a helpdesk user from their role alone", async () => {
      mockProfileType = "HELPDESK";
      mockOrderApi(() => jsonResponse(200, onDemandOrder()));
      renderOnDemand();

      expect(
        await screen.findByRole("button", { name: /Edit Order/i }),
      ).toBeInTheDocument();
    });

    it("hides Edit Order from a vendor without the edit permission", async () => {
      mockProfileType = "VENDOR";
      mockOrderApi(() => jsonResponse(200, onDemandOrder()));
      renderOnDemand();

      await screen.findByRole("heading", { name: "Quick Actions" });
      await waitFor(() => expect(mockSupabase.from).toHaveBeenCalled());
      expect(editOrderButton()).not.toBeInTheDocument();
    });

    it("hides Edit Order on a terminal (completed) order", async () => {
      mockOrderApi(() => jsonResponse(200, onDemandOrder({ status: "COMPLETED" })));
      renderOnDemand({ canEditOrder: true });

      await screen.findByRole("heading", { name: "Quick Actions" });
      expect(editOrderButton()).not.toBeInTheDocument();
    });

    it("shows Order Not Found when the order does not exist (404)", async () => {
      mockOrderApi(() => jsonResponse(404, { message: "Order not found" }));
      renderOnDemand({ canEditOrder: true });

      expect(
        await screen.findByRole("heading", { name: "Order Not Found" }),
      ).toBeInTheDocument();
    });

    it("shows a load error, not Order Not Found, when the request fails otherwise", async () => {
      mockOrderApi(() => jsonResponse(500, { message: "boom" }));
      renderOnDemand({ canEditOrder: true });

      expect(
        await screen.findByRole("heading", { name: "Unable to Load Order" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Order Not Found" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("catering order (SingleOrder)", () => {
    beforeEach(() => {
      mockPathname.mockReturnValue("/admin/catering-orders/CAT001");
      mockParams.mockReturnValue({ order_number: "CAT001" });
    });

    it("still shows Edit Order and opens the dialog with the catering order", async () => {
      mockOrderApi(() => jsonResponse(200, cateringOrder()));
      renderCatering();

      const button = await screen.findByRole("button", { name: /Edit Order/i });
      await userEvent.click(button);

      expect(screen.getByTestId("edit-order-dialog")).toHaveAttribute(
        "data-order-type",
        "catering",
      );
    });

    it("shows Order Not Found when the order does not exist (404)", async () => {
      mockOrderApi(() => jsonResponse(404, { message: "Order not found" }));
      renderCatering();

      expect(
        await screen.findByRole("heading", { name: "Order Not Found" }),
      ).toBeInTheDocument();
    });

    it("shows a load error, not Order Not Found, when the request fails otherwise", async () => {
      mockOrderApi(() => Promise.reject(new TypeError("Failed to fetch")));
      renderCatering();

      expect(
        await screen.findByRole("heading", { name: "Unable to Load Order" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Order Not Found" }),
      ).not.toBeInTheDocument();
    });
  });
});
