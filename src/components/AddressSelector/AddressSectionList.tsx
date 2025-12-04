'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// Virtualization commented out temporarily due to react-window v2 API changes
// Will be re-enabled once the API is properly typed
// import { List } from 'react-window';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressCompactCard } from './AddressCompactCard';
import type { AddressSectionListProps, PaginationInfo } from '@/types/address-selector';
import type { Address } from '@/types/address';

// Max height for address list
const MAX_LIST_HEIGHT = 400;

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
  defaultCollapsed = false,
  pagination,
  onPageChange,
}: AddressSectionListProps) {
  // Initialize collapsed sections - "all" is collapsed by default unless there are few addresses
  const [collapsedSections, setCollapsedSections] = React.useState<Set<string>>(() => {
    if (defaultCollapsed) {
      // If defaultCollapsed is true, collapse all sections initially
      return new Set(sections.map((s) => s.id));
    }
    // By default, collapse "all" section if there are many addresses (pagination present)
    if (pagination && pagination.totalCount > 20) {
      return new Set(['all']);
    }
    return new Set();
  });

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
    <div className="space-y-3">
      {sections.map((section) => {
        const isCollapsed = isSectionCollapsed(section.id);
        const hasAddresses = section.addresses.length > 0;
        const Icon = section.icon;

        return (
          <div key={section.id} className="space-y-1.5">
            {/* Section Header - Compact */}
            <Button
              variant="ghost"
              className="h-auto px-1 py-0.5 hover:bg-slate-100 w-full justify-start"
              onClick={() => toggleSection(section.id)}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-slate-400" />
                <span className="text-xs font-medium text-slate-600">{section.title}</span>
                <span className="text-[10px] text-slate-400">
                  ({section.id === 'all' && pagination ? pagination.totalCount : section.addresses.length})
                </span>
              </div>
              {hasAddresses && (
                <div className="ml-auto">
                  {isCollapsed ? (
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  ) : (
                    <ChevronUp className="h-3 w-3 text-slate-400" />
                  )}
                </div>
              )}
            </Button>

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
                    <div className="space-y-2">
                      {/* Address list with max height */}
                      <div
                        className="space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
                        style={{ maxHeight: `${MAX_LIST_HEIGHT}px` }}
                      >
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

                      {/* Pagination controls for "all" section */}
                      {section.id === 'all' && pagination && pagination.totalPages > 1 && onPageChange && (
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPageChange(pagination.currentPage - 1)}
                            disabled={!pagination.hasPrevPage}
                            className="h-7 px-2 text-xs flex items-center gap-0.5 text-slate-600"
                          >
                            <ChevronLeft className="h-3 w-3" />
                            Prev
                          </Button>
                          <span className="text-[10px] text-slate-400">
                            {pagination.currentPage} / {pagination.totalPages}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPageChange(pagination.currentPage + 1)}
                            disabled={!pagination.hasNextPage}
                            className="h-7 px-2 text-xs flex items-center gap-0.5 text-slate-600"
                          >
                            Next
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-12 items-center justify-center rounded border border-dashed border-slate-200">
                      <p className="text-[10px] text-slate-400">
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
