'use client';

import { useMemo } from 'react';
import { MapPin, Star, Clock } from 'lucide-react';
import type { Address } from '@/types/address';
import type { AddressSelectorProps, AddressSection } from '@/types/address-selector';
import { useUser } from '@/contexts/UserContext';
import { useAddresses } from '@/hooks/useAddresses';
import { useAddressSearch } from '@/hooks/useAddressSearch';
import { useAddressFavorites } from '@/hooks/useAddressFavorites';
import { useAddressRecents } from '@/hooks/useAddressRecents';
import {
  AddressSearchCombobox,
  AddressQuickFilters,
  AddressSectionList,
} from './index';
import { cn } from '@/lib/utils';

/**
 * Main AddressSelector component
 * Provides a complete address selection interface with search, filters, favorites, and recents
 */
export function AddressSelector({
  mode,
  type,
  onSelect,
  selectedAddressId,
  showFavorites = true,
  showRecents = true,
  allowAddNew = true,
  className,
}: AddressSelectorProps) {
  const { user } = useUser();

  // Fetch all addresses with pagination (we'll load all for now)
  const { data: addressesResponse, isLoading: isLoadingAddresses } = useAddresses(
    {
      filter: 'all',
      page: 1,
      limit: 1000, // Load all addresses for client-side filtering
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Memoize addresses to prevent unnecessary re-renders
  const addresses = useMemo(
    () => addressesResponse?.addresses || [],
    [addressesResponse?.addresses]
  );

  // Favorites management
  const {
    favoriteIds,
    isFavorite,
    toggleFavorite,
    isLoading: isLoadingFavorites,
  } = useAddressFavorites(user?.id);

  // Recents management
  const {
    recents,
    trackUsage,
    isLoading: isLoadingRecents,
  } = useAddressRecents(user?.id, 5);

  // Search and filter
  const {
    query,
    setQuery,
    filters,
    setFilters,
    filteredAddresses,
    favoriteAddresses,
    recentAddresses,
    resultCount,
  } = useAddressSearch({
    addresses,
    initialFilter: 'all',
    favorites: favoriteIds,
    recents: recents.map((addr) => ({
      addressId: addr.id,
      lastUsedAt: addr.lastUsedAt,
    })),
  });

  // Build sections for the section list
  const sections: AddressSection[] = useMemo(() => {
    const result: AddressSection[] = [];

    // Favorites section
    if (showFavorites && favoriteAddresses.length > 0) {
      result.push({
        id: 'favorites',
        title: 'Favorites',
        icon: Star,
        addresses: favoriteAddresses,
        count: favoriteAddresses.length,
        emptyMessage: 'No favorite addresses yet',
      });
    }

    // Recents section
    if (showRecents && recentAddresses.length > 0) {
      result.push({
        id: 'recents',
        title: 'Recently Used',
        icon: Clock,
        addresses: recentAddresses,
        count: recentAddresses.length,
        emptyMessage: 'No recent addresses',
      });
    }

    // All addresses section
    result.push({
      id: 'all',
      title: 'All Addresses',
      icon: MapPin,
      addresses: filteredAddresses,
      count: addresses.length,
      emptyMessage: query ? 'No addresses found matching your search' : 'No addresses available',
    });

    return result;
  }, [
    showFavorites,
    showRecents,
    favoriteAddresses,
    recentAddresses,
    filteredAddresses,
    addresses.length,
    query,
  ]);

  // Handle address selection
  const handleAddressSelect = async (address: Address) => {
    // Track usage in the background (non-blocking)
    if (type && user?.id) {
      trackUsage({ addressId: address.id, context: type });
    }

    // Call the parent's onSelect handler
    onSelect(address);
  };

  // Handle favorite toggle
  const handleFavoriteToggle = (addressId: string) => {
    if (!user?.id) {
      console.warn('User must be logged in to toggle favorites');
      return;
    }
    toggleFavorite(addressId);
  };

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    return {
      all: addresses.length,
      shared: addresses.filter((addr) => addr.isShared).length,
      private: addresses.filter((addr) => !addr.isShared).length,
    };
  }, [addresses]);

  const isLoading = isLoadingAddresses || isLoadingFavorites || isLoadingRecents;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Combobox */}
      <AddressSearchCombobox
        addresses={addresses}
        onSelect={handleAddressSelect}
        selectedAddressId={selectedAddressId}
        placeholder={
          type
            ? `Search ${type} addresses...`
            : 'Search addresses...'
        }
        disabled={isLoading}
      />

      {/* Quick Filters */}
      <AddressQuickFilters
        activeFilter={filters.filter}
        onFilterChange={(filter) => setFilters({ ...filters, filter })}
        counts={filterCounts}
      />

      {/* Address Sections */}
      <AddressSectionList
        sections={sections}
        onAddressSelect={handleAddressSelect}
        selectedAddressId={selectedAddressId}
        isLoading={isLoading}
        onFavoriteToggle={handleFavoriteToggle}
        favoriteIds={favoriteIds}
      />

      {/* TODO: Add New Address Button */}
      {/* Implement in Phase 5 when integrating with pages */}
      {allowAddNew && (
        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground text-center">
            Add new address functionality coming soon
          </p>
        </div>
      )}
    </div>
  );
}
