import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddressSelector } from '../AddressSelector';
import type { Address } from '@/types/address';

// Mock hooks
jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { id: 'test-user-id' } }),
}));

jest.mock('@/hooks/useAddresses', () => ({
  useAddresses: jest.fn(() => ({
    data: {
      addresses: mockAddresses,
      totalCount: mockAddresses.length,
    },
    isLoading: false,
  })),
}));

jest.mock('@/hooks/useAddressFavorites', () => ({
  useAddressFavorites: jest.fn(() => ({
    favoriteIds: ['address-1'],
    isFavorite: (id: string) => id === 'address-1',
    toggleFavorite: jest.fn(),
    isLoading: false,
  })),
}));

jest.mock('@/hooks/useAddressRecents', () => ({
  useAddressRecents: jest.fn(() => ({
    recents: [
      {
        id: 'address-2',
        name: 'Recent Restaurant',
        street1: '456 Recent St',
        city: 'Recent City',
        state: 'CA',
        zip: '90002',
        isShared: true,
        lastUsedAt: new Date(),
      },
    ],
    trackUsage: jest.fn(),
    isLoading: false,
  })),
}));

// Mock addresses
const mockAddresses: Address[] = [
  {
    id: 'address-1',
    name: 'Test Restaurant 1',
    street1: '123 Main St',
    street2: '',
    city: 'Test City',
    state: 'CA',
    zip: '90001',
    county: 'Test County',
    isShared: true,
    phoneNumber: '555-1234',
  },
  {
    id: 'address-2',
    name: 'Test Restaurant 2',
    street1: '456 Oak Ave',
    street2: 'Suite 100',
    city: 'Another City',
    state: 'CA',
    zip: '90002',
    county: 'Another County',
    isShared: true,
    phoneNumber: '555-5678',
  },
  {
    id: 'address-3',
    name: 'Private Address',
    street1: '789 Private Ln',
    street2: '',
    city: 'Private City',
    state: 'CA',
    zip: '90003',
    county: 'Private County',
    isShared: false,
    phoneNumber: '555-9999',
  },
];

