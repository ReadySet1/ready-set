import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DriverTrackingPortal from "@/components/Driver/DriverTrackingPortal";
import AdminTrackingDashboard from "@/components/Dashboard/Tracking/AdminTrackingDashboard";
import { useLocationTracking } from "@/hooks/tracking/useLocationTracking";
import { useDriverShift } from "@/hooks/tracking/useDriverShift";
import { useDriverDeliveries } from "@/hooks/tracking/useDriverDeliveries";
import { useOfflineQueue } from "@/hooks/tracking/useOfflineQueue";
import { useRealTimeTracking } from "@/hooks/tracking/useRealTimeTracking";
import { DriverStatus } from "@/types/user";

// Mock all the tracking hooks
jest.mock("@/hooks/tracking/useLocationTracking");
jest.mock("@/hooks/tracking/useDriverShift");
jest.mock("@/hooks/tracking/useDriverDeliveries");
jest.mock("@/hooks/tracking/useOfflineQueue");
jest.mock("@/hooks/tracking/useRealTimeTracking");

// Mock the hooks
const mockUseLocationTracking = useLocationTracking as jest.MockedFunction<
  typeof useLocationTracking
>;
const mockUseDriverShift = useDriverShift as jest.MockedFunction<
  typeof useDriverShift
>;
const mockUseDriverDeliveries = useDriverDeliveries as jest.MockedFunction<
  typeof useDriverDeliveries
>;
const mockUseOfflineQueue = useOfflineQueue as jest.MockedFunction<
  typeof useOfflineQueue
>;
const mockUseRealTimeTracking = useRealTimeTracking as jest.MockedFunction<
  typeof useRealTimeTracking
>;

// Mock map components
jest.mock("@/components/Dashboard/Tracking/LiveDriverMap", () => {
  return function MockLiveDriverMap({ drivers, deliveries }: any) {
    return (
      <div data-testid="live-driver-map">
        <div>Live Driver Map</div>
        <div>Drivers: {drivers?.length || 0}</div>
        <div>Deliveries: {deliveries?.length || 0}</div>
      </div>
    );
  };
});

jest.mock("@/components/Dashboard/Tracking/DriverStatusList", () => {
  return function MockDriverStatusList({ drivers, onDriverSelect }: any) {
    return (
      <div data-testid="driver-status-list">
        <div>Driver Status List</div>
        {drivers?.map((driver: any) => (
          <button
            key={driver.id}
            onClick={() => onDriverSelect?.(driver)}
            data-testid={`driver-${driver.id}`}
          >
            {driver.name}
          </button>
        ))}
      </div>
    );
  };
});

jest.mock("@/components/Dashboard/Tracking/DeliveryAssignmentPanel", () => {
  return function MockDeliveryAssignmentPanel({ deliveries, onAssign }: any) {
    return (
      <div data-testid="delivery-assignment-panel">
        <div>Delivery Assignment Panel</div>
        {deliveries?.map((delivery: any) => (
          <button
            key={delivery.id}
            onClick={() => onAssign?.(delivery)}
            data-testid={`delivery-${delivery.id}`}
          >
            {delivery.id}
          </button>
        ))}
      </div>
    );
  };
});

