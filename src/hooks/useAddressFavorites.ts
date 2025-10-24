import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import type { Address } from '@/types/address';

interface AddressFavoriteRow {
  id: string;
  user_id: string;
  address_id: string;
  created_at: string;
  addresses: Address | Address[]; // Supabase returns the joined address data
}

/**
 * Hook for managing address favorites
 * Provides functionality to fetch, toggle, and check favorite status
 */
export function useAddressFavorites(userId?: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Fetch user's favorite addresses
  const { data: favorites = [], isLoading, error } = useQuery({
    queryKey: ['address-favorites', userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required to fetch favorites');
      }

      const { data, error } = await supabase
        .from('address_favorites')
        .select(`
          id,
          user_id,
          address_id,
          created_at,
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
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useAddressFavorites] Error fetching address favorites:', {
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

      // Transform the data to extract addresses
      // Supabase returns addresses as an array when using joins
      return (data as AddressFavoriteRow[])
        .map((fav) => {
          // Map the database column names to our Address interface
          const addr = Array.isArray(fav.addresses) ? fav.addresses[0] : fav.addresses;

          // Skip if address data is missing
          if (!addr) return null;

          return {
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
          } as Address;
        })
        .filter((addr): addr is Address => addr !== null);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Get array of favorite address IDs for quick lookups
  const favoriteIds = favorites.map((fav) => fav.id);

  // Check if an address is favorited
  const isFavorite = (addressId: string): boolean => {
    return favoriteIds.includes(addressId);
  };

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (addressId: string) => {
      if (!userId) {
        throw new Error('User ID is required to toggle favorites');
      }

      const isCurrentlyFavorite = isFavorite(addressId);

      if (isCurrentlyFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from('address_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('address_id', addressId);

        if (error) {
          console.error('Error removing favorite:', error);
          throw new Error('Failed to remove address from favorites');
        }

        return { action: 'removed', addressId };
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('address_favorites')
          .insert({
            user_id: userId,
            address_id: addressId,
          });

        if (error) {
          console.error('Error adding favorite:', error);
          throw new Error('Failed to add address to favorites');
        }

        return { action: 'added', addressId };
      }
    },
    onSuccess: (result) => {
      // Invalidate favorites query to refetch
      queryClient.invalidateQueries({ queryKey: ['address-favorites', userId] });
    },
    onError: (error) => {
      console.error('Failed to toggle favorite:', error);
    },
  });

  // Add favorite (for explicit add operations)
  const addFavorite = async (addressId: string) => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (isFavorite(addressId)) {
      console.warn('Address is already favorited');
      return;
    }

    await toggleFavoriteMutation.mutateAsync(addressId);
  };

  // Remove favorite (for explicit remove operations)
  const removeFavorite = async (addressId: string) => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!isFavorite(addressId)) {
      console.warn('Address is not favorited');
      return;
    }

    await toggleFavoriteMutation.mutateAsync(addressId);
  };

  return {
    favorites,
    favoriteIds,
    isLoading,
    error,
    isFavorite,
    toggleFavorite: toggleFavoriteMutation.mutate,
    toggleFavoriteAsync: toggleFavoriteMutation.mutateAsync,
    addFavorite,
    removeFavorite,
    isToggling: toggleFavoriteMutation.isPending,
  };
}
