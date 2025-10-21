// src/__tests__/api/calculator/calculate.test.ts

import { createGetRequest, createPostRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/calculator/calculator-service', () => ({
  CalculatorService: {
    calculate: jest.fn(),
    saveCalculationHistory: jest.fn(),
    getCalculatorConfig: jest.fn(),
  },
}));

jest.mock('@/types/calculator', () => ({
  CalculationInputSchema: {
    parse: jest.fn((input) => input),
  },
  ConfigurationError: class ConfigurationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ConfigurationError';
    }
  },
  CalculatorError: class CalculatorError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'CalculatorError';
    }
  },
}));

import { GET, POST } from '@/app/api/calculator/calculate/route';
import { createClient } from '@/utils/supabase/server';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import { CalculationInputSchema, ConfigurationError, CalculatorError } from '@/types/calculator';

describe('/api/calculator/calculate API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('POST /api/calculator/calculate', () => {
    describe('✅ Successful Calculations', () => {
      it('should calculate delivery costs with valid input', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.calculate as jest.Mock).mockResolvedValue({
          totalCost: 150.00,
          breakdown: {
            baseRate: 100.00,
            distanceCharge: 50.00,
          },
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/calculate', {
          templateId: 'template-123',
          distance: 10,
          weight: 50,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('totalCost', 150.00);
        expect(data).toHaveProperty('timestamp');
      });

      it('should save calculation to history when saveHistory is true', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-456', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.calculate as jest.Mock).mockResolvedValue({
          totalCost: 200.00,
        });
        (CalculatorService.saveCalculationHistory as jest.Mock).mockResolvedValue(undefined);

        const request = createPostRequest('http://localhost:3000/api/calculator/calculate', {
          templateId: 'template-123',
          distance: 15,
          saveHistory: true,
        });

        await POST(request);

        expect(CalculatorService.saveCalculationHistory).toHaveBeenCalledTimes(1);
        expect(CalculatorService.saveCalculationHistory).toHaveBeenCalledWith(
          mockSupabaseClient,
          'template-123',
          expect.any(Object),
          expect.objectContaining({ totalCost: 200.00 }),
          undefined,
          'user-456'
        );
      });

      it('should not save to history when saveHistory is false', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-789', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.calculate as jest.Mock).mockResolvedValue({
          totalCost: 180.00,
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/calculate', {
          templateId: 'template-123',
          distance: 12,
          saveHistory: false,
        });

        await POST(request);

        expect(CalculatorService.saveCalculationHistory).not.toHaveBeenCalled();
      });

      it('should handle calculations with client configuration', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-999', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.calculate as jest.Mock).mockResolvedValue({
          totalCost: 250.00,
          appliedConfig: 'client-config-123',
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/calculate', {
          templateId: 'template-123',
          clientConfigId: 'client-config-123',
          distance: 20,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(CalculatorService.calculate).toHaveBeenCalledWith(
          mockSupabaseClient,
          'template-123',
          expect.any(Object),
          'client-config-123',
          'user-999'
        );
      });

      it('should include custom fields in calculation input', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-111', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.calculate as jest.Mock).mockResolvedValue({
          totalCost: 175.00,
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/calculate', {
          templateId: 'template-123',
          distance: 10,
          customFields: {
            priority: 'high',
            specialHandling: true,
          },
        });

        await POST(request);

        expect(CalculationInputSchema.parse).toHaveBeenCalledWith(
          expect.objectContaining({
            distance: 10,
            customFields: expect.objectContaining({
              priority: 'high',
              specialHandling: true,
              userId: 'user-111',
            }),
          })
        );
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/calculate', {
          templateId: 'template-123',
          distance: 10,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Unauthorized');
      });

      it('should not perform calculation when unauthorized', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/calculate', {
          templateId: 'template-123',
          distance: 10,
        });

        await POST(request);

        expect(CalculatorService.calculate).not.toHaveBeenCalled();
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 when templateId is missing', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/calculate', {
          distance: 10,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Template ID is required');
      });

      it('should return 400 when templateId is empty string', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/calculate', {
          templateId: '',
          distance: 10,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Template ID is required');
      });

      it('should handle ConfigurationError from validation', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.calculate as jest.Mock).mockRejectedValue(
          new ConfigurationError('Invalid template configuration')
        );

        const request = createPostRequest('http://localhost:3000/api/calculator/calculate', {
          templateId: 'invalid-template',
          distance: 10,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid template configuration');
      });

      it('should handle CalculatorError from calculation', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.calculate as jest.Mock).mockRejectedValue(
          new CalculatorError('Calculation failed: invalid distance')
        );

        const request = createPostRequest('http://localhost:3000/api/calculator/calculate', {
          templateId: 'template-123',
          distance: -5,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Calculation failed: invalid distance');
      });
    });

    describe('❌ Error Handling Tests', () => {
      it('should return 500 for unexpected errors', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.calculate as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createPostRequest('http://localhost:3000/api/calculator/calculate', {
          templateId: 'template-123',
          distance: 10,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Internal server error');
      });

      it('should log errors to console', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.calculate as jest.Mock).mockRejectedValue(
          new Error('Test error')
        );

        const request = createPostRequest('http://localhost:3000/api/calculator/calculate', {
          templateId: 'template-123',
          distance: 10,
        });

        await POST(request);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to calculate delivery costs:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('GET /api/calculator/calculate', () => {
    describe('✅ Successful Config Retrieval', () => {
      it('should return calculator configuration', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.getCalculatorConfig as jest.Mock).mockResolvedValue({
          template: { id: 'template-123', name: 'Standard Delivery' },
          rules: [],
        });

        const request = createGetRequest(
          'http://localhost:3000/api/calculator/calculate?templateId=template-123'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('template');
        expect(data).toHaveProperty('timestamp');
      });

      it('should handle client configuration parameter', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-456', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.getCalculatorConfig as jest.Mock).mockResolvedValue({
          template: { id: 'template-123' },
          clientConfig: { id: 'client-config-456' },
          rules: [],
        });

        const request = createGetRequest(
          'http://localhost:3000/api/calculator/calculate?templateId=template-123&clientConfigId=client-config-456'
        );

        await GET(request);

        expect(CalculatorService.getCalculatorConfig).toHaveBeenCalledWith(
          'template-123',
          'client-config-456'
        );
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/calculator/calculate?templateId=template-123'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 when templateId is missing', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        const request = createGetRequest('http://localhost:3000/api/calculator/calculate');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Template ID is required');
      });

      it('should handle ConfigurationError', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.getCalculatorConfig as jest.Mock).mockRejectedValue(
          new ConfigurationError('Template not found')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/calculator/calculate?templateId=invalid'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Template not found');
      });
    });

    describe('❌ Error Handling Tests', () => {
      it('should return 500 for unexpected errors', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.getCalculatorConfig as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/calculator/calculate?templateId=template-123'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Internal server error');
      });

      it('should log errors to console', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.getCalculatorConfig as jest.Mock).mockRejectedValue(
          new Error('Test error')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/calculator/calculate?templateId=template-123'
        );

        await POST(request);

        expect(consoleErrorSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
      });
    });
  });
});
