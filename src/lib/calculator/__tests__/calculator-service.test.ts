/**
 * Calculator Service Integration Tests
 *
 * Tests for the CalculatorService class that handles:
 * - Template CRUD operations
 * - Client configuration management
 * - Calculation execution
 * - History management
 *
 * Note: These tests mock the Supabase client to test business logic
 * without requiring a live database connection.
 */

import { CalculatorService } from '../calculator-service';
import type { CalculationInput, CalculatorTemplate, ClientConfiguration } from '@/types/calculator';

// Mock Supabase client factory
const createMockSupabase = (mockData: {
  templates?: any[];
  rules?: any[];
  clientConfigs?: any[];
  history?: any[];
  insertError?: Error | null;
  selectError?: Error | null;
}) => {
  const mockSelect = jest.fn().mockReturnThis();
  const mockInsert = jest.fn().mockReturnThis();
  const mockEq = jest.fn().mockReturnThis();
  const mockOrder = jest.fn().mockReturnThis();
  const mockLimit = jest.fn().mockReturnThis();
  const mockRange = jest.fn().mockReturnThis();
  const mockSingle = jest.fn();

  // Configure mock responses based on table name
  const mockFrom = jest.fn((tableName: string) => {
    const result = {
      select: mockSelect,
      insert: mockInsert,
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
      range: mockRange,
      single: mockSingle,
    };

    // Default mock responses for select
    mockSelect.mockImplementation(() => {
      const selectResult = {
        eq: mockEq,
        order: mockOrder,
        single: mockSingle,
        data: null as any,
        error: mockData.selectError || null,
      };

      mockEq.mockImplementation(() => selectResult);
      mockOrder.mockImplementation(() => {
        if (tableName === 'calculator_templates') {
          return { data: mockData.templates || [], error: mockData.selectError || null };
        }
        if (tableName === 'pricing_rules') {
          return { data: mockData.rules || [], error: mockData.selectError || null };
        }
        if (tableName === 'client_configurations') {
          return { data: mockData.clientConfigs || [], error: mockData.selectError || null };
        }
        if (tableName === 'calculation_history') {
          return {
            data: mockData.history || [],
            error: mockData.selectError || null,
            limit: mockLimit,
            range: mockRange,
          };
        }
        return selectResult;
      });

      mockSingle.mockImplementation(() => {
        if (tableName === 'calculator_templates' && mockData.templates?.[0]) {
          return { data: mockData.templates[0], error: null };
        }
        return { data: null, error: { message: 'Not found' } };
      });

      return selectResult;
    });

    // Default mock responses for insert
    mockInsert.mockImplementation(() => ({
      select: () => ({
        single: () => ({
          data: { id: 'new-id', ...mockData.clientConfigs?.[0] },
          error: mockData.insertError || null,
        }),
      }),
    }));

    return result;
  });

  return { from: mockFrom };
};

