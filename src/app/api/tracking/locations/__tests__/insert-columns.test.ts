/**
 * Regression test for the driver_locations INSERT column list.
 *
 * Bug: the INSERT/RETURNING/SELECT referenced an `activity_type` column that
 * does not exist on driver_locations, so every location write failed. Fix:
 * `activity_type` was removed and the denormalized `latitude`/`longitude`
 * columns are now written.
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
    TRACKING_STATEMENT_TIMEOUT_MS: 8000,
    withRawTx: jest.fn(),
    rawQuery: jest.fn(),
    rawExec: jest.fn(),
  };
});
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: jest.fn() }));

import { createPostRequest } from '@/__tests__/helpers/api-test-helpers';
import { withAuth } from '@/lib/auth-middleware';
import { withRawTx } from '@/lib/db/raw';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { POST } from '../route';

const mockWithAuth = withAuth as jest.Mock;
const mockWithRawTx = withRawTx as jest.Mock;
const mockEnforceRateLimit = enforceRateLimit as jest.Mock;

const mockTxQuery = jest.fn();
const mockTxExec = jest.fn();

const validBody = { driver_id: 'driver-1', latitude: 37.7749, longitude: -122.4194 };

describe('locations POST — INSERT columns regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithAuth.mockResolvedValue({ success: true, context: { user: { id: 'admin-1', type: 'ADMIN' } } });
    mockEnforceRateLimit.mockResolvedValue(null);
    mockWithRawTx.mockImplementation((fn: any) =>
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

  it('does not reference the non-existent activity_type column', async () => {
    await POST(createPostRequest('http://localhost:3000/api/tracking/locations', validBody));

    const insertCall = mockTxQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO driver_locations'),
    );
    expect(insertCall).toBeDefined();
    const sql = insertCall![0] as string;
    expect(sql).not.toContain('activity_type');
    // The fix also denormalizes lat/long into their own columns.
    expect(sql).toContain('latitude');
    expect(sql).toContain('longitude');
  });
});

/**
 * Regression test for the uuid/text cast bug.
 *
 * Bug: `WHERE id = $1` compared the uuid `drivers.id` column against a
 * text-bound Prisma param, so Postgres threw
 * `operator does not exist: uuid = text` and every GPS write 500'd. Every
 * drivers-id comparison in this route must cast the param to ::uuid.
 */
describe('locations POST — uuid cast regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
    mockWithRawTx.mockImplementation((fn: any) =>
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

  it('casts the driver-id param to ::uuid in the DRIVER ownership check', async () => {
    mockWithAuth.mockResolvedValue({ success: true, context: { user: { id: 'auth-1', type: 'DRIVER' } } });

    await POST(createPostRequest('http://localhost:3000/api/tracking/locations', validBody));

    const ownershipCall = mockTxQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('SELECT id FROM drivers'),
    );
    expect(ownershipCall).toBeDefined();
    expect(ownershipCall![0]).toContain('id = $1::uuid');
  });

  it('casts the driver-id param to ::uuid in the ADMIN existence check', async () => {
    mockWithAuth.mockResolvedValue({ success: true, context: { user: { id: 'admin-1', type: 'ADMIN' } } });

    await POST(createPostRequest('http://localhost:3000/api/tracking/locations', validBody));

    const ownershipCall = mockTxQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('SELECT id FROM drivers'),
    );
    expect(ownershipCall).toBeDefined();
    expect(ownershipCall![0]).toContain('id = $1::uuid');
  });

  it('casts the driver-id param to ::uuid in the last-known-location UPDATE', async () => {
    mockWithAuth.mockResolvedValue({ success: true, context: { user: { id: 'admin-1', type: 'ADMIN' } } });

    await POST(createPostRequest('http://localhost:3000/api/tracking/locations', validBody));

    const updateCall = mockTxExec.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('UPDATE drivers'),
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![0]).toContain('WHERE id = $3::uuid');
  });

  it('casts the driver-id param to ::uuid in the driver_locations INSERT', async () => {
    mockWithAuth.mockResolvedValue({ success: true, context: { user: { id: 'admin-1', type: 'ADMIN' } } });

    await POST(createPostRequest('http://localhost:3000/api/tracking/locations', validBody));

    const insertCall = mockTxQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO driver_locations'),
    );
    expect(insertCall).toBeDefined();
    // driver_id ($1) goes into a uuid column; Prisma binds it as text, so the
    // VALUES expression must cast or PG throws "column is of type uuid but
    // expression is of type text".
    expect(insertCall![0]).toContain('VALUES ($1::uuid');
  });
});
