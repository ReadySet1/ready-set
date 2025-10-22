// src/__tests__/api/calculator/rules.test.ts

import { createGetRequest, createPostRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/calculator/calculator-service', () => ({
  CalculatorService: {
    getTemplateWithRules: jest.fn(),
    createRule: jest.fn(),
  },
}));

jest.mock('@/types/calculator', () => ({
  CreateRuleSchema: {
    parse: jest.fn((input) => input),
  },
  ConfigurationError: class ConfigurationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ConfigurationError';
    }
  },
}));

import { GET, POST } from '@/app/api/calculator/rules/route';
import { createClient } from '@/utils/supabase/server';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import { CreateRuleSchema, ConfigurationError } from '@/types/calculator';

describe('/api/calculator/rules API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    // Clear only the service mocks, not the auth mocks
    (CalculatorService.getTemplateWithRules as jest.Mock).mockClear();
    (CalculatorService.createRule as jest.Mock).mockClear();
    (CreateRuleSchema.parse as jest.Mock).mockClear();

    // Set up Supabase client
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);

    // Set default successful auth response
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });
  });

  // Helper to create request with Bearer token
  const createAuthRequest = (url: string, token: string = 'valid-token') => {
    return createGetRequest(url, {
      'Authorization': `Bearer ${token}`,
    });
  };

  const createAuthPostRequest = (url: string, body: any, token: string = 'valid-token') => {
    return createPostRequest(url, body, {
      'Authorization': `Bearer ${token}`,
    });
  };

  describe('GET /api/calculator/rules', () => {
    describe('✅ Successful Rules Retrieval', () => {
      it('should return pricing rules for template', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.getTemplateWithRules as jest.Mock).mockResolvedValue({
          id: 'template-123',
          name: 'Standard Delivery',
          pricingRules: [
            {
              id: 'rule-1',
              templateId: 'template-123',
              ruleType: 'BASE_RATE',
              ruleName: 'Base Rate',
              baseAmount: 50.0,
              priority: 1,
            },
            {
              id: 'rule-2',
              templateId: 'template-123',
              ruleType: 'PER_DISTANCE',
              ruleName: 'Distance Charge',
              perUnitAmount: 2.5,
              priority: 2,
            },
          ],
        });

        const request = createAuthRequest(
          'http://localhost:3000/api/calculator/rules?templateId=template-123'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data.total).toBe(2);
        expect(data).toHaveProperty('timestamp');
      });

      it('should return empty array when template has no rules', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-456', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.getTemplateWithRules as jest.Mock).mockResolvedValue({
          id: 'template-456',
          name: 'Empty Template',
          pricingRules: [],
        });

        const request = createAuthRequest(
          'http://localhost:3000/api/calculator/rules?templateId=template-456'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toEqual([]);
        expect(data.total).toBe(0);
      });

      it('should handle template with undefined pricingRules', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-789', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.getTemplateWithRules as jest.Mock).mockResolvedValue({
          id: 'template-789',
          name: 'Template Without Rules',
          pricingRules: undefined,
        });

        const request = createAuthRequest(
          'http://localhost:3000/api/calculator/rules?templateId=template-789'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual([]);
        expect(data.total).toBe(0);
      });

      it('should call getTemplateWithRules with correct parameters', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-999', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.getTemplateWithRules as jest.Mock).mockResolvedValue({
          id: 'template-999',
          pricingRules: [],
        });

        const request = createAuthRequest(
          'http://localhost:3000/api/calculator/rules?templateId=template-999'
        );
        await GET(request);

        expect(CalculatorService.getTemplateWithRules).toHaveBeenCalledWith(
          mockSupabaseClient,
          'template-999'
        );
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when authorization header is missing', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/calculator/rules?templateId=template-123'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Unauthorized - Invalid authorization header');
      });

      it('should return 401 when authorization header is invalid', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/calculator/rules?templateId=template-123',
          { 'Authorization': 'Basic invalid' }
        );
        const response = await GET(request);

        expect(response.status).toBe(401);
      });

      it('should return 401 when token is invalid', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' },
        });

        const request = createAuthRequest(
          'http://localhost:3000/api/calculator/rules?templateId=template-123',
          'invalid-token'
        );
        const response = await GET(request);

        expect(response.status).toBe(401);
      });

      it('should not query rules when unauthorized', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/calculator/rules?templateId=template-123'
        );
        await GET(request);

        expect(CalculatorService.getTemplateWithRules).not.toHaveBeenCalled();
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 when templateId is missing', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        const request = createAuthRequest('http://localhost:3000/api/calculator/rules');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Template ID is required');
      });

      it('should return 404 when template not found', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.getTemplateWithRules as jest.Mock).mockResolvedValue(null);

        const request = createAuthRequest(
          'http://localhost:3000/api/calculator/rules?templateId=nonexistent'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Template not found');
      });
    });

    describe('❌ Error Handling Tests', () => {
      it('should return 500 when rules fetch fails', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.getTemplateWithRules as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = createAuthRequest(
          'http://localhost:3000/api/calculator/rules?templateId=template-123'
        );
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

        (CalculatorService.getTemplateWithRules as jest.Mock).mockRejectedValue(
          new ConfigurationError('Invalid template configuration')
        );

        const request = createAuthRequest(
          'http://localhost:3000/api/calculator/rules?templateId=template-123'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid template configuration');
      });

      it('should log errors to console', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.getTemplateWithRules as jest.Mock).mockRejectedValue(
          new Error('Test error')
        );

        const request = createAuthRequest(
          'http://localhost:3000/api/calculator/rules?templateId=template-123'
        );
        await GET(request);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to fetch pricing rules:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('POST /api/calculator/rules', () => {
    describe('✅ Successful Rule Creation', () => {
      it('should create new pricing rule', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.createRule as jest.Mock).mockResolvedValue({
          id: 'new-rule-123',
          templateId: 'template-123',
          ruleType: 'BASE_RATE',
          ruleName: 'New Base Rate',
          baseAmount: 75.0,
          priority: 5,
          createdAt: new Date('2025-01-15'),
          updatedAt: new Date('2025-01-15'),
        });

        const request = createAuthPostRequest(
          'http://localhost:3000/api/calculator/rules',
          {
            templateId: 'template-123',
            ruleType: 'BASE_RATE',
            ruleName: 'New Base Rate',
            baseAmount: 75.0,
            priority: 5,
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data).toMatchObject({
          id: 'new-rule-123',
          ruleType: 'BASE_RATE',
        });
        expect(data).toHaveProperty('timestamp');
      });

      it('should validate input with CreateRuleSchema', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-456', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.createRule as jest.Mock).mockResolvedValue({
          id: 'rule-456',
          templateId: 'template-123',
          ruleType: 'PER_DISTANCE',
          ruleName: 'Distance Charge',
        });

        const ruleData = {
          templateId: 'template-123',
          ruleType: 'PER_DISTANCE',
          ruleName: 'Distance Charge',
          perUnitAmount: 2.5,
          priority: 3,
        };

        const request = createAuthPostRequest(
          'http://localhost:3000/api/calculator/rules',
          ruleData
        );

        await POST(request);

        expect(CreateRuleSchema.parse).toHaveBeenCalledWith(ruleData);
      });

      it('should call createRule service with validated input', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-789', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.createRule as jest.Mock).mockResolvedValue({
          id: 'rule-789',
        });

        const ruleData = {
          templateId: 'template-789',
          ruleType: 'THRESHOLD',
          ruleName: 'Threshold Rule',
          thresholdValue: 10.0,
          thresholdType: 'MINIMUM',
          priority: 7,
        };

        const request = createAuthPostRequest(
          'http://localhost:3000/api/calculator/rules',
          ruleData
        );

        await POST(request);

        expect(CalculatorService.createRule).toHaveBeenCalledWith(ruleData);
      });

      it('should allow authenticated users to create rules', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'regular-user-999', email: 'regular@example.com' } },
          error: null,
        });

        (CalculatorService.createRule as jest.Mock).mockResolvedValue({
          id: 'rule-999',
          templateId: 'template-999',
          ruleType: 'BASE_RATE',
          ruleName: 'Regular User Rule',
        });

        const request = createAuthPostRequest(
          'http://localhost:3000/api/calculator/rules',
          {
            templateId: 'template-999',
            ruleType: 'BASE_RATE',
            ruleName: 'Regular User Rule',
            baseAmount: 50.0,
            priority: 1,
          }
        );

        const response = await POST(request);

        expect(response.status).toBe(201);
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when authorization header is missing', async () => {
        const request = createPostRequest('http://localhost:3000/api/calculator/rules', {
          templateId: 'template-123',
          ruleType: 'BASE_RATE',
          ruleName: 'Test Rule',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Unauthorized - Invalid authorization header');
      });

      it('should return 401 when authorization header is invalid', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/calculator/rules',
          {
            templateId: 'template-123',
            ruleType: 'BASE_RATE',
            ruleName: 'Test Rule',
          },
          { 'Authorization': 'Basic invalid' }
        );

        const response = await POST(request);

        expect(response.status).toBe(401);
      });

      it('should return 401 when token is invalid', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' },
        });

        const request = createAuthPostRequest(
          'http://localhost:3000/api/calculator/rules',
          {
            templateId: 'template-123',
            ruleType: 'BASE_RATE',
            ruleName: 'Test Rule',
          },
          'invalid-token'
        );

        const response = await POST(request);

        expect(response.status).toBe(401);
      });

      it('should not create rule when unauthorized', async () => {
        const request = createPostRequest('http://localhost:3000/api/calculator/rules', {
          templateId: 'template-123',
          ruleType: 'BASE_RATE',
          ruleName: 'Unauthorized Rule',
        });

        await POST(request);

        expect(CalculatorService.createRule).not.toHaveBeenCalled();
      });
    });

    describe('❌ Error Handling Tests', () => {
      it('should return 500 when rule creation fails', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.createRule as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = createAuthPostRequest(
          'http://localhost:3000/api/calculator/rules',
          {
            templateId: 'template-123',
            ruleType: 'BASE_RATE',
            ruleName: 'Error Rule',
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Internal server error');
      });

      it('should handle ConfigurationError during creation', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.createRule as jest.Mock).mockRejectedValue(
          new ConfigurationError('Invalid rule configuration')
        );

        const request = createAuthPostRequest(
          'http://localhost:3000/api/calculator/rules',
          {
            templateId: 'template-123',
            ruleType: 'INVALID',
            ruleName: 'Invalid Rule',
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid rule configuration');
      });

      it('should log errors to console', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.createRule as jest.Mock).mockRejectedValue(
          new Error('Test error')
        );

        const request = createAuthPostRequest(
          'http://localhost:3000/api/calculator/rules',
          {
            templateId: 'template-123',
            ruleType: 'BASE_RATE',
            ruleName: 'Error Rule',
          }
        );

        await POST(request);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to create pricing rule:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });
    });

    describe('🎯 Integration Tests', () => {
      it('should handle complete rule creation workflow', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-integration', email: 'integration@example.com' } },
          error: null,
        });

        const createdRule = {
          id: 'rule-integration',
          templateId: 'template-integration',
          ruleType: 'COMPLEX',
          ruleName: 'Integration Complex Rule',
          baseAmount: 100.0,
          perUnitAmount: 5.0,
          thresholdValue: 20.0,
          thresholdType: 'MAXIMUM',
          appliesWhen: { condition: 'distance > 10' },
          priority: 10,
          createdAt: new Date('2025-01-15'),
          updatedAt: new Date('2025-01-15'),
        };

        (CalculatorService.createRule as jest.Mock).mockResolvedValue(createdRule);

        const request = createAuthPostRequest(
          'http://localhost:3000/api/calculator/rules',
          {
            templateId: 'template-integration',
            ruleType: 'COMPLEX',
            ruleName: 'Integration Complex Rule',
            baseAmount: 100.0,
            perUnitAmount: 5.0,
            thresholdValue: 20.0,
            thresholdType: 'MAXIMUM',
            appliesWhen: { condition: 'distance > 10' },
            priority: 10,
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(createdRule);
        expect(CreateRuleSchema.parse).toHaveBeenCalledTimes(1);
        expect(CalculatorService.createRule).toHaveBeenCalledTimes(1);
      });
    });
  });
});
