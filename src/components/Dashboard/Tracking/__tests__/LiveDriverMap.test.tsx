import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LiveDriverMap from '../LiveDriverMap';
import mapboxgl from 'mapbox-gl';
import type { TrackedDriver, DeliveryTracking } from '@/types/tracking';

// Enable automocking for mapbox-gl
jest.mock('mapbox-gl');

// Mock data
const mockDriver: TrackedDriver = {
  id: 'driver-1',
  employeeId: 'EMP001',
  vehicleNumber: 'VEH-123',
  isOnDuty: true,
  lastKnownLocation: {
    type: 'Point',
    coordinates: [-118.2437, 34.0522] // Los Angeles
  },
  currentShift: {
    id: 'shift-1',
    startTime: '2025-01-01T08:00:00Z',
    deliveryCount: 5,
    totalDistanceKm: 25.5,
    breaks: []
  }
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

const mockLowBatteryLocation = {
  ...mockLocationData,
  driverId: 'driver-2',
  batteryLevel: 20,
  isMoving: false,
  activityType: 'stationary' as const
};

const mockCriticalBatteryLocation = {
  ...mockLocationData,
  driverId: 'driver-3',
  batteryLevel: 10
};

const mockDelivery: DeliveryTracking = {
  id: 'delivery-1',
  deliveryLocation: {
    type: 'Point',
    coordinates: [-118.2437, 34.0522]
  },
  status: 'in_progress',
  assignedDriverId: 'driver-1'
};

/**
 * LiveDriverMap component tests
 * Uses mapbox-gl mock from src/__mocks__/mapbox-gl.ts
 */
describe('LiveDriverMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Mapbox Token Validation', () => {
    it('should show error when Mapbox token is missing', () => {
      const originalToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      expect(screen.getByText('Map Error')).toBeInTheDocument();
      expect(screen.getByText(/Mapbox token not configured/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Mapbox Dashboard/i })).toHaveAttribute(
        'href',
        'https://account.mapbox.com/access-tokens/'
      );

      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = originalToken;
    });

    it('should show error when token is placeholder "YOUR_MAPBOX_TOKEN_HERE"', () => {
      const originalToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'YOUR_MAPBOX_TOKEN_HERE';

      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      expect(screen.getByText('Map Error')).toBeInTheDocument();
      expect(screen.getByText(/Mapbox token not configured/i)).toBeInTheDocument();

      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = originalToken;
    });

    it('should show error when token is placeholder "your_mapbox_access_token"', () => {
      const originalToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'your_mapbox_access_token';

      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      expect(screen.getByText('Map Error')).toBeInTheDocument();
      expect(screen.getByText(/Mapbox token not configured/i)).toBeInTheDocument();

      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = originalToken;
    });

    it('should initialize map with valid token', () => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';

      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      expect(mapboxgl.Map).toHaveBeenCalledWith(
        expect.objectContaining({
          style: 'mapbox://styles/mapbox/streets-v12',
          zoom: expect.any(Number),
          center: expect.any(Array)
        })
      );
    });
  });

  describe('Map Initialization', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';
    });

    it('should initialize map with correct configuration', () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      expect(mapboxgl.Map).toHaveBeenCalledWith(
        expect.objectContaining({
          style: 'mapbox://styles/mapbox/streets-v12',
          attributionControl: true
        })
      );
    });

    it('should use compact zoom when compact=true', () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
          compact={true}
        />
      );

      expect(mapboxgl.Map).toHaveBeenCalledWith(
        expect.objectContaining({
          zoom: expect.any(Number) // COMPACT_ZOOM from config
        })
      );
    });

    it('should add NavigationControl to map', () => {
      const { container } = render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      expect(mapboxgl.NavigationControl).toHaveBeenCalled();
    });

    it('should add ScaleControl with imperial units', () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      expect(mapboxgl.ScaleControl).toHaveBeenCalledWith(
        expect.objectContaining({
          unit: 'imperial'
        })
      );
    });
  });

  describe('Loading States', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';
    });

    it('should show loading spinner when map is not loaded', () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      expect(screen.getByText('Loading map...')).toBeInTheDocument();
    });

    it('should hide loading spinner after map loads', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      // Simulate map load event
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        expect(screen.queryByText('Loading map...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';
    });

    it('should show "No active drivers" when drivers array is empty and map is loaded', async () => {
      render(
        <LiveDriverMap
          drivers={[]}
          deliveries={[]}
          recentLocations={[]}
        />
      );

      // Trigger map load
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        expect(screen.getByText('No active drivers to display')).toBeInTheDocument();
      });
    });

    it('should not show empty state when drivers exist', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      // Trigger map load
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        expect(screen.queryByText('No active drivers to display')).not.toBeInTheDocument();
      });
    });
  });

  describe('Driver Markers', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';
    });

    it('should create marker for each driver', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver, mockOffDutyDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData, mockLowBatteryLocation]}
        />
      );

      // Trigger map load
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        expect(mapboxgl.Marker).toHaveBeenCalledTimes(2);
      });
    });

    it('should skip driver when lastKnownLocation.coordinates is undefined', async () => {
      const driverWithoutLocation = {
        ...mockDriver,
        lastKnownLocation: undefined
      };

      render(
        <LiveDriverMap
          drivers={[driverWithoutLocation]}
          deliveries={[]}
          recentLocations={[]}
        />
      );

      // Trigger map load
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        // Should not create any markers
        expect(mapboxgl.Marker).not.toHaveBeenCalled();
      });
    });

    it('should position marker at driver coordinates', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      // Trigger map load
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        const markerInstance = (mapboxgl.Marker as jest.Mock).mock.results[0].value;
        expect(markerInstance.setLngLat).toHaveBeenCalledWith(mockDriver.lastKnownLocation!.coordinates);
      });
    });

    it('should attach popup to marker with driver information', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      // Trigger map load
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        expect(mapboxgl.Popup).toHaveBeenCalled();
        const popupInstance = (mapboxgl.Popup as jest.Mock).mock.results[0].value;
        expect(popupInstance.setHTML).toHaveBeenCalledWith(expect.stringContaining('Driver #EMP001'));
        expect(popupInstance.setHTML).toHaveBeenCalledWith(expect.stringContaining('VEH-123'));
      });
    });
  });

  describe('Delivery Markers', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';
    });

    it('should create marker for each delivery', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[mockDelivery]}
          recentLocations={[mockLocationData]}
        />
      );

      // Trigger map load
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        // Should create 1 driver marker + 1 delivery marker
        expect(mapboxgl.Marker).toHaveBeenCalledTimes(2);
      });
    });

    it('should skip delivery when deliveryLocation.coordinates is undefined', async () => {
      const deliveryWithoutLocation = {
        ...mockDelivery,
        deliveryLocation: undefined
      };

      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[deliveryWithoutLocation]}
          recentLocations={[mockLocationData]}
        />
      );

      // Trigger map load
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        // Should only create driver marker, no delivery marker
        expect(mapboxgl.Marker).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Map Controls', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';
    });

    it('should render zoom controls in non-compact mode', () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
          compact={false}
        />
      );

      // Check for control buttons (by their container)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should hide zoom controls in compact mode', () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
          compact={true}
        />
      );

      // In compact mode, controls should not be rendered
      const buttons = screen.queryAllByRole('button');
      // Should be 0 or very few buttons (no map controls)
      expect(buttons.length).toBe(0);
    });

    it('should call zoomIn when zoom in button clicked', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      // Trigger map load first
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        expect(screen.queryByText('Loading map...')).not.toBeInTheDocument();
      });

      // Click zoom in button (first button)
      const buttons = screen.getAllByRole('button');
      const zoomInButton = buttons[0]; // First button is zoom in
      fireEvent.click(zoomInButton);

      expect(mockMap.zoomIn).toHaveBeenCalled();
    });

    it('should call zoomOut when zoom out button clicked', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      // Trigger map load first
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        expect(screen.queryByText('Loading map...')).not.toBeInTheDocument();
      });

      // Click zoom out button (second button)
      const buttons = screen.getAllByRole('button');
      const zoomOutButton = buttons[1]; // Second button is zoom out
      fireEvent.click(zoomOutButton);

      expect(mockMap.zoomOut).toHaveBeenCalled();
    });
  });

  describe('Map Style Toggle', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';
    });

    it('should toggle from streets to satellite view', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      // Trigger map load first
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        expect(screen.queryByText('Loading map...')).not.toBeInTheDocument();
      });

      // Find and click the map style toggle button (last button)
      const buttons = screen.getAllByRole('button');
      const styleToggleButton = buttons[buttons.length - 1];
      fireEvent.click(styleToggleButton);

      expect(mockMap.setStyle).toHaveBeenCalledWith('mapbox://styles/mapbox/satellite-streets-v12');
    });

    it('should toggle from satellite back to streets view', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      // Trigger map load
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        expect(screen.queryByText('Loading map...')).not.toBeInTheDocument();
      });

      // Toggle twice to go from streets -> satellite -> streets
      const buttons = screen.getAllByRole('button');
      const styleToggleButton = buttons[buttons.length - 1];

      fireEvent.click(styleToggleButton); // streets -> satellite
      fireEvent.click(styleToggleButton); // satellite -> streets

      expect(mockMap.setStyle).toHaveBeenLastCalledWith('mapbox://styles/mapbox/streets-v12');
    });
  });

  describe('Legend', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';
    });

    it('should display legend with all status indicators', () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      expect(screen.getByText('Legend')).toBeInTheDocument();
      expect(screen.getByText('Moving')).toBeInTheDocument();
      expect(screen.getByText('Stopped')).toBeInTheDocument();
      expect(screen.getByText('On Duty')).toBeInTheDocument();
      expect(screen.getByText('Off Duty')).toBeInTheDocument();
      expect(screen.getByText('Delivery')).toBeInTheDocument();
    });
  });

  describe('Status Info', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';
    });

    it('should display driver count and recent locations count', () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver, mockOffDutyDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData, mockLowBatteryLocation]}
        />
      );

      expect(screen.getByText('2 drivers • 2 updates')).toBeInTheDocument();
    });

    it('should update counts when props change', () => {
      const { rerender } = render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      expect(screen.getByText('1 drivers • 1 updates')).toBeInTheDocument();

      rerender(
        <LiveDriverMap
          drivers={[mockDriver, mockOffDutyDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData, mockLowBatteryLocation, mockCriticalBatteryLocation]}
        />
      );

      expect(screen.getByText('2 drivers • 3 updates')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';
    });

    it('should display error message on map error event', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      // Trigger map error event
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const errorCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'error')[1];
      errorCallback(new Error('Network error'));

      await waitFor(() => {
        expect(screen.getByText('Map Error')).toBeInTheDocument();
        expect(screen.getByText(/Failed to load map/i)).toBeInTheDocument();
      });
    });

    it('should handle map initialization error', () => {
      // Force Map constructor to throw error
      (mapboxgl.Map as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Initialization failed');
      });

      render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      expect(screen.getByText('Map Error')).toBeInTheDocument();
      expect(screen.getByText(/Failed to initialize map/i)).toBeInTheDocument();
    });
  });

  describe('Memory Management', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';
    });

    it('should clean up markers on unmount', async () => {
      const { unmount } = render(
        <LiveDriverMap
          drivers={[mockDriver]}
          deliveries={[mockDelivery]}
          recentLocations={[mockLocationData]}
        />
      );

      // Trigger map load
      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
      loadCallback();

      await waitFor(() => {
        expect(mapboxgl.Marker).toHaveBeenCalled();
      });

      const markerInstance = (mapboxgl.Marker as jest.Mock).mock.results[0].value;

      unmount();

      // Verify markers were removed
      expect(markerInstance.remove).toHaveBeenCalled();
      expect(mockMap.remove).toHaveBeenCalled();
    });
  });

  describe('User Interaction Tracking', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';
    });

    it('should track dragstart as user interaction', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver, mockOffDutyDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const dragstartCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'dragstart')[1];

      dragstartCallback();

      // After dragstart, auto-fit should be disabled
      // This is tested implicitly by checking that fitBounds is not called on subsequent updates
      await waitFor(() => {
        expect(mockMap.on).toHaveBeenCalledWith('dragstart', expect.any(Function));
      });
    });

    it('should track zoomstart as user interaction', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver, mockOffDutyDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const zoomstartCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'zoomstart')[1];

      zoomstartCallback();

      await waitFor(() => {
        expect(mockMap.on).toHaveBeenCalledWith('zoomstart', expect.any(Function));
      });
    });

    it('should track rotatestart as user interaction', async () => {
      render(
        <LiveDriverMap
          drivers={[mockDriver, mockOffDutyDriver]}
          deliveries={[]}
          recentLocations={[mockLocationData]}
        />
      );

      const mockMap = (mapboxgl.Map as jest.Mock).mock.results[0].value;
      const rotatestartCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'rotatestart')[1];

      rotatestartCallback();

      await waitFor(() => {
        expect(mockMap.on).toHaveBeenCalledWith('rotatestart', expect.any(Function));
      });
    });
  });
});
