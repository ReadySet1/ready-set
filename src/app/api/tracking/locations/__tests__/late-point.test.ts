/**
 * Late / out-of-order GPS points (board card late-queued-gps-point-after-shift-end).
 *
 * An iPhone recorded a point during shift A that reached the server 3 h later,
 * during shift B (service-worker offline-queue replay). The point is still
 * stored with its device time, but it must not become the driver's current
 * position, and when it falls inside an already-closed shift that shift's
 * stored mileage must be recomputed.
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
  // Mirrors the real helper: runs the work and swallows its rejection.
  runAfterResponse: jest.fn((_label: string, work: () => Promise<unknown>) => {
    void work().catch(() => {});
  }),
}));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));

import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@/lib/auth-middleware';
import { withRawTx } from '@/lib/db/raw';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { recomputeClosedShiftMileageForPoint } from '@/services/tracking/late-point-mileage';
import { runAfterResponse } from '@/lib/api/after-response';
import { createPostRequest } from '@/__tests__/helpers/api-test-helpers';
import { POST } from '../route';

const mockWithAuth = withAuth as jest.Mock;
const mockWithRawTx = withRawTx as jest.Mock;
const mockRecompute = recomputeClosedShiftMileageForPoint as jest.Mock;
const mockRunAfter = runAfterResponse as jest.Mock;
const mockTxQuery = jest.fn();
const mockTxExec = jest.fn();

const DRIVER_ID = '11111111-1111-4111-8111-111111111111';
const URL = 'http://localhost:3000/api/tracking/locations';

function setupTx(latestStoredAt: Date | null) {
  mockTxQuery.mockImplementation((sql: string) => {
    if (sql.includes('SELECT id FROM drivers')) return Promise.resolve([{ id: DRIVER_ID }]);
    if (sql.includes('MAX(recorded_at)')) {
      return Promise.resolve([{ latest_recorded_at: latestStoredAt }]);
    }
    if (sql.includes('INSERT INTO driver_locations')) {
      return Promise.resolve([
        {
          id: 'loc-1',
          location_geojson: JSON.stringify({ type: 'Point', coordinates: [-122.4, 37.7] }),
          recorded_at: new Date().toISOString(),
        },
      ]);
    }
    return Promise.resolve([]);
  });
}

function driversUpdateCalls() {
  return mockTxExec.mock.calls.filter(([sql]) => /UPDATE drivers/.test(sql));
}

function post(timestampMsAgo: number | null) {
  const now = Date.now();
  return POST(
    createPostRequest(URL, {
      driver_id: DRIVER_ID,
      latitude: 37.7,
      longitude: -122.4,
      ...(timestampMsAgo === null
        ? {}
        : { timestamp: new Date(now - timestampMsAgo).toISOString(), client_sent_at: now }),
    }),
  );
}

describe('POST /api/tracking/locations — late points', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithAuth.mockResolvedValue({
      success: true,
      context: { user: { id: 'admin-1', type: 'ADMIN' } },
    });
    (enforceRateLimit as jest.Mock).mockResolvedValue(null);
    mockWithRawTx.mockImplementation((fn: any) =>
      fn({ $queryRawUnsafe: mockTxQuery, $executeRawUnsafe: mockTxExec }),
    );
    mockTxExec.mockResolvedValue(1);
    mockRecompute.mockResolvedValue({ shiftId: null, recomputed: false });
  });

  it('an in-order live point still moves last_known_location', async () => {
    setupTx(new Date(Date.now() - 20_000));

    const res = await post(2_000);

    expect(res.status).toBe(201);
    expect(driversUpdateCalls()).toHaveLength(1);
    expect(mockRecompute).not.toHaveBeenCalled();
  });

  it('a DB-stamped point (no device time) still moves last_known_location', async () => {
    setupTx(new Date(Date.now() - 20_000));

    const res = await post(null);

    expect(res.status).toBe(201);
    expect(driversUpdateCalls()).toHaveLength(1);
  });

  it('stores an out-of-order point but does not move last_known_location', async () => {
    setupTx(new Date(Date.now() - 15_000));

    const res = await post(3 * 60 * 60 * 1000);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mockTxQuery.mock.calls.some(([sql]) => sql.includes('INSERT INTO driver_locations'))).toBe(true);
    expect(driversUpdateCalls()).toHaveLength(0);
  });

  it('checks for a closed shift after the response for a late point', async () => {
    setupTx(new Date(Date.now() - 15_000));
    mockRecompute.mockResolvedValue({ shiftId: 'shift-a', recomputed: true });

    await post(3 * 60 * 60 * 1000);

    expect(mockRunAfter).toHaveBeenCalledTimes(1);
    expect(mockRecompute).toHaveBeenCalledWith(DRIVER_ID, expect.any(String));
    const recordedAt = mockRecompute.mock.calls[0]![1] as string;
    expect(Date.now() - Date.parse(recordedAt)).toBeGreaterThan(2.9 * 60 * 60 * 1000);
  });

  it('never fails the request when the recompute throws, and reports it', async () => {
    setupTx(new Date(Date.now() - 15_000));
    mockRecompute.mockRejectedValue(new Error('db down'));

    const res = await post(3 * 60 * 60 * 1000);
    await new Promise((r) => setTimeout(r, 0));

    expect(res.status).toBe(201);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: expect.objectContaining({ component: 'late-gps-point-mileage' }) }),
    );
  });
});
