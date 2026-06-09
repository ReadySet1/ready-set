// src/__tests__/api/tracking/locations.test.ts

// The route uses the shared pooled-Prisma raw helpers (`@/lib/db/raw`) instead
// of its own pg.Pool. Mock those helpers. DbHttpError is defined here so the
// route's `throw new DbHttpError` / `instanceof DbHttpError` use the same class.
jest.mock('@/lib/db/raw', () => {
  class DbHttpError extends Error {
    status: number;
    body: any;
    constructor(status: number, body: any) {
      super('db-http-error');
      this.name = 'DbHttpError';
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

// Route gained withAuth in the security-hardening pass — mock it (default ADMIN).
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));

import { withAuth } from '@/lib/auth-middleware';
import { withRawTx, rawQuery } from '@/lib/db/raw';
import { GET, POST } from '@/app/api/tracking/locations/route';
import {
  createGetRequest,
  createPostRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

const mockWithAuth = withAuth as jest.Mock;
const mockWithRawTx = withRawTx as jest.Mock;
const mockRawQuery = rawQuery as jest.Mock;

// Fake interactive-transaction client.
const mockTxQuery = jest.fn();
const mockTxExec = jest.fn();

/** Configure the POST transaction to return a given location row on INSERT. */
function txReturning(record: any, driverRows: any[] = [{ id: 'driver-123' }]) {
  mockTxQuery.mockImplementation((sql: string) => {
    if (sql.includes('SELECT id FROM drivers')) return Promise.resolve(driverRows);
    if (sql.includes('INSERT INTO driver_locations')) return Promise.resolve([record]);
    return Promise.resolve([]);
  });
}

describe('/api/tracking/locations API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithAuth.mockResolvedValue({
      success: true,
      context: { user: { id: 'admin-1', type: 'ADMIN' } },
    });
    mockWithRawTx.mockImplementation((fn: any) =>
      fn({ $queryRawUnsafe: mockTxQuery, $executeRawUnsafe: mockTxExec }),
    );
    mockTxExec.mockResolvedValue(1);
    // Default: driver exists, insert echoes a basic record.
    txReturning({
      id: 'location-default',
      location_geojson: JSON.stringify({ type: 'Point', coordinates: [-97.7431, 30.2672] }),
      recorded_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    mockRawQuery.mockResolvedValue([]);
  });

  describe('POST /api/tracking/locations - Record Driver Location', () => {
    describe('Successful Recording', () => {
      it('should record location with all fields', async () => {
        const locationData = {
          driver_id: 'driver-123',
          latitude: 30.2672,
          longitude: -97.7431,
          accuracy: 10.5,
          speed: 25.0,
          heading: 180,
          altitude: 150,
          battery_level: 85,
          is_moving: true,
          activity_type: 'driving',
        };

        txReturning({
          id: 'location-1',
          location_geojson: JSON.stringify({ type: 'Point', coordinates: [-97.7431, 30.2672] }),
          accuracy: 10.5,
          speed: 25.0,
          heading: 180,
          altitude: 150,
          battery_level: 85,
          is_moving: true,
          activity_type: 'driving',
          recorded_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });

        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', locationData),
        );
        const data = await expectSuccessResponse(response, 201);

        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.id).toBe('location-1');
        expect(data.data.location.coordinates).toEqual([-97.7431, 30.2672]);
      });

      it('should record location with minimal required fields', async () => {
        txReturning({
          id: 'location-2',
          location_geojson: JSON.stringify({ type: 'Point', coordinates: [-97.7431, 30.2672] }),
          accuracy: null,
          speed: null,
          heading: null,
          altitude: null,
          battery_level: null,
          is_moving: null,
          activity_type: null,
          recorded_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });

        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            driver_id: 'driver-123',
            latitude: 30.2672,
            longitude: -97.7431,
          }),
        );
        expect(response.status).toBe(201);
      });
    });

    describe('Validation Tests', () => {
      it('should return 400 for missing driver_id', async () => {
        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            latitude: 30.2672,
            longitude: -97.7431,
          }),
        );
        await expectErrorResponse(response, 400, /Missing required fields/i);
      });

      it('should return 400 for missing latitude', async () => {
        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            driver_id: 'driver-123',
            longitude: -97.7431,
          }),
        );
        await expectErrorResponse(response, 400, /Missing required fields/i);
      });

      it('should return 400 for missing longitude', async () => {
        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            driver_id: 'driver-123',
            latitude: 30.2672,
          }),
        );
        await expectErrorResponse(response, 400, /Missing required fields/i);
      });

      it('should return 400 for invalid latitude (out of range)', async () => {
        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            driver_id: 'driver-123',
            latitude: 91,
            longitude: -97.7431,
          }),
        );
        await expectErrorResponse(response, 400, /Invalid coordinates/i);
      });

      it('should return 400 for invalid latitude (negative out of range)', async () => {
        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            driver_id: 'driver-123',
            latitude: -91,
            longitude: -97.7431,
          }),
        );
        await expectErrorResponse(response, 400, /Invalid coordinates/i);
      });

      it('should return 400 for invalid longitude (out of range)', async () => {
        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            driver_id: 'driver-123',
            latitude: 30.2672,
            longitude: 181,
          }),
        );
        await expectErrorResponse(response, 400, /Invalid coordinates/i);
      });

      it('should return 400 for invalid longitude (negative out of range)', async () => {
        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            driver_id: 'driver-123',
            latitude: 30.2672,
            longitude: -181,
          }),
        );
        await expectErrorResponse(response, 400, /Invalid coordinates/i);
      });

      it('should accept valid boundary coordinates', async () => {
        txReturning({
          id: 'location-3',
          location_geojson: JSON.stringify({ type: 'Point', coordinates: [180, 90] }),
          recorded_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });

        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            driver_id: 'driver-123',
            latitude: 90,
            longitude: 180,
          }),
        );
        expect(response.status).toBe(201);
      });
    });

    describe('Driver Verification', () => {
      it('should return 404 for non-existent driver', async () => {
        mockTxQuery.mockImplementation((sql: string) => {
          if (sql.includes('SELECT id FROM drivers')) return Promise.resolve([]);
          return Promise.resolve([]);
        });
        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            driver_id: 'non-existent',
            latitude: 30.2672,
            longitude: -97.7431,
          }),
        );
        await expectErrorResponse(response, 404, /Driver not found or inactive/i);
      });

      it('should return 404 for inactive driver', async () => {
        mockTxQuery.mockImplementation((sql: string) => {
          if (sql.includes('SELECT id FROM drivers')) return Promise.resolve([]);
          return Promise.resolve([]);
        });
        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            driver_id: 'inactive-driver',
            latitude: 30.2672,
            longitude: -97.7431,
          }),
        );
        await expectErrorResponse(response, 404, /Driver not found or inactive/i);
      });
    });

    describe('Database State Verification', () => {
      it('should update driver last_known_location with parameterized geometry', async () => {
        txReturning({
          id: 'location-4',
          location_geojson: JSON.stringify({ type: 'Point', coordinates: [-97.7431, 30.2672] }),
          recorded_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });

        await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            driver_id: 'driver-123',
            latitude: 30.2672,
            longitude: -97.7431,
          }),
        );

        // Security hardening: coordinates are bound as numeric params via
        // ST_MakePoint, never string-interpolated. The denormalized driver
        // update is the $executeRawUnsafe call.
        const updateCall = mockTxExec.mock.calls[0];
        expect(updateCall[0]).toContain('UPDATE drivers');
        expect(updateCall[0]).toContain('ST_MakePoint');
        expect(updateCall.slice(1)).toEqual([-97.7431, 30.2672, 'driver-123']);
      });

      it('should not apply the driver update when the insert fails (atomic rollback)', async () => {
        mockTxQuery.mockImplementation((sql: string) => {
          if (sql.includes('SELECT id FROM drivers')) return Promise.resolve([{ id: 'driver-123' }]);
          if (sql.includes('INSERT INTO driver_locations')) return Promise.reject(new Error('Database error'));
          return Promise.resolve([]);
        });

        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            driver_id: 'driver-123',
            latitude: 30.2672,
            longitude: -97.7431,
          }),
        );
        expect(response.status).toBe(500);
        // Transaction rolls back (Prisma) — the UPDATE drivers statement never runs.
        expect(mockTxExec).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when the transaction fails to start (connection error)', async () => {
        mockWithRawTx.mockRejectedValueOnce(new Error('Connection failed'));

        const response = await POST(
          createPostRequest('http://localhost:3000/api/tracking/locations', {
            driver_id: 'driver-123',
            latitude: 30.2672,
            longitude: -97.7431,
          }),
        );
        // All DB access is now inside the try/catch, so a connection failure is a
        // graceful 500 rather than an unhandled throw.
        await expectErrorResponse(response, 500, /Failed to record location/i);
      });
    });
  });

  describe('GET /api/tracking/locations - Location History', () => {
    describe('Successful Retrieval', () => {
      it('should return location history for a driver', async () => {
        const mockLocations = [
          {
            id: 'loc-1',
            location_geojson: JSON.stringify({ type: 'Point', coordinates: [-97.7431, 30.2672] }),
            accuracy: 10,
            speed: 25,
            heading: 180,
            altitude: 150,
            battery_level: 85,
            is_moving: true,
            activity_type: 'driving',
            recorded_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
          {
            id: 'loc-2',
            location_geojson: JSON.stringify({ type: 'Point', coordinates: [-97.7531, 30.2772] }),
            accuracy: 15,
            speed: 30,
            heading: 90,
            altitude: 155,
            battery_level: 80,
            is_moving: true,
            activity_type: 'driving',
            recorded_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        ];

        mockRawQuery.mockResolvedValueOnce(mockLocations);

        const response = await GET(
          createGetRequest('http://localhost:3000/api/tracking/locations?driver_id=driver-123'),
        );
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data.data[0].location.coordinates).toEqual([-97.7431, 30.2672]);
        expect(data.metadata.driver_id).toBe('driver-123');
        expect(data.metadata.total_points).toBe(2);
      });

      it('should use default hours parameter (24)', async () => {
        mockRawQuery.mockResolvedValueOnce([]);
        await GET(createGetRequest('http://localhost:3000/api/tracking/locations?driver_id=driver-123'));
        const queryCall = mockRawQuery.mock.calls[0];
        expect(queryCall[0]).toContain('24 hours');
      });

      it('should use custom hours parameter', async () => {
        mockRawQuery.mockResolvedValueOnce([]);
        await GET(createGetRequest('http://localhost:3000/api/tracking/locations?driver_id=driver-123&hours=48'));
        const queryCall = mockRawQuery.mock.calls[0];
        expect(queryCall[0]).toContain('48 hours');
      });

      it('should use default limit (100)', async () => {
        mockRawQuery.mockResolvedValueOnce([]);
        await GET(createGetRequest('http://localhost:3000/api/tracking/locations?driver_id=driver-123'));
        const queryCall = mockRawQuery.mock.calls[0];
        expect(queryCall[1]).toContain(100); // [driver_id, limit]
      });

      it('should use custom limit parameter', async () => {
        mockRawQuery.mockResolvedValueOnce([]);
        await GET(createGetRequest('http://localhost:3000/api/tracking/locations?driver_id=driver-123&limit=50'));
        const queryCall = mockRawQuery.mock.calls[0];
        expect(queryCall[1]).toContain(50);
      });

      it('should return empty array when no locations found', async () => {
        mockRawQuery.mockResolvedValueOnce([]);
        const response = await GET(
          createGetRequest('http://localhost:3000/api/tracking/locations?driver_id=driver-123'),
        );
        const data = await expectSuccessResponse(response, 200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(0);
        expect(data.metadata.total_points).toBe(0);
      });
    });

    describe('Validation Tests', () => {
      it('should return 400 for missing driver_id', async () => {
        const response = await GET(createGetRequest('http://localhost:3000/api/tracking/locations'));
        await expectErrorResponse(response, 400, /Missing driver_id parameter/i);
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        mockRawQuery.mockRejectedValueOnce(new Error('Database error'));
        const response = await GET(
          createGetRequest('http://localhost:3000/api/tracking/locations?driver_id=driver-123'),
        );
        await expectErrorResponse(response, 500, /Failed to fetch location history/i);
      });
    });
  });
});
