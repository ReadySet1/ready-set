/**
 * Tests for the Capacitor background-GPS bridge — specifically the lazy,
 * self-healing driver-id resolution: a failed lookup at shift start (e.g. an
 * expired server session returning 401) must not disable background tracking
 * for the whole shift.
 */

let mockIsNative = true;
let mockPlatform = 'android';
const mockAddWatcher = jest.fn();
const mockRemoveWatcher = jest.fn();
const mockOpenSettings = jest.fn();
const mockCheckPermissions = jest.fn();
const mockRequestPermissions = jest.fn();

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mockIsNative,
    getPlatform: () => mockPlatform,
  },
  registerPlugin: () => ({
    addWatcher: (...args: unknown[]) => mockAddWatcher(...args),
    removeWatcher: (...args: unknown[]) => mockRemoveWatcher(...args),
    openSettings: (...args: unknown[]) => mockOpenSettings(...args),
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
    requestPermissions: (...args: unknown[]) => mockRequestPermissions(...args),
  }),
}));

type Bridge = typeof import('../capacitor-tracking');
type IssueStore = typeof import('../native-location-issue');
type WatcherCallback = (
  location?: Record<string, unknown>,
  error?: { code?: string; message?: string },
) => Promise<void>;

describe('capacitor-tracking', () => {
  let bridge: Bridge;
  let issues: IssueStore;
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
  async function emitFix(overrides: Record<string, unknown> = {}) {
    nowMs += 5_001;
    await watcherCallback({ ...fix, ...overrides }, undefined);
  }

  function postedBody(callIndex = 0): Record<string, unknown> {
    return JSON.parse(fetchMock.mock.calls[callIndex]![1].body as string);
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockIsNative = true;
    mockPlatform = 'android';
    mockCheckPermissions.mockResolvedValue({ location: 'granted' });
    mockRequestPermissions.mockResolvedValue({ location: 'granted' });
    window.localStorage.clear();
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    issues = require('../native-location-issue');
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

  it('sends the device send time so the server can measure clock skew', async () => {
    await bridge.startNativeShiftTracking(session());
    await emitFix();

    expect(postedBody().client_sent_at).toBe(nowMs);
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

  describe('is_moving hysteresis (finding #5)', () => {
    async function isMovingAfter(speeds: Array<number | null>) {
      await bridge.startNativeShiftTracking(session());
      for (const speed of speeds) await emitFix({ speed });
      return fetchMock.mock.calls.map((_, i) => postedBody(i).is_moving);
    }

    it('flags moving only after two consecutive vehicle-speed fixes', async () => {
      expect(await isMovingAfter([10, 10, 10])).toEqual([false, true, true]);
    });

    it('does not flicker at walking pace', async () => {
      const out = await isMovingAfter([0.9, 1.1, 0.9, 1.2, 0.8, 0.4, 0.3]);
      const flips = out.filter((v, i) => i > 0 && v !== out[i - 1]).length;
      expect(flips).toBeLessThanOrEqual(1);
      expect(out.at(-1)).toBe(false);
    });

    it('treats a null speed as 0 m/s', async () => {
      expect(await isMovingAfter([10, 10, null, null])).toEqual([false, true, true, false]);
    });

    it('resets the motion state on stop', async () => {
      await bridge.startNativeShiftTracking(session());
      await emitFix({ speed: 10 });
      await emitFix({ speed: 10 });
      expect(postedBody(1).is_moving).toBe(true);

      await bridge.stopNativeShiftTracking();
      await bridge.startNativeShiftTracking(session());
      await emitFix({ speed: 10 });
      expect(postedBody(2).is_moving).toBe(false);
    });
  });
  describe('battery level', () => {
    afterEach(() => {
      delete (navigator as unknown as Record<string, unknown>).getBattery;
    });

    it('sends battery_level when the WebView exposes the Battery API (Android)', async () => {
      Object.defineProperty(navigator, 'getBattery', {
        value: jest.fn().mockResolvedValue({ level: 0.42 }),
        configurable: true,
        writable: true,
      });
      await bridge.startNativeShiftTracking(session());
      await emitFix();
      expect(postedBody().battery_level).toBe(42);
    });

    it('sends battery_level: null when the Battery API is absent (iOS WKWebView)', async () => {
      delete (navigator as unknown as Record<string, unknown>).getBattery;
      await bridge.startNativeShiftTracking(session());
      await emitFix();
      expect(postedBody()).toHaveProperty('battery_level', null);
    });
  });

  describe('location readiness (android-location-prompt-every-run)', () => {
    /** Let the async error branch of the watcher callback settle. */
    async function emitError(code: string, message: string) {
      await watcherCallback(undefined, { code, message });
      await Promise.resolve();
    }

    describe('Android', () => {
      it('starts silently when permission is granted and Location is on', async () => {
        await bridge.startNativeShiftTracking(session());

        expect(mockCheckPermissions).toHaveBeenCalledTimes(1);
        expect(mockAddWatcher).toHaveBeenCalledTimes(1);
        // Never let the plugin pop the OS dialog on its own — we already know.
        expect(mockAddWatcher.mock.calls[0]![0]).toMatchObject({
          requestPermissions: false,
        });
        expect(issues.getNativeLocationIssue()).toBeNull();
        expect(mockOpenSettings).not.toHaveBeenCalled();

        await emitFix();
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      it('explains instead of prompting when the permission was permanently denied', async () => {
        mockCheckPermissions.mockResolvedValue({ location: 'denied' });
        await bridge.startNativeShiftTracking(session());

        expect(mockAddWatcher).not.toHaveBeenCalled();
        expect(issues.getNativeLocationIssue()).toBe('permission-blocked');
        expect(mockOpenSettings).not.toHaveBeenCalled();

        // The explanation's button is the only thing that opens Settings.
        await bridge.resolveLocationIssue();
        expect(mockOpenSettings).toHaveBeenCalledTimes(1);
        expect(mockAddWatcher).not.toHaveBeenCalled();
      });

      it('flags Location services off without bouncing the driver to app settings', async () => {
        await bridge.startNativeShiftTracking(session());
        await emitError('NOT_AUTHORIZED', 'Location services disabled.');

        expect(issues.getNativeLocationIssue()).toBe('location-off');
        expect(mockOpenSettings).not.toHaveBeenCalled();
        // The rejected watcher is torn down so a retry can re-arm.
        expect(mockRemoveWatcher).toHaveBeenCalledWith({ id: 'watcher-1' });

        // The button re-checks and re-arms (Location turned on meanwhile).
        await bridge.resolveLocationIssue();
        expect(mockOpenSettings).not.toHaveBeenCalled();
        expect(mockAddWatcher).toHaveBeenCalledTimes(2);
        expect(issues.getNativeLocationIssue()).toBeNull();
      });

      it('asks for a first-time grant only after the explanation button is tapped', async () => {
        mockCheckPermissions.mockResolvedValue({ location: 'prompt' });
        await bridge.startNativeShiftTracking(session());

        expect(mockAddWatcher).not.toHaveBeenCalled();
        expect(mockRequestPermissions).not.toHaveBeenCalled();
        expect(issues.getNativeLocationIssue()).toBe('permission-needed');

        // Tap → OS dialog → driver grants → watcher arms without re-asking.
        mockCheckPermissions.mockResolvedValue({ location: 'granted' });
        await bridge.resolveLocationIssue();
        expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
        expect(mockAddWatcher).toHaveBeenCalledTimes(1);
        expect(mockAddWatcher.mock.calls[0]![0]).toMatchObject({
          requestPermissions: false,
        });
        expect(issues.getNativeLocationIssue()).toBeNull();
        expect(mockOpenSettings).not.toHaveBeenCalled();
      });

      it('recognises an expired "Only this time" grant on a later run', async () => {
        await bridge.startNativeShiftTracking(session()); // granted run
        await bridge.stopNativeShiftTracking();

        mockCheckPermissions.mockResolvedValue({ location: 'prompt' });
        await bridge.startNativeShiftTracking(session());

        expect(issues.getNativeLocationIssue()).toBe('permission-expired');
        expect(mockAddWatcher).toHaveBeenCalledTimes(1); // only the first run
      });

      it('falls back to the settings explanation when the OS dialog is denied for good', async () => {
        mockCheckPermissions.mockResolvedValue({ location: 'prompt' });
        await bridge.startNativeShiftTracking(session());

        mockCheckPermissions.mockResolvedValue({ location: 'denied' });
        await bridge.resolveLocationIssue();

        expect(issues.getNativeLocationIssue()).toBe('permission-blocked');
        expect(mockAddWatcher).not.toHaveBeenCalled();
        expect(mockOpenSettings).not.toHaveBeenCalled();
      });

      it('keeps offering the OS dialog when it can still be shown', async () => {
        mockCheckPermissions.mockResolvedValue({ location: 'prompt' });
        await bridge.startNativeShiftTracking(session());

        mockCheckPermissions.mockResolvedValue({ location: 'prompt-with-rationale' });
        await bridge.resolveLocationIssue();

        expect(issues.getNativeLocationIssue()).toBe('permission-needed');
        expect(mockAddWatcher).not.toHaveBeenCalled();
      });

      it('falls back to the plugin prompt when the permission check is unavailable', async () => {
        mockCheckPermissions.mockRejectedValue(new Error('not implemented'));
        await bridge.startNativeShiftTracking(session());

        expect(mockAddWatcher).toHaveBeenCalledTimes(1);
        expect(mockAddWatcher.mock.calls[0]![0]).toMatchObject({
          requestPermissions: true,
        });
      });

      it('grants before any shift (Track screen) without arming a watcher', async () => {
        mockCheckPermissions.mockResolvedValue({ location: 'prompt' });
        await expect(
          bridge.refreshNativeLocationPermission({ explain: true }),
        ).resolves.toBe('not-granted');
        expect(issues.getNativeLocationIssue()).toBe('permission-needed');

        mockCheckPermissions.mockResolvedValue({ location: 'granted' });
        await bridge.resolveLocationIssue();

        expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
        expect(issues.getNativeLocationIssue()).toBeNull();
        expect(mockAddWatcher).not.toHaveBeenCalled();
      });

      describe('refreshNativeLocationPermission (web tracker gate)', () => {
        it('reports granted without prompting or explaining', async () => {
          await expect(
            bridge.refreshNativeLocationPermission({ explain: true }),
          ).resolves.toBe('granted');
          expect(issues.getNativeLocationIssue()).toBeNull();
          expect(mockRequestPermissions).not.toHaveBeenCalled();
        });

        it('stays quiet when not asked to explain (app launch)', async () => {
          mockCheckPermissions.mockResolvedValue({ location: 'prompt' });
          await expect(
            bridge.refreshNativeLocationPermission({ explain: false }),
          ).resolves.toBe('not-granted');
          expect(issues.getNativeLocationIssue()).toBeNull();
          expect(mockRequestPermissions).not.toHaveBeenCalled();
        });

        it('clears a stale permission explanation once granted', async () => {
          issues.setNativeLocationIssue('permission-blocked');
          await bridge.refreshNativeLocationPermission({ explain: false });
          expect(issues.getNativeLocationIssue()).toBeNull();
        });

        it('returns null when the state cannot be read', async () => {
          mockCheckPermissions.mockRejectedValue(new Error('not implemented'));
          await expect(
            bridge.refreshNativeLocationPermission({ explain: true }),
          ).resolves.toBeNull();
        });
      });

      it('clears any pending explanation on stop', async () => {
        mockCheckPermissions.mockResolvedValue({ location: 'denied' });
        await bridge.startNativeShiftTracking(session());
        expect(issues.getNativeLocationIssue()).toBe('permission-blocked');

        await bridge.stopNativeShiftTracking();
        expect(issues.getNativeLocationIssue()).toBeNull();
      });
    });

    describe('iOS', () => {
      beforeEach(() => {
        mockPlatform = 'ios';
      });

      it('keeps the existing start flow (no pre-check, plugin requests permission)', async () => {
        await bridge.startNativeShiftTracking(session());

        expect(mockCheckPermissions).not.toHaveBeenCalled();
        expect(mockAddWatcher).toHaveBeenCalledTimes(1);
        expect(mockAddWatcher.mock.calls[0]![0]).toMatchObject({
          requestPermissions: true,
        });
      });

      it('has no native permission check (falls back to the web flow)', async () => {
        await expect(
          bridge.refreshNativeLocationPermission({ explain: true }),
        ).resolves.toBeNull();
        expect(mockCheckPermissions).not.toHaveBeenCalled();
      });

      it('explains a denial before opening Settings', async () => {
        await bridge.startNativeShiftTracking(session());
        await emitError('NOT_AUTHORIZED', 'Permission denied.');

        expect(mockOpenSettings).not.toHaveBeenCalled();
        expect(issues.getNativeLocationIssue()).toBe('permission-blocked');

        await bridge.resolveLocationIssue();
        expect(mockOpenSettings).toHaveBeenCalledTimes(1);
      });
    });

    it('does nothing in a plain browser', async () => {
      mockIsNative = false;
      await bridge.startNativeShiftTracking(session());

      expect(mockCheckPermissions).not.toHaveBeenCalled();
      expect(mockAddWatcher).not.toHaveBeenCalled();
      expect(issues.getNativeLocationIssue()).toBeNull();
      await expect(
        bridge.refreshNativeLocationPermission({ explain: true }),
      ).resolves.toBeNull();
    });
  });
});