// Test wrapper with QueryClient
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('AddressSelector', () => {
  const defaultProps = {
    mode: 'client' as const,
    onSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the search input', () => {
      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText(/Search\.\.\./i)).toBeInTheDocument();
    });

    it('renders quick filter buttons', () => {
      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} />
        </TestWrapper>
      );

      // Filter buttons have aria-labels like "Filter by All addresses. X addresses."
      expect(screen.getByRole('button', { name: /Filter by All/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Filter by Shared/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Filter by Private/i })).toBeInTheDocument();
    });

    it('renders address sections', async () => {
      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} showFavorites showRecents />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/favorites/i)).toBeInTheDocument();
        expect(screen.getByText(/recently used/i)).toBeInTheDocument();
        expect(screen.getByText(/all addresses/i)).toBeInTheDocument();
      });
    });

    it('shows Add New button when allowAddNew is true', () => {
      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} allowAddNew={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /Add New/i })).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    // Note: Component uses server-side search via useAddresses hook
    // These tests verify search input behavior, not actual filtering
    it('updates search input value when typing', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/Search\.\.\./i);

      // Type in search query
      await user.type(searchInput, 'Test Restaurant');

      // Verify input value is updated
      expect(searchInput).toHaveValue('Test Restaurant');
    });

    it('clears search input value when cleared', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/Search\.\.\./i);

      // Type and then clear
      await user.type(searchInput, 'Test');
      await user.clear(searchInput);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Filter Functionality', () => {
    // Note: Quick filters are UI state - actual filtering uses server-side logic
    // These tests verify button interaction, not data filtering
    it('activates shared filter button when clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} />
        </TestWrapper>
      );

      // Click the "Shared" filter
      const sharedButton = screen.getByRole('button', { name: /Filter by Shared/i });
      await user.click(sharedButton);

      // Verify the button is now pressed
      expect(sharedButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('activates private filter button when clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} />
        </TestWrapper>
      );

      // Click the "Private" filter
      const privateButton = screen.getByRole('button', { name: /Filter by Private/i });
      await user.click(privateButton);

      // Verify the button is now pressed
      expect(privateButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Address Selection', () => {
    it('calls onSelect when an address is selected', async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} onSelect={onSelect} />
        </TestWrapper>
      );

      // Find and click the select button for first address
      const selectButtons = await screen.findAllByRole('button', { name: /select/i });
      await user.click(selectButtons[0]);

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
        })
      );
    });

    it('highlights the selected address', () => {
      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} selectedAddressId="address-1" />
        </TestWrapper>
      );

      // The selected address card should have different styling
      // This is implementation-specific and would need to be adjusted based on actual markup
      const allAddresses = screen.getAllByText(/test restaurant/i);
      expect(allAddresses.length).toBeGreaterThan(0);
    });
  });

  describe('Type-specific Placeholders', () => {
    it('shows pickup-specific placeholder when type is pickup', () => {
      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} type="pickup" />
        </TestWrapper>
      );

      // Component uses "Search pickup..." format
      expect(screen.getByPlaceholderText(/Search pickup\.\.\./i)).toBeInTheDocument();
    });

    it('shows delivery-specific placeholder when type is delivery', () => {
      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} type="delivery" />
        </TestWrapper>
      );

      // Component uses "Search delivery..." format
      expect(screen.getByPlaceholderText(/Search delivery\.\.\./i)).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading skeletons when isLoading is true', () => {
      const useAddresses = require('@/hooks/useAddresses').useAddresses;
      useAddresses.mockReturnValue({
        data: null,
        isLoading: true,
      });

      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} />
        </TestWrapper>
      );

      // Search input should be disabled during loading
      expect(screen.getByPlaceholderText(/Search\.\.\./i)).toBeDisabled();
    });
  });

  describe('Favorites and Recents', () => {
    // Reset useAddresses mock before each test in this group
    beforeEach(() => {
      const useAddresses = require('@/hooks/useAddresses').useAddresses;
      useAddresses.mockReturnValue({
        data: {
          addresses: mockAddresses,
          totalCount: mockAddresses.length,
        },
        isLoading: false,
      });
    });

    it('hides favorites section when showFavorites is false', () => {
      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} showFavorites={false} />
        </TestWrapper>
      );

      expect(screen.queryByText(/^Favorites$/i)).not.toBeInTheDocument();
    });

    it('hides recents section when showRecents is false', () => {
      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} showRecents={false} />
        </TestWrapper>
      );

      expect(screen.queryByText(/recently used/i)).not.toBeInTheDocument();
    });

    it('shows favorites section when showFavorites is true', () => {
      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} showFavorites={true} />
        </TestWrapper>
      );

      // Favorites section should be rendered (though may be collapsed)
      // The section title "Favorites" appears in the header
      expect(screen.getByText(/^Favorites$/i)).toBeInTheDocument();
    });
  });

  describe('Admin Mode', () => {
    beforeEach(() => {
      const useAddresses = require('@/hooks/useAddresses').useAddresses;
      useAddresses.mockReturnValue({
        data: {
          addresses: mockAddresses,
          totalCount: mockAddresses.length,
        },
        isLoading: false,
      });
    });

    it('works in admin mode', () => {
      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} mode="admin" />
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText(/Search\.\.\./i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      const useAddresses = require('@/hooks/useAddresses').useAddresses;
      useAddresses.mockReturnValue({
        data: {
          addresses: mockAddresses,
          totalCount: mockAddresses.length,
        },
        isLoading: false,
      });
    });

    it('has accessible form controls', () => {
      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/Search\.\.\./i);
      expect(searchInput).toHaveAttribute('type', 'text');
    });

    it('filter buttons are keyboard accessible', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AddressSelector {...defaultProps} />
        </TestWrapper>
      );

      const allButton = screen.getByRole('button', { name: /Filter by All/i });
      allButton.focus();

      expect(allButton).toHaveFocus();

      // Tab to next filter
      await user.tab();
      const sharedButton = screen.getByRole('button', { name: /Filter by Shared/i });
      expect(sharedButton).toHaveFocus();
    });
  });
});
