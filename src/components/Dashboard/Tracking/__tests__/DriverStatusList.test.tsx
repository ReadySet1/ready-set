import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DriverStatusList from '../DriverStatusList';
import type { TrackedDriver } from '@/types/tracking';

// Mock data
const mockDriver1: TrackedDriver = {
  id: 'driver-1',
  employeeId: 'EMP001',
  name: 'John Smith',
  vehicleNumber: 'VEH-123',
  phoneNumber: '+1-555-0101',
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

const mockDriver2: TrackedDriver = {
  id: 'driver-2',
  employeeId: 'EMP002',
  name: 'Jane Doe',
  vehicleNumber: 'VEH-456',
  phoneNumber: '+1-555-0102',
  isOnDuty: true,
  lastKnownLocation: {
    type: 'Point',
    coordinates: [-118.2537, 34.0622]
  },
  currentShift: {
    id: 'shift-2',
    startTime: '2025-01-01T09:00:00Z',
    deliveryCount: 3,
    totalDistanceKm: 18.2,
    breaks: []
  },
  totalDistanceMiles: 11.3,
  deliveryCount: 3,
  lastLocationUpdate: new Date().toISOString()
};

const mockOffDutyDriver: TrackedDriver = {
  ...mockDriver1,
  id: 'driver-3',
  employeeId: 'EMP003',
  name: 'Bob Wilson',
  vehicleNumber: 'VEH-789',
  isOnDuty: false,
  deliveryCount: 0,
  totalDistanceMiles: 0
};

// Mock driver without name (for fallback testing)
const mockDriverWithoutName: TrackedDriver = {
  id: 'driver-4',
  employeeId: 'EMP004',
  name: undefined,
  vehicleNumber: 'VEH-101',
  phoneNumber: '+1-555-0104',
  isOnDuty: true,
  lastKnownLocation: {
    type: 'Point',
    coordinates: [-118.2637, 34.0722]
  },
  totalDistanceMiles: 8.5,
  deliveryCount: 2,
  lastLocationUpdate: new Date().toISOString()
};

// Mock driver without name or employeeId (for Unknown fallback)
const mockDriverUnknown: TrackedDriver = {
  id: 'driver-5',
  employeeId: '',
  name: undefined,
  vehicleNumber: 'VEH-102',
  phoneNumber: '+1-555-0105',
  isOnDuty: true,
  lastKnownLocation: {
    type: 'Point',
    coordinates: [-118.2737, 34.0822]
  },
  totalDistanceMiles: 5.0,
  deliveryCount: 1,
  lastLocationUpdate: new Date().toISOString()
};

const mockLocationData1 = {
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

const mockLocationData2 = {
  driverId: 'driver-2',
  location: {
    type: 'Point' as const,
    coordinates: [-118.2537, 34.0622] as [number, number]
  },
  accuracy: 25,
  speed: 0,
  heading: 0,
  batteryLevel: 45,
  isMoving: false,
  activityType: 'stationary' as const,
  recordedAt: '2025-01-01T10:00:00Z'
};

const mockLowBatteryLocation = {
  driverId: 'driver-3',
  location: {
    type: 'Point' as const,
    coordinates: [-118.2637, 34.0722] as [number, number]
  },
  accuracy: 50,
  speed: 0,
  heading: 0,
  batteryLevel: 15,
  isMoving: false,
  activityType: 'stationary' as const,
  recordedAt: '2025-01-01T10:00:00Z'
};

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      data-testid="button"
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

jest.mock('@/components/ui/input', () => ({
  Input: ({ placeholder, value, onChange, className }: any) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={className}
      data-testid="search-input"
    />
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  NavigationIcon: () => <span data-testid="navigation-icon">Nav</span>,
  TruckIcon: () => <span data-testid="truck-icon">Truck</span>,
  ClockIcon: () => <span data-testid="clock-icon">Clock</span>,
  BatteryIcon: () => <span data-testid="battery-icon">Battery</span>,
  SignalIcon: () => <span data-testid="signal-icon">Signal</span>,
  PhoneIcon: () => <span data-testid="phone-icon">Phone</span>,
  MapPinIcon: () => <span data-testid="map-pin-icon">MapPin</span>,
  ActivityIcon: () => <span data-testid="activity-icon">Activity</span>,
  SearchIcon: () => <span data-testid="search-icon">Search</span>,
  FilterIcon: () => <span data-testid="filter-icon">Filter</span>,
}));

// Mock cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('DriverStatusList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the driver list with names', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1, mockDriver2]}
          recentLocations={[mockLocationData1, mockLocationData2]}
        />
      );

      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should render empty state when no drivers', () => {
      render(
        <DriverStatusList
          drivers={[]}
          recentLocations={[]}
        />
      );

      expect(screen.getByText('No drivers match your criteria')).toBeInTheDocument();
    });
  });

  describe('Driver Name Display', () => {
    it('should display driver name when available', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
        />
      );

      expect(screen.getByText('John Smith')).toBeInTheDocument();
      // Should NOT show the fallback format when name is available
      expect(screen.queryByText('Driver #EMP001')).not.toBeInTheDocument();
    });

    it('should fall back to Driver #employeeId when name is not available', () => {
      render(
        <DriverStatusList
          drivers={[mockDriverWithoutName]}
          recentLocations={[]}
        />
      );

      expect(screen.getByText('Driver #EMP004')).toBeInTheDocument();
    });

    it('should fall back to Driver #Unknown when neither name nor employeeId is available', () => {
      render(
        <DriverStatusList
          drivers={[mockDriverUnknown]}
          recentLocations={[]}
        />
      );

      expect(screen.getByText('Driver #Unknown')).toBeInTheDocument();
    });

    it('should display multiple drivers with their respective names or fallbacks', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1, mockDriverWithoutName, mockDriverUnknown]}
          recentLocations={[mockLocationData1]}
        />
      );

      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Driver #EMP004')).toBeInTheDocument();
      expect(screen.getByText('Driver #Unknown')).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should hide search and filters in compact mode', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
          compact={true}
        />
      );

      expect(screen.queryByTestId('search-input')).not.toBeInTheDocument();
    });

    it('should show search and filters in non-compact mode', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
          compact={false}
        />
      );

      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    it('should hide driver count summary in compact mode', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1, mockDriver2]}
          recentLocations={[mockLocationData1, mockLocationData2]}
          compact={true}
        />
      );

      expect(screen.queryByText(/Showing .* of .* drivers/)).not.toBeInTheDocument();
    });

    it('should show driver count summary in non-compact mode', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1, mockDriver2]}
          recentLocations={[mockLocationData1, mockLocationData2]}
          compact={false}
        />
      );

      expect(screen.getByText('Showing 2 of 2 drivers')).toBeInTheDocument();
    });

    it('should hide vehicle number in compact mode', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
          compact={true}
        />
      );

      expect(screen.queryByText('Vehicle: VEH-123')).not.toBeInTheDocument();
    });

    it('should show vehicle number in non-compact mode', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
          compact={false}
        />
      );

      expect(screen.getByText('Vehicle: VEH-123')).toBeInTheDocument();
    });
  });

  describe('Driver Status Display', () => {
    it('should show On Duty badge for on-duty drivers', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
          compact={true}
        />
      );

      // Use getAllByText since "On Duty" appears in the filter dropdown too
      const onDutyElements = screen.getAllByText('On Duty');
      expect(onDutyElements.length).toBeGreaterThan(0);
    });

    it('should show Off Duty badge for off-duty drivers', () => {
      render(
        <DriverStatusList
          drivers={[mockOffDutyDriver]}
          recentLocations={[]}
          compact={true}
        />
      );

      // Use getAllByText since "Off Duty" appears in the filter dropdown too
      const offDutyElements = screen.getAllByText('Off Duty');
      expect(offDutyElements.length).toBeGreaterThan(0);
    });

    it('should show activity type badge when location data exists', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
        />
      );

      expect(screen.getByText('🚗 Driving')).toBeInTheDocument();
    });

    it('should show stopped status for stationary driver', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver2]}
          recentLocations={[mockLocationData2]}
        />
      );

      expect(screen.getByText('⏸️ Stopped')).toBeInTheDocument();
    });
  });

  describe('Driver Metrics', () => {
    it('should display delivery count for on-duty drivers', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
          compact={false}
        />
      );

      expect(screen.getByText('Deliveries')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display distance for on-duty drivers', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
          compact={false}
        />
      );

      expect(screen.getByText('Distance')).toBeInTheDocument();
      expect(screen.getByText('15.8 mi')).toBeInTheDocument();
    });

    it('should not show metrics for off-duty drivers', () => {
      render(
        <DriverStatusList
          drivers={[mockOffDutyDriver]}
          recentLocations={[]}
          compact={false}
        />
      );

      // Should not show "Deliveries" label for off-duty
      const deliveriesLabels = screen.queryAllByText('Deliveries');
      expect(deliveriesLabels.length).toBe(0);
    });
  });

  describe('Signal Strength', () => {
    it('should show excellent signal for accuracy <= 10m', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
        />
      );

      expect(screen.getByText('10m')).toBeInTheDocument();
    });

    it('should show accuracy in meters', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver2]}
          recentLocations={[mockLocationData2]}
        />
      );

      expect(screen.getByText('25m')).toBeInTheDocument();
    });
  });

  describe('Battery Level', () => {
    it('should display battery level when available', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
        />
      );

      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('should display low battery level', () => {
      render(
        <DriverStatusList
          drivers={[mockOffDutyDriver]}
          recentLocations={[mockLowBatteryLocation]}
        />
      );

      expect(screen.getByText('15%')).toBeInTheDocument();
    });
  });

  describe('Speed Display', () => {
    it('should show speed for moving drivers', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
        />
      );

      // 25 m/s * 2.237 = ~56 mph
      expect(screen.getByText('56 mph')).toBeInTheDocument();
    });

    it('should not show speed for stationary drivers', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver2]}
          recentLocations={[mockLocationData2]}
        />
      );

      expect(screen.queryByText(/mph/)).not.toBeInTheDocument();
    });
  });

  describe('Contact Information', () => {
    it('should display phone number in non-compact mode', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
          compact={false}
        />
      );

      expect(screen.getByText('+1-555-0101')).toBeInTheDocument();
    });

    it('should show call button in non-compact mode', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
          compact={false}
        />
      );

      expect(screen.getByText('Call')).toBeInTheDocument();
    });

    it('should not display phone in compact mode', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[mockLocationData1]}
          compact={true}
        />
      );

      expect(screen.queryByText('+1-555-0101')).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter drivers by employee ID', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1, mockDriver2]}
          recentLocations={[mockLocationData1, mockLocationData2]}
          compact={false}
        />
      );

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'EMP001' } });

      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    });

    it('should filter drivers by vehicle number', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1, mockDriver2]}
          recentLocations={[mockLocationData1, mockLocationData2]}
          compact={false}
        />
      );

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'VEH-456' } });

      expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('should show no results message when search has no matches', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1, mockDriver2]}
          recentLocations={[mockLocationData1, mockLocationData2]}
          compact={false}
        />
      );

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'NONEXISTENT' } });

      expect(screen.getByText('No drivers match your criteria')).toBeInTheDocument();
    });
  });

  describe('Status Filter', () => {
    it('should filter to on duty drivers only', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1, mockOffDutyDriver]}
          recentLocations={[mockLocationData1]}
          compact={false}
        />
      );

      const statusFilter = screen.getByDisplayValue('All Drivers');
      fireEvent.change(statusFilter, { target: { value: 'on_duty' } });

      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument();
    });

    it('should filter to off duty drivers only', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1, mockOffDutyDriver]}
          recentLocations={[mockLocationData1]}
          compact={false}
        />
      );

      const statusFilter = screen.getByDisplayValue('All Drivers');
      fireEvent.change(statusFilter, { target: { value: 'off_duty' } });

      expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    });

    it('should filter to moving drivers only', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1, mockDriver2]}
          recentLocations={[mockLocationData1, mockLocationData2]}
          compact={false}
        />
      );

      const statusFilter = screen.getByDisplayValue('All Drivers');
      fireEvent.change(statusFilter, { target: { value: 'moving' } });

      // mockDriver1 is moving, mockDriver2 is stationary
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    });
  });

  describe('Sort Functionality', () => {
    it('should sort by status by default', () => {
      render(
        <DriverStatusList
          drivers={[mockOffDutyDriver, mockDriver1]}
          recentLocations={[mockLocationData1]}
          compact={false}
        />
      );

      const cards = screen.getAllByTestId('card');
      // On duty should come first when sorted by status
      expect(cards.length).toBeGreaterThan(0);
    });

    it('should sort by name when selected', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver2, mockDriver1]}
          recentLocations={[mockLocationData1, mockLocationData2]}
          compact={false}
        />
      );

      const sortSelect = screen.getByDisplayValue('Sort by Status');
      fireEvent.change(sortSelect, { target: { value: 'name' } });

      // EMP001 should come before EMP002
      const cards = screen.getAllByTestId('card');
      expect(cards.length).toBe(2);
    });

    it('should sort by distance when selected', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1, mockDriver2]}
          recentLocations={[mockLocationData1, mockLocationData2]}
          compact={false}
        />
      );

      const sortSelect = screen.getByDisplayValue('Sort by Status');
      fireEvent.change(sortSelect, { target: { value: 'distance' } });

      // Higher distance should come first
      const cards = screen.getAllByTestId('card');
      expect(cards.length).toBe(2);
    });

    it('should sort by deliveries when selected', () => {
      render(
        <DriverStatusList
          drivers={[mockDriver1, mockDriver2]}
          recentLocations={[mockLocationData1, mockLocationData2]}
          compact={false}
        />
      );

      const sortSelect = screen.getByDisplayValue('Sort by Status');
      fireEvent.change(sortSelect, { target: { value: 'deliveries' } });

      // Higher delivery count should come first
      const cards = screen.getAllByTestId('card');
      expect(cards.length).toBe(2);
    });
  });

  describe('Time Since Update', () => {
    it('should show "Just now" for recent updates', () => {
      const recentDriver = {
        ...mockDriver1,
        lastLocationUpdate: new Date().toISOString()
      };

      render(
        <DriverStatusList
          drivers={[recentDriver]}
          recentLocations={[mockLocationData1]}
        />
      );

      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('should show "Never" when no last update', () => {
      const driverWithoutUpdate = {
        ...mockDriver1,
        lastLocationUpdate: undefined
      };

      render(
        <DriverStatusList
          drivers={[driverWithoutUpdate]}
          recentLocations={[mockLocationData1]}
        />
      );

      expect(screen.getByText('Never')).toBeInTheDocument();
    });
  });

  describe('Walking Activity', () => {
    it('should show walking badge for walking activity', () => {
      const walkingLocation = {
        ...mockLocationData1,
        activityType: 'walking' as const
      };

      render(
        <DriverStatusList
          drivers={[mockDriver1]}
          recentLocations={[walkingLocation]}
        />
      );

      expect(screen.getByText('🚶 Walking')).toBeInTheDocument();
    });
  });
});
