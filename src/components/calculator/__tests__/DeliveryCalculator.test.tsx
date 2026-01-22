/**
 * Unit Tests for DeliveryCalculator Component
 *
 * Tests cover:
 * - Component rendering (loading, error, normal states)
 * - Form input interactions
 * - Template and client config selection
 * - Save calculation functionality
 * - Results display
 *
 * Note: Tab navigation tests are simplified due to Radix UI Tab component
 * rendering differences in test environment vs browser.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeliveryCalculator } from '../DeliveryCalculator';

// Mock the hooks
const mockLoadConfig = jest.fn();
const mockLoadTemplates = jest.fn();
const mockLoadClientConfigs = jest.fn();
const mockSetActiveTemplate = jest.fn();
const mockSetActiveClientConfig = jest.fn();
const mockClearError = jest.fn();
const mockCalculate = jest.fn();
const mockClearResult = jest.fn();
const mockClearCalculationError = jest.fn();
const mockLoadHistory = jest.fn();
const mockClearHistoryError = jest.fn();

// Default mock return values
const defaultConfigHookReturn = {
  config: null,
  templates: [],
  clientConfigs: [],
  isLoading: false,
  isLoadingTemplates: false,
  error: null,
  loadConfig: mockLoadConfig,
  loadTemplates: mockLoadTemplates,
  loadClientConfigs: mockLoadClientConfigs,
  setActiveTemplate: mockSetActiveTemplate,
  setActiveClientConfig: mockSetActiveClientConfig,
  clearError: mockClearError,
};

const defaultCalculatorHookReturn = {
  result: null,
  isCalculating: false,
  error: null,
  calculate: mockCalculate,
  clearResult: mockClearResult,
  clearError: mockClearCalculationError,
};

const defaultHistoryHookReturn = {
  history: [],
  isLoading: false,
  error: null,
  loadHistory: mockLoadHistory,
  clearError: mockClearHistoryError,
};

let mockUseCalculatorConfig = jest.fn(() => defaultConfigHookReturn);
let mockUseCalculator = jest.fn(() => defaultCalculatorHookReturn);
let mockUseCalculatorHistory = jest.fn(() => defaultHistoryHookReturn);

jest.mock('@/hooks/useCalculatorConfig', () => ({
  useCalculatorConfig: () => mockUseCalculatorConfig(),
  useCalculator: (config: any) => mockUseCalculator(config),
  useCalculatorHistory: (options: any) => mockUseCalculatorHistory(options),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock data
const mockTemplates = [
  {
    id: 'template-123',
    name: 'Standard Delivery',
    description: 'Default pricing template',
    isActive: true,
    pricingRules: [],
  },
  {
    id: 'template-456',
    name: 'Premium Delivery',
    description: 'Premium pricing',
    isActive: true,
    pricingRules: [],
  },
];

const mockClientConfigs = [
  {
    id: 'config-123',
    clientId: 'client-001',
    clientName: 'Ready Set Food - Standard',
    templateId: 'template-123',
    ruleOverrides: {},
    isActive: true,
  },
  {
    id: 'config-456',
    clientId: 'client-002',
    clientName: 'Custom Client',
    templateId: 'template-123',
    ruleOverrides: {},
    isActive: true,
  },
];

const mockConfig = {
  template: mockTemplates[0],
  clientConfig: null,
  rules: [],
  areaRules: [],
};

const mockResult = {
  customerCharges: {
    baseDeliveryFee: 55.50,
    mileageCharges: 15,
    bridgeToll: 0,
    dailyDriveDiscount: 0,
    extraStopsCharge: 0,
    total: 125.50,
  },
  driverPayments: {
    basePay: 25,
    mileagePay: 35,
    bonus: 10,
    bridgeToll: 0,
    extraStopsBonus: 0,
    adjustments: 0,
    total: 70,
  },
  profit: 55.50,
  calculatedAt: new Date().toISOString(),
  templateUsed: 'template-123',
  metadata: {
    readySetFee: 45,
    readySetMileageRate: 3.0,
    vendorMileageRate: 2.5,
    mileage: 15,
  },
};

describe('DeliveryCalculator Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();

    // Reset hook mocks to defaults
    mockUseCalculatorConfig = jest.fn(() => defaultConfigHookReturn);
    mockUseCalculator = jest.fn(() => defaultCalculatorHookReturn);
    mockUseCalculatorHistory = jest.fn(() => defaultHistoryHookReturn);
  });

  describe('Loading States', () => {
    it('should show loading spinner when loading templates', () => {
      mockUseCalculatorConfig.mockReturnValue({
        ...defaultConfigHookReturn,
        isLoadingTemplates: true,
      });

      render(<DeliveryCalculator />);

      expect(screen.getByText('Loading calculator configuration...')).toBeInTheDocument();
    });

    it('should show loading spinner when loading config', () => {
      mockUseCalculatorConfig.mockReturnValue({
        ...defaultConfigHookReturn,
        isLoading: true,
      });

      render(<DeliveryCalculator />);

      expect(screen.getByText('Loading calculator configuration...')).toBeInTheDocument();
    });
  });

  describe('Normal Rendering', () => {
    beforeEach(() => {
      mockUseCalculatorConfig.mockReturnValue({
        ...defaultConfigHookReturn,
        templates: mockTemplates,
        clientConfigs: mockClientConfigs,
        config: mockConfig,
      });
    });

    it('should render the calculator title', () => {
      render(<DeliveryCalculator />);

      expect(screen.getByText('Delivery Calculator')).toBeInTheDocument();
    });

    it('should render template and client config selectors', () => {
      render(<DeliveryCalculator />);

      expect(screen.getByText('Calculator Template')).toBeInTheDocument();
      expect(screen.getByText(/Client Configuration/)).toBeInTheDocument();
    });

    it('should render tab navigation', () => {
      render(<DeliveryCalculator />);

      // Tabs are rendered as buttons with specific text
      expect(screen.getByText('Input')).toBeInTheDocument();
      expect(screen.getByText('Results')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
    });

    it('should render input form fields', () => {
      render(<DeliveryCalculator />);

      expect(screen.getByLabelText('Headcount')).toBeInTheDocument();
      expect(screen.getByLabelText('Food Cost ($)')).toBeInTheDocument();
      expect(screen.getByLabelText('Delivery Area')).toBeInTheDocument();
      expect(screen.getByLabelText('Total Mileage')).toBeInTheDocument();
      expect(screen.getByLabelText('Mileage Rate ($/mile)')).toBeInTheDocument();
      expect(screen.getByLabelText('Requires Bridge Crossing')).toBeInTheDocument();
    });

    it('should render additional services fields', () => {
      render(<DeliveryCalculator />);

      expect(screen.getByLabelText('Number of Stops')).toBeInTheDocument();
      expect(screen.getByLabelText('Driver Bonus Pay ($)')).toBeInTheDocument();
      expect(screen.getByLabelText('Adjustments ($)')).toBeInTheDocument();
    });

    it('should render clear form button', () => {
      render(<DeliveryCalculator />);

      expect(screen.getByRole('button', { name: 'Clear Form' })).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    beforeEach(() => {
      mockUseCalculatorConfig.mockReturnValue({
        ...defaultConfigHookReturn,
        templates: mockTemplates,
        clientConfigs: mockClientConfigs,
        config: mockConfig,
      });
    });

    it('should update headcount input', async () => {
      const user = userEvent.setup();
      render(<DeliveryCalculator />);

      const headcountInput = screen.getByLabelText('Headcount');
      await user.clear(headcountInput);
      await user.type(headcountInput, '50');

      expect(headcountInput).toHaveValue(50);
    });

    it('should update food cost input', async () => {
      const user = userEvent.setup();
      render(<DeliveryCalculator />);

      const foodCostInput = screen.getByLabelText('Food Cost ($)');
      await user.clear(foodCostInput);
      await user.type(foodCostInput, '500');

      expect(foodCostInput).toHaveValue(500);
    });

    it('should update mileage input', async () => {
      const user = userEvent.setup();
      render(<DeliveryCalculator />);

      const mileageInput = screen.getByLabelText('Total Mileage');
      await user.clear(mileageInput);
      await user.type(mileageInput, '15');

      expect(mileageInput).toHaveValue(15);
    });

    it('should toggle bridge crossing switch', async () => {
      const user = userEvent.setup();
      render(<DeliveryCalculator />);

      const bridgeSwitch = screen.getByRole('switch', { name: /Requires Bridge Crossing/i });
      expect(bridgeSwitch).not.toBeChecked();

      await user.click(bridgeSwitch);
      expect(bridgeSwitch).toBeChecked();
    });

    it('should clear form when Clear Form button is clicked', async () => {
      const user = userEvent.setup();
      render(<DeliveryCalculator />);

      // Fill in some values
      const headcountInput = screen.getByLabelText('Headcount');
      await user.clear(headcountInput);
      await user.type(headcountInput, '100');

      // Click clear
      const clearButton = screen.getByRole('button', { name: 'Clear Form' });
      await user.click(clearButton);

      // Should be reset to 0
      expect(headcountInput).toHaveValue(0);
    });
  });

  describe('Tab Navigation', () => {
    beforeEach(() => {
      mockUseCalculatorConfig.mockReturnValue({
        ...defaultConfigHookReturn,
        templates: mockTemplates,
        clientConfigs: mockClientConfigs,
        config: mockConfig,
      });
    });

    it('should switch to Results tab when clicked', async () => {
      const user = userEvent.setup();
      render(<DeliveryCalculator />);

      // Click on the Results tab
      await user.click(screen.getByText('Results'));

      // Verify Results tab content is displayed (Ready to Calculate message)
      expect(screen.getByText('Ready to Calculate')).toBeInTheDocument();
    });

    it('should switch to History tab when clicked', async () => {
      const user = userEvent.setup();
      render(<DeliveryCalculator />);

      // Click on the History tab
      await user.click(screen.getByText('History'));

      // Verify History tab content is displayed
      expect(screen.getByText('Recent Calculations')).toBeInTheDocument();
    });

    it('should show Ready to Calculate message when no result on Results tab', async () => {
      const user = userEvent.setup();
      render(<DeliveryCalculator />);

      const resultsTab = screen.getByText('Results').closest('button');
      await user.click(resultsTab!);

      expect(screen.getByText('Ready to Calculate')).toBeInTheDocument();
      expect(screen.getByText(/Enter delivery information/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display configuration error', () => {
      mockUseCalculatorConfig.mockReturnValue({
        ...defaultConfigHookReturn,
        templates: mockTemplates,
        config: mockConfig,
        error: 'Failed to load configuration',
      });

      render(<DeliveryCalculator />);

      expect(screen.getByText('Failed to load configuration')).toBeInTheDocument();
    });

    it('should display calculation error', () => {
      mockUseCalculatorConfig.mockReturnValue({
        ...defaultConfigHookReturn,
        templates: mockTemplates,
        config: mockConfig,
      });

      mockUseCalculator.mockReturnValue({
        ...defaultCalculatorHookReturn,
        error: 'Calculation failed',
      });

      render(<DeliveryCalculator />);

      expect(screen.getByText('Calculation failed')).toBeInTheDocument();
    });

    it('should have dismiss button for errors', () => {
      mockUseCalculatorConfig.mockReturnValue({
        ...defaultConfigHookReturn,
        templates: mockTemplates,
        config: mockConfig,
        error: 'Some error',
      });

      render(<DeliveryCalculator />);

      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    });
  });

  describe('Results Display', () => {
    beforeEach(() => {
      mockUseCalculatorConfig.mockReturnValue({
        ...defaultConfigHookReturn,
        templates: mockTemplates,
        clientConfigs: mockClientConfigs,
        config: mockConfig,
      });
    });

    it('should show Save Calculation button when result is available', () => {
      mockUseCalculator.mockReturnValue({
        ...defaultCalculatorHookReturn,
        result: mockResult,
      });

      render(<DeliveryCalculator />);

      expect(screen.getByRole('button', { name: /Save Calculation/i })).toBeInTheDocument();
    });

    it('should show View Results button when result is available', () => {
      mockUseCalculator.mockReturnValue({
        ...defaultCalculatorHookReturn,
        result: mockResult,
      });

      render(<DeliveryCalculator />);

      expect(screen.getByRole('button', { name: 'View Results' })).toBeInTheDocument();
    });

    it('should show calculating state', async () => {
      const user = userEvent.setup();

      mockUseCalculator.mockReturnValue({
        ...defaultCalculatorHookReturn,
        isCalculating: true,
      });

      render(<DeliveryCalculator />);

      // Go to Results tab
      const resultsTab = screen.getByText('Results').closest('button');
      await user.click(resultsTab!);

      expect(screen.getByText('Calculating...')).toBeInTheDocument();
    });

    it('should display driver payments when result is available', async () => {
      const user = userEvent.setup();

      mockUseCalculator.mockReturnValue({
        ...defaultCalculatorHookReturn,
        result: mockResult,
      });

      render(<DeliveryCalculator />);

      // Go to Results tab
      const resultsTab = screen.getByText('Results').closest('button');
      await user.click(resultsTab!);

      expect(screen.getByText('Driver Payments')).toBeInTheDocument();
    });
  });

  describe('Save Calculation', () => {
    beforeEach(() => {
      mockUseCalculatorConfig.mockReturnValue({
        ...defaultConfigHookReturn,
        templates: mockTemplates,
        clientConfigs: mockClientConfigs,
        config: mockConfig,
      });

      mockUseCalculator.mockReturnValue({
        ...defaultCalculatorHookReturn,
        result: mockResult,
      });
    });

    it('should call API when save button is clicked', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<DeliveryCalculator />);

      const saveButton = screen.getByRole('button', { name: /Save Calculation/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/calculator/save',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });

    it('should show success state after successful save', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<DeliveryCalculator />);

      const saveButton = screen.getByRole('button', { name: /Save Calculation/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Saved!/i })).toBeInTheDocument();
      });
    });

    it('should call onSaveCalculation callback when provided', async () => {
      const user = userEvent.setup();
      const onSaveCalculation = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<DeliveryCalculator onSaveCalculation={onSaveCalculation} />);

      const saveButton = screen.getByRole('button', { name: /Save Calculation/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(onSaveCalculation).toHaveBeenCalled();
      });
    });

    it('should reload history after successful save', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<DeliveryCalculator />);

      const saveButton = screen.getByRole('button', { name: /Save Calculation/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockLoadHistory).toHaveBeenCalled();
      });
    });
  });

  describe('History Tab', () => {
    beforeEach(() => {
      mockUseCalculatorConfig.mockReturnValue({
        ...defaultConfigHookReturn,
        templates: mockTemplates,
        clientConfigs: mockClientConfigs,
        config: mockConfig,
      });
    });

    it('should show loading state in history tab', async () => {
      const user = userEvent.setup();

      mockUseCalculatorHistory.mockReturnValue({
        ...defaultHistoryHookReturn,
        isLoading: true,
      });

      render(<DeliveryCalculator />);

      const historyTab = screen.getByText('History').closest('button');
      await user.click(historyTab!);

      expect(screen.getByText('Loading calculation history...')).toBeInTheDocument();
    });

    it('should show error state in history tab', async () => {
      const user = userEvent.setup();

      mockUseCalculatorHistory.mockReturnValue({
        ...defaultHistoryHookReturn,
        error: 'Failed to load history',
      });

      render(<DeliveryCalculator />);

      const historyTab = screen.getByText('History').closest('button');
      await user.click(historyTab!);

      expect(screen.getByText('Failed to load calculation history')).toBeInTheDocument();
    });

    it('should show empty state when no history', async () => {
      const user = userEvent.setup();

      mockUseCalculatorHistory.mockReturnValue({
        ...defaultHistoryHookReturn,
        history: [],
      });

      render(<DeliveryCalculator />);

      const historyTab = screen.getByText('History').closest('button');
      await user.click(historyTab!);

      expect(screen.getByText('No saved calculations yet')).toBeInTheDocument();
    });

    it('should display history items', async () => {
      const user = userEvent.setup();

      const mockHistory = [
        {
          id: 'history-1',
          customer_total: 150.50,
          driver_total: 75.25,
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      mockUseCalculatorHistory.mockReturnValue({
        ...defaultHistoryHookReturn,
        history: mockHistory,
      });

      render(<DeliveryCalculator />);

      const historyTab = screen.getByText('History').closest('button');
      await user.click(historyTab!);

      expect(screen.getByText(/Customer:/)).toBeInTheDocument();
      expect(screen.getByText(/Driver:/)).toBeInTheDocument();
      expect(screen.getByText(/Profit:/)).toBeInTheDocument();
    });
  });

  describe('Callbacks', () => {
    beforeEach(() => {
      mockUseCalculatorConfig.mockReturnValue({
        ...defaultConfigHookReturn,
        templates: mockTemplates,
        clientConfigs: mockClientConfigs,
        config: mockConfig,
      });
    });

    it('should call onCalculationComplete when result changes', () => {
      const onCalculationComplete = jest.fn();

      mockUseCalculator.mockReturnValue({
        ...defaultCalculatorHookReturn,
        result: mockResult,
      });

      render(<DeliveryCalculator onCalculationComplete={onCalculationComplete} />);

      // The callback is called in a useEffect when result changes
      expect(onCalculationComplete).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('Custom Class Name', () => {
    it('should apply custom className', () => {
      mockUseCalculatorConfig.mockReturnValue({
        ...defaultConfigHookReturn,
        templates: mockTemplates,
        config: mockConfig,
      });

      const { container } = render(<DeliveryCalculator className="custom-class" />);

      // The outer div should have the custom class
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-class');
    });
  });
});
