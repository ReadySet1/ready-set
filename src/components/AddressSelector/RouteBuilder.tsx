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

type RouteSlotRole = 'pickup' | 'delivery';

interface AddressEditTarget {
  slot: RouteSlotRole;
  address: Address;
  /** The user created this address, so the saved record itself is corrected. */
  ownedByUser: boolean;
}

const OWNED_EDIT_NOTICE =
  'This updates your saved address everywhere it is used.';
const COPY_EDIT_NOTICE =
  'This address belongs to someone else, so your corrections will be saved as a new private address for this order. The original stays unchanged.';

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
  const [editTarget, setEditTarget] = useState<AddressEditTarget | null>(null);
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

  // In-place correction of the address already in a slot. Only the creator may
  // change the saved record (same rule as the address book); anything else is
  // edited as a private copy so shared/other users' addresses are never mutated.
  const handleEditAddress = useCallback(
    (slot: RouteSlotRole) => {
      const address = slot === 'pickup' ? pickup : delivery;
      if (!address) return;
      const ownedByUser = Boolean(user?.id) && address.createdBy === user?.id;
      setEditTarget({ slot, address, ownedByUser });
    },
    [pickup, delivery, user?.id],
  );

  const handleAddressEdited = useCallback(
    (savedAddress?: Address) => {
      const target = editTarget;
      setEditTarget(null);
      if (target && savedAddress) {
        onChange({
          pickup: target.slot === 'pickup' ? savedAddress : pickup,
          delivery: target.slot === 'delivery' ? savedAddress : delivery,
        });
      }
      refetchAddresses();
    },
    [editTarget, onChange, pickup, delivery, refetchAddresses],
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
        onEditAddress={handleEditAddress}
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

      {/* In-place editor for the address already selected in a slot */}
      {editTarget && (
        <AddressModal
          isOpen
          onClose={() => setEditTarget(null)}
          addressToEdit={editTarget.ownedByUser ? editTarget.address : null}
          initialValues={editTarget.ownedByUser ? undefined : editTarget.address}
          notice={editTarget.ownedByUser ? OWNED_EDIT_NOTICE : COPY_EDIT_NOTICE}
          onAddressUpdated={handleAddressEdited}
        />
      )}
    </div>
  );
}
