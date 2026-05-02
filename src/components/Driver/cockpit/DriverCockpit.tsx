'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardList, MapPin, Paperclip } from 'lucide-react';
import OrderLocationMap from '@/components/Orders/ui/OrderLocationMap';
import { DriverBottomSheet } from './DriverBottomSheet';
import { DeliveryStepper } from './DeliveryStepper';
import { StatusButton } from './StatusButton';
import { ActionPills } from './ActionPills';
import { getDeliveryLeg } from '@/lib/delivery-status-transitions';
import type { Address } from '@/types/order';
import type { CockpitDelivery } from '@/types/driver-cockpit';

interface DriverCockpitProps {
  delivery: CockpitDelivery;
  onStatusUpdate: () => void;
  onBack: () => void;
  isUpdating?: boolean;
}

/**
 * Active delivery cockpit view.
 * Full viewport layout: map (~50%) + bottom sheet (~50%).
 */
export function DriverCockpit({
  delivery,
  onStatusUpdate,
  onBack,
  isUpdating = false,
}: DriverCockpitProps) {
  const currentStatus = delivery.driverStatus || null;
  const leg = getDeliveryLeg(currentStatus);
  const mapLeg = leg === 'completed' ? 'all' : leg;

  // Determine navigate/call targets based on leg
  const isPickupLeg = leg === 'pickup';
  const targetAddress = isPickupLeg ? delivery.address : delivery.delivery_address;
  const targetLabel = isPickupLeg
    ? (delivery.address?.street1 || 'Pickup')
    : (delivery.delivery_address?.street1 || 'Delivery');

  // Format vendor/client info
  const vendorName = delivery.address?.street1 || 'Pickup Location';
  const pickupAddress = [
    delivery.address?.street1,
    delivery.address?.city,
    delivery.address?.state,
  ].filter(Boolean).join(', ');

  const deliveryAddressStr = delivery.delivery_address
    ? [
        delivery.delivery_address.street1,
        delivery.delivery_address.city,
        delivery.delivery_address.state,
      ].filter(Boolean).join(', ')
    : null;

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-100">
      {/* Map area */}
      <div className="relative flex-shrink-0" style={{ height: '45%' }}>
        {/* Back button overlay */}
        <button
          type="button"
          onClick={onBack}
          className="absolute top-4 left-4 z-20 w-11 h-11 rounded-full bg-white shadow-md
                     flex items-center justify-center active:bg-gray-100"
          aria-label="Back to queue"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>

        <OrderLocationMap
          pickupAddress={delivery.address as unknown as Address}
          deliveryAddress={delivery.delivery_address as unknown as Address}
          leg={mapLeg}
          height="100%"
          className="rounded-none"
          showNavigationControls={false}
        />
      </div>

      {/* Bottom sheet */}
      <DriverBottomSheet>
        {/* Destination heading */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {isPickupLeg ? 'Picking up from' : 'Delivering to'}
            </p>
            <h2 className="text-lg font-bold text-gray-900 mt-0.5">
              {isPickupLeg ? vendorName : (delivery.delivery_address?.street1 || 'Delivery Location')}
            </h2>
            <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{isPickupLeg ? pickupAddress : deliveryAddressStr}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 pt-1">
            <Link
              href={`/driver/deliveries/${encodeURIComponent(delivery.orderNumber)}/details`}
              className="w-11 h-11 rounded-lg flex flex-col items-center justify-center hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Order details"
            >
              <ClipboardList className="w-5 h-5 text-gray-600" />
              <span className="text-[10px] text-gray-500 mt-0.5">Details</span>
            </Link>
            <Link
              href={`/driver/deliveries/${encodeURIComponent(delivery.orderNumber)}/files`}
              className="w-11 h-11 rounded-lg flex flex-col items-center justify-center hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Order files"
            >
              <Paperclip className="w-5 h-5 text-gray-600" />
              <span className="text-[10px] text-gray-500 mt-0.5">Files</span>
            </Link>
          </div>
        </div>

        {/* Order info */}
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="font-medium">#{delivery.orderNumber}</span>
          <span className="text-gray-300">|</span>
          <span className="capitalize">{delivery.delivery_type.replace('_', ' ')}</span>
          {delivery.user?.name && (
            <>
              <span className="text-gray-300">|</span>
              <span>{delivery.user.name}</span>
            </>
          )}
        </div>

        {/* Stepper */}
        <DeliveryStepper currentStatus={currentStatus} compact />

        {/* Action pills */}
        <ActionPills
          destinationLat={targetAddress?.latitude}
          destinationLng={targetAddress?.longitude}
          destinationLabel={targetLabel}
        />

        {/* Status CTA */}
        <StatusButton
          currentStatus={currentStatus}
          orderNumber={delivery.orderNumber}
          onConfirm={onStatusUpdate}
          isLoading={isUpdating}
        />
      </DriverBottomSheet>
    </div>
  );
}
