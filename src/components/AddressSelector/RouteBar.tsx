'use client';

import type { Address } from '@/types/address';
import type { ActiveSlot } from '@/types/address-selector';
import { RouteSlot } from './RouteSlot';
import { Connector } from './Connector';
import { MiniMap } from './MiniMap';
import { cn } from '@/lib/utils';

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
  const pickupCoords =
    pickup?.latitude != null && pickup?.longitude != null
      ? { lat: pickup.latitude, lng: pickup.longitude }
      : null;

  const deliveryCoords =
    delivery?.latitude != null && delivery?.longitude != null
      ? { lat: delivery.latitude, lng: delivery.longitude }
      : null;

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-3 sm:p-4', className)}>
      {/* Desktop (lg+): horizontal 4-col layout */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr_200px] lg:items-center lg:gap-3">
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
        <div className="h-[80px]">
          <MiniMap pickup={pickupCoords} delivery={deliveryCoords} />
        </div>
      </div>

      {/* Tablet (md to lg): 3 cols + map below */}
      <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-3 lg:hidden">
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
        <div className="col-span-3 mt-2 h-[80px]">
          <MiniMap pickup={pickupCoords} delivery={deliveryCoords} />
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
        <div className="mt-1 h-[60px]">
          <MiniMap pickup={pickupCoords} delivery={deliveryCoords} />
        </div>
      </div>
    </div>
  );
}
