/**
 * Unit Tests for Calculator Hooks
 *
 * Tests for:
 * - useCalculatorConfig: Template loading, config switching, calculation
 * - useCalculatorHistory: History loading, pagination
 * - useCalculator: Real-time calculation, result management
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useCalculatorConfig,
  useCalculatorHistory,
  useCalculator,
} from '../useCalculatorConfig';

// Mock Supabase client
jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-token-123',
            user: { id: 'test-user-id', email: 'test@example.com' },
          },
        },
        error: null,
      }),
    },
  })),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock window.location.origin - jsdom already provides window.location
// so we just need to verify it exists for URL construction

// Sample test data
const mockTemplate = {
  id: 'template-123',
  name: 'Standard Delivery',
  description: 'Default pricing template',
  isActive: true,
  rules: [],
};

const mockTemplates = [
  mockTemplate,
  {
    id: 'template-456',
    name: 'Premium Delivery',
    description: 'Premium pricing with extra services',
    isActive: true,
    rules: [],
  },
];

const mockClientConfig = {
  id: 'config-123',
  clientId: 'client-001',
  templateId: 'template-123',
  name: 'Client Custom Config',
  overrides: {},
};

const mockConfig = {
  template: mockTemplate,
  clientConfig: mockClientConfig,
  rules: [
    { id: 'rule-1', name: 'Base Fee', value: 25 },
    { id: 'rule-2', name: 'Per Mile', value: 2.5 },
  ],
};

const mockCalculationResult = {
  baseFee: 25,
  mileageFee: 12.5,
  bridgeFee: 0,
  additionalStopsFee: 0,
  tipAmount: 5,
  adjustments: 0,
  totalDeliveryCost: 42.5,
  foodCost: 500,
  grandTotal: 542.5,
  breakdown: [],
};

const mockHistory = [
  {
    id: 'history-1',
    templateId: 'template-123',
    input: { headcount: 50, foodCost: 500 },
    result: mockCalculationResult,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'history-2',
    templateId: 'template-123',
    input: { headcount: 100, foodCost: 1000 },
    result: { ...mockCalculationResult, totalDeliveryCost: 85 },
    createdAt: '2024-01-14T10:00:00Z',
  },
];

describe('useCalculatorConfig Hook', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should return correct initial state with autoLoad disabled', () => {
      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      expect(result.current.config).toBeNull();
      expect(result.current.templates).toEqual([]);
      expect(result.current.clientConfigs).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isCalculating).toBe(false);
      expect(result.current.isLoadingTemplates).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should provide action functions', () => {
      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      expect(typeof result.current.loadConfig).toBe('function');
      expect(typeof result.current.loadTemplates).toBe('function');
      expect(typeof result.current.loadClientConfigs).toBe('function');
      expect(typeof result.current.calculate).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
      expect(typeof result.current.setActiveTemplate).toBe('function');
      expect(typeof result.current.setActiveClientConfig).toBe('function');
    });
  });

  describe('loadTemplates', () => {
    it('should load templates successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockTemplates }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadTemplates();
      });

      expect(result.current.templates).toEqual(mockTemplates);
      expect(result.current.isLoadingTemplates).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle template loading error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to load templates' }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadTemplates();
      });

      expect(result.current.templates).toEqual([]);
      expect(result.current.error).toBe('Failed to load templates');
    });

    it('should handle network error during template loading', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadTemplates();
      });

      expect(result.current.error).toBe('Network error');
    });

    it('should auto-load templates when autoLoad is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockTemplates }),
      });

      renderHook(() => useCalculatorConfig({ autoLoad: true }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/calculator/templates',
          expect.objectContaining({
            credentials: 'include',
          })
        );
      });
    });
  });

  describe('loadConfig', () => {
    it('should load config successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockConfig }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadConfig('template-123');
      });

      expect(result.current.config).toEqual(mockConfig);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should load config with client configuration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockConfig }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadConfig('template-123', 'config-123');
      });

      const fetchCall = mockFetch.mock.calls[0][0];
      expect(fetchCall).toContain('templateId=template-123');
      expect(fetchCall).toContain('clientConfigId=config-123');
    });

    it('should handle config loading error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Configuration not found' }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadConfig('template-123');
      });

      expect(result.current.config).toBeNull();
      expect(result.current.error).toBe('Configuration not found');
    });

    it('should handle authentication error', async () => {
      const { createClient } = require('@/utils/supabase/client');
      createClient.mockReturnValueOnce({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadConfig('template-123');
      });

      expect(result.current.error).toBe(
        'Authentication required. Please sign in again.'
      );
    });
  });

  describe('loadClientConfigs', () => {
    it('should load client configs successfully', async () => {
      const mockConfigs = [mockClientConfig];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockConfigs }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadClientConfigs();
      });

      expect(result.current.clientConfigs).toEqual(mockConfigs);
    });

    it('should load client configs with clientId filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockClientConfig] }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadClientConfigs('client-001');
      });

      const fetchCall = mockFetch.mock.calls[0][0];
      expect(fetchCall).toContain('clientId=client-001');
    });

    it('should fallback to empty array on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Forbidden' }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadClientConfigs();
      });

      // Should not set error, just use empty array
      expect(result.current.clientConfigs).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('calculate', () => {
    it('should return null when no config is loaded', async () => {
      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      let calcResult;
      await act(async () => {
        calcResult = await result.current.calculate({
          headcount: 50,
          foodCost: 500,
        });
      });

      expect(calcResult).toBeNull();
      expect(result.current.error).toBe('No calculator template selected');
    });

    it('should perform calculation successfully', async () => {
      // First load config
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockConfig }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadConfig('template-123');
      });

      // Then calculate
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockCalculationResult }),
      });

      let calcResult;
      await act(async () => {
        calcResult = await result.current.calculate({
          headcount: 50,
          foodCost: 500,
          mileage: 5,
        });
      });

      expect(calcResult).toEqual(mockCalculationResult);
      expect(result.current.isCalculating).toBe(false);
    });

    it('should handle calculation error', async () => {
      // First load config
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockConfig }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadConfig('template-123');
      });

      // Then fail calculation
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid calculation parameters' }),
      });

      let calcResult;
      await act(async () => {
        calcResult = await result.current.calculate({
          headcount: -1, // Invalid
          foodCost: 500,
        });
      });

      expect(calcResult).toBeNull();
      expect(result.current.error).toBe('Invalid calculation parameters');
    });
  });

  describe('setActiveTemplate', () => {
    it('should load config with new template', async () => {
      // Load initial config
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockConfig }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadConfig('template-123');
      });

      // Set new template - this triggers loadConfig
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { ...mockConfig, template: { id: 'template-456' } },
        }),
      });

      act(() => {
        result.current.setActiveTemplate('template-456');
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const lastCall = mockFetch.mock.calls[1][0];
      expect(lastCall).toContain('templateId=template-456');
    });
  });

  describe('setActiveClientConfig', () => {
    it('should reload config with new client config', async () => {
      // Load initial config
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockConfig }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadConfig('template-123', 'config-123');
      });

      // Set new client config
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { ...mockConfig, clientConfig: { id: 'config-456' } },
        }),
      });

      act(() => {
        result.current.setActiveClientConfig('config-456');
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const lastCall = mockFetch.mock.calls[1][0];
      expect(lastCall).toContain('clientConfigId=config-456');
    });

    it('should not reload if same config is already set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockConfig }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadConfig('template-123', 'config-123');
      });

      act(() => {
        result.current.setActiveClientConfig('config-123');
      });

      // Should not trigger another fetch
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Some error' }),
      });

      const { result } = renderHook(() =>
        useCalculatorConfig({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadTemplates();
      });

      expect(result.current.error).toBe('Some error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});

describe('useCalculatorHistory Hook', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should return correct initial state with autoLoad disabled', () => {
      const { result } = renderHook(() =>
        useCalculatorHistory({ autoLoad: false })
      );

      expect(result.current.history).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.loadHistory).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('loadHistory', () => {
    it('should load history successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockHistory }),
      });

      const { result } = renderHook(() =>
        useCalculatorHistory({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      expect(result.current.history).toEqual(mockHistory);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should pass userId filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockHistory }),
      });

      const { result } = renderHook(() =>
        useCalculatorHistory({ userId: 'user-123', autoLoad: false })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      const fetchCall = mockFetch.mock.calls[0][0];
      expect(fetchCall).toContain('userId=user-123');
    });

    it('should pass templateId filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockHistory }),
      });

      const { result } = renderHook(() =>
        useCalculatorHistory({ templateId: 'template-123', autoLoad: false })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      const fetchCall = mockFetch.mock.calls[0][0];
      expect(fetchCall).toContain('templateId=template-123');
    });

    it('should pass limit parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockHistory }),
      });

      const { result } = renderHook(() =>
        useCalculatorHistory({ limit: 25, autoLoad: false })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      const fetchCall = mockFetch.mock.calls[0][0];
      expect(fetchCall).toContain('limit=25');
    });

    it('should use default limit of 50', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockHistory }),
      });

      const { result } = renderHook(() =>
        useCalculatorHistory({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      const fetchCall = mockFetch.mock.calls[0][0];
      expect(fetchCall).toContain('limit=50');
    });

    it('should handle history loading error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to load history' }),
      });

      const { result } = renderHook(() =>
        useCalculatorHistory({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      expect(result.current.history).toEqual([]);
      expect(result.current.error).toBe('Failed to load history');
    });

    it('should handle authentication error', async () => {
      const { createClient } = require('@/utils/supabase/client');
      createClient.mockReturnValueOnce({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
      });

      const { result } = renderHook(() =>
        useCalculatorHistory({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      expect(result.current.error).toBe(
        'Authentication required. Please sign in again.'
      );
    });

    it('should auto-load history when autoLoad is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockHistory }),
      });

      renderHook(() => useCalculatorHistory({ autoLoad: true }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'History error' }),
      });

      const { result } = renderHook(() =>
        useCalculatorHistory({ autoLoad: false })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      expect(result.current.error).toBe('History error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});

describe('useCalculator Hook', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should return correct initial state', () => {
      const { result } = renderHook(() => useCalculator(null));

      expect(result.current.result).toBeNull();
      expect(result.current.isCalculating).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.calculate).toBe('function');
      expect(typeof result.current.clearResult).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('calculate', () => {
    it('should error when config is null', async () => {
      const { result } = renderHook(() => useCalculator(null));

      await act(async () => {
        await result.current.calculate({ headcount: 50, foodCost: 500 });
      });

      expect(result.current.error).toBe('No calculator configuration available');
      expect(result.current.result).toBeNull();
    });

    it('should error when config has no template', async () => {
      const configWithoutTemplate = { template: null, clientConfig: null };

      const { result } = renderHook(() =>
        useCalculator(configWithoutTemplate as any)
      );

      await act(async () => {
        await result.current.calculate({ headcount: 50, foodCost: 500 });
      });

      expect(result.current.error).toBe('No calculator configuration available');
    });

    it('should perform calculation successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockCalculationResult }),
      });

      const { result } = renderHook(() => useCalculator(mockConfig as any));

      await act(async () => {
        await result.current.calculate({
          headcount: 50,
          foodCost: 500,
          mileage: 5,
        });
      });

      expect(result.current.result).toEqual(mockCalculationResult);
      expect(result.current.isCalculating).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should send saveHistory: false for real-time calculations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockCalculationResult }),
      });

      const { result } = renderHook(() => useCalculator(mockConfig as any));

      await act(async () => {
        await result.current.calculate({
          headcount: 50,
          foodCost: 500,
        });
      });

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.saveHistory).toBe(false);
    });

    it('should include templateId and clientConfigId in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockCalculationResult }),
      });

      const { result } = renderHook(() => useCalculator(mockConfig as any));

      await act(async () => {
        await result.current.calculate({
          headcount: 50,
          foodCost: 500,
        });
      });

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.templateId).toBe('template-123');
      expect(requestBody.clientConfigId).toBe('config-123');
    });

    it('should handle calculation error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Calculation failed' }),
      });

      const { result } = renderHook(() => useCalculator(mockConfig as any));

      await act(async () => {
        await result.current.calculate({
          headcount: 50,
          foodCost: 500,
        });
      });

      expect(result.current.result).toBeNull();
      expect(result.current.error).toBe('Calculation failed');
    });

    it('should handle authentication error', async () => {
      const { createClient } = require('@/utils/supabase/client');
      createClient.mockReturnValueOnce({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
      });

      const { result } = renderHook(() => useCalculator(mockConfig as any));

      await act(async () => {
        await result.current.calculate({
          headcount: 50,
          foodCost: 500,
        });
      });

      expect(result.current.error).toBe(
        'Authentication required. Please sign in again.'
      );
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useCalculator(mockConfig as any));

      await act(async () => {
        await result.current.calculate({
          headcount: 50,
          foodCost: 500,
        });
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('clearResult', () => {
    it('should clear calculation result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockCalculationResult }),
      });

      const { result } = renderHook(() => useCalculator(mockConfig as any));

      await act(async () => {
        await result.current.calculate({
          headcount: 50,
          foodCost: 500,
        });
      });

      expect(result.current.result).toEqual(mockCalculationResult);

      act(() => {
        result.current.clearResult();
      });

      expect(result.current.result).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Some error' }),
      });

      const { result } = renderHook(() => useCalculator(mockConfig as any));

      await act(async () => {
        await result.current.calculate({
          headcount: 50,
          foodCost: 500,
        });
      });

      expect(result.current.error).toBe('Some error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Config Changes', () => {
    it('should use updated config when config prop changes', async () => {
      const newConfig = {
        ...mockConfig,
        template: { id: 'template-789', name: 'New Template' },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockCalculationResult }),
      });

      const { result, rerender } = renderHook(
        ({ config }) => useCalculator(config as any),
        { initialProps: { config: mockConfig } }
      );

      await act(async () => {
        await result.current.calculate({
          headcount: 50,
          foodCost: 500,
        });
      });

      // Check first request used original template
      let requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.templateId).toBe('template-123');

      // Rerender with new config
      rerender({ config: newConfig });

      await act(async () => {
        await result.current.calculate({
          headcount: 50,
          foodCost: 500,
        });
      });

      // Check second request used new template
      requestBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(requestBody.templateId).toBe('template-789');
    });
  });
});