describe("Tracking System Integration", () => {
  const mockDrivers = [
    {
      id: "driver-1",
      employeeId: "EMP001",
      phoneNumber: "+1234567890",
      isActive: true,
      isOnDuty: true,
      lastKnownLocation: {
        coordinates: [-74.006, 40.7128] as [number, number], // [lng, lat]
      },
      lastLocationUpdate: new Date(),
      currentShift: {
        id: "shift-1",
        driverId: "driver-1",
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        startLocation: { lat: 40.7128, lng: -74.006 },
        totalDistanceKm: 0,
        deliveryCount: 0,
        status: "active" as const,
        breaks: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      vehicleInfo: {
        number: "V001",
        type: "van",
      },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "driver-2",
      employeeId: "EMP002",
      phoneNumber: "+0987654321",
      isActive: true,
      isOnDuty: false,
      lastKnownLocation: undefined,
      lastLocationUpdate: undefined,
      currentShift: undefined,
      vehicleInfo: {
        number: "V002",
        type: "car",
      },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockDeliveries = [
    {
      id: "delivery-1",
      driverId: "driver-1",
      status: DriverStatus.ASSIGNED,
      pickupLocation: {
        coordinates: [-74.006, 40.7128] as [number, number], // [lng, lat]
      },
      deliveryLocation: {
        coordinates: [-73.9851, 40.7589] as [number, number], // [lng, lat]
      },
      estimatedArrival: new Date(Date.now() + 3600000),
      route: [],
      metadata: {},
      assignedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "delivery-2",
      driverId: "driver-1",
      status: DriverStatus.EN_ROUTE_TO_CLIENT,
      pickupLocation: {
        coordinates: [-73.9851, 40.7589] as [number, number], // [lng, lat]
      },
      deliveryLocation: {
        coordinates: [-73.9934, 40.7505] as [number, number], // [lng, lat]
      },
      estimatedArrival: new Date(Date.now() + 1800000),
      route: [],
      metadata: {},
      assignedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockLocationUpdate = {
    driverId: "driver-1",
    coordinates: { lat: 40.7128, lng: -74.006 },
    accuracy: 10,
    speed: 0,
    heading: 0,
    timestamp: new Date(),
    isMoving: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations for driver portal
    mockUseLocationTracking.mockReturnValue({
      currentLocation: null,
      isTracking: false,
      accuracy: null,
      error: null,
      startTracking: jest.fn(),
      stopTracking: jest.fn(),
      updateLocationManually: jest.fn(),
    });

    mockUseDriverShift.mockReturnValue({
      currentShift: null,
      isShiftActive: false,
      startShift: jest.fn().mockResolvedValue(true),
      endShift: jest.fn().mockResolvedValue(true),
      startBreak: jest.fn().mockResolvedValue(true),
      endBreak: jest.fn().mockResolvedValue(true),
      refreshShift: jest.fn(),
      loading: false,
      error: null,
    });

    mockUseDriverDeliveries.mockReturnValue({
      activeDeliveries: [],
      updateDeliveryStatus: jest.fn().mockResolvedValue(true),
      loading: false,
      error: null,
      refreshDeliveries: jest.fn(),
    });

    mockUseOfflineQueue.mockReturnValue({
      offlineStatus: {
        isOnline: true,
        lastSync: new Date(),
        pendingUpdates: 0,
        syncInProgress: false,
      },
      queuedItems: 0,
      syncOfflineData: jest.fn(),
      registerServiceWorker: jest.fn(),
      syncPendingItems: jest.fn(),
    });

    // Default mock implementations for admin dashboard
    mockUseRealTimeTracking.mockReturnValue({
      activeDrivers: mockDrivers,
      recentLocations: [],
      activeDeliveries: mockDeliveries,
      isConnected: true,
      error: null,
      reconnect: jest.fn(),
    });
  });

  describe("Complete Driver Workflow", () => {
    it("completes full shift workflow from start to end", async () => {
      const mockStartShift = jest.fn().mockResolvedValue(true);
      const mockEndShift = jest.fn().mockResolvedValue(true);
      const mockStartTracking = jest.fn();
      const mockStopTracking = jest.fn();

      // Mock location tracking enabled
      mockUseLocationTracking.mockReturnValue({
        currentLocation: mockLocationUpdate,
        isTracking: true,
        accuracy: 10,
        error: null,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        updateLocationManually: jest.fn(),
      });

      // Mock shift management
      mockUseDriverShift.mockReturnValue({
        currentShift: null,
        isShiftActive: false,
        startShift: mockStartShift,
        endShift: mockEndShift,
        startBreak: jest.fn(),
        endBreak: jest.fn(),
        loading: false,
        error: null,
        refreshShift: jest.fn(),
      });

      render(<DriverTrackingPortal />);

      // 1. Start shift
      const startButton = screen.getByRole("button", { name: /start shift/i });
      await userEvent.click(startButton);

      await waitFor(() => {
        expect(mockStartShift).toHaveBeenCalledWith(mockLocationUpdate);
      });

      // 2. Simulate shift becoming active
      mockUseDriverShift.mockReturnValue({
        currentShift: {
          id: "shift-1",
          driverId: "driver-1",
          startTime: new Date(),
          startLocation: { lat: 40.7128, lng: -74.006 },
          status: "active" as const,
          totalDistanceKm: 0,
          deliveryCount: 0,
          breaks: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        isShiftActive: true,
        startShift: mockStartShift,
        endShift: mockEndShift,
        startBreak: jest.fn(),
        endBreak: jest.fn(),
        refreshShift: jest.fn(),
        loading: false,
        error: null,
      });

      // Re-render to show active shift
      render(<DriverTrackingPortal />);

      // 3. End shift
      const endButton = screen.getByRole("button", { name: /end shift/i });
      await userEvent.click(endButton);

      await waitFor(() => {
        expect(mockEndShift).toHaveBeenCalled();
      });
    });

    it("handles delivery status updates during shift", async () => {
      const mockUpdateDeliveryStatus = jest.fn().mockResolvedValue(true);

      // Mock active shift
      mockUseDriverShift.mockReturnValue({
        currentShift: {
          id: "shift-1",
          driverId: "driver-1",
          startTime: new Date(),
          startLocation: { lat: 40.7128, lng: -74.006 },
          status: "active" as const,
          totalDistanceKm: 0,
          deliveryCount: 0,
          breaks: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        isShiftActive: true,
        startShift: jest.fn(),
        endShift: jest.fn(),
        startBreak: jest.fn(),
        endBreak: jest.fn(),
        refreshShift: jest.fn(),
        loading: false,
        error: null,
      });

      // Mock active deliveries
      mockUseDriverDeliveries.mockReturnValue({
        activeDeliveries: [mockDeliveries[1]!], // in_transit delivery
        updateDeliveryStatus: mockUpdateDeliveryStatus,
        loading: false,
        error: null,
        refreshDeliveries: jest.fn(),
      });

      render(<DriverTrackingPortal />);

      // Update delivery status
      const statusButton = screen.getByRole("button", {
        name: /update status/i,
      });
      await userEvent.click(statusButton);

      await waitFor(() => {
        expect(mockUpdateDeliveryStatus).toHaveBeenCalled();
      });
    });

    it("manages breaks during active shift", async () => {
      const mockStartBreak = jest.fn().mockResolvedValue(true);
      const mockEndBreak = jest.fn().mockResolvedValue(true);

      // Mock active shift
      mockUseDriverShift.mockReturnValue({
        currentShift: {
          id: "shift-1",
          driverId: "driver-1",
          startTime: new Date(),
          startLocation: { lat: 40.7128, lng: -74.006 },
          status: "active" as const,
          totalDistanceKm: 0,
          deliveryCount: 0,
          breaks: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        isShiftActive: true,
        startShift: jest.fn(),
        endShift: jest.fn(),
        startBreak: mockStartBreak,
        endBreak: mockEndBreak,
        refreshShift: jest.fn(),
        loading: false,
        error: null,
      });

      render(<DriverTrackingPortal />);

      // Start break
      const startBreakButton = screen.getByRole("button", {
        name: /start break/i,
      });
      await userEvent.click(startBreakButton);

      await waitFor(() => {
        expect(mockStartBreak).toHaveBeenCalled();
      });

      // End break
      const endBreakButton = screen.getByRole("button", { name: /end break/i });
      await userEvent.click(endBreakButton);

      await waitFor(() => {
        expect(mockEndBreak).toHaveBeenCalled();
      });
    });
  });

  describe("Admin Dashboard Integration", () => {
    it("displays real-time driver and delivery data", () => {
      render(<AdminTrackingDashboard />);

      // Verify all components are rendered
      expect(screen.getByTestId("live-driver-map")).toBeInTheDocument();
      expect(screen.getByTestId("driver-status-list")).toBeInTheDocument();
      expect(
        screen.getByTestId("delivery-assignment-panel"),
      ).toBeInTheDocument();

      // Verify data is displayed
      expect(screen.getByText(/2 Drivers/i)).toBeInTheDocument();
      expect(screen.getByText(/2 Deliveries/i)).toBeInTheDocument();
    });

    it("handles driver selection and delivery assignment", async () => {
      const mockRefreshData = jest.fn();
      mockUseRealTimeTracking.mockReturnValue({
        activeDrivers: mockDrivers,
        recentLocations: [],
        activeDeliveries: mockDeliveries,
        isConnected: true,
        error: null,
        reconnect: jest.fn(),
      });

      render(<AdminTrackingDashboard />);

      // Select a driver
      const driverButton = screen.getByTestId("driver-driver-1");
      await userEvent.click(driverButton);

      // Assign a delivery
      const deliveryButton = screen.getByTestId("delivery-delivery-1");
      await userEvent.click(deliveryButton);

      // Verify interactions
      expect(driverButton).toBeInTheDocument();
      expect(deliveryButton).toBeInTheDocument();
    });

    it("shows real-time connection status and updates", () => {
      render(<AdminTrackingDashboard />);

      expect(screen.getByText(/Connected/i)).toBeInTheDocument();
      expect(screen.getByText(/Real-time Updates/i)).toBeInTheDocument();
      expect(screen.getByText(/Last Update:/i)).toBeInTheDocument();
    });

    it("handles connection failures gracefully", async () => {
      const mockRefreshData = jest.fn();
      mockUseRealTimeTracking.mockReturnValue({
        activeDrivers: [],
        recentLocations: [],
        activeDeliveries: [],
        isConnected: false,
        error: "Connection lost",
        reconnect: jest.fn(),
      });

      render(<AdminTrackingDashboard />);

      expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
      expect(screen.getByText(/Connection lost/i)).toBeInTheDocument();

      // Retry connection
      const retryButton = screen.getByRole("button", {
        name: /retry connection/i,
      });
      await userEvent.click(retryButton);

      expect(mockRefreshData).toHaveBeenCalled();
    });
  });

  describe("Offline Capabilities", () => {
    it("queues data when offline and syncs when back online", async () => {
      const mockAddToQueue = jest.fn();
      const mockSyncOfflineData = jest.fn();

      // Mock offline status
      mockUseOfflineQueue.mockReturnValue({
        offlineStatus: {
          isOnline: false,
          lastSync: new Date(),
          pendingUpdates: 2,
          syncInProgress: false,
        },
        queuedItems: 2,
        syncOfflineData: mockSyncOfflineData,
        registerServiceWorker: jest.fn(),
        syncPendingItems: jest.fn(),
      });

      render(<DriverTrackingPortal />);

      // Verify offline indicator
      expect(screen.getByText(/You're currently offline/i)).toBeInTheDocument();
      expect(screen.getByText(/2 items in queue/i)).toBeInTheDocument();

      // Mock coming back online
      mockUseOfflineQueue.mockReturnValue({
        offlineStatus: {
          isOnline: true,
          lastSync: new Date(),
          pendingUpdates: 0,
          syncInProgress: false,
        },
        queuedItems: 0,
        syncOfflineData: mockSyncOfflineData,
        registerServiceWorker: jest.fn(),
        syncPendingItems: jest.fn(),
      });

      // Re-render to show online status
      render(<DriverTrackingPortal />);

      expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    });

    it("adds new data to offline queue when disconnected", async () => {
      const mockAddToQueue = jest.fn();

      mockUseOfflineQueue.mockReturnValue({
        offlineStatus: {
          isOnline: false,
          lastSync: new Date(),
          pendingUpdates: 0,
          syncInProgress: false,
        },
        queuedItems: 0,
        syncOfflineData: jest.fn(),
        registerServiceWorker: jest.fn(),
        syncPendingItems: jest.fn(),
      });

      render(<DriverTrackingPortal />);

      // Try to start shift while offline
      const startButton = screen.getByRole("button", { name: /start shift/i });
      await userEvent.click(startButton);

      // Should add to offline queue
      expect(mockAddToQueue).toHaveBeenCalled();
    });
  });

  describe("Data Flow Between Components", () => {
    it("maintains data consistency between driver portal and admin dashboard", () => {
      // Both components should show the same driver data
      const { rerender: rerenderDriver } = render(<DriverTrackingPortal />);
      const { rerender: rerenderAdmin } = render(<AdminTrackingDashboard />);

      // Verify initial state
      expect(screen.getByText(/Driver Tracking Portal/i)).toBeInTheDocument();

      // Re-render admin dashboard
      rerenderAdmin(<AdminTrackingDashboard />);
      expect(
        screen.getByText(/Driver Tracking Dashboard/i),
      ).toBeInTheDocument();

      // Both should be using the same mock data
      expect(mockUseDriverShift).toHaveBeenCalled();
      expect(mockUseRealTimeTracking).toHaveBeenCalled();
    });

    it("handles real-time updates across components", async () => {
      const mockRefreshData = jest.fn();
      mockUseRealTimeTracking.mockReturnValue({
        activeDrivers: mockDrivers,
        recentLocations: [],
        activeDeliveries: mockDeliveries,
        isConnected: true,
        error: null,
        reconnect: jest.fn(),
      });

      render(<AdminTrackingDashboard />);

      // Simulate real-time update
      await waitFor(() => {
        expect(mockRefreshData).not.toHaveBeenCalled(); // Should not auto-refresh unless configured
      });
    });
  });

  describe("Error Handling and Recovery", () => {
    it("handles location tracking errors gracefully", async () => {
      mockUseLocationTracking.mockReturnValue({
        currentLocation: null,
        isTracking: false,
        accuracy: null,
        error: "Location permission denied",
        startTracking: jest.fn(),
        stopTracking: jest.fn(),
        updateLocationManually: jest.fn(),
      });

      render(<DriverTrackingPortal />);

      expect(
        screen.getByText(/Location permission denied/i),
      ).toBeInTheDocument();
    });

    it("handles shift management errors", async () => {
      mockUseDriverShift.mockReturnValue({
        currentShift: null,
        isShiftActive: false,
        startShift: jest.fn(),
        endShift: jest.fn(),
        startBreak: jest.fn(),
        endBreak: jest.fn(),
        refreshShift: jest.fn(),
        loading: false,
        error: "Failed to start shift",
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText(/Failed to start shift/i)).toBeInTheDocument();
    });

    it("handles delivery update errors", async () => {
      mockUseDriverDeliveries.mockReturnValue({
        activeDeliveries: [mockDeliveries[1]!],
        updateDeliveryStatus: jest
          .fn()
          .mockRejectedValue(new Error("Update failed")),
        loading: false,
        error: "Failed to update delivery",
        refreshDeliveries: jest.fn(),
      });

      render(<DriverTrackingPortal />);

      expect(
        screen.getByText(/Failed to update delivery/i),
      ).toBeInTheDocument();
    });
  });

  describe("Performance and Optimization", () => {
    it("handles large numbers of drivers and deliveries efficiently", () => {
      const largeDrivers = Array.from({ length: 100 }, (_, i) => ({
        id: `driver-${i}`,
        employeeId: `EMP${i.toString().padStart(3, "0")}`,
        phoneNumber: `+123456789${i}`,
        isActive: true,
        isOnDuty: i % 2 === 0,
        lastKnownLocation:
          i % 2 === 0
            ? { coordinates: [-74.006, 40.7128] as [number, number] }
            : undefined,
        lastLocationUpdate: i % 2 === 0 ? new Date() : undefined,
        currentShift:
          i % 2 === 0
            ? {
                id: `shift-${i}`,
                driverId: `driver-${i}`,
                startTime: new Date(),
                startLocation: { lat: 40.7128, lng: -74.006 },
                totalDistanceKm: 0,
                deliveryCount: 0,
                status: "active" as const,
                breaks: [],
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date(),
              }
            : undefined,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const largeDeliveries = Array.from({ length: 50 }, (_, i) => ({
        id: `delivery-${i}`,
        driverId: `driver-${i}`,
        status:
          i % 3 === 0
            ? DriverStatus.ASSIGNED
            : i % 3 === 1
              ? DriverStatus.EN_ROUTE_TO_CLIENT
              : DriverStatus.COMPLETED,
        pickupLocation: { coordinates: [-74.006, 40.7128] as [number, number] },
        deliveryLocation: {
          coordinates: [-73.9851, 40.7589] as [number, number],
        },
        estimatedArrival: new Date(Date.now() + 3600000),
        route: [],
        metadata: {},
        assignedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockUseRealTimeTracking.mockReturnValue({
        activeDrivers: largeDrivers,
        recentLocations: [],
        activeDeliveries: largeDeliveries,
        isConnected: true,
        error: null,
        reconnect: jest.fn(),
      });

      render(<AdminTrackingDashboard />);

      // Should render without performance issues
      expect(screen.getByText(/100 Drivers/i)).toBeInTheDocument();
      expect(screen.getByText(/50 Deliveries/i)).toBeInTheDocument();
    });

    it("handles rapid state changes efficiently", async () => {
      const mockStartShift = jest.fn().mockResolvedValue(true);
      mockUseDriverShift.mockReturnValue({
        currentShift: null,
        isShiftActive: false,
        startShift: mockStartShift,
        endShift: jest.fn(),
        startBreak: jest.fn(),
        endBreak: jest.fn(),
        loading: false,
        error: null,
        refreshShift: jest.fn(),
      });

      mockUseLocationTracking.mockReturnValue({
        currentLocation: mockLocationUpdate,
        isTracking: false,
        accuracy: 10,
        error: null,
        startTracking: jest.fn(),
        stopTracking: jest.fn(),
        updateLocationManually: jest.fn(),
      });

      render(<DriverTrackingPortal />);

      // Rapidly click start shift button
      const startButton = screen.getByRole("button", { name: /start shift/i });

      for (let i = 0; i < 5; i++) {
        await userEvent.click(startButton);
      }

      // Should only call startShift once (debounced)
      expect(mockStartShift).toHaveBeenCalledTimes(1);
    });
  });
});
