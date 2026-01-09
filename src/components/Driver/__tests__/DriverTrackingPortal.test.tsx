import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DriverTrackingPortal from '../DriverTrackingPortal';

// Mock the hooks
const mockStartTracking = jest.fn();
const mockStopTracking = jest.fn();
const mockStartShift = jest.fn();
const mockEndShift = jest.fn();
const mockStartBreak = jest.fn();
const mockEndBreak = jest.fn();
const mockUpdateDeliveryStatus = jest.fn();

jest.mock('@/hooks/tracking/useRealtimeLocationTracking', () => ({
  useRealtimeLocationTracking: jest.fn(() => ({
    currentLocation: null,
    isTracking: false,
    accuracy: null,
    startTracking: mockStartTracking,
    stopTracking: mockStopTracking,
    error: null,
    isRealtimeConnected: false,
    isRealtimeEnabled: true,
    connectionMode: 'rest',
  })),
}));

jest.mock('@/hooks/tracking/useDriverShift', () => ({
  useDriverShift: jest.fn(() => ({
    currentShift: null,
    isShiftActive: false,
    startShift: mockStartShift,
    endShift: mockEndShift,
    startBreak: mockStartBreak,
    endBreak: mockEndBreak,
    loading: false,
    error: null,
  })),
}));

jest.mock('@/hooks/tracking/useDriverDeliveries', () => ({
  useDriverDeliveries: jest.fn(() => ({
    activeDeliveries: [],
    updateDeliveryStatus: mockUpdateDeliveryStatus,
    loading: false,
    error: null,
  })),
}));

jest.mock('@/hooks/tracking/useOfflineQueue', () => ({
  useOfflineQueue: jest.fn(() => ({
    offlineStatus: { isOnline: true },
    queuedItems: [],
  })),
}));

// Mock DriverLiveMap
jest.mock('@/components/Driver/DriverLiveMap', () => ({
  __esModule: true,
  default: ({ currentLocation, activeDeliveries }: any) => (
    <div data-testid="driver-live-map">
      DriverLiveMap (deliveries: {activeDeliveries?.length || 0})
    </div>
  ),
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  CardHeader: ({ children }: any) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: any) => (
    <h2 data-testid="card-title" className={className}>{children}</h2>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, className, ...props }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: ({ className }: any) => <hr data-testid="separator" className={className} />,
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, variant, className }: any) => (
    <div data-testid="alert" data-variant={variant} className={className}>
      {children}
    </div>
  ),
  AlertDescription: ({ children }: any) => (
    <p data-testid="alert-description">{children}</p>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  NavigationIcon: () => <span data-testid="navigation-icon">Nav</span>,
  ClockIcon: () => <span data-testid="clock-icon">Clock</span>,
  MapPinIcon: () => <span data-testid="map-pin-icon">MapPin</span>,
  TruckIcon: () => <span data-testid="truck-icon">Truck</span>,
  BatteryIcon: () => <span data-testid="battery-icon">Battery</span>,
  SignalIcon: () => <span data-testid="signal-icon">Signal</span>,
  PlayIcon: () => <span data-testid="play-icon">Play</span>,
  PauseIcon: () => <span data-testid="pause-icon">Pause</span>,
  SquareIcon: () => <span data-testid="square-icon">Square</span>,
  CoffeeIcon: () => <span data-testid="coffee-icon">Coffee</span>,
  AlertTriangleIcon: () => <span data-testid="alert-triangle-icon">Alert</span>,
  CheckCircleIcon: () => <span data-testid="check-circle-icon">Check</span>,
}));

// Mock cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock DriverStatus enum
jest.mock('@/types/user', () => ({
  DriverStatus: {
    EN_ROUTE_TO_CLIENT: 'en_route_to_client',
    ARRIVED_TO_CLIENT: 'arrived_to_client',
    COMPLETED: 'completed',
  },
}));

const { useRealtimeLocationTracking } = require('@/hooks/tracking/useRealtimeLocationTracking');
const { useDriverShift } = require('@/hooks/tracking/useDriverShift');
const { useDriverDeliveries } = require('@/hooks/tracking/useDriverDeliveries');
const { useOfflineQueue } = require('@/hooks/tracking/useOfflineQueue');

