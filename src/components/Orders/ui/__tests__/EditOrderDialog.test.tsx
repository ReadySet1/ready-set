// src/components/Orders/ui/__tests__/EditOrderDialog.test.tsx
/**
 * Unit tests for EditOrderDialog component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from '@testing-library/react';

// Mock dependencies BEFORE imports
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// date-fns v4 has ESM interop issues with SWC/Jest — SWC transpiles
// `import { format } from 'date-fns'` to `_format.default(...)` which breaks.
// Mock date-display (the only module that calls date-fns format during render)
// with an implementation that uses date-fns-tz format (which works fine).
jest.mock('@/lib/utils/date-display', () => {
  const { utcToLocalTime } = jest.requireActual('@/lib/utils/timezone');
  const { format: tzFormat } = jest.requireActual('date-fns-tz');

  return {
    __esModule: true,
    formatDateTimeForDisplay: (
      utcDate: string | Date | null | undefined,
      formatStr: string = 'MMM d, yyyy h:mm a',
    ) => {
      if (!utcDate) return 'N/A';
      try {
        const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
        const { date: localDate, time: localTime } = utcToLocalTime(date);
        const localDateTime = new Date(`${localDate}T${localTime}`);
        return tzFormat(localDateTime, formatStr);
      } catch {
        return 'Invalid Date';
      }
    },
    formatDateForDisplay: (utcDate: string | Date | null | undefined) => 'N/A',
    formatTimeForDisplay: (utcDate: string | Date | null | undefined) => 'N/A',
    getRelativeTime: (utcDate: string | Date | null | undefined) => 'N/A',
  };
});

// Make Popover content always visible so the time <input> is in the DOM
// without clicking the trigger. This also avoids the react-day-picker
// Calendar pulling in date-fns (which has ESM interop issues in Jest/SWC).
jest.mock('@/components/ui/popover', () => ({
  __esModule: true,
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/calendar', () => ({
  __esModule: true,
  Calendar: () => <div data-testid="mock-calendar" />,
}));

const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({
      data: { session: { access_token: 'mock-token' } },
      error: null,
    }),
  },
};

jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

import EditOrderDialog from '../EditOrderDialog';
import toast from 'react-hot-toast';
import { Order } from '@/types/order';

// Helper to create a mock catering order
const createMockCateringOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-123',
  orderNumber: 'CAT001',
  order_type: 'catering',
  status: 'ACTIVE',
  orderTotal: 250.00,
  tip: 25.00,
  pickupDateTime: '2025-02-15T10:00:00Z',
  arrivalDateTime: '2025-02-15T11:00:00Z',
  clientAttention: 'John Smith',
  pickupNotes: 'Back entrance',
  specialNotes: 'Handle with care',
  createdAt: '2025-01-15T09:00:00Z',
  updatedAt: '2025-01-15T09:00:00Z',
  pickupAddress: {
    id: 'pickup-addr-1',
    street1: '123 Pickup St',
    street2: 'Suite 100',
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
    county: 'San Francisco',
    locationNumber: null,
    parkingLoading: null,
  },
  deliveryAddress: {
    id: 'delivery-addr-1',
    street1: '456 Delivery Ave',
    street2: null,
    city: 'Oakland',
    state: 'CA',
    zip: '94601',
    county: 'Alameda',
    locationNumber: null,
    parkingLoading: null,
  },
  headcount: 50,
  brokerage: 'Test Brokerage',
  needHost: 'YES',
  hoursNeeded: 4,
  numberOfHosts: 2,
  appliedDiscount: 10.00,
  deliveryCost: 50.00,
  ...overrides,
} as any);

// Helper to create a mock on-demand order
const createMockOnDemandOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-456',
  orderNumber: 'OND001',
  order_type: 'on_demand',
  status: 'PENDING',
  orderTotal: 100.00,
  tip: 15.00,
  pickupDateTime: '2025-02-16T10:00:00Z',
  arrivalDateTime: '2025-02-16T11:00:00Z',
  clientAttention: 'Jane Doe',
  pickupNotes: 'Call on arrival',
  specialNotes: 'Fragile',
  createdAt: '2025-01-16T09:00:00Z',
  updatedAt: '2025-01-16T09:00:00Z',
  pickupAddress: {
    id: 'pickup-addr-2',
    street1: '789 Pickup Blvd',
    street2: null,
    city: 'San Jose',
    state: 'CA',
    zip: '95101',
    county: 'Santa Clara',
    locationNumber: null,
    parkingLoading: null,
  },
  deliveryAddress: {
    id: 'delivery-addr-2',
    street1: '012 Delivery Way',
    street2: 'Unit B',
    city: 'Fremont',
    state: 'CA',
    zip: '94536',
    county: 'Alameda',
    locationNumber: null,
    parkingLoading: null,
  },
  itemDelivered: 'Medical supplies',
  vehicleType: 'VAN',
  length: 24,
  width: 18,
  height: 12,
  weight: 50,
  ...overrides,
} as any);

/**
 * TODO: These tests are skipped due to complex mocking requirements for date-fns ESM module.
 * The EditOrderDialog functionality is covered by:
 * 1. API PATCH endpoint tests in src/__tests__/api/orders/edit-order.test.ts
 * 2. Schema validation tests in src/__tests__/api/orders/edit-order-schemas.test.ts
 * 3. E2E tests in e2e/edit-order.spec.ts
 *
 * To re-enable these tests, we need to:
 * 1. Create a proper date-fns mock in __mocks__/date-fns.ts
 * 2. Configure Jest to properly handle ESM modules
 */
