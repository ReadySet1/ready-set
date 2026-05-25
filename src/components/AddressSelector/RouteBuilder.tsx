'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Address } from '@/types/address';
import type { RouteBuilderProps, ScopeFilter, AddressWithMetadata, PaginationInfo } from '@/types/address-selector';
import { useUser } from '@/contexts/UserContext';
import { useAddresses } from '@/hooks/useAddresses';
import { useAddressFavorites } from '@/hooks/useAddressFavorites';
import { useAddressRecents } from '@/hooks/useAddressRecents';
import { useDebounce } from '@/hooks/useDebounce';
import { useRouteBuilder } from './useRouteBuilder';
import { RouteBar } from './RouteBar';
import { Library } from './Library';
import AddressModal from '@/components/AddressManager/AddressModal';
import { cn } from '@/lib/utils';

const ADDRESSES_PER_PAGE = 20;

export function RouteBuilder({
  pickup,
  delivery,
  onChange,
  onCreateNew,
  mode = 'admin',
  className,
  isLoading: externalLoading = false,
}: RouteBuilderProps) {
  const { user } = useUser();
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeScope, setActiveScope] = useState<ScopeFilter>('all');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset page when search or scope changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeScope]);

  // State machine
  const { activeSlot, assignAddress, editSlot, clearSlot } = useRouteBuilder({
    pickup,
    delivery,
    onChange,
  });

  // Determine filter param for API based on scope
  const filterParam = activeScope === 'mine' ? 'private' : 'all';

  // Fetch addresses
  const { data: addressesResponse, isLoading: isLoadingAddresses, refetch: refetchAddresses } = useAddresses(
    {
      filter: filterParam,
      page: currentPage,
      limit: ADDRESSES_PER_PAGE,
      search: debouncedSearch || undefined,
    },
    {
      staleTime: 5 * 60 * 1000,
    },
  );

  // Favorites management
  const {
    favoriteIds,
    toggleFavorite,
    isLoading: isLoadingFavorites,
  } = useAddressFavorites(user?.id);

  // Recents management
  const {
    recents,
    recentIds,
    isLoading: isLoadingRecents,
  } = useAddressRecents(user?.id, 10);

  // Handle favorite toggle
  const handleFavoriteToggle = useCallback(
    (addressId: string) => {
      if (!user?.id) return;
      toggleFavorite(addressId);
    },
    [user?.id, toggleFavorite],
  );

  // Filter addresses based on scope
  const filteredAddresses: AddressWithMetadata[] = useMemo(() => {
    const allAddresses = addressesResponse?.addresses || [];

    let filtered: Address[];
    switch (activeScope) {
      case 'favorites':
        filtered = allAddresses.filter((a) => favoriteIds.includes(a.id));
        break;
      case 'recent':
        filtered = allAddresses.filter((a) => recentIds.includes(a.id));
        break;
      case 'mine':
      case 'all':
      default:
        filtered = allAddresses;
        break;
    }

    return filtered.map((a) => ({
      ...a,
      isFavorite: favoriteIds.includes(a.id),
    }));
  }, [addressesResponse?.addresses, activeScope, favoriteIds, recentIds]);

  // Pagination info
  const pagination: PaginationInfo | undefined = useMemo(() => {
    if (!addressesResponse?.pagination) return undefined;
    return addressesResponse.pagination;
  }, [addressesResponse?.pagination]);

  // Handle address assignment (delegates to state machine)
  const handleAssign = useCallback(
    (address: Address) => {
      assignAddress(address);
    },
    [assignAddress],
  );

  const handleCreateNew = useCallback(() => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      setIsAddressModalOpen(true);
    }
  }, [onCreateNew]);

  const isLoading = externalLoading || isLoadingAddresses || isLoadingFavorites || isLoadingRecents;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Route Bar */}
      <RouteBar
        pickup={pickup}
        delivery={delivery}
        activeSlot={activeSlot}
        onEditSlot={editSlot}
        onClearSlot={clearSlot}
      />

      {/* Address Library */}
      <Library
        addresses={filteredAddresses}
        activeSlot={activeSlot}
        onAssign={handleAssign}
        onFavoriteToggle={handleFavoriteToggle}
        favoriteIds={favoriteIds}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeScope={activeScope}
        onScopeChange={setActiveScope}
        onCreateNew={handleCreateNew}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={setCurrentPage}
      />

      {/* Address Modal (fallback if onCreateNew not provided) */}
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
