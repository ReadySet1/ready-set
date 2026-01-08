import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import DriverLiveMap from '../DriverLiveMap';
import type { LocationUpdate, DeliveryTracking } from '@/types/tracking';

// Mock mapbox-gl
const mockAddControl = jest.fn();
const mockOn = jest.fn();
const mockRemove = jest.fn();
const mockAddSource = jest.fn();
const mockAddLayer = jest.fn();
const mockRemoveLayer = jest.fn();
const mockRemoveSource = jest.fn();
const mockGetSource = jest.fn();
const mockGetLayer = jest.fn();
const mockEaseTo = jest.fn();
const mockSetLngLat = jest.fn().mockReturnThis();
const mockMarkerAddTo = jest.fn().mockReturnThis();

let mockMapInstance: any;
let mockMarkerInstance: any;
let loadCallback: (() => void) | null = null;

const createMockMapInstance = () => ({
  addControl: mockAddControl,
  on: jest.fn((event: string, callback: () => void) => {
    if (event === 'load') {
      loadCallback = callback;
    }
  }),
  remove: mockRemove,
  addSource: mockAddSource,
  addLayer: mockAddLayer,
  removeLayer: mockRemoveLayer,
  removeSource: mockRemoveSource,
  getSource: mockGetSource,
  getLayer: mockGetLayer,
  easeTo: mockEaseTo,
});

const createMockMarkerInstance = () => ({
  setLngLat: mockSetLngLat,
  addTo: mockMarkerAddTo,
});

jest.mock('mapbox-gl', () => {
  return {
    Map: jest.fn(() => {
      mockMapInstance = createMockMapInstance();
      return mockMapInstance;
    }),
    Marker: jest.fn(() => {
      mockMarkerInstance = createMockMarkerInstance();
      return mockMarkerInstance;
    }),
    NavigationControl: jest.fn(),
    accessToken: '',
  };
});

// Mock Sentry monitoring
jest.mock('@/lib/monitoring/sentry', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addSentryBreadcrumb: jest.fn(),
}));

// Mock tracking config
jest.mock('@/constants/tracking-config', () => ({
  MAP_CONFIG: {
    DEFAULT_CENTER: [-122.4194, 37.7749],
    DEFAULT_ZOOM: 12,
    MAX_AUTO_ZOOM: 15,
    FIT_BOUNDS_DURATION: 1000,
  },
  MARKER_CONFIG: {
    DRIVER_MARKER_SIZE: 32,
    DELIVERY_MARKER_SIZE: 24,
  },
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  AlertTriangleIcon: () => <span data-testid="alert-triangle-icon">Alert</span>,
}));

// Mock cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Save original env
const originalEnv = process.env;

