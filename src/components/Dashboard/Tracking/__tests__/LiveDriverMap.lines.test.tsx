import React from 'react';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import mapboxgl from 'mapbox-gl';
import LiveDriverMap from '../LiveDriverMap';
import type { TrackedDriver, DeliveryTracking } from '@/types/tracking';

jest.mock('@/hooks/tracking/useTrackingSettings', () => ({
  TRACKING_SETTINGS_QUERY_KEY: ['tracking-settings'],
  useTrackingSettings: () => ({
    settings: jest.requireActual('@/types/tracking-settings').TRACKING_SETTINGS_DEFAULTS,
    isLoaded: true,
  }),
}));
jest.mock('mapbox-gl');

const driver = {
  id: 'driver-1',
  employeeId: 'EMP001',
  name: 'Fernando',
  isOnDuty: true,
  currentShiftId: 'shift-1',
  lastKnownLocation: { coordinates: [-101.6, 21.12] as [number, number] },
  metadata: {},
} as unknown as TrackedDriver;

const delivery = {
  id: 'delivery-1',
  driverId: 'driver-1',
  cateringRequestId: 'cr-1',
  orderNumber: 'Test 0821262',
  status: 'ASSIGNED',
  pickupLocation: { coordinates: [-101.60, 21.10] as [number, number] },
  deliveryLocation: { coordinates: [-101.70, 21.20] as [number, number] },
  route: [],
  metadata: {},
} as unknown as DeliveryTracking;

const ping = (lng: number, lat: number, at: string) => ({
  driverId: 'driver-1',
  location: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] },
  accuracy: 5,
  speed: 1,
  heading: 0,
  isMoving: true,
  activityType: 'walking' as const,
  recordedAt: at,
});

const trailResponse = {
  success: true,
  data: {
    shiftId: 'shift-1',
    driverId: 'driver-1',
    trail: { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-101.5, 21.1], [-101.55, 21.11]] }, properties: { pointCount: 2 } },
    pointCount: 2,
  },
};

const directionsResponse = {
  routes: [{ geometry: { type: 'LineString', coordinates: [[-101.6, 21.1], [-101.65, 21.15], [-101.7, 21.2]] }, distance: 1609 }],
};

const jsonResponse = (body: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) } as Response);

function loadMap() {
  const mockMap = (mapboxgl.Map as jest.Mock).mock.results.at(-1)!.value;
  const loadCallback = mockMap.on.mock.calls.find((call: any[]) => call[0] === 'load')[1];
  act(() => loadCallback());
  return mockMap;
}

let fetchMock: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.valid-token';
  fetchMock = jest.fn((url: string) => {
    if (String(url).includes('/api/tracking/shifts/')) return jsonResponse(trailResponse);
    if (String(url).includes('api.mapbox.com/directions')) return jsonResponse(directionsResponse);
    return jsonResponse({}, false);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('LiveDriverMap trails', () => {
  it('fetches the active shift trail once and draws a line source + layer per driver', async () => {
    const { rerender } = render(
      <LiveDriverMap drivers={[driver]} deliveries={[]} recentLocations={[]} />,
    );
    const map = loadMap();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/tracking/shifts/shift-1/trail', expect.anything());
    });
    await waitFor(() => {
      expect(map.addSource).toHaveBeenCalledWith(
        'trail-driver-1',
        expect.objectContaining({ type: 'geojson' }),
      );
    });
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'trail-driver-1', type: 'line', source: 'trail-driver-1' }));

    // A re-render with the same driver must not refetch the trail.
    rerender(<LiveDriverMap drivers={[{ ...driver }]} deliveries={[]} recentLocations={[]} />);
    const trailCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/trail'));
    expect(trailCalls).toHaveLength(1);
  });

  it('appends realtime pings to the trail source without refetching', async () => {
    const setData = jest.fn();
    const { rerender } = render(
      <LiveDriverMap drivers={[driver]} deliveries={[]} recentLocations={[]} />,
    );
    const map = loadMap();
    await waitFor(() => expect(map.addSource).toHaveBeenCalledWith('trail-driver-1', expect.anything()));
    map.getSource.mockImplementation((id: string) => (id === 'trail-driver-1' ? { setData } : undefined));

    rerender(
      <LiveDriverMap
        drivers={[driver]}
        deliveries={[]}
        recentLocations={[ping(-101.58, 21.115, '2026-08-21T19:05:00Z')]}
      />,
    );

    await waitFor(() => {
      expect(setData).toHaveBeenCalledWith(
        expect.objectContaining({
          geometry: expect.objectContaining({
            coordinates: [[-101.5, 21.1], [-101.55, 21.11], [-101.58, 21.115]],
          }),
        }),
      );
    });
    const trailCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/trail'));
    expect(trailCalls).toHaveLength(1);
  });

  it('removes the trail layer and source when the driver drops off the map', async () => {
    const { rerender } = render(
      <LiveDriverMap drivers={[driver]} deliveries={[]} recentLocations={[]} />,
    );
    const map = loadMap();
    await waitFor(() => expect(map.addSource).toHaveBeenCalledWith('trail-driver-1', expect.anything()));
    map.getLayer.mockImplementation((id: string) => (id === 'trail-driver-1' ? {} : undefined));
    map.getSource.mockImplementation((id: string) => (id === 'trail-driver-1' ? { setData: jest.fn() } : undefined));

    rerender(<LiveDriverMap drivers={[]} deliveries={[]} recentLocations={[]} />);

    await waitFor(() => {
      expect(map.removeLayer).toHaveBeenCalledWith('trail-driver-1');
      expect(map.removeSource).toHaveBeenCalledWith('trail-driver-1');
    });
  });

  it('hides trails when the legend toggle is switched off', async () => {
    render(<LiveDriverMap drivers={[driver]} deliveries={[]} recentLocations={[]} />);
    const map = loadMap();
    await waitFor(() => expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'trail-driver-1' })));
    map.getLayer.mockImplementation((id: string) => (id === 'trail-driver-1' ? {} : undefined));

    const toggle = screen.getByRole('checkbox', { name: /show trails/i });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(map.setLayoutProperty).toHaveBeenCalledWith('trail-driver-1', 'visibility', 'none');
    });
  });

  it('never throws when the trail request fails', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('network down')));
    render(<LiveDriverMap drivers={[driver]} deliveries={[]} recentLocations={[]} />);
    const map = loadMap();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(map.addSource).not.toHaveBeenCalledWith('trail-driver-1', expect.anything());
    expect(screen.getByRole('application')).toBeInTheDocument();
  });
});

