import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DriverDeliveryDetail } from "../DriverDeliveryDetail";
import { DriverThemeProvider } from "@/components/Driver/ui/DriverThemeProvider";
import { DriverStatus } from "@/types/user";

// Tracking settings are fetched via TanStack Query in production; tests run
// without a QueryClientProvider, so pin the hook to the fail-open defaults.
jest.mock("@/hooks/tracking/useTrackingSettings", () => ({
  TRACKING_SETTINGS_QUERY_KEY: ["tracking-settings"],
  useTrackingSettings: () => ({
    settings: jest.requireActual("@/types/tracking-settings").TRACKING_SETTINGS_DEFAULTS,
    isLoaded: true,
  }),
}));


const mockPush = jest.fn();
const mockBack = jest.fn();
// Stable identity — a fresh object per render would recreate fetchOrder every
// render and put the component in a permanent refetch/loading flicker.
const mockRouter = { push: mockPush, back: mockBack };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

// The detail page reads live GPS for the arrival geofence; no provider in
// these tests → null location = geofence fails open (advance stays enabled).
// It also pulls `refreshDeliveries` so a status change here syncs the shared
// deliveries feed (End-shift guard on /driver/tracking) without a reload.
jest.mock("@/contexts/DriverTrackingContext", () => ({
  useDriverTracking: jest.fn(),
}));

import { useDriverTracking } from "@/contexts/DriverTrackingContext";
import toast from "react-hot-toast";

const mockUseDriverTracking = useDriverTracking as jest.MockedFunction<
  typeof useDriverTracking
>;
const refreshDeliveries = jest.fn().mockResolvedValue(undefined);

jest.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: "test-token" } },
        error: null,
      }),
    },
  }),
}));

// POD capture pulls in camera APIs — stub it so the sheet renders cleanly.
// The stub exposes a button so tests can drive the upload-complete callback.
jest.mock("@/components/Driver/ProofOfDeliveryCapture", () => ({
  ProofOfDeliveryCapture: ({ onUploadComplete }: any) => (
    <div data-testid="pod-capture">
      <button onClick={() => onUploadComplete("https://pod.example/photo.jpg")}>
        finish pod upload
      </button>
    </div>
  ),
}));

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderNumber: "CV-12345",
    order_type: "catering",
    status: "ASSIGNED",
    driverStatus: DriverStatus.ASSIGNED,
    pickupAddress: {
      name: "Tasty Vendor",
      street1: "1 Market St",
      city: "San Francisco",
      state: "CA",
      zip: "94105",
      isRestaurant: true,
    },
    deliveryAddress: {
      street1: "500 Howard St",
      city: "San Francisco",
      state: "CA",
      zip: "94105",
    },
    user: { name: "Acme Corp", email: "ops@acme.com" },
    dispatches: [{ driver: { id: "drv-1", name: "Dan Driver", contactNumber: "5551234" } }],
    pickupDateTime: "2026-06-08T17:00:00Z",
    arrivalDateTime: "2026-06-08T18:00:00Z",
    clientAttention: "Front desk",
    headcount: 25,
    deliveryTimestamps: { assignedAt: "2026-06-08T16:00:00Z" },
    ...overrides,
  };
}

let currentOrder: Record<string, unknown>;

function installFetch() {
  global.fetch = jest.fn((_url: string, opts?: RequestInit) => {
    const method = opts?.method ?? "GET";
    if (method === "PATCH") {
      const body = JSON.parse((opts?.body as string) ?? "{}");
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            makeOrder({
              driverStatus: body.driverStatus ?? currentOrder.driverStatus,
            }),
          ),
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(currentOrder),
    });
  }) as unknown as typeof fetch;
}

function renderDetail() {
  return render(
    <DriverThemeProvider>
      <DriverDeliveryDetail orderNumber="CV-12345" />
    </DriverThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  currentOrder = makeOrder();
  installFetch();
  mockUseDriverTracking.mockReturnValue({
    currentLocation: null,
    refreshDeliveries,
  } as any);
});

