/**
 * Tests for the native-shift-tracking adapter. The regression under test: the
 * adapter used to resolve the driver id up-front and silently bail when
 * /api/auth/session failed (expired server session at shift start), leaving
 * the native watcher unarmed for the whole shift. It must now always arm and
 * hand the bridge a lazy resolver instead.
 */

const mockStartBridge = jest.fn();
const mockStopBridge = jest.fn();
const mockResolveIssue = jest.fn();
const mockRefresh = jest.fn();

jest.mock('../capacitor-tracking', () => ({
  startNativeShiftTracking: (...args: unknown[]) => mockStartBridge(...args),
  stopNativeShiftTracking: (...args: unknown[]) => mockStopBridge(...args),
  resolveLocationIssue: (...args: unknown[]) => mockResolveIssue(...args),
  refreshNativeLocationPermission: (...args: unknown[]) => mockRefresh(...args),
}));

jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: jest
        .fn()
        .mockResolvedValue({ data: { session: { access_token: 'tok-1' } } }),
    },
  }),
}));

import {
  checkNativeLocationPermission,
  isCapacitorNative,
  resolveNativeLocationIssue,
  retryNativeShiftTracking,
  startNativeShiftTrackingForDriver,
  stopNativeShiftTrackingForDriver,
} from '../native-shift-tracking';

type CapacitorWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
};

const fetchMock = jest.fn();

describe('native-shift-tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    delete (window as CapacitorWindow).Capacitor;
  });

  function enterNativeShell() {
    (window as CapacitorWindow).Capacitor = { isNativePlatform: () => true };
  }

  it('no-ops entirely in a plain browser', async () => {
    expect(isCapacitorNative()).toBe(false);
    await startNativeShiftTrackingForDriver();
    await stopNativeShiftTrackingForDriver();
    expect(mockStartBridge).not.toHaveBeenCalled();
    expect(mockStopBridge).not.toHaveBeenCalled();
  });

  it('arms the bridge even when the driver-id lookup is failing (401)', async () => {
    enterNativeShell();
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    await startNativeShiftTrackingForDriver();

    expect(mockStartBridge).toHaveBeenCalledTimes(1);
    const passed = mockStartBridge.mock.calls[0]![0];
    // The lazy resolver reflects the current session state on each call.
    await expect(passed.getDriverId()).resolves.toBeNull();
    await expect(passed.getAccessToken()).resolves.toBe('tok-1');
  });

  it('hands the bridge a resolver that returns the driver id once the session heals', async () => {
    enterNativeShell();
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { driverId: 'driver-9' } }),
      });

    await startNativeShiftTrackingForDriver();
    const passed = mockStartBridge.mock.calls[0]![0];

    await expect(passed.getDriverId()).resolves.toBeNull(); // still broken
    await expect(passed.getDriverId()).resolves.toBe('driver-9'); // healed
  });

  it('stops the bridge inside the native shell', async () => {
    enterNativeShell();
    await stopNativeShiftTrackingForDriver();
    expect(mockStopBridge).toHaveBeenCalledTimes(1);
  });

  it('runs the location-issue action and retries inside the native shell only', async () => {
    await resolveNativeLocationIssue();
    await retryNativeShiftTracking();
    expect(mockResolveIssue).not.toHaveBeenCalled();
    expect(mockStartBridge).not.toHaveBeenCalled();

    enterNativeShell();
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    await resolveNativeLocationIssue();
    expect(mockResolveIssue).toHaveBeenCalledTimes(1);

    await retryNativeShiftTracking();
    expect(mockStartBridge).toHaveBeenCalledTimes(1);
  });

  it('only reads the native permission inside the native shell', async () => {
    await expect(checkNativeLocationPermission({ explain: true })).resolves.toBeNull();
    expect(mockRefresh).not.toHaveBeenCalled();

    enterNativeShell();
    mockRefresh.mockResolvedValue('granted');
    await expect(checkNativeLocationPermission({ explain: false })).resolves.toBe('granted');
    expect(mockRefresh).toHaveBeenCalledWith({ explain: false });
  });

  it('treats a bridge failure as "no native answer"', async () => {
    enterNativeShell();
    mockRefresh.mockRejectedValue(new Error('boom'));
    await expect(checkNativeLocationPermission({ explain: true })).resolves.toBeNull();
  });
});
