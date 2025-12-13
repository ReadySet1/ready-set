'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { MapPin, Star, Clock, Search, Plus } from 'lucide-react';
import type { Address } from '@/types/address';
import type { AddressSelectorProps, AddressSection, PaginationInfo } from '@/types/address-selector';
import { useUser } from '@/contexts/UserContext';
import { useAddresses } from '@/hooks/useAddresses';
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
import { useDebounce } from '@/hooks/useDebounce';

const ADDRESSES_PER_PAGE = 20;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Fetch addresses with pagination and server-side search
  const { data: addressesResponse, isLoading: isLoadingAddresses, refetch: refetchAddresses } = useAddresses(
    {
      filter: 'all',
      page: currentPage,
      limit: ADDRESSES_PER_PAGE,
      search: debouncedSearch || undefined,
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

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

  // For favorites/recents, we use client-side filtering from the local state
  const [quickFilter, setQuickFilter] = useState<'all' | 'shared' | 'private'>('all');

  // Get favorite addresses from fetched addresses
  const favoriteAddresses = useMemo(() => {
    return addresses.filter((addr) => favoriteIds.includes(addr.id));
  }, [addresses, favoriteIds]);

  // Get recent addresses
  const recentAddresses = useMemo(() => {
    const recentIds = recents.map((r) => r.id);
    return addresses.filter((addr) => recentIds.includes(addr.id));
  }, [addresses, recents]);

  // Get pagination info from response
  const pagination: PaginationInfo | undefined = useMemo(() => {
    if (!addressesResponse?.pagination) return undefined;
    const { currentPage, totalPages, totalCount, hasNextPage, hasPrevPage } = addressesResponse.pagination;
    return { currentPage, totalPages, totalCount, hasNextPage, hasPrevPage };
  }, [addressesResponse?.pagination]);

  // Build sections for the section list
  const sections: AddressSection[] = useMemo(() => {
    const result: AddressSection[] = [];

    // Track IDs of addresses shown in priority sections to avoid duplicates
    const shownAddressIds = new Set<string>();

    // Favorites section (only when not searching)
    if (showFavorites && favoriteAddresses.length > 0 && !debouncedSearch) {
      result.push({
        id: 'favorites',
        title: 'Favorites',
        icon: Star,
        addresses: favoriteAddresses.map((a) => ({ ...a, isFavorite: true })),
        count: favoriteAddresses.length,
        emptyMessage: 'No favorite addresses yet',
      });
      // Mark these addresses as shown
      favoriteAddresses.forEach((a) => shownAddressIds.add(a.id));
    }

    // Recents section (only when not searching)
    if (showRecents && recentAddresses.length > 0 && !debouncedSearch) {
      result.push({
        id: 'recents',
        title: 'Recently Used',
        icon: Clock,
        addresses: recentAddresses.map((a) => ({ ...a, isFavorite: favoriteIds.includes(a.id) })),
        count: recentAddresses.length,
        emptyMessage: 'No recent addresses',
      });
      // Mark these addresses as shown
      recentAddresses.forEach((a) => shownAddressIds.add(a.id));
    }

    // All addresses section (only if showAllAddressesSection is true)
    // Filter out addresses already shown in favorites/recents sections
    if (showAllAddressesSection) {
      const filteredAddresses = debouncedSearch
        ? addresses // When searching, show all results (no duplicates since other sections are hidden)
        : addresses.filter((a) => !shownAddressIds.has(a.id));

      result.push({
        id: 'all',
        title: 'All Addresses',
        icon: MapPin,
        addresses: filteredAddresses.map((a) => ({ ...a, isFavorite: favoriteIds.includes(a.id) })),
        count: pagination?.totalCount || addresses.length,
        emptyMessage: debouncedSearch ? 'No addresses found matching your search' : 'No addresses available',
      });
    }

    return result;
  }, [
    showFavorites,
    showRecents,
    favoriteAddresses,
    recentAddresses,
    addresses,
    favoriteIds,
    debouncedSearch,
    showAllAddressesSection,
    pagination?.totalCount,
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

  // Calculate filter counts - use pagination total for accurate count
  const filterCounts = useMemo(() => {
    const total = pagination?.totalCount || addresses.length;
    return {
      all: total,
      shared: addresses.filter((addr) => addr.isShared).length,
      private: addresses.filter((addr) => !addr.isShared).length,
    };
  }, [addresses, pagination?.totalCount]);

  const isLoading = isLoadingAddresses || isLoadingFavorites || isLoadingRecents;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Search Input - Compact */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder={
            type
              ? `Search ${type}...`
              : 'Search...'
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={isLoading}
          className="h-7 w-full rounded-md border border-slate-200 bg-white pl-7 pr-3 text-[11px] transition-all duration-150 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Quick Filters */}
      <AddressQuickFilters
        activeFilter={quickFilter}
        onFilterChange={(filter) => setQuickFilter(filter)}
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
          pagination={pagination}
          onPageChange={handlePageChange}
        />
      )}

      {/* Render filtered addresses directly if All Addresses section is hidden */}
      {!showAllAddressesSection && (
        <>
          {/* Show prompt to search if no query */}
          {!debouncedSearch && !isLoading && (
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
          {debouncedSearch && debouncedSearch.length < 2 && !isLoading && (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">
                Type at least 2 characters to search
              </p>
            </div>
          )}

          {/* Show results when query is 2+ characters */}
          {debouncedSearch && debouncedSearch.length >= 2 && addresses.length > 0 && (
            <>
              {/* Results count */}
              <div className="text-sm text-muted-foreground">
                Found {pagination?.totalCount || addresses.length} address{(pagination?.totalCount || addresses.length) !== 1 ? 'es' : ''}
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                {addresses.map((address) => {
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
          {debouncedSearch && debouncedSearch.length >= 2 && addresses.length === 0 && !isLoading && (
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

      {/* Add New Address Button - Compact */}
      {allowAddNew && (
        <div className="pt-1.5 border-t border-slate-100">
          <Button
            onClick={() => setIsAddressModalOpen(true)}
            variant="ghost"
            size="sm"
            className="w-full h-7 flex items-center justify-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3 w-3" />
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
