/**
 * Idempotent single-point writes (follow-up to #708).
 *
 * The batch replay route skips points already stored for the same
 * (driver_id, recorded_at) and serializes per driver with a transaction-scoped
 * advisory lock. The single-point route the live tracker uses had neither, so a
 * retried POST (answer lost to a timeout), or a live POST racing a batch replay
 * of the same fix, could store the point twice. Both routes now share the same
 * write helpers and the same lock key.
 */

jest.mock('@/lib/db/raw', () => {
  class DbHttpError extends Error {
    status: number;
    body: any;
    constructor(status: number, body: any) {
      super('db-http-error');
      this.status = status;
      this.body = body;
    }
  }
  return {
    __esModule: true,
    DbHttpError,
    withRawTx: jest.fn(),
    rawQuery: jest.fn(),
    rawExec: jest.fn(),
  };
});
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: jest.fn() }));
jest.mock('@/services/tracking/tracking-settings', () => ({
  getTrackingSettings: () =>
    Promise.resolve(jest.requireActual('@/types/tracking-settings').TRACKING_SETTINGS_DEFAULTS),
}));
jest.mock('@/lib/rate-limiting/location-rate-limiter', () => ({
  locationRateLimiter: {
    configure: jest.fn(),
    checkAndRecordLimit: jest.fn().mockReturnValue({ allowed: true }),
  },
}));
jest.mock('@/services/tracking/late-point-mileage', () => ({
  recomputeClosedShiftMileageForPoint: jest.fn(),
}));
jest.mock('@/lib/api/after-response', () => ({
  runAfterResponse: jest.fn((_label: string, work: () => Promise<unknown>) => {
    void work().catch(() => {});
  }),
}));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));

import { withAuth } from '@/lib/auth-middleware';
import { withRawTx } from '@/lib/db/raw';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { recomputeClosedShiftMileageForPoint } from '@/services/tracking/late-point-mileage';
import { createPostRequest } from '@/__tests__/helpers/api-test-helpers';
import { POST } from '../route';
import { POST as POST_BATCH } from '../batch/route';
import { SAME_FIX_WINDOW_MS } from '@/lib/tracking/recorded-at';

const mockWithAuth = withAuth as jest.Mock;
const mockWithRawTx = withRawTx as jest.Mock;
const mockRecompute = recomputeClosedShiftMileageForPoint as jest.Mock;
const mockTxQuery = jest.fn();
const mockTxExec = jest.fn();

const DRIVER_ID = '11111111-1111-4111-8111-111111111111';
const URL = 'http://localhost:3000/api/tracking/locations';

/**
 * Fake tx whose INSERT emulates the NOT EXISTS guard: a live row of the same
 * driver blocks the insert when it has the same recorded_at, or the same
 * coordinates with a recorded_at within the window bound as $11. A null
 * recorded_at is stamped with the (mocked) clock, like the DB's NOW().
 * `saved` seeds rows at the default fix coordinates.
 */
type StoredRow = { latitude: number; longitude: number; recordedAtMs: number };

function setupTx({
  latestStoredAt = null as Date | null,
  ownsDriver = true,
  saved = [] as string[],
} = {}) {
  const stored: StoredRow[] = saved.map((t) => ({
    latitude: 37.7,
    longitude: -122.4,
    recordedAtMs: Date.parse(t),
  }));
  mockTxQuery.mockImplementation((sql: string, ...binds: unknown[]) => {
    if (sql.includes('SELECT id FROM drivers')) {
      return Promise.resolve(ownsDriver ? [{ id: DRIVER_ID }] : []);
    }
    if (sql.includes('MAX(recorded_at)')) {
      return Promise.resolve([{ latest_recorded_at: latestStoredAt }]);
    }
    if (sql.includes('INSERT INTO driver_locations')) {
      const longitude = binds[1] as number;
      const latitude = binds[2] as number;
      const recordedAt = binds[9] as string | null;
      const windowMs = typeof binds[10] === 'number' ? binds[10] : 0;
      const atMs = recordedAt ? Date.parse(recordedAt) : Date.now();
      const duplicate = stored.some(
        (row) =>
          Math.abs(row.recordedAtMs - atMs) <= windowMs &&
          (row.recordedAtMs === atMs ||
            (row.latitude === latitude && row.longitude === longitude)),
      );
      if (duplicate) return Promise.resolve([]);
      stored.push({ latitude, longitude, recordedAtMs: atMs });
      return Promise.resolve([
        {
          id: 'loc-1',
          location_geojson: JSON.stringify({ type: 'Point', coordinates: [longitude, latitude] }),
          recorded_at: new Date(atMs).toISOString(),
        },
      ]);
    }
    return Promise.resolve([]);
  });
  return stored;
}

function insertCalls() {
  return mockTxQuery.mock.calls.filter(([sql]) => /INSERT INTO driver_locations/.test(sql));
}

function driversUpdateCalls() {
  return mockTxExec.mock.calls.filter(([sql]) => /UPDATE drivers/.test(sql));
}

