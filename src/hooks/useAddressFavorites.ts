import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { CACHE_PRESETS } from '@/config/cache-config';
import type { Address } from '@/types/address';

/**
 * Database row type for address_favorites table with joined address data
 * Supabase returns the joined address as an object (not array) when using single relation
 */
interface AddressFavoriteRow {
  id: string;
  user_id: string;
  address_id: string;
  created_at: string;
  addresses: {
    id: string;
    county: string;
    street1: string;
    street2: string | null;
    city: string;
    state: string;
    zip: string;
    locationNumber: string | null;
    parkingLoading: string | null;
    name: string | null;
    isRestaurant: boolean;
    isShared: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
  } | null;
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

      // Let React Query handle errors naturally - throw instead of returning empty array
      if (error) {
        console.error('[useAddressFavorites] Error fetching address favorites:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw new Error(`Failed to fetch address favorites: ${error.message}`);
      }

      // Transform the data to extract addresses
      // Supabase returns the joined address as a single object (not array)
      const addresses: Address[] = data
        .map((fav): Address | null => {
          // Skip if address data is missing
          if (!fav.addresses) return null;

          // Explicit type assertion to help TypeScript recognize this as a single object
          // Two-step assertion needed because Supabase's type inference differs from our interface
          const addr = fav.addresses as unknown as NonNullable<AddressFavoriteRow['addresses']>;

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
          };
        })
        .filter((addr): addr is Address => addr !== null);

      return addresses;
    },
    enabled: !!userId,
    // Use STANDARD cache preset for moderately stable user data
    ...CACHE_PRESETS.STANDARD,
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
    toggleError: toggleFavoriteMutation.error,
  };
}
