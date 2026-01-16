// src/components/Orders/ui/__tests__/OrderLocationMap.test.tsx
/**
 * Unit tests for OrderLocationMap component (REA-307)
 *
 * Tests cover:
 * - Rendering with various coordinate combinations
 * - Marker creation for pickup, delivery, and driver locations
 * - Error handling when Mapbox token is missing
 * - Graceful fallback when no coordinates available
 * - Map initialization and cleanup
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Mock Mapbox GL before importing component
const mockMapInstance = {
  addControl: jest.fn(),
  on: jest.fn((event: string, callback: () => void) => {
    if (event === 'load') {
      // Simulate map load after a tick
      setTimeout(() => callback(), 0);
    }
  }),
  remove: jest.fn(),
  fitBounds: jest.fn(),
  getSource: jest.fn(),
  addSource: jest.fn(),
  addLayer: jest.fn(),
};

const mockMarkerInstance = {
  setLngLat: jest.fn().mockReturnThis(),
  setPopup: jest.fn().mockReturnThis(),
  addTo: jest.fn().mockReturnThis(),
  remove: jest.fn(),
};

const mockPopupInstance = {
  setHTML: jest.fn().mockReturnThis(),
};

const mockLngLatBoundsInstance = {
  extend: jest.fn().mockReturnThis(),
  isEmpty: jest.fn().mockReturnValue(false),
};

jest.mock('mapbox-gl', () => ({
  Map: jest.fn(() => mockMapInstance),
  Marker: jest.fn(() => mockMarkerInstance),
  Popup: jest.fn(() => mockPopupInstance),
  NavigationControl: jest.fn(),
  LngLatBounds: jest.fn(() => mockLngLatBoundsInstance),
  accessToken: '',
}));

// Mock Sentry monitoring
jest.mock('@/lib/monitoring/sentry', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addSentryBreadcrumb: jest.fn(),
}));

// Mock CSS import
jest.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}));

import OrderLocationMap from '../OrderLocationMap';
import mapboxgl from 'mapbox-gl';
import { captureException, captureMessage, addSentryBreadcrumb } from '@/lib/monitoring/sentry';
import type { Address } from '@/types/order';

// Test data helpers
const createMockAddress = (overrides: Partial<Address> = {}): Address => ({
  id: 'addr-1',
  street1: '123 Main St',
  street2: null,
  city: 'San Francisco',
  state: 'CA',
  zip: '94102',
  county: 'San Francisco',
  locationNumber: null,
  parkingLoading: null,
  isRestaurant: false,
  isShared: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  latitude: 37.7749,
  longitude: -122.4194,
  ...overrides,
});

const mockPickupAddress = createMockAddress({
  id: 'pickup-1',
  street1: '100 Pickup Lane',
  city: 'San Francisco',
  latitude: 37.7849,
  longitude: -122.4094,
});

const mockDeliveryAddress = createMockAddress({
  id: 'delivery-1',
  street1: '200 Delivery Ave',
  city: 'Oakland',
  latitude: 37.8044,
  longitude: -122.2712,
});

const mockDriverLocation = {
  lat: 37.7949,
  lng: -122.3994,
};

describe('OrderLocationMap', () => {
  // Store original env
  const originalEnv = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set valid token by default
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test_valid_token';
    // Reset mapbox accessToken
    (mapboxgl as any).accessToken = 'pk.test_valid_token';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = originalEnv;
  });

  describe('Rendering', () => {
    it('renders placeholder when no coordinates are available', () => {
      const addressWithoutCoords = createMockAddress({
        latitude: null,
        longitude: null,
      });

      render(
        <OrderLocationMap
          pickupAddress={addressWithoutCoords}
          deliveryAddress={addressWithoutCoords}
        />
      );

      expect(screen.getByText('No location coordinates available')).toBeInTheDocument();
    });

    it('renders placeholder when addresses are null', () => {
      render(
        <OrderLocationMap
          pickupAddress={null}
          deliveryAddress={null}
        />
      );

      expect(screen.getByText('No location coordinates available')).toBeInTheDocument();
    });

    it('renders map container when pickup coordinates are available', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={null}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('application')).toBeInTheDocument();
      });
    });

    it('renders map container when delivery coordinates are available', async () => {
      render(
        <OrderLocationMap
          pickupAddress={null}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('application')).toBeInTheDocument();
      });
    });

    it('renders map with both pickup and delivery addresses', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('application')).toBeInTheDocument();
      });

      expect(mapboxgl.Map).toHaveBeenCalled();
    });

    it('applies custom className', () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
          className="custom-class"
        />
      );

      const container = screen.getByRole('application').parentElement;
      expect(container).toHaveClass('custom-class');
    });

    it('applies custom height', () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
          height="400px"
        />
      );

      const container = screen.getByRole('application').parentElement;
      expect(container).toHaveStyle({ height: '400px' });
    });
  });

  describe('Map Initialization', () => {
    it('initializes Mapbox with correct options', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      await waitFor(() => {
        expect(mapboxgl.Map).toHaveBeenCalledWith(
          expect.objectContaining({
            style: 'mapbox://styles/mapbox/streets-v12',
            attributionControl: false,
          })
        );
      });
    });

    it('adds navigation controls when showNavigationControls is true', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
          showNavigationControls={true}
        />
      );

      await waitFor(() => {
        expect(mockMapInstance.addControl).toHaveBeenCalled();
      });
    });

    it('does not add navigation controls when showNavigationControls is false', async () => {
      jest.clearAllMocks();

      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
          showNavigationControls={false}
        />
      );

      await waitFor(() => {
        expect(mapboxgl.Map).toHaveBeenCalled();
      });

      expect(mockMapInstance.addControl).not.toHaveBeenCalled();
    });

    it('logs breadcrumb when map loads', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      await waitFor(() => {
        expect(addSentryBreadcrumb).toHaveBeenCalledWith(
          'Order location map loaded',
          expect.objectContaining({ feature: 'order-location-map' })
        );
      });
    });

    it('centers map on pickup address when available', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={null}
        />
      );

      await waitFor(() => {
        expect(mapboxgl.Map).toHaveBeenCalledWith(
          expect.objectContaining({
            center: [mockPickupAddress.longitude, mockPickupAddress.latitude],
          })
        );
      });
    });

    it('centers map on delivery address when pickup not available', async () => {
      render(
        <OrderLocationMap
          pickupAddress={null}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      await waitFor(() => {
        expect(mapboxgl.Map).toHaveBeenCalledWith(
          expect.objectContaining({
            center: [mockDeliveryAddress.longitude, mockDeliveryAddress.latitude],
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error when Mapbox token is not configured', async () => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = '';

      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Map Unavailable')).toBeInTheDocument();
      });

      expect(captureMessage).toHaveBeenCalledWith(
        'Mapbox token not configured.',
        'warning',
        expect.any(Object)
      );
    });

    it('shows error when Mapbox token is placeholder', async () => {
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'YOUR_MAPBOX_TOKEN_HERE';

      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Map Unavailable')).toBeInTheDocument();
      });
    });
  });

  describe('Legend', () => {
    it('shows pickup in legend when pickup coordinates are available', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={null}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Pickup')).toBeInTheDocument();
      });
    });

    it('shows delivery in legend when delivery coordinates are available', async () => {
      render(
        <OrderLocationMap
          pickupAddress={null}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Delivery')).toBeInTheDocument();
      });
    });

    it('shows driver in legend when driver location is provided', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
          driverLocation={mockDriverLocation}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Driver')).toBeInTheDocument();
      });
    });

    it('shows all markers in legend when all locations provided', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
          driverLocation={mockDriverLocation}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Pickup')).toBeInTheDocument();
        expect(screen.getByText('Delivery')).toBeInTheDocument();
        expect(screen.getByText('Driver')).toBeInTheDocument();
      });
    });
  });

  describe('Marker Creation', () => {
    it('creates markers for pickup and delivery addresses', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      // Wait for map to load and markers to be created
      await waitFor(() => {
        // Two markers should be created (pickup + delivery)
        expect(mapboxgl.Marker).toHaveBeenCalledTimes(2);
      });
    });

    it('creates popup for each marker', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      await waitFor(() => {
        // Two popups should be created
        expect(mapboxgl.Popup).toHaveBeenCalledTimes(2);
      });
    });

    it('fits bounds to include all markers', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      await waitFor(() => {
        expect(mockLngLatBoundsInstance.extend).toHaveBeenCalled();
        expect(mockMapInstance.fitBounds).toHaveBeenCalled();
      });
    });
  });

  describe('Driver Location', () => {
    it('creates driver marker when driver location is provided', async () => {
      jest.clearAllMocks();

      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
          driverLocation={mockDriverLocation}
        />
      );

      await waitFor(() => {
        // Three markers: pickup + delivery + driver
        expect(mapboxgl.Marker).toHaveBeenCalledTimes(3);
      });
    });

    it('extends bounds to include driver location', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
          driverLocation={mockDriverLocation}
        />
      );

      await waitFor(() => {
        // Should extend bounds 3 times (pickup, delivery, driver)
        expect(mockLngLatBoundsInstance.extend).toHaveBeenCalledTimes(3);
      });
    });

    it('renders with only driver location', async () => {
      const addressWithoutCoords = createMockAddress({
        latitude: null,
        longitude: null,
      });

      render(
        <OrderLocationMap
          pickupAddress={addressWithoutCoords}
          deliveryAddress={addressWithoutCoords}
          driverLocation={mockDriverLocation}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('application')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-label on map container', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Order location map')).toBeInTheDocument();
      });
    });

    it('has application role on map container', async () => {
      render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('application')).toBeInTheDocument();
      });
    });
  });

  describe('Cleanup', () => {
    it('removes map on unmount', async () => {
      const { unmount } = render(
        <OrderLocationMap
          pickupAddress={mockPickupAddress}
          deliveryAddress={mockDeliveryAddress}
        />
      );

      await waitFor(() => {
        expect(mapboxgl.Map).toHaveBeenCalled();
      });

      unmount();

      expect(mockMapInstance.remove).toHaveBeenCalled();
    });
  });
});
