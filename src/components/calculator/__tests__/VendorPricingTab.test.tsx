/**
 * Unit Tests for VendorPricingTab Component
 *
 * Tests cover:
 * - Loading state rendering
 * - Empty state rendering
 * - Vendor card list rendering
 * - Vendor selection behavior
 * - Save confirmation dialog
 * - Error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VendorPricingTab } from '../VendorPricingTab';

// Mock the toast
const mockToast = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock VendorPricingEditor to simplify testing
jest.mock('../VendorPricingEditor', () => ({
  VendorPricingEditor: ({ config, onSave, isSaving }: any) => (
    <div data-testid="vendor-pricing-editor">
      <span data-testid="editing-vendor">{config.vendorName}</span>
      <button
        data-testid="mock-save-btn"
        onClick={() =>
          onSave({ ...config, clientName: 'Updated Client' })
        }
      >
        Save
      </button>
      {isSaving && <span data-testid="is-saving">Saving</span>}
    </div>
  ),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockConfigs = [
  {
    id: 'ready-set-food-standard',
    clientName: 'Ready Set Food - Standard',
    vendorName: 'Destino',
    description: 'Standard pricing',
    isActive: true,
    pricingTiers: [],
    mileageRate: 2.5,
    distanceThreshold: 10,
    dailyDriveDiscounts: { twoDrivers: 10, threeDrivers: 15, fourPlusDrivers: 20 },
    driverPaySettings: { maxPayPerDrop: 65, basePayPerDrop: 25, bonusPay: 5, readySetFee: 10 },
    bridgeTollSettings: { defaultTollAmount: 7 },
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 'kasa',
    clientName: 'Kasa',
    vendorName: 'Kasa',
    description: 'Kasa pricing',
    isActive: true,
    pricingTiers: [],
    mileageRate: 3.0,
    distanceThreshold: 10,
    dailyDriveDiscounts: { twoDrivers: 8, threeDrivers: 12, fourPlusDrivers: 18 },
    driverPaySettings: { maxPayPerDrop: 60, basePayPerDrop: 22, bonusPay: 5, readySetFee: 10 },
    bridgeTollSettings: { defaultTollAmount: 7 },
    createdAt: '2025-01-02',
    updatedAt: '2025-01-02',
  },
];

describe('VendorPricingTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading skeletons while fetching', () => {
      mockFetch.mockReturnValue(new Promise(() => {})); // Never resolves
      render(<VendorPricingTab />);

      // Check for skeleton loading elements
      const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no configurations found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      render(<VendorPricingTab />);

      await waitFor(() => {
        expect(screen.getByText(/no vendor configurations found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Vendor List', () => {
    it('should render vendor cards after loading', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockConfigs }),
      });

      render(<VendorPricingTab />);

      await waitFor(() => {
        expect(screen.getByText('Destino')).toBeInTheDocument();
        // Kasa appears as both vendorName and clientName, so use getAllByText
        expect(screen.getAllByText('Kasa').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should display active/inactive badges', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockConfigs }),
      });

      render(<VendorPricingTab />);

      await waitFor(() => {
        const activeBadges = screen.getAllByText('Active');
        expect(activeBadges).toHaveLength(2);
      });
    });

    it('should show client name under vendor name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockConfigs }),
      });

      render(<VendorPricingTab />);

      await waitFor(() => {
        expect(screen.getByText('Ready Set Food - Standard')).toBeInTheDocument();
      });
    });
  });

  describe('Vendor Selection', () => {
    it('should show editor when a vendor card is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockConfigs }),
      });

      render(<VendorPricingTab />);

      await waitFor(() => {
        expect(screen.getByText('Destino')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Destino'));

      await waitFor(() => {
        expect(screen.getByTestId('vendor-pricing-editor')).toBeInTheDocument();
        expect(screen.getByTestId('editing-vendor')).toHaveTextContent('Destino');
      });
    });

    it('should switch editor when different vendor is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockConfigs }),
      });

      render(<VendorPricingTab />);

      await waitFor(() => {
        expect(screen.getByText('Destino')).toBeInTheDocument();
      });

      // Click first vendor
      fireEvent.click(screen.getByText('Destino'));
      await waitFor(() => {
        expect(screen.getByTestId('editing-vendor')).toHaveTextContent('Destino');
      });

      // Click second vendor — use heading element since Kasa appears as both vendor and client name
      const kasaHeadings = screen.getAllByText('Kasa');
      // Click the first one (the heading in the vendor card)
      fireEvent.click(kasaHeadings[0]!);
      await waitFor(() => {
        expect(screen.getByTestId('editing-vendor')).toHaveTextContent('Kasa');
      });
    });
  });

  describe('Save Flow', () => {
    it('should show confirmation dialog when save is triggered', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockConfigs }),
      });

      render(<VendorPricingTab />);

      await waitFor(() => {
        expect(screen.getByText('Destino')).toBeInTheDocument();
      });

      // Select a vendor
      fireEvent.click(screen.getByText('Destino'));
      await waitFor(() => {
        expect(screen.getByTestId('mock-save-btn')).toBeInTheDocument();
      });

      // Trigger save (from mock editor)
      fireEvent.click(screen.getByTestId('mock-save-btn'));

      await waitFor(() => {
        expect(screen.getByText(/confirm pricing update/i)).toBeInTheDocument();
      });
    });

    it('should call API when save is confirmed', async () => {
      // Initial load
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockConfigs }),
      });

      render(<VendorPricingTab />);

      await waitFor(() => {
        expect(screen.getByText('Destino')).toBeInTheDocument();
      });

      // Select vendor and trigger save
      fireEvent.click(screen.getByText('Destino'));
      await waitFor(() => {
        expect(screen.getByTestId('mock-save-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('mock-save-btn'));

      await waitFor(() => {
        expect(screen.getByText(/confirm pricing update/i)).toBeInTheDocument();
      });

      // Mock the POST response and follow-up GET
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { ...mockConfigs[0], clientName: 'Updated Client' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockConfigs }),
        });

      // Click the confirm button in the dialog
      const confirmButton = screen.getByTestId('alert-dialog-action');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/calculator/configurations',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          })
        );
      });
    });

    it('should show success toast after save', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockConfigs }),
      });

      render(<VendorPricingTab />);

      await waitFor(() => {
        expect(screen.getByText('Destino')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Destino'));
      await waitFor(() => {
        expect(screen.getByTestId('mock-save-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('mock-save-btn'));

      await waitFor(() => {
        expect(screen.getByText(/confirm pricing update/i)).toBeInTheDocument();
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { ...mockConfigs[0], clientName: 'Updated Client' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockConfigs }),
        });

      const confirmButton = screen.getByTestId('alert-dialog-action');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Configuration saved',
          })
        );
      });
    });

    it('should render cancel button in confirmation dialog', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockConfigs }),
      });

      render(<VendorPricingTab />);

      await waitFor(() => {
        expect(screen.getByText('Destino')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Destino'));
      await waitFor(() => {
        expect(screen.getByTestId('mock-save-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('mock-save-btn'));

      await waitFor(() => {
        expect(screen.getByText(/confirm pricing update/i)).toBeInTheDocument();
      });

      // Verify cancel button is present in the dialog
      const cancelButton = screen.getByTestId('alert-dialog-cancel');
      expect(cancelButton).toBeInTheDocument();
      expect(cancelButton).toHaveTextContent('Cancel');
    });
  });

  describe('Error Handling', () => {
    it('should show error toast when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });

      render(<VendorPricingTab />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error loading configurations',
            variant: 'destructive',
          })
        );
      });
    });

    it('should show error toast when save fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockConfigs }),
      });

      render(<VendorPricingTab />);

      await waitFor(() => {
        expect(screen.getByText('Destino')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Destino'));
      await waitFor(() => {
        expect(screen.getByTestId('mock-save-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('mock-save-btn'));

      await waitFor(() => {
        expect(screen.getByText(/confirm pricing update/i)).toBeInTheDocument();
      });

      // Mock failed POST
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Save failed' }),
      });

      const confirmButton = screen.getByTestId('alert-dialog-action');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error saving configuration',
            variant: 'destructive',
          })
        );
      });
    });
  });
});
