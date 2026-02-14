import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';
import {
  useAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  usePrefetchAddresses,
  fetchAddresses,
} from '../useAddresses';
import { createClient } from '@/utils/supabase/client';

const mockFetch = global.fetch as jest.Mock;
const mockCreateClient = createClient as jest.Mock;

const defaultParams = { filter: 'all' as const, page: 1, limit: 20 };

const mockPaginatedResponse = {
  addresses: [
    { id: '1', street1: '123 Main St', city: 'Test City', state: 'TS', zip: '12345', isShared: false },
    { id: '2', street1: '456 Oak Ave', city: 'Other City', state: 'OT', zip: '67890', isShared: true },
  ],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalCount: 2,
    hasNextPage: false,
    hasPrevPage: false,
    limit: 20,
  },
  counts: { all: 2, shared: 1, private: 1 },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function setupAuthenticatedClient() {
  mockCreateClient.mockReturnValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@test.com' } },
        error: null,
      }),
    },
  });
}

describe('fetchAddresses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuthenticatedClient();
  });

  it('should throw when user is not authenticated', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated'),
        }),
      },
    });

    await expect(fetchAddresses(defaultParams)).rejects.toThrow(
      'Authentication required'
    );
  });

  it('should build URL with query params including search', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    });

    await fetchAddresses({ ...defaultParams, search: 'Main' });

    const fetchUrl = mockFetch.mock.calls[0][0] as string;
    expect(fetchUrl).toContain('filter=all');
    expect(fetchUrl).toContain('page=1');
    expect(fetchUrl).toContain('limit=20');
    expect(fetchUrl).toContain('search=Main');
  });

  it('should throw on 401 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });

    await expect(fetchAddresses(defaultParams)).rejects.toThrow(
      'Session expired'
    );
  });

  it('should throw on 403 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });

    await expect(fetchAddresses(defaultParams)).rejects.toThrow(
      'Access denied'
    );
  });

  it('should throw on 404 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });

    await expect(fetchAddresses(defaultParams)).rejects.toThrow(
      'Addresses not found'
    );
  });

  it('should throw on 500+ response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' });

    await expect(fetchAddresses(defaultParams)).rejects.toThrow(
      'Server error'
    );
  });

  it('should throw generic error on other non-ok status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' });

    await expect(fetchAddresses(defaultParams)).rejects.toThrow(
      'Error 429: Too Many Requests'
    );
  });

  it('should handle legacy array format', async () => {
    const legacyData = [
      { id: '1', isShared: false },
      { id: '2', isShared: true },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => legacyData,
    });

    const result = await fetchAddresses(defaultParams);

    expect(result.addresses).toEqual(legacyData);
    expect(result.pagination.currentPage).toBe(1);
    expect(result.pagination.totalCount).toBe(2);
    expect(result.counts.all).toBe(2);
    expect(result.counts.shared).toBe(1);
    expect(result.counts.private).toBe(1);
  });

  it('should handle new paginated format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    });

    const result = await fetchAddresses(defaultParams);

    expect(result.addresses).toEqual(mockPaginatedResponse.addresses);
    expect(result.pagination).toEqual(mockPaginatedResponse.pagination);
    expect(result.counts).toEqual(mockPaginatedResponse.counts);
  });

  it('should handle paginated format without counts', async () => {
    const dataWithoutCounts = {
      addresses: mockPaginatedResponse.addresses,
      pagination: { ...mockPaginatedResponse.pagination, totalCount: 2 },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => dataWithoutCounts,
    });

    const result = await fetchAddresses(defaultParams);

    expect(result.counts.all).toBe(2);
  });

  it('should throw on unexpected data format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unexpected: 'format' }),
    });

    await expect(fetchAddresses(defaultParams)).rejects.toThrow(
      'Unexpected data format'
    );
  });
});

describe('useAddresses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuthenticatedClient();
  });

  it('should return loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(
      () => useAddresses(defaultParams),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);
  });

  it('should not fetch when enabled is false', () => {
    const { result } = renderHook(
      () => useAddresses(defaultParams, { enabled: false }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isFetching).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should fetch and return data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    });

    const { result } = renderHook(
      () => useAddresses(defaultParams),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.addresses).toHaveLength(2);
  });

  it('should not retry on authentication errors', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated'),
        }),
      },
    });

    const { result } = renderHook(
      () => useAddresses(defaultParams),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
    // Should only have been called once (no retries for auth errors)
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });
});

describe('useCreateAddress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuthenticatedClient();
  });

  it('should POST to create an address', async () => {
    const newAddress = { street1: '789 New St', city: 'New City', state: 'NC', zip: '11111' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '3', ...newAddress }),
    });

    const { result } = renderHook(() => useCreateAddress(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(newAddress as any);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/addresses',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(newAddress),
      })
    );
  });

  it('should throw on failed creation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Duplicate address' }),
    });

    const { result } = renderHook(() => useCreateAddress(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ street1: '123' } as any);
      })
    ).rejects.toThrow('Duplicate address');
  });
});

describe('useUpdateAddress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuthenticatedClient();
  });

  it('should PUT to update an address', async () => {
    const updateData = { street1: 'Updated St' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', ...updateData }),
    });

    const { result } = renderHook(() => useUpdateAddress(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: '1', data: updateData });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/addresses?id=1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(updateData),
      })
    );
  });
});

describe('useDeleteAddress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuthenticatedClient();
  });

  it('should DELETE an address', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useDeleteAddress(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('addr-1');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/addresses?id=addr-1',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' })
    );
  });

  it('should throw on failed deletion', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Address in use' }),
    });

    const { result } = renderHook(() => useDeleteAddress(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync('addr-1');
      })
    ).rejects.toThrow('Address in use');
  });
});

describe('usePrefetchAddresses', () => {
  it('should return a prefetch function', () => {
    const { result } = renderHook(() => usePrefetchAddresses(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current).toBe('function');
  });
});