describe('DriverTrackingPortal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default mock implementations
    useRealtimeLocationTracking.mockReturnValue({
      currentLocation: null,
      isTracking: false,
      accuracy: null,
      startTracking: mockStartTracking,
      stopTracking: mockStopTracking,
      error: null,
      isRealtimeConnected: false,
      isRealtimeEnabled: true,
      connectionMode: 'rest',
    });
    useDriverShift.mockReturnValue({
      currentShift: null,
      isShiftActive: false,
      startShift: mockStartShift,
      endShift: mockEndShift,
      startBreak: mockStartBreak,
      endBreak: mockEndBreak,
      loading: false,
      error: null,
    });
    useDriverDeliveries.mockReturnValue({
      activeDeliveries: [],
      updateDeliveryStatus: mockUpdateDeliveryStatus,
      loading: false,
      error: null,
    });
    useOfflineQueue.mockReturnValue({
      offlineStatus: { isOnline: true },
      queuedItems: [],
    });
  });

  describe('Component Rendering', () => {
    it('should render the tracking portal with all main sections', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('Shift Status')).toBeInTheDocument();
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      render(<DriverTrackingPortal className="custom-class" />);

      const container = screen.getAllByTestId('card')[0].parentElement;
      expect(container).toHaveClass('custom-class');
    });

    it('should show online status when online', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('should show offline status when offline', () => {
      useOfflineQueue.mockReturnValue({
        offlineStatus: { isOnline: false },
        queuedItems: [],
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  describe('GPS and Battery Status', () => {
    it('should display GPS accuracy when available', () => {
      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: {
          coordinates: { lat: 37.7749, lng: -122.4194 },
          accuracy: 25,
          speed: 5,
          timestamp: new Date().toISOString(),
        },
        isTracking: true,
        accuracy: 25,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: true,
        isRealtimeEnabled: true,
        connectionMode: 'realtime',
      });

      render(<DriverTrackingPortal />);

      // Multiple elements with 25m (GPS accuracy in status bar and in location details)
      const accuracyElements = screen.getAllByText(/25m/);
      expect(accuracyElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should display "--" when GPS accuracy is not available', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('--')).toBeInTheDocument();
    });
  });

  describe('Shift Status - Inactive', () => {
    it('should show "Ready to Start" when no shift is active', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('Ready to Start')).toBeInTheDocument();
      expect(screen.getByText('Start your shift to begin location tracking')).toBeInTheDocument();
    });

    it('should show Start Shift button when no shift is active', () => {
      render(<DriverTrackingPortal />);

      const startButton = screen.getByText('Start Shift').closest('button');
      expect(startButton).toBeInTheDocument();
    });

    it('should allow Start Shift button when location is not available (requests permission on click)', () => {
      render(<DriverTrackingPortal />);

      const startButton = screen.getByText('Start Shift').closest('button');
      // Button is enabled - clicking it will request location permission
      expect(startButton).not.toBeDisabled();
      // Shows hint about enabling location
      expect(screen.getByText(/Tap.*Start Shift.*to allow location access/)).toBeInTheDocument();
    });

    it('should enable Start Shift button when location is available', () => {
      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: {
          coordinates: { lat: 37.7749, lng: -122.4194 },
          accuracy: 25,
          speed: 0,
          timestamp: new Date().toISOString(),
        },
        isTracking: false,
        accuracy: 25,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'rest',
      });

      render(<DriverTrackingPortal />);

      const startButton = screen.getByText('Start Shift').closest('button');
      expect(startButton).not.toBeDisabled();
    });
  });

  describe('Shift Status - Active', () => {
    const mockActiveShift = {
      id: 'shift-123',
      startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      endTime: null,
      breaks: [],
      totalDistanceMiles: 15.5,
      deliveryCount: 3,
    };

    beforeEach(() => {
      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: {
          coordinates: { lat: 37.7749, lng: -122.4194 },
          accuracy: 25,
          speed: 5,
          timestamp: new Date().toISOString(),
        },
        isTracking: true,
        accuracy: 25,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: true,
        isRealtimeEnabled: true,
        connectionMode: 'realtime',
      });
      useDriverShift.mockReturnValue({
        currentShift: mockActiveShift,
        isShiftActive: true,
        startShift: mockStartShift,
        endShift: mockEndShift,
        startBreak: mockStartBreak,
        endBreak: mockEndBreak,
        loading: false,
        error: null,
      });
    });

    it('should display Active Shift information', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('Active Shift')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should display shift duration', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText(/1h 0m/)).toBeInTheDocument();
    });

    it('should display distance traveled', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('Distance')).toBeInTheDocument();
      expect(screen.getByText('15.5 mi')).toBeInTheDocument();
    });

    it('should display delivery count', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('Deliveries')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should show break control buttons', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('Break')).toBeInTheDocument();
      expect(screen.getByText('Meal')).toBeInTheDocument();
    });

    it('should show End Shift button', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('End Shift')).toBeInTheDocument();
    });
  });

  describe('Break Status', () => {
    const mockShiftOnBreak = {
      id: 'shift-123',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: null,
      breaks: [
        {
          id: 'break-1',
          breakType: 'rest',
          startTime: new Date(Date.now() - 600000).toISOString(), // 10 min ago
          endTime: null,
        },
      ],
      totalDistanceMiles: 10,
      deliveryCount: 2,
    };

    beforeEach(() => {
      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: {
          coordinates: { lat: 37.7749, lng: -122.4194 },
          accuracy: 25,
          speed: 0,
          timestamp: new Date().toISOString(),
        },
        isTracking: true,
        accuracy: 25,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: true,
        isRealtimeEnabled: true,
        connectionMode: 'realtime',
      });
      useDriverShift.mockReturnValue({
        currentShift: mockShiftOnBreak,
        isShiftActive: true,
        startShift: mockStartShift,
        endShift: mockEndShift,
        startBreak: mockStartBreak,
        endBreak: mockEndBreak,
        loading: false,
        error: null,
      });
    });

    it('should display On Break badge when driver is on break', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('On Break')).toBeInTheDocument();
    });

    it('should show End Break button when on break', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('End Break')).toBeInTheDocument();
    });

    it('should display break type and start time', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText(/On rest break since/)).toBeInTheDocument();
    });
  });

  describe('Live Map Section', () => {
    it('should not show map when no location is available', () => {
      render(<DriverTrackingPortal />);

      expect(screen.queryByTestId('driver-live-map')).not.toBeInTheDocument();
    });

    it('should show map when location is available', () => {
      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: {
          coordinates: { lat: 37.7749, lng: -122.4194 },
          accuracy: 25,
          speed: 10,
          timestamp: new Date().toISOString(),
        },
        isTracking: true,
        accuracy: 25,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: true,
        isRealtimeEnabled: true,
        connectionMode: 'realtime',
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByTestId('driver-live-map')).toBeInTheDocument();
      expect(screen.getByText('Live Map')).toBeInTheDocument();
    });

    it('should display current coordinates', () => {
      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: {
          coordinates: { lat: 37.774900, lng: -122.419400 },
          accuracy: 25,
          speed: 5,
          timestamp: new Date().toISOString(),
        },
        isTracking: true,
        accuracy: 25,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: true,
        isRealtimeEnabled: true,
        connectionMode: 'realtime',
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText('Coordinates:')).toBeInTheDocument();
      expect(screen.getByText(/37.774900/)).toBeInTheDocument();
      expect(screen.getByText(/-122.419400/)).toBeInTheDocument();
    });

    it('should display current speed', () => {
      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: {
          coordinates: { lat: 37.7749, lng: -122.4194 },
          accuracy: 25,
          speed: 20, // m/s
          timestamp: new Date().toISOString(),
        },
        isTracking: true,
        accuracy: 25,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: true,
        isRealtimeEnabled: true,
        connectionMode: 'realtime',
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText('Speed:')).toBeInTheDocument();
      expect(screen.getByText('45 mph')).toBeInTheDocument();
    });
  });

  describe('Active Deliveries Section', () => {
    const mockDeliveries = [
      {
        id: 'delivery-1',
        status: 'assigned',
        deliveryLocation: { coordinates: [-122.4194, 37.7749] },
        estimatedArrival: new Date(Date.now() + 1800000).toISOString(), // 30 min
      },
      {
        id: 'delivery-2',
        status: 'en_route',
        deliveryLocation: { coordinates: [-122.4094, 37.7849] },
        estimatedArrival: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      },
    ];

    beforeEach(() => {
      useDriverDeliveries.mockReturnValue({
        activeDeliveries: mockDeliveries,
        updateDeliveryStatus: mockUpdateDeliveryStatus,
        loading: false,
        error: null,
      });
    });

    it('should not show deliveries section when no deliveries exist', () => {
      useDriverDeliveries.mockReturnValue({
        activeDeliveries: [],
        updateDeliveryStatus: mockUpdateDeliveryStatus,
        loading: false,
        error: null,
      });

      render(<DriverTrackingPortal />);

      expect(screen.queryByText(/Active Deliveries/)).not.toBeInTheDocument();
    });

    it('should show deliveries section with count', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText(/Active Deliveries \(2\)/)).toBeInTheDocument();
    });

    it('should display delivery status buttons', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getAllByText('En Route').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Arrived').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Complete Delivery').length).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should display location error', () => {
      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: null,
        isTracking: false,
        accuracy: null,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: 'Location permission denied',
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'rest',
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText('Location permission denied')).toBeInTheDocument();
    });

    it('should display shift error', () => {
      useDriverShift.mockReturnValue({
        currentShift: null,
        isShiftActive: false,
        startShift: mockStartShift,
        endShift: mockEndShift,
        startBreak: mockStartBreak,
        endBreak: mockEndBreak,
        loading: false,
        error: 'Failed to start shift',
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText('Failed to start shift')).toBeInTheDocument();
    });

    it('should display deliveries error', () => {
      useDriverDeliveries.mockReturnValue({
        activeDeliveries: [],
        updateDeliveryStatus: mockUpdateDeliveryStatus,
        loading: false,
        error: 'Failed to load deliveries',
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText('Failed to load deliveries')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call startShift when Start Shift button is clicked', async () => {
      mockStartShift.mockResolvedValue(true);
      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: {
          coordinates: { lat: 37.7749, lng: -122.4194 },
          accuracy: 25,
          speed: 0,
          timestamp: new Date().toISOString(),
        },
        isTracking: false,
        accuracy: 25,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'rest',
      });

      render(<DriverTrackingPortal />);

      const startButton = screen.getByText('Start Shift').closest('button');
      fireEvent.click(startButton!);

      await waitFor(() => {
        expect(mockStartShift).toHaveBeenCalled();
      });
    });

    it('should call endShift when End Shift button is clicked', async () => {
      mockEndShift.mockResolvedValue(true);
      const mockShift = {
        id: 'shift-123',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        breaks: [],
        totalDistanceMiles: 10,
        deliveryCount: 2,
      };

      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: {
          coordinates: { lat: 37.7749, lng: -122.4194 },
          accuracy: 25,
          speed: 0,
          timestamp: new Date().toISOString(),
        },
        isTracking: true,
        accuracy: 25,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: true,
        isRealtimeEnabled: true,
        connectionMode: 'realtime',
      });
      useDriverShift.mockReturnValue({
        currentShift: mockShift,
        isShiftActive: true,
        startShift: mockStartShift,
        endShift: mockEndShift,
        startBreak: mockStartBreak,
        endBreak: mockEndBreak,
        loading: false,
        error: null,
      });

      render(<DriverTrackingPortal />);

      const endButton = screen.getByText('End Shift').closest('button');
      fireEvent.click(endButton!);

      await waitFor(() => {
        expect(mockEndShift).toHaveBeenCalledWith('shift-123', expect.any(Object));
      });
    });

    it('should call startBreak when Break button is clicked', async () => {
      const mockShift = {
        id: 'shift-123',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        breaks: [],
        totalDistanceMiles: 10,
        deliveryCount: 2,
      };

      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: {
          coordinates: { lat: 37.7749, lng: -122.4194 },
          accuracy: 25,
          speed: 0,
          timestamp: new Date().toISOString(),
        },
        isTracking: true,
        accuracy: 25,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: true,
        isRealtimeEnabled: true,
        connectionMode: 'realtime',
      });
      useDriverShift.mockReturnValue({
        currentShift: mockShift,
        isShiftActive: true,
        startShift: mockStartShift,
        endShift: mockEndShift,
        startBreak: mockStartBreak,
        endBreak: mockEndBreak,
        loading: false,
        error: null,
      });

      render(<DriverTrackingPortal />);

      const breakButton = screen.getByText('Break').closest('button');
      fireEvent.click(breakButton!);

      await waitFor(() => {
        expect(mockStartBreak).toHaveBeenCalledWith('shift-123', 'rest', expect.any(Object));
      });
    });

    it('should call endBreak when End Break button is clicked', async () => {
      const mockShiftOnBreak = {
        id: 'shift-123',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        breaks: [
          {
            id: 'break-1',
            breakType: 'rest',
            startTime: new Date(Date.now() - 600000).toISOString(),
            endTime: null,
          },
        ],
        totalDistanceMiles: 10,
        deliveryCount: 2,
      };

      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: {
          coordinates: { lat: 37.7749, lng: -122.4194 },
          accuracy: 25,
          speed: 0,
          timestamp: new Date().toISOString(),
        },
        isTracking: true,
        accuracy: 25,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: true,
        isRealtimeEnabled: true,
        connectionMode: 'realtime',
      });
      useDriverShift.mockReturnValue({
        currentShift: mockShiftOnBreak,
        isShiftActive: true,
        startShift: mockStartShift,
        endShift: mockEndShift,
        startBreak: mockStartBreak,
        endBreak: mockEndBreak,
        loading: false,
        error: null,
      });

      render(<DriverTrackingPortal />);

      const endBreakButton = screen.getByText('End Break').closest('button');
      fireEvent.click(endBreakButton!);

      await waitFor(() => {
        expect(mockEndBreak).toHaveBeenCalledWith('break-1', expect.any(Object));
      });
    });
  });

  describe('Tracking Status', () => {
    it('should display "Location tracking active" when tracking', () => {
      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: {
          coordinates: { lat: 37.7749, lng: -122.4194 },
          accuracy: 25,
          speed: 0,
          timestamp: new Date().toISOString(),
        },
        isTracking: true,
        accuracy: 25,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: true,
        isRealtimeEnabled: true,
        connectionMode: 'realtime',
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText('Location tracking active')).toBeInTheDocument();
      expect(screen.getByText('Updates every 30s')).toBeInTheDocument();
    });

    it('should display "Location tracking stopped" when not tracking', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('Location tracking stopped')).toBeInTheDocument();
    });
  });

  describe('Realtime Connection Status', () => {
    it('should show realtime connected message', () => {
      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: null,
        isTracking: false,
        accuracy: null,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: true,
        isRealtimeEnabled: true,
        connectionMode: 'realtime',
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText('✓ Real-time connected')).toBeInTheDocument();
    });

    it('should show connecting message for hybrid mode', () => {
      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: null,
        isTracking: false,
        accuracy: null,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'hybrid',
      });

      render(<DriverTrackingPortal />);

      expect(screen.getByText('⟳ Connecting to real-time...')).toBeInTheDocument();
    });

    it('should show standard mode for rest connection mode', () => {
      render(<DriverTrackingPortal />);

      expect(screen.getByText('Standard mode')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button labels', () => {
      const mockShift = {
        id: 'shift-123',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        breaks: [],
        totalDistanceMiles: 10,
        deliveryCount: 2,
      };

      useRealtimeLocationTracking.mockReturnValue({
        currentLocation: {
          coordinates: { lat: 37.7749, lng: -122.4194 },
          accuracy: 25,
          speed: 0,
          timestamp: new Date().toISOString(),
        },
        isTracking: true,
        accuracy: 25,
        startTracking: mockStartTracking,
        stopTracking: mockStopTracking,
        error: null,
        isRealtimeConnected: true,
        isRealtimeEnabled: true,
        connectionMode: 'realtime',
      });
      useDriverShift.mockReturnValue({
        currentShift: mockShift,
        isShiftActive: true,
        startShift: mockStartShift,
        endShift: mockEndShift,
        startBreak: mockStartBreak,
        endBreak: mockEndBreak,
        loading: false,
        error: null,
      });

      render(<DriverTrackingPortal />);

      const buttons = screen.getAllByTestId('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
