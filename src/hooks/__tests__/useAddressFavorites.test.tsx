import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAddressFavorites } from '../useAddressFavorites';
import { createClient } from '@/utils/supabase/client';
import type { Address } from '@/types/address';
import React from 'react';

// Mock the Supabase client
jest.mock('@/utils/supabase/client');

const mockSupabaseClient = {
  from: jest.fn(),
};

const mockAddress: Address = {
  id: 'addr-123',
  county: 'San Francisco',
  street1: '123 Main St',
  street2: null,
  city: 'San Francisco',
  state: 'CA',
  zip: '94102',
  locationNumber: null,
  parkingLoading: null,
  name: 'Test Location',
  isRestaurant: true,
  isShared: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  createdBy: 'user-123',
};

const mockFavoriteRow = {
  id: 'fav-123',
  user_id: 'user-123',
  address_id: 'addr-123',
  created_at: '2024-01-01T00:00:00Z',
  addresses: {
    id: 'addr-123',
    county: 'San Francisco',
    street1: '123 Main St',
    street2: null,
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
    locationNumber: null,
    parkingLoading: null,
    name: 'Test Location',
    isRestaurant: true,
    isShared: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    createdBy: 'user-123',
  },
};

describe('useAddressFavorites', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('fetching favorites', () => {
    it('returns empty array when no userId provided', () => {
      const { result } = renderHook(() => useAddressFavorites(undefined), { wrapper });

      expect(result.current.favorites).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('fetches address favorites successfully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [mockFavoriteRow],
              error: null,
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressFavorites('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.favorites).toHaveLength(1);
      expect(result.current.favorites[0]).toMatchObject({
        id: 'addr-123',
        street1: '123 Main St',
        city: 'San Francisco',
      });
      expect(result.current.favoriteIds).toEqual(['addr-123']);
    });

    it('handles API errors gracefully', async () => {
      const mockError = {
        message: 'Database error',
        details: 'Connection failed',
        hint: null,
        code: '500',
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressFavorites('user-123'), { wrapper });

      await waitFor(() => expect(result.current.error).toBeTruthy());

      expect(result.current.favorites).toEqual([]);
      expect(result.current.error).toBeTruthy();
    });

    it('filters out favorites with missing address data', async () => {
      const incompleteRow = {
        ...mockFavoriteRow,
        addresses: null,
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [mockFavoriteRow, incompleteRow],
              error: null,
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressFavorites('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should only include the favorite with complete address data
      expect(result.current.favorites).toHaveLength(1);
      expect(result.current.favorites[0].id).toBe('addr-123');
    });
  });

  describe('toggling favorites', () => {
    it('adds address to favorites when not currently favorited', async () => {
      // Setup: Initially no favorites
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({
          data: [mockFavoriteRow],
          error: null,
        }),
      });

      const { result } = renderHook(() => useAddressFavorites('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isFavorite('addr-123')).toBe(false);

      // Toggle favorite
      act(() => {
        result.current.toggleFavorite('addr-123');
      });

      await waitFor(() => expect(result.current.isToggling).toBe(false));

      // Verify insert was called
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('address_favorites');
    });

    it('removes address from favorites when currently favorited', async () => {
      // Setup: Initially has favorite
      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [mockFavoriteRow],
            error: null,
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValue({
        select: selectMock,
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressFavorites('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isFavorite('addr-123')).toBe(true);

      // Toggle favorite (remove)
      act(() => {
        result.current.toggleFavorite('addr-123');
      });

      await waitFor(() => expect(result.current.isToggling).toBe(false));

      // Verify delete was called
      const fromCalls = mockSupabaseClient.from.mock.calls;
      expect(fromCalls.some(call => call[0] === 'address_favorites')).toBe(true);
    });

    it('handles toggle errors gracefully', async () => {
      const mockError = {
        message: 'Insert failed',
        details: 'Unique constraint violation',
        hint: null,
        code: '23505',
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      });

      const { result } = renderHook(() => useAddressFavorites('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Try to toggle - should handle error
      act(() => {
        result.current.toggleFavorite('addr-123');
      });

      await waitFor(() => expect(result.current.isToggling).toBe(false));

      // Should still not be favorited due to error
      expect(result.current.isFavorite('addr-123')).toBe(false);
    });
  });

  describe('utility functions', () => {
    it('isFavorite returns correct status', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [mockFavoriteRow],
              error: null,
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressFavorites('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isFavorite('addr-123')).toBe(true);
      expect(result.current.isFavorite('addr-999')).toBe(false);
    });

    it('favoriteIds returns array of IDs', async () => {
      const multipleRows = [
        mockFavoriteRow,
        { ...mockFavoriteRow, id: 'fav-456', address_id: 'addr-456', addresses: { ...mockFavoriteRow.addresses, id: 'addr-456' } },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: multipleRows,
              error: null,
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressFavorites('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.favoriteIds).toEqual(['addr-123', 'addr-456']);
    });
  });

  describe('caching behavior', () => {
    it('uses cached data when available', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [mockFavoriteRow],
              error: null,
            }),
          }),
        }),
      });

      // First render
      const { unmount } = renderHook(() => useAddressFavorites('user-123'), { wrapper });

      await waitFor(() => {
        const queryState = queryClient.getQueryState(['address-favorites', 'user-123']);
        return queryState?.status === 'success';
      });

      unmount();

      // Clear mock calls
      mockSupabaseClient.from.mockClear();

      // Second render should use cache
      const { result } = renderHook(() => useAddressFavorites('user-123'), { wrapper });

      // Should immediately have data from cache
      expect(result.current.favorites).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
    });
  });
});
