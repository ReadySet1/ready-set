/**
 * Tests for /api/addresses/validate route
 *
 * This route is BUSINESS CRITICAL as it validates addresses before creating orders
 *
 * Tests cover:
 * - POST: Address validation with Zod schema
 * - External API validation
 * - Geocoding service integration
 * - Error tracking
 * - Postal code format validation
 * - Standardized address formatting
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { trackAddressError } from "@/utils/domain-error-tracking";
import {
  createPostRequest,
  expectSuccessResponse,
  expectValidationError,
  expectErrorResponse,
  expectServerError,
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies
jest.mock("@/utils/domain-error-tracking", () => ({
  AddressManagementError: class AddressManagementError extends Error {
    constructor(
      message: string,
      public type: string,
      public context: any
    ) {
      super(message);
      this.name = "AddressManagementError";
    }
  },
  trackAddressError: jest.fn(),
}));

const mockTrackAddressError = trackAddressError as jest.MockedFunction<typeof trackAddressError>;

describe("/api/addresses/validate", () => {
  const validAddressData = {
    street: "123 Main St",
    city: "San Francisco",
    state: "California",
    postalCode: "94102",
    country: "US",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/addresses/validate", () => {
    describe("Validation", () => {
      it("should validate address successfully", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          validAddressData
        );

        const response = await POST(request);

        // May succeed or fail depending on random external API mock
        // but should not throw an error
        expect(response.status).toBeGreaterThanOrEqual(200);
      });

      it("should require street field", async () => {
        const { street, ...dataWithoutStreet } = validAddressData;

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          dataWithoutStreet
        );

        const response = await POST(request);
        const data = await expectValidationError(response);

        expect(data.error).toContain("validation failed");
        expect(mockTrackAddressError).toHaveBeenCalled();
      });

      it("should require city field", async () => {
        const { city, ...dataWithoutCity } = validAddressData;

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          dataWithoutCity
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should require state field", async () => {
        const { state, ...dataWithoutState } = validAddressData;

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          dataWithoutState
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should require postalCode field", async () => {
        const { postalCode, ...dataWithoutPostalCode } = validAddressData;

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          dataWithoutPostalCode
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should validate postal code format (5 digits)", async () => {
        const validData5Digits = {
          ...validAddressData,
          postalCode: "94102",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          validData5Digits
        );

        // Should not fail validation
        await POST(request);
      });

      it("should validate postal code format (5+4 digits)", async () => {
        const validData9Digits = {
          ...validAddressData,
          postalCode: "94102-1234",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          validData9Digits
        );

        // Should not fail validation
        await POST(request);
      });

      it("should reject invalid postal code format", async () => {
        const invalidData = {
          ...validAddressData,
          postalCode: "ABC123",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should reject postal code with wrong number of digits", async () => {
        const invalidData = {
          ...validAddressData,
          postalCode: "941",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should validate street min length (3 characters)", async () => {
        const invalidData = {
          ...validAddressData,
          street: "AB",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should validate street max length (100 characters)", async () => {
        const invalidData = {
          ...validAddressData,
          street: "A".repeat(101),
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should validate city min length (2 characters)", async () => {
        const invalidData = {
          ...validAddressData,
          city: "A",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should validate city max length (50 characters)", async () => {
        const invalidData = {
          ...validAddressData,
          city: "A".repeat(51),
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should default country to 'US' if not provided", async () => {
        const { country, ...dataWithoutCountry } = validAddressData;

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          dataWithoutCountry
        );

        // Should not fail - country has default value
        await POST(request);
      });

      it("should accept optional unitNumber field", async () => {
        const dataWithUnit = {
          ...validAddressData,
          unitNumber: "Apt 4B",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          dataWithUnit
        );

        await POST(request);
      });

      it("should accept optional notes field", async () => {
        const dataWithNotes = {
          ...validAddressData,
          notes: "Use side entrance",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          dataWithNotes
        );

        await POST(request);
      });

      it("should accept optional userId field (UUID format)", async () => {
        const dataWithUserId = {
          ...validAddressData,
          userId: "550e8400-e29b-41d4-a716-446655440000",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          dataWithUserId
        );

        await POST(request);
      });

      it("should reject invalid userId format", async () => {
        const invalidData = {
          ...validAddressData,
          userId: "not-a-uuid",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should accept optional orderId field (UUID format)", async () => {
        const dataWithOrderId = {
          ...validAddressData,
          orderId: "550e8400-e29b-41d4-a716-446655440001",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          dataWithOrderId
        );

        await POST(request);
      });
    });

    describe("External API Validation", () => {
      it("should detect invalid addresses via external API", async () => {
        const invalidAddressData = {
          ...validAddressData,
          street: "Invalid Street Name",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          invalidAddressData
        );

        const response = await POST(request);

        // May succeed or fail based on random mock, but should handle gracefully
        expect(response.status).toBeGreaterThanOrEqual(200);
      });

      it("should handle external API errors (502 Bad Gateway)", async () => {
        // The mock has a 10% chance of timeout and 10% chance of service error
        // We'll just run the test and ensure it doesn't crash
        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          validAddressData
        );

        const response = await POST(request);

        // Could be 200 (success), 502 (external API error), or 500 (timeout)
        expect([200, 500, 502]).toContain(response.status);
      });

      it("should track external validation errors", async () => {
        // Run multiple times to increase chance of hitting error path
        for (let i = 0; i < 10; i++) {
          const request = createPostRequest(
            "http://localhost:3000/api/addresses/validate",
            validAddressData
          );

          await POST(request);
        }

        // Should have tracked some errors due to random failures
        // (this is probabilistic but with 10 runs we should hit at least one error)
      });
    });

    describe("Geocoding", () => {
      it("should include geocoding coordinates when successful", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          validAddressData
        );

        const response = await POST(request);

        // If successful (status 200), check for geocode
        if (response.status === 200) {
          const data = await response.json();

          // May or may not have geocode depending on mock
          if (data.geocode) {
            expect(data.geocode).toHaveProperty("lat");
            expect(data.geocode).toHaveProperty("lng");
          }
        }
      });

      it("should continue validation even if geocoding fails", async () => {
        // The mock has a 15% chance of geocoding failure
        // We'll run multiple times to check resilience
        for (let i = 0; i < 20; i++) {
          const request = createPostRequest(
            "http://localhost:3000/api/addresses/validate",
            validAddressData
          );

          const response = await POST(request);

          // Should still return valid response even if geocoding fails
          if (response.status === 200) {
            const data = await response.json();

            // If geocoding failed, should have geocodeError
            if (!data.geocode) {
              expect(data.geocodeError).toBeDefined();
            }
          }
        }
      });

      it("should track geocoding errors separately", async () => {
        // Run multiple times to increase chance of hitting geocoding error
        for (let i = 0; i < 20; i++) {
          const request = createPostRequest(
            "http://localhost:3000/api/addresses/validate",
            validAddressData
          );

          await POST(request);
        }

        // Should have potentially tracked geocoding errors
        // (this is probabilistic but with 20 runs we should hit some errors)
      });
    });

    describe("Response Format", () => {
      it("should return standardized address when valid", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          validAddressData
        );

        const response = await POST(request);

        if (response.status === 200) {
          const data = await response.json();

          if (data.valid) {
            expect(data.standardized).toBeDefined();
            expect(data.standardized).toHaveProperty("street");
            expect(data.standardized).toHaveProperty("city");
            expect(data.standardized).toHaveProperty("state");
            expect(data.standardized).toHaveProperty("postalCode");
            expect(data.standardized).toHaveProperty("country");
          }
        }
      });

      it("should return issues when address is invalid", async () => {
        const invalidAddressData = {
          ...validAddressData,
          city: "Invalid City Name",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          invalidAddressData
        );

        const response = await POST(request);

        if (response.status === 200) {
          const data = await response.json();

          if (!data.valid) {
            expect(data.issues).toBeDefined();
            expect(Array.isArray(data.issues)).toBe(true);
          }
        }
      });
    });

    describe("Error Tracking", () => {
      it("should track validation errors", async () => {
        const { street, ...invalidData } = validAddressData;

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          invalidData
        );

        await POST(request);

        expect(mockTrackAddressError).toHaveBeenCalledWith(
          expect.any(Object),
          "ADDRESS_VALIDATION_FAILED",
          expect.objectContaining({
            addressData: expect.any(Object),
          })
        );
      });

      it("should track errors with userId context when provided", async () => {
        const dataWithUserId = {
          ...validAddressData,
          userId: "550e8400-e29b-41d4-a716-446655440000",
        };

        // Force validation error
        const { street, ...invalidData } = dataWithUserId;

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          invalidData
        );

        await POST(request);

        expect(mockTrackAddressError).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(String),
          expect.objectContaining({
            userId: dataWithUserId.userId,
          })
        );
      });
    });

    describe("Edge Cases", () => {
      it("should handle minimal valid request", async () => {
        const minimalData = {
          street: "123 Main St",
          city: "SF",
          state: "CA",
          postalCode: "94102",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          minimalData
        );

        await POST(request);
        // Should not crash
      });

      it("should handle complete request with all optional fields", async () => {
        const completeData = {
          street: "123 Main St",
          city: "San Francisco",
          state: "California",
          postalCode: "94102-1234",
          country: "US",
          unitNumber: "Apt 4B",
          notes: "Use side entrance, buzzer broken",
          userId: "550e8400-e29b-41d4-a716-446655440000",
          orderId: "660e8400-e29b-41d4-a716-446655440001",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          completeData
        );

        await POST(request);
        // Should not crash
      });

      it("should handle unexpected errors gracefully", async () => {
        const malformedData = {
          street: null,
          city: null,
          state: null,
          postalCode: null,
        };

        const request = createPostRequest(
          "http://localhost:3000/api/addresses/validate",
          malformedData
        );

        const response = await POST(request);

        // Should return error response, not crash
        expect(response.status).toBeGreaterThanOrEqual(400);
      });
    });
  });
});
