// src/__tests__/api/calculator/save.test.ts

import { createPostRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/calculator/calculator-service', () => ({
  CalculatorService: {
    saveCalculationHistory: jest.fn(),
  },
}));

import { POST } from '@/app/api/calculator/save/route';
import { createClient } from '@/utils/supabase/server';
import { CalculatorService } from '@/lib/calculator/calculator-service';

describe('/api/calculator/save POST API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('✅ Successful Save Operations', () => {
    it('should save calculation successfully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      (CalculatorService.saveCalculationHistory as jest.Mock).mockResolvedValue(undefined);

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-123',
        input: { distance: 10, weight: 50 },
        result: { totalCost: 150.00, breakdown: {} },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Calculation saved successfully');
      expect(data.data).toMatchObject({
        templateId: 'template-123',
        userId: 'user-123',
      });
      expect(data.data).toHaveProperty('timestamp');
    });

    it('should save calculation with client configuration', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-456', email: 'test@example.com' } },
        error: null,
      });

      (CalculatorService.saveCalculationHistory as jest.Mock).mockResolvedValue(undefined);

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-123',
        clientConfigId: 'client-config-456',
        input: { distance: 15, weight: 75 },
        result: { totalCost: 200.00 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.clientConfigId).toBe('client-config-456');
      expect(CalculatorService.saveCalculationHistory).toHaveBeenCalledWith(
        mockSupabaseClient,
        'template-123',
        expect.objectContaining({ distance: 15, weight: 75 }),
        expect.objectContaining({ totalCost: 200.00 }),
        'client-config-456',
        'user-456'
      );
    });

    it('should save calculation without client configuration', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-789', email: 'test@example.com' } },
        error: null,
      });

      (CalculatorService.saveCalculationHistory as jest.Mock).mockResolvedValue(undefined);

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-789',
        input: { distance: 20 },
        result: { totalCost: 250.00 },
      });

      await POST(request);

      expect(CalculatorService.saveCalculationHistory).toHaveBeenCalledWith(
        mockSupabaseClient,
        'template-789',
        expect.any(Object),
        expect.any(Object),
        undefined,
        'user-789'
      );
    });

    it('should include timestamp in response', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-999', email: 'test@example.com' } },
        error: null,
      });

      (CalculatorService.saveCalculationHistory as jest.Mock).mockResolvedValue(undefined);

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-999',
        input: { distance: 5 },
        result: { totalCost: 100.00 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data).toHaveProperty('timestamp');
      expect(new Date(data.data.timestamp).toISOString()).toBe(data.data.timestamp);
    });
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-123',
        input: { distance: 10 },
        result: { totalCost: 150.00 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized - Please sign in');
    });

    it('should not save when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-123',
        input: { distance: 10 },
        result: { totalCost: 150.00 },
      });

      await POST(request);

      expect(CalculatorService.saveCalculationHistory).not.toHaveBeenCalled();
    });

    it('should handle authentication error', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-123',
        input: { distance: 10 },
        result: { totalCost: 150.00 },
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('✏️ Validation Tests', () => {
    it('should return 400 when templateId is missing', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        input: { distance: 10 },
        result: { totalCost: 150.00 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: templateId, input, result');
    });

    it('should return 400 when input is missing', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-123',
        result: { totalCost: 150.00 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: templateId, input, result');
    });

    it('should return 400 when result is missing', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-123',
        input: { distance: 10 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: templateId, input, result');
    });

    it('should return 400 when all required fields are missing', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: templateId, input, result');
    });

    it('should handle empty string templateId', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: '',
        input: { distance: 10 },
        result: { totalCost: 150.00 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: templateId, input, result');
    });
  });

  describe('❌ Error Handling Tests', () => {
    it('should return 500 when save operation fails', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      (CalculatorService.saveCalculationHistory as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-123',
        input: { distance: 10 },
        result: { totalCost: 150.00 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to save calculation to database');
    });

    it('should log errors to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      (CalculatorService.saveCalculationHistory as jest.Mock).mockRejectedValue(
        new Error('Test error')
      );

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-123',
        input: { distance: 10 },
        result: { totalCost: 150.00 },
      });

      await POST(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error saving calculation:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error thrown values', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      (CalculatorService.saveCalculationHistory as jest.Mock).mockRejectedValue('String error');

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-123',
        input: { distance: 10 },
        result: { totalCost: 150.00 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to save calculation to database');
    });
  });

  describe('🔒 Security Tests', () => {
    it('should use authenticated user ID for saving', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'secure-user-123', email: 'test@example.com' } },
        error: null,
      });

      (CalculatorService.saveCalculationHistory as jest.Mock).mockResolvedValue(undefined);

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-123',
        input: { distance: 10 },
        result: { totalCost: 150.00 },
      });

      await POST(request);

      expect(CalculatorService.saveCalculationHistory).toHaveBeenCalledWith(
        mockSupabaseClient,
        'template-123',
        expect.any(Object),
        expect.any(Object),
        undefined,
        'secure-user-123'
      );
    });

    it('should not allow saving with different user ID in body', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'real-user-123', email: 'test@example.com' } },
        error: null,
      });

      (CalculatorService.saveCalculationHistory as jest.Mock).mockResolvedValue(undefined);

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-123',
        userId: 'fake-user-456', // Attempting to save as different user
        input: { distance: 10 },
        result: { totalCost: 150.00 },
      });

      await POST(request);

      // Should use authenticated user, not the one from body
      expect(CalculatorService.saveCalculationHistory).toHaveBeenCalledWith(
        mockSupabaseClient,
        'template-123',
        expect.any(Object),
        expect.any(Object),
        undefined,
        'real-user-123' // Real authenticated user
      );
    });
  });

  describe('🎯 Integration Tests', () => {
    it('should handle complete save workflow', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-integration', email: 'integration@example.com' } },
        error: null,
      });

      (CalculatorService.saveCalculationHistory as jest.Mock).mockResolvedValue(undefined);

      const request = createPostRequest('http://localhost:3000/api/calculator/save', {
        templateId: 'template-integration',
        clientConfigId: 'config-integration',
        input: {
          distance: 25,
          weight: 100,
          priority: 'high',
        },
        result: {
          totalCost: 350.00,
          breakdown: {
            baseRate: 200.00,
            distanceCharge: 100.00,
            weightCharge: 50.00,
          },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Calculation saved successfully');
      expect(data.data).toMatchObject({
        templateId: 'template-integration',
        clientConfigId: 'config-integration',
        userId: 'user-integration',
      });
      expect(CalculatorService.saveCalculationHistory).toHaveBeenCalledTimes(1);
    });
  });
});
