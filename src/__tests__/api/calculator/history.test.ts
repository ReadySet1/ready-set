// src/__tests__/api/calculator/history.test.ts

import { createGetRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/calculator/calculator-service', () => ({
  CalculatorService: {
    getCalculationHistory: jest.fn(),
  },
}));

jest.mock('@/types/calculator', () => ({
  ConfigurationError: class ConfigurationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ConfigurationError';
    }
  },
}));

import { GET } from '@/app/api/calculator/history/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import { ConfigurationError } from '@/types/calculator';

describe('/api/calculator/history GET API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  // Helper to create auth request
  const createAuthRequest = (url: string, token: string = 'valid-token') => {
    return createGetRequest(url, {
      'Authorization': `Bearer ${token}`,
    });
  };

  describe('✅ Successful History Retrieval', () => {
    it('should return calculation history for user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        type: 'CLIENT',
      });

      (CalculatorService.getCalculationHistory as jest.Mock).mockResolvedValue([
        {
          id: 'calc-1',
          templateId: 'template-1',
          input: { distance: 10 },
          result: { totalCost: 150.00 },
          createdAt: new Date('2025-01-15'),
        },
        {
          id: 'calc-2',
          templateId: 'template-1',
          input: { distance: 20 },
          result: { totalCost: 250.00 },
          createdAt: new Date('2025-01-14'),
        },
      ]);

      const request = createAuthRequest('http://localhost:3000/api/calculator/history');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data).toHaveProperty('timestamp');
    });

    it('should filter history by templateId', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-456', email: 'test@example.com' } },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-456',
        type: 'CLIENT',
      });

      (CalculatorService.getCalculationHistory as jest.Mock).mockResolvedValue([
        {
          id: 'calc-3',
          templateId: 'template-specific',
          input: { distance: 15 },
          result: { totalCost: 200.00 },
        },
      ]);

      const request = createAuthRequest(
        'http://localhost:3000/api/calculator/history?templateId=template-specific'
      );
      await GET(request);

      expect(CalculatorService.getCalculationHistory).toHaveBeenCalledWith(
        mockSupabaseClient,
        expect.objectContaining({
          templateId: 'template-specific',
          userId: 'user-456',
        })
      );
    });

    it('should respect limit parameter', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-789', email: 'test@example.com' } },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-789',
        type: 'CLIENT',
      });

      (CalculatorService.getCalculationHistory as jest.Mock).mockResolvedValue([]);

      const request = createAuthRequest(
        'http://localhost:3000/api/calculator/history?limit=25'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.limit).toBe(25);
      expect(CalculatorService.getCalculationHistory).toHaveBeenCalledWith(
        mockSupabaseClient,
        expect.objectContaining({
          limit: 25,
        })
      );
    });

    it('should enforce maximum limit of 100', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-999', email: 'test@example.com' } },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-999',
        type: 'CLIENT',
      });

      (CalculatorService.getCalculationHistory as jest.Mock).mockResolvedValue([]);

      const request = createAuthRequest(
        'http://localhost:3000/api/calculator/history?limit=200'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.limit).toBe(100);
    });

    it('should enforce minimum limit of 1', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-111', email: 'test@example.com' } },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-111',
        type: 'CLIENT',
      });

      (CalculatorService.getCalculationHistory as jest.Mock).mockResolvedValue([]);

      const request = createAuthRequest(
        'http://localhost:3000/api/calculator/history?limit=0'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.limit).toBe(1);
    });

    it('should allow admin to view other user history', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123', email: 'admin@example.com' } },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        id: 'admin-123',
        type: 'ADMIN',
      });

      (CalculatorService.getCalculationHistory as jest.Mock).mockResolvedValue([]);

      const request = createAuthRequest(
        'http://localhost:3000/api/calculator/history?userId=other-user-456'
      );
      await GET(request);

      expect(CalculatorService.getCalculationHistory).toHaveBeenCalledWith(
        mockSupabaseClient,
        expect.objectContaining({
          userId: 'other-user-456',
        })
      );
    });

    it('should restrict non-admin to own history only', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-222', email: 'user@example.com' } },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-222',
        type: 'CLIENT',
      });

      (CalculatorService.getCalculationHistory as jest.Mock).mockResolvedValue([]);

      const request = createAuthRequest(
        'http://localhost:3000/api/calculator/history?userId=other-user-999'
      );
      await GET(request);

      // Should use authenticated user's ID, not requested userId
      expect(CalculatorService.getCalculationHistory).toHaveBeenCalledWith(
        mockSupabaseClient,
        expect.objectContaining({
          userId: 'user-222',
        })
      );
    });
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 when authorization header is missing', async () => {
      const request = createGetRequest('http://localhost:3000/api/calculator/history');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized - Invalid authorization header');
    });

    it('should return 401 when authorization header is invalid', async () => {
      const request = createGetRequest('http://localhost:3000/api/calculator/history', {
        'Authorization': 'Basic invalid',
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 401 when token is invalid', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const request = createAuthRequest(
        'http://localhost:3000/api/calculator/history',
        'invalid-token'
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 404 when user profile not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-no-profile', email: 'noProfile@example.com' } },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createAuthRequest('http://localhost:3000/api/calculator/history');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User profile not found');
    });
  });

  describe('❌ Error Handling Tests', () => {
    it('should return 500 when history fetch fails', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        type: 'CLIENT',
      });

      (CalculatorService.getCalculationHistory as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createAuthRequest('http://localhost:3000/api/calculator/history');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle ConfigurationError', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        type: 'CLIENT',
      });

      (CalculatorService.getCalculationHistory as jest.Mock).mockRejectedValue(
        new ConfigurationError('Invalid history configuration')
      );

      const request = createAuthRequest('http://localhost:3000/api/calculator/history');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid history configuration');
    });

    it('should log errors to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        type: 'CLIENT',
      });

      (CalculatorService.getCalculationHistory as jest.Mock).mockRejectedValue(
        new Error('Test error')
      );

      const request = createAuthRequest('http://localhost:3000/api/calculator/history');
      await GET(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch calculation history:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('🎯 Integration Tests', () => {
    it('should handle complete history workflow', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-integration', email: 'integration@example.com' } },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-integration',
        type: 'CLIENT',
      });

      const mockHistory = Array(15).fill(null).map((_, i) => ({
        id: `calc-${i}`,
        templateId: 'template-1',
        input: { distance: 10 + i },
        result: { totalCost: 150 + (i * 10) },
        createdAt: new Date(`2025-01-${15 - i}`),
      }));

      (CalculatorService.getCalculationHistory as jest.Mock).mockResolvedValue(mockHistory);

      const request = createAuthRequest(
        'http://localhost:3000/api/calculator/history?templateId=template-1&limit=15'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(15);
      expect(data.total).toBe(15);
      expect(data.limit).toBe(15);
      expect(CalculatorService.getCalculationHistory).toHaveBeenCalledTimes(1);
    });
  });
});
