/**
 * Tests for /api/tracking/locations route
 *
 * This route handles driver location tracking (POST to record, GET to retrieve history).
 *
 * Tests cover:
 * - POST: Recording driver location updates
 * - GET: Fetching location history
 * - Input validation (coordinates, driver_id)
 * - Coordinate range validation
 * - Driver existence checks
 * - Pagination and filtering
 * - Error handling
 */

import { NextRequest } from "next/server";
import {
  createPostRequest,
  createRequestWithParams,
  expectSuccessResponse,
  expectValidationError,
  expectNotFound,
  expectServerError,
} from "@/__tests__/helpers/api-test-helpers";

// Mock pg Pool - define mocks inside the factory and export them
jest.mock("pg", () => {
  // Create mock client
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  // Create mock pool instance
  const mockPoolInstance = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
  };

  // Expose mocks for test configuration
  return {
    Pool: jest.fn().mockImplementation(() => mockPoolInstance),
    __mockClient: mockClient,
    __mockPoolInstance: mockPoolInstance,
  };
});

// Import route handlers after mocking
import { POST, GET } from "../route";

// Get references to the mocks for test configuration
const pg = require("pg");
const mockClient = pg.__mockClient;
const mockPoolInstance = pg.__mockPoolInstance;

describe("/api/tracking/locations", () => {
  const mockDriverId = "driver-123";
  const mockLocationData = {
    driver_id: mockDriverId,
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 10,
    speed: 25.5,
    heading: 180,
    altitude: 50,
    battery_level: 85,
    is_moving: true,
    activity_type: "driving" as const,
  };

  const mockLocationRecord = {
    id: "location-1",
    location_geojson: JSON.stringify({
      type: "Point",
      coordinates: [-122.4194, 37.7749],
    }),
    accuracy: 10,
    speed: 25.5,
    heading: 180,
    altitude: 50,
    battery_level: 85,
    is_moving: true,
    activity_type: "driving",
    recorded_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset connect to return our mock client
    mockPoolInstance.connect.mockResolvedValue(mockClient);

    // Default client query implementation: driver exists and is active
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes("SELECT id FROM drivers")) {
        return Promise.resolve({ rows: [{ id: mockDriverId }] });
      }
      if (sql.includes("INSERT INTO driver_locations")) {
        return Promise.resolve({ rows: [mockLocationRecord] });
      }
      if (sql.includes("UPDATE drivers")) {
        return Promise.resolve({ rows: [] });
      }
      if (
        sql.includes("BEGIN") ||
        sql.includes("COMMIT") ||
        sql.includes("ROLLBACK")
      ) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    // Default pool query for GET requests
    mockPoolInstance.query.mockResolvedValue({ rows: [] });
  });

  describe("POST /api/tracking/locations", () => {
    describe("Input validation", () => {
      it("should return 400 when driver_id is missing", async () => {
        const { driver_id, ...dataWithoutDriverId } = mockLocationData;

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          dataWithoutDriverId
        );

        const response = await POST(request);
        await expectValidationError(response, /driver_id/);
      });

      it("should return 400 when latitude is missing", async () => {
        const { latitude, ...dataWithoutLat } = mockLocationData;

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          dataWithoutLat
        );

        const response = await POST(request);
        await expectValidationError(response, /latitude|longitude/);
      });

      it("should return 400 when longitude is missing", async () => {
        const { longitude, ...dataWithoutLng } = mockLocationData;

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          dataWithoutLng
        );

        const response = await POST(request);
        await expectValidationError(response, /latitude|longitude/);
      });

      it("should return 400 when latitude is not a number", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          {
            ...mockLocationData,
            latitude: "invalid",
          }
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should return 400 when longitude is not a number", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          {
            ...mockLocationData,
            longitude: "invalid",
          }
        );

        const response = await POST(request);
        await expectValidationError(response);
      });
    });

    describe("Coordinate range validation", () => {
      it("should return 400 when latitude is below -90", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          {
            ...mockLocationData,
            latitude: -91,
          }
        );

        const response = await POST(request);
        await expectValidationError(response, /Invalid coordinates/);
      });

      it("should return 400 when latitude is above 90", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          {
            ...mockLocationData,
            latitude: 91,
          }
        );

        const response = await POST(request);
        await expectValidationError(response, /Invalid coordinates/);
      });

      it("should return 400 when longitude is below -180", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          {
            ...mockLocationData,
            longitude: -181,
          }
        );

        const response = await POST(request);
        await expectValidationError(response, /Invalid coordinates/);
      });

      it("should return 400 when longitude is above 180", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          {
            ...mockLocationData,
            longitude: 181,
          }
        );

        const response = await POST(request);
        await expectValidationError(response, /Invalid coordinates/);
      });

      it("should accept valid edge case coordinates (-90, -180)", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          {
            ...mockLocationData,
            latitude: -90,
            longitude: -180,
          }
        );

        const response = await POST(request);
        const data = await response.json();
        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
      });

      it("should accept valid edge case coordinates (90, 180)", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          {
            ...mockLocationData,
            latitude: 90,
            longitude: 180,
          }
        );

        const response = await POST(request);
        const data = await response.json();
        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
      });
    });

    describe("Driver validation", () => {
      it("should return 404 when driver does not exist", async () => {
        mockClient.query.mockImplementation((sql: string) => {
          if (sql.includes("SELECT id FROM drivers")) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        });

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          {
            ...mockLocationData,
            driver_id: "non-existent-driver",
          }
        );

        const response = await POST(request);
        await expectNotFound(response);
      });

      it("should return 404 when driver is inactive", async () => {
        mockClient.query.mockImplementation((sql: string) => {
          if (sql.includes("SELECT id FROM drivers")) {
            // Query includes "is_active = true", so inactive driver returns empty
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        });

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          mockLocationData
        );

        const response = await POST(request);
        await expectNotFound(response);
      });
    });

    describe("Successful location recording", () => {
      it("should create location record and return 201", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          mockLocationData
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.location).toBeDefined();
      });

      it("should include all optional fields in the response", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          mockLocationData
        );

        const response = await POST(request);
        const data = await response.json();

        expect(data.data.accuracy).toBe(10);
        expect(data.data.speed).toBe(25.5);
        expect(data.data.heading).toBe(180);
        expect(data.data.battery_level).toBe(85);
        expect(data.data.is_moving).toBe(true);
        expect(data.data.activity_type).toBe("driving");
      });

      it("should record location with minimal required fields", async () => {
        const minimalData = {
          driver_id: mockDriverId,
          latitude: 37.7749,
          longitude: -122.4194,
        };

        mockClient.query.mockImplementation((sql: string) => {
          if (sql.includes("SELECT id FROM drivers")) {
            return Promise.resolve({ rows: [{ id: mockDriverId }] });
          }
          if (sql.includes("INSERT INTO driver_locations")) {
            return Promise.resolve({
              rows: [
                {
                  ...mockLocationRecord,
                  accuracy: null,
                  speed: null,
                  heading: null,
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        });

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          minimalData
        );

        const response = await POST(request);
        expect(response.status).toBe(201);
      });
    });

    describe("Error handling", () => {
      it("should return 500 when database insert fails", async () => {
        mockClient.query.mockImplementation((sql: string) => {
          if (sql.includes("SELECT id FROM drivers")) {
            return Promise.resolve({ rows: [{ id: mockDriverId }] });
          }
          if (sql.includes("INSERT INTO driver_locations")) {
            return Promise.reject(new Error("Database insert failed"));
          }
          return Promise.resolve({ rows: [] });
        });

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          mockLocationData
        );

        const response = await POST(request);
        await expectServerError(response);
      });

      it("should rollback transaction on error", async () => {
        let rollbackCalled = false;
        mockClient.query.mockImplementation((sql: string) => {
          if (sql.includes("ROLLBACK")) {
            rollbackCalled = true;
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes("SELECT id FROM drivers")) {
            return Promise.resolve({ rows: [{ id: mockDriverId }] });
          }
          if (sql.includes("INSERT INTO driver_locations")) {
            return Promise.reject(new Error("Insert failed"));
          }
          return Promise.resolve({ rows: [] });
        });

        const request = createPostRequest(
          "http://localhost:3000/api/tracking/locations",
          mockLocationData
        );

        await POST(request);

        expect(rollbackCalled).toBe(true);
      });
    });
  });

  describe("GET /api/tracking/locations", () => {
    const mockLocationHistory = [
      {
        ...mockLocationRecord,
        id: "location-1",
        recorded_at: new Date("2025-01-15T10:00:00Z").toISOString(),
      },
      {
        ...mockLocationRecord,
        id: "location-2",
        recorded_at: new Date("2025-01-15T10:05:00Z").toISOString(),
      },
      {
        ...mockLocationRecord,
        id: "location-3",
        recorded_at: new Date("2025-01-15T10:10:00Z").toISOString(),
      },
    ];

    beforeEach(() => {
      mockPoolInstance.query.mockResolvedValue({ rows: mockLocationHistory });
    });

    describe("Input validation", () => {
      it("should return 400 when driver_id is missing", async () => {
        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/locations",
          {
            hours: "24",
          }
        );

        const response = await GET(request);
        await expectValidationError(response, /driver_id/);
      });
    });

    describe("Successful retrieval", () => {
      it("should return location history for driver", async () => {
        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/locations",
          {
            driver_id: mockDriverId,
          }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(3);
        expect(data.metadata).toBeDefined();
        expect(data.metadata.driver_id).toBe(mockDriverId);
      });

      it("should use default hours (24) when not specified", async () => {
        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/locations",
          {
            driver_id: mockDriverId,
          }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.metadata.hours_requested).toBe(24);
      });

      it("should respect custom hours parameter", async () => {
        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/locations",
          {
            driver_id: mockDriverId,
            hours: "48",
          }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.metadata.hours_requested).toBe(48);
      });

      it("should use default limit (100) when not specified", async () => {
        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/locations",
          {
            driver_id: mockDriverId,
          }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.metadata.total_points).toBe(3);
      });

      it("should respect custom limit parameter", async () => {
        mockPoolInstance.query.mockResolvedValue({
          rows: [mockLocationHistory[0]],
        });

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/locations",
          {
            driver_id: mockDriverId,
            limit: "1",
          }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data).toHaveLength(1);
      });

      it("should transform location_geojson to location object", async () => {
        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/locations",
          {
            driver_id: mockDriverId,
          }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data[0].location).toBeDefined();
        expect(data.data[0].location.type).toBe("Point");
        expect(data.data[0].location.coordinates).toEqual([-122.4194, 37.7749]);
      });

      it("should return empty array when no locations found", async () => {
        mockPoolInstance.query.mockResolvedValue({ rows: [] });

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/locations",
          {
            driver_id: mockDriverId,
          }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data).toHaveLength(0);
        expect(data.metadata.total_points).toBe(0);
      });
    });

    describe("Error handling", () => {
      it("should return 500 when database query fails", async () => {
        mockPoolInstance.query.mockRejectedValue(
          new Error("Database query failed")
        );

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/locations",
          {
            driver_id: mockDriverId,
          }
        );

        const response = await GET(request);
        await expectServerError(response);
      });

      it("should include error details in response", async () => {
        mockPoolInstance.query.mockRejectedValue(
          new Error("Specific database error")
        );

        const request = createRequestWithParams(
          "http://localhost:3000/api/tracking/locations",
          {
            driver_id: mockDriverId,
          }
        );

        const response = await GET(request);
        const data = await response.json();

        expect(data.details).toBeDefined();
      });
    });
  });
});
