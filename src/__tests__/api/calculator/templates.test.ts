// src/__tests__/api/calculator/templates.test.ts

import { createGetRequest, createPostRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    calculatorTemplate: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/calculator/calculator-service', () => ({
  CalculatorService: {
    createTemplate: jest.fn(),
  },
}));

jest.mock('@/types/calculator', () => ({
  CreateTemplateSchema: {
    parse: jest.fn((input) => input),
  },
  ConfigurationError: class ConfigurationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ConfigurationError';
    }
  },
}));

import { GET, POST } from '@/app/api/calculator/templates/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/db/prisma';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import { CreateTemplateSchema, ConfigurationError } from '@/types/calculator';

describe('/api/calculator/templates API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('GET /api/calculator/templates', () => {
    describe('✅ Successful Template Retrieval', () => {
      it('should return list of active templates', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (prisma.calculatorTemplate.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'template-1',
            name: 'Standard Delivery',
            description: 'Standard delivery pricing',
            isActive: true,
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
            pricingRules: [],
          },
          {
            id: 'template-2',
            name: 'Express Delivery',
            description: 'Express delivery pricing',
            isActive: true,
            createdAt: new Date('2025-01-02'),
            updatedAt: new Date('2025-01-02'),
            pricingRules: [],
          },
        ]);

        const request = createGetRequest('http://localhost:3000/api/calculator/templates');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data.total).toBe(2);
        expect(data).toHaveProperty('timestamp');
      });

      it('should return empty array when no templates exist', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (prisma.calculatorTemplate.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest('http://localhost:3000/api/calculator/templates');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual([]);
        expect(data.total).toBe(0);
      });

      it('should include pricing rules in template response', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (prisma.calculatorTemplate.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'template-1',
            name: 'Standard Delivery',
            description: 'Standard delivery pricing',
            isActive: true,
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
            pricingRules: [
              {
                id: 'rule-1',
                templateId: 'template-1',
                ruleType: 'BASE_RATE',
                ruleName: 'Base Rate',
                baseAmount: 50.00,
                priority: 1,
                createdAt: new Date('2025-01-01'),
                updatedAt: new Date('2025-01-01'),
              },
            ],
          },
        ]);

        const request = createGetRequest('http://localhost:3000/api/calculator/templates');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data[0].pricingRules).toHaveLength(1);
        expect(data.data[0].pricingRules[0]).toMatchObject({
          id: 'rule-1',
          ruleType: 'BASE_RATE',
          ruleName: 'Base Rate',
        });
      });

      it('should only return active templates', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (prisma.calculatorTemplate.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'template-active',
            name: 'Active Template',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            pricingRules: [],
          },
        ]);

        const request = createGetRequest('http://localhost:3000/api/calculator/templates');
        await GET(request);

        expect(prisma.calculatorTemplate.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { isActive: true },
          })
        );
      });

      it('should order templates by creation date descending', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (prisma.calculatorTemplate.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest('http://localhost:3000/api/calculator/templates');
        await GET(request);

        expect(prisma.calculatorTemplate.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { createdAt: 'desc' },
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

        const request = createGetRequest('http://localhost:3000/api/calculator/templates');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Unauthorized');
      });

      it('should not query database when unauthorized', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = createGetRequest('http://localhost:3000/api/calculator/templates');
        await GET(request);

        expect(prisma.calculatorTemplate.findMany).not.toHaveBeenCalled();
      });
    });

    describe('❌ Error Handling Tests', () => {
      it('should return 500 when database query fails', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (prisma.calculatorTemplate.findMany as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createGetRequest('http://localhost:3000/api/calculator/templates');
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

        (prisma.calculatorTemplate.findMany as jest.Mock).mockRejectedValue(
          new ConfigurationError('Configuration error')
        );

        const request = createGetRequest('http://localhost:3000/api/calculator/templates');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Configuration error');
      });

      it('should log errors to console', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (prisma.calculatorTemplate.findMany as jest.Mock).mockRejectedValue(
          new Error('Test error')
        );

        const request = createGetRequest('http://localhost:3000/api/calculator/templates');
        await GET(request);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to fetch calculator templates:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('POST /api/calculator/templates', () => {
    describe('✅ Successful Template Creation', () => {
      it('should create new template', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.createTemplate as jest.Mock).mockResolvedValue({
          id: 'new-template-123',
          name: 'New Template',
          description: 'New template description',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/templates', {
          name: 'New Template',
          description: 'New template description',
          isActive: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data).toMatchObject({
          id: 'new-template-123',
          name: 'New Template',
        });
        expect(data).toHaveProperty('timestamp');
      });

      it('should validate input with CreateTemplateSchema', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.createTemplate as jest.Mock).mockResolvedValue({
          id: 'template-456',
          name: 'Validated Template',
        });

        const requestBody = {
          name: 'Validated Template',
          description: 'Description',
        };

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/templates',
          requestBody
        );

        await POST(request);

        expect(CreateTemplateSchema.parse).toHaveBeenCalledWith(requestBody);
      });

      it('should call createTemplate service with validated input', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.createTemplate as jest.Mock).mockResolvedValue({
          id: 'template-789',
          name: 'Service Template',
        });

        const templateData = {
          name: 'Service Template',
          description: 'Template created via service',
          isActive: true,
        };

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/templates',
          templateData
        );

        await POST(request);

        expect(CalculatorService.createTemplate).toHaveBeenCalledWith(templateData);
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/templates', {
          name: 'New Template',
          description: 'Description',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Unauthorized');
      });

      it('should not create template when unauthorized', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/templates', {
          name: 'Unauthorized Template',
        });

        await POST(request);

        expect(CalculatorService.createTemplate).not.toHaveBeenCalled();
      });
    });

    describe('❌ Error Handling Tests', () => {
      it('should return 500 when template creation fails', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (CalculatorService.createTemplate as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = createPostRequest('http://localhost:3000/api/calculator/templates', {
          name: 'Failed Template',
        });

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

        (CalculatorService.createTemplate as jest.Mock).mockRejectedValue(
          new ConfigurationError('Invalid template configuration')
        );

        const request = createPostRequest('http://localhost:3000/api/calculator/templates', {
          name: 'Invalid Template',
        });

        const response = await POST(request);
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

        (CalculatorService.createTemplate as jest.Mock).mockRejectedValue(
          new Error('Test error')
        );

        const request = createPostRequest('http://localhost:3000/api/calculator/templates', {
          name: 'Error Template',
        });

        await POST(request);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to create calculator template:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });
    });

    describe('🎯 Integration Tests', () => {
      it('should handle complete template creation workflow', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-integration', email: 'integration@example.com' } },
          error: null,
        });

        const createdTemplate = {
          id: 'template-integration',
          name: 'Integration Template',
          description: 'Full workflow template',
          isActive: true,
          createdAt: new Date('2025-01-15'),
          updatedAt: new Date('2025-01-15'),
        };

        (CalculatorService.createTemplate as jest.Mock).mockResolvedValue(createdTemplate);

        const request = createPostRequest('http://localhost:3000/api/calculator/templates', {
          name: 'Integration Template',
          description: 'Full workflow template',
          isActive: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(createdTemplate);
        expect(CreateTemplateSchema.parse).toHaveBeenCalledTimes(1);
        expect(CalculatorService.createTemplate).toHaveBeenCalledTimes(1);
      });
    });
  });
});