function lockCalls() {
  return mockTxExec.mock.calls
    .map((call, i) => ({ call, order: mockTxExec.mock.invocationCallOrder[i]! }))
    .filter(({ call: [sql] }) => /pg_advisory/.test(sql));
}

function fix(msAgo: number, now = Date.now()) {
  return {
    driver_id: DRIVER_ID,
    latitude: 37.7,
    longitude: -122.4,
    timestamp: new Date(now - msAgo).toISOString(),
    client_sent_at: now,
  };
}

function post(body: Record<string, unknown>) {
  return POST(createPostRequest(URL, body));
}

describe('POST /api/tracking/locations — duplicate fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithAuth.mockResolvedValue({
      success: true,
      context: { user: { id: 'auth-driver-1', type: 'DRIVER' } },
    });
    (enforceRateLimit as jest.Mock).mockResolvedValue(null);
    mockWithRawTx.mockImplementation((fn: any) =>
      fn({ $queryRawUnsafe: mockTxQuery, $executeRawUnsafe: mockTxExec }),
    );
    mockTxExec.mockResolvedValue(1);
    mockRecompute.mockResolvedValue({ shiftId: null, recomputed: false });
  });

  it('guards the insert on (driver_id, recorded_at) among live rows', async () => {
    setupTx();

    await post(fix(2_000));

    const [sql] = insertCalls()[0]!;
    expect(sql).toMatch(/WHERE NOT EXISTS/);
    expect(sql).toMatch(/recorded_at = \$10::timestamptz/);
    expect(sql).toMatch(/deleted_at IS NULL/);
  });

  it('a new fix answers 201 with the stored row and duplicate: false', async () => {
    setupTx({ latestStoredAt: new Date(Date.now() - 20_000) });

    const res = await post(fix(2_000));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({ success: true, duplicate: false, inserted: 1, duplicates: 0 });
    expect(body.data.location).toEqual({ type: 'Point', coordinates: [-122.4, 37.7] });
    expect(driversUpdateCalls()).toHaveLength(1);
  });

  it('a retried POST of an already-stored fix answers 200 duplicate and does not move the marker', async () => {
    const now = Date.now();
    const body = fix(2_000, now);
    setupTx({ latestStoredAt: new Date(now - 20_000), saved: [body.timestamp] });

    const res = await post(body);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, duplicate: true, inserted: 0, duplicates: 1, data: null });
    expect(driversUpdateCalls()).toHaveLength(0);
  });

  it('a duplicate late fix does not trigger the closed-shift mileage recompute', async () => {
    const now = Date.now();
    const body = fix(3 * 60 * 60 * 1000, now);
    setupTx({ latestStoredAt: new Date(now - 15_000), saved: [body.timestamp] });

    const res = await post(body);
    await new Promise((r) => setTimeout(r, 0));

    expect(res.status).toBe(200);
    expect(mockRecompute).not.toHaveBeenCalled();
  });

  it('a fix without a device time (DB-stamped) is still stored', async () => {
    setupTx({ latestStoredAt: new Date(Date.now() - 20_000) });

    const res = await post({ driver_id: DRIVER_ID, latitude: 37.7, longitude: -122.4 });

    expect(res.status).toBe(201);
    expect(insertCalls()).toHaveLength(1);
    expect(insertCalls()[0]![10]).toBeNull();
  });

  it('takes the per-driver xact lock in the same transaction before reading or inserting', async () => {
    setupTx();

    await post(fix(2_000));

    expect(mockWithRawTx).toHaveBeenCalledTimes(1);
    const locks = lockCalls();
    expect(locks).toHaveLength(1);
    const [sql, key] = locks[0]!.call;
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtext\('driver_locations:' \|\| \$1\)\)/);
    expect(key).toBe(DRIVER_ID);

    const order = (re: RegExp) =>
      mockTxQuery.mock.calls
        .map(([s], i) => ({ s, order: mockTxQuery.mock.invocationCallOrder[i]! }))
        .find(({ s }) => re.test(s))!.order;
    expect(locks[0]!.order).toBeLessThan(order(/MAX\(recorded_at\)/));
    expect(locks[0]!.order).toBeLessThan(order(/INSERT INTO driver_locations/));
  });

  it('does not take the lock for a caller who may not write this driver', async () => {
    setupTx({ ownsDriver: false });

    const res = await post(fix(2_000));

    expect(res.status).toBe(403);
    expect(lockCalls()).toHaveLength(0);
    expect(insertCalls()).toHaveLength(0);
  });

  it('uses the exact lock statement and key of the batch route, so the two serialize', async () => {
    setupTx();
    const now = Date.now();

    await post(fix(2_000, now));
    const [singleLock] = lockCalls();

    jest.clearAllMocks();
    mockWithRawTx.mockImplementation((fn: any) =>
      fn({ $queryRawUnsafe: mockTxQuery, $executeRawUnsafe: mockTxExec }),
    );
    (enforceRateLimit as jest.Mock).mockResolvedValue(null);
    mockTxExec.mockResolvedValue(1);
    setupTx();
    await POST_BATCH(
      createPostRequest(`${URL}/batch`, {
        driver_id: DRIVER_ID,
        client_sent_at: now,
        points: [{ latitude: 37.7, longitude: -122.4, timestamp: new Date(now - 60_000).toISOString() }],
      }),
    );
    const [batchLock] = lockCalls();

    expect(singleLock).toBeDefined();
    expect(batchLock).toBeDefined();
    expect(singleLock!.call).toEqual(batchLock!.call);
  });

  describe('the same physical fix resent from a skewed phone clock (review nit on #711)', () => {
    const T = Date.parse('2026-10-28T18:00:00.000Z');
    const LAT = 37.77493;
    const LNG = -122.41942;
    let nowSpy: jest.SpyInstance;

    beforeEach(() => {
      nowSpy = jest.spyOn(Date, 'now').mockReturnValue(T);
    });
    afterEach(() => nowSpy.mockRestore());

    /** Server clock for the next request. */
    const serverAt = (ms: number) => nowSpy.mockReturnValue(ms);

    function livePost(fixDeviceMs: number | null, deviceSendMs: number) {
      return post({
        driver_id: DRIVER_ID,
        latitude: LAT,
        longitude: LNG,
        ...(fixDeviceMs === null ? {} : { timestamp: new Date(fixDeviceMs).toISOString() }),
        client_sent_at: deviceSendMs,
      });
    }

    function batchReplay(fixDeviceMs: number, deviceSendMs: number) {
      return POST_BATCH(
        createPostRequest(`${URL}/batch`, {
          driver_id: DRIVER_ID,
          client_sent_at: deviceSendMs,
          points: [
            { latitude: LAT, longitude: LNG, timestamp: new Date(fixDeviceMs).toISOString() },
          ],
        }),
      );
    }

    it('guards on the same coordinates within the same-fix window', async () => {
      setupTx();

      await livePost(T - 1_000, T);

      const [sql, ...binds] = insertCalls()[0]!;
      expect(sql).toMatch(/latitude = \$3/);
      expect(sql).toMatch(/longitude = \$2/);
      expect(sql).toMatch(/\$11/);
      expect(binds[10]).toBe(SAME_FIX_WINDOW_MS);
    });

    it('phone fast by <30 s: a retry clamped to a later receive time is a duplicate', async () => {
      const skew = 20_000;
      const fixDeviceMs = T + skew - 1_000; // in the future by server time
      setupTx();

      serverAt(T);
      const first = await livePost(fixDeviceMs, T + skew);
      serverAt(T + 12_000);
      const retry = await livePost(fixDeviceMs, T + 12_000 + skew);

      expect(first.status).toBe(201);
      expect(retry.status).toBe(200);
      expect(await retry.json()).toMatchObject({ duplicate: true, inserted: 0 });
    });

    it('phone slow by >30 s: a live retry with a fresh client_sent_at is a duplicate', async () => {
      const skew = -3_648_000;
      const fixDeviceMs = T + skew - 2_000;
      setupTx();

      serverAt(T + 200);
      const first = await livePost(fixDeviceMs, T + skew);
      serverAt(T + 20_000 + 6_000); // retried 20 s later, 6 s slower network
      const retry = await livePost(fixDeviceMs, T + 20_000 + skew);

      expect(first.status).toBe(201);
      expect(retry.status).toBe(200);
    });

    it('phone slow by >30 s: a batch replay of a stored live fix is a duplicate', async () => {
      const skew = -3_648_000;
      const fixDeviceMs = T + skew - 2_000;
      setupTx();

      serverAt(T + 200);
      await livePost(fixDeviceMs, T + skew);
      serverAt(T + 5 * 60_000 + 3_000);
      const replay = await batchReplay(fixDeviceMs, T + 5 * 60_000 + skew);

      expect(await replay.json()).toMatchObject({ inserted: 0, duplicates: 1 });
    });

    it('no plugin fix time: the DB-stamped live fix and its outbox replay are one point', async () => {
      // Live POST omits `timestamp` (stamped NOW() server side); the outbox copy
      // carries the device callback time instead. Phone 2 min slow.
      const skew = -120_000;
      const callbackDeviceMs = T + skew;
      setupTx();

      serverAt(T + 300);
      const live = await livePost(null, callbackDeviceMs);
      serverAt(T + 90_000);
      const replay = await batchReplay(callbackDeviceMs, T + 89_000 + skew);

      expect(live.status).toBe(201);
      expect(await replay.json()).toMatchObject({ inserted: 0, duplicates: 1 });
    });

    it('a different fix inside the window is still stored', async () => {
      const stored = setupTx();

      await livePost(T - 6_000, T);
      serverAt(T + 6_000);
      const next = await post({
        driver_id: DRIVER_ID,
        latitude: LAT + 0.0001,
        longitude: LNG,
        timestamp: new Date(T).toISOString(),
        client_sent_at: T + 6_000,
      });

      expect(next.status).toBe(201);
      expect(stored).toHaveLength(2);
    });
  });
});
