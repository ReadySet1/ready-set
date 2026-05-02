'use client';

import React from 'react';
import { Navigation, Phone } from 'lucide-react';
import { getNavigationUrl, getPhoneCallUrl } from '@/lib/utils/platform';

interface ActionPillsProps {
  destinationLat?: number | null;
  destinationLng?: number | null;
  destinationLabel?: string;
  phoneNumber?: string | null;
}

/**
 * Navigate + Call pill buttons for quick driver actions.
 * Gracefully hides when data is unavailable.
 */
export function ActionPills({
  destinationLat,
  destinationLng,
  destinationLabel,
  phoneNumber,
}: ActionPillsProps) {
  const hasCoords = destinationLat != null && destinationLng != null;
  const hasPhone = !!phoneNumber;

  if (!hasCoords && !hasPhone) return null;

  return (
    <div className="flex gap-3">
      {hasCoords && (
        <a
          href={getNavigationUrl(destinationLat!, destinationLng!, destinationLabel)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-11 rounded-full border border-gray-300 bg-white
                     flex items-center justify-center gap-2
                     text-sm font-medium text-gray-700
                     active:bg-gray-100 transition-colors"
        >
          <Navigation className="h-4 w-4" />
          Navigate
        </a>
      )}
      {hasPhone && (
        <a
          href={getPhoneCallUrl(phoneNumber!)}
          className="flex-1 h-11 rounded-full border border-gray-300 bg-white
                     flex items-center justify-center gap-2
                     text-sm font-medium text-gray-700
                     active:bg-gray-100 transition-colors"
        >
          <Phone className="h-4 w-4" />
          Call
        </a>
      )}
    </div>
  );
}
