// src/__tests__/api/tracking/locations.test.ts

// Create shared mock storage - the actual mock functions get assigned in beforeEach
const mocks = {
  clientQuery: jest.fn(),
  release: jest.fn(),
  poolQuery: jest.fn(),
  connect: jest.fn(),
};

// Must mock pg before importing the route
jest.mock('pg', () => {
  // Access mocks through the shared object to avoid hoisting issues
  const getMocks = () => require('./locations.test').mocks || {
    clientQuery: jest.fn(),
    release: jest.fn(),
    poolQuery: jest.fn(),
    connect: jest.fn(),
  };

  return {
    Pool: jest.fn().mockImplementation(() => ({
      connect: (...args: unknown[]) => getMocks().connect(...args),
      query: (...args: unknown[]) => getMocks().poolQuery(...args),
    })),
  };
});

// Export mocks for the pg mock to access
module.exports = { mocks };

import { GET, POST } from '@/app/api/tracking/locations/route';
import {
  createGetRequest,
  createPostRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

describe('/api/tracking/locations API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset connect mock to return a client with query and release
    mocks.connect.mockResolvedValue({
      query: mocks.clientQuery,
      release: mocks.release,
    });
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

        // Mock transaction queries
        mocks.clientQuery
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'driver-123' }] }) // Driver check
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'location-1',
                location_geojson: JSON.stringify({
                  type: 'Point',
                  coordinates: [-97.7431, 30.2672],
                }),
                accuracy: 10.5,
                speed: 25.0,
                heading: 180,
                altitude: 150,
                battery_level: 85,
                is_moving: true,
                activity_type: 'driving',
                recorded_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
            ],
          }) // INSERT location
          .mockResolvedValueOnce({}) // UPDATE driver location
          .mockResolvedValueOnce({}); // COMMIT

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          locationData
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 201);

        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.id).toBe('location-1');
        expect(data.data.location.coordinates).toEqual([-97.7431, 30.2672]);
      });

      it('should record location with minimal required fields', async () => {
        const locationData = {
          driver_id: 'driver-123',
          latitude: 30.2672,
          longitude: -97.7431,
        };

        mocks.clientQuery
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'driver-123' }] }) // Driver check
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'location-2',
                location_geojson: JSON.stringify({
                  type: 'Point',
                  coordinates: [-97.7431, 30.2672],
                }),
                accuracy: null,
                speed: null,
                heading: null,
                altitude: null,
                battery_level: null,
                is_moving: null,
                activity_type: null,
                recorded_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
            ],
          }) // INSERT location
          .mockResolvedValueOnce({}) // UPDATE driver
          .mockResolvedValueOnce({}); // COMMIT

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          locationData
        );

        const response = await POST(request);
        expect(response.status).toBe(201);
      });
    });

    describe('Validation Tests', () => {
      it('should return 400 for missing driver_id', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          {
            latitude: 30.2672,
            longitude: -97.7431,
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, /Missing required fields/i);
      });

      it('should return 400 for missing latitude', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          {
            driver_id: 'driver-123',
            longitude: -97.7431,
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, /Missing required fields/i);
      });

      it('should return 400 for missing longitude', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          {
            driver_id: 'driver-123',
            latitude: 30.2672,
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, /Missing required fields/i);
      });

      it('should return 400 for invalid latitude (out of range)', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          {
            driver_id: 'driver-123',
            latitude: 91, // Invalid: > 90
            longitude: -97.7431,
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, /Invalid coordinates/i);
      });

      it('should return 400 for invalid latitude (negative out of range)', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          {
            driver_id: 'driver-123',
            latitude: -91, // Invalid: < -90
            longitude: -97.7431,
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, /Invalid coordinates/i);
      });

      it('should return 400 for invalid longitude (out of range)', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          {
            driver_id: 'driver-123',
            latitude: 30.2672,
            longitude: 181, // Invalid: > 180
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, /Invalid coordinates/i);
      });

      it('should return 400 for invalid longitude (negative out of range)', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          {
            driver_id: 'driver-123',
            latitude: 30.2672,
            longitude: -181, // Invalid: < -180
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, /Invalid coordinates/i);
      });

      it('should accept valid boundary coordinates', async () => {
        const locationData = {
          driver_id: 'driver-123',
          latitude: 90, // Valid boundary
          longitude: 180, // Valid boundary
        };

        mocks.clientQuery
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'driver-123' }] }) // Driver check
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'location-3',
                location_geojson: JSON.stringify({
                  type: 'Point',
                  coordinates: [180, 90],
                }),
                recorded_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({})
          .mockResolvedValueOnce({});

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          locationData
        );

        const response = await POST(request);
        expect(response.status).toBe(201);
      });
    });

    describe('Driver Verification', () => {
      it('should return 404 for non-existent driver', async () => {
        mocks.clientQuery
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({ rows: [] }); // Driver check - no driver found

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          {
            driver_id: 'non-existent',
            latitude: 30.2672,
            longitude: -97.7431,
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 404, /Driver not found or inactive/i);
      });

      it('should return 404 for inactive driver', async () => {
        // Driver exists but is_active = false won't be returned by the query
        mocks.clientQuery
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({ rows: [] }); // Driver check - inactive drivers not returned

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          {
            driver_id: 'inactive-driver',
            latitude: 30.2672,
            longitude: -97.7431,
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 404, /Driver not found or inactive/i);
      });
    });

    describe('Database State Verification', () => {
      it('should update driver last_known_location after recording', async () => {
        const locationData = {
          driver_id: 'driver-123',
          latitude: 30.2672,
          longitude: -97.7431,
        };

        mocks.clientQuery
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'driver-123' }] }) // Driver check
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'location-4',
                location_geojson: JSON.stringify({
                  type: 'Point',
                  coordinates: [-97.7431, 30.2672],
                }),
                recorded_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({}) // UPDATE driver location
          .mockResolvedValueOnce({}); // COMMIT

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          locationData
        );

        await POST(request);

        // Verify driver update query was called with correct POINT string
        const updateCall = mocks.clientQuery.mock.calls[3];
        expect(updateCall[0]).toContain('UPDATE drivers');
        expect(updateCall[1]).toContain('POINT(-97.7431 30.2672)');
      });

      it('should rollback transaction on error', async () => {
        mocks.clientQuery
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'driver-123' }] }) // Driver check
          .mockRejectedValueOnce(new Error('Database error')); // INSERT fails

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          {
            driver_id: 'driver-123',
            latitude: 30.2672,
            longitude: -97.7431,
          }
        );

        const response = await POST(request);
        expect(response.status).toBe(500);

        // Verify ROLLBACK was called
        expect(mocks.clientQuery).toHaveBeenCalledWith('ROLLBACK');
      });
    });

    describe('Error Handling', () => {
      it('should handle database connection errors', async () => {
        mocks.connect.mockRejectedValueOnce(new Error('Connection failed'));

        const request = createPostRequest(
          'http://localhost:3000/api/tracking/locations',
          {
            driver_id: 'driver-123',
            latitude: 30.2672,
            longitude: -97.7431,
          }
        );

        // Note: Connection errors occur before the try-catch in the route,
        // so we expect the error to propagate (status 500 or thrown error)
        await expect(POST(request)).rejects.toThrow('Connection failed');
      });
    });
  });

  describe('GET /api/tracking/locations - Location History', () => {
    describe('Successful Retrieval', () => {
      it('should return location history for a driver', async () => {
        const mockLocations = [
          {
            id: 'loc-1',
            location_geojson: JSON.stringify({
              type: 'Point',
              coordinates: [-97.7431, 30.2672],
            }),
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
            location_geojson: JSON.stringify({
              type: 'Point',
              coordinates: [-97.7531, 30.2772],
            }),
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

        mocks.poolQuery.mockResolvedValueOnce({ rows: mockLocations });

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/locations?driver_id=driver-123'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data.data[0].location.coordinates).toEqual([-97.7431, 30.2672]);
        expect(data.metadata.driver_id).toBe('driver-123');
        expect(data.metadata.total_points).toBe(2);
      });

      it('should use default hours parameter (24)', async () => {
        mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/locations?driver_id=driver-123'
        );

        await GET(request);

        const queryCall = mocks.poolQuery.mock.calls[0];
        expect(queryCall[0]).toContain("24 hours");
      });

      it('should use custom hours parameter', async () => {
        mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/locations?driver_id=driver-123&hours=48'
        );

        await GET(request);

        const queryCall = mocks.poolQuery.mock.calls[0];
        expect(queryCall[0]).toContain("48 hours");
      });

      it('should use default limit (100)', async () => {
        mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/locations?driver_id=driver-123'
        );

        await GET(request);

        const queryCall = mocks.poolQuery.mock.calls[0];
        expect(queryCall[1]).toContain(100); // limit parameter
      });

      it('should use custom limit parameter', async () => {
        mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/locations?driver_id=driver-123&limit=50'
        );

        await GET(request);

        const queryCall = mocks.poolQuery.mock.calls[0];
        expect(queryCall[1]).toContain(50);
      });

      it('should return empty array when no locations found', async () => {
        mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/locations?driver_id=driver-123'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(0);
        expect(data.metadata.total_points).toBe(0);
      });
    });

    describe('Validation Tests', () => {
      it('should return 400 for missing driver_id', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/tracking/locations'
        );

        const response = await GET(request);
        await expectErrorResponse(response, 400, /Missing driver_id parameter/i);
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        mocks.poolQuery.mockRejectedValueOnce(new Error('Database error'));

        const request = createGetRequest(
          'http://localhost:3000/api/tracking/locations?driver_id=driver-123'
        );

        const response = await GET(request);
        await expectErrorResponse(response, 500, /Failed to fetch location history/i);
      });
    });
  });
});