describe.skip('EditOrderDialog', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSaveSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Rendering', () => {
    it('should render the dialog when isOpen is true', () => {
      const order = createMockCateringOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      expect(screen.getByText(/Edit Catering Order/i)).toBeInTheDocument();
      expect(screen.getByText(/Order #CAT001/i)).toBeInTheDocument();
    });

    it('should not render the dialog when isOpen is false', () => {
      const order = createMockCateringOrder();

      render(
        <EditOrderDialog
          isOpen={false}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      expect(screen.queryByText(/Edit Catering Order/i)).not.toBeInTheDocument();
    });

    it('should display "On-Demand" for on-demand orders', () => {
      const order = createMockOnDemandOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      expect(screen.getByText(/Edit On-Demand Order/i)).toBeInTheDocument();
    });

    it('should render all tabs', () => {
      const order = createMockCateringOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      expect(screen.getByRole('tab', { name: /Schedule/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Details/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Addresses/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Pricing/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Notes/i })).toBeInTheDocument();
    });
  });

  describe('Form Population', () => {
    it('should populate form with catering order data', async () => {
      const order = createMockCateringOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Switch to Details tab
      const detailsTab = screen.getByRole('tab', { name: /Details/i });
      await userEvent.click(detailsTab);

      // Check catering-specific fields are populated
      const brokerageInput = screen.getByLabelText(/Brokerage/i);
      expect(brokerageInput).toHaveValue('Test Brokerage');
    });

    it('should populate form with on-demand order data', async () => {
      const order = createMockOnDemandOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Switch to Details tab
      const detailsTab = screen.getByRole('tab', { name: /Details/i });
      await userEvent.click(detailsTab);

      // Check on-demand specific fields are populated
      const itemDeliveredInput = screen.getByLabelText(/Item Delivered/i);
      expect(itemDeliveredInput).toHaveValue('Medical supplies');
    });

    it('should populate pricing fields correctly', async () => {
      const order = createMockCateringOrder({ orderTotal: 500, tip: 75 });

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Switch to Pricing tab
      const pricingTab = screen.getByRole('tab', { name: /Pricing/i });
      await userEvent.click(pricingTab);

      // Wait for tab content to render and check values
      await waitFor(() => {
        const orderTotalInput = screen.getByLabelText(/Order Total/i);
        expect(orderTotalInput).toBeInTheDocument();
      });
    });

    it('should populate notes fields correctly', async () => {
      const order = createMockCateringOrder({
        clientAttention: 'Test Contact',
        pickupNotes: 'Test pickup notes',
        specialNotes: 'Test special notes',
      });

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Switch to Notes tab
      const notesTab = screen.getByRole('tab', { name: /Notes/i });
      await userEvent.click(notesTab);

      await waitFor(() => {
        expect(screen.getByLabelText(/Client Attention/i)).toHaveValue('Test Contact');
        expect(screen.getByLabelText(/Pickup Notes/i)).toHaveValue('Test pickup notes');
        expect(screen.getByLabelText(/Special Notes/i)).toHaveValue('Test special notes');
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should switch between tabs correctly', async () => {
      const order = createMockCateringOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Click on Addresses tab
      const addressesTab = screen.getByRole('tab', { name: /Addresses/i });
      await userEvent.click(addressesTab);

      // Should show address fields
      await waitFor(() => {
        expect(screen.getByText(/Pickup Address/i)).toBeInTheDocument();
        expect(screen.getByText(/Delivery Address/i)).toBeInTheDocument();
      });

      // Click on Pricing tab
      const pricingTab = screen.getByRole('tab', { name: /Pricing/i });
      await userEvent.click(pricingTab);

      // Should show pricing fields
      await waitFor(() => {
        expect(screen.getByLabelText(/Order Total/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should show "No changes to save" when form is unchanged', async () => {
      const order = createMockCateringOrder();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null,
      });

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // The Save button should be disabled when no changes
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      expect(saveButton).toBeDisabled();
    });

    it('should enable Save button when form is modified', async () => {
      const order = createMockCateringOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Switch to Notes tab and modify a field
      const notesTab = screen.getByRole('tab', { name: /Notes/i });
      await userEvent.click(notesTab);

      const clientAttentionInput = screen.getByLabelText(/Client Attention/i);
      await userEvent.clear(clientAttentionInput);
      await userEvent.type(clientAttentionInput, 'New Contact Name');

      // Save button should be enabled
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('should submit form and call API on save', async () => {
      const order = createMockCateringOrder();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...order, clientAttention: 'New Contact' }),
      });

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Modify a field
      const notesTab = screen.getByRole('tab', { name: /Notes/i });
      await userEvent.click(notesTab);

      const clientAttentionInput = screen.getByLabelText(/Client Attention/i);
      await userEvent.clear(clientAttentionInput);
      await userEvent.type(clientAttentionInput, 'New Contact');

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/orders/CAT001'),
          expect.objectContaining({
            method: 'PATCH',
          })
        );
      });
    });

    it('should call onSaveSuccess after successful save', async () => {
      const order = createMockCateringOrder();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...order, clientAttention: 'New Contact' }),
      });

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Modify a field
      const notesTab = screen.getByRole('tab', { name: /Notes/i });
      await userEvent.click(notesTab);

      const clientAttentionInput = screen.getByLabelText(/Client Attention/i);
      await userEvent.clear(clientAttentionInput);
      await userEvent.type(clientAttentionInput, 'New Contact');

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSaveSuccess).toHaveBeenCalled();
      });
    });

    it('should show success toast after successful save', async () => {
      const order = createMockCateringOrder();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...order, clientAttention: 'New Contact' }),
      });

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Modify a field
      const notesTab = screen.getByRole('tab', { name: /Notes/i });
      await userEvent.click(notesTab);

      const clientAttentionInput = screen.getByLabelText(/Client Attention/i);
      await userEvent.clear(clientAttentionInput);
      await userEvent.type(clientAttentionInput, 'New Contact');

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Order updated successfully!');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast on API failure', async () => {
      const order = createMockCateringOrder();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Failed to update order' }),
      });

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Modify a field
      const notesTab = screen.getByRole('tab', { name: /Notes/i });
      await userEvent.click(notesTab);

      const clientAttentionInput = screen.getByLabelText(/Client Attention/i);
      await userEvent.clear(clientAttentionInput);
      await userEvent.type(clientAttentionInput, 'New Contact');

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update order');
      });
    });

    it('should show authentication error when session is invalid', async () => {
      const order = createMockCateringOrder();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Modify a field
      const notesTab = screen.getByRole('tab', { name: /Notes/i });
      await userEvent.click(notesTab);

      const clientAttentionInput = screen.getByLabelText(/Client Attention/i);
      await userEvent.clear(clientAttentionInput);
      await userEvent.type(clientAttentionInput, 'New Contact');

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Authentication error. Please try logging in again.'
        );
      });
    });
  });

  describe('Cancel Button', () => {
    it('should call onOpenChange(false) when Cancel is clicked', async () => {
      const order = createMockCateringOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await userEvent.click(cancelButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Dirty State Indicator', () => {
    it('should show unsaved changes indicator when form is modified', async () => {
      const order = createMockCateringOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Initially should not show unsaved changes
      expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();

      // Modify a field
      const notesTab = screen.getByRole('tab', { name: /Notes/i });
      await userEvent.click(notesTab);

      const clientAttentionInput = screen.getByLabelText(/Client Attention/i);
      await userEvent.clear(clientAttentionInput);
      await userEvent.type(clientAttentionInput, 'New Contact');

      // Should show unsaved changes indicator
      await waitFor(() => {
        expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
      });
    });
  });

  describe('Catering-specific Fields', () => {
    it('should render catering fields for catering orders', async () => {
      const order = createMockCateringOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Switch to Details tab
      const detailsTab = screen.getByRole('tab', { name: /Details/i });
      await userEvent.click(detailsTab);

      await waitFor(() => {
        expect(screen.getByLabelText(/Brokerage/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Headcount/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Need Host/i)).toBeInTheDocument();
      });
    });

    it('should render catering-specific pricing fields', async () => {
      const order = createMockCateringOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Switch to Pricing tab
      const pricingTab = screen.getByRole('tab', { name: /Pricing/i });
      await userEvent.click(pricingTab);

      await waitFor(() => {
        expect(screen.getByLabelText(/Applied Discount/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Delivery Cost/i)).toBeInTheDocument();
      });
    });
  });

  describe('On-Demand-specific Fields', () => {
    it('should render on-demand fields for on-demand orders', async () => {
      const order = createMockOnDemandOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Switch to Details tab
      const detailsTab = screen.getByRole('tab', { name: /Details/i });
      await userEvent.click(detailsTab);

      await waitFor(() => {
        expect(screen.getByLabelText(/Item Delivered/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Vehicle Type/i)).toBeInTheDocument();
      });
    });

    it('should render package dimension fields for on-demand orders', async () => {
      const order = createMockOnDemandOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Switch to Details tab
      const detailsTab = screen.getByRole('tab', { name: /Details/i });
      await userEvent.click(detailsTab);

      await waitFor(() => {
        expect(screen.getByText(/Package Dimensions/i)).toBeInTheDocument();
      });
    });

    it('should not render catering-specific pricing fields for on-demand orders', async () => {
      const order = createMockOnDemandOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Switch to Pricing tab
      const pricingTab = screen.getByRole('tab', { name: /Pricing/i });
      await userEvent.click(pricingTab);

      await waitFor(() => {
        expect(screen.queryByLabelText(/Applied Discount/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Delivery Cost/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Address Fields', () => {
    it('should render pickup and delivery address sections', async () => {
      const order = createMockCateringOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Switch to Addresses tab
      const addressesTab = screen.getByRole('tab', { name: /Addresses/i });
      await userEvent.click(addressesTab);

      await waitFor(() => {
        expect(screen.getByText('Pickup Address')).toBeInTheDocument();
        expect(screen.getByText('Delivery Address')).toBeInTheDocument();
      });
    });

    it('should populate pickup address fields', async () => {
      const order = createMockCateringOrder();

      render(
        <EditOrderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          order={order}
          onSaveSuccess={mockOnSaveSuccess}
        />
      );

      // Switch to Addresses tab
      const addressesTab = screen.getByRole('tab', { name: /Addresses/i });
      await userEvent.click(addressesTab);

      await waitFor(() => {
        const pickupStreetInput = screen.getByDisplayValue('123 Pickup St');
        expect(pickupStreetInput).toBeInTheDocument();
      });
    });
  });
});

/**
 * Schedule timezone consistency — NOT skipped.
 *
 * These tests verify that the button label and the time <input> agree, and
 * that changing the time produces the correct UTC instant. They fail on the
 * pre-fix code whenever the machine's timezone differs from Pacific.
 */
describe('Schedule timezone consistency', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSaveSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it('button label and time input show the same Pacific time', () => {
    // 2026-10-07T20:00:00Z = 1:00 PM PDT
    const order = createMockCateringOrder({
      pickupDateTime: '2026-10-07T20:00:00Z',
    });

    render(
      <EditOrderDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        order={order}
        onSaveSuccess={mockOnSaveSuccess}
      />
    );

    // The button label should contain 1:00 PM (formatDateTimeForDisplay uses Pacific)
    const pickupButton = screen.getAllByRole('button').find(
      (b) => b.textContent?.includes('1:00 PM'),
    );
    expect(pickupButton).toBeDefined();

    // Popover is mocked to always render content, so the time input is in the DOM
    const timeInput = screen.getByDisplayValue('13:00');
    expect(timeInput).toBeInTheDocument();
  });

  it('changing the time input updates both input and button consistently', async () => {
    const order = createMockCateringOrder({
      pickupDateTime: '2026-10-07T20:00:00Z',
    });

    render(
      <EditOrderDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        order={order}
        onSaveSuccess={mockOnSaveSuccess}
      />
    );

    // Change time to 14:00 (2:00 PM PT)
    const timeInput = screen.getByDisplayValue('13:00');
    fireEvent.change(timeInput, { target: { value: '14:00' } });

    // After change the input should reflect the new time
    await waitFor(() => {
      expect(screen.getByDisplayValue('14:00')).toBeInTheDocument();
    });

    // The button should now say 2:00 PM
    const updatedButton = screen.getAllByRole('button').find(
      (b) => b.textContent?.includes('2:00 PM'),
    );
    expect(updatedButton).toBeDefined();
  });

  it('saving after a time change sends the correct UTC instant', async () => {
    const order = createMockCateringOrder({
      pickupDateTime: '2026-10-07T20:00:00Z',
    });

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'mock-token' } },
      error: null,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    render(
      <EditOrderDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        order={order}
        onSaveSuccess={mockOnSaveSuccess}
      />
    );

    // Change pickup time to 14:00 (2:00 PM PDT)
    const timeInput = screen.getByDisplayValue('13:00');
    fireEvent.change(timeInput, { target: { value: '14:00' } });

    // Click Save
    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      expect(saveButton).not.toBeDisabled();
    });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Extract the PATCH body
    const [, fetchOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(fetchOptions.body as string);

    // 2:00 PM PDT = 21:00 UTC
    expect(body.pickupDateTime).toBe('2026-10-07T21:00:00.000Z');
  });
});
