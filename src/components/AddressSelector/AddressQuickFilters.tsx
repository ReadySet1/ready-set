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
    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Address filters">
      <span className="text-[10px] font-medium text-slate-400">Filter:</span>
      {filters.map((filter) => {
        const isActive = activeFilter === filter.value;
        return (
          <Button
            key={filter.value}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange(filter.value)}
            className={cn(
              'h-6 rounded-full px-2 transition-all',
              'touch-manipulation',
              isActive && 'shadow-sm'
            )}
            aria-pressed={isActive}
            aria-label={`Filter by ${filter.label} addresses. ${filter.count} addresses.`}
          >
            <span className="flex items-center gap-1">
              <span className="text-[10px]">{filter.label}</span>
              <Badge
                variant={isActive ? 'secondary' : 'outline'}
                className="h-4 min-w-[1rem] rounded-full px-1 text-[9px]"
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
