import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import DriverTrackingPortal from "../DriverTrackingPortal";
import { DriverThemeProvider } from "@/components/Driver/ui/DriverThemeProvider";
import { useDriverTracking } from "@/contexts/DriverTrackingContext";
import { DriverStatus } from "@/types/user";

// Mock the tracking context hook.
jest.mock("@/contexts/DriverTrackingContext", () => ({
  useDriverTracking: jest.fn(),
  DriverTrackingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

import toast from "react-hot-toast";

// Tracking settings are fetched via TanStack Query in production; tests run
// without a QueryClientProvider, so pin the hook to the fail-open defaults.
// Individual tests may override via mockTrackingSettingsOverride.
const mockTrackingSettingsOverride: { current: Record<string, number> | null } =
  { current: null };
jest.mock("@/hooks/tracking/useTrackingSettings", () => ({
  TRACKING_SETTINGS_QUERY_KEY: ["tracking-settings"],
  useTrackingSettings: () => ({
    settings:
      mockTrackingSettingsOverride.current ??
      jest.requireActual("@/types/tracking-settings").TRACKING_SETTINGS_DEFAULTS,
    isLoaded: true,
  }),
}));


// Light map mock (real one needs Mapbox + a token).
jest.mock("@/components/Driver/DriverLiveMap", () => ({
  __esModule: true,
  default: ({ activeDeliveries }: any) => (
    <div data-testid="driver-live-map">map ({activeDeliveries?.length ?? 0})</div>
  ),
}));

// POD capture pulls in camera APIs — stub it for the sheet path. The stub
// exposes a button so tests can drive the upload-complete callback.
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

// Bearer transport for the return sheet's POST (cookie fallback stays on).
jest.mock("@/lib/auth/bearer-session", () => ({
  withBearerAuth: jest.fn(async (base: Record<string, string> = {}) => ({
    ...base,
    Authorization: "Bearer test-token",
  })),
}));

jest.mock("@/components/Driver/SignatureCapture", () => ({
  SignatureCapture: ({ onUploadComplete, stage, uploadEndpoint }: any) => (
    <div
      data-testid="signature-capture"
      data-stage={stage ?? "pickup"}
      data-endpoint={uploadEndpoint}
    >
      <button onClick={() => onUploadComplete("https://pod.example/signature.png")}>
        finish signature upload
      </button>
    </div>
  ),
}));

const mockUseDriverTracking = useDriverTracking as jest.MockedFunction<
  typeof useDriverTracking
>;

const startTracking = jest.fn();
const stopTracking = jest.fn();
const requestLocationPermission = jest.fn().mockResolvedValue(true);
const startShift = jest.fn().mockResolvedValue(true);
const endShift = jest.fn().mockResolvedValue(true);
const updateDeliveryStatus = jest.fn().mockResolvedValue(true);
// The portal advances through advanceDeliveryStatus (structured outcome);
// by default it mirrors updateDeliveryStatus so the boolean-based tests keep
// driving it, and a test can resolve it with a 422 gate outcome directly.
const advanceDeliveryStatus = jest.fn(async (...args: unknown[]) => {
  const result = await updateDeliveryStatus(...args);
  if (result === true) return { ok: true };
  return result && typeof result === "object" ? result : { ok: false };
});
const refreshDeliveries = jest.fn().mockResolvedValue(undefined);

const sampleLocation = {
  driverId: "driver-1",
  coordinates: { lat: 37.77, lng: -122.41 },
  accuracy: 12,
  speed: 0,
  heading: 0,
  isMoving: false,
  activityType: "stationary" as const,
  timestamp: new Date(),
};

function baseCtx(overrides: Record<string, unknown> = {}) {
  return {
    currentLocation: null,
    isTracking: false,
    accuracy: null,
    locationError: null,
    isRealtimeConnected: false,
    isRealtimeEnabled: true,
    connectionMode: "rest",
    permissionState: "granted",
    isRequestingPermission: false,
    startTracking,
    stopTracking,
    requestLocationPermission,
    updateLocationManually: jest.fn(),
    currentShift: null,
    isShiftActive: false,
    shiftLoading: false,
    shiftError: null,
    startShift,
    endShift,
    activeDeliveries: [],
    deliveriesLoading: false,
    deliveriesError: null,
    updateDeliveryStatus,
    advanceDeliveryStatus,
    refreshDeliveries,
    isOnline: true,
    queuedItems: 0,
    ...overrides,
  } as any;
}

function renderPortal() {
  return render(
    <DriverThemeProvider>
      <DriverTrackingPortal />
    </DriverThemeProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

describe("DriverTrackingPortal (redesigned)", () => {
  it("shows the request-permission CTA when off shift without a location", () => {
    mockUseDriverTracking.mockReturnValue(
      baseCtx({ permissionState: "prompt", currentLocation: null }),
    );
    renderPortal();
    expect(
      screen.getByRole("button", { name: /request location permission/i }),
    ).toBeInTheDocument();
  });

  it("starts a shift when permission is granted and a location exists", async () => {
    mockUseDriverTracking.mockReturnValue(
      baseCtx({ permissionState: "granted", currentLocation: sampleLocation }),
    );
    renderPortal();
    fireEvent.click(screen.getByRole("button", { name: /start shift/i }));
    await waitFor(() => expect(startShift).toHaveBeenCalledWith(sampleLocation));
    await waitFor(() => expect(startTracking).toHaveBeenCalled());
  });

  it("renders the live map + End shift while on shift", () => {
    mockUseDriverTracking.mockReturnValue(
      baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
        currentLocation: sampleLocation,
        accuracy: 20,
      }),
    );
    renderPortal();
    expect(screen.getByTestId("driver-live-map")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /end shift/i })).toBeInTheDocument();
  });

  it("advances a non-final delivery via the Next-Action button", async () => {
    mockUseDriverTracking.mockReturnValue(
      baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
        currentLocation: sampleLocation,
        activeDeliveries: [
          {
            id: "del-1",
            cateringRequestId: "cr-1",
            driverId: "driver-1",
            status: DriverStatus.ASSIGNED,
            deliveryLocation: { coordinates: [-122.41, 37.77] },
          },
        ],
      }),
    );
    renderPortal();
    fireEvent.click(screen.getByText(/on my way to vendor/i));
    await waitFor(() =>
      expect(updateDeliveryStatus).toHaveBeenCalledWith(
        "del-1",
        DriverStatus.EN_ROUTE_TO_VENDOR,
        sampleLocation,
      ),
    );
  });

  it("toasts when a status update fails instead of failing silently", async () => {
    updateDeliveryStatus.mockResolvedValueOnce(false);
    mockUseDriverTracking.mockReturnValue(
      baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
        currentLocation: sampleLocation,
        activeDeliveries: [
          {
            id: "del-1",
            cateringRequestId: "cr-1",
            driverId: "driver-1",
            status: DriverStatus.ASSIGNED,
            deliveryLocation: { coordinates: [-122.41, 37.77] },
          },
        ],
      }),
    );
    renderPortal();
    fireEvent.click(screen.getByText(/on my way to vendor/i));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/couldn't update the delivery status/i),
      ),
    );
  });

  it("does not toast when a status update succeeds", async () => {
    mockUseDriverTracking.mockReturnValue(
      baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
        currentLocation: sampleLocation,
        activeDeliveries: [
          {
            id: "del-1",
            cateringRequestId: "cr-1",
            driverId: "driver-1",
            status: DriverStatus.ASSIGNED,
            deliveryLocation: { coordinates: [-122.41, 37.77] },
          },
        ],
      }),
    );
    renderPortal();
    fireEvent.click(screen.getByText(/on my way to vendor/i));
    await waitFor(() => expect(updateDeliveryStatus).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows all error banners at once instead of masking later ones", () => {
    mockUseDriverTracking.mockReturnValue(
      baseCtx({
        locationError: "Location access denied",
        deliveriesError: "Access denied",
      }),
    );
    renderPortal();
    expect(screen.getByText(/location access denied/i)).toBeInTheDocument();
    expect(screen.getByText(/^access denied$/i)).toBeInTheDocument();
  });

  it("shows a banner when the server keeps rejecting location updates", () => {
    mockUseDriverTracking.mockReturnValue(
      baseCtx({
        isShiftActive: true,
        locationSyncError:
          "Your location isn't being saved. Contact dispatch so they can check your driver account.",
      }),
    );
    renderPortal();
    expect(screen.getByText(/location isn.t being saved/i)).toBeInTheDocument();
  });

  it("renders one banner per error source even when messages are identical", () => {
    // The banner list is keyed by source slot, not message text — two sources
    // failing with the same wording must not collapse into one banner.
    mockUseDriverTracking.mockReturnValue(
      baseCtx({
        shiftError: "Access denied",
        deliveriesError: "Access denied",
      }),
    );
    renderPortal();
    expect(screen.getAllByText(/^access denied$/i)).toHaveLength(2);
  });

  it("closes the POD sheet immediately and toasts when completing the delivery fails", async () => {
    updateDeliveryStatus.mockResolvedValueOnce(false);
    mockUseDriverTracking.mockReturnValue(
      baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
        currentLocation: sampleLocation,
        activeDeliveries: [
          {
            id: "del-1",
            cateringRequestId: "cr-1",
            driverId: "driver-1",
            status: DriverStatus.ARRIVED_TO_CLIENT,
            deliveryLocation: { coordinates: [-122.41, 37.77] },
          },
        ],
      }),
    );
    renderPortal();

    // The final step routes through proof-of-delivery capture.
    fireEvent.click(screen.getByText(/complete delivery/i));
    expect(await screen.findByTestId("pod-capture")).toBeInTheDocument();
    // Same completion photo as the detail screen: up to 3 photos.
    expect(screen.getByTestId("pod-capture")).toHaveAttribute("data-max-photos", "3");

    // Drive the capture flow (photo, then recipient) to completion; the
    // status update fails.
    fireEvent.click(screen.getByRole("button", { name: /finish pod upload/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /finish signature upload/i }),
    );

    // The uploads already succeeded — the sheet closes right away and the
    // failed advance is surfaced via toast (retry from the delivery card).
    await waitFor(() =>
      expect(screen.queryByTestId("signature-capture")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(updateDeliveryStatus).toHaveBeenCalledWith(
        "del-1",
        DriverStatus.COMPLETED,
        sampleLocation,
      ),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/couldn't update the delivery status/i),
      ),
    );
  });

  it("asks for the recipient's signature or name after the setup photo, before completing", async () => {
    mockUseDriverTracking.mockReturnValue(
      baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
        currentLocation: sampleLocation,
        activeDeliveries: [
          {
            id: "del-1",
            cateringRequestId: "cr-1",
            driverId: "driver-1",
            status: DriverStatus.ARRIVED_TO_CLIENT,
            deliveryLocation: { coordinates: [-122.41, 37.77] },
          },
        ],
      }),
    );
    renderPortal();

    fireEvent.click(screen.getByText(/complete delivery/i));
    fireEvent.click(await screen.findByRole("button", { name: /finish pod upload/i }));

    const capture = await screen.findByTestId("signature-capture");
    expect(capture).toHaveAttribute("data-stage", "delivery");
    expect(capture).toHaveAttribute("data-endpoint", "/api/orders/cr-1/recipient");
    expect(screen.queryByTestId("pod-capture")).not.toBeInTheDocument();
    expect(updateDeliveryStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /finish signature upload/i }));
    await waitFor(() =>
      expect(updateDeliveryStatus).toHaveBeenCalledWith(
        "del-1",
        DriverStatus.COMPLETED,
        sampleLocation,
      ),
    );
  });

  it("closes the POD sheet before the status update resolves", async () => {
    let resolveAdvance: (ok: boolean) => void = () => {};
    updateDeliveryStatus.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (resolveAdvance = resolve)),
    );
    mockUseDriverTracking.mockReturnValue(
      baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
        currentLocation: sampleLocation,
        activeDeliveries: [
          {
            id: "del-1",
            cateringRequestId: "cr-1",
            driverId: "driver-1",
            status: DriverStatus.ARRIVED_TO_CLIENT,
            deliveryLocation: { coordinates: [-122.41, 37.77] },
          },
        ],
      }),
    );
    renderPortal();

    fireEvent.click(screen.getByText(/complete delivery/i));
    expect(await screen.findByTestId("pod-capture")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /finish pod upload/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /finish signature upload/i }),
    );

    // The sheet must close while the PATCH + refetch are still in flight —
    // on LTE they take seconds and an open sheet reads as a hang.
    await waitFor(() =>
      expect(screen.queryByTestId("signature-capture")).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId("pod-capture")).not.toBeInTheDocument();
    expect(updateDeliveryStatus).toHaveBeenCalledWith(
      "del-1",
      DriverStatus.COMPLETED,
      sampleLocation,
    );

    await act(async () => resolveAdvance(true));
  });

  it("closes the signature sheet before the status update resolves", async () => {
    let resolveAdvance: (ok: boolean) => void = () => {};
    updateDeliveryStatus.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (resolveAdvance = resolve)),
    );
    mockUseDriverTracking.mockReturnValue(
      baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
        currentLocation: sampleLocation,
        activeDeliveries: [
          {
            id: "del-1",
            cateringRequestId: "cr-1",
            driverId: "driver-1",
            status: DriverStatus.ARRIVED_AT_VENDOR,
            deliveryLocation: { coordinates: [-122.41, 37.77] },
          },
        ],
      }),
    );
    renderPortal();

    fireEvent.click(screen.getByText(/picked up the order/i));
    fireEvent.click(await screen.findByRole("button", { name: /finish pod upload/i }));
    expect(await screen.findByTestId("signature-capture")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /finish signature upload/i }),
    );

    await waitFor(() =>
      expect(screen.queryByTestId("signature-capture")).not.toBeInTheDocument(),
    );
    expect(updateDeliveryStatus).toHaveBeenCalledWith(
      "del-1",
      DriverStatus.PICKED_UP,
      sampleLocation,
    );

    await act(async () => resolveAdvance(true));
  });

  it("filters Active deliveries by scheduled pickup date via the Today/All chips", () => {
    const today = new Date();
    const nextWeek = new Date(Date.now() + 7 * 24 * 3600_000);
    mockUseDriverTracking.mockReturnValue(
      baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
        currentLocation: sampleLocation,
        activeDeliveries: [
          {
            id: "del-today",
            cateringRequestId: "CR-TODAY",
            driverId: "driver-1",
            status: DriverStatus.ASSIGNED,
            scheduledPickupAt: today,
            deliveryLocation: { coordinates: [-122.41, 37.77] },
          },
          {
            id: "del-later",
            cateringRequestId: "CR-LATER",
            driverId: "driver-1",
            status: DriverStatus.ASSIGNED,
            scheduledPickupAt: nextWeek,
            deliveryLocation: { coordinates: [-122.41, 37.77] },
          },
        ],
      }),
    );
    renderPortal();

    // Today has an entry, so the filter defaults to Today: only CR-TODAY shows.
    expect(screen.getByText(/#CR-TODAY/)).toBeInTheDocument();
    expect(screen.queryByText(/#CR-LATER/)).not.toBeInTheDocument();

    // Switching to All reveals both.
    fireEvent.click(screen.getByRole("button", { name: /all \(2\)/i }));
    expect(screen.getByText(/#CR-TODAY/)).toBeInTheDocument();
    expect(screen.getByText(/#CR-LATER/)).toBeInTheDocument();
  });

  it("routes the pickup step through the pickup photo, then the signature sheet, instead of advancing directly", async () => {
    // Jul-3 walk-test regression: this surface advanced ARRIVED_AT_VENDOR ->
    // PICKED_UP with no vendor signature (the gate only existed in
    // DriverDeliveryDetail). The pickup mandate applies on every surface.
    mockUseDriverTracking.mockReturnValue(
      baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
        currentLocation: sampleLocation,
        activeDeliveries: [
          {
            id: "del-1",
            cateringRequestId: "cr-1",
            driverId: "driver-1",
            status: DriverStatus.ARRIVED_AT_VENDOR,
            deliveryLocation: { coordinates: [-122.41, 37.77] },
          },
        ],
      }),
    );
    renderPortal();

    fireEvent.click(screen.getByText(/picked up the order/i));

    // The pickup photo sheet opens first (the server gates PICKED_UP on it)...
    expect(await screen.findByText("Photo of the order")).toBeInTheDocument();
    expect(screen.getByTestId("pod-capture")).toHaveAttribute(
      "data-endpoint",
      "/api/orders/cr-1/pickup-photo",
    );
    // The pickup photo stays a single photo; only the setup photo takes 3.
    expect(screen.getByTestId("pod-capture")).toHaveAttribute("data-max-photos", "1");
    expect(screen.queryByTestId("signature-capture")).not.toBeInTheDocument();
    expect(updateDeliveryStatus).not.toHaveBeenCalled();

    // ...then the pickup confirmation, still with NO status update.
    fireEvent.click(screen.getByRole("button", { name: /finish pod upload/i }));
    expect(await screen.findByTestId("signature-capture")).toHaveAttribute(
      "data-stage",
      "pickup",
    );
    expect(screen.queryByTestId("pod-capture")).not.toBeInTheDocument();
    expect(updateDeliveryStatus).not.toHaveBeenCalled();

    // Completing the signature advances to PICKED_UP.
    fireEvent.click(
      screen.getByRole("button", { name: /finish signature upload/i }),
    );
    await waitFor(() =>
      expect(updateDeliveryStatus).toHaveBeenCalledWith(
        "del-1",
        DriverStatus.PICKED_UP,
        sampleLocation,
      ),
    );
  });

  describe("Navigate target (2026-10-23 drives: Navigate sent the driver to the client while en route to the vendor)", () => {
    const PICKUP: [number, number] = [-101.6731, 21.1172];
    const DROPOFF: [number, number] = [-101.6861, 21.1236];
    const withStatus = (status: DriverStatus) =>
      baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
        currentLocation: sampleLocation,
        activeDeliveries: [
          {
            id: "del-1",
            cateringRequestId: "cr-1",
            driverId: "driver-1",
            status,
            pickupLocation: { coordinates: PICKUP },
            deliveryLocation: { coordinates: DROPOFF },
          },
        ],
      });
    const destinationOf = (url: string) =>
      decodeURIComponent(new URL(url).searchParams.get("destination") ?? "");

    let openSpy: jest.SpyInstance;
    beforeEach(() => {
      openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    });
    afterEach(() => openSpy.mockRestore());

    it("navigates to the pickup while en route to the vendor", () => {
      mockUseDriverTracking.mockReturnValue(withStatus(DriverStatus.EN_ROUTE_TO_VENDOR));
      renderPortal();
      fireEvent.click(screen.getByRole("button", { name: /^navigate$/i }));
      expect(destinationOf(openSpy.mock.calls[0]![0] as string)).toBe(`${PICKUP[1]},${PICKUP[0]}`);
    });

    it("navigates to the drop-off once the food is on board", () => {
      mockUseDriverTracking.mockReturnValue(withStatus(DriverStatus.EN_ROUTE_TO_CLIENT));
      renderPortal();
      fireEvent.click(screen.getByRole("button", { name: /^navigate$/i }));
      expect(destinationOf(openSpy.mock.calls[0]![0] as string)).toBe(`${DROPOFF[1]},${DROPOFF[0]}`);
    });

    describe("ungeocoded stops fall back to the address (same as the detail screen)", () => {
      const ungeocoded = (status: DriverStatus, withAddress = true) =>
        baseCtx({
          isShiftActive: true,
          currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
          currentLocation: sampleLocation,
          activeDeliveries: [
            {
              id: "del-1",
              cateringRequestId: "cr-1",
              driverId: "driver-1",
              status,
              pickupLocation: {
                coordinates: [0, 0],
                ...(withAddress ? { address: "1 Vendor St, SF, CA" } : {}),
              },
              deliveryLocation: {
                coordinates: [0, 0],
                ...(withAddress ? { address: "9 Client Ave, SF, CA" } : {}),
              },
            },
          ],
        });

      it("navigates to the pickup address before pickup", () => {
        mockUseDriverTracking.mockReturnValue(ungeocoded(DriverStatus.EN_ROUTE_TO_VENDOR));
        renderPortal();
        fireEvent.click(screen.getByRole("button", { name: /^navigate$/i }));
        expect(destinationOf(openSpy.mock.calls[0]![0] as string)).toBe("1 Vendor St, SF, CA");
      });

      it("navigates to the drop-off address after pickup", () => {
        mockUseDriverTracking.mockReturnValue(ungeocoded(DriverStatus.EN_ROUTE_TO_CLIENT));
        renderPortal();
        fireEvent.click(screen.getByRole("button", { name: /^navigate$/i }));
        expect(destinationOf(openSpy.mock.calls[0]![0] as string)).toBe("9 Client Ave, SF, CA");
      });

      it("hides Navigate when the stop has neither coordinates nor an address", () => {
        mockUseDriverTracking.mockReturnValue(ungeocoded(DriverStatus.EN_ROUTE_TO_VENDOR, false));
        renderPortal();
        expect(screen.queryByRole("button", { name: /^navigate$/i })).toBeNull();
      });
    });
  });

  describe("stage gates (same rules as the delivery detail screen)", () => {
    const onShift = (delivery: Record<string, unknown>) =>
      mockUseDriverTracking.mockReturnValue(
        baseCtx({
          isShiftActive: true,
          currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
          currentLocation: sampleLocation,
          activeDeliveries: [
            {
              id: "del-1",
              cateringRequestId: "cr-1",
              driverId: "driver-1",
              deliveryLocation: { coordinates: [-122.41, 37.77] },
              ...delivery,
            },
          ],
        }),
      );

    const rejectOnce = (code: string, message?: string) =>
      advanceDeliveryStatus.mockResolvedValueOnce({
        ok: false,
        status: 422,
        code,
        ...(message ? { message } : {}),
      } as any);

    const genericToastShown = () =>
      (toast.error as jest.Mock).mock.calls.some(([m]) =>
        /couldn't update the delivery status/i.test(String(m)),
      );

    /** Pickup flow: photo → confirmation → advance. */
    const runPickup = async () => {
      fireEvent.click(screen.getByText(/picked up the order/i));
      fireEvent.click(await screen.findByRole("button", { name: /finish pod upload/i }));
      fireEvent.click(
        await screen.findByRole("button", { name: /finish signature upload/i }),
      );
    };

    it("goes straight to the recipient sheet when the setup photo is already on file", async () => {
      onShift({
        status: DriverStatus.ARRIVED_TO_CLIENT,
        proofOfDelivery: "https://pod.example/photo.jpg",
      });
      renderPortal();

      fireEvent.click(screen.getByText(/complete delivery/i));

      expect(await screen.findByTestId("signature-capture")).toHaveAttribute(
        "data-stage",
        "delivery",
      );
      expect(screen.queryByTestId("pod-capture")).not.toBeInTheDocument();
      expect(advanceDeliveryStatus).not.toHaveBeenCalled();
    });

    it("reopens the pickup photo sheet with a plain message on 422 PICKUP_PHOTO_REQUIRED", async () => {
      onShift({ status: DriverStatus.ARRIVED_AT_VENDOR });
      rejectOnce(
        "PICKUP_PHOTO_REQUIRED",
        "Take a photo of the order at the vendor before marking it picked up.",
      );
      renderPortal();

      await runPickup();

      expect(await screen.findByText("Photo of the order")).toBeInTheDocument();
      expect(screen.getByTestId("pod-capture")).toHaveAttribute(
        "data-endpoint",
        "/api/orders/cr-1/pickup-photo",
      );
      expect(toast.error).toHaveBeenCalledWith(
        "Take a photo of the order at the vendor before marking it picked up.",
      );
      expect(genericToastShown()).toBe(false);
    });

    it("reopens the pickup confirmation on 422 PICKUP_CONFIRMATION_REQUIRED", async () => {
      onShift({ status: DriverStatus.ARRIVED_AT_VENDOR });
      rejectOnce("PICKUP_CONFIRMATION_REQUIRED");
      renderPortal();

      await runPickup();

      await waitFor(() =>
        expect(screen.getByTestId("signature-capture")).toHaveAttribute(
          "data-stage",
          "pickup",
        ),
      );
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/handed over the order/i),
      );
      expect(genericToastShown()).toBe(false);
    });

    it("reopens the POD sheet on 422 POD_REQUIRED, with plain fallback copy when the server sent none", async () => {
      onShift({
        status: DriverStatus.ARRIVED_TO_CLIENT,
        proofOfDelivery: "https://pod.example/photo.jpg",
      });
      rejectOnce("POD_REQUIRED");
      renderPortal();

      fireEvent.click(screen.getByText(/complete delivery/i));
      fireEvent.click(
        await screen.findByRole("button", { name: /finish signature upload/i }),
      );

      await waitFor(() =>
        expect(screen.getByTestId("pod-capture")).toHaveAttribute(
          "data-endpoint",
          "/api/orders/cr-1/pod",
        ),
      );
      // The reopened setup-photo sheet is the multi-photo capture.
      expect(screen.getByTestId("pod-capture")).toHaveAttribute("data-max-photos", "3");
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/photo of the setup/i),
      );
      expect(genericToastShown()).toBe(false);
    });

    it("reopens the recipient sheet on 422 RECIPIENT_REQUIRED", async () => {
      onShift({
        status: DriverStatus.ARRIVED_TO_CLIENT,
        proofOfDelivery: "https://pod.example/photo.jpg",
      });
      rejectOnce(
        "RECIPIENT_REQUIRED",
        "Get the recipient's signature, or their name if they refuse to sign, before completing the delivery.",
      );
      renderPortal();

      fireEvent.click(screen.getByText(/complete delivery/i));
      fireEvent.click(
        await screen.findByRole("button", { name: /finish signature upload/i }),
      );

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "Get the recipient's signature, or their name if they refuse to sign, before completing the delivery.",
        ),
      );
      expect(await screen.findByTestId("signature-capture")).toHaveAttribute(
        "data-stage",
        "delivery",
      );
      expect(genericToastShown()).toBe(false);
    });

    it("shows the plain shift message on 422 SHIFT_REQUIRED", async () => {
      onShift({ status: DriverStatus.ASSIGNED });
      rejectOnce("SHIFT_REQUIRED");
      renderPortal();

      fireEvent.click(screen.getByText(/on my way to vendor/i));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/start your shift/i),
        ),
      );
      expect(genericToastShown()).toBe(false);
    });
  });

  it("shows an offline banner when offline", () => {
    mockUseDriverTracking.mockReturnValue(
      baseCtx({ isOnline: false, queuedItems: 3 }),
    );
    renderPortal();
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    expect(screen.getByText(/3 updates queued/i)).toBeInTheDocument();
  });

  describe("end-shift guard", () => {
    const withDelivery = (delivery: Record<string, unknown>) =>
      baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
        currentLocation: sampleLocation,
        activeDeliveries: [
          {
            id: "del-1",
            cateringRequestId: "cr-1",
            driverId: "driver-1",
            deliveryLocation: { coordinates: [-122.41, 37.77] },
            ...delivery,
          },
        ],
      });

    it("blocks End shift while a delivery is mid-flight", () => {
      mockUseDriverTracking.mockReturnValue(
        withDelivery({ status: DriverStatus.EN_ROUTE_TO_CLIENT }),
      );
      renderPortal();
      // aria-disabled (not the disabled attribute) so a tap on a stale client
      // can still trigger the self-heal path instead of being swallowed.
      expect(
        screen.getByRole("button", { name: /end shift/i }),
      ).toHaveAttribute("aria-disabled", "true");
      expect(
        screen.getByText(/order cr-1 to finish or return first/i),
      ).toBeInTheDocument();
      expect(endShift).not.toHaveBeenCalled();
    });

    it("offers a return-request escape hatch while blocked", async () => {
      // Issue #508: a driver stuck with an unstartable assignment could never
      // end their shift — the blocked state must offer the hand-back path
      // (now a request that dispatch reviews).
      mockUseDriverTracking.mockReturnValue(
        withDelivery({ status: DriverStatus.ASSIGNED, scheduledPickupAt: new Date(Date.now() - 3600_000) }),
      );
      renderPortal();

      fireEvent.click(
        screen.getByRole("button", { name: /request a return to dispatch/i }),
      );

      // The return sheet opens for the blocking delivery.
      expect(await screen.findByText(/^request a return$/i)).toBeInTheDocument();

      // Drive the sheet to completion against the return endpoint (202 =
      // request filed for dispatch review).
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 202,
          json: () =>
            Promise.resolve({ success: true, status: "PENDING_APPROVAL" }),
        }),
      ) as unknown as typeof fetch;
      fireEvent.click(screen.getByRole("button", { name: /vehicle issue/i }));
      fireEvent.click(screen.getByRole("button", { name: /request return/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/orders/cr-1/return",
          expect.objectContaining({ method: "POST" }),
        );
      });
      // The feed re-syncs so the End-shift button unblocks without a reload
      // (the feed now flags the order pendingReturn).
      await waitFor(() => expect(refreshDeliveries).toHaveBeenCalled());
    });

    it("does not offer the return button when nothing blocks the shift", () => {
      mockUseDriverTracking.mockReturnValue(
        withDelivery({
          status: DriverStatus.ASSIGNED,
          scheduledPickupAt: new Date(Date.now() + 26 * 60 * 60 * 1000),
        }),
      );
      renderPortal();
      expect(
        screen.queryByRole("button", { name: /request a return to dispatch/i }),
      ).not.toBeInTheDocument();
    });

    it("stops counting a delivery as a blocker once its return request is pending", () => {
      // Server parity: the end-shift guard excludes orders with a PENDING
      // return request, so the client mirror must not contradict it.
      mockUseDriverTracking.mockReturnValue(
        withDelivery({
          status: DriverStatus.EN_ROUTE_TO_CLIENT,
          pendingReturn: true,
        }),
      );
      renderPortal();
      expect(
        screen.getByRole("button", { name: /end shift/i }),
      ).not.toHaveAttribute("aria-disabled", "true");
      expect(
        screen.queryByRole("button", { name: /request a return to dispatch/i }),
      ).not.toBeInTheDocument();
    });

    it("blocks End shift for an ASSIGNED delivery whose pickup is overdue", () => {
      mockUseDriverTracking.mockReturnValue(
        withDelivery({
          status: DriverStatus.ASSIGNED,
          scheduledPickupAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
        }),
      );
      renderPortal();
      expect(
        screen.getByRole("button", { name: /end shift/i }),
      ).toHaveAttribute("aria-disabled", "true");
    });

    it("self-heals on tap while blocked: refreshes the feed, explains, and does not end the shift", async () => {
      mockUseDriverTracking.mockReturnValue(
        withDelivery({ status: DriverStatus.EN_ROUTE_TO_CLIENT }),
      );
      renderPortal();

      // The button is blocked but still tappable (aria-disabled, no disabled
      // attribute) — a stale client heals itself instead of ignoring the tap.
      fireEvent.click(screen.getByRole("button", { name: /end shift/i }));

      // Finding #8 (2026-08-21): the block names the order so the driver
      // knows which delivery to finish or return.
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "Order cr-1 is still assigned to you. Complete it or return it to dispatch before ending your shift.",
        ),
      );
      await waitFor(() => expect(refreshDeliveries).toHaveBeenCalled());
      expect(endShift).not.toHaveBeenCalled();
    });

    it("keeps End shift on one line next to a long blocked-state hint (375px)", () => {
      // 2026-10 iPhone X: the hint squeezed the button until it wrapped to
      // "End / shift". The button must not shrink; the hint column wraps.
      mockUseDriverTracking.mockReturnValue(
        withDelivery({ status: DriverStatus.EN_ROUTE_TO_CLIENT }),
      );
      renderPortal();
      const button = screen.getByRole("button", { name: /end shift/i });
      expect(button).toHaveClass("shrink-0", "whitespace-nowrap");
      const hint = screen.getByText(/order cr-1 to finish or return first/i);
      expect(hint.parentElement).toHaveClass("min-w-0");
    });

    it("names the blocking order in the blocked-state hint", () => {
      mockUseDriverTracking.mockReturnValue(
        withDelivery({ status: DriverStatus.EN_ROUTE_TO_CLIENT }),
      );
      renderPortal();
      expect(screen.getByText(/order cr-1/i)).toBeInTheDocument();
    });

    it("surfaces the server guard error verbatim when the feed shows no blocker", async () => {
      // A stale/legacy row can block server-side while the client feed is
      // empty; the server names the order and the portal must show it.
      mockUseDriverTracking.mockReturnValue(
        baseCtx({
          isShiftActive: true,
          currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
          currentLocation: sampleLocation,
          activeDeliveries: [],
          shiftError:
            "Order Test 0821261 is still assigned to you. Complete it or return it to dispatch before ending your shift.",
        }),
      );
      renderPortal();
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/Order Test 0821261 is still assigned to you/),
        ),
      );
    });

    it("allows End shift when the only assignment is well in the future", async () => {
      mockUseDriverTracking.mockReturnValue(
        withDelivery({
          status: DriverStatus.ASSIGNED,
          scheduledPickupAt: new Date(Date.now() + 26 * 60 * 60 * 1000), // tomorrow
        }),
      );
      renderPortal();
      const button = screen.getByRole("button", { name: /end shift/i });
      expect(button).toBeEnabled();
      fireEvent.click(button);
      await waitFor(() => expect(endShift).toHaveBeenCalled());
    });

    describe("admin-configured guard window", () => {
      const { TRACKING_SETTINGS_DEFAULTS } = jest.requireActual(
        "@/types/tracking-settings",
      );

      afterEach(() => {
        mockTrackingSettingsOverride.current = null;
      });

      it("does not block for an overdue ASSIGNED pickup when the guard is disabled (0)", () => {
        mockTrackingSettingsOverride.current = {
          ...TRACKING_SETTINGS_DEFAULTS,
          endShiftPickupGuardMinutes: 0,
        };
        mockUseDriverTracking.mockReturnValue(
          withDelivery({
            status: DriverStatus.ASSIGNED,
            scheduledPickupAt: new Date(Date.now() - 60 * 60 * 1000), // 1h overdue
          }),
        );
        renderPortal();
        expect(
          screen.getByRole("button", { name: /end shift/i }),
        ).toBeEnabled();
      });

      it("does not block for a stale ASSIGNED pickup more than 24h old", () => {
        mockTrackingSettingsOverride.current = {
          ...TRACKING_SETTINGS_DEFAULTS,
          endShiftPickupGuardMinutes: 120,
        };
        mockUseDriverTracking.mockReturnValue(
          withDelivery({
            status: DriverStatus.ASSIGNED,
            scheduledPickupAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          }),
        );
        renderPortal();
        // The button is aria-disabled (not `disabled`), so toBeEnabled() would
        // pass vacuously — assert on the attribute the guard actually sets.
        expect(
          screen.getByRole("button", { name: /end shift/i }),
        ).not.toHaveAttribute("aria-disabled", "true");
      });

      it("still blocks an overdue ASSIGNED pickup less than 24h old", () => {
        mockTrackingSettingsOverride.current = {
          ...TRACKING_SETTINGS_DEFAULTS,
          endShiftPickupGuardMinutes: 120,
        };
        mockUseDriverTracking.mockReturnValue(
          withDelivery({
            status: DriverStatus.ASSIGNED,
            scheduledPickupAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6h overdue
          }),
        );
        renderPortal();
        expect(
          screen.getByRole("button", { name: /end shift/i }),
        ).toHaveAttribute("aria-disabled", "true");
      });

      it("still blocks a mid-flight delivery when the guard is disabled (0)", () => {
        mockTrackingSettingsOverride.current = {
          ...TRACKING_SETTINGS_DEFAULTS,
          endShiftPickupGuardMinutes: 0,
        };
        mockUseDriverTracking.mockReturnValue(
          withDelivery({ status: DriverStatus.PICKED_UP }),
        );
        renderPortal();
        expect(
          screen.getByRole("button", { name: /end shift/i }),
        ).toHaveAttribute("aria-disabled", "true");
      });

      it("honors a shortened guard window from settings", () => {
        mockTrackingSettingsOverride.current = {
          ...TRACKING_SETTINGS_DEFAULTS,
          endShiftPickupGuardMinutes: 30,
        };
        // Pickup in 1h: inside the 120-min default but outside the 30-min window.
        mockUseDriverTracking.mockReturnValue(
          withDelivery({
            status: DriverStatus.ASSIGNED,
            scheduledPickupAt: new Date(Date.now() + 60 * 60 * 1000),
          }),
        );
        const { unmount } = renderPortal();
        expect(
          screen.getByRole("button", { name: /end shift/i }),
        ).toBeEnabled();
        unmount();

        // Pickup in 10 min: inside the 30-min window → blocked.
        mockUseDriverTracking.mockReturnValue(
          withDelivery({
            status: DriverStatus.ASSIGNED,
            scheduledPickupAt: new Date(Date.now() + 10 * 60 * 1000),
          }),
        );
        renderPortal();
        expect(
          screen.getByRole("button", { name: /end shift/i }),
        ).toHaveAttribute("aria-disabled", "true");
      });
    });
  });

  describe("arrival geofence", () => {
    const shiftCtx = (delivery: Record<string, unknown>) =>
      baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: new Date() },
        currentLocation: sampleLocation, // lat 37.77, lng -122.41
        activeDeliveries: [
          {
            id: "del-1",
            cateringRequestId: "cr-1",
            driverId: "driver-1",
            status: DriverStatus.EN_ROUTE_TO_VENDOR, // next = ARRIVED_AT_VENDOR
            deliveryLocation: { coordinates: [-122.41, 37.77] },
            ...delivery,
          },
        ],
      });

    it("disables the arrived advance and shows a distance hint when far from the pickup", () => {
      mockUseDriverTracking.mockReturnValue(
        shiftCtx({ pickupLocation: { coordinates: [-122.5, 37.9] } }), // ~16 km away
      );
      renderPortal();
      const button = screen
        .getByText(/i've arrived at vendor/i)
        .closest("button");
      expect(button).toBeDisabled();
      expect(
        screen.getByText(/away — move closer to enable/i),
      ).toBeInTheDocument();
    });

    it("keeps the arrived advance enabled when near the pickup", async () => {
      mockUseDriverTracking.mockReturnValue(
        shiftCtx({ pickupLocation: { coordinates: [-122.41, 37.7702] } }), // ~25 m
      );
      renderPortal();
      fireEvent.click(screen.getByText(/i've arrived at vendor/i));
      await waitFor(() =>
        expect(updateDeliveryStatus).toHaveBeenCalledWith(
          "del-1",
          DriverStatus.ARRIVED_AT_VENDOR,
          sampleLocation,
        ),
      );
    });

    it("fails open when the pickup address is ungeocoded ([0,0] fallback)", async () => {
      mockUseDriverTracking.mockReturnValue(
        shiftCtx({ pickupLocation: { coordinates: [0, 0] } }),
      );
      renderPortal();
      fireEvent.click(screen.getByText(/i've arrived at vendor/i));
      await waitFor(() =>
        expect(updateDeliveryStatus).toHaveBeenCalledWith(
          "del-1",
          DriverStatus.ARRIVED_AT_VENDOR,
          sampleLocation,
        ),
      );
    });
  });

  // 2026-10-14 Android field report: the header timer sat at 0:00 for whole
  // shifts while "Since 5:31 p.m." was right. The tester's phone clock runs
  // ~3,648 s behind the server (same device as the 2026-10-06 GPS skew,
  // PR #668), so `Date.now() - startTime` stayed negative and clamped to 0.
  describe("shift timer", () => {
    // Exactly what /api/tracking/shifts/active serializes (timestamptz → ISO Z).
    const START_ISO = "2026-10-14T23:31:00.000Z";
    const START_MS = Date.parse(START_ISO);

    afterEach(() => jest.useRealTimers());

    function activeShiftCtx(overrides: Record<string, unknown> = {}) {
      return baseCtx({
        isShiftActive: true,
        currentShift: { id: "s1", driverId: "driver-1", startTime: START_ISO, status: "active" },
        currentLocation: sampleLocation,
        ...overrides,
      });
    }

    it("counts up every second from the shift start", () => {
      jest.useFakeTimers();
      jest.setSystemTime(START_MS + 120_000);
      mockUseDriverTracking.mockReturnValue(activeShiftCtx({ clockOffsetMs: 0 }));
      renderPortal();
      expect(screen.getByText("2:00")).toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(5_000);
      });
      expect(screen.getByText("2:05")).toBeInTheDocument();
    });

    it("does not stick at 0:00 when the device clock runs an hour behind the server", () => {
      const deviceSkewMs = -3_648_000;
      jest.useFakeTimers();
      // Real time is two minutes into the shift; the phone reads an hour less.
      jest.setSystemTime(START_MS + 120_000 + deviceSkewMs);
      mockUseDriverTracking.mockReturnValue(
        activeShiftCtx({ clockOffsetMs: -deviceSkewMs }),
      );
      renderPortal();
      expect(screen.queryByText("0:00")).not.toBeInTheDocument();
      expect(screen.getByText("2:00")).toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(3_000);
      });
      expect(screen.getByText("2:03")).toBeInTheDocument();
    });
  });

  // C11 (2026-08-17 mobile round): after ending the shift the driver saw no
  // distance at all. The off-shift screen shows the last shift's miles, in
  // imperial units only.
  describe("last shift distance", () => {
    it("shows the ended shift distance in miles", () => {
      mockUseDriverTracking.mockReturnValue(
        baseCtx({ currentLocation: sampleLocation, lastShiftMiles: 0.62 }),
      );
      renderPortal();
      expect(screen.getByText(/last shift/i)).toHaveTextContent("0.6 mi");
    });

    it("shows nothing before any shift has ended", () => {
      mockUseDriverTracking.mockReturnValue(
        baseCtx({ currentLocation: sampleLocation, lastShiftMiles: null }),
      );
      renderPortal();
      expect(screen.queryByText(/last shift/i)).not.toBeInTheDocument();
    });
  });
});
