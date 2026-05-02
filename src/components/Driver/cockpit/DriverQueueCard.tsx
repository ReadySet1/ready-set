'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTimeForDisplay } from '@/lib/utils/date-display';
import { getStatusLabel } from '@/lib/delivery-status-transitions';
import { encodeOrderNumber } from '@/utils/order/urlEncoding';
import type { CockpitDelivery, QueueSection } from '@/types/driver-cockpit';

interface DriverQueueCardProps {
  delivery: CockpitDelivery;
  section: QueueSection;
}

const ACCENT_COLORS: Record<QueueSection, string> = {
  now: 'border-l-brand',
  up_next: 'border-l-gray-300',
  done_today: 'border-l-green-500',
};

const STATUS_BADGE_COLORS: Record<QueueSection, string> = {
  now: 'bg-brand/20 text-amber-800',
  up_next: 'bg-gray-100 text-gray-600',
  done_today: 'bg-green-100 text-green-800',
};

/**
 * Queue list card for the driver landing page.
 * Entire card is a link to the cockpit detail view.
 */
export function DriverQueueCard({ delivery, section }: DriverQueueCardProps) {
  const statusLabel = getStatusLabel(delivery.driverStatus);
  const pickupTime = formatTimeForDisplay(delivery.pickupDateTime);
  const pickupAddress = [
    delivery.address?.street1,
    delivery.address?.city,
  ].filter(Boolean).join(', ');

  return (
    <Link
      href={`/driver/deliveries/${encodeOrderNumber(delivery.orderNumber)}`}
      className="block"
    >
      <div
        className={cn(
          'bg-white rounded-xl border border-l-4 p-4 active:bg-gray-50 transition-colors',
          ACCENT_COLORS[section],
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Vendor / pickup name */}
            <p className="font-semibold text-gray-900 text-sm truncate">
              {delivery.address?.street1 || 'Pickup Location'}
            </p>

            {/* Address */}
            {pickupAddress && (
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{pickupAddress}</span>
              </div>
            )}

            {/* Time */}
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>{pickupTime}</span>
              <span className="text-gray-300 mx-1">|</span>
              <span className="capitalize">{delivery.delivery_type.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Status badge */}
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
              STATUS_BADGE_COLORS[section],
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
