/**
 * Tests for the Capacitor background-GPS bridge — specifically the lazy,
 * self-healing driver-id resolution: a failed lookup at shift start (e.g. an
 * expired server session returning 401) must not disable background tracking
 * for the whole shift.
 */

let mockIsNative = true;
const mockAddWatcher = jest.fn();
const mockRemoveWatcher = jest.fn();
const mockOpenSettings = jest.fn();

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockIsNative },
  registerPlugin: () => ({
    addWatcher: (...args: unknown[]) => mockAddWatcher(...args),
    removeWatcher: (...args: unknown[]) => mockRemoveWatcher(...args),
    openSettings: (...args: unknown[]) => mockOpenSettings(...args),
  }),
}));

type Bridge = typeof import('../capacitor-tracking');
type WatcherCallback = (
  location?: Record<string, unknown>,
  error?: { code?: string },
) => Promise<void>;

describe('capacitor-tracking', () => {
  let bridge: Bridge;
  let nowMs: number;
  let watcherCallback: WatcherCallback;

  const fetchMock = jest.fn();

  const fix = {
    latitude: 19.41,
    longitude: -99.19,
    accuracy: 5,
    speed: 0,
    bearing: null,
    altitude: null,
  };

  function session(overrides: Record<string, unknown> = {}) {
    return {
      getDriverId: jest.fn().mockResolvedValue('driver-1'),
      getAccessToken: jest.fn().mockResolvedValue('token-1'),
      ...overrides,
    };
  }

  /** Fire one watcher fix with the 5s post throttle already cleared. */
  async function emitFix() {
    nowMs += 5_001;
    await watcherCallback(fix, undefined);
  }

  function postedBody(callIndex = 0): Record<string, unknown> {
    return JSON.parse(fetchMock.mock.calls[callIndex]![1].body as string);
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockIsNative = true;
    nowMs = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => nowMs);
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockResolvedValue({ ok: true });
    mockAddWatcher.mockImplementation((_opts: unknown, cb: WatcherCallback) => {
      watcherCallback = cb;
      return Promise.resolve('watcher-1');
    });
    mockRemoveWatcher.mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    bridge = require('../capacitor-tracking');
  });

  afterEach(() => {
    (Date.now as jest.Mock).mockRestore();
  });

  it('arms the watcher even when the driver id cannot resolve yet', async () => {
    const s = session({ getDriverId: jest.fn().mockResolvedValue(null) });
    await bridge.startNativeShiftTracking(s);
    expect(mockAddWatcher).toHaveBeenCalledTimes(1);
  });

  it('posts a fix with the resolved driver id and bearer token', async () => {
    await bridge.startNativeShiftTracking(session());
    await emitFix();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tracking/locations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
      }),
    );
    expect(postedBody().driver_id).toBe('driver-1');
  });

  it('retries the driver-id lookup on later fixes until it succeeds, then caches it', async () => {
    const getDriverId = jest
      .fn()
      .mockResolvedValueOnce(null) // shift started with a broken session
      .mockResolvedValueOnce('driver-1'); // session healed
    await bridge.startNativeShiftTracking(session({ getDriverId }));

    await emitFix(); // unresolved → skipped, no post
    expect(fetchMock).not.toHaveBeenCalled();

    await emitFix(); // resolves now → posts
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await emitFix(); // cached → no further lookups
    expect(getDriverId).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips the fix without a driver-id lookup when signed out', async () => {
    const s = session({ getAccessToken: jest.fn().mockResolvedValue(null) });
    await bridge.startNativeShiftTracking(s);
    await emitFix();

    expect(s.getDriverId).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is idempotent while running and clears the cached driver id on stop', async () => {
    const s = session();
    await bridge.startNativeShiftTracking(s);
    await bridge.startNativeShiftTracking(s);
    expect(mockAddWatcher).toHaveBeenCalledTimes(1);

    await bridge.stopNativeShiftTracking();
    expect(mockRemoveWatcher).toHaveBeenCalledWith({ id: 'watcher-1' });

    const s2 = session({ getDriverId: jest.fn().mockResolvedValue('driver-2') });
    await bridge.startNativeShiftTracking(s2);
    await emitFix();
    expect(postedBody().driver_id).toBe('driver-2');
  });
});
