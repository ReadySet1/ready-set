/**
 * driver_locations.battery_level must be persisted from the POST body
 * (validated + normalized to a 0-100 integer), and an invalid battery value
 * must never cost us the GPS point itself.
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
  return { __esModule: true, DbHttpError, withRawTx: jest.fn(), rawQuery: jest.fn(), rawExec: jest.fn() };
});
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: jest.fn() }));
jest.mock('@/services/tracking/tracking-settings', () => ({
  getTrackingSettings: () =>
    Promise.resolve(jest.requireActual('@/types/tracking-settings').TRACKING_SETTINGS_DEFAULTS),
  invalidateTrackingSettingsCache: () => {},
}));
jest.mock('@/lib/rate-limiting/location-rate-limiter', () => ({
  locationRateLimiter: {
    configure: jest.fn(),
    checkAndRecordLimit: jest.fn().mockReturnValue({ allowed: true, retryAfter: null, message: 'ok' }),
  },
}));

import { createPostRequest } from '@/__tests__/helpers/api-test-helpers';
import { insertParamFor } from '@/__tests__/helpers/insert-param';
import { withAuth } from '@/lib/auth-middleware';
import { withRawTx } from '@/lib/db/raw';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { POST } from '../route';

const mockTxQuery = jest.fn();
const mockTxExec = jest.fn();

const URL_ = 'http://localhost:3000/api/tracking/locations';
const base = { driver_id: 'driver-1', latitude: 37.7749, longitude: -122.4194 };

function insertedBatteryParam(): unknown {
  const call = mockTxQuery.mock.calls.find(
    ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO driver_locations'),
  );
  expect(call).toBeDefined();
  return insertParamFor(call!, 'battery_level');
}

describe('locations POST — battery_level persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (withAuth as jest.Mock).mockResolvedValue({ success: true, context: { user: { id: 'admin-1', type: 'ADMIN' } } });
    (enforceRateLimit as jest.Mock).mockResolvedValue(null);
    (withRawTx as jest.Mock).mockImplementation((fn: any) =>
      fn({ $queryRawUnsafe: mockTxQuery, $executeRawUnsafe: mockTxExec }),
    );
    mockTxQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT id FROM drivers')) return Promise.resolve([{ id: 'driver-1' }]);
      if (sql.includes('INSERT INTO driver_locations')) {
        return Promise.resolve([
          { id: 'loc-1', location_geojson: JSON.stringify({ type: 'Point', coordinates: [-122.4194, 37.7749] }) },
        ]);
      }
      return Promise.resolve([]);
    });
    mockTxExec.mockResolvedValue(1);
  });

  it('stores a valid battery_level', async () => {
    const res = await POST(createPostRequest(URL_, { ...base, battery_level: 64 }));
    expect(res.status).toBe(201);
    expect(insertedBatteryParam()).toBe(64);
  });

  it('rounds a fractional battery_level to an integer (column is INT)', async () => {
    await POST(createPostRequest(URL_, { ...base, battery_level: 63.7 }));
    expect(insertedBatteryParam()).toBe(64);
  });

  it('stores null when battery_level is absent (iOS Safari has no Battery API)', async () => {
    const res = await POST(createPostRequest(URL_, base));
    expect(res.status).toBe(201);
    expect(insertedBatteryParam()).toBeNull();
  });

  it.each([[150], [-5], ['80'], [{}]])(
    'stores null for an invalid battery_level %p but still records the point',
    async (bad) => {
      const res = await POST(createPostRequest(URL_, { ...base, battery_level: bad }));
      expect(res.status).toBe(201);
      expect(insertedBatteryParam()).toBeNull();
    },
  );
});
