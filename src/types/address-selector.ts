// src/types/address-selector.ts

import type { Address, AddressFilter } from './address';
import type { ComponentType } from 'react';

/**
 * Props for the main AddressSelector component
 */
export interface AddressSelectorProps {
  mode: 'client' | 'admin';
  type?: 'pickup' | 'delivery';
  onSelect: (address: Address) => void;
  selectedAddressId?: string;
  showFavorites?: boolean;
  showRecents?: boolean;
  allowAddNew?: boolean;
  className?: string;
}

/**
 * Grouped addresses by section (favorites, recents, all)
 */
export interface AddressSection {
  id: 'favorites' | 'recents' | 'all';
  title: string;
  icon: ComponentType<{ className?: string }>;
  addresses: AddressWithMetadata[];
  count: number;
  emptyMessage: string;
}

/**
 * Search and filter state for address selection
 */
export interface AddressSearchFilters {
  query: string;
  filter: AddressFilter; // 'all' | 'shared' | 'private'
  city?: string;
  county?: string;
}

/**
 * Address with additional metadata for favorites and usage tracking
 */
export interface AddressWithMetadata extends Address {
  isFavorite?: boolean;
  lastUsedAt?: Date;
  usageCount?: number;
  distance?: number; // For future geo-sorting
}

/**
 * Props for AddressSearchCombobox component
 */
export interface AddressSearchComboboxProps {
  addresses: Address[];
  onSelect: (address: Address) => void;
  selectedAddressId?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Props for AddressCompactCard component
 */
export interface AddressCompactCardProps {
  address: AddressWithMetadata;
  onSelect: () => void;
  isSelected: boolean;
  variant?: 'default' | 'compact' | 'minimal';
  showActions?: boolean;
  onFavoriteToggle?: () => void;
  onEdit?: () => void;
}

/**
 * Props for AddressSectionList component
 */
export interface AddressSectionListProps {
  sections: AddressSection[];
  onAddressSelect: (address: Address) => void;
  selectedAddressId?: string;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  onFavoriteToggle?: (addressId: string) => void;
  favoriteIds?: string[];
}

/**
 * Props for AddressQuickFilters component
 */
export interface AddressQuickFiltersProps {
  activeFilter: AddressFilter;
  onFilterChange: (filter: AddressFilter) => void;
  counts: {
    all: number;
    shared: number;
    private: number;
  };
}

/**
 * Address favorite entity from database
 */
export interface AddressFavorite {
  id: string;
  userId: string;
  addressId: string;
  createdAt: Date;
}

/**
 * Address usage history entry from database
 */
export interface AddressUsageHistory {
  id: string;
  userId: string;
  addressId: string;
  usedAt: Date;
  context: 'pickup' | 'delivery' | 'order';
}
