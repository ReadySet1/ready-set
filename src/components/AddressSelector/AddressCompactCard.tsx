'use client';

import * as React from 'react';
import { MapPin, Star, Edit2, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { AddressCompactCardProps } from '@/types/address-selector';

/**
 * AddressCompactCard Component
 *
 * Ultra-compact card for address selection in dense lists.
 * Optimized for small screens with minimal vertical space.
 */
export function AddressCompactCard({
  address,
  onSelect,
  isSelected,
  variant = 'default',
  showActions = true,
  onFavoriteToggle,
  onEdit,
}: AddressCompactCardProps) {
  const formatShortAddress = (): string => {
    const parts = [address.street1, address.city, address.state, address.zip];
    return parts.filter(Boolean).join(', ');
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFavoriteToggle?.();
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  const cardClasses = cn(
    'cursor-pointer transition-all duration-150 hover:bg-slate-50',
    'touch-manipulation border',
    isSelected && 'border-primary bg-primary/5 ring-1 ring-primary/20',
    !isSelected && 'border-slate-200 hover:border-slate-300'
  );

  // Build tooltip content with full details
  const tooltipContent = [
    address.name,
    address.street1,
    address.street2,
    `${address.city}, ${address.state} ${address.zip}`,
    address.locationNumber && `Location #${address.locationNumber}`,
    address.parkingLoading && `Parking: ${address.parkingLoading}`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={cardClasses}
            onClick={onSelect}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }}
            aria-label={`Select address: ${address.name || formatShortAddress()}`}
            aria-pressed={isSelected}
          >
            <CardContent className="p-2">
              <div className="flex items-center gap-2">
                {/* Icon */}
                <MapPin className="h-3 w-3 shrink-0 text-slate-400" />

                {/* Main Content - Single line with overflow */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  {/* Name (truncated) */}
                  {address.name && (
                    <span className="font-medium text-[11px] text-slate-700 truncate max-w-[120px]">
                      {address.name}
                    </span>
                  )}

                  {/* Badges - Inline, tiny */}
                  <div className="flex items-center gap-1 shrink-0">
                    {address.isShared && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 h-4 font-normal"
                      >
                        Shared
                      </Badge>
                    )}
                    {address.isRestaurant && (
                      <Badge
                        variant="default"
                        className="text-[9px] px-1 py-0 h-4 font-normal bg-green-600"
                      >
                        Restaurant
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Favorite Action */}
                {showActions && onFavoriteToggle && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={handleFavoriteClick}
                    aria-label={
                      address.isFavorite
                        ? 'Remove from favorites'
                        : 'Add to favorites'
                    }
                  >
                    <Star
                      className={cn(
                        'h-3.5 w-3.5',
                        address.isFavorite
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-slate-300 hover:text-slate-400'
                      )}
                    />
                  </Button>
                )}

                {/* Edit Action */}
                {showActions && onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={handleEditClick}
                    aria-label="Edit address"
                  >
                    <Edit2 className="h-3 w-3 text-slate-300 hover:text-slate-400" />
                  </Button>
                )}
              </div>

              {/* Second Row: Address + Location */}
              <div className="mt-1 ml-5 flex items-center gap-2">
                <span className="text-[10px] text-slate-500 truncate flex-1">
                  {formatShortAddress()}
                </span>
                {address.locationNumber && (
                  <span className="text-[9px] text-slate-400 flex items-center gap-0.5 shrink-0">
                    <Phone className="h-2.5 w-2.5" />#{address.locationNumber}
                  </span>
                )}
                {address.county && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 h-4 font-normal text-slate-400 border-slate-200"
                  >
                    {address.county}
                  </Badge>
                )}
              </div>

              {/* Selected Indicator - Inline */}
              {isSelected && (
                <div className="mt-1 ml-5">
                  <span className="text-[10px] font-medium text-primary">
                    ✓ Selected
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <pre className="text-xs whitespace-pre-wrap">{tooltipContent}</pre>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
