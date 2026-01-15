/**
 * Tests for /api/calculator/save route
 *
 * Tests cover:
 * - POST: Save calculation results to database
 * - Authentication enforcement
 * - Input validation (required fields)
 * - CalculatorService integration
 * - Error handling
 */

import { POST } from '../route';
import { createClient } from '@/utils/supabase/server';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import {
  createPostRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectValidationError,
  expectServerError,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/calculator/calculator-service', () => ({
  CalculatorService: {
    saveCalculationHistory: jest.fn(),
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCalculatorService = CalculatorService as jest.Mocked<typeof CalculatorService>;

describe('/api/calculator/save', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
  };

  const validSaveData = {
    templateId: 'template-123',
    input: {
      headcount: 50,
      foodCost: 500,
      mileage: 5,
      deliveryArea: 'downtown',
      requiresBridge: false,
    },
    result: {
      baseFee: 25,
      mileageFee: 12.5,
      bridgeFee: 0,
      additionalStopsFee: 0,
      tipAmount: 0,
      adjustments: 0,
      totalDeliveryCost: 37.5,
      foodCost: 500,
      grandTotal: 537.5,
      breakdown: [],
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

    // Default: successful save
    (mockCalculatorService.saveCalculationHistory as jest.Mock).mockResolvedValue(undefined);
  });

  describe('POST /api/calculator/save', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/save',
          validSaveData
        );

        const response = await POST(request);
        const data = await expectUnauthorized(response);
        expect(data.error).toContain('Unauthorized');
      });
    });

    describe('Input Validation', () => {
      it('should return 400 when templateId is missing', async () => {
        const invalidData = {
          input: validSaveData.input,
          result: validSaveData.result,
        };

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/save',
          invalidData
        );

        const response = await POST(request);
        const data = await expectValidationError(response);
        expect(data.error).toContain('Missing required fields');
      });

      it('should return 400 when input is missing', async () => {
        const invalidData = {
          templateId: 'template-123',
          result: validSaveData.result,
        };

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/save',
          invalidData
        );

        const response = await POST(request);
        const data = await expectValidationError(response);
        expect(data.error).toContain('Missing required fields');
      });

      it('should return 400 when result is missing', async () => {
        const invalidData = {
          templateId: 'template-123',
          input: validSaveData.input,
        };

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/save',
          invalidData
        );

        const response = await POST(request);
        const data = await expectValidationError(response);
        expect(data.error).toContain('Missing required fields');
      });

      it('should return 400 when all required fields are missing', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/calculator/save',
          {}
        );

        const response = await POST(request);
        const data = await expectValidationError(response);
        expect(data.error).toContain('Missing required fields');
      });
    });

    describe('Successful Save', () => {
      it('should save calculation successfully', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/calculator/save',
          validSaveData
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.message).toBe('Calculation saved successfully');
        expect(data.data).toHaveProperty('templateId', 'template-123');
        expect(data.data).toHaveProperty('userId', 'test-user-id');
        expect(data.data).toHaveProperty('timestamp');
      });

      it('should call CalculatorService.saveCalculationHistory with correct parameters', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/calculator/save',
          validSaveData
        );

        await POST(request);

        expect(mockCalculatorService.saveCalculationHistory).toHaveBeenCalledWith(
          mockSupabase,
          validSaveData.templateId,
          validSaveData.input,
          validSaveData.result,
          undefined, // clientConfigId not provided
          mockUser.id
        );
      });

      it('should pass clientConfigId when provided', async () => {
        const dataWithClientConfig = {
          ...validSaveData,
          clientConfigId: 'config-123',
        };

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/save',
          dataWithClientConfig
        );

        await POST(request);

        expect(mockCalculatorService.saveCalculationHistory).toHaveBeenCalledWith(
          mockSupabase,
          validSaveData.templateId,
          validSaveData.input,
          validSaveData.result,
          'config-123',
          mockUser.id
        );
      });

      it('should include clientConfigId in response when provided', async () => {
        const dataWithClientConfig = {
          ...validSaveData,
          clientConfigId: 'config-123',
        };

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/save',
          dataWithClientConfig
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data).toHaveProperty('clientConfigId', 'config-123');
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when service throws error', async () => {
        (mockCalculatorService.saveCalculationHistory as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/save',
          validSaveData
        );

        const response = await POST(request);
        await expectServerError(response);
      });

      it('should include error message in 500 response', async () => {
        (mockCalculatorService.saveCalculationHistory as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/save',
          validSaveData
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toContain('Failed to save calculation');
      });
    });

    describe('Complex Input Scenarios', () => {
      it('should handle calculation with all input fields', async () => {
        const fullInput = {
          templateId: 'template-123',
          clientConfigId: 'config-123',
          input: {
            headcount: 150,
            foodCost: 2500,
            mileage: 15,
            deliveryArea: 'suburbs',
            mileageRate: 2.5,
            requiresBridge: true,
            stops: 3,
            tips: 50,
            adjustments: -25,
          },
          result: {
            baseFee: 45,
            mileageFee: 37.5,
            bridgeFee: 10,
            additionalStopsFee: 15,
            tipAmount: 50,
            adjustments: -25,
            totalDeliveryCost: 132.5,
            foodCost: 2500,
            grandTotal: 2632.5,
            breakdown: [
              { name: 'Base Fee', amount: 45 },
              { name: 'Mileage', amount: 37.5 },
              { name: 'Bridge Fee', amount: 10 },
              { name: 'Additional Stops', amount: 15 },
            ],
          },
        };

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/save',
          fullInput
        );

        const response = await POST(request);
        await expectSuccessResponse(response, 200);

        expect(mockCalculatorService.saveCalculationHistory).toHaveBeenCalledWith(
          mockSupabase,
          fullInput.templateId,
          fullInput.input,
          fullInput.result,
          fullInput.clientConfigId,
          mockUser.id
        );
      });

      it('should handle minimal input with zeros', async () => {
        const minimalInput = {
          templateId: 'template-123',
          input: {
            headcount: 0,
            foodCost: 0,
          },
          result: {
            totalDeliveryCost: 0,
            foodCost: 0,
            grandTotal: 0,
          },
        };

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/save',
          minimalInput
        );

        const response = await POST(request);
        await expectSuccessResponse(response, 200);
      });
    });
  });
});
