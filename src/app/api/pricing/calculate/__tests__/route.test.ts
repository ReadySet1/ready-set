/**
 * Tests for /api/pricing/calculate route
 *
 * This route is REVENUE CRITICAL as it calculates order pricing
 *
 * Tests cover:
 * - POST: Price calculation with validation
 * - Input validation (types, positive values)
 * - PricingService integration
 * - Error handling
 * - Method restrictions (GET, PUT, DELETE not allowed)
 */

import { NextRequest } from "next/server";
import { POST, GET, PUT, DELETE } from "../route";
import { PricingService } from "@/services/pricing/pricing.service";
import {
  createPostRequest,
  createGetRequest,
  expectSuccessResponse,
  expectValidationError,
  expectServerError,
  expectErrorResponse,
} from "@/__tests__/helpers/api-test-helpers";

// Mock PricingService
jest.mock("@/services/pricing/pricing.service", () => ({
  PricingService: jest.fn().mockImplementation(() => ({
    calculatePrice: jest.fn(),
  })),
}));

const MockedPricingService = PricingService as jest.MockedClass<typeof PricingService>;

describe("/api/pricing/calculate", () => {
  let mockCalculatePrice: jest.Mock;

  const validPricingData = {
    headCount: 50,
    foodCost: 500.00,
    hasTip: true,
  };

  const mockCalculationResult = {
    headCount: 50,
    foodCost: 500.00,
    hasTip: true,
    deliveryFee: 75.00,
    serviceFee: 50.00,
    tip: 62.50,
    totalCost: 687.50,
    breakdown: {
      foodCost: 500.00,
      deliveryFee: 75.00,
      serviceFee: 50.00,
      tip: 62.50,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockCalculatePrice = jest.fn().mockResolvedValue(mockCalculationResult);
    MockedPricingService.mockImplementation(() => ({
      calculatePrice: mockCalculatePrice,
    }) as any);
  });

  describe("POST /api/pricing/calculate", () => {
    it("should calculate pricing successfully", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        validPricingData
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockCalculationResult);
      expect(data.message).toContain("calculated successfully");
    });

    it("should call PricingService.calculatePrice with correct parameters", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        validPricingData
      );

      await POST(request);

      expect(mockCalculatePrice).toHaveBeenCalledWith(
        validPricingData.headCount,
        validPricingData.foodCost,
        validPricingData.hasTip
      );
    });

    it("should require headCount field", async () => {
      const { headCount, ...dataWithoutHeadCount } = validPricingData;

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        dataWithoutHeadCount
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("headCount");
    });

    it("should require foodCost field", async () => {
      const { foodCost, ...dataWithoutFoodCost } = validPricingData;

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        dataWithoutFoodCost
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("foodCost");
    });

    it("should require hasTip field", async () => {
      const { hasTip, ...dataWithoutHasTip } = validPricingData;

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        dataWithoutHasTip
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("hasTip");
    });

    it("should validate headCount is a number", async () => {
      const invalidData = {
        ...validPricingData,
        headCount: "not-a-number",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        invalidData
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("invalid required fields");
    });

    it("should validate foodCost is a number", async () => {
      const invalidData = {
        ...validPricingData,
        foodCost: "not-a-number",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        invalidData
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("invalid required fields");
    });

    it("should validate hasTip is a boolean", async () => {
      const invalidData = {
        ...validPricingData,
        hasTip: "not-a-boolean",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        invalidData
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("invalid required fields");
    });

    it("should reject zero headCount", async () => {
      const invalidData = {
        ...validPricingData,
        headCount: 0,
      };

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        invalidData
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("positive numbers");
    });

    it("should reject negative headCount", async () => {
      const invalidData = {
        ...validPricingData,
        headCount: -10,
      };

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        invalidData
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("positive numbers");
    });

    it("should reject zero foodCost", async () => {
      const invalidData = {
        ...validPricingData,
        foodCost: 0,
      };

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        invalidData
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("positive numbers");
    });

    it("should reject negative foodCost", async () => {
      const invalidData = {
        ...validPricingData,
        foodCost: -100,
      };

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        invalidData
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("positive numbers");
    });

    it("should handle PricingService errors", async () => {
      mockCalculatePrice.mockRejectedValue(new Error("Pricing calculation failed"));

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        validPricingData
      );

      const response = await POST(request);
      await expectServerError(response);
    });

    it("should calculate pricing without tip", async () => {
      const dataWithoutTip = {
        ...validPricingData,
        hasTip: false,
      };

      const resultWithoutTip = {
        ...mockCalculationResult,
        hasTip: false,
        tip: 0,
        totalCost: 625.00,
      };

      mockCalculatePrice.mockResolvedValue(resultWithoutTip);

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        dataWithoutTip
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.data.hasTip).toBe(false);
      expect(data.data.tip).toBe(0);
    });

    it("should handle small orders", async () => {
      const smallOrder = {
        headCount: 1,
        foodCost: 10.00,
        hasTip: false,
      };

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        smallOrder
      );

      const response = await POST(request);
      await expectSuccessResponse(response, 200);

      expect(mockCalculatePrice).toHaveBeenCalledWith(1, 10.00, false);
    });

    it("should handle large orders", async () => {
      const largeOrder = {
        headCount: 1000,
        foodCost: 50000.00,
        hasTip: true,
      };

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        largeOrder
      );

      const response = await POST(request);
      await expectSuccessResponse(response, 200);

      expect(mockCalculatePrice).toHaveBeenCalledWith(1000, 50000.00, true);
    });

    it("should handle decimal values for headCount", async () => {
      const dataWithDecimalHeadCount = {
        ...validPricingData,
        headCount: 50.5,
      };

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        dataWithDecimalHeadCount
      );

      const response = await POST(request);
      await expectSuccessResponse(response, 200);

      expect(mockCalculatePrice).toHaveBeenCalledWith(50.5, 500.00, true);
    });

    it("should handle decimal values for foodCost", async () => {
      const dataWithDecimalFoodCost = {
        ...validPricingData,
        foodCost: 123.45,
      };

      const request = createPostRequest(
        "http://localhost:3000/api/pricing/calculate",
        dataWithDecimalFoodCost
      );

      const response = await POST(request);
      await expectSuccessResponse(response, 200);

      expect(mockCalculatePrice).toHaveBeenCalledWith(50, 123.45, true);
    });
  });

  describe("GET /api/pricing/calculate", () => {
    it("should return 405 Method Not Allowed", async () => {
      const response = await GET();
      const data = await expectErrorResponse(response, 405);

      expect(data.success).toBe(false);
      expect(data.error).toContain("Method not allowed");
      expect(data.error).toContain("POST");
    });
  });

  describe("PUT /api/pricing/calculate", () => {
    it("should return 405 Method Not Allowed", async () => {
      const response = await PUT();
      const data = await expectErrorResponse(response, 405);

      expect(data.success).toBe(false);
      expect(data.error).toContain("Method not allowed");
      expect(data.error).toContain("POST");
    });
  });

  describe("DELETE /api/pricing/calculate", () => {
    it("should return 405 Method Not Allowed", async () => {
      const response = await DELETE();
      const data = await expectErrorResponse(response, 405);

      expect(data.success).toBe(false);
      expect(data.error).toContain("Method not allowed");
      expect(data.error).toContain("POST");
    });
  });
});
