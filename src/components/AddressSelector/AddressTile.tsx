'use client';

import { Star, UtensilsCrossed, Building2 } from 'lucide-react';
import type { AddressTileProps } from '@/types/address-selector';
import { cn } from '@/lib/utils';

const slotColors = {
  pickup: {
    border: 'border-green-200 hover:border-green-300',
    bg: 'hover:bg-green-50/50',
  },
  delivery: {
    border: 'border-blue-200 hover:border-blue-300',
    bg: 'hover:bg-blue-50/50',
  },
} as const;

export function AddressTile({
  address,
  activeSlot,
  onAssign,
  onFavoriteToggle,
  isFavorite = false,
}: AddressTileProps) {
  const TypeIcon = address.isRestaurant ? UtensilsCrossed : Building2;
  const slotStyle = activeSlot ? slotColors[activeSlot] : { border: 'border-slate-200 hover:border-slate-300', bg: 'hover:bg-slate-50' };

  const assignLabel = activeSlot
    ? `Assign ${address.name || address.street1}, ${address.city}, as ${activeSlot}`
    : `${address.name || address.street1}, ${address.city}`;

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'group relative flex min-h-[52px] cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors',
        slotStyle.border,
        slotStyle.bg,
        !activeSlot && 'opacity-60 cursor-default',
      )}
      onClick={() => activeSlot && onAssign(address)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && activeSlot) {
          e.preventDefault();
          onAssign(address);
        }
      }}
      aria-label={assignLabel}
      aria-disabled={!activeSlot}
    >
      {/* Type icon */}
      <TypeIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-slate-800">
            {address.name || address.street1}
          </p>
          <span className="shrink-0 text-[10px] sm:text-[11px] text-slate-400">
            {address.isShared ? 'Shared' : 'Private'}
          </span>
        </div>
        <p className="truncate text-xs text-slate-500">
          {address.name ? address.street1 + ', ' : ''}
          {address.city}, {address.state} {address.zip}
        </p>
      </div>

      {/* Favorite star */}
      {onFavoriteToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle(address.id);
          }}
          className={cn(
            'shrink-0 rounded p-1.5 transition-colors',
            isFavorite
              ? 'text-yellow-500 hover:text-yellow-600'
              : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-yellow-500',
          )}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star className={cn('h-4 w-4', isFavorite && 'fill-current')} />
        </button>
      )}
    </div>
  );
}
