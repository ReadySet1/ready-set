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
  ProofOfDeliveryCapture: ({ onUploadComplete, uploadEndpoint, maxPhotos }: any) => (
    <div
      data-testid="pod-capture"
      data-endpoint={uploadEndpoint}
      data-max-photos={String(maxPhotos ?? 1)}
    >
      <button onClick={() => onUploadComplete("https://pod.example/photo.jpg")}>
        finish pod upload
      </button>
    </div>
  ),
}));

// The pickup confirmation pulls in the canvas signature pad — stub it the
// same way, with a button that drives the name-only completion callback.
jest.mock("@/components/Driver/SignatureCapture", () => ({
  SignatureCapture: ({ onUploadComplete, stage, uploadEndpoint }: any) => (
    <div
      data-testid="signature-capture"
      data-stage={stage ?? "pickup"}
      data-endpoint={uploadEndpoint}
    >
      <button onClick={() => onUploadComplete(null)}>finish signature</button>
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
  // Default: the driver is on an active shift, so the shift gate is open.
  mockUseDriverTracking.mockReturnValue({
    currentLocation: null,
    refreshDeliveries,
    isShiftActive: true,
    shiftLoading: false,
  } as any);
});

/** Render the JSX/string a toast mock received so its copy can be asserted. */
function renderToastMessage(call: unknown[]) {
  const [message] = call as [React.ReactNode];
  return render(<div data-testid="toast-body">{message}</div>);
}

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
    // The completion photo takes up to 3 photos (delivery-finalize-multi-photo).
    expect(screen.getByTestId("pod-capture")).toHaveAttribute("data-max-photos", "3");

    // Driving the capture flow (photo, then recipient) advances to COMPLETED...
    fireEvent.click(screen.getByRole("button", { name: /finish pod upload/i }));
    fireEvent.click(await screen.findByRole("button", { name: /finish signature/i }));
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

  it("does not hold the driver on the redundant order-status follow-up PATCH", async () => {
    currentOrder = makeOrder({ driverStatus: DriverStatus.ARRIVED_TO_CLIENT });
    const baseFetch = global.fetch as jest.Mock;
    const passthrough = baseFetch.getMockImplementation();
    baseFetch.mockImplementation((url: string, init?: RequestInit) =>
      init?.body === JSON.stringify({ status: "COMPLETED" })
        ? new Promise(() => {}) // never settles
        : passthrough!(url, init),
    );
    renderDetail();

    fireEvent.click(await screen.findByText("Complete delivery"));
    fireEvent.click(await screen.findByRole("button", { name: /finish pod upload/i }));
    fireEvent.click(await screen.findByRole("button", { name: /finish signature/i }));

    // The completion still finishes (feed refresh + success toast) even
    // though the follow-up PATCH never answers.
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Status updated"));
    expect(baseFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/orders/CV-12345"),
      // Not awaited, so it must survive navigation / webview unload.
      expect.objectContaining({
        body: JSON.stringify({ status: "COMPLETED" }),
        keepalive: true,
      }),
    );
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
      lastRejected?: Record<string, unknown> | null;
    } = {}) {
      const { postStatus = 202, pendingRequest = null, lastRejected = null } = opts;
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
            json: () =>
              Promise.resolve({ success: true, request: pendingRequest, lastRejected }),
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

  describe("declined return request signal (QA gap 2026-09-21)", () => {
    const rejected = {
      id: "req-rejected-1",
      status: "REJECTED",
      reason: "VEHICLE_ISSUE",
      details: null,
      requestedAt: "2026-09-21T10:00:00Z",
      resolvedAt: "2026-09-21T10:30:00Z",
      resolutionNotes: "Too close to pickup — please continue.",
    };

    /** Same GET/POST routing as the return suite above. */
    function installFetchWithReturn(opts: {
      pendingRequest?: Record<string, unknown> | null;
      lastRejected?: Record<string, unknown> | null;
    } = {}) {
      const { pendingRequest = null, lastRejected = null } = opts;
      installFetch();
      const base = global.fetch as jest.Mock;
      global.fetch = jest.fn((url: string, init?: RequestInit) => {
        if (typeof url === "string" && url.includes("/return")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({ success: true, request: pendingRequest, lastRejected }),
          });
        }
        return base(url, init);
      }) as unknown as typeof fetch;
    }

    beforeEach(() => {
      window.localStorage.clear();
    });

    it("shows the declined notice with dispatch's note and keeps the return CTA", async () => {
      installFetchWithReturn({ lastRejected: rejected });
      renderDetail();

      expect(
        await screen.findByText(/dispatch declined your return request/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/too close to pickup — please continue\./i),
      ).toBeInTheDocument();
      // The order stays with the driver: no pending badge, CTA still offered.
      expect(
        screen.queryByText(/return requested — awaiting dispatch/i),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /can't complete this delivery/i }),
      ).toBeInTheDocument();
    });

    it("hides the declined notice while a newer request is pending", async () => {
      installFetchWithReturn({
        pendingRequest: { id: "req-pending-2", status: "PENDING" },
        lastRejected: rejected,
      });
      renderDetail();

      expect(
        await screen.findAllByText(/return requested — awaiting dispatch/i),
      ).not.toHaveLength(0);
      expect(
        screen.queryByText(/dispatch declined your return request/i),
      ).not.toBeInTheDocument();
    });

    it("dismisses the notice and does not show it again on the next load", async () => {
      installFetchWithReturn({ lastRejected: rejected });
      const { unmount } = renderDetail();

      await screen.findByText(/dispatch declined your return request/i);
      fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
      expect(
        screen.queryByText(/dispatch declined your return request/i),
      ).not.toBeInTheDocument();

      unmount();
      renderDetail();
      await screen.findByText("Acme Corp");
      expect(
        screen.queryByText(/dispatch declined your return request/i),
      ).not.toBeInTheDocument();
    });

    it("shows nothing extra when there is no recent rejection", async () => {
      installFetchWithReturn({ lastRejected: null });
      renderDetail();

      await screen.findByText("Acme Corp");
      expect(
        screen.queryByText(/dispatch declined your return request/i),
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
  describe("shift gate (delivery-advance-without-shift)", () => {
    it("does not block a driver whose shift is PAUSED (on break): the context reports it active and the PATCH goes out", async () => {
      // Client and server agree: an open shift is active OR paused
      // (useDriverShift.isShiftActive). The component must rely on that flag,
      // never on its own `status === 'active'` check.
      mockUseDriverTracking.mockReturnValue({
        currentLocation: null,
        refreshDeliveries,
        currentShift: { id: "shift-1", status: "paused" },
        isShiftActive: true,
        shiftLoading: false,
      } as any);
      renderDetail();

      fireEvent.click(await screen.findByText("On my way to vendor"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/orders/CV-12345"),
          expect.objectContaining({ method: "PATCH" }),
        );
      });
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("blocks the Next-Action with a 'Start your shift first' toast and sends no PATCH when the shift is inactive", async () => {
      mockUseDriverTracking.mockReturnValue({
        currentLocation: null,
        refreshDeliveries,
        isShiftActive: false,
        shiftLoading: false,
      } as any);
      renderDetail();

      fireEvent.click(await screen.findByText("On my way to vendor"));

      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      const patched = (global.fetch as jest.Mock).mock.calls.some(
        ([, init]: [string, RequestInit | undefined]) => init?.method === "PATCH",
      );
      expect(patched).toBe(false);
      expect(toast.success).not.toHaveBeenCalled();

      renderToastMessage((toast.error as jest.Mock).mock.calls[0]!);
      const body = screen.getByTestId("toast-body");
      expect(body).toHaveTextContent(/start your shift first/i);
      const link = screen.getByRole("link", { name: /shift/i });
      expect(link).toHaveAttribute("href", "/driver/tracking");
    });

    it("does not block while the shift state is still loading", async () => {
      mockUseDriverTracking.mockReturnValue({
        currentLocation: null,
        refreshDeliveries,
        isShiftActive: false,
        shiftLoading: true,
      } as any);
      renderDetail();

      fireEvent.click(await screen.findByText("On my way to vendor"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/orders/CV-12345"),
          expect.objectContaining({ method: "PATCH" }),
        );
      });
    });

    it("shows the same toast when the server answers 422 SHIFT_REQUIRED (client state was stale)", async () => {
      installFetch();
      const base = global.fetch as jest.Mock;
      global.fetch = jest.fn((url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          return Promise.resolve({
            ok: false,
            status: 422,
            statusText: "Unprocessable Entity",
            json: () =>
              Promise.resolve({
                error: "SHIFT_REQUIRED",
                message: "Start your shift before working a delivery.",
              }),
          });
        }
        return base(url, init);
      }) as unknown as typeof fetch;
      renderDetail();

      fireEvent.click(await screen.findByText("On my way to vendor"));

      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      // The raw error code must never leak into the toast.
      expect(toast.error).not.toHaveBeenCalledWith("SHIFT_REQUIRED");
      renderToastMessage((toast.error as jest.Mock).mock.calls[0]!);
      expect(screen.getByTestId("toast-body")).toHaveTextContent(/start your shift first/i);
      expect(screen.getByRole("link", { name: /shift/i })).toHaveAttribute(
        "href",
        "/driver/tracking",
      );
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  // C6 (2026-08-17 mobile round): the POD photo uploaded fine but the driver's
  // completed-order screen never rendered it. The stored fileUrl is a public
  // URL into the private delivery-proofs bucket, so the screen must read the
  // signed URL from the files route (#506 bucket split), not the order row.
  describe("mandatory stage photos (driver-photo-signature-required)", () => {
    /** PATCH answers 422 with the given gate code once, then succeeds. */
    function installFetchRejectingPatchOnce(code: string, message: string) {
      let rejected = false;
      global.fetch = jest.fn((_url: string, opts?: RequestInit) => {
        const method = opts?.method ?? "GET";
        if (method === "PATCH" && !rejected) {
          rejected = true;
          return Promise.resolve({
            ok: false,
            status: 422,
            json: () => Promise.resolve({ error: code, code, message }),
          });
        }
        if (method === "PATCH") {
          const body = JSON.parse((opts?.body as string) ?? "{}");
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(makeOrder({ driverStatus: body.driverStatus })),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(currentOrder),
        });
      }) as unknown as typeof fetch;
    }

    const patchCalls = () =>
      (global.fetch as jest.Mock).mock.calls.filter((c) => c[1]?.method === "PATCH");

    it("requires a photo of the order before confirming pickup: photo sheet first, no confirmation sheet, no PATCH", async () => {
      currentOrder = makeOrder({ driverStatus: DriverStatus.ARRIVED_AT_VENDOR });
      renderDetail();

      fireEvent.click(await screen.findByText("Picked up the order"));

      expect(await screen.findByText("Photo of the order")).toBeInTheDocument();
      expect(screen.getByTestId("pod-capture")).toBeInTheDocument();
      expect(screen.queryByTestId("signature-capture")).not.toBeInTheDocument();
      expect(patchCalls()).toHaveLength(0);
    });

    it("uploads the pickup photo to the pickup-photo endpoint, then opens the pickup confirmation, and PATCHes PICKED_UP only after it", async () => {
      currentOrder = makeOrder({ driverStatus: DriverStatus.ARRIVED_AT_VENDOR });
      renderDetail();

      fireEvent.click(await screen.findByText("Picked up the order"));
      await screen.findByText("Photo of the order");

      // The photo sheet posts to the pickup endpoint, not the POD one.
      expect(screen.getByTestId("pod-capture")).toHaveAttribute(
        "data-endpoint",
        "/api/orders/CV-12345/pickup-photo",
      );

      // The photo of the order stays a single photo (the 3-photo cap is POD only).
      expect(screen.getByTestId("pod-capture")).toHaveAttribute("data-max-photos", "1");

      fireEvent.click(screen.getByRole("button", { name: /finish pod upload/i }));

      expect(await screen.findByTestId("signature-capture")).toBeInTheDocument();
      expect(patchCalls()).toHaveLength(0);

      fireEvent.click(screen.getByRole("button", { name: /finish signature/i }));
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/orders/CV-12345"),
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ driverStatus: DriverStatus.PICKED_UP }),
          }),
        );
      });
    });

    it("skips the photo sheet when the order already carries a pickup_photo upload", async () => {
      currentOrder = makeOrder({
        driverStatus: DriverStatus.ARRIVED_AT_VENDOR,
        fileUploads: [{ category: "pickup_photo", fileUrl: "https://x/pickup.jpg" }],
      });
      renderDetail();

      fireEvent.click(await screen.findByText("Picked up the order"));

      expect(await screen.findByTestId("signature-capture")).toBeInTheDocument();
      expect(screen.queryByText("Photo of the order")).not.toBeInTheDocument();
    });

    it("reopens the photo sheet when the server answers 422 PICKUP_PHOTO_REQUIRED (client state was stale)", async () => {
      currentOrder = makeOrder({
        driverStatus: DriverStatus.ARRIVED_AT_VENDOR,
        fileUploads: [{ category: "pickup_photo" }],
      });
      installFetchRejectingPatchOnce(
        "PICKUP_PHOTO_REQUIRED",
        "Take a photo of the order at the vendor before marking it picked up.",
      );
      renderDetail();

      fireEvent.click(await screen.findByText("Picked up the order"));
      fireEvent.click(await screen.findByRole("button", { name: /finish signature/i }));

      expect(await screen.findByText("Photo of the order")).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith(
        "Take a photo of the order at the vendor before marking it picked up.",
      );
    });

    it("completes directly when the photo and the recipient are already on file", async () => {
      currentOrder = makeOrder({
        driverStatus: DriverStatus.ARRIVED_TO_CLIENT,
        fileUploads: [{ category: "proof_of_delivery" }],
        deliveryReceivedBy: "Sam Carter",
      });
      renderDetail();

      fireEvent.click(await screen.findByText("Complete delivery"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/orders/CV-12345"),
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ driverStatus: DriverStatus.COMPLETED }),
          }),
        );
      });
      expect(screen.queryByTestId("pod-capture")).not.toBeInTheDocument();
    });

    it("reopens the POD sheet when the server answers 422 POD_REQUIRED", async () => {
      currentOrder = makeOrder({
        driverStatus: DriverStatus.ARRIVED_TO_CLIENT,
        fileUploads: [{ category: "proof_of_delivery" }],
        deliveryReceivedBy: "Sam Carter",
      });
      installFetchRejectingPatchOnce(
        "POD_REQUIRED",
        "Take a photo of the setup before completing the delivery.",
      );
      renderDetail();

      fireEvent.click(await screen.findByText("Complete delivery"));

      expect(await screen.findByText("Proof of delivery")).toBeInTheDocument();
      expect(screen.getByTestId("pod-capture")).toHaveAttribute(
        "data-endpoint",
        "/api/orders/CV-12345/pod",
      );
      expect(toast.error).toHaveBeenCalledWith(
        "Take a photo of the setup before completing the delivery.",
      );
    });
  });

  describe("recipient signature or name at completion (Gary Jun-1/22)", () => {
    const patchCalls = () =>
      (global.fetch as jest.Mock).mock.calls.filter((c) => c[1]?.method === "PATCH");

    it("states the full completion requirement on the Next-Action", async () => {
      currentOrder = makeOrder({ driverStatus: DriverStatus.ARRIVED_TO_CLIENT });
      renderDetail();

      expect(
        await screen.findByText(/photo \+ recipient signature or name required/i),
      ).toBeInTheDocument();
    });

    it("opens the recipient sheet after the setup photo, and PATCHes COMPLETED only after it", async () => {
      currentOrder = makeOrder({ driverStatus: DriverStatus.ARRIVED_TO_CLIENT });
      renderDetail();

      fireEvent.click(await screen.findByText("Complete delivery"));
      fireEvent.click(await screen.findByRole("button", { name: /finish pod upload/i }));

      const capture = await screen.findByTestId("signature-capture");
      expect(capture).toHaveAttribute("data-stage", "delivery");
      expect(capture).toHaveAttribute("data-endpoint", "/api/orders/CV-12345/recipient");
      expect(screen.getByText("Recipient signature")).toBeInTheDocument();
      expect(patchCalls()).toHaveLength(0);

      fireEvent.click(screen.getByRole("button", { name: /finish signature/i }));
      await waitFor(() =>
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/orders/CV-12345"),
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ driverStatus: DriverStatus.COMPLETED }),
          }),
        ),
      );
    });

    it("goes straight to the recipient sheet when the photo is on file but the recipient is not", async () => {
      currentOrder = makeOrder({
        driverStatus: DriverStatus.ARRIVED_TO_CLIENT,
        fileUploads: [{ category: "proof_of_delivery" }],
      });
      renderDetail();

      fireEvent.click(await screen.findByText("Complete delivery"));

      expect(await screen.findByTestId("signature-capture")).toHaveAttribute(
        "data-stage",
        "delivery",
      );
      expect(screen.queryByTestId("pod-capture")).not.toBeInTheDocument();
      expect(patchCalls()).toHaveLength(0);
    });

    it("counts a delivery_signature upload as the recipient confirmation", async () => {
      currentOrder = makeOrder({
        driverStatus: DriverStatus.ARRIVED_TO_CLIENT,
        fileUploads: [{ category: "proof_of_delivery" }, { category: "delivery_signature" }],
      });
      renderDetail();

      fireEvent.click(await screen.findByText("Complete delivery"));

      await waitFor(() =>
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/orders/CV-12345"),
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ driverStatus: DriverStatus.COMPLETED }),
          }),
        ),
      );
      expect(screen.queryByTestId("signature-capture")).not.toBeInTheDocument();
    });

    it("reopens the recipient sheet when the server answers 422 RECIPIENT_REQUIRED", async () => {
      currentOrder = makeOrder({
        driverStatus: DriverStatus.ARRIVED_TO_CLIENT,
        fileUploads: [{ category: "proof_of_delivery" }],
        deliveryReceivedBy: "Sam Carter",
      });
      let rejected = false;
      global.fetch = jest.fn((_url: string, opts?: RequestInit) => {
        if (opts?.method === "PATCH" && !rejected) {
          rejected = true;
          return Promise.resolve({
            ok: false,
            status: 422,
            json: () =>
              Promise.resolve({
                error: "RECIPIENT_REQUIRED",
                code: "RECIPIENT_REQUIRED",
                message: "Get the recipient's signature, or their name if they refuse to sign.",
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(currentOrder),
        });
      }) as unknown as typeof fetch;
      renderDetail();

      fireEvent.click(await screen.findByText("Complete delivery"));

      expect(await screen.findByTestId("signature-capture")).toHaveAttribute(
        "data-stage",
        "delivery",
      );
      expect(toast.error).toHaveBeenCalledWith(
        "Get the recipient's signature, or their name if they refuse to sign.",
      );
    });

    it("shows who received the order on a completed delivery", async () => {
      currentOrder = makeOrder({
        driverStatus: DriverStatus.COMPLETED,
        deliveryReceivedBy: "Sam Carter",
      });
      renderDetail();

      expect(await screen.findByText("Received by")).toBeInTheDocument();
      expect(screen.getByText("Sam Carter")).toBeInTheDocument();
    });
  });

  describe("proof-of-delivery photo on a completed delivery", () => {
    const SIGNED_POD_URL =
      "https://supabase.example/storage/v1/object/sign/delivery-proofs/pod.jpg?token=abc";

    function installFetchWithFiles(files: unknown[]) {
      global.fetch = jest.fn((url: string) => {
        if (String(url).includes("/files")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(files),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(currentOrder),
        });
      }) as unknown as typeof fetch;
    }

    it("renders the signed POD photo from the files route", async () => {
      currentOrder = makeOrder({ driverStatus: DriverStatus.COMPLETED });
      installFetchWithFiles([
        {
          category: "pickup_signature",
          fileUrl: "https://supabase.example/sign/signature.png",
        },
        {
          category: "proof_of_delivery",
          fileUrl: SIGNED_POD_URL,
        },
      ]);
      renderDetail();

      const photo = await screen.findByRole("img", { name: /proof of delivery/i });
      expect(photo).toHaveAttribute("src", SIGNED_POD_URL);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/orders/CV-12345/files",
        expect.objectContaining({ credentials: "include" }),
      );
    });

    it("renders every proof-of-delivery photo when the delivery has several", async () => {
      currentOrder = makeOrder({ driverStatus: DriverStatus.COMPLETED });
      installFetchWithFiles([
        { category: "proof_of_delivery", fileUrl: `${SIGNED_POD_URL}&n=1` },
        { category: "pickup_photo", fileUrl: "https://supabase.example/sign/pickup.jpg" },
        { category: "proof_of_delivery", fileUrl: `${SIGNED_POD_URL}&n=2` },
        { category: "proof_of_delivery", fileUrl: `${SIGNED_POD_URL}&n=3` },
      ]);
      renderDetail();

      await screen.findByRole("img", { name: /proof of delivery photo 1 of 3/i });
      const photos = screen.getAllByRole("img", { name: /proof of delivery photo/i });
      expect(photos.map((img) => img.getAttribute("src"))).toEqual([
        `${SIGNED_POD_URL}&n=1`,
        `${SIGNED_POD_URL}&n=2`,
        `${SIGNED_POD_URL}&n=3`,
      ]);
    });

    it("does not fetch files while the delivery is still in progress", async () => {
      currentOrder = makeOrder({ driverStatus: DriverStatus.EN_ROUTE_TO_CLIENT });
      installFetchWithFiles([{ category: "proof_of_delivery", fileUrl: SIGNED_POD_URL }]);
      renderDetail();
      await screen.findByText("Acme Corp");

      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining("/files"),
        expect.anything(),
      );
      expect(
        screen.queryByRole("img", { name: /proof of delivery/i }),
      ).not.toBeInTheDocument();
    });
  });
});
