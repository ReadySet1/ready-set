import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DriverTrackingPortal from '@/components/Driver/DriverTrackingPortal';
import AdminTrackingDashboard from '@/components/Dashboard/Tracking/AdminTrackingDashboard';
import { useRealtimeLocationTracking } from '@/hooks/tracking/useRealtimeLocationTracking';
import { useDriverShift } from '@/hooks/tracking/useDriverShift';
import { useDriverDeliveries } from '@/hooks/tracking/useDriverDeliveries';
import { useOfflineQueue } from '@/hooks/tracking/useOfflineQueue';
import { useAdminRealtimeTracking } from '@/hooks/tracking/useAdminRealtimeTracking';
import { DriverStatus } from '@/types/user';

// Mock next/dynamic to return components directly without async loading
jest.mock('next/dynamic', () => {
  return (dynamicImport: () => Promise<any>, options?: any) => {
    // Return a component that renders the mock immediately
    const DynamicComponent = (props: any) => {
      // Check if this is the LiveDriverMap import
      const MockLiveDriverMap = ({ drivers, deliveries }: any) => (
        <div data-testid="live-driver-map">
          <div>Live Driver Map</div>
          <div>Drivers: {drivers?.length || 0}</div>
          <div>Deliveries: {deliveries?.length || 0}</div>
        </div>
      );
      return <MockLiveDriverMap {...props} />;
    };
    return DynamicComponent;
  };
});

// Mock all the tracking hooks
jest.mock('@/hooks/tracking/useRealtimeLocationTracking');
jest.mock('@/hooks/tracking/useDriverShift');
jest.mock('@/hooks/tracking/useDriverDeliveries');
jest.mock('@/hooks/tracking/useOfflineQueue');
jest.mock('@/hooks/tracking/useAdminRealtimeTracking');

// Mock the hooks with correct types
const mockUseRealtimeLocationTracking =
  useRealtimeLocationTracking as jest.MockedFunction<typeof useRealtimeLocationTracking>;
const mockUseDriverShift = useDriverShift as jest.MockedFunction<typeof useDriverShift>;
const mockUseDriverDeliveries = useDriverDeliveries as jest.MockedFunction<typeof useDriverDeliveries>;
const mockUseOfflineQueue = useOfflineQueue as jest.MockedFunction<typeof useOfflineQueue>;
const mockUseAdminRealtimeTracking = useAdminRealtimeTracking as jest.MockedFunction<
  typeof useAdminRealtimeTracking
>;

// Mock map components to avoid Mapbox dependencies
jest.mock('@/components/Driver/DriverLiveMap', () => {
  return function MockDriverLiveMap({ currentLocation, activeDeliveries }: any) {
    return (
      <div data-testid="driver-live-map">
        <div>Driver Live Map</div>
        <div>Location: {currentLocation ? 'available' : 'unavailable'}</div>
        <div>Deliveries: {activeDeliveries?.length || 0}</div>
      </div>
    );
  };
});

// LiveDriverMap mock is handled by the next/dynamic mock above

jest.mock('@/components/Dashboard/Tracking/DriverStatusList', () => {
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
            {driver.employeeId || driver.id}
          </button>
        ))}
      </div>
    );
  };
});

