'use client';

import { MapPin, Pencil, X } from 'lucide-react';
import type { RouteSlotProps } from '@/types/address-selector';
import { cn } from '@/lib/utils';

const roleConfig = {
  pickup: {
    label: 'Pickup',
    emptyText: 'No pickup selected',
    activeText: 'Choose below',
    bg: 'bg-green-50',
    border: 'border-green-200',
    activeBorder: 'border-green-400',
    text: 'text-green-700',
    ring: 'ring-green-300',
    icon: 'text-green-500',
  },
  delivery: {
    label: 'Delivery',
    emptyText: 'No delivery selected',
    activeText: 'Choose below',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    activeBorder: 'border-blue-400',
    text: 'text-blue-700',
    ring: 'ring-blue-300',
    icon: 'text-blue-500',
  },
} as const;

export function RouteSlot({ role, address, isActive, onEdit, onClear }: RouteSlotProps) {
  const config = roleConfig[role];

  // Empty + inactive
  if (!address && !isActive) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          'w-full min-w-0 rounded-lg border-2 border-dashed p-2.5 sm:p-3 text-left transition-colors min-h-[48px]',
          'border-slate-200 hover:border-slate-300',
        )}
        aria-label={`Select ${config.label.toLowerCase()} address`}
      >
        <div className="flex items-center gap-2.5">
          <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
          <div>
            <p className="text-xs sm:text-sm font-medium text-slate-400">{config.label}</p>
            <p className="text-[11px] sm:text-xs text-slate-400">{config.emptyText}</p>
          </div>
        </div>
      </button>
    );
  }

  // Empty + active
  if (!address && isActive) {
    return (
      <div
        className={cn(
          'w-full min-w-0 rounded-lg border-2 border-dashed p-2.5 sm:p-3 min-h-[48px]',
          config.activeBorder, config.bg,
          'animate-pulse',
        )}
        aria-current="location"
      >
        <div className="flex items-center gap-2.5">
          <MapPin className={cn('h-4 w-4 shrink-0', config.icon)} />
          <div>
            <p className={cn('text-xs sm:text-sm font-medium', config.text)}>{config.label}</p>
            <span className={cn(
              'inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-medium',
              config.bg, config.text,
            )}>
              {config.activeText}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Filled
  return (
    <div
      className={cn(
        'w-full min-w-0 rounded-lg border p-2.5 sm:p-3 transition-colors min-h-[48px]',
        isActive
          ? cn(config.activeBorder, config.bg, 'ring-2', config.ring)
          : cn(config.border, config.bg),
      )}
      aria-current={isActive ? 'location' : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <MapPin className={cn('mt-0.5 h-4 w-4 shrink-0', config.icon)} />
          <div className="min-w-0">
            <p className={cn('text-xs sm:text-sm font-medium', config.text)}>{config.label}</p>
            <p className="truncate text-xs sm:text-sm font-medium text-slate-900">
              {address!.name || address!.street1}
            </p>
            <p className="truncate text-[10px] sm:text-[11px] text-slate-500">
              {address!.name ? address!.street1 + ', ' : ''}
              {address!.city}, {address!.state} {address!.zip}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button
            type="button"
            onClick={onEdit}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={`Edit ${config.label.toLowerCase()} address`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={`Clear ${config.label.toLowerCase()} address`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
