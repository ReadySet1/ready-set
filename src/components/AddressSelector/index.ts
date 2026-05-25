/**
 * AddressSelector Components
 *
 * A modern, unified address management system with search, favorites, and recent addresses.
 *
 * @module AddressSelector
 */

// Main component (unified entry point — detects new vs legacy props)
export { AddressSelector } from './AddressSelector';

// Route Builder components (new API)
export { RouteBuilder } from './RouteBuilder';
export { RouteBar } from './RouteBar';
export { RouteSlot } from './RouteSlot';
export { Connector } from './Connector';
export { MiniMap } from './MiniMap';
export { Library } from './Library';
export { LibraryToolbar } from './LibraryToolbar';
export { AddressTile } from './AddressTile';
export { useRouteBuilder } from './useRouteBuilder';

// Legacy component
export { AddressSelectorLegacy } from './AddressSelectorLegacy';

// Legacy sub-components
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
  RouteBuilderProps,
  RouteSlotProps,
  ConnectorProps,
  MiniMapProps,
  AddressTileProps,
  LibraryToolbarProps,
  LibraryProps,
  ActiveSlot,
  ScopeFilter,
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