describe('CalculatorService', () => {
  describe('getTemplates', () => {
    it('should fetch all active templates', async () => {
      const mockTemplates = [
        { id: 'template-1', name: 'Standard Delivery', is_active: true },
        { id: 'template-2', name: 'Premium Delivery', is_active: true },
      ];

      const mockSupabase = createMockSupabase({ templates: mockTemplates });

      const result = await CalculatorService.getTemplates(mockSupabase);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Standard Delivery');
      expect(mockSupabase.from).toHaveBeenCalledWith('calculator_templates');
    });

    it('should return empty array when no templates exist', async () => {
      const mockSupabase = createMockSupabase({ templates: [] });

      const result = await CalculatorService.getTemplates(mockSupabase);

      expect(result).toHaveLength(0);
    });

    it('should throw error when database query fails', async () => {
      const mockSupabase = createMockSupabase({
        templates: [],
        selectError: new Error('Database connection failed'),
      });

      await expect(CalculatorService.getTemplates(mockSupabase)).rejects.toThrow(
        'Failed to fetch calculator templates'
      );
    });
  });

  describe('getTemplateWithRules', () => {
    it('should fetch template with its pricing rules', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Standard Delivery',
        is_active: true,
      };

      const mockRules = [
        {
          id: 'rule-1',
          template_id: 'template-1',
          rule_type: 'customer_charge',
          rule_name: 'base_fee',
          base_amount: '65.00',
          priority: 1,
        },
        {
          id: 'rule-2',
          template_id: 'template-1',
          rule_type: 'driver_payment',
          rule_name: 'mileage',
          per_unit_amount: '0.35',
          priority: 2,
        },
      ];

      // Create a more specific mock for this test
      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'calculator_templates') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockTemplate, error: null }),
                }),
              }),
            };
          }
          if (table === 'pricing_rules') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: mockRules, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await CalculatorService.getTemplateWithRules(mockSupabase, 'template-1');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Standard Delivery');
      expect(result?.pricingRules).toHaveLength(2);
      expect(result?.pricingRules?.[0].baseAmount).toBe(65.0);
    });

    it('should return null when template not found', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      };

      const result = await CalculatorService.getTemplateWithRules(mockSupabase, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getClientConfigurations', () => {
    it('should fetch all active client configurations', async () => {
      const mockConfigs = [
        {
          id: 'config-1',
          client_id: 'client-1',
          template_id: 'template-1',
          client_name: 'Acme Corp',
          rule_overrides: {},
          is_active: true,
        },
        {
          id: 'config-2',
          client_id: 'client-2',
          template_id: 'template-1',
          client_name: 'Beta Inc',
          rule_overrides: { mileage_rate: 0.5 },
          is_active: true,
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: mockConfigs, error: null }),
            }),
          }),
        }),
      };

      const result = await CalculatorService.getClientConfigurations(mockSupabase);

      expect(result).toHaveLength(2);
      expect(result[0].clientName).toBe('Acme Corp');
      expect(result[1].ruleOverrides).toEqual({ mileage_rate: 0.5 });
    });

    it('should filter by clientId when provided', async () => {
      const mockConfigs = [
        {
          id: 'config-1',
          client_id: 'client-1',
          client_name: 'Acme Corp',
          is_active: true,
        },
      ];

      const mockEq = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockConfigs, error: null }),
        }),
      });

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: mockEq,
          }),
        }),
      };

      const result = await CalculatorService.getClientConfigurations(mockSupabase, 'client-1');

      expect(result).toHaveLength(1);
      expect(mockEq).toHaveBeenCalledWith('is_active', true);
    });
  });

  describe('createClientConfig', () => {
    it('should create a new client configuration', async () => {
      const newConfig = {
        clientId: 'new-client',
        templateId: 'template-1',
        clientName: 'New Client Corp',
        ruleOverrides: { base_fee: 75 },
        areaRules: [],
        isActive: true,
      };

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'new-id', ...newConfig },
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await CalculatorService.createClientConfig(mockSupabase, newConfig);

      expect(result.id).toBe('new-id');
      expect(mockSupabase.from).toHaveBeenCalledWith('client_configurations');
    });

    it('should throw error when creation fails', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Insert failed' },
              }),
            }),
          }),
        }),
      };

      await expect(
        CalculatorService.createClientConfig(mockSupabase, {
          clientId: 'test',
          templateId: 'test',
          clientName: 'Test',
          isActive: true,
        })
      ).rejects.toThrow('Failed to create client configuration');
    });
  });

  describe('getRulesForTemplate', () => {
    it('should fetch pricing rules for a template', async () => {
      const mockRules = [
        { id: 'rule-1', template_id: 'template-1', rule_name: 'base_fee', priority: 1 },
        { id: 'rule-2', template_id: 'template-1', rule_name: 'mileage', priority: 2 },
      ];

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: mockRules, error: null }),
            }),
          }),
        }),
      };

      const result = await CalculatorService.getRulesForTemplate(mockSupabase, 'template-1');

      expect(result).toHaveLength(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules');
    });

    it('should return empty array when no rules exist', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };

      const result = await CalculatorService.getRulesForTemplate(mockSupabase, 'template-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('calculate', () => {
    it('should perform calculation with valid inputs', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Standard Delivery',
        is_active: true,
      };

      const mockRules = [
        {
          id: 'rule-1',
          template_id: 'template-1',
          rule_type: 'customer_charge',
          rule_name: 'base_fee',
          base_amount: '65.00',
          priority: 1,
        },
      ];

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'calculator_templates') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockTemplate, error: null }),
                }),
              }),
            };
          }
          if (table === 'pricing_rules') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: mockRules, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 1,
        requiresBridge: false,
      };

      const result = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      expect(result).toBeDefined();
      expect(result.customerCharges).toBeDefined();
      expect(result.driverPayments).toBeDefined();
      expect(result.profit).toBeDefined();
      expect(result.templateUsed).toBe('Standard Delivery');
      expect(result.calculatedAt).toBeDefined();
    });

    it('should throw error when template not found', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      };

      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 1,
      };

      await expect(
        CalculatorService.calculate(mockSupabase, 'non-existent', input)
      ).rejects.toThrow('Calculator template not found');
    });

    it('should include metadata in calculation result', async () => {
      const mockTemplate = { id: 'template-1', name: 'Test Template', is_active: true };
      const mockRules: any[] = [];

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'calculator_templates') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockTemplate, error: null }),
                }),
              }),
            };
          }
          if (table === 'pricing_rules') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: mockRules, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const input: CalculationInput = {
        headcount: 100,
        foodCost: 1000,
        mileage: 20,
        numberOfDrives: 2,
        requiresBridge: true,
      };

      const result = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.headcount).toBe(100);
      expect(result.metadata?.foodCost).toBe(1000);
      expect(result.metadata?.mileage).toBe(20);
      expect(result.metadata?.numberOfDrives).toBe(2);
    });
  });

  describe('saveCalculationHistory', () => {
    it('should save calculation to history', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: mockInsert,
        }),
      };

      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 1,
      };

      const result = {
        customerCharges: { total: 100, baseDeliveryFee: 65, mileageCharges: 35 },
        driverPayments: { total: 50, basePay: 35, mileagePay: 15 },
        profit: 50,
        templateUsed: 'Test Template',
        calculatedAt: new Date().toISOString(),
      };

      // Should not throw
      await expect(
        CalculatorService.saveCalculationHistory(
          mockSupabase,
          'template-1',
          input,
          result as any,
          'config-1',
          'user-1'
        )
      ).resolves.not.toThrow();

      expect(mockSupabase.from).toHaveBeenCalledWith('calculation_history');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should not throw when save fails (non-critical operation)', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockResolvedValue({ error: { message: 'Insert failed' } }),
        }),
      };

      const input: CalculationInput = { headcount: 50, foodCost: 500, mileage: 15, numberOfStops: 1 };
      const result = {
        customerCharges: { total: 100 },
        driverPayments: { total: 50 },
        profit: 50,
        templateUsed: 'Test',
        calculatedAt: new Date().toISOString(),
      };

      // Should not throw even on error
      await expect(
        CalculatorService.saveCalculationHistory(mockSupabase, 'template-1', input, result as any)
      ).resolves.not.toThrow();
    });
  });

  describe('getCalculationHistory', () => {
    it('should fetch calculation history with pagination', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          template_id: 'template-1',
          input_data: { headcount: 50 },
          customer_total: 100,
          driver_total: 50,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'history-2',
          template_id: 'template-1',
          input_data: { headcount: 100 },
          customer_total: 200,
          driver_total: 100,
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      const mockLimit = jest.fn().mockResolvedValue({ data: mockHistory, error: null });
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit, data: mockHistory, error: null });

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: mockOrder,
          }),
        }),
      };

      const result = await CalculatorService.getCalculationHistory(mockSupabase, { limit: 10 });

      expect(result).toHaveLength(2);
      expect(result[0].customerTotal).toBe(100);
      expect(result[1].customerTotal).toBe(200);
    });

    it('should filter by userId when provided', async () => {
      const mockHistory = [
        { id: 'history-1', user_id: 'user-1', customer_total: 100, driver_total: 50 },
      ];

      const mockEq = jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ data: mockHistory, error: null }),
      });

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              eq: mockEq,
            }),
          }),
        }),
      };

      const result = await CalculatorService.getCalculationHistory(mockSupabase, {
        userId: 'user-1',
        limit: 10,
      });

      expect(result).toHaveLength(1);
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('should filter by templateId when provided', async () => {
      const mockHistory = [
        { id: 'history-1', template_id: 'template-1', customer_total: 100, driver_total: 50 },
      ];

      const mockEq = jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ data: mockHistory, error: null }),
      });

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              eq: mockEq,
            }),
          }),
        }),
      };

      const result = await CalculatorService.getCalculationHistory(mockSupabase, {
        templateId: 'template-1',
        limit: 10,
      });

      expect(result).toHaveLength(1);
      expect(mockEq).toHaveBeenCalledWith('template_id', 'template-1');
    });

    it('should return empty array when no history exists', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };

      const result = await CalculatorService.getCalculationHistory(mockSupabase);

      expect(result).toHaveLength(0);
    });
  });

  describe('placeholder methods', () => {
    describe('createRule', () => {
      it('should return mock rule', async () => {
        const input = {
          templateId: 'template-1',
          ruleName: 'test_rule',
          ruleType: 'customer_charge',
          baseAmount: 100,
        };

        const result = await CalculatorService.createRule(input);

        expect(result.ruleName).toBe('test_rule');
        expect(result.baseAmount).toBe(100);
        expect(result.id).toContain('mock-');
      });
    });

    describe('updateRule', () => {
      it('should return mock updated rule', async () => {
        const updates = {
          ruleName: 'updated_rule',
          baseAmount: 200,
        };

        const result = await CalculatorService.updateRule('rule-1', updates);

        expect(result.id).toBe('rule-1');
        expect(result.ruleName).toBe('updated_rule');
        expect(result.baseAmount).toBe(200);
      });
    });

    describe('deleteRule', () => {
      it('should not throw', async () => {
        await expect(CalculatorService.deleteRule('rule-1')).resolves.not.toThrow();
      });
    });

    describe('createTemplate', () => {
      it('should return mock template', async () => {
        const input = { name: 'New Template', description: 'Test template' };

        const result = await CalculatorService.createTemplate(input);

        expect(result.name).toBe('New Template');
        expect(result.description).toBe('Test template');
        expect(result.id).toContain('mock-template-');
      });
    });

    describe('updateTemplate', () => {
      it('should return mock updated template', async () => {
        const updates = { name: 'Updated Template' };

        const result = await CalculatorService.updateTemplate('template-1', updates);

        expect(result.id).toBe('template-1');
        expect(result.name).toBe('Updated Template');
      });
    });

    describe('getCalculatorConfig', () => {
      it('should return basic config structure', async () => {
        const result = await CalculatorService.getCalculatorConfig('template-1', 'config-1');

        expect(result.templateId).toBe('template-1');
        expect(result.clientConfigId).toBe('config-1');
        expect(result.template).toBeNull();
        expect(result.clientConfig).toBeNull();
      });
    });
  });
});
