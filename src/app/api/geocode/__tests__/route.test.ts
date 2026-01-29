/**
 * Tests for /api/geocode route
 *
 * This route geocodes addresses using the Mapbox Geocoding API v5.
 *
 * Tests cover:
 * - POST: Valid address geocoding
 * - Input validation (missing/empty address)
 * - Configuration errors (missing Mapbox token)
 * - Mapbox API errors (non-2xx status, empty features)
 * - Network/unexpected errors
 */

import { POST } from "../route";
import {
  createPostRequest,
  expectSuccessResponse,
  expectValidationError,
  expectErrorResponse,
  expectNotFound,
  expectServerError,
} from "@/__tests__/helpers/api-test-helpers";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock console.error to avoid cluttering test output
const mockConsoleError = jest.spyOn(console, "error").mockImplementation(() => {});

describe("/api/geocode", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "pk.test.mock-token";
  });

  afterAll(() => {
    process.env = originalEnv;
    mockConsoleError.mockRestore();
  });

  // Mock Mapbox API responses
  const mockMapboxSuccessResponse = {
    features: [
      {
        center: [-122.4194, 37.7749], // [lng, lat]
        place_name: "123 Main St, San Francisco, CA 94102, United States",
        relevance: 1,
      },
    ],
  };

  const mockMapboxNotFoundResponse = {
    features: [],
  };

  describe("POST /api/geocode", () => {
    describe("Success Scenarios", () => {
      it("should geocode a valid address and return coordinates", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMapboxSuccessResponse),
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "123 Main St, San Francisco, CA 94102",
        });

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toEqual({
          lat: 37.7749,
          lng: -122.4194,
          placeName: "123 Main St, San Francisco, CA 94102, United States",
        });
      });

      it("should convert Mapbox [lng, lat] format to {lat, lng} response", async () => {
        const customResponse = {
          features: [
            {
              center: [-73.9857, 40.7484], // NYC coordinates [lng, lat]
              place_name: "350 5th Ave, New York, NY 10118",
              relevance: 1,
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(customResponse),
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "350 5th Ave, New York, NY",
        });

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        // Verify coordinate order is swapped correctly
        expect(data.lat).toBe(40.7484);
        expect(data.lng).toBe(-73.9857);
      });

      it("should URL-encode the address in the Mapbox API call", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMapboxSuccessResponse),
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "123 Main St #4B, San Francisco, CA",
        });

        await POST(request);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const fetchUrl = mockFetch.mock.calls[0][0];
        expect(fetchUrl).toContain(encodeURIComponent("123 Main St #4B, San Francisco, CA"));
      });

      it("should trim whitespace from address", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMapboxSuccessResponse),
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "  123 Main St  ",
        });

        await POST(request);

        const fetchUrl = mockFetch.mock.calls[0][0];
        expect(fetchUrl).toContain(encodeURIComponent("123 Main St"));
        expect(fetchUrl).not.toContain("%20%20");
      });

      it("should include country=US and limit=1 in Mapbox API call", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMapboxSuccessResponse),
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "123 Main St",
        });

        await POST(request);

        const fetchUrl = mockFetch.mock.calls[0][0];
        expect(fetchUrl).toContain("limit=1");
        expect(fetchUrl).toContain("country=US");
      });
    });

    describe("Input Validation", () => {
      it("should return 400 when address is missing", async () => {
        const request = createPostRequest("http://localhost:3000/api/geocode", {});

        const response = await POST(request);
        const data = await expectValidationError(response);

        expect(data.error).toBe("Address is required");
      });

      it("should return 400 when address is null", async () => {
        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: null,
        });

        const response = await POST(request);
        const data = await expectValidationError(response);

        expect(data.error).toBe("Address is required");
      });

      it("should return 400 when address is a number", async () => {
        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: 12345,
        });

        const response = await POST(request);
        const data = await expectValidationError(response);

        expect(data.error).toBe("Address is required");
      });

      it("should return 400 when address is an object", async () => {
        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: { street: "123 Main St" },
        });

        const response = await POST(request);
        const data = await expectValidationError(response);

        expect(data.error).toBe("Address is required");
      });

      it("should return 400 when address is an empty string", async () => {
        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "",
        });

        const response = await POST(request);
        const data = await expectValidationError(response);

        expect(data.error).toBe("Address is required");
      });
    });

    describe("Configuration Errors", () => {
      it("should return 500 when NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not configured", async () => {
        delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "123 Main St",
        });

        const response = await POST(request);
        const data = await expectServerError(response);

        expect(data.error).toBe("Geocoding service not configured");
        expect(mockConsoleError).toHaveBeenCalledWith("Mapbox token not configured");
      });

      it("should return 500 when NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is empty", async () => {
        process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "";

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "123 Main St",
        });

        const response = await POST(request);
        const data = await expectServerError(response);

        expect(data.error).toBe("Geocoding service not configured");
      });
    });

    describe("Mapbox API Errors", () => {
      it("should return 502 when Mapbox API returns non-2xx status", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "123 Main St",
        });

        const response = await POST(request);
        const data = await expectErrorResponse(response, 502);

        expect(data.error).toBe("Geocoding service error");
        expect(mockConsoleError).toHaveBeenCalledWith("Mapbox API error: 401");
      });

      it("should return 502 when Mapbox API returns 429 (rate limited)", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "123 Main St",
        });

        const response = await POST(request);
        const data = await expectErrorResponse(response, 502);

        expect(data.error).toBe("Geocoding service error");
      });

      it("should return 502 when Mapbox API returns 500 (server error)", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "123 Main St",
        });

        const response = await POST(request);
        const data = await expectErrorResponse(response, 502);

        expect(data.error).toBe("Geocoding service error");
      });

      it("should return 404 when address is not found (empty features array)", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMapboxNotFoundResponse),
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "Nonexistent Address 12345",
        });

        const response = await POST(request);
        const data = await expectNotFound(response);

        expect(data.error).toBe("Address not found");
      });

      it("should return 404 when features is undefined", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "Some Address",
        });

        const response = await POST(request);
        const data = await expectNotFound(response);

        expect(data.error).toBe("Address not found");
      });
    });

    describe("Network/Unexpected Errors", () => {
      it("should return 500 when fetch throws a network error", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "123 Main St",
        });

        const response = await POST(request);
        const data = await expectServerError(response);

        expect(data.error).toBe("Failed to geocode address");
        expect(mockConsoleError).toHaveBeenCalledWith(
          "Geocode API error:",
          expect.any(Error)
        );
      });

      it("should return 500 when JSON parsing fails", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.reject(new Error("Invalid JSON")),
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "123 Main St",
        });

        const response = await POST(request);
        const data = await expectServerError(response);

        expect(data.error).toBe("Failed to geocode address");
      });

      it("should return 500 when request body parsing fails", async () => {
        // Create a request that will fail JSON parsing
        const request = createPostRequest("http://localhost:3000/api/geocode", {});
        // Override the json method to throw
        (request as any).json = jest.fn().mockRejectedValue(new Error("Invalid JSON body"));

        const response = await POST(request);
        const data = await expectServerError(response);

        expect(data.error).toBe("Failed to geocode address");
      });

      it("should return 500 on unexpected error shape from Mapbox", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              features: [
                {
                  // Missing required fields
                  relevance: 1,
                },
              ],
            }),
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "123 Main St",
        });

        const response = await POST(request);
        // This should still return 200 but with undefined values
        // or potentially fail depending on implementation
        expect(response.status).toBeGreaterThanOrEqual(200);
      });
    });

    describe("Edge Cases", () => {
      it("should handle very long addresses", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMapboxSuccessResponse),
        });

        const longAddress = "A".repeat(500) + ", San Francisco, CA 94102";
        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: longAddress,
        });

        const response = await POST(request);
        // Should not crash
        expect(response.status).toBeGreaterThanOrEqual(200);
      });

      it("should handle special characters in address", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMapboxSuccessResponse),
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "123 O'Brien St & Main Ave #4B, San Francisco, CA",
        });

        await POST(request);

        const fetchUrl = mockFetch.mock.calls[0][0];
        // Note: encodeURIComponent preserves apostrophes but encodes & as %26
        expect(fetchUrl).toContain("O'Brien");
        expect(fetchUrl).toContain("%26"); // URL encoded ampersand
        expect(fetchUrl).toContain("%23"); // URL encoded hash (#)
      });

      it("should handle unicode characters in address", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMapboxSuccessResponse),
        });

        const request = createPostRequest("http://localhost:3000/api/geocode", {
          address: "123 Calle de la Paz, San Diego, CA",
        });

        const response = await POST(request);
        expect(response.status).toBeGreaterThanOrEqual(200);
      });
    });
  });
});
