/**
 * Unit Tests for VendorPricingEditor Component
 *
 * Tests cover:
 * - Component rendering with config data
 * - Form field interactions (text, number, toggle)
 * - Validation display
 * - Save and Reset button behavior
 * - Dirty state tracking
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VendorPricingEditor } from '../VendorPricingEditor';
import type { ClientDeliveryConfiguration } from '@/lib/calculator/client-configurations';

// Mock sub-components to isolate VendorPricingEditor behavior
jest.mock('@/components/calculator/vendor-pricing', () => ({
  PricingTiersEditor: ({ tiers, onChange }: any) => (
    <div data-testid="pricing-tiers-editor">
      <span>{tiers?.length ?? 0} tiers</span>
      <button onClick={() => onChange([...tiers, { headcountMin: 0, headcountMax: 10, foodCostMin: 0, foodCostMax: null, regularRate: 50, within10Miles: 40 }])}>
        Add Tier
      </button>
    </div>
  ),
  DriverPaySettingsEditor: ({ settings, onChange }: any) => (
    <div data-testid="driver-pay-editor">
      <span>Base: ${settings.basePayPerDrop}</span>
    </div>
  ),
  BridgeTollEditor: ({ settings, onChange }: any) => (
    <div data-testid="bridge-toll-editor">
      <span>Toll: ${settings.defaultTollAmount}</span>
    </div>
  ),
  ZeroOrderSettingsEditor: ({ settings, onChange }: any) => (
    <div data-testid="zero-order-editor">Zero Order</div>
  ),
  AdvancedFlagsEditor: ({ settings, onChange }: any) => (
    <div data-testid="advanced-flags-editor">Advanced Flags</div>
  ),
}));

// Mock validateConfiguration
const mockValidateConfiguration = jest.fn().mockReturnValue({ valid: true, errors: [] });
jest.mock('@/lib/calculator/client-configurations', () => ({
  validateConfiguration: (...args: any[]) => mockValidateConfiguration(...args),
}));

// Helper to create a valid config
function createMockConfig(overrides?: Partial<ClientDeliveryConfiguration>): ClientDeliveryConfiguration {
  return {
    id: 'test-config',
    clientName: 'Test Client',
    vendorName: 'Test Vendor',
    description: 'Test description',
    isActive: true,
    pricingTiers: [
      {
        headcountMin: 1,
        headcountMax: 25,
        foodCostMin: 0,
        foodCostMax: null,
        regularRate: 79,
        within10Miles: 69,
      },
    ],
    mileageRate: 2.5,
    distanceThreshold: 10,
    dailyDriveDiscounts: {
      twoDrivers: 10,
      threeDrivers: 15,
      fourPlusDrivers: 20,
    },
    driverPaySettings: {
      maxPayPerDrop: 65,
      basePayPerDrop: 25,
      bonusPay: 5,
      readySetFee: 10,
    },
    bridgeTollSettings: {
      defaultTollAmount: 7,
      autoApplyForAreas: ['San Francisco'],
    },
    customSettings: {},
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    notes: 'Test notes',
    ...overrides,
  };
}

describe('VendorPricingEditor', () => {
  const mockOnSave = jest.fn();
  const mockOnDirtyChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateConfiguration.mockReturnValue({ valid: true, errors: [] });
  });

  describe('Rendering', () => {
    it('should render the General Info section with config values', () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      expect(screen.getByDisplayValue('Test Client')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Vendor')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test notes')).toBeInTheDocument();
    });

    it('should render the accordion sections', () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      expect(screen.getByText('General Info')).toBeInTheDocument();
      expect(screen.getByText('Pricing Tiers')).toBeInTheDocument();
      expect(screen.getByText('Mileage & Distance')).toBeInTheDocument();
      expect(screen.getByText('Daily Drive Discounts')).toBeInTheDocument();
      expect(screen.getByText('Driver Pay Settings')).toBeInTheDocument();
      expect(screen.getByText('Bridge Toll Settings')).toBeInTheDocument();
      expect(screen.getByText('Advanced Flags')).toBeInTheDocument();
    });

    it('should render mileage and distance values when section is expanded', () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      // Expand the Mileage & Distance accordion section
      fireEvent.click(screen.getByText('Mileage & Distance'));

      expect(screen.getByDisplayValue('2.5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    });

    it('should render sub-components when sections are expanded', () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      // Expand all accordion sections that contain sub-components
      fireEvent.click(screen.getByText('Pricing Tiers'));
      fireEvent.click(screen.getByText('Driver Pay Settings'));
      fireEvent.click(screen.getByText('Bridge Toll Settings'));
      fireEvent.click(screen.getByText('Advanced Flags'));

      expect(screen.getByTestId('pricing-tiers-editor')).toBeInTheDocument();
      expect(screen.getByTestId('driver-pay-editor')).toBeInTheDocument();
      expect(screen.getByTestId('bridge-toll-editor')).toBeInTheDocument();
      expect(screen.getByTestId('advanced-flags-editor')).toBeInTheDocument();
    });

    it('should show Zero Order section for HY Food Company vendor', () => {
      const config = createMockConfig({
        vendorName: 'HY Food Company',
        zeroOrderSettings: {
          enabled: true,
          readySetFee: 15,
          customerDeliveryFee: 15,
          driverBasePay: 20,
          driverMileagePay: 7,
          driverBonusPay: 5,
        },
      });
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      expect(screen.getByText('Zero Order Settings')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    it('should update client name when changed', async () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      const input = screen.getByDisplayValue('Test Client');
      fireEvent.change(input, { target: { value: 'Updated Client' } });

      expect(screen.getByDisplayValue('Updated Client')).toBeInTheDocument();
    });

    it('should track dirty state when fields change', () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor
          config={config}
          onSave={mockOnSave}
          isSaving={false}
          onDirtyChange={mockOnDirtyChange}
        />
      );

      const input = screen.getByDisplayValue('Test Client');
      fireEvent.change(input, { target: { value: 'Changed Client' } });

      // Should be called with true (dirty)
      expect(mockOnDirtyChange).toHaveBeenCalledWith(true);
    });

    it('should update mileage rate when changed', () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      // Expand the Mileage & Distance accordion section
      fireEvent.click(screen.getByText('Mileage & Distance'));

      const mileageInput = screen.getByDisplayValue('2.5');
      fireEvent.change(mileageInput, { target: { value: '3.5' } });

      expect(screen.getByDisplayValue('3.5')).toBeInTheDocument();
    });
  });

  describe('Save and Reset', () => {
    it('should disable Save button when no changes made', () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toBeDisabled();
    });

    it('should disable Reset button when no changes made', () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      const resetButton = screen.getByRole('button', { name: /reset/i });
      expect(resetButton).toBeDisabled();
    });

    it('should enable Save button after changes', () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      fireEvent.change(screen.getByDisplayValue('Test Client'), {
        target: { value: 'Changed' },
      });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('should call onSave with updated config when Save is clicked', () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      fireEvent.change(screen.getByDisplayValue('Test Client'), {
        target: { value: 'Updated Client' },
      });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({ clientName: 'Updated Client' })
      );
    });

    it('should reset to original values when Reset is clicked', () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      const input = screen.getByDisplayValue('Test Client');
      fireEvent.change(input, { target: { value: 'Changed' } });
      expect(screen.getByDisplayValue('Changed')).toBeInTheDocument();

      const resetButton = screen.getByRole('button', { name: /reset/i });
      fireEvent.click(resetButton);

      expect(screen.getByDisplayValue('Test Client')).toBeInTheDocument();
    });

    it('should show "Saving..." when isSaving is true', () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={true} />
      );

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should show error badges when validation fails', () => {
      mockValidateConfiguration.mockReturnValue({
        valid: false,
        errors: ['Client name is required', 'Mileage rate must be positive'],
      });

      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      // Make a change to trigger validation
      fireEvent.change(screen.getByDisplayValue('Test Client'), {
        target: { value: '' },
      });

      // Error count badge should be visible
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    it('should disable Save button when validation fails', () => {
      mockValidateConfiguration.mockReturnValue({
        valid: false,
        errors: ['Client name is required'],
      });

      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      fireEvent.change(screen.getByDisplayValue('Test Client'), {
        target: { value: '' },
      });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toBeDisabled();
    });

    it('should run validation on every field change', () => {
      const config = createMockConfig();
      render(
        <VendorPricingEditor config={config} onSave={mockOnSave} isSaving={false} />
      );

      fireEvent.change(screen.getByDisplayValue('Test Client'), {
        target: { value: 'A' },
      });
      fireEvent.change(screen.getByDisplayValue('A'), {
        target: { value: 'AB' },
      });

      expect(mockValidateConfiguration).toHaveBeenCalledTimes(2);
    });
  });

  describe('Config prop changes', () => {
    it('should reset form when config prop changes (vendor switch)', () => {
      const config1 = createMockConfig({ clientName: 'Vendor A' });
      const config2 = createMockConfig({ id: 'config-2', clientName: 'Vendor B' });

      const { rerender } = render(
        <VendorPricingEditor config={config1} onSave={mockOnSave} isSaving={false} />
      );

      expect(screen.getByDisplayValue('Vendor A')).toBeInTheDocument();

      rerender(
        <VendorPricingEditor config={config2} onSave={mockOnSave} isSaving={false} />
      );

      expect(screen.getByDisplayValue('Vendor B')).toBeInTheDocument();
    });
  });
});
