import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import type { Address } from '@/types/address';

interface AddressUsageHistoryRow {
  id: string;
  user_id: string;
  address_id: string;
  used_at: string;
  context: string | null;
  addresses: Address | Address[]; // Supabase returns the joined address data
}

interface RecentAddress extends Address {
  lastUsedAt: Date;
  usageContext?: string;
}

/**
 * Hook for managing recent address usage
 * Provides functionality to fetch recent addresses and track new usage
 */
export function useAddressRecents(userId?: string, limit: number = 5) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Fetch user's recent addresses
  const { data: recents = [], isLoading, error } = useQuery({
    queryKey: ['address-recents', userId, limit],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required to fetch recent addresses');
      }

      const { data, error } = await supabase
        .from('address_usage_history')
        .select(`
          id,
          user_id,
          address_id,
          used_at,
          context,
          addresses:address_id (
            id,
            county,
            street1,
            street2,
            city,
            state,
            zip,
            locationNumber,
            parkingLoading,
            name,
            isRestaurant,
            isShared,
            createdAt,
            updatedAt,
            createdBy
          )
        `)
        .eq('user_id', userId)
        .order('used_at', { ascending: false })
        .limit(limit * 3); // Fetch extra to account for duplicates

      if (error) {
        console.error('[useAddressRecents] Error fetching address usage history:', {
          errorType: typeof error,
          errorKeys: Object.keys(error),
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: JSON.stringify(error),
        });
        // Return empty array instead of throwing to allow component to render
        return [];
      }

      // Deduplicate addresses (keep most recent usage per address)
      const seenAddressIds = new Set<string>();
      const uniqueRecents: RecentAddress[] = [];

      for (const usage of data as AddressUsageHistoryRow[]) {
        if (!seenAddressIds.has(usage.address_id) && uniqueRecents.length < limit) {
          // Map the database column names to our Address interface
          const addr = Array.isArray(usage.addresses) ? usage.addresses[0] : usage.addresses;

          // Skip if address data is missing
          if (!addr) continue;

          seenAddressIds.add(usage.address_id);
          uniqueRecents.push({
            id: addr.id,
            county: addr.county,
            street1: addr.street1,
            street2: addr.street2,
            city: addr.city,
            state: addr.state,
            zip: addr.zip,
            locationNumber: addr.locationNumber,
            parkingLoading: addr.parkingLoading,
            name: addr.name,
            isRestaurant: addr.isRestaurant,
            isShared: addr.isShared,
            createdAt: new Date(addr.createdAt),
            updatedAt: new Date(addr.updatedAt),
            createdBy: addr.createdBy,
            lastUsedAt: new Date(usage.used_at),
            usageContext: usage.context || undefined,
          });
        }
      }

      return uniqueRecents;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes (shorter for recents)
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Track address usage mutation
  const trackUsageMutation = useMutation({
    mutationFn: async ({
      addressId,
      context,
    }: {
      addressId: string;
      context?: 'pickup' | 'delivery' | 'order' | string;
    }) => {
      if (!userId) {
        throw new Error('User ID is required to track address usage');
      }

      const { error } = await supabase
        .from('address_usage_history')
        .insert({
          user_id: userId,
          address_id: addressId,
          context: context || null,
        });

      if (error) {
        console.error('Error tracking address usage:', error);
        throw new Error('Failed to track address usage');
      }

      return { addressId, context, timestamp: new Date() };
    },
    onSuccess: (result) => {
      // Invalidate recents query to refetch
      queryClient.invalidateQueries({ queryKey: ['address-recents', userId] });
    },
    onError: (error) => {
      // Don't throw - tracking usage is not critical
      console.error('Failed to track address usage:', error);
    },
  });

  // Helper to check if an address was recently used
  const wasRecentlyUsed = (addressId: string): boolean => {
    return recents.some((addr) => addr.id === addressId);
  };

  // Get the last usage date for an address
  const getLastUsedDate = (addressId: string): Date | null => {
    const recent = recents.find((addr) => addr.id === addressId);
    return recent?.lastUsedAt || null;
  };

  // Get usage count for an address (approximation based on limit)
  const getUsageCount = (addressId: string): number => {
    return recents.filter((addr) => addr.id === addressId).length;
  };

  return {
    recents,
    recentIds: recents.map((addr) => addr.id),
    isLoading,
    error,
    wasRecentlyUsed,
    getLastUsedDate,
    getUsageCount,
    trackUsage: trackUsageMutation.mutate,
    trackUsageAsync: trackUsageMutation.mutateAsync,
    isTracking: trackUsageMutation.isPending,
  };
}