describe('DriverLiveMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadCallback = null;
    mockMapInstance = null;
    mockMarkerInstance = null;

    // Reset environment variable
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: 'test-mapbox-token',
    };

    // Reset mock implementations
    mockGetSource.mockReturnValue({
      setData: jest.fn(),
    });
    mockGetLayer.mockReturnValue(null);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const mockCurrentLocation: LocationUpdate = {
    coordinates: { lat: 37.7749, lng: -122.4194 },
    accuracy: 25,
    speed: 10,
    timestamp: new Date().toISOString(),
  };

  const mockActiveDeliveries: DeliveryTracking[] = [
    {
      id: 'delivery-1',
      status: 'assigned',
      deliveryLocation: { coordinates: [-122.4094, 37.7849], type: 'Point' },
      pickupLocation: { coordinates: [-122.4294, 37.7649], type: 'Point' },
      estimatedArrival: new Date(Date.now() + 1800000).toISOString(),
    },
    {
      id: 'delivery-2',
      status: 'en_route',
      deliveryLocation: { coordinates: [-122.4194, 37.7949], type: 'Point' },
      pickupLocation: { coordinates: [-122.4394, 37.7549], type: 'Point' },
      estimatedArrival: new Date(Date.now() + 3600000).toISOString(),
    },
  ];

  describe('Component Rendering', () => {
    it('should render the map container with correct aria attributes', () => {
      render(
        <DriverLiveMap
          currentLocation={null}
          activeDeliveries={[]}
        />
      );

      const mapContainer = screen.getByRole('application', { name: 'Driver live map' });
      expect(mapContainer).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(
        <DriverLiveMap
          currentLocation={null}
          activeDeliveries={[]}
          className="custom-map-class"
        />
      );

      const mapContainer = screen.getByRole('application');
      expect(mapContainer).toHaveClass('custom-map-class');
    });

    it('should render with default classes', () => {
      render(
        <DriverLiveMap
          currentLocation={null}
          activeDeliveries={[]}
        />
      );

      const mapContainer = screen.getByRole('application');
      expect(mapContainer).toHaveClass('w-full', 'h-full', 'rounded-lg', 'overflow-hidden');
    });
  });

  describe('Map Initialization', () => {
    it('should initialize Mapbox map with correct configuration', async () => {
      const mapboxgl = require('mapbox-gl');

      render(
        <DriverLiveMap
          currentLocation={null}
          activeDeliveries={[]}
        />
      );

      expect(mapboxgl.Map).toHaveBeenCalledWith(
        expect.objectContaining({
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [-122.4194, 37.7749],
          zoom: 12,
          attributionControl: true,
        })
      );
    });

    it('should add navigation control to the map', async () => {
      const mapboxgl = require('mapbox-gl');

      render(
        <DriverLiveMap
          currentLocation={null}
          activeDeliveries={[]}
        />
      );

      expect(mockAddControl).toHaveBeenCalled();
      expect(mapboxgl.NavigationControl).toHaveBeenCalled();
    });
  });

  describe('Error States', () => {
    it('should display error when Mapbox token is missing', () => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = undefined;

      render(
        <DriverLiveMap
          currentLocation={null}
          activeDeliveries={[]}
        />
      );

      expect(screen.getByText('Map Error')).toBeInTheDocument();
      expect(screen.getByText(/Mapbox token not configured/)).toBeInTheDocument();
    });

    it('should display error when Mapbox token is placeholder', () => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'YOUR_MAPBOX_TOKEN_HERE';

      render(
        <DriverLiveMap
          currentLocation={null}
          activeDeliveries={[]}
        />
      );

      expect(screen.getByText('Map Error')).toBeInTheDocument();
    });

    it('should show alert icon when there is an error', () => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'your_mapbox_access_token';

      render(
        <DriverLiveMap
          currentLocation={null}
          activeDeliveries={[]}
        />
      );

      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    });
  });

  describe('Location Updates', () => {
    it('should create driver marker when location is provided and map is loaded', async () => {
      const mapboxgl = require('mapbox-gl');

      render(
        <DriverLiveMap
          currentLocation={mockCurrentLocation}
          activeDeliveries={[]}
        />
      );

      // Trigger the load callback inside act()
      await act(async () => {
        if (loadCallback) {
          loadCallback();
        }
      });

      await waitFor(() => {
        expect(mapboxgl.Marker).toHaveBeenCalled();
      });
    });

    it('should update marker position when location changes', async () => {
      const { rerender } = render(
        <DriverLiveMap
          currentLocation={mockCurrentLocation}
          activeDeliveries={[]}
        />
      );

      // Trigger load
      await act(async () => {
        if (loadCallback) {
          loadCallback();
        }
      });

      await waitFor(() => {
        expect(mockSetLngLat).toHaveBeenCalledWith([-122.4194, 37.7749]);
      });

      // Update location
      const newLocation: LocationUpdate = {
        coordinates: { lat: 37.7850, lng: -122.4094 },
        accuracy: 20,
        speed: 15,
        timestamp: new Date().toISOString(),
      };

      await act(async () => {
        rerender(
          <DriverLiveMap
            currentLocation={newLocation}
            activeDeliveries={[]}
          />
        );
      });

      await waitFor(() => {
        expect(mockSetLngLat).toHaveBeenCalledWith([-122.4094, 37.7850]);
      });
    });
  });

  describe('Delivery Markers', () => {
    it('should add delivery markers layer when deliveries are provided', async () => {
      render(
        <DriverLiveMap
          currentLocation={mockCurrentLocation}
          activeDeliveries={mockActiveDeliveries}
        />
      );

      // Trigger load
      await act(async () => {
        if (loadCallback) {
          loadCallback();
        }
      });

      await waitFor(() => {
        expect(mockAddSource).toHaveBeenCalledWith(
          'driver-deliveries',
          expect.objectContaining({
            type: 'geojson',
          })
        );
      });
    });

    it('should not add delivery layer when no deliveries exist', async () => {
      render(
        <DriverLiveMap
          currentLocation={mockCurrentLocation}
          activeDeliveries={[]}
        />
      );

      // Trigger load
      await act(async () => {
        if (loadCallback) {
          loadCallback();
        }
      });

      // Wait for initial source to be added, but not driver-deliveries
      await waitFor(() => {
        expect(mockAddSource).toHaveBeenCalledWith('driver-trail', expect.anything());
      });

      // Verify driver-deliveries was not added
      const deliverySourceCalls = mockAddSource.mock.calls.filter(
        (call: any[]) => call[0] === 'driver-deliveries'
      );
      expect(deliverySourceCalls.length).toBe(0);
    });

    it('should remove and recreate delivery layer on deliveries update', async () => {
      mockGetLayer.mockReturnValue(true);

      const { rerender } = render(
        <DriverLiveMap
          currentLocation={mockCurrentLocation}
          activeDeliveries={mockActiveDeliveries}
        />
      );

      // Trigger load
      await act(async () => {
        if (loadCallback) {
          loadCallback();
        }
      });

      // Update deliveries
      const updatedDeliveries: DeliveryTracking[] = [
        {
          id: 'delivery-3',
          status: 'completed',
          deliveryLocation: { coordinates: [-122.3994, 37.7949], type: 'Point' },
          pickupLocation: { coordinates: [-122.4194, 37.7749], type: 'Point' },
        },
      ];

      await act(async () => {
        rerender(
          <DriverLiveMap
            currentLocation={mockCurrentLocation}
            activeDeliveries={updatedDeliveries}
          />
        );
      });

      await waitFor(() => {
        expect(mockRemoveLayer).toHaveBeenCalledWith('driver-deliveries');
      });
    });
  });

  describe('Driver Trail', () => {
    it('should initialize driver trail source on map load', async () => {
      render(
        <DriverLiveMap
          currentLocation={mockCurrentLocation}
          activeDeliveries={[]}
        />
      );

      // Trigger load
      await act(async () => {
        if (loadCallback) {
          loadCallback();
        }
      });

      await waitFor(() => {
        expect(mockAddSource).toHaveBeenCalledWith(
          'driver-trail',
          expect.objectContaining({
            type: 'geojson',
            data: expect.objectContaining({
              type: 'Feature',
              geometry: expect.objectContaining({
                type: 'LineString',
              }),
            }),
          })
        );
      });
    });

    it('should add driver trail line layer', async () => {
      render(
        <DriverLiveMap
          currentLocation={mockCurrentLocation}
          activeDeliveries={[]}
        />
      );

      // Trigger load
      await act(async () => {
        if (loadCallback) {
          loadCallback();
        }
      });

      await waitFor(() => {
        expect(mockAddLayer).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'driver-trail-line',
            type: 'line',
            source: 'driver-trail',
          })
        );
      });
    });

    it('should update trail data when location changes', async () => {
      const mockSetData = jest.fn();
      mockGetSource.mockReturnValue({ setData: mockSetData });

      const { rerender } = render(
        <DriverLiveMap
          currentLocation={mockCurrentLocation}
          activeDeliveries={[]}
        />
      );

      // Trigger load
      await act(async () => {
        if (loadCallback) {
          loadCallback();
        }
      });

      // Update location
      const newLocation: LocationUpdate = {
        coordinates: { lat: 37.7850, lng: -122.4094 },
        accuracy: 20,
        speed: 15,
        timestamp: new Date().toISOString(),
      };

      await act(async () => {
        rerender(
          <DriverLiveMap
            currentLocation={newLocation}
            activeDeliveries={[]}
          />
        );
      });

      await waitFor(() => {
        expect(mockSetData).toHaveBeenCalled();
      });
    });
  });

  describe('Map Animation', () => {
    it('should center on driver location on first location update', async () => {
      render(
        <DriverLiveMap
          currentLocation={mockCurrentLocation}
          activeDeliveries={[]}
        />
      );

      // Trigger load
      await act(async () => {
        if (loadCallback) {
          loadCallback();
        }
      });

      await waitFor(() => {
        expect(mockEaseTo).toHaveBeenCalledWith(
          expect.objectContaining({
            center: [-122.4194, 37.7749],
            zoom: 15,
            duration: 1000,
          })
        );
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup map on unmount', async () => {
      const { unmount } = render(
        <DriverLiveMap
          currentLocation={mockCurrentLocation}
          activeDeliveries={[]}
        />
      );

      unmount();

      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('Props Handling', () => {
    it('should handle null currentLocation', () => {
      expect(() => {
        render(
          <DriverLiveMap
            currentLocation={null}
            activeDeliveries={[]}
          />
        );
      }).not.toThrow();
    });

    it('should handle empty activeDeliveries', () => {
      expect(() => {
        render(
          <DriverLiveMap
            currentLocation={mockCurrentLocation}
            activeDeliveries={[]}
          />
        );
      }).not.toThrow();
    });

    it('should handle deliveries without valid coordinates', async () => {
      const invalidDeliveries: DeliveryTracking[] = [
        {
          id: 'delivery-1',
          status: 'assigned',
          deliveryLocation: { coordinates: [], type: 'Point' },
          pickupLocation: { coordinates: [], type: 'Point' },
        },
      ];

      // Should not throw when rendering with invalid deliveries
      expect(() => {
        render(
          <DriverLiveMap
            currentLocation={mockCurrentLocation}
            activeDeliveries={invalidDeliveries}
          />
        );
      }).not.toThrow();

      // Trigger load
      await act(async () => {
        if (loadCallback) {
          loadCallback();
        }
      });

      // Should not throw - component should handle invalid data gracefully
      // The actual filtering behavior depends on the implementation
    });
  });

  describe('Error Handling', () => {
    it('should capture and log map initialization errors', async () => {
      const { captureException } = require('@/lib/monitoring/sentry');
      const mapboxgl = require('mapbox-gl');

      mapboxgl.Map.mockImplementationOnce(() => {
        throw new Error('Map initialization failed');
      });

      render(
        <DriverLiveMap
          currentLocation={null}
          activeDeliveries={[]}
        />
      );

      expect(captureException).toHaveBeenCalled();
      expect(screen.getByText('Map Error')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <DriverLiveMap
          currentLocation={null}
          activeDeliveries={[]}
        />
      );

      const mapContainer = screen.getByRole('application');
      expect(mapContainer).toHaveAttribute('role', 'application');
      expect(mapContainer).toHaveAttribute('aria-label', 'Driver live map');
    });
  });
});
