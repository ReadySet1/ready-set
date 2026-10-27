/**
 * POST /api/tracking/locations/batch — replay of GPS fixes captured offline
 * (board card gps-points-lost-during-data-outage).
 *
 * 2026-10-17: a ~5 min mobile-data outage left a 294 s hole in the shift. The
 * single-point route enforces the live cadence (one point per interval per
 * user), so a queued backlog could only drain one point per interval while
 * competing with live posts. The batch route takes the whole backlog in one
 * request, files every point by its own fix time, and keeps late points off
 * the live marker.
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
jest.mock('@/lib/rate-limiting/location-rate-limiter', () => ({
  locationRateLimiter: {
    configure: jest.fn(),
    checkAndRecordLimit: jest.fn().mockReturnValue({ allowed: false, message: 'too soon' }),
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
import { locationRateLimiter } from '@/lib/rate-limiting/location-rate-limiter';
import { recomputeClosedShiftMileageForPoint } from '@/services/tracking/late-point-mileage';
import { createPostRequest } from '@/__tests__/helpers/api-test-helpers';
import { POST, MAX_BATCH_POINTS } from '../route';

const mockWithAuth = withAuth as jest.Mock;
const mockWithRawTx = withRawTx as jest.Mock;
const mockEnforceRateLimit = enforceRateLimit as jest.Mock;
const mockRecompute = recomputeClosedShiftMileageForPoint as jest.Mock;
const mockTxQuery = jest.fn();
const mockTxExec = jest.fn();

const DRIVER_ID = '11111111-1111-4111-8111-111111111111';
const URL = 'http://localhost:3000/api/tracking/locations/batch';

function setupTx({
  latestStoredAt = null as Date | null,
  ownsDriver = true,
} = {}) {
  mockTxQuery.mockImplementation((sql: string) => {
    if (sql.includes('SELECT id FROM drivers')) {
      return Promise.resolve(ownsDriver ? [{ id: DRIVER_ID }] : []);
    }
    if (sql.includes('MAX(recorded_at)')) {
      return Promise.resolve([{ latest_recorded_at: latestStoredAt }]);
    }
    return Promise.resolve([]);
  });
}

function insertCalls() {
  return mockTxExec.mock.calls.filter(([sql]) => /INSERT INTO driver_locations/.test(sql));
}

function driversUpdateCalls() {
  return mockTxExec.mock.calls.filter(([sql]) => /UPDATE drivers/.test(sql));
}

/** One fix every 5 s, `count` of them, the newest `newestMsAgo` before now. */
function outagePoints(count: number, newestMsAgo: number, now = Date.now()) {
  return Array.from({ length: count }, (_, i) => ({
    latitude: 21.1 + i * 0.0001,
    longitude: -101.6,
    accuracy: 3,
    speed: 8,
    heading: 90,
    battery_level: 40,
    is_moving: true,
    timestamp: new Date(now - newestMsAgo - (count - 1 - i) * 5_000).toISOString(),
  }));
}

function post(body: unknown) {
  return POST(createPostRequest(URL, body as Record<string, unknown>));
}

