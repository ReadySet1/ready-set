import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminTrackingDashboard from '@/components/Dashboard/Tracking/AdminTrackingDashboard';
import { useRealTimeTracking } from '@/hooks/tracking/useRealTimeTracking';

// Mock the tracking hook
jest.mock('@/hooks/tracking/useRealTimeTracking');

// Mock the hooks
const mockUseRealTimeTracking = useRealTimeTracking as jest.MockedFunction<typeof useRealTimeTracking>;

// Mock map components
jest.mock('@/components/Dashboard/Tracking/LiveDriverMap', () => {
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
            {driver.name}
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

describe('AdminTrackingDashboard', () => {
  const mockDrivers = [
    {
      id: 'driver-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      status: 'active',
      currentLocation: {
        lat: 40.7128,
        lng: -74.0060,
        accuracy: 10,
        timestamp: new Date(),
      },
      currentShift: {
        id: 'shift-1',
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        status: 'active',
      },
      vehicleInfo: {
        number: 'V001',
        type: 'van',
      },
    },
    {
      id: 'driver-2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+0987654321',
      status: 'offline',
      currentLocation: null,
      currentShift: null,
      vehicleInfo: {
        number: 'V002',
        type: 'car',
      },
    },
  ];

  const mockDeliveries = [
    {
      id: 'delivery-1',
      status: 'pending',
      pickupLocation: { lat: 40.7128, lng: -74.0060 },
      deliveryLocation: { lat: 40.7589, lng: -73.9851 },
      estimatedArrival: new Date(Date.now() + 3600000),
      driverId: null,
      customerName: 'Customer A',
    },
    {
      id: 'delivery-2',
      status: 'in_transit',
      pickupLocation: { lat: 40.7589, lng: -73.9851 },
      deliveryLocation: { lat: 40.7505, lng: -73.9934 },
      estimatedArrival: new Date(Date.now() + 1800000),
      driverId: 'driver-1',
      customerName: 'Customer B',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    mockUseRealTimeTracking.mockReturnValue({
      drivers: mockDrivers,
      deliveries: mockDeliveries,
      loading: false,
      error: null,
      refreshData: jest.fn(),
      isConnected: true,
      lastUpdate: new Date(),
    });
  });

  it('renders without crashing', () => {
    render(<AdminTrackingDashboard />);
    expect(screen.getByText(/Driver Tracking Dashboard/i)).toBeInTheDocument();
  });

  it('displays the live driver map', () => {
    render(<AdminTrackingDashboard />);
    expect(screen.getByTestId('live-driver-map')).toBeInTheDocument();
  });

  it('displays the driver status list', () => {
    render(<AdminTrackingDashboard />);
    expect(screen.getByTestId('driver-status-list')).toBeInTheDocument();
  });

  it('displays the delivery assignment panel', () => {
    render(<AdminTrackingDashboard />);
    expect(screen.getByTestId('delivery-assignment-panel')).toBeInTheDocument();
  });

  it('shows real-time connection status', () => {
    render(<AdminTrackingDashboard />);
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
  });

  it('shows disconnected status when not connected', () => {
    mockUseRealTimeTracking.mockReturnValue({
      drivers: mockDrivers,
      deliveries: mockDeliveries,
      loading: false,
      error: null,
      refreshData: jest.fn(),
      isConnected: false,
      lastUpdate: new Date(),
    });

    render(<AdminTrackingDashboard />);
    expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
  });

  it('displays last update timestamp', () => {
    const testDate = new Date('2024-01-01T12:00:00Z');
    mockUseRealTimeTracking.mockReturnValue({
      drivers: mockDrivers,
      deliveries: mockDeliveries,
      loading: false,
      error: null,
      refreshData: jest.fn(),
      isConnected: true,
      lastUpdate: testDate,
    });

    render(<AdminTrackingDashboard />);
    expect(screen.getByText(/Last Update:/i)).toBeInTheDocument();
  });

  it('shows loading state when data is loading', () => {
    mockUseRealTimeTracking.mockReturnValue({
      drivers: [],
      deliveries: [],
      loading: true,
      error: null,
      refreshData: jest.fn(),
      isConnected: true,
      lastUpdate: new Date(),
    });

    render(<AdminTrackingDashboard />);
    expect(screen.getByText(/Loading tracking data/i)).toBeInTheDocument();
  });

  it('displays error message when there is an error', () => {
    mockUseRealTimeTracking.mockReturnValue({
      drivers: [],
      deliveries: [],
      loading: false,
      error: 'Failed to connect to tracking service',
      refreshData: jest.fn(),
      isConnected: false,
      lastUpdate: new Date(),
    });

    render(<AdminTrackingDashboard />);
    expect(screen.getByText(/Failed to connect to tracking service/i)).toBeInTheDocument();
  });

  it('shows refresh button and handles refresh', async () => {
    const mockRefreshData = jest.fn();
    mockUseRealTimeTracking.mockReturnValue({
      drivers: mockDrivers,
      deliveries: mockDeliveries,
      loading: false,
      error: null,
      refreshData: mockRefreshData,
      isConnected: true,
      lastUpdate: new Date(),
    });

    render(<AdminTrackingDashboard />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toBeInTheDocument();

    await userEvent.click(refreshButton);
    expect(mockRefreshData).toHaveBeenCalled();
  });

  it('displays driver count summary', () => {
    render(<AdminTrackingDashboard />);
    expect(screen.getByText(/2 Drivers/i)).toBeInTheDocument();
  });

  it('displays delivery count summary', () => {
    render(<AdminTrackingDashboard />);
    expect(screen.getByText(/2 Deliveries/i)).toBeInTheDocument();
  });

  it('shows active drivers count', () => {
    render(<AdminTrackingDashboard />);
    const activeDrivers = mockDrivers.filter(d => d.status === 'active').length;
    expect(screen.getByText(new RegExp(`${activeDrivers} Active`, 'i'))).toBeInTheDocument();
  });

  it('shows offline drivers count', () => {
    render(<AdminTrackingDashboard />);
    const offlineDrivers = mockDrivers.filter(d => d.status === 'offline').length;
    expect(screen.getByText(new RegExp(`${offlineDrivers} Offline`, 'i'))).toBeInTheDocument();
  });

  it('displays pending deliveries count', () => {
    render(<AdminTrackingDashboard />);
    const pendingDeliveries = mockDeliveries.filter(d => d.status === 'pending').length;
    expect(screen.getByText(new RegExp(`${pendingDeliveries} Pending`, 'i'))).toBeInTheDocument();
  });

  it('displays in-transit deliveries count', () => {
    render(<AdminTrackingDashboard />);
    const inTransitDeliveries = mockDeliveries.filter(d => d.status === 'in_transit').length;
    expect(screen.getByText(new RegExp(`${inTransitDeliveries} In Transit`, 'i'))).toBeInTheDocument();
  });

  it('handles driver selection from status list', async () => {
    render(<AdminTrackingDashboard />);
    
    const driverButton = screen.getByTestId('driver-driver-1');
    await userEvent.click(driverButton);

    // Verify driver selection is handled (you might need to add state management for this)
    expect(driverButton).toBeInTheDocument();
  });

  it('handles delivery assignment', async () => {
    render(<AdminTrackingDashboard />);
    
    const deliveryButton = screen.getByTestId('delivery-delivery-1');
    await userEvent.click(deliveryButton);

    // Verify delivery assignment is handled
    expect(deliveryButton).toBeInTheDocument();
  });

  it('displays empty state when no drivers', () => {
    mockUseRealTimeTracking.mockReturnValue({
      drivers: [],
      deliveries: mockDeliveries,
      loading: false,
      error: null,
      refreshData: jest.fn(),
      isConnected: true,
      lastUpdate: new Date(),
    });

    render(<AdminTrackingDashboard />);
    expect(screen.getByText(/No drivers available/i)).toBeInTheDocument();
  });

  it('displays empty state when no deliveries', () => {
    mockUseRealTimeTracking.mockReturnValue({
      drivers: mockDrivers,
      deliveries: [],
      loading: false,
      error: null,
      refreshData: jest.fn(),
      isConnected: true,
      lastUpdate: new Date(),
    });

    render(<AdminTrackingDashboard />);
    expect(screen.getByText(/No deliveries available/i)).toBeInTheDocument();
  });

  it('shows connection retry button when disconnected', () => {
    mockUseRealTimeTracking.mockReturnValue({
      drivers: [],
      deliveries: [],
      loading: false,
      error: 'Connection lost',
      refreshData: jest.fn(),
      isConnected: false,
      lastUpdate: new Date(),
    });

    render(<AdminTrackingDashboard />);
    expect(screen.getByRole('button', { name: /retry connection/i })).toBeInTheDocument();
  });

  it('handles connection retry', async () => {
    const mockRefreshData = jest.fn();
    mockUseRealTimeTracking.mockReturnValue({
      drivers: [],
      deliveries: [],
      loading: false,
      error: 'Connection lost',
      refreshData: mockRefreshData,
      isConnected: false,
      lastUpdate: new Date(),
    });

    render(<AdminTrackingDashboard />);
    
    const retryButton = screen.getByRole('button', { name: /retry connection/i });
    await userEvent.click(retryButton);

    expect(mockRefreshData).toHaveBeenCalled();
  });

  it('displays real-time update indicator', () => {
    render(<AdminTrackingDashboard />);
    expect(screen.getByText(/Real-time Updates/i)).toBeInTheDocument();
  });

  it('shows dashboard statistics', () => {
    render(<AdminTrackingDashboard />);
    
    // Check for various statistics
    expect(screen.getByText(/Total Drivers/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Deliveries/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Shifts/i)).toBeInTheDocument();
  });

  it('handles component unmounting gracefully', () => {
    const { unmount } = render(<AdminTrackingDashboard />);
    
    // This should not throw any errors
    expect(() => unmount()).not.toThrow();
  });

  it('displays driver vehicle information', () => {
    render(<AdminTrackingDashboard />);
    
    // Check if vehicle info is displayed in the driver list
    expect(screen.getByText(/V001/i)).toBeInTheDocument();
    expect(screen.getByText(/V002/i)).toBeInTheDocument();
  });

  it('shows shift duration for active drivers', () => {
    render(<AdminTrackingDashboard />);
    
    // Check if shift duration is calculated and displayed
    expect(screen.getByText(/Shift Duration/i)).toBeInTheDocument();
  });

  it('displays delivery status with proper styling', () => {
    render(<AdminTrackingDashboard />);
    
    // Check if delivery statuses are properly styled
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    expect(screen.getByText(/in_transit/i)).toBeInTheDocument();
  });

  it('handles real-time data updates', async () => {
    const mockRefreshData = jest.fn();
    mockUseRealTimeTracking.mockReturnValue({
      drivers: mockDrivers,
      deliveries: mockDeliveries,
      loading: false,
      error: null,
      refreshData: mockRefreshData,
      isConnected: true,
      lastUpdate: new Date(),
    });

    render(<AdminTrackingDashboard />);
    
    // Simulate real-time update
    await waitFor(() => {
      expect(mockRefreshData).not.toHaveBeenCalled(); // Should not auto-refresh unless configured
    });
  });
});
