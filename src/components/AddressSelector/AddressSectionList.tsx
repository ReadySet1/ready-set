'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// Virtualization commented out temporarily due to react-window v2 API changes
// Will be re-enabled once the API is properly typed
// import { List } from 'react-window';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressCompactCard } from './AddressCompactCard';
import type { AddressSectionListProps } from '@/types/address-selector';
import type { Address } from '@/types/address';

// Virtualization temporarily disabled - will be re-enabled with proper react-window v2 integration
// Threshold for when to use virtualization (addresses per section)
const VIRTUALIZATION_THRESHOLD = 999999; // Effectively disabled
// Height of each address card in pixels
const ITEM_HEIGHT = 100;
// Max height for virtualized list (shows ~6 items)
const MAX_LIST_HEIGHT = 600;

/**
 * AddressSectionList Component
 *
 * Displays addresses grouped by sections (favorites, recents, all) with:
 * - Collapsible sections
 * - Section counts in headers
 * - Smooth animations
 * - Loading skeletons
 * - Empty states
 * - Virtualization for large lists (20+ addresses)
 */
export function AddressSectionList({
  sections,
  onAddressSelect,
  selectedAddressId,
  isLoading = false,
  emptyState,
  onFavoriteToggle,
  favoriteIds = [],
}: AddressSectionListProps) {
  const [collapsedSections, setCollapsedSections] = React.useState<Set<string>>(
    new Set()
  );

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const isSectionCollapsed = (sectionId: string): boolean => {
    return collapsedSections.has(sectionId);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        {emptyState || (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No addresses available</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const isCollapsed = isSectionCollapsed(section.id);
        const hasAddresses = section.addresses.length > 0;
        const Icon = section.icon;

        return (
          <div key={section.id} className="space-y-3">
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                className="h-auto p-0 hover:bg-transparent"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{section.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    ({section.addresses.length})
                  </span>
                </div>
                {hasAddresses && (
                  <div className="ml-2">
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                )}
              </Button>
            </div>

            {/* Section Content */}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  {hasAddresses ? (
                    // Regular rendering (virtualization temporarily disabled)
                    <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                      {section.addresses.map((address) => {
                        // Ensure address has isFavorite property
                        const addressWithFavorite = {
                          ...address,
                          isFavorite: favoriteIds.includes(address.id),
                        };

                        return (
                          <AddressCompactCard
                            key={address.id}
                            address={addressWithFavorite}
                            onSelect={() => onAddressSelect(address)}
                            isSelected={selectedAddressId === address.id}
                            variant="compact"
                            showActions={true}
                            onFavoriteToggle={
                              onFavoriteToggle
                                ? () => onFavoriteToggle(address.id)
                                : undefined
                            }
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex min-h-[100px] items-center justify-center rounded-lg border border-dashed">
                      <p className="text-sm text-muted-foreground">
                        {section.emptyMessage}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/**
 * AddressEmptyState Component
 *
 * A reusable empty state component for when no addresses match filters
 */
export function AddressEmptyState({
  title = 'No addresses found',
  description = 'Try adjusting your search or filters',
  icon: Icon,
  action,
}: {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center space-y-4 text-center">
      {Icon && <Icon className="h-12 w-12 text-muted-foreground/50" />}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
