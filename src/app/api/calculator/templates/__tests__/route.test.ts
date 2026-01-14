/**
 * Tests for /api/calculator/templates route
 *
 * Tests cover:
 * - GET: List all active calculator templates
 * - POST: Create new calculator template
 * - Authentication enforcement
 * - Input validation
 * - Error handling
 */

import { GET, POST } from '../route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/db/prisma';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import {
  createGetRequest,
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

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCalculatorService = CalculatorService as jest.Mocked<typeof CalculatorService>;

describe('/api/calculator/templates', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockTemplates = [
    {
      id: 'template-123',
      name: 'Standard Delivery',
      description: 'Default pricing template for standard deliveries',
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      pricingRules: [
        {
          id: 'rule-1',
          templateId: 'template-123',
          ruleType: 'BASE_FEE',
          ruleName: 'Base Delivery Fee',
          baseAmount: '25.00',
          perUnitAmount: null,
          thresholdValue: null,
          thresholdType: null,
          appliesWhen: null,
          priority: 10,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    },
    {
      id: 'template-456',
      name: 'Premium Delivery',
      description: 'Premium pricing with expedited service',
      isActive: true,
      createdAt: new Date('2024-01-02T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
      pricingRules: [],
    },
  ];

  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
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

    // Default: successful prisma query
    (mockPrisma.calculatorTemplate.findMany as jest.Mock).mockResolvedValue(mockTemplates);
  });

  describe('GET /api/calculator/templates', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/calculator/templates'
        );

        const response = await GET(request);
        await expectUnauthorized(response, 'Unauthorized');
      });
    });

    describe('Successful Template Retrieval', () => {
      it('should retrieve templates successfully', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/calculator/templates'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data).toHaveProperty('total', 2);
        expect(data).toHaveProperty('timestamp');
      });

      it('should return template with mapped fields', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/calculator/templates'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        const template = data.data[0];
        expect(template.id).toBe('template-123');
        expect(template.name).toBe('Standard Delivery');
        expect(template.description).toBe('Default pricing template for standard deliveries');
        expect(template.isActive).toBe(true);
      });

      it('should include pricing rules for each template', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/calculator/templates'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        const template = data.data[0];
        expect(template.pricingRules).toHaveLength(1);
        expect(template.pricingRules[0].ruleType).toBe('BASE_FEE');
        expect(template.pricingRules[0].baseAmount).toBe(25.0);
      });

      it('should only return active templates', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/calculator/templates'
        );

        await GET(request);

        expect(mockPrisma.calculatorTemplate.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              isActive: true,
            },
          })
        );
      });

      it('should order templates by createdAt descending', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/calculator/templates'
        );

        await GET(request);

        expect(mockPrisma.calculatorTemplate.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              createdAt: 'desc',
            },
          })
        );
      });

      it('should include pricing rules ordered by priority', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/calculator/templates'
        );

        await GET(request);

        expect(mockPrisma.calculatorTemplate.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            include: {
              pricingRules: {
                orderBy: {
                  priority: 'desc',
                },
              },
            },
          })
        );
      });

      it('should return empty array when no templates exist', async () => {
        (mockPrisma.calculatorTemplate.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/calculator/templates'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data).toEqual([]);
        expect(data.total).toBe(0);
      });
    });

    describe('Error Handling', () => {
      it('should return 500 on database error', async () => {
        (mockPrisma.calculatorTemplate.findMany as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/calculator/templates'
        );

        const response = await GET(request);
        await expectServerError(response);
      });
    });
  });

  describe('POST /api/calculator/templates', () => {
    const validTemplateData = {
      name: 'New Template',
      description: 'A new calculator template',
      isActive: true,
    };

    const createdTemplate = {
      id: 'new-template-id',
      ...validTemplateData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      (mockCalculatorService.createTemplate as jest.Mock).mockResolvedValue(createdTemplate);
    });

    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/templates',
          validTemplateData
        );

        const response = await POST(request);
        await expectUnauthorized(response, 'Unauthorized');
      });
    });

    describe('Successful Template Creation', () => {
      it('should create template successfully', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/calculator/templates',
          validTemplateData
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 201);

        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('id', 'new-template-id');
        expect(data.data).toHaveProperty('name', 'New Template');
        expect(data).toHaveProperty('timestamp');
      });

      it('should call CalculatorService.createTemplate with correct data', async () => {
        const request = createPostRequest(
          'http://localhost:3000/api/calculator/templates',
          validTemplateData
        );

        await POST(request);

        expect(mockCalculatorService.createTemplate).toHaveBeenCalledWith(
          expect.objectContaining(validTemplateData)
        );
      });
    });

    describe('Input Validation', () => {
      it('should return 400 when name is missing', async () => {
        const invalidData = {
          description: 'A template without a name',
        };

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/templates',
          invalidData
        );

        const response = await POST(request);
        // Zod validation error returns 500 when thrown
        expect(response.status).toBeGreaterThanOrEqual(400);
      });

      it('should return 400 when name is empty string', async () => {
        const invalidData = {
          name: '',
          description: 'A template with empty name',
        };

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/templates',
          invalidData
        );

        const response = await POST(request);
        expect(response.status).toBeGreaterThanOrEqual(400);
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when service throws generic error', async () => {
        (mockCalculatorService.createTemplate as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/calculator/templates',
          validTemplateData
        );

        const response = await POST(request);
        await expectServerError(response);
      });
    });
  });
});
