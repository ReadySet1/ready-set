'use client';

import React from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import OrderLocationMap from '@/components/Orders/ui/OrderLocationMap';
import { DeliveryTimeline } from '@/components/Delivery/DeliveryTimeline';
import { formatDateTimeForDisplay } from '@/lib/utils/date-display';
import type { Address } from '@/types/order';
import type { CockpitDelivery } from '@/types/driver-cockpit';

interface DriverCompletedOrderProps {
  delivery: CockpitDelivery;
  onBack: () => void;
}

/**
 * Read-only completed delivery view with summary, timeline, and map.
 */
export function DriverCompletedOrder({ delivery, onBack }: DriverCompletedOrderProps) {
  const ts = delivery.deliveryTimestamps;

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b px-4 h-14 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100"
          aria-label="Back to queue"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-semibold text-gray-900">
          Order #{delivery.orderNumber}
        </h1>
      </div>

      <div className="px-4 py-5 space-y-5 max-w-lg mx-auto">
        {/* Completion badge */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-900">Delivery Completed</p>
            {ts?.deliveredAt && (
              <p className="text-sm text-green-700">
                {formatDateTimeForDisplay(ts.deliveredAt)}
              </p>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Delivery Summary</h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-gray-500">Type</span>
            <span className="text-gray-900 capitalize">{delivery.delivery_type.replace('_', ' ')}</span>
            <span className="text-gray-500">Client</span>
            <span className="text-gray-900">{delivery.user?.name || delivery.user?.email || 'N/A'}</span>
            <span className="text-gray-500">Pickup</span>
            <span className="text-gray-900">{delivery.address?.street1 || 'N/A'}</span>
            <span className="text-gray-500">Delivery</span>
            <span className="text-gray-900">{delivery.delivery_address?.street1 || 'N/A'}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Timeline</h3>
          <DeliveryTimeline
            createdAt={delivery.createdAt}
            enRouteToVendorAt={ts?.enRouteToVendorAt}
            arrivedAtVendorAt={ts?.arrivedAtVendorAt}
            pickedUpAt={ts?.pickedUpAt}
            enRouteAt={ts?.enRouteAt}
            arrivedAtClientAt={ts?.arrivedAtClientAt}
            deliveredAt={ts?.deliveredAt}
            estimatedPickupTime={delivery.pickupDateTime}
            estimatedDeliveryTime={delivery.arrivalDateTime ?? delivery.completeDateTime}
            currentStatus={delivery.driverStatus}
            canUpdateStatus={false}
            compact
          />
        </div>

        {/* Map with both pins */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <h3 className="font-semibold text-gray-900 text-sm px-4 pt-4 pb-2">Route</h3>
          <OrderLocationMap
            pickupAddress={delivery.address as unknown as Address}
            deliveryAddress={delivery.delivery_address as unknown as Address}
            leg="all"
            height="200px"
            showNavigationControls={false}
          />
        </div>

        {/* Notes */}
        {(delivery.specialNotes || delivery.pickupNotes) && (
          <div className="bg-white rounded-xl border p-4 space-y-2">
            <h3 className="font-semibold text-gray-900 text-sm">Notes</h3>
            {delivery.pickupNotes && (
              <div>
                <p className="text-xs font-medium text-gray-500">Pickup Notes</p>
                <p className="text-sm text-gray-700">{delivery.pickupNotes}</p>
              </div>
            )}
            {delivery.specialNotes && (
              <div>
                <p className="text-xs font-medium text-gray-500">Special Notes</p>
                <p className="text-sm text-gray-700">{delivery.specialNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
