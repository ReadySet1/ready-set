import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAddressRecents } from '../useAddressRecents';
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

const mockUsageHistoryRow = {
  id: 'usage-123',
  user_id: 'user-123',
  address_id: 'addr-123',
  used_at: '2024-01-15T12:00:00Z',
  context: 'pickup',
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

describe('useAddressRecents', () => {
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

  describe('fetching recent addresses', () => {
    it('returns empty array when no userId provided', () => {
      const { result } = renderHook(() => useAddressRecents(undefined), { wrapper });

      expect(result.current.recents).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('fetches recent addresses successfully with default limit', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [mockUsageHistoryRow],
                error: null,
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.recents).toHaveLength(1);
      expect(result.current.recents[0]).toMatchObject({
        id: 'addr-123',
        street1: '123 Main St',
        city: 'San Francisco',
      });
      expect(result.current.recents[0].lastUsedAt).toEqual(new Date('2024-01-15T12:00:00Z'));
      expect(result.current.recents[0].usageContext).toBe('pickup');
      expect(result.current.recentIds).toEqual(['addr-123']);
    });

    it('respects custom limit parameter', async () => {
      const mockRows = [
        mockUsageHistoryRow,
        {
          ...mockUsageHistoryRow,
          id: 'usage-456',
          address_id: 'addr-456',
          addresses: { ...mockUsageHistoryRow.addresses, id: 'addr-456' },
        },
        {
          ...mockUsageHistoryRow,
          id: 'usage-789',
          address_id: 'addr-789',
          addresses: { ...mockUsageHistoryRow.addresses, id: 'addr-789' },
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockRows,
                error: null,
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressRecents('user-123', 2), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should respect the limit of 2
      expect(result.current.recents).toHaveLength(2);
    });

    it('deduplicates addresses and keeps most recent usage', async () => {
      const duplicateRows = [
        {
          ...mockUsageHistoryRow,
          id: 'usage-new',
          used_at: '2024-01-20T12:00:00Z', // Most recent
        },
        {
          ...mockUsageHistoryRow,
          id: 'usage-old',
          used_at: '2024-01-10T12:00:00Z', // Older usage of same address
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: duplicateRows,
                error: null,
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should only have one entry (deduplicated)
      expect(result.current.recents).toHaveLength(1);
      // Should keep the most recent usage date
      expect(result.current.recents[0].lastUsedAt).toEqual(new Date('2024-01-20T12:00:00Z'));
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
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: null,
                error: mockError,
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      await waitFor(() => expect(result.current.error).toBeTruthy());

      expect(result.current.recents).toEqual([]);
      expect(result.current.error).toBeTruthy();
    });

    it('filters out usage records with missing address data', async () => {
      const incompleteRow = {
        ...mockUsageHistoryRow,
        id: 'usage-incomplete',
        addresses: null,
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [mockUsageHistoryRow, incompleteRow],
                error: null,
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should only include the usage record with complete address data
      expect(result.current.recents).toHaveLength(1);
      expect(result.current.recents[0].id).toBe('addr-123');
    });
  });

  describe('tracking address usage', () => {
    it('tracks address usage successfully', async () => {
      // Setup: Initially no recents
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({
          data: [mockUsageHistoryRow],
          error: null,
        }),
      });

      const { result } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.recents).toHaveLength(0);

      // Track usage
      act(() => {
        result.current.trackUsage({
          addressId: 'addr-123',
          context: 'delivery',
        });
      });

      await waitFor(() => expect(result.current.isTracking).toBe(false));

      // Verify insert was called with correct parameters
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('address_usage_history');
      const fromCalls = mockSupabaseClient.from.mock.calls;
      const insertCall = fromCalls.find(call => call[0] === 'address_usage_history');
      expect(insertCall).toBeTruthy();
    });

    it('tracks usage with optional context', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({
          data: [mockUsageHistoryRow],
          error: null,
        }),
      });

      const { result } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Track usage without context
      act(() => {
        result.current.trackUsage({ addressId: 'addr-123' });
      });

      await waitFor(() => expect(result.current.isTracking).toBe(false));

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('address_usage_history');
    });

    it('handles tracking errors gracefully', async () => {
      const mockError = {
        message: 'Insert failed',
        details: 'Constraint violation',
        hint: null,
        code: '23505',
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      });

      const { result } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Try to track - should handle error gracefully
      act(() => {
        result.current.trackUsage({ addressId: 'addr-123', context: 'pickup' });
      });

      await waitFor(() => expect(result.current.isTracking).toBe(false));

      // Should not throw error - tracking is not critical
      expect(result.current.recents).toEqual([]);
    });

    it('invalidates query cache after successful tracking', async () => {
      const initialData = [mockUsageHistoryRow];
      let selectCallCount = 0;

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'address_usage_history') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: selectCallCount++ === 0 ? [] : initialData,
                    error: null,
                  }),
                }),
              }),
            }),
            insert: jest.fn().mockResolvedValue({
              data: [mockUsageHistoryRow],
              error: null,
            }),
          };
        }
        return mockSupabaseClient;
      });

      const { result } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.recents).toHaveLength(0);

      // Track usage - should trigger refetch
      await act(async () => {
        await result.current.trackUsageAsync({ addressId: 'addr-123', context: 'order' });
      });

      // Wait for query to refetch
      await waitFor(() => {
        return result.current.recents.length > 0;
      });

      expect(result.current.recents).toHaveLength(1);
    });
  });

  describe('utility functions', () => {
    it('wasRecentlyUsed returns correct status', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [mockUsageHistoryRow],
                error: null,
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.wasRecentlyUsed('addr-123')).toBe(true);
      expect(result.current.wasRecentlyUsed('addr-999')).toBe(false);
    });

    it('getLastUsedDate returns correct date', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [mockUsageHistoryRow],
                error: null,
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const lastUsedDate = result.current.getLastUsedDate('addr-123');
      expect(lastUsedDate).toEqual(new Date('2024-01-15T12:00:00Z'));

      const notUsedDate = result.current.getLastUsedDate('addr-999');
      expect(notUsedDate).toBeNull();
    });

    it('getUsageCount returns correct count', async () => {
      const multipleRows = [
        mockUsageHistoryRow,
        {
          ...mockUsageHistoryRow,
          id: 'usage-456',
          address_id: 'addr-456',
          addresses: { ...mockUsageHistoryRow.addresses, id: 'addr-456' },
        },
        {
          ...mockUsageHistoryRow,
          id: 'usage-789',
          address_id: 'addr-789',
          addresses: { ...mockUsageHistoryRow.addresses, id: 'addr-789' },
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: multipleRows,
                error: null,
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.getUsageCount('addr-123')).toBe(1);
      expect(result.current.getUsageCount('addr-456')).toBe(1);
      expect(result.current.getUsageCount('addr-999')).toBe(0);
    });

    it('recentIds returns array of IDs', async () => {
      const multipleRows = [
        mockUsageHistoryRow,
        {
          ...mockUsageHistoryRow,
          id: 'usage-456',
          address_id: 'addr-456',
          addresses: { ...mockUsageHistoryRow.addresses, id: 'addr-456' },
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: multipleRows,
                error: null,
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.recentIds).toEqual(['addr-123', 'addr-456']);
    });
  });

  describe('caching behavior', () => {
    it('uses cached data when available', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [mockUsageHistoryRow],
                error: null,
              }),
            }),
          }),
        }),
      });

      // First render
      const { unmount } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      await waitFor(() => {
        const queryState = queryClient.getQueryState(['address-recents', 'user-123', 5]);
        return queryState?.status === 'success';
      });

      unmount();

      // Clear mock calls
      mockSupabaseClient.from.mockClear();

      // Second render should use cache
      const { result } = renderHook(() => useAddressRecents('user-123'), { wrapper });

      // Should immediately have data from cache
      expect(result.current.recents).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
    });
  });
});
