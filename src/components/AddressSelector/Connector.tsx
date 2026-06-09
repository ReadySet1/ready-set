'use client';

import type { ConnectorProps } from '@/types/address-selector';

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): { miles: number; minutes: number } {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const miles = R * c;
  const minutes = Math.round((miles / 30) * 60);
  return { miles: Math.round(miles * 10) / 10, minutes };
}

export function Connector({ pickup, delivery }: ConnectorProps) {
  const hasCoords =
    pickup?.latitude != null &&
    pickup?.longitude != null &&
    delivery?.latitude != null &&
    delivery?.longitude != null;

  const distance = hasCoords
    ? haversineDistance(
        pickup!.latitude!,
        pickup!.longitude!,
        delivery!.latitude!,
        delivery!.longitude!,
      )
    : null;

  return (
    <div className="flex items-center justify-center">
      {/* Desktop/tablet: horizontal arrow */}
      <div className="hidden md:flex items-center gap-2">
        <svg
          width="48"
          height="16"
          viewBox="0 0 48 16"
          fill="none"
          className="text-slate-300"
        >
          <line
            x1="0"
            y1="8"
            x2="40"
            y2="8"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <path
            d="M38 3L44 8L38 13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {distance && (
          <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            ~{distance.miles} mi &middot; {distance.minutes} min
          </span>
        )}
      </div>

      {/* Mobile: thin horizontal divider with down-arrow */}
      <div className="flex md:hidden items-center gap-2 py-0.5">
        <svg
          width="16"
          height="20"
          viewBox="0 0 16 20"
          fill="none"
          className="text-slate-300"
        >
          <line
            x1="8"
            y1="0"
            x2="8"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
          <path
            d="M4 12L8 18L12 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {distance && (
          <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            ~{distance.miles} mi
          </span>
        )}
      </div>
    </div>
  );
}