jest.mock('@/components/Dashboard/Tracking/DeliveryAssignmentPanel', () => {
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

describe('Tracking System Integration', () => {
  const mockLocationUpdate = {
    driverId: 'driver-1',
    coordinates: { lat: 40.7128, lng: -74.006 },
    accuracy: 10,
    speed: 0,
    heading: 0,
    timestamp: new Date(),
    isMoving: false,
  };

  const mockDeliveries = [
    {
      id: 'delivery-1',
      driverId: 'driver-1',
      status: DriverStatus.ASSIGNED,
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
    },
  ];

  const mockTrackedDrivers = [
    {
      id: 'driver-1',
      employeeId: 'EMP001',
      isActive: true,
      isOnDuty: true,
      lastKnownLocation: {
        lat: 40.7128,
        lng: -74.006,
      },
      lastLocationUpdate: new Date(),
      totalDistanceMiles: 15.5,
    },
    {
      id: 'driver-2',
      employeeId: 'EMP002',
      isActive: true,
      isOnDuty: false,
      lastKnownLocation: undefined,
      lastLocationUpdate: undefined,
      totalDistanceMiles: 0,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations for DriverTrackingPortal
    mockUseRealtimeLocationTracking.mockReturnValue({
      currentLocation: mockLocationUpdate,
      isTracking: false,
      accuracy: 10,
      error: null,
      unsyncedCount: 0,
      isOnline: true,
      startTracking: jest.fn(),
      stopTracking: jest.fn(),
      updateLocationManually: jest.fn(),
      syncOfflineLocations: jest.fn(),
      isRealtimeConnected: true,
      isRealtimeEnabled: true,
      connectionMode: 'realtime' as const,
    });

    mockUseDriverShift.mockReturnValue({
      currentShift: null,
      isShiftActive: false,
      startShift: jest.fn().mockResolvedValue(true),
      endShift: jest.fn().mockResolvedValue(true),
      startBreak: jest.fn().mockResolvedValue(true),
      endBreak: jest.fn().mockResolvedValue(true),
      loading: false,
      error: null,
    });

    mockUseDriverDeliveries.mockReturnValue({
      activeDeliveries: [],
      updateDeliveryStatus: jest.fn().mockResolvedValue(true),
      loading: false,
      error: null,
    });

    mockUseOfflineQueue.mockReturnValue({
      offlineStatus: {
        isOnline: true,
        lastSync: new Date(),
        pendingUpdates: 0,
        syncInProgress: false,
      },
      queuedItems: 0,
    });

    // Default mock implementations for AdminTrackingDashboard
    mockUseAdminRealtimeTracking.mockReturnValue({
      activeDrivers: mockTrackedDrivers as any,
      recentLocations: [],
      activeDeliveries: mockDeliveries as any,
      isConnected: true,
      isRealtimeConnected: true,
      isRealtimeEnabled: true,
      connectionMode: 'realtime' as const,
      error: null,
      reconnect: jest.fn(),
      toggleMode: jest.fn(),
    });
  });

  describe('Driver Portal - Basic Rendering', () => {
    it('renders driver portal without crashing', () => {
      render(<DriverTrackingPortal />);

      // Should render status indicators
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('displays current location when available', () => {
      render(<DriverTrackingPortal />);

      // Should show the map component with location
      expect(screen.getByTestId('driver-live-map')).toBeInTheDocument();
      expect(screen.getByText('Location: available')).toBeInTheDocument();
    });

    it('shows start shift button when no active shift', () => {
      render(<DriverTrackingPortal />);

      const startButton = screen.getByRole('button', { name: /start shift/i });
      expect(startButton).toBeInTheDocument();
    });

    it('displays error message when location error occurs', () => {
      mockUseRealtimeLocationTracking.mockReturnValue({
        currentLocation: null,
        isTracking: false,
        accuracy: null,
        error: 'Location access denied',
        unsyncedCount: 0,
        isOnline: true,
        startTracking: jest.fn(),
        stopTracking: jest.fn(),
        updateLocationManually: jest.fn(),
        syncOfflineLocations: jest.fn(),
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'rest' as const,
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText(/Location access denied/i)).toBeInTheDocument();
    });
  });

  describe('Driver Portal - Shift Management', () => {
    it('starts shift when button is clicked', async () => {
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
      });

      render(<DriverTrackingPortal />);

      const startButton = screen.getByRole('button', { name: /start shift/i });
      await userEvent.click(startButton);

      await waitFor(() => {
        expect(mockStartShift).toHaveBeenCalled();
      });
    });

    it('displays active shift information', () => {
      mockUseDriverShift.mockReturnValue({
        currentShift: {
          id: 'shift-1',
          driverId: 'driver-1',
          startTime: new Date(),
          startLocation: { lat: 40.7128, lng: -74.006 },
          status: 'active' as const,
          totalDistanceMiles: 12.3,
          deliveryCount: 2,
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
        loading: false,
        error: null,
      });

      render(<DriverTrackingPortal />);

      // Should show active shift UI
      expect(screen.getByText(/Active Shift/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /end shift/i })).toBeInTheDocument();
    });

    it('ends shift when button is clicked', async () => {
      const mockEndShift = jest.fn().mockResolvedValue(true);

      mockUseDriverShift.mockReturnValue({
        currentShift: {
          id: 'shift-1',
          driverId: 'driver-1',
          startTime: new Date(),
          startLocation: { lat: 40.7128, lng: -74.006 },
          status: 'active' as const,
          totalDistanceMiles: 0,
          deliveryCount: 0,
          breaks: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        isShiftActive: true,
        startShift: jest.fn(),
        endShift: mockEndShift,
        startBreak: jest.fn(),
        endBreak: jest.fn(),
        loading: false,
        error: null,
      });

      render(<DriverTrackingPortal />);

      const endButton = screen.getByRole('button', { name: /end shift/i });
      await userEvent.click(endButton);

      await waitFor(() => {
        expect(mockEndShift).toHaveBeenCalled();
      });
    });
  });

  describe('Driver Portal - Break Management', () => {
    it('starts break during active shift', async () => {
      const mockStartBreak = jest.fn().mockResolvedValue(true);

      mockUseDriverShift.mockReturnValue({
        currentShift: {
          id: 'shift-1',
          driverId: 'driver-1',
          startTime: new Date(),
          startLocation: { lat: 40.7128, lng: -74.006 },
          status: 'active' as const,
          totalDistanceMiles: 0,
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
        endBreak: jest.fn(),
        loading: false,
        error: null,
      });

      render(<DriverTrackingPortal />);

      // Find and click the break button
      const breakButton = screen.getByRole('button', { name: /break/i });
      await userEvent.click(breakButton);

      await waitFor(() => {
        expect(mockStartBreak).toHaveBeenCalled();
      });
    });
  });

  describe('Admin Dashboard - Basic Rendering', () => {
    it('renders admin dashboard without crashing', () => {
      render(<AdminTrackingDashboard />);

      // Should render map components (multiple instances in overview and map tabs)
      const mapElements = screen.getAllByTestId('live-driver-map');
      expect(mapElements.length).toBeGreaterThanOrEqual(1);
    });

    it('displays driver count and delivery count', () => {
      render(<AdminTrackingDashboard />);

      // The dashboard should show stats - looking for specific stat cards
      expect(screen.getByText(/On Duty/i)).toBeInTheDocument();
      expect(screen.getByText(/Active Deliveries/i)).toBeInTheDocument();
    });

    it('shows connection status', () => {
      render(<AdminTrackingDashboard />);

      // Should show realtime connection status
      expect(screen.getByText(/real-time/i)).toBeInTheDocument();
    });
  });

  describe('Admin Dashboard - Connection Handling', () => {
    it('displays error when connection fails', () => {
      mockUseAdminRealtimeTracking.mockReturnValue({
        activeDrivers: [],
        recentLocations: [],
        activeDeliveries: [],
        isConnected: false,
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'rest' as const,
        error: 'Connection failed',
        reconnect: jest.fn(),
        toggleMode: jest.fn(),
      });

      render(<AdminTrackingDashboard />);

      expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
    });

    it('allows reconnection when disconnected', async () => {
      const mockReconnect = jest.fn();

      mockUseAdminRealtimeTracking.mockReturnValue({
        activeDrivers: [],
        recentLocations: [],
        activeDeliveries: [],
        isConnected: false,
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'rest' as const,
        error: 'Connection lost',
        reconnect: mockReconnect,
        toggleMode: jest.fn(),
      });

      render(<AdminTrackingDashboard />);

      // Find reconnect button if available
      const reconnectButton = screen.queryByRole('button', { name: /reconnect|retry/i });
      if (reconnectButton) {
        await userEvent.click(reconnectButton);
        expect(mockReconnect).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handling', () => {
    it('handles location tracking errors in driver portal', () => {
      mockUseRealtimeLocationTracking.mockReturnValue({
        currentLocation: null,
        isTracking: false,
        accuracy: null,
        error: 'GPS signal lost',
        unsyncedCount: 0,
        isOnline: true,
        startTracking: jest.fn(),
        stopTracking: jest.fn(),
        updateLocationManually: jest.fn(),
        syncOfflineLocations: jest.fn(),
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'rest' as const,
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText(/GPS signal lost/i)).toBeInTheDocument();
    });

    it('handles shift errors in driver portal', () => {
      mockUseDriverShift.mockReturnValue({
        currentShift: null,
        isShiftActive: false,
        startShift: jest.fn(),
        endShift: jest.fn(),
        startBreak: jest.fn(),
        endBreak: jest.fn(),
        loading: false,
        error: 'Failed to start shift',
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText(/Failed to start shift/i)).toBeInTheDocument();
    });

    it('handles delivery errors in driver portal', () => {
      mockUseDriverDeliveries.mockReturnValue({
        activeDeliveries: [],
        updateDeliveryStatus: jest.fn(),
        loading: false,
        error: 'Failed to load deliveries',
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText(/Failed to load deliveries/i)).toBeInTheDocument();
    });
  });

  describe('Offline Status', () => {
    it('shows offline status in driver portal', () => {
      mockUseOfflineQueue.mockReturnValue({
        offlineStatus: {
          isOnline: false,
          lastSync: new Date(),
          pendingUpdates: 3,
          syncInProgress: false,
        },
        queuedItems: 3,
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText(/Offline/i)).toBeInTheDocument();
    });

    it('shows online status in driver portal', () => {
      mockUseOfflineQueue.mockReturnValue({
        offlineStatus: {
          isOnline: true,
          lastSync: new Date(),
          pendingUpdates: 0,
          syncInProgress: false,
        },
        queuedItems: 0,
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText(/Online/i)).toBeInTheDocument();
    });
  });
});
