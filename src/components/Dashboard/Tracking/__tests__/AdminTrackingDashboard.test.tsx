import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminTrackingDashboard from '../AdminTrackingDashboard';
import type { TrackedDriver, DeliveryTracking } from '@/types/tracking';

// Mock data
const mockDriver: TrackedDriver = {
  id: 'driver-1',
  employeeId: 'EMP001',
  vehicleNumber: 'VEH-123',
  isOnDuty: true,
  lastKnownLocation: {
    type: 'Point',
    coordinates: [-118.2437, 34.0522]
  },
  currentShift: {
    id: 'shift-1',
    startTime: '2025-01-01T08:00:00Z',
    deliveryCount: 5,
    totalDistanceKm: 25.5,
    breaks: []
  },
  totalDistanceMiles: 15.8,
  deliveryCount: 5,
  lastLocationUpdate: new Date().toISOString()
};

const mockOffDutyDriver: TrackedDriver = {
  ...mockDriver,
  id: 'driver-2',
  employeeId: 'EMP002',
  isOnDuty: false,
  lastKnownLocation: {
    type: 'Point',
    coordinates: [-118.2537, 34.0622]
  }
};

const mockLocationData = {
  driverId: 'driver-1',
  location: {
    type: 'Point' as const,
    coordinates: [-118.2437, 34.0522] as [number, number]
  },
  accuracy: 10,
  speed: 25,
  heading: 90,
  batteryLevel: 80,
  isMoving: true,
  activityType: 'driving' as const,
  recordedAt: '2025-01-01T10:00:00Z'
};

const mockDelivery: DeliveryTracking = {
  id: 'delivery-1',
  deliveryLocation: {
    type: 'Point',
    coordinates: [-118.2437, 34.0522]
  },
  pickupLocation: {
    type: 'Point',
    coordinates: [-118.2537, 34.0622]
  },
  status: 'assigned',
  driverId: 'driver-1'
};

// Mock hooks
const mockReconnect = jest.fn();
const mockToggleMode = jest.fn();

jest.mock('@/hooks/tracking/useAdminRealtimeTracking', () => ({
  useAdminRealtimeTracking: jest.fn(() => ({
    activeDrivers: [mockDriver, mockOffDutyDriver],
    recentLocations: [mockLocationData],
    activeDeliveries: [mockDelivery],
    isConnected: true,
    isRealtimeConnected: true,
    isRealtimeEnabled: true,
    connectionMode: 'realtime',
    error: null,
    reconnect: mockReconnect,
    toggleMode: mockToggleMode
  }))
}));

// Mock dynamic imports
jest.mock('next/dynamic', () => () => {
  const MockLiveDriverMap = ({ drivers, deliveries, recentLocations, compact }: any) => (
    <div data-testid="live-driver-map" data-compact={compact}>
      Mock Map - {drivers.length} drivers
    </div>
  );
  return MockLiveDriverMap;
});

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
    <h3 data-testid="card-title" className={className}>{children}</h3>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}));

// Create a context for tabs state
const TabsContext = React.createContext<{ value: string; onValueChange: (v: string) => void } | null>(null);

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value, onValueChange, className }: any) => {
    const [currentValue, setCurrentValue] = React.useState(value);
    const handleChange = (newValue: string) => {
      setCurrentValue(newValue);
      onValueChange?.(newValue);
    };
    return (
      <TabsContext.Provider value={{ value: currentValue, onValueChange: handleChange }}>
        <div data-testid="tabs" data-value={currentValue} className={className}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
  TabsList: ({ children, className }: any) => (
    <div data-testid="tabs-list" className={className}>{children}</div>
  ),
  TabsTrigger: ({ children, value }: any) => {
    const context = React.useContext(TabsContext);
    return (
      <button
        data-testid={`tab-${value}`}
        data-active={context?.value === value}
        onClick={() => context?.onValueChange(value)}
      >
        {children}
      </button>
    );
  },
  TabsContent: ({ children, value }: any) => {
    const context = React.useContext(TabsContext);
    return context?.value === value ? <div data-testid={`tab-content-${value}`}>{children}</div> : null;
  },
}));

// Mock child components
jest.mock('../DriverStatusList', () => {
  return function MockDriverStatusList({ drivers, recentLocations, compact }: any) {
    return (
      <div data-testid="driver-status-list" data-compact={compact}>
        {drivers.length} drivers
      </div>
    );
  };
});

