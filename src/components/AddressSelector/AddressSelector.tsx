'use client';

import { useMemo, useState } from 'react';
import { MapPin, Star, Clock, Search, Plus } from 'lucide-react';
import type { Address } from '@/types/address';
import type { AddressSelectorProps, AddressSection } from '@/types/address-selector';
import { useUser } from '@/contexts/UserContext';
import { useAddresses } from '@/hooks/useAddresses';
import { useAddressSearch } from '@/hooks/useAddressSearch';
import { useAddressFavorites } from '@/hooks/useAddressFavorites';
import { useAddressRecents } from '@/hooks/useAddressRecents';
import {
  AddressQuickFilters,
  AddressSectionList,
  AddressCompactCard,
} from './index';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import AddressModal from '@/components/AddressManager/AddressModal';

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
  addressTypeFilter = 'all',
  defaultCollapsed = false,
  showAllAddressesSection = true,
}: AddressSelectorProps) {
  const { user } = useUser();
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  // Fetch all addresses with pagination (we'll load all for now)
  const { data: addressesResponse, isLoading: isLoadingAddresses, refetch: refetchAddresses } = useAddresses(
    {
      filter: 'all',
      page: 1,
      limit: 1000, // Load all addresses for client-side filtering
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Memoize addresses and apply address type filter to prevent unnecessary re-renders
  const addresses = useMemo(() => {
    const allAddresses = addressesResponse?.addresses || [];

    // Apply address type filter
    if (addressTypeFilter === 'restaurant') {
      return allAddresses.filter((addr) => addr.isRestaurant === true);
    } else if (addressTypeFilter === 'private') {
      return allAddresses.filter((addr) => addr.isRestaurant === false || addr.isRestaurant === undefined);
    }

    // Default: return all addresses
    return allAddresses;
  }, [addressesResponse?.addresses, addressTypeFilter]);

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
    debouncedQuery,
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

    // All addresses section (only if showAllAddressesSection is true)
    if (showAllAddressesSection) {
      result.push({
        id: 'all',
        title: 'All Addresses',
        icon: MapPin,
        addresses: filteredAddresses,
        count: addresses.length,
        emptyMessage: query ? 'No addresses found matching your search' : 'No addresses available',
      });
    }

    return result;
  }, [
    showFavorites,
    showRecents,
    favoriteAddresses,
    recentAddresses,
    filteredAddresses,
    addresses.length,
    query,
    showAllAddressesSection,
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
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder={
            type
              ? `Search ${type} addresses...`
              : 'Search addresses...'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Quick Filters */}
      <AddressQuickFilters
        activeFilter={filters.filter}
        onFilterChange={(filter) => setFilters({ ...filters, filter })}
        counts={filterCounts}
      />

      {/* Address Sections - only show if there are sections to display */}
      {sections.length > 0 && (
        <AddressSectionList
          sections={sections}
          onAddressSelect={handleAddressSelect}
          selectedAddressId={selectedAddressId}
          isLoading={isLoading}
          onFavoriteToggle={handleFavoriteToggle}
          favoriteIds={favoriteIds}
          defaultCollapsed={defaultCollapsed}
        />
      )}

      {/* Render filtered addresses directly if All Addresses section is hidden */}
      {!showAllAddressesSection && (
        <>
          {/* Show prompt to search if no query */}
          {debouncedQuery.length === 0 && !isLoading && (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed bg-slate-50">
              <div className="text-center space-y-2 px-4">
                <Search className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium text-slate-700">
                  Start typing to search addresses
                </p>
                <p className="text-xs text-muted-foreground">
                  Enter at least 2 characters to see results
                </p>
              </div>
            </div>
          )}

          {/* Show message for queries that are too short */}
          {debouncedQuery.length > 0 && debouncedQuery.length < 2 && !isLoading && (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">
                Type at least 2 characters to search
              </p>
            </div>
          )}

          {/* Show results when query is 2+ characters */}
          {debouncedQuery.length >= 2 && filteredAddresses.length > 0 && (
            <>
              {/* Results count */}
              <div className="text-sm text-muted-foreground">
                Found {filteredAddresses.length} address{filteredAddresses.length !== 1 ? 'es' : ''}
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                {filteredAddresses.map((address) => {
                  const addressWithFavorite = {
                    ...address,
                    isFavorite: favoriteIds.includes(address.id),
                  };

                  return (
                    <div key={address.id}>
                      <AddressCompactCard
                        address={addressWithFavorite}
                        onSelect={() => handleAddressSelect(address)}
                        isSelected={selectedAddressId === address.id}
                        variant="compact"
                        showActions={true}
                        onFavoriteToggle={
                          handleFavoriteToggle
                            ? () => handleFavoriteToggle(address.id)
                            : undefined
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* No results found */}
          {debouncedQuery.length >= 2 && filteredAddresses.length === 0 && !isLoading && (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
              <div className="text-center space-y-2 px-4">
                <MapPin className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium text-slate-700">
                  No addresses found
                </p>
                <p className="text-xs text-muted-foreground">
                  Try a different search term
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add New Address Button */}
      {allowAddNew && (
        <div className="pt-2 border-t">
          <Button
            onClick={() => setIsAddressModalOpen(true)}
            variant="outline"
            className="w-full flex items-center justify-center gap-2 transition-all duration-200 hover:bg-primary hover:text-white"
          >
            <Plus className="h-4 w-4" />
            <span>Add New {addressTypeFilter === 'restaurant' ? 'Restaurant' : 'Address'}</span>
          </Button>
        </div>
      )}

      {/* Address Modal */}
      {isAddressModalOpen && (
        <AddressModal
          isOpen={isAddressModalOpen}
          onClose={() => setIsAddressModalOpen(false)}
          addressToEdit={null}
          onAddressUpdated={() => {
            refetchAddresses();
            setIsAddressModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
