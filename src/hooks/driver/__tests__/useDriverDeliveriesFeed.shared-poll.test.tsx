/**
 * The driver home mounts two consumers of `/api/driver-deliveries`: the layout's
 * DriverTrackingProvider (Live-Tracking tab, detail page, shift pill) and the
 * page's useDriverDeliveriesFeed (deliveries list + "N active" card). Both used
 * to run their own poller, so every mount, 60s tick and tab focus fired the
 * request twice on the driver's phone. These tests pin ONE request per trigger
 * serving both consumers.
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { DriverTrackingProvider, useDriverTracking } from '@/contexts/DriverTrackingContext';
import { useDriverDeliveriesFeed } from '@/hooks/driver/useDriverDeliveriesFeed';

jest.mock('@/hooks/tracking/useRealtimeLocationTracking', () => ({
  useRealtimeLocationTracking: () => ({
    currentLocation: null,
    isTracking: false,
    accuracy: null,
    error: null,
    isRealtimeConnected: false,
    isRealtimeEnabled: false,
    connectionMode: 'rest',
    permissionState: 'granted',
    isRequestingPermission: false,
    startTracking: jest.fn(),
    stopTracking: jest.fn(),
    requestLocationPermission: jest.fn().mockResolvedValue(true),
    updateLocationManually: jest.fn(),
    syncOfflineLocations: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('@/hooks/tracking/useDriverShift', () => ({
  useDriverShift: () => ({
    currentShift: null,
    isShiftActive: false,
    loading: false,
    error: null,
    startShift: jest.fn(),
    endShift: jest.fn(),
  }),
}));

jest.mock('@/hooks/tracking/useOfflineQueue', () => ({
  useOfflineQueue: () => ({ offlineStatus: { isOnline: true }, queuedItems: 0 }),
}));

jest.mock('@/lib/tracking/native-shift-tracking', () => ({
  startNativeShiftTrackingForDriver: jest.fn().mockResolvedValue(undefined),
  stopNativeShiftTrackingForDriver: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
  }),
}));

jest.mock('@/lib/monitoring/sentry', () => ({
  captureException: jest.fn(),
  addSentryBreadcrumb: jest.fn(),
}));

const FEED_URL = '/api/driver-deliveries?page=1&limit=999';

const row = (orderNumber: string) => ({
  id: `id-${orderNumber}`,
  orderNumber,
  delivery_type: 'catering',
  status: 'ACTIVE',
  driverStatus: 'ASSIGNED',
  pickupDateTime: '2024-01-01T00:00:00Z',
  completeDateTime: null,
  order_total: 100,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  address: { latitude: 37.77, longitude: -122.41 },
  delivery_address: { latitude: 37.78, longitude: -122.4 },
});

/** What the page's hook renders: the list ids and the "N active" count. */
function FeedProbe() {
  const feed = useDriverDeliveriesFeed();
  return (
    <div data-testid="feed">
      {feed.loading ? 'loading' : feed.deliveries.map((d) => d.orderNumber).join(',')}|
      {feed.activeCount}|{feed.error ?? ''}
    </div>
  );
}

/** What the provider's consumers (portal, detail, shift pill) render. */
function TrackingProbe() {
  const { activeDeliveries } = useDriverTracking();
  return <div data-testid="tracking">{activeDeliveries.map((d) => d.id).join(',')}</div>;
}

const deliveriesCalls = () =>
  (global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url) === FEED_URL);

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
};

const flush = async () => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
};

let deliveriesResponse: () => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const ok = (rows: unknown[]) => async () => ({
  ok: true,
  status: 200,
  json: async () => ({ deliveries: rows }),
});

const serverError = async () => ({ ok: false, status: 500, json: async () => ({}) });

function renderTree() {
  return render(
    <DriverTrackingProvider>
      <FeedProbe />
      <TrackingProbe />
    </DriverTrackingProvider>,
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  setHidden(false);
  deliveriesResponse = ok([row('CAT-1')]);
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    if (String(input) === FEED_URL) return deliveriesResponse();
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
  setHidden(false);
  jest.clearAllMocks();
});

describe('driver home deliveries feed is polled once for both consumers', () => {
  it('fires ONE request per trigger: mount, 60s tick, and tab focus', async () => {
    renderTree();
    await flush();

    expect(deliveriesCalls()).toHaveLength(1);
    expect(screen.getByTestId('feed')).toHaveTextContent('CAT-1|1|');
    expect(screen.getByTestId('tracking')).toHaveTextContent('CAT-1');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(deliveriesCalls()).toHaveLength(2);

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(deliveriesCalls()).toHaveLength(3);
  });

  it('serves a refreshed payload to both consumers from the same single request', async () => {
    renderTree();
    await flush();

    deliveriesResponse = ok([row('CAT-1'), row('CAT-2')]);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });

    expect(deliveriesCalls()).toHaveLength(2);
    expect(screen.getByTestId('feed')).toHaveTextContent('CAT-1,CAT-2|2|');
    expect(screen.getByTestId('tracking')).toHaveTextContent('CAT-1,CAT-2');
  });

  it('keeps the last good list on Home when a background poll fails', async () => {
    renderTree();
    await flush();
    expect(screen.getByTestId('feed')).toHaveTextContent('CAT-1|1|');

    deliveriesResponse = serverError;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });

    expect(deliveriesCalls()).toHaveLength(2);
    expect(screen.getByTestId('feed')).toHaveTextContent('CAT-1|1|');
  });

  it('shows the error on Home only when the very first load fails', async () => {
    deliveriesResponse = serverError;
    renderTree();
    await flush();

    expect(screen.getByTestId('feed')).toHaveTextContent('|0|Failed to load deliveries (500)');
  });
});