describe("DriverDeliveryDetail", () => {
  it("fetches and renders the delivery details", async () => {
    renderDetail();

    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Tasty Vendor")).toBeInTheDocument();
    expect(screen.getByText("#CV-12345")).toBeInTheDocument();
    // Friendly status label from the driver status config (pill + timeline).
    expect(screen.getAllByText("Assigned").length).toBeGreaterThan(0);
    // Pickup + drop-off addresses rendered (street1 + "city, state zip").
    expect(screen.getByText("1 Market St")).toBeInTheDocument();
    expect(screen.getByText("500 Howard St")).toBeInTheDocument();

    // Order was fetched with the dispatch.driver include.
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/orders/CV-12345?include=dispatch.driver"),
      expect.any(Object),
    );
  });

  it("advances the driver status via PATCH when the Next-Action is tapped", async () => {
    renderDetail();
    // Wait for load, then tap the next-step action.
    fireEvent.click(await screen.findByText("On my way to vendor"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders/CV-12345"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ driverStatus: DriverStatus.EN_ROUTE_TO_VENDOR }),
        }),
      );
    });
  });

  it("refreshes the shared deliveries feed after a successful status advance", async () => {
    renderDetail();
    fireEvent.click(await screen.findByText("On my way to vendor"));

    // The tracking screen (End-shift guard) reads the shared feed — a status
    // change here must sync it immediately, not after the 60s poll.
    await waitFor(() => expect(refreshDeliveries).toHaveBeenCalled());
  });

  it("refreshes the shared deliveries feed after POD completion (terminal status)", async () => {
    currentOrder = makeOrder({ driverStatus: DriverStatus.ARRIVED_TO_CLIENT });
    renderDetail();

    fireEvent.click(await screen.findByText("Complete delivery"));
    expect(await screen.findByTestId("pod-capture")).toBeInTheDocument();

    // Driving the capture flow to completion advances to COMPLETED...
    fireEvent.click(screen.getByRole("button", { name: /finish pod upload/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders/CV-12345"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ driverStatus: DriverStatus.COMPLETED }),
        }),
      );
    });
    // ...and syncs the shared feed so End shift unblocks without a reload.
    await waitFor(() => expect(refreshDeliveries).toHaveBeenCalled());
  });

  it("treats a failed feed refresh as non-fatal (local update already applied)", async () => {
    refreshDeliveries.mockRejectedValueOnce(new Error("offline"));
    renderDetail();
    fireEvent.click(await screen.findByText("On my way to vendor"));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Status updated"),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("requires proof of delivery before completing (opens POD sheet, no immediate PATCH)", async () => {
    currentOrder = makeOrder({ driverStatus: DriverStatus.ARRIVED_TO_CLIENT });
    renderDetail();

    fireEvent.click(await screen.findByText("Complete delivery"));

    // POD capture surfaces...
    expect(await screen.findByTestId("pod-capture")).toBeInTheDocument();
    // ...and no status PATCH was fired yet (gated on the photo).
    const patched = (global.fetch as jest.Mock).mock.calls.some(
      (c) => c[1]?.method === "PATCH",
    );
    expect(patched).toBe(false);
  });

  describe("return to dispatch (issue #508 escape hatch + approval flow)", () => {
    /** Route "/return" calls: GET = pending-request lookup, POST = the
     *  return itself (202 driver request by default, 200 privileged). */
    function installFetchWithReturn(opts: {
      postStatus?: number;
      pendingRequest?: Record<string, unknown> | null;
    } = {}) {
      const { postStatus = 202, pendingRequest = null } = opts;
      installFetch();
      const base = global.fetch as jest.Mock;
      global.fetch = jest.fn((url: string, init?: RequestInit) => {
        if (typeof url === "string" && url.includes("/return")) {
          if ((init?.method ?? "GET") === "POST") {
            return Promise.resolve({
              ok: true,
              status: postStatus,
              json: () =>
                Promise.resolve(
                  postStatus === 202
                    ? { success: true, status: "PENDING_APPROVAL", requestId: "req-1" }
                    : { success: true, status: "ACTIVE" },
                ),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true, request: pendingRequest }),
          });
        }
        return base(url, init);
      }) as unknown as typeof fetch;
    }

    it("shows the return CTA while pre-pickup", async () => {
      currentOrder = makeOrder({ driverStatus: DriverStatus.EN_ROUTE_TO_VENDOR });
      renderDetail();
      expect(
        await screen.findByRole("button", { name: /can't complete this delivery/i }),
      ).toBeInTheDocument();
    });

    it("hides the return CTA after pickup", async () => {
      currentOrder = makeOrder({ driverStatus: DriverStatus.PICKED_UP });
      renderDetail();
      await screen.findByText("Acme Corp");
      expect(
        screen.queryByRole("button", { name: /can't complete this delivery/i }),
      ).not.toBeInTheDocument();
    });

    it("hides the return CTA when the delivery is complete", async () => {
      currentOrder = makeOrder({ driverStatus: DriverStatus.COMPLETED });
      renderDetail();
      await screen.findByText("Acme Corp");
      expect(
        screen.queryByRole("button", { name: /can't complete this delivery/i }),
      ).not.toBeInTheDocument();
    });

    it("files a return request (202): POST, feed refresh, pending badge, and STAYS on the screen", async () => {
      installFetchWithReturn({ postStatus: 202 });
      renderDetail();
      fireEvent.click(
        await screen.findByRole("button", { name: /can't complete this delivery/i }),
      );

      // The sheet opens with the reason list; pick one and submit.
      fireEvent.click(await screen.findByRole("button", { name: /vehicle issue/i }));
      fireEvent.click(screen.getByRole("button", { name: /request return/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/orders/CV-12345/return",
          expect.objectContaining({ method: "POST" }),
        );
      });
      // Pending flow: the delivery is still the driver's while dispatch
      // reviews — sync the feed (end-shift unblocks) but do NOT navigate away.
      await waitFor(() => expect(refreshDeliveries).toHaveBeenCalled());
      expect(
        await screen.findAllByText(/return requested — awaiting dispatch/i),
      ).not.toHaveLength(0);
      expect(mockBack).not.toHaveBeenCalled();
    });

    it("leaves the screen on an immediate return (200, privileged caller)", async () => {
      installFetchWithReturn({ postStatus: 200 });
      renderDetail();
      fireEvent.click(
        await screen.findByRole("button", { name: /can't complete this delivery/i }),
      );
      fireEvent.click(await screen.findByRole("button", { name: /vehicle issue/i }));
      fireEvent.click(screen.getByRole("button", { name: /request return/i }));

      await waitFor(() => expect(refreshDeliveries).toHaveBeenCalled());
      await waitFor(() => expect(mockBack).toHaveBeenCalled());
    });

    it("shows the pending state instead of the return CTA when a request already exists", async () => {
      installFetchWithReturn({
        pendingRequest: {
          id: "req-1",
          status: "PENDING",
          reason: "VEHICLE_ISSUE",
          requestedAt: "2026-08-14T10:00:00Z",
        },
      });
      renderDetail();

      expect(
        await screen.findAllByText(/return requested — awaiting dispatch/i),
      ).not.toHaveLength(0);
      expect(
        screen.queryByRole("button", { name: /can't complete this delivery/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("shows a not-found state when the order is missing", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
    ) as unknown as typeof fetch;

    renderDetail();
    expect(await screen.findByText("Delivery not found")).toBeInTheDocument();
  });
});
