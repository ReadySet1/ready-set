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

// Light map mock (real one needs Mapbox + a token).
jest.mock("@/components/Driver/DriverLiveMap", () => ({
  __esModule: true,
  default: ({ activeDeliveries }: any) => (
    <div data-testid="driver-live-map">map ({activeDeliveries?.length ?? 0})</div>
  ),
}));

// POD capture pulls in camera APIs — stub it for the sheet path.
jest.mock("@/components/Driver/ProofOfDeliveryCapture", () => ({
  ProofOfDeliveryCapture: () => <div data-testid="pod-capture" />,
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

  it("shows an offline banner when offline", () => {
    mockUseDriverTracking.mockReturnValue(
      baseCtx({ isOnline: false, queuedItems: 3 }),
    );
    renderPortal();
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    expect(screen.getByText(/3 updates queued/i)).toBeInTheDocument();
  });
});
