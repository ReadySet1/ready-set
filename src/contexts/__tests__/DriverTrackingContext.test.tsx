import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { DriverTrackingProvider } from '../DriverTrackingContext';

// The provider is mounted by the /driver layout, so its effects run on every
// driver page. These tests pin the web GPS auto-resume behaviour: an active
// shift must (re)start the foreground tracker on mount, regardless of which
// driver page the reload/relaunch landed on.

const mockStartTracking = jest.fn();
const mockStopTracking = jest.fn();
const mockRequestLocationPermission = jest.fn().mockResolvedValue(true);

const locationTrackingState: Record<string, unknown> = {};

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
    startTracking: mockStartTracking,
    stopTracking: mockStopTracking,
    requestLocationPermission: mockRequestLocationPermission,
    updateLocationManually: jest.fn(),
    syncOfflineLocations: jest.fn().mockResolvedValue(undefined),
    ...locationTrackingState,
  }),
}));

const shiftState: Record<string, unknown> = {};

jest.mock('@/hooks/tracking/useDriverShift', () => ({
  useDriverShift: () => ({
    currentShift: null,
    isShiftActive: false,
    loading: false,
    error: null,
    startShift: jest.fn(),
    endShift: jest.fn(),
    ...shiftState,
  }),
}));

jest.mock('@/hooks/tracking/useDriverDeliveries', () => ({
  useDriverDeliveries: () => ({
    activeDeliveries: [],
    updateDeliveryStatus: jest.fn(),
    refreshDeliveries: jest.fn(),
    loading: false,
    error: null,
  }),
}));

jest.mock('@/hooks/tracking/useOfflineQueue', () => ({
  useOfflineQueue: () => ({
    offlineStatus: { isOnline: true },
    queuedItems: 0,
  }),
}));

jest.mock('@/lib/tracking/native-shift-tracking', () => ({
  startNativeShiftTrackingForDriver: jest.fn().mockResolvedValue(undefined),
  stopNativeShiftTrackingForDriver: jest.fn().mockResolvedValue(undefined),
}));

function resetState(
  location: Record<string, unknown> = {},
  shift: Record<string, unknown> = {},
) {
  for (const key of Object.keys(locationTrackingState)) delete locationTrackingState[key];
  for (const key of Object.keys(shiftState)) delete shiftState[key];
  Object.assign(locationTrackingState, location);
  Object.assign(shiftState, shift);
}

function renderProvider() {
  return render(
    <DriverTrackingProvider>
      <div>child</div>
    </DriverTrackingProvider>,
  );
}

const activeShift = {
  currentShift: { id: 's1', driverId: 'driver-1', status: 'active', startTime: new Date() },
  isShiftActive: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestLocationPermission.mockResolvedValue(true);
  resetState();
});

describe('DriverTrackingProvider web GPS auto-resume', () => {
  it('starts web tracking once on mount when a shift is active and tracking is off', async () => {
    resetState({ isTracking: false }, activeShift);
    renderProvider();

    await waitFor(() => expect(mockStartTracking).toHaveBeenCalledTimes(1));
    expect(mockRequestLocationPermission).not.toHaveBeenCalled();
  });

  it('requests permission first when it is not yet granted, then starts tracking', async () => {
    resetState({ isTracking: false, permissionState: 'prompt' }, activeShift);
    renderProvider();

    await waitFor(() => expect(mockStartTracking).toHaveBeenCalledTimes(1));
    expect(mockRequestLocationPermission).toHaveBeenCalledTimes(1);
  });

  it('does not start tracking when permission is refused', async () => {
    mockRequestLocationPermission.mockResolvedValue(false);
    resetState({ isTracking: false, permissionState: 'prompt' }, activeShift);
    renderProvider();

    await waitFor(() => expect(mockRequestLocationPermission).toHaveBeenCalledTimes(1));
    expect(mockStartTracking).not.toHaveBeenCalled();
  });

  it('never starts tracking when no shift is active', async () => {
    resetState({ isTracking: false }, { isShiftActive: false, currentShift: null });
    renderProvider();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockStartTracking).not.toHaveBeenCalled();
  });

  it('does not start tracking again when it is already running', async () => {
    resetState({ isTracking: true }, activeShift);
    renderProvider();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockStartTracking).not.toHaveBeenCalled();
  });

  it('waits while the shift is still loading', async () => {
    resetState({ isTracking: false }, { ...activeShift, loading: true });
    renderProvider();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockStartTracking).not.toHaveBeenCalled();
  });

  it('waits while a permission request is already in flight', async () => {
    resetState({ isTracking: false, isRequestingPermission: true }, activeShift);
    renderProvider();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockStartTracking).not.toHaveBeenCalled();
    expect(mockRequestLocationPermission).not.toHaveBeenCalled();
  });
});
