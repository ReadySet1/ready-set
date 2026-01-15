/**
 * Tests for /api/calculator/config route
 *
 * Tests cover:
 * - GET: Retrieve calculator configuration with template and rules
 * - Authentication enforcement
 * - Input validation (templateId required)
 * - Client configuration loading
 * - Error handling
 */

import { GET } from '../route';
import { createClient } from '@/utils/supabase/server';
import {
  createRequestWithParams,
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectValidationError,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('/api/calculator/config', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockTemplate = {
    id: 'template-123',
    name: 'Standard Delivery',
    description: 'Default pricing template',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockRules = [
    {
      id: 'rule-1',
      template_id: 'template-123',
      rule_type: 'BASE_FEE',
      rule_name: 'Base Delivery Fee',
      base_amount: '25.00',
      per_unit_amount: null,
      threshold_value: null,
      threshold_type: null,
      applies_when: null,
      priority: 10,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'rule-2',
      template_id: 'template-123',
      rule_type: 'MILEAGE',
      rule_name: 'Per Mile Fee',
      base_amount: null,
      per_unit_amount: '2.50',
      threshold_value: null,
      threshold_type: null,
      applies_when: null,
      priority: 5,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const mockClientConfig = {
    id: 'config-123',
    client_id: 'client-001',
    template_id: 'template-123',
    client_name: 'Test Client',
    rule_overrides: { baseFee: 30 },
    area_rules: [{ area: 'downtown', multiplier: 1.2 }],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: jest.fn(),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  describe('GET /api/calculator/config', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = createRequestWithParams(
          'http://localhost:3000/api/calculator/config',
          { templateId: 'template-123' }
        );

        const response = await GET(request);
        await expectUnauthorized(response, 'Unauthorized');
      });
    });

    describe('Input Validation', () => {
      it('should return 400 when templateId is missing', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/calculator/config'
        );

        const response = await GET(request);
        const data = await expectValidationError(response);
        expect(data.error).toContain('Template ID is required');
      });
    });

    describe('Successful Configuration Retrieval', () => {
      beforeEach(() => {
        // Setup mock chain for template query
        const templateQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: mockTemplate,
            error: null,
          }),
        };

        // Setup mock chain for rules query
        const rulesQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: mockRules,
            error: null,
          }),
        };

        // Setup mock chain for client config query
        const configQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: mockClientConfig,
            error: null,
          }),
        };

        mockSupabase.from.mockImplementation((table: string) => {
          switch (table) {
            case 'calculator_templates':
              return templateQuery;
            case 'pricing_rules':
              return rulesQuery;
            case 'client_configurations':
              return configQuery;
            default:
              return {};
          }
        });
      });

      it('should retrieve configuration successfully', async () => {
        const request = createRequestWithParams(
          'http://localhost:3000/api/calculator/config',
          { templateId: 'template-123' }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('template');
        expect(data.data).toHaveProperty('rules');
        expect(data).toHaveProperty('timestamp');
      });

      it('should include template details in response', async () => {
        const request = createRequestWithParams(
          'http://localhost:3000/api/calculator/config',
          { templateId: 'template-123' }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data.template.id).toBe('template-123');
        expect(data.data.template.name).toBe('Standard Delivery');
        expect(data.data.template.isActive).toBe(true);
      });

      it('should include pricing rules in response', async () => {
        const request = createRequestWithParams(
          'http://localhost:3000/api/calculator/config',
          { templateId: 'template-123' }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data.template.pricingRules).toHaveLength(2);
        expect(data.data.template.pricingRules[0].ruleType).toBe('BASE_FEE');
        expect(data.data.template.pricingRules[0].baseAmount).toBe(25.0);
      });

      it('should include client configuration when clientConfigId is provided', async () => {
        const request = createRequestWithParams(
          'http://localhost:3000/api/calculator/config',
          { templateId: 'template-123', clientConfigId: 'config-123' }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data.clientConfig).not.toBeNull();
        expect(data.data.clientConfig.id).toBe('config-123');
        expect(data.data.clientConfig.clientName).toBe('Test Client');
      });

      it('should return null clientConfig when clientConfigId is not provided', async () => {
        const request = createRequestWithParams(
          'http://localhost:3000/api/calculator/config',
          { templateId: 'template-123' }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data.clientConfig).toBeNull();
      });
    });

    describe('Error Handling', () => {
      it('should return 404 when template is not found', async () => {
        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'calculator_templates') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'Not found' },
              }),
            };
          }
          return {};
        });

        const request = createRequestWithParams(
          'http://localhost:3000/api/calculator/config',
          { templateId: 'nonexistent-template' }
        );

        const response = await GET(request);
        const data = await expectErrorResponse(response, 404);
        expect(data.error).toContain('Calculator template not found');
      });

      it('should return 500 when rules query fails', async () => {
        const templateQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: mockTemplate,
            error: null,
          }),
        };

        const rulesQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'DB_ERROR', message: 'Database error' },
          }),
        };

        mockSupabase.from.mockImplementation((table: string) => {
          switch (table) {
            case 'calculator_templates':
              return templateQuery;
            case 'pricing_rules':
              return rulesQuery;
            default:
              return {};
          }
        });

        const request = createRequestWithParams(
          'http://localhost:3000/api/calculator/config',
          { templateId: 'template-123' }
        );

        const response = await GET(request);
        const data = await expectErrorResponse(response, 500);
        expect(data.error).toContain('Failed to fetch pricing rules');
      });

      it('should handle client config not found gracefully', async () => {
        const templateQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: mockTemplate,
            error: null,
          }),
        };

        const rulesQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: mockRules,
            error: null,
          }),
        };

        const configQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'Not found' },
          }),
        };

        mockSupabase.from.mockImplementation((table: string) => {
          switch (table) {
            case 'calculator_templates':
              return templateQuery;
            case 'pricing_rules':
              return rulesQuery;
            case 'client_configurations':
              return configQuery;
            default:
              return {};
          }
        });

        const request = createRequestWithParams(
          'http://localhost:3000/api/calculator/config',
          { templateId: 'template-123', clientConfigId: 'nonexistent-config' }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        // Should still succeed but with null clientConfig
        expect(data.success).toBe(true);
        expect(data.data.clientConfig).toBeNull();
      });
    });
  });
});
