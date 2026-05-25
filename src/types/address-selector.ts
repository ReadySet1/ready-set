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
  addressTypeFilter?: 'restaurant' | 'private' | 'all';
  defaultCollapsed?: boolean;
  showAllAddressesSection?: boolean;
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
 * Pagination info from API response
 */
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
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
  defaultCollapsed?: boolean;
  /** Pagination info for the "all" section */
  pagination?: PaginationInfo;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
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

/**
 * Active slot in the route builder state machine
 */
export type ActiveSlot = 'pickup' | 'delivery' | null;

/**
 * Scope filter for the address library
 */
export type ScopeFilter = 'recent' | 'favorites' | 'all' | 'mine';

/**
 * Props for the RouteBuilder component
 */
export interface RouteBuilderProps {
  pickup: Address | null;
  delivery: Address | null;
  onChange: (value: { pickup: Address | null; delivery: Address | null }) => void;
  onCreateNew?: () => void;
  mode?: 'client' | 'admin';
  className?: string;
  isLoading?: boolean;
}

/**
 * Props for the RouteSlot component
 */
export interface RouteSlotProps {
  role: 'pickup' | 'delivery';
  address: Address | null;
  isActive: boolean;
  onEdit: () => void;
  onClear: () => void;
}

/**
 * Props for the Connector component
 */
export interface ConnectorProps {
  pickup: Address | null;
  delivery: Address | null;
}

/**
 * Props for the MiniMap component
 */
export interface MiniMapProps {
  pickup: { lat: number; lng: number } | null;
  delivery: { lat: number; lng: number } | null;
}

/**
 * Props for the AddressTile component
 */
export interface AddressTileProps {
  address: AddressWithMetadata;
  activeSlot: ActiveSlot;
  onAssign: (address: Address) => void;
  onFavoriteToggle?: (addressId: string) => void;
  isFavorite?: boolean;
}

/**
 * Props for the LibraryToolbar component
 */
export interface LibraryToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeScope: ScopeFilter;
  onScopeChange: (scope: ScopeFilter) => void;
  onCreateNew: () => void;
}

/**
 * Props for the Library component
 */
export interface LibraryProps {
  addresses: AddressWithMetadata[];
  activeSlot: ActiveSlot;
  onAssign: (address: Address) => void;
  onFavoriteToggle: (addressId: string) => void;
  favoriteIds: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeScope: ScopeFilter;
  onScopeChange: (scope: ScopeFilter) => void;
  onCreateNew: () => void;
  isLoading?: boolean;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
}
