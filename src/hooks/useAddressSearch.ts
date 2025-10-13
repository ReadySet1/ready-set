import { useMemo, useState } from 'react';
import type { Address, AddressFilter } from '@/types/address';
import type { AddressSearchFilters, AddressWithMetadata } from '@/types/address-selector';
import { useDebounce } from './useDebounce';

interface UseAddressSearchOptions {
  addresses: Address[];
  initialFilter?: AddressFilter;
  favorites?: string[]; // Array of favorite address IDs
  recents?: Array<{ addressId: string; lastUsedAt: Date }>; // Recent addresses with metadata
}

/**
 * Hook for searching and filtering addresses with debouncing
 * Provides instant search functionality with client-side filtering
 */
export function useAddressSearch({
  addresses,
  initialFilter = 'all',
  favorites = [],
  recents = [],
}: UseAddressSearchOptions) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<AddressSearchFilters>({
    query: '',
    filter: initialFilter,
  });

  // Debounce the search query to avoid excessive filtering
  const debouncedQuery = useDebounce(query, 300);

  // Enhance addresses with metadata (favorites, usage)
  const enhancedAddresses = useMemo<AddressWithMetadata[]>(() => {
    return addresses.map((address) => {
      const isFavorite = favorites.includes(address.id);
      const recentUsage = recents.find((r) => r.addressId === address.id);

      return {
        ...address,
        isFavorite,
        lastUsedAt: recentUsage?.lastUsedAt,
        usageCount: recents.filter((r) => r.addressId === address.id).length,
      };
    });
  }, [addresses, favorites, recents]);

  // Filter addresses based on search query and filters
  const filteredAddresses = useMemo(() => {
    let result = enhancedAddresses;

    // Apply text search filter
    if (debouncedQuery.trim()) {
      const searchLower = debouncedQuery.toLowerCase().trim();
      result = result.filter((address) => {
        const searchableText = [
          address.name,
          address.street1,
          address.street2,
          address.city,
          address.county,
          address.state,
          address.zip,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(searchLower);
      });
    }

    // Apply shared/private filter
    if (filters.filter === 'shared') {
      result = result.filter((addr) => addr.isShared);
    } else if (filters.filter === 'private') {
      result = result.filter((addr) => !addr.isShared);
    }

    // Apply additional filters if provided
    if (filters.city) {
      result = result.filter((addr) =>
        addr.city.toLowerCase() === filters.city?.toLowerCase()
      );
    }

    if (filters.county) {
      result = result.filter((addr) =>
        addr.county?.toLowerCase() === filters.county?.toLowerCase()
      );
    }

    return result;
  }, [enhancedAddresses, debouncedQuery, filters]);

  // Get favorite addresses
  const favoriteAddresses = useMemo(() => {
    return filteredAddresses.filter((addr) => addr.isFavorite);
  }, [filteredAddresses]);

  // Get recent addresses (sorted by last used)
  const recentAddresses = useMemo(() => {
    return filteredAddresses
      .filter((addr) => addr.lastUsedAt)
      .sort((a, b) => {
        if (!a.lastUsedAt || !b.lastUsedAt) return 0;
        return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
      })
      .slice(0, 5); // Top 5 recent addresses
  }, [filteredAddresses]);

  // Helper to check if an address matches the search query
  const addressMatchesQuery = (address: Address, searchQuery: string): boolean => {
    if (!searchQuery.trim()) return true;

    const searchLower = searchQuery.toLowerCase().trim();
    const searchableText = [
      address.name,
      address.street1,
      address.street2,
      address.city,
      address.county,
      address.state,
      address.zip,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(searchLower);
  };

  return {
    query,
    setQuery,
    filters,
    setFilters,
    filteredAddresses,
    favoriteAddresses,
    recentAddresses,
    resultCount: filteredAddresses.length,
    isSearching: query.trim().length > 0,
    debouncedQuery,
    addressMatchesQuery,
  };
}
