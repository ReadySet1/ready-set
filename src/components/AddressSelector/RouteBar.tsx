'use client';

import { useState, useEffect } from 'react';
import type { Address } from '@/types/address';
import type { ActiveSlot } from '@/types/address-selector';
import { RouteSlot } from './RouteSlot';
import { Connector } from './Connector';
import { MiniMap } from './MiniMap';
import { cn } from '@/lib/utils';

type Coords = { lat: number; lng: number };

/** Build a geocodable string from an Address. */
function toAddressString(addr: Address): string {
  return [addr.street1, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
}

/** Call /api/geocode and return coords, or null on failure. */
async function geocodeAddress(addr: Address): Promise<Coords | null> {
  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: toAddressString(addr) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : null;
  } catch {
    return null;
  }
}

interface RouteBarProps {
  pickup: Address | null;
  delivery: Address | null;
  activeSlot: ActiveSlot;
  onEditSlot: (slot: 'pickup' | 'delivery') => void;
  onClearSlot: (slot: 'pickup' | 'delivery') => void;
  className?: string;
}

export function RouteBar({
  pickup,
  delivery,
  activeSlot,
  onEditSlot,
  onClearSlot,
  className,
}: RouteBarProps) {
  // Direct coords from the address record
  const directPickup: Coords | null =
    pickup?.latitude != null && pickup?.longitude != null
      ? { lat: pickup.latitude, lng: pickup.longitude }
      : null;

  const directDelivery: Coords | null =
    delivery?.latitude != null && delivery?.longitude != null
      ? { lat: delivery.latitude, lng: delivery.longitude }
      : null;

  // Geocoded fallback coords
  const [geocodedPickup, setGeocodedPickup] = useState<Coords | null>(null);
  const [geocodedDelivery, setGeocodedDelivery] = useState<Coords | null>(null);

  // Geocode pickup when it lacks coordinates
  const pickupId = pickup?.id ?? null;
  const pickupHasCoords = directPickup != null;
  useEffect(() => {
    if (!pickup || pickupHasCoords) {
      setGeocodedPickup(null);
      return;
    }
    let cancelled = false;
    geocodeAddress(pickup).then((c) => { if (!cancelled) setGeocodedPickup(c); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupId, pickupHasCoords]);

  // Geocode delivery when it lacks coordinates
  const deliveryId = delivery?.id ?? null;
  const deliveryHasCoords = directDelivery != null;
  useEffect(() => {
    if (!delivery || deliveryHasCoords) {
      setGeocodedDelivery(null);
      return;
    }
    let cancelled = false;
    geocodeAddress(delivery).then((c) => { if (!cancelled) setGeocodedDelivery(c); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryId, deliveryHasCoords]);

  // Use DB coords first, geocoded coords as fallback
  const pickupCoords = directPickup ?? geocodedPickup;
  const deliveryCoords = directDelivery ?? geocodedDelivery;

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-3 sm:p-4', className)}>
      {/* Desktop & Tablet (md+): 3-col row + map below */}
      <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-3">
        <RouteSlot
          role="pickup"
          address={pickup}
          isActive={activeSlot === 'pickup'}
          onEdit={() => onEditSlot('pickup')}
          onClear={() => onClearSlot('pickup')}
        />
        <Connector pickup={pickup} delivery={delivery} />
        <RouteSlot
          role="delivery"
          address={delivery}
          isActive={activeSlot === 'delivery'}
          onEdit={() => onEditSlot('delivery')}
          onClear={() => onClearSlot('delivery')}
        />
        <div className="col-span-3 mt-2 h-[120px]">
          <MiniMap
            pickup={pickupCoords}
            delivery={deliveryCoords}
            pickupLabel={pickup?.name || pickup?.street1}
            deliveryLabel={delivery?.name || delivery?.street1}
          />
        </div>
      </div>

      {/* Mobile (<md): vertical stack */}
      <div className="flex flex-col gap-1 md:hidden">
        <RouteSlot
          role="pickup"
          address={pickup}
          isActive={activeSlot === 'pickup'}
          onEdit={() => onEditSlot('pickup')}
          onClear={() => onClearSlot('pickup')}
        />
        <div className="flex justify-center">
          <Connector pickup={pickup} delivery={delivery} />
        </div>
        <RouteSlot
          role="delivery"
          address={delivery}
          isActive={activeSlot === 'delivery'}
          onEdit={() => onEditSlot('delivery')}
          onClear={() => onClearSlot('delivery')}
        />
        <div className="mt-1 h-[100px]">
          <MiniMap
            pickup={pickupCoords}
            delivery={deliveryCoords}
            pickupLabel={pickup?.name || pickup?.street1}
            deliveryLabel={delivery?.name || delivery?.street1}
          />
        </div>
      </div>
    </div>
  );
}
