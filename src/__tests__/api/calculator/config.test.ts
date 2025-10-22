// src/__tests__/api/calculator/config.test.ts

import { createGetRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/types/calculator', () => ({
  ConfigurationError: class ConfigurationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ConfigurationError';
    }
  },
}));

import { GET } from '@/app/api/calculator/config/route';
import { createClient } from '@/utils/supabase/server';
import { ConfigurationError } from '@/types/calculator';

describe('/api/calculator/config GET API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('✅ Successful Configuration Retrieval', () => {
    it('should return calculator configuration without client config', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: {
            id: 'template-123',
            name: 'Standard Delivery',
            description: 'Standard delivery pricing',
            is_active: true,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
          },
          error: null,
        }),
        order: jest.fn().mockResolvedValueOnce({
          data: [
            {
              id: 'rule-1',
              template_id: 'template-123',
              rule_type: 'BASE_RATE',
              rule_name: 'Base Rate',
              base_amount: '50.00',
              priority: 1,
              created_at: '2025-01-01',
              updated_at: '2025-01-01',
            },
          ],
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.template).toMatchObject({
        id: 'template-123',
        name: 'Standard Delivery',
      });
      expect(data.data.rules).toHaveLength(1);
      expect(data.data.clientConfig).toBeNull();
      expect(data).toHaveProperty('timestamp');
    });

    it('should return configuration with client config', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-456', email: 'test@example.com' } },
        error: null,
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({
            data: {
              id: 'template-123',
              name: 'Standard Delivery',
              is_active: true,
              created_at: '2025-01-01',
              updated_at: '2025-01-01',
            },
            error: null,
          })
          .mockResolvedValueOnce({
            data: {
              id: 'client-config-456',
              client_id: 'client-789',
              template_id: 'template-123',
              client_name: 'Test Client',
              rule_overrides: { baseAmount: 75.00 },
              area_rules: [{ area: 'downtown', multiplier: 1.5 }],
              is_active: true,
              created_at: '2025-01-02',
              updated_at: '2025-01-02',
            },
            error: null,
          }),
        order: jest.fn().mockResolvedValueOnce({
          data: [],
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-123&clientConfigId=client-config-456'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.clientConfig).toMatchObject({
        id: 'client-config-456',
        clientName: 'Test Client',
      });
      expect(data.data.areaRules).toHaveLength(1);
    });

    it('should parse and format pricing rules correctly', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: {
            id: 'template-123',
            name: 'Test Template',
            is_active: true,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
          },
          error: null,
        }),
        order: jest.fn().mockResolvedValueOnce({
          data: [
            {
              id: 'rule-1',
              template_id: 'template-123',
              rule_type: 'PER_DISTANCE',
              rule_name: 'Distance Charge',
              base_amount: '10.50',
              per_unit_amount: '2.25',
              threshold_value: '5',
              threshold_type: 'MINIMUM',
              applies_when: JSON.stringify({ condition: 'distance > 0' }),
              priority: 1,
              created_at: '2025-01-01',
              updated_at: '2025-01-01',
            },
          ],
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.rules[0]).toMatchObject({
        id: 'rule-1',
        ruleType: 'PER_DISTANCE',
        ruleName: 'Distance Charge',
        baseAmount: 10.5,
        perUnitAmount: 2.25,
        thresholdValue: 5,
        thresholdType: 'MINIMUM',
        appliesWhen: { condition: 'distance > 0' },
        priority: 1,
      });
    });

    it('should handle empty pricing rules', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: {
            id: 'template-123',
            name: 'Empty Template',
            is_active: true,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
          },
          error: null,
        }),
        order: jest.fn().mockResolvedValueOnce({
          data: null,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.rules).toEqual([]);
    });

    it('should order pricing rules by priority descending', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: {
            id: 'template-123',
            name: 'Test Template',
            is_active: true,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
          },
          error: null,
        }),
        order: jest.fn((field: string, options: any) => {
          expect(field).toBe('priority');
          expect(options).toEqual({ ascending: false });
          return Promise.resolve({
            data: [
              {
                id: 'rule-1',
                template_id: 'template-123',
                rule_type: 'BASE_RATE',
                rule_name: 'High Priority',
                priority: 10,
                created_at: '2025-01-01',
                updated_at: '2025-01-01',
              },
              {
                id: 'rule-2',
                template_id: 'template-123',
                rule_type: 'PER_DISTANCE',
                rule_name: 'Low Priority',
                priority: 1,
                created_at: '2025-01-01',
                updated_at: '2025-01-01',
              },
            ],
            error: null,
          });
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.rules).toHaveLength(2);
      expect(data.data.rules[0].priority).toBe(10);
      expect(data.data.rules[1].priority).toBe(1);
    });

    it('should handle missing client config gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({
            data: {
              id: 'template-123',
              name: 'Test Template',
              is_active: true,
              created_at: '2025-01-01',
              updated_at: '2025-01-01',
            },
            error: null,
          })
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Not found' },
          }),
        order: jest.fn().mockResolvedValueOnce({
          data: [],
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-123&clientConfigId=nonexistent'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.clientConfig).toBeNull();
    });
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-123'
      );
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

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-123'
      );
      await GET(request);

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });

  describe('✏️ Validation Tests', () => {
    it('should return 400 when templateId is missing', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const request = createGetRequest('http://localhost:3000/api/calculator/config');
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

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=nonexistent'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Calculator template not found');
    });

    it('should return 404 when template is null', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: null,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Calculator template not found');
    });
  });

  describe('❌ Error Handling Tests', () => {
    it('should return 500 when pricing rules fetch fails', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: {
            id: 'template-123',
            name: 'Test Template',
            is_active: true,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
          },
          error: null,
        }),
        order: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch pricing rules');
    });

    it('should handle ConfigurationError', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation(() => {
        throw new ConfigurationError('Invalid configuration');
      });

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-123'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid configuration');
    });

    it('should return 500 for unexpected errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-123'
      );
      const response = await GET(request);
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

      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Test error');
      });

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-123'
      );
      await GET(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch calculator configuration:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('🎯 Integration Tests', () => {
    it('should handle complete config workflow with all features', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-integration', email: 'integration@example.com' } },
        error: null,
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({
            data: {
              id: 'template-integration',
              name: 'Integration Template',
              description: 'Full workflow template',
              is_active: true,
              created_at: '2025-01-15',
              updated_at: '2025-01-15',
            },
            error: null,
          })
          .mockResolvedValueOnce({
            data: {
              id: 'client-config-integration',
              client_id: 'client-integration',
              template_id: 'template-integration',
              client_name: 'Integration Client',
              rule_overrides: { baseAmount: 100.00 },
              area_rules: [
                { area: 'zone-a', multiplier: 1.2 },
                { area: 'zone-b', multiplier: 1.5 },
              ],
              is_active: true,
              created_at: '2025-01-16',
              updated_at: '2025-01-16',
            },
            error: null,
          }),
        order: jest.fn().mockResolvedValueOnce({
          data: [
            {
              id: 'rule-1',
              template_id: 'template-integration',
              rule_type: 'BASE_RATE',
              rule_name: 'Base Rate',
              base_amount: '75.00',
              priority: 10,
              created_at: '2025-01-15',
              updated_at: '2025-01-15',
            },
            {
              id: 'rule-2',
              template_id: 'template-integration',
              rule_type: 'PER_DISTANCE',
              rule_name: 'Distance Charge',
              per_unit_amount: '5.00',
              priority: 5,
              created_at: '2025-01-15',
              updated_at: '2025-01-15',
            },
          ],
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockFrom);

      const request = createGetRequest(
        'http://localhost:3000/api/calculator/config?templateId=template-integration&clientConfigId=client-config-integration'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        template: {
          id: 'template-integration',
          name: 'Integration Template',
        },
        clientConfig: {
          id: 'client-config-integration',
          clientName: 'Integration Client',
        },
      });
      expect(data.data.rules).toHaveLength(2);
      expect(data.data.areaRules).toHaveLength(2);
    });
  });
});
