/**
 * Tests for /api/calculator/calculate route
 *
 * This route is REVENUE CRITICAL as it calculates delivery costs
 *
 * Tests cover:
 * - GET: Retrieve calculator configuration
 * - POST: Calculate delivery costs with template
 * - Authentication enforcement
 * - Input validation
 * - CalculatorService integration
 * - History saving
 * - Error handling
 */

import { NextRequest } from "next/server";
import { POST, GET } from "../route";
import { createClient } from "@/utils/supabase/server";
import { CalculatorService } from "@/lib/calculator/calculator-service";
import { ConfigurationError, CalculatorError } from "@/types/calculator";
import {
  createPostRequest,
  createRequestWithParams,
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectValidationError,
  expectServerError,
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies
jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/calculator/calculator-service", () => ({
  CalculatorService: {
    calculate: jest.fn(),
    saveCalculationHistory: jest.fn(),
    getCalculatorConfig: jest.fn(),
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCalculatorService = CalculatorService as jest.Mocked<typeof CalculatorService>;

describe("/api/calculator/calculate", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
    aud: "authenticated",
    role: "authenticated",
  };

  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
  };

  const validCalculationData = {
    templateId: "template-id-123",
    distance: 10.5,
    weight: 25,
    customFields: {
      urgency: "standard",
      packageType: "box",
    },
  };

  const mockCalculationResult = {
    baseFee: 50.00,
    distanceFee: 21.00,
    weightFee: 12.50,
    totalCost: 83.50,
    breakdown: {
      baseFee: 50.00,
      distanceFee: 21.00,
      weightFee: 12.50,
      urgencyFee: 0,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mockCreateClient.mockResolvedValue(mockSupabase as any);

    // Default: successful calculation
    mockCalculatorService.calculate.mockResolvedValue(mockCalculationResult);
    mockCalculatorService.saveCalculationHistory.mockResolvedValue(undefined);
    mockCalculatorService.getCalculatorConfig.mockResolvedValue({
      templateId: "template-id-123",
      name: "Standard Delivery",
      fields: [],
    });
  });

  describe("POST /api/calculator/calculate", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        validCalculationData
      );

      const response = await POST(request);
      await expectUnauthorized(response, "Unauthorized");
    });

    it("should calculate delivery costs successfully", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        validCalculationData
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockCalculationResult);
      expect(data).toHaveProperty("timestamp");
    });

    it("should call CalculatorService.calculate with correct parameters", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        validCalculationData
      );

      await POST(request);

      expect(mockCalculatorService.calculate).toHaveBeenCalledWith(
        mockSupabase,
        validCalculationData.templateId,
        expect.objectContaining({
          customFields: expect.objectContaining({
            ...validCalculationData.customFields,
            userId: mockUser.id,
          }),
        }),
        undefined,
        mockUser.id
      );
    });

    it("should require templateId field", async () => {
      const { templateId, ...dataWithoutTemplateId } = validCalculationData;

      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        dataWithoutTemplateId
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("Template ID is required");
    });

    it("should save calculation history when saveHistory is true", async () => {
      const dataWithHistory = {
        ...validCalculationData,
        saveHistory: true,
      };

      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        dataWithHistory
      );

      await POST(request);

      expect(mockCalculatorService.saveCalculationHistory).toHaveBeenCalledWith(
        mockSupabase,
        validCalculationData.templateId,
        expect.any(Object),
        mockCalculationResult,
        undefined,
        mockUser.id
      );
    });

    it("should not save calculation history when saveHistory is false", async () => {
      const dataWithoutHistory = {
        ...validCalculationData,
        saveHistory: false,
      };

      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        dataWithoutHistory
      );

      await POST(request);

      expect(mockCalculatorService.saveCalculationHistory).not.toHaveBeenCalled();
    });

    it("should not save calculation history by default", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        validCalculationData
      );

      await POST(request);

      expect(mockCalculatorService.saveCalculationHistory).not.toHaveBeenCalled();
    });

    it("should pass clientConfigId when provided", async () => {
      const dataWithClientConfig = {
        ...validCalculationData,
        clientConfigId: "client-config-123",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        dataWithClientConfig
      );

      await POST(request);

      expect(mockCalculatorService.calculate).toHaveBeenCalledWith(
        mockSupabase,
        validCalculationData.templateId,
        expect.any(Object),
        "client-config-123",
        mockUser.id
      );
    });

    it("should inject userId into customFields", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        validCalculationData
      );

      await POST(request);

      expect(mockCalculatorService.calculate).toHaveBeenCalledWith(
        mockSupabase,
        expect.any(String),
        expect.objectContaining({
          customFields: expect.objectContaining({
            userId: mockUser.id,
          }),
        }),
        undefined,
        mockUser.id
      );
    });

    it("should handle ConfigurationError with 400 status", async () => {
      mockCalculatorService.calculate.mockRejectedValue(
        new ConfigurationError("Invalid template configuration")
      );

      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        validCalculationData
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("Invalid template configuration");
    });

    it("should handle CalculatorError with 400 status", async () => {
      mockCalculatorService.calculate.mockRejectedValue(
        new CalculatorError("Calculation failed: invalid input")
      );

      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        validCalculationData
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("Calculation failed");
    });

    it("should handle generic errors with 500 status", async () => {
      mockCalculatorService.calculate.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        validCalculationData
      );

      const response = await POST(request);
      await expectServerError(response);
    });

    it("should handle calculation with minimal input", async () => {
      const minimalData = {
        templateId: "template-id-123",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        minimalData
      );

      const response = await POST(request);
      await expectSuccessResponse(response, 200);
    });

    it("should handle calculation with all optional fields", async () => {
      const fullData = {
        templateId: "template-id-123",
        distance: 10.5,
        weight: 25,
        clientConfigId: "client-config-123",
        saveHistory: true,
        customFields: {
          urgency: "express",
          packageType: "fragile",
          specialHandling: true,
        },
      };

      const request = createPostRequest(
        "http://localhost:3000/api/calculator/calculate",
        fullData
      );

      const response = await POST(request);
      await expectSuccessResponse(response, 200);

      expect(mockCalculatorService.calculate).toHaveBeenCalled();
      expect(mockCalculatorService.saveCalculationHistory).toHaveBeenCalled();
    });
  });

  describe("GET /api/calculator/calculate", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createRequestWithParams(
        "http://localhost:3000/api/calculator/calculate",
        { templateId: "template-id-123" }
      );

      const response = await GET(request);
      await expectUnauthorized(response, "Unauthorized");
    });

    it("should retrieve calculator configuration successfully", async () => {
      const request = createRequestWithParams(
        "http://localhost:3000/api/calculator/calculate",
        { templateId: "template-id-123" }
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("templateId");
      expect(data).toHaveProperty("timestamp");
    });

    it("should require templateId parameter", async () => {
      const request = createGetRequest("http://localhost:3000/api/calculator/calculate");

      const response = await GET(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("Template ID is required");
    });

    it("should call getCalculatorConfig with correct parameters", async () => {
      const request = createRequestWithParams(
        "http://localhost:3000/api/calculator/calculate",
        { templateId: "template-id-123" }
      );

      await GET(request);

      expect(mockCalculatorService.getCalculatorConfig).toHaveBeenCalledWith(
        "template-id-123",
        undefined
      );
    });

    it("should pass clientConfigId when provided", async () => {
      const request = createRequestWithParams(
        "http://localhost:3000/api/calculator/calculate",
        {
          templateId: "template-id-123",
          clientConfigId: "client-config-123",
        }
      );

      await GET(request);

      expect(mockCalculatorService.getCalculatorConfig).toHaveBeenCalledWith(
        "template-id-123",
        "client-config-123"
      );
    });

    it("should handle ConfigurationError with 400 status", async () => {
      mockCalculatorService.getCalculatorConfig.mockRejectedValue(
        new ConfigurationError("Template not found")
      );

      const request = createRequestWithParams(
        "http://localhost:3000/api/calculator/calculate",
        { templateId: "invalid-id" }
      );

      const response = await GET(request);
      const data = await expectValidationError(response);
      expect(data.error).toContain("Template not found");
    });

    it("should handle generic errors with 500 status", async () => {
      mockCalculatorService.getCalculatorConfig.mockRejectedValue(
        new Error("Database error")
      );

      const request = createRequestWithParams(
        "http://localhost:3000/api/calculator/calculate",
        { templateId: "template-id-123" }
      );

      const response = await GET(request);
      await expectServerError(response);
    });
  });
});
