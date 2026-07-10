import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
jest.mock("@/hooks/tracking/useTrackingSettings", () => ({
  TRACKING_SETTINGS_QUERY_KEY: ["tracking-settings"],
  useTrackingSettings: () => ({
    settings: jest.requireActual("@/types/tracking-settings").TRACKING_SETTINGS_DEFAULTS,
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
  ProofOfDeliveryCapture: ({ onUploadComplete }: any) => (
    <div data-testid="pod-capture">
      <button onClick={() => onUploadComplete("https://pod.example/photo.jpg")}>
        finish pod upload
      </button>
    </div>
  ),
}));

jest.mock("@/components/Driver/SignatureCapture", () => ({
  SignatureCapture: ({ onUploadComplete }: any) => (
    <div data-testid="signature-capture">
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

  it("keeps the POD sheet open when completing the delivery fails", async () => {
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

    // Drive the capture flow to completion; the status update fails.
    fireEvent.click(screen.getByRole("button", { name: /finish pod upload/i }));
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
    // podTarget is only cleared on success — the sheet must stay open so the
    // driver can retry without re-capturing the proof.
    expect(screen.getByTestId("pod-capture")).toBeInTheDocument();
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

  it("routes the pickup step through the signature sheet instead of advancing directly", async () => {
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

    // The signature sheet opens and NO status update happens yet.
    expect(await screen.findByTestId("signature-capture")).toBeInTheDocument();
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

    it("disables End shift while a delivery is mid-flight", () => {
      mockUseDriverTracking.mockReturnValue(
        withDelivery({ status: DriverStatus.EN_ROUTE_TO_CLIENT }),
      );
      renderPortal();
      expect(
        screen.getByRole("button", { name: /end shift/i }),
      ).toBeDisabled();
      expect(screen.getByText(/1 delivery to finish first/i)).toBeInTheDocument();
      expect(endShift).not.toHaveBeenCalled();
    });

    it("disables End shift for an ASSIGNED delivery whose pickup is overdue", () => {
      mockUseDriverTracking.mockReturnValue(
        withDelivery({
          status: DriverStatus.ASSIGNED,
          scheduledPickupAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
        }),
      );
      renderPortal();
      expect(
        screen.getByRole("button", { name: /end shift/i }),
      ).toBeDisabled();
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
});
