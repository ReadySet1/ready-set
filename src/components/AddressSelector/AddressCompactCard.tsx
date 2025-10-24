'use client';

import * as React from 'react';
import { MapPin, Star, Edit2, Phone, ParkingSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AddressCompactCardProps } from '@/types/address-selector';

/**
 * AddressCompactCard Component
 *
 * A modern, compact card for displaying address information with:
 * - Visual hierarchy for important information
 * - Favorite toggle
 * - Edit action
 * - Shared/Private badge
 * - Parking information
 * - Click to select functionality
 *
 * Visual design:
 * ┌─────────────────────────────────────────┐
 * │ 🏪 Restaurant Name          ⭐ [Select] │
 * │ 123 Main St, City, ST 12345             │
 * │ 📞 Location #123  🅿️ Parking available  │
 * └─────────────────────────────────────────┘
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
  const formatFullAddress = (): string => {
    const parts = [
      address.street1,
      address.street2,
      address.city,
      address.state,
      address.zip,
    ];
    return parts.filter(Boolean).join(', ');
  };

  const formatMetadata = (): React.ReactNode[] => {
    const metadata: React.ReactNode[] = [];

    if (address.locationNumber) {
      metadata.push(
        <span key="location" className="flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" />
          Location #{address.locationNumber}
        </span>
      );
    }

    if (address.parkingLoading) {
      metadata.push(
        <span key="parking" className="flex items-center gap-1 text-xs text-muted-foreground">
          <ParkingSquare className="h-3 w-3" />
          {address.parkingLoading}
        </span>
      );
    }

    return metadata;
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
    'cursor-pointer transition-all duration-200 hover:shadow-md',
    'touch-manipulation', // Improve touch responsiveness
    isSelected && 'border-2 border-primary shadow-md',
    variant === 'compact' && 'p-3',
    variant === 'minimal' && 'p-2'
  );

  return (
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
      aria-label={`Select address: ${address.name || formatFullAddress()}`}
      aria-pressed={isSelected}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          {/* Main Content */}
          <div className="flex flex-1 flex-col gap-1.5 sm:gap-2 min-w-0">
            {/* Header Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground" />
                {address.name && (
                  <span className="font-semibold text-xs sm:text-sm truncate">
                    {address.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {address.isShared ? (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                    Shared
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                    Private
                  </Badge>
                )}
                {address.isRestaurant && (
                  <Badge variant="default" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                    Restaurant
                  </Badge>
                )}
              </div>
            </div>

            {/* Address Text */}
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              {formatFullAddress()}
            </p>

            {/* Metadata Row */}
            {formatMetadata().length > 0 && (
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {formatMetadata()}
              </div>
            )}

            {/* County Badge */}
            {address.county && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                  {address.county}
                </Badge>
              </div>
            )}
          </div>

          {/* Actions - Touch-friendly sizing on mobile */}
          {showActions && (
            <div className="flex flex-col gap-1 shrink-0">
              {onFavoriteToggle && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 sm:h-8 sm:w-8 p-0" // Larger touch target on mobile
                  onClick={handleFavoriteClick}
                  aria-label={address.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star
                    className={cn(
                      'h-5 w-5 sm:h-4 sm:w-4',
                      address.isFavorite
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground'
                    )}
                  />
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 sm:h-8 sm:w-8 p-0" // Larger touch target on mobile
                  onClick={handleEditClick}
                  aria-label="Edit address"
                >
                  <Edit2 className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Selected Indicator */}
        {isSelected && (
          <div className="mt-3 pt-2.5 border-t border-primary/20">
            <span className="text-xs font-semibold text-primary flex items-center gap-1">
              ✓ Selected
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