describe('LiveDriverMap planned routes', () => {
  it('requests Mapbox Directions once per delivery and draws a dashed route layer', async () => {
    const { rerender } = render(
      <LiveDriverMap drivers={[driver]} deliveries={[delivery]} recentLocations={[]} />,
    );
    const map = loadMap();

    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('api.mapbox.com/directions/v5/mapbox/driving/'));
      expect(call).toBeDefined();
      expect(String(call![0])).toContain('-101.6,21.1;-101.7,21.2');
      expect(String(call![0])).toMatch(/access_token=pk\./);
    });
    await waitFor(() => {
      expect(map.addSource).toHaveBeenCalledWith('route-delivery-1', expect.objectContaining({ type: 'geojson' }));
    });
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'route-delivery-1',
        type: 'line',
        paint: expect.objectContaining({ 'line-dasharray': expect.any(Array) }),
      }),
    );

    rerender(<LiveDriverMap drivers={[driver]} deliveries={[{ ...delivery }]} recentLocations={[]} />);
    const directionCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('directions'));
    expect(directionCalls).toHaveLength(1);
  });

  it('draws nothing and does not throw when Directions fails', async () => {
    fetchMock.mockImplementation((url: string) =>
      String(url).includes('directions') ? jsonResponse({ message: 'boom' }, false) : jsonResponse(trailResponse),
    );
    render(<LiveDriverMap drivers={[driver]} deliveries={[delivery]} recentLocations={[]} />);
    const map = loadMap();
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('directions'))).toBe(true));
    await act(async () => { await Promise.resolve(); });
    expect(map.addSource).not.toHaveBeenCalledWith('route-delivery-1', expect.anything());
  });

  it('removes the route when the delivery leaves the list', async () => {
    const { rerender } = render(
      <LiveDriverMap drivers={[driver]} deliveries={[delivery]} recentLocations={[]} />,
    );
    const map = loadMap();
    await waitFor(() => expect(map.addSource).toHaveBeenCalledWith('route-delivery-1', expect.anything()));
    map.getLayer.mockImplementation((id: string) => (id === 'route-delivery-1' ? {} : undefined));
    map.getSource.mockImplementation((id: string) => (id === 'route-delivery-1' ? {} : undefined));

    rerender(<LiveDriverMap drivers={[driver]} deliveries={[]} recentLocations={[]} />);

    await waitFor(() => {
      expect(map.removeLayer).toHaveBeenCalledWith('route-delivery-1');
      expect(map.removeSource).toHaveBeenCalledWith('route-delivery-1');
    });
  });

  it('exposes a "Show routes" legend toggle that is on by default', () => {
    render(<LiveDriverMap drivers={[driver]} deliveries={[delivery]} recentLocations={[]} />);
    expect(screen.getByRole('checkbox', { name: /show routes/i })).toBeChecked();
  });
});

describe('LiveDriverMap popup links', () => {
  it('includes the order link for the driver with an active delivery', async () => {
    render(<LiveDriverMap drivers={[driver]} deliveries={[delivery]} recentLocations={[]} />);
    loadMap();
    await waitFor(() => expect(mapboxgl.Popup).toHaveBeenCalled());
    const popup = (mapboxgl.Popup as jest.Mock).mock.results[0].value;
    const html = String(popup.setHTML.mock.calls.at(-1)?.[0]);
    expect(html).toContain('href="/admin/catering-orders/Test%200821262"');
    expect(html).toContain('href="/admin/drivers/driver-1/history"');
  });

  it('omits the order link when the driver has no active delivery', async () => {
    render(<LiveDriverMap drivers={[driver]} deliveries={[]} recentLocations={[]} />);
    loadMap();
    await waitFor(() => expect(mapboxgl.Popup).toHaveBeenCalled());
    const popup = (mapboxgl.Popup as jest.Mock).mock.results[0].value;
    const html = String(popup.setHTML.mock.calls.at(-1)?.[0]);
    expect(html).not.toContain('View order');
  });
});
