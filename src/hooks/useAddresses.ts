import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Address, AddressFormData } from '@/types/address';
import { createClient } from '@/utils/supabase/client';

interface AddressesQueryParams {
  filter: 'all' | 'shared' | 'private';
  page: number;
  limit: number;
  search?: string;
}

interface AddressesResponse {
  addresses: Address[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
  };
}

interface UseAddressesOptions {
  enabled?: boolean;
  staleTime?: number;
}

// Fetch addresses with proper error handling and authentication
const fetchAddresses = async (params: AddressesQueryParams): Promise<AddressesResponse> => {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Authentication required. Please sign in again.');
  }

  const searchParams = new URLSearchParams({
    filter: params.filter,
    page: params.page.toString(),
    limit: params.limit.toString(),
  });
  if (params.search) {
    searchParams.set('search', params.search);
  }

  const response = await fetch(
    `/api/addresses?${searchParams.toString()}`,
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Session expired. Please sign in again.');
    }
    if (response.status === 403) {
      throw new Error('Access denied. You do not have permission to view these addresses.');
    }
    if (response.status === 404) {
      throw new Error('Addresses not found.');
    }
    if (response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // Handle both old format (array) and new format (paginated object)
  if (Array.isArray(data)) {
    // Old format - backward compatibility
    return {
      addresses: data,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCount: data.length,
        hasNextPage: false,
        hasPrevPage: false,
        limit: data.length,
      },
    };
  } else if (data.addresses && data.pagination) {
    // New paginated format
    return data;
  } else {
    throw new Error('Unexpected data format from API');
  }
};

// Create address mutation
const createAddress = async (addressData: AddressFormData): Promise<Address> => {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Authentication required. Please sign in again.');
  }

  const response = await fetch('/api/addresses', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(addressData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create address: ${response.statusText}`);
  }

  return response.json();
};

// Update address mutation
const updateAddress = async ({ id, data }: { id: string; data: Partial<AddressFormData> }): Promise<Address> => {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Authentication required. Please sign in again.');
  }

  const response = await fetch(`/api/addresses?id=${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update address: ${response.statusText}`);
  }

  return response.json();
};

// Delete address mutation
const deleteAddress = async (id: string): Promise<void> => {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Authentication required. Please sign in again.');
  }

  const response = await fetch(`/api/addresses?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete address: ${response.statusText}`);
  }
};

export function useAddresses(
  params: AddressesQueryParams,
  options: UseAddressesOptions = {}
) {
  const {
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes default
  } = options;

  return useQuery({
    queryKey: ['addresses', params.filter, params.page, params.limit, params.search],
    queryFn: () => fetchAddresses(params),
    enabled,
    staleTime,
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on client errors (4xx)
      if (error?.message?.includes('Authentication') || 
          error?.message?.includes('Access denied') ||
          error?.message?.includes('not found')) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAddress,
    onSuccess: () => {
      // Invalidate and refetch addresses queries
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
    onError: (error: Error) => {
      console.error('Failed to create address:', error);
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAddress,
    onSuccess: (updatedAddress) => {
      // Update the cache with the new data
      queryClient.setQueryData(
        ['addresses'],
        (oldData: AddressesResponse | undefined) => {
          if (!oldData) return oldData;
          
          return {
            ...oldData,
            addresses: oldData.addresses.map(addr =>
              addr.id === updatedAddress.id ? updatedAddress : addr
            ),
          };
        }
      );
      
      // Also invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
    onError: (error: Error) => {
      console.error('Failed to update address:', error);
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAddress,
    onSuccess: (_, deletedId) => {
      // Update the cache by removing the deleted address
      queryClient.setQueryData(
        ['addresses'],
        (oldData: AddressesResponse | undefined) => {
          if (!oldData) return oldData;
          
          return {
            ...oldData,
            addresses: oldData.addresses.filter(addr => addr.id !== deletedId),
            pagination: {
              ...oldData.pagination,
              totalCount: Math.max(0, oldData.pagination.totalCount - 1),
            },
          };
        }
      );
      
      // Also invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
    onError: (error: Error) => {
      console.error('Failed to delete address:', error);
    },
  });
}

// Hook for prefetching addresses (useful for navigation)
export function usePrefetchAddresses() {
  const queryClient = useQueryClient();

  return (params: AddressesQueryParams) => {
    queryClient.prefetchQuery({
      queryKey: ['addresses', params.filter, params.page, params.limit, params.search],
      queryFn: () => fetchAddresses(params),
      staleTime: 5 * 60 * 1000,
    });
  };
}
