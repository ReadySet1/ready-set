/**
 * AddressSelector Components
 *
 * A modern, unified address management system with search, favorites, and recent addresses.
 *
 * @module AddressSelector
 */

// Main component
export { AddressSelector } from './AddressSelector';

// Sub-components
export { AddressSearchCombobox } from './AddressSearchCombobox';
export { AddressCompactCard } from './AddressCompactCard';
export { AddressSectionList, AddressEmptyState } from './AddressSectionList';
export { AddressQuickFilters, AddressSectionHeader } from './AddressQuickFilters';

// Re-export hooks for convenience
export { useAddressSearch } from '@/hooks/useAddressSearch';
export { useAddressFavorites } from '@/hooks/useAddressFavorites';
export { useAddressRecents } from '@/hooks/useAddressRecents';

// Re-export types for convenience
export type {
  AddressSelectorProps,
  AddressSection,
  AddressSearchFilters,
  AddressWithMetadata,
  AddressSearchComboboxProps,
  AddressCompactCardProps,
  AddressSectionListProps,
  AddressQuickFiltersProps,
  AddressFavorite,
  AddressUsageHistory,
} from '@/types/address-selector';
