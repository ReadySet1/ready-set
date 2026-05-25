'use client';

import { useMemo } from 'react';
import type { LibraryProps } from '@/types/address-selector';
import { LibraryToolbar } from './LibraryToolbar';
import { AddressTile } from './AddressTile';
import { MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Library({
  addresses,
  activeSlot,
  onAssign,
  onFavoriteToggle,
  favoriteIds,
  searchQuery,
  onSearchChange,
  activeScope,
  onScopeChange,
  onCreateNew,
  isLoading = false,
  pagination,
  onPageChange,
}: LibraryProps) {
  // Group addresses by city
  const groups = useMemo(() => {
    const map = new Map<string, typeof addresses>();
    for (const addr of addresses) {
      const key = addr.city || 'Other';
      const existing = map.get(key);
      if (existing) {
        existing.push(addr);
      } else {
        map.set(key, [addr]);
      }
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === 'Other') return 1;
      if (b[0] === 'Other') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [addresses]);

  return (
    <div className="space-y-3">
      <LibraryToolbar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        activeScope={activeScope}
        onScopeChange={onScopeChange}
        onCreateNew={onCreateNew}
      />

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[52px] animate-pulse rounded-lg border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && addresses.length === 0 && (
        <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
          <div className="text-center px-4">
            <MapPin className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-1.5 text-sm text-slate-500">
              {searchQuery ? 'No addresses match your search' : 'No addresses available'}
            </p>
          </div>
        </div>
      )}

      {/* Grouped address tiles */}
      {!isLoading && groups.length > 0 && (
        <div className="max-h-[480px] space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent pr-0.5">
          {groups.map(([city, cityAddresses]) => (
            <div key={city}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {city}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {cityAddresses.map((address) => (
                  <AddressTile
                    key={address.id}
                    address={address}
                    activeSlot={activeSlot}
                    onAssign={onAssign}
                    onFavoriteToggle={onFavoriteToggle}
                    isFavorite={favoriteIds.includes(address.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
          <p className="text-xs text-slate-400">
            Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} addresses)
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onPageChange(pagination.currentPage - 1)}
              disabled={!pagination.hasPrevPage}
              className={cn(
                'rounded p-1.5 transition-colors',
                pagination.hasPrevPage
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-slate-300 cursor-not-allowed',
              )}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(pagination.currentPage + 1)}
              disabled={!pagination.hasNextPage}
              className={cn(
                'rounded p-1.5 transition-colors',
                pagination.hasNextPage
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-slate-300 cursor-not-allowed',
              )}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
