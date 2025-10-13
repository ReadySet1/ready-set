'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AddressFilter } from '@/types/address';
import type { AddressQuickFiltersProps } from '@/types/address-selector';

/**
 * AddressQuickFilters Component
 *
 * Pill-style quick filter buttons for address filtering:
 * - All addresses
 * - Shared addresses only
 * - Private addresses only
 *
 * Design: Pill-style buttons with counts
 * [All 155] [Shared 150] [Private 5]
 */
export function AddressQuickFilters({
  activeFilter,
  onFilterChange,
  counts,
}: AddressQuickFiltersProps) {
  const filters: Array<{
    value: AddressFilter;
    label: string;
    count: number;
  }> = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'shared', label: 'Shared', count: counts.shared },
    { value: 'private', label: 'Private', count: counts.private },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Address filters">
      <span className="text-xs sm:text-sm font-medium text-muted-foreground">Filter:</span>
      {filters.map((filter) => {
        const isActive = activeFilter === filter.value;
        return (
          <Button
            key={filter.value}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange(filter.value)}
            className={cn(
              'h-8 sm:h-9 rounded-full px-3 sm:px-4 transition-all',
              'touch-manipulation', // Improve touch responsiveness
              'min-h-[44px] sm:min-h-0', // Touch-friendly minimum height on mobile (WCAG 2.1)
              isActive && 'shadow-sm'
            )}
            aria-pressed={isActive}
            aria-label={`Filter by ${filter.label} addresses. ${filter.count} addresses.`}
          >
            <span className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm">{filter.label}</span>
              <Badge
                variant={isActive ? 'secondary' : 'outline'}
                className="h-4 sm:h-5 min-w-[1.25rem] sm:min-w-[1.5rem] rounded-full px-1 sm:px-1.5 text-[10px] sm:text-xs"
              >
                {filter.count}
              </Badge>
            </span>
          </Button>
        );
      })}
    </div>
  );
}

/**
 * AddressSectionHeader Component
 *
 * A reusable header component for address sections with icon and count
 */
export function AddressSectionHeader({
  title,
  icon: Icon,
  count,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold">{title}</h3>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