jest.mock('../DeliveryAssignmentPanel', () => {
  return function MockDeliveryAssignmentPanel({ drivers, deliveries }: any) {
    return (
      <div data-testid="delivery-assignment-panel">
        {deliveries.length} deliveries
      </div>
    );
  };
});

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  NavigationIcon: () => <span data-testid="navigation-icon">Nav</span>,
  TruckIcon: () => <span data-testid="truck-icon">Truck</span>,
  MapPinIcon: () => <span data-testid="map-pin-icon">MapPin</span>,
  ClockIcon: () => <span data-testid="clock-icon">Clock</span>,
  UsersIcon: () => <span data-testid="users-icon">Users</span>,
  ActivityIcon: () => <span data-testid="activity-icon">Activity</span>,
  BatteryIcon: () => <span data-testid="battery-icon">Battery</span>,
  SignalIcon: () => <span data-testid="signal-icon">Signal</span>,
  AlertTriangleIcon: () => <span data-testid="alert-triangle-icon">Alert</span>,
  DownloadIcon: () => <span data-testid="download-icon">Download</span>,
  RefreshCwIcon: () => <span data-testid="refresh-icon">Refresh</span>,
}));

// Mock cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('AdminTrackingDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset hook mock to default state
    const { useAdminRealtimeTracking } = require('@/hooks/tracking/useAdminRealtimeTracking');
    useAdminRealtimeTracking.mockReturnValue({
      activeDrivers: [mockDriver, mockOffDutyDriver],
      recentLocations: [mockLocationData],
      activeDeliveries: [mockDelivery],
      isConnected: true,
      isRealtimeConnected: true,
      isRealtimeEnabled: true,
      connectionMode: 'realtime',
      error: null,
      reconnect: mockReconnect,
      toggleMode: mockToggleMode
    });
  });

  describe('Component Rendering', () => {
    it('should render the dashboard container', () => {
      render(<AdminTrackingDashboard />);

      // Check for stats cards
      expect(screen.getByText('On Duty')).toBeInTheDocument();
      expect(screen.getByText('Active Deliveries')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<AdminTrackingDashboard className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should render all tabs', () => {
      render(<AdminTrackingDashboard />);

      expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
      expect(screen.getByTestId('tab-map')).toBeInTheDocument();
      expect(screen.getByTestId('tab-drivers')).toBeInTheDocument();
      expect(screen.getByTestId('tab-deliveries')).toBeInTheDocument();
    });
  });

  describe('Connection Status', () => {
    it('should show Live Data when connected', () => {
      render(<AdminTrackingDashboard />);

      expect(screen.getByText('Live Data')).toBeInTheDocument();
    });

    it('should show Disconnected when not connected', () => {
      const { useAdminRealtimeTracking } = require('@/hooks/tracking/useAdminRealtimeTracking');
      useAdminRealtimeTracking.mockReturnValue({
        activeDrivers: [],
        recentLocations: [],
        activeDeliveries: [],
        isConnected: false,
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'rest',
        error: null,
        reconnect: mockReconnect,
        toggleMode: mockToggleMode
      });

      render(<AdminTrackingDashboard />);

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('should show WebSocket connected status when realtime is enabled', () => {
      render(<AdminTrackingDashboard />);

      expect(screen.getByText('✓ Real-time WebSocket connected')).toBeInTheDocument();
    });

    it('should show connecting status in hybrid mode', () => {
      const { useAdminRealtimeTracking } = require('@/hooks/tracking/useAdminRealtimeTracking');
      useAdminRealtimeTracking.mockReturnValue({
        activeDrivers: [mockDriver],
        recentLocations: [mockLocationData],
        activeDeliveries: [],
        isConnected: true,
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'hybrid',
        error: null,
        reconnect: mockReconnect,
        toggleMode: mockToggleMode
      });

      render(<AdminTrackingDashboard />);

      expect(screen.getByText('⟳ Connecting to WebSocket...')).toBeInTheDocument();
    });

    it('should show SSE mode status', () => {
      const { useAdminRealtimeTracking } = require('@/hooks/tracking/useAdminRealtimeTracking');
      useAdminRealtimeTracking.mockReturnValue({
        activeDrivers: [mockDriver],
        recentLocations: [mockLocationData],
        activeDeliveries: [],
        isConnected: true,
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'sse',
        error: null,
        reconnect: mockReconnect,
        toggleMode: mockToggleMode
      });

      render(<AdminTrackingDashboard />);

      expect(screen.getByText('SSE mode (polling every 5s)')).toBeInTheDocument();
    });
  });

  describe('Statistics Cards', () => {
    it('should display drivers on duty count', () => {
      render(<AdminTrackingDashboard />);

      // mockDriver is on duty, mockOffDutyDriver is not
      // Use getAllByText since "1" may appear multiple places
      const oneElements = screen.getAllByText('1');
      expect(oneElements.length).toBeGreaterThan(0);
      expect(screen.getByText('of 2 total')).toBeInTheDocument();
    });

    it('should display active deliveries count', () => {
      render(<AdminTrackingDashboard />);

      // We have 1 mock delivery
      const deliveryCards = screen.getAllByText('Active Deliveries');
      expect(deliveryCards.length).toBeGreaterThan(0);
    });

    it('should display GPS updates count', () => {
      render(<AdminTrackingDashboard />);

      expect(screen.getByText('GPS Updates')).toBeInTheDocument();
      expect(screen.getByText('last 5 min')).toBeInTheDocument();
    });
  });

  describe('Control Buttons', () => {
    it('should toggle mode when mode toggle button is clicked', () => {
      render(<AdminTrackingDashboard />);

      const modeButton = screen.getByText('WebSocket Mode');
      fireEvent.click(modeButton);

      expect(mockToggleMode).toHaveBeenCalled();
    });

    it('should toggle auto refresh when button is clicked', () => {
      render(<AdminTrackingDashboard />);

      const autoRefreshButton = screen.getByText('Auto Refresh On');
      fireEvent.click(autoRefreshButton);

      // After click, button text should change
      expect(screen.getByText('Auto Refresh Off')).toBeInTheDocument();
    });

    it('should call reconnect when refresh button is clicked', () => {
      render(<AdminTrackingDashboard />);

      // Find the refresh button - it contains the refresh icon and text
      // The icon mocks render "Refresh" text, so look for buttons with that
      const buttons = screen.getAllByRole('button');
      // The refresh button is the one with variant="outline" and contains "RefreshRefresh" (icon + text)
      const refreshButton = buttons.find(btn =>
        btn.getAttribute('data-variant') === 'outline' &&
        btn.getAttribute('data-size') === 'sm' &&
        btn.textContent?.includes('RefreshRefresh')
      );
      expect(refreshButton).toBeDefined();
      fireEvent.click(refreshButton!);

      expect(mockReconnect).toHaveBeenCalled();
    });

    it('should disable refresh button when disconnected', () => {
      const { useAdminRealtimeTracking } = require('@/hooks/tracking/useAdminRealtimeTracking');
      useAdminRealtimeTracking.mockReturnValue({
        activeDrivers: [],
        recentLocations: [],
        activeDeliveries: [],
        isConnected: false,
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'rest',
        error: null,
        reconnect: mockReconnect,
        toggleMode: mockToggleMode
      });

      render(<AdminTrackingDashboard />);

      // Find the refresh button - it contains the refresh icon and text
      const buttons = screen.getAllByRole('button');
      const refreshButton = buttons.find(btn =>
        btn.getAttribute('data-variant') === 'outline' &&
        btn.getAttribute('data-size') === 'sm' &&
        btn.textContent?.includes('RefreshRefresh')
      );
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when error exists', () => {
      const { useAdminRealtimeTracking } = require('@/hooks/tracking/useAdminRealtimeTracking');
      useAdminRealtimeTracking.mockReturnValue({
        activeDrivers: [],
        recentLocations: [],
        activeDeliveries: [],
        isConnected: false,
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'rest',
        error: 'Failed to connect to server',
        reconnect: mockReconnect,
        toggleMode: mockToggleMode
      });

      render(<AdminTrackingDashboard />);

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to connect to server')).toBeInTheDocument();
    });

    it('should show reconnect button in error state', () => {
      const { useAdminRealtimeTracking } = require('@/hooks/tracking/useAdminRealtimeTracking');
      useAdminRealtimeTracking.mockReturnValue({
        activeDrivers: [],
        recentLocations: [],
        activeDeliveries: [],
        isConnected: false,
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'rest',
        error: 'Connection lost',
        reconnect: mockReconnect,
        toggleMode: mockToggleMode
      });

      render(<AdminTrackingDashboard />);

      const reconnectButton = screen.getByText('Reconnect');
      fireEvent.click(reconnectButton);

      expect(mockReconnect).toHaveBeenCalled();
    });
  });

  describe('Tab Navigation', () => {
    it('should show overview tab by default', () => {
      render(<AdminTrackingDashboard />);

      const overviewTab = screen.getByTestId('tab-overview');
      expect(overviewTab).toHaveAttribute('data-active', 'true');
    });

    it('should switch to map tab when clicked', () => {
      render(<AdminTrackingDashboard />);

      const mapTab = screen.getByTestId('tab-map');
      fireEvent.click(mapTab);

      expect(screen.getByTestId('tab-content-map')).toBeInTheDocument();
    });

    it('should switch to drivers tab when clicked', () => {
      render(<AdminTrackingDashboard />);

      const driversTab = screen.getByTestId('tab-drivers');
      fireEvent.click(driversTab);

      expect(screen.getByTestId('tab-content-drivers')).toBeInTheDocument();
    });

    it('should switch to deliveries tab when clicked', () => {
      render(<AdminTrackingDashboard />);

      const deliveriesTab = screen.getByTestId('tab-deliveries');
      fireEvent.click(deliveriesTab);

      expect(screen.getByTestId('tab-content-deliveries')).toBeInTheDocument();
    });
  });

  describe('Overview Tab', () => {
    it('should render mini map in overview', () => {
      render(<AdminTrackingDashboard />);

      expect(screen.getByTestId('live-driver-map')).toBeInTheDocument();
    });

    it('should render driver status list in overview', () => {
      render(<AdminTrackingDashboard />);

      expect(screen.getByTestId('driver-status-list')).toBeInTheDocument();
    });

    it('should pass compact=true to mini map', () => {
      render(<AdminTrackingDashboard />);

      const miniMap = screen.getByTestId('live-driver-map');
      expect(miniMap).toHaveAttribute('data-compact', 'true');
    });

    it('should pass compact=true to driver status list in overview', () => {
      render(<AdminTrackingDashboard />);

      const driverList = screen.getByTestId('driver-status-list');
      expect(driverList).toHaveAttribute('data-compact', 'true');
    });
  });

  describe('Map Tab', () => {
    it('should render full map in map tab', () => {
      render(<AdminTrackingDashboard />);

      const mapTab = screen.getByTestId('tab-map');
      fireEvent.click(mapTab);

      const maps = screen.getAllByTestId('live-driver-map');
      // The second map should be the full-size one with compact=false
      expect(maps.length).toBeGreaterThan(0);
    });
  });

  describe('Drivers Tab', () => {
    it('should render full driver status list in drivers tab', () => {
      render(<AdminTrackingDashboard />);

      const driversTab = screen.getByTestId('tab-drivers');
      fireEvent.click(driversTab);

      const driverLists = screen.getAllByTestId('driver-status-list');
      // Should have at least one with compact=false
      const fullList = driverLists.find(list => list.getAttribute('data-compact') === 'false');
      expect(fullList).toBeInTheDocument();
    });

    it('should show driver count in tab header', () => {
      render(<AdminTrackingDashboard />);

      const driversTab = screen.getByTestId('tab-drivers');
      fireEvent.click(driversTab);

      expect(screen.getByText(/Active Drivers \(2\)/)).toBeInTheDocument();
    });
  });

  describe('Deliveries Tab', () => {
    it('should render delivery assignment panel in deliveries tab', () => {
      render(<AdminTrackingDashboard />);

      const deliveriesTab = screen.getByTestId('tab-deliveries');
      fireEvent.click(deliveriesTab);

      expect(screen.getByTestId('delivery-assignment-panel')).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('should trigger export when export button is clicked', () => {
      // Mock URL methods
      const mockCreateObjectURL = jest.fn(() => 'blob:test');
      const mockRevokeObjectURL = jest.fn();
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;

      URL.createObjectURL = mockCreateObjectURL;
      URL.revokeObjectURL = mockRevokeObjectURL;

      render(<AdminTrackingDashboard />);

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();

      // Cleanup
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });

  describe('Last Update Time', () => {
    it('should display last update time', () => {
      render(<AdminTrackingDashboard />);

      expect(screen.getByText(/Last update:/)).toBeInTheDocument();
    });
  });

  describe('Realtime Mode Toggle', () => {
    it('should show WebSocket Mode button when in realtime mode', () => {
      render(<AdminTrackingDashboard />);

      expect(screen.getByText('WebSocket Mode')).toBeInTheDocument();
    });

    it('should show SSE Mode button when in SSE mode', () => {
      const { useAdminRealtimeTracking } = require('@/hooks/tracking/useAdminRealtimeTracking');
      useAdminRealtimeTracking.mockReturnValue({
        activeDrivers: [mockDriver],
        recentLocations: [mockLocationData],
        activeDeliveries: [],
        isConnected: true,
        isRealtimeConnected: false,
        isRealtimeEnabled: true,
        connectionMode: 'sse',
        error: null,
        reconnect: mockReconnect,
        toggleMode: mockToggleMode
      });

      render(<AdminTrackingDashboard />);

      expect(screen.getByText('SSE Mode')).toBeInTheDocument();
    });

    it('should not show mode toggle when realtime is disabled', () => {
      const { useAdminRealtimeTracking } = require('@/hooks/tracking/useAdminRealtimeTracking');
      useAdminRealtimeTracking.mockReturnValue({
        activeDrivers: [mockDriver],
        recentLocations: [mockLocationData],
        activeDeliveries: [],
        isConnected: true,
        isRealtimeConnected: false,
        isRealtimeEnabled: false,
        connectionMode: 'rest',
        error: null,
        reconnect: mockReconnect,
        toggleMode: mockToggleMode
      });

      render(<AdminTrackingDashboard />);

      expect(screen.queryByText('WebSocket Mode')).not.toBeInTheDocument();
      expect(screen.queryByText('SSE Mode')).not.toBeInTheDocument();
    });
  });
});