describe('POST /api/tracking/locations/batch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithAuth.mockResolvedValue({
      success: true,
      context: { user: { id: 'auth-driver-1', type: 'DRIVER' } },
    });
    mockEnforceRateLimit.mockResolvedValue(null);
    mockWithRawTx.mockImplementation((fn: any) =>
      fn({ $queryRawUnsafe: mockTxQuery, $executeRawUnsafe: mockTxExec }),
    );
    mockTxExec.mockResolvedValue(1);
    mockRecompute.mockResolvedValue({ shiftId: null, recomputed: false });
  });

  it('accepts a 5-minute outage backlog in one request and files every point by its fix time', async () => {
    setupTx({ latestStoredAt: new Date(Date.now() - 2_000) });
    const now = Date.now();
    const points = outagePoints(60, 30_000, now);

    const res = await post({ driver_id: DRIVER_ID, client_sent_at: now, points });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({ success: true, accepted: 60, dropped: 0 });
    const inserts = insertCalls();
    expect(inserts).toHaveLength(60);
    // recorded_at is the last bind ($10) — each point keeps its own fix time.
    const recorded = inserts.map((call) => call[10]);
    expect(recorded).toEqual(points.map((p) => p.timestamp));
  });

  it('is not throttled by the live per-interval cadence limiter', async () => {
    setupTx();
    const now = Date.now();

    const res = await post({ driver_id: DRIVER_ID, client_sent_at: now, points: outagePoints(3, 60_000, now) });

    expect(res.status).toBe(201);
    expect(locationRateLimiter.checkAndRecordLimit).not.toHaveBeenCalled();
    expect(mockEnforceRateLimit).toHaveBeenCalledWith('auth-driver-1', 'tracking-location-batch');
  });

  it('inserts points oldest first even when the client sends them out of order', async () => {
    setupTx();
    const now = Date.now();
    const points = outagePoints(5, 60_000, now).reverse();

    await post({ driver_id: DRIVER_ID, client_sent_at: now, points });

    const recorded = insertCalls().map((call) => Date.parse(call[10]));
    expect(recorded).toHaveLength(5);
    expect(recorded).toEqual([...recorded].sort((a, b) => a - b));
  });

  it('does not move the live marker when the replayed points are older than the stored trail', async () => {
    // Live posts resumed after the outage, so the newest stored point is newer
    // than anything in the backlog.
    setupTx({ latestStoredAt: new Date(Date.now() - 1_000) });
    const now = Date.now();

    await post({ driver_id: DRIVER_ID, client_sent_at: now, points: outagePoints(10, 20_000, now) });

    expect(insertCalls()).toHaveLength(10);
    expect(driversUpdateCalls()).toHaveLength(0);
  });

  it('moves the marker to the newest point when the batch is the freshest data', async () => {
    setupTx({ latestStoredAt: new Date(Date.now() - 5 * 60_000) });
    const now = Date.now();
    const points = outagePoints(4, 3_000, now);

    await post({ driver_id: DRIVER_ID, client_sent_at: now, points });

    const updates = driversUpdateCalls();
    expect(updates).toHaveLength(1);
    const newest = points[points.length - 1]!;
    // ST_MakePoint(lng, lat)
    expect(updates[0]!.slice(1, 3)).toEqual([newest.longitude, newest.latitude]);
  });

  it('drops points without a usable fix time or with invalid coordinates, keeps the rest', async () => {
    setupTx();
    const now = Date.now();
    const good = outagePoints(2, 60_000, now);

    const res = await post({
      driver_id: DRIVER_ID,
      client_sent_at: now,
      points: [
        ...good,
        { latitude: 21.1, longitude: -101.6 }, // no timestamp: cannot be filed
        { latitude: 95, longitude: -101.6, timestamp: good[0]!.timestamp },
        { latitude: 21.1, longitude: -101.6, timestamp: new Date(now - 30 * 60 * 60_000).toISOString() },
      ],
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({ accepted: 2, dropped: 3 });
    expect(insertCalls()).toHaveLength(2);
  });

  it('answers 200 with nothing accepted when every point is unfileable (client may discard them)', async () => {
    setupTx();

    const res = await post({
      driver_id: DRIVER_ID,
      client_sent_at: Date.now(),
      points: [{ latitude: 21.1, longitude: -101.6 }],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, accepted: 0, dropped: 1 });
    expect(mockWithRawTx).not.toHaveBeenCalled();
  });

  it(`rejects an empty batch, one larger than ${MAX_BATCH_POINTS} points, or a missing driver_id`, async () => {
    setupTx();
    const now = Date.now();

    expect((await post({ driver_id: DRIVER_ID, points: [] })).status).toBe(400);
    expect(
      (
        await post({
          driver_id: DRIVER_ID,
          client_sent_at: now,
          points: outagePoints(MAX_BATCH_POINTS + 1, 60_000, now),
        })
      ).status,
    ).toBe(400);
    expect((await post({ points: outagePoints(1, 60_000, now) })).status).toBe(400);
  });

  it("refuses a driver writing another driver's points", async () => {
    setupTx({ ownsDriver: false });
    const now = Date.now();

    const res = await post({ driver_id: DRIVER_ID, client_sent_at: now, points: outagePoints(2, 60_000, now) });

    expect(res.status).toBe(403);
    expect(insertCalls()).toHaveLength(0);
  });

  it('passes through the abuse rate limit response', async () => {
    const { NextResponse } = jest.requireActual('next/server');
    mockEnforceRateLimit.mockResolvedValue(NextResponse.json({ error: 'slow down' }, { status: 429 }));

    const res = await post({ driver_id: DRIVER_ID, points: outagePoints(1, 60_000) });

    expect(res.status).toBe(429);
  });

  it('recomputes the closed shift the late points fall into (checks the oldest and newest late point)', async () => {
    setupTx({ latestStoredAt: new Date(Date.now() - 1_000) });
    mockRecompute.mockResolvedValue({ shiftId: 'shift-outbound', recomputed: true });
    const now = Date.now();
    const points = outagePoints(60, 5 * 60_000, now);

    await post({ driver_id: DRIVER_ID, client_sent_at: now, points });
    await new Promise((r) => setTimeout(r, 0));

    // Oldest late point first; the newest is only checked when it is not in
    // the shift that was just recomputed. Both are the same shift here.
    expect(mockRecompute).toHaveBeenCalledTimes(2);
    expect(mockRecompute.mock.calls[0]).toEqual([DRIVER_ID, points[0]!.timestamp]);
  });

  it('checks both ends when a backlog spans two closed shifts', async () => {
    setupTx({ latestStoredAt: new Date(Date.now() - 1_000) });
    mockRecompute
      .mockResolvedValueOnce({ shiftId: 'shift-outbound', recomputed: true })
      .mockResolvedValueOnce({ shiftId: 'shift-return', recomputed: true });
    const now = Date.now();
    const points = outagePoints(60, 5 * 60_000, now);

    await post({ driver_id: DRIVER_ID, client_sent_at: now, points });
    await new Promise((r) => setTimeout(r, 0));

    const checked = mockRecompute.mock.calls.map(([, at]) => at);
    expect(checked).toEqual([points[0]!.timestamp, points[points.length - 1]!.timestamp]);
  });

  describe('replay of points the server already saved', () => {
    /** Exec mock that reports 0 rows for any recorded_at already "in the table". */
    function storeHolds(savedTimestamps: string[]) {
      const saved = new Set(savedTimestamps);
      mockTxExec.mockImplementation((sql: string, ...binds: unknown[]) => {
        if (/INSERT INTO driver_locations/.test(sql)) {
          const recordedAt = binds[9] as string;
          if (saved.has(recordedAt)) return Promise.resolve(0);
          saved.add(recordedAt);
          return Promise.resolve(1);
        }
        return Promise.resolve(1);
      });
    }

    it('skips points whose (driver_id, recorded_at) already exists, live rows only', async () => {
      setupTx();
      storeHolds([]);
      const now = Date.now();

      await post({ driver_id: DRIVER_ID, client_sent_at: now, points: outagePoints(1, 60_000, now) });

      const [sql] = insertCalls()[0]!;
      expect(sql).toMatch(/WHERE NOT EXISTS/);
      expect(sql).toMatch(/recorded_at = \$10::timestamptz/);
      expect(sql).toMatch(/deleted_at IS NULL/);
    });

    it('a resend of an already-saved batch inserts nothing new and still answers success', async () => {
      const now = Date.now();
      const points = outagePoints(5, 60_000, now);
      setupTx({ latestStoredAt: new Date(Date.parse(points[4]!.timestamp)) });
      storeHolds(points.map((p) => p.timestamp));

      const res = await post({ driver_id: DRIVER_ID, client_sent_at: now, points });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body).toMatchObject({ success: true, accepted: 5, inserted: 0, duplicates: 5, dropped: 0 });
      expect(driversUpdateCalls()).toHaveLength(0);
    });

    it('a partially-saved batch inserts only the missing points', async () => {
      const now = Date.now();
      const points = outagePoints(6, 60_000, now);
      setupTx();
      storeHolds(points.slice(0, 4).map((p) => p.timestamp));

      const res = await post({ driver_id: DRIVER_ID, client_sent_at: now, points });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body).toMatchObject({ success: true, accepted: 6, inserted: 2, duplicates: 4 });
    });

    it('inserts identical recorded_at values within one batch only once', async () => {
      setupTx();
      storeHolds([]);
      const now = Date.now();
      const [a, b] = outagePoints(2, 60_000, now);
      const points = [a!, { ...a!, latitude: a!.latitude + 0.01 }, b!, b!];

      const res = await post({ driver_id: DRIVER_ID, client_sent_at: now, points });
      const body = await res.json();

      expect(insertCalls().map((call) => call[10])).toEqual([a!.timestamp, b!.timestamp]);
      // The first copy wins.
      expect(insertCalls()[0]![3]).toBe(a!.latitude);
      expect(body).toMatchObject({ success: true, accepted: 4, inserted: 2, duplicates: 2, dropped: 0 });
    });

    it('does not recompute closed-shift mileage for late points that were already saved', async () => {
      const now = Date.now();
      const points = outagePoints(10, 5 * 60_000, now);
      setupTx({ latestStoredAt: new Date(now - 1_000) });
      storeHolds(points.map((p) => p.timestamp));

      await post({ driver_id: DRIVER_ID, client_sent_at: now, points });
      await new Promise((r) => setTimeout(r, 0));

      expect(mockRecompute).not.toHaveBeenCalled();
    });

    it('recomputes only around the late points this request actually inserted', async () => {
      const now = Date.now();
      const points = outagePoints(10, 5 * 60_000, now);
      setupTx({ latestStoredAt: new Date(now - 1_000) });
      storeHolds([...points.slice(0, 3), ...points.slice(8)].map((p) => p.timestamp));

      await post({ driver_id: DRIVER_ID, client_sent_at: now, points });
      await new Promise((r) => setTimeout(r, 0));

      const checked = mockRecompute.mock.calls.map(([, at]) => at);
      expect(checked).toEqual([points[3]!.timestamp, points[7]!.timestamp]);
    });
  });

  describe('concurrent resends of the same batch', () => {
    // Two requests carrying the same backlog (a timed-out request still running
    // server-side while the client retries, or two tabs flushing) can both pass
    // the NOT EXISTS check before either commits. A per-driver transaction-scoped
    // advisory lock makes the second wait until the first commits.
    function lockCalls() {
      return mockTxExec.mock.calls
        .map((call, i) => ({ call, order: mockTxExec.mock.invocationCallOrder[i]! }))
        .filter(({ call: [sql] }) => /pg_advisory_xact_lock/.test(sql));
    }

    it('takes a per-driver xact lock in the same transaction before reading or inserting', async () => {
      setupTx();
      const now = Date.now();

      await post({ driver_id: DRIVER_ID, client_sent_at: now, points: outagePoints(3, 60_000, now) });

      expect(mockWithRawTx).toHaveBeenCalledTimes(1);
      const locks = lockCalls();
      expect(locks).toHaveLength(1);
      const [sql, key] = locks[0]!.call;
      // Transaction-scoped only: a session-level lock leaks under pgbouncer
      // transaction pooling.
      expect(sql).toMatch(/pg_advisory_xact_lock\(hashtext\('driver_locations:' \|\| \$1\)\)/);
      expect(sql).not.toMatch(/pg_advisory_lock\(/);
      expect(key).toBe(DRIVER_ID);

      const lockOrder = locks[0]!.order;
      const latestReadOrder = mockTxQuery.mock.calls
        .map(([s], i) => ({ s, order: mockTxQuery.mock.invocationCallOrder[i]! }))
        .find(({ s }) => /MAX\(recorded_at\)/.test(s))!.order;
      const firstInsertOrder = Math.min(
        ...mockTxExec.mock.calls
          .map(([s], i) => ({ s, order: mockTxExec.mock.invocationCallOrder[i]! }))
          .filter(({ s }) => /INSERT INTO driver_locations/.test(s))
          .map(({ order }) => order),
      );
      expect(lockOrder).toBeLessThan(latestReadOrder);
      expect(lockOrder).toBeLessThan(firstInsertOrder);
    });

    it('does not take the lock for a caller who may not write this driver', async () => {
      setupTx({ ownsDriver: false });
      const now = Date.now();

      const res = await post({ driver_id: DRIVER_ID, client_sent_at: now, points: outagePoints(1, 60_000, now) });

      expect(res.status).toBe(403);
      expect(lockCalls()).toHaveLength(0);
    });
  });

  it('does not look for a closed shift when every point is fresh', async () => {
    setupTx({ latestStoredAt: new Date(Date.now() - 5 * 60_000) });
    const now = Date.now();

    await post({ driver_id: DRIVER_ID, client_sent_at: now, points: outagePoints(3, 1_000, now) });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockRecompute).not.toHaveBeenCalled();
  });
});
