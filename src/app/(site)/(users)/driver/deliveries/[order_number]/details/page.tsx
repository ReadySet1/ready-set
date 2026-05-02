'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, MapPin, Navigation, User, Clock, Package, FileText } from 'lucide-react';
import { useDriverDelivery } from '@/hooks/useDriverDelivery';
import type { CockpitAddress } from '@/types/driver-cockpit';

function formatGoogleMapsUrl(address: CockpitAddress): string {
  const parts = [address.street1, address.city, address.state, address.zip].filter(Boolean);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(' '))}`;
}

function AddressCard({ address, title }: { address: CockpitAddress; title: string }) {
  const line1 = address.street1 || 'N/A';
  const line2 = [address.city, address.state, address.zip].filter(Boolean).join(', ');

  return (
    <div className="bg-white rounded-xl border p-4 space-y-2">
      <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-gray-500" />
        {title}
      </h3>
      <p className="text-sm text-gray-800">{line1}</p>
      {address.street2 && <p className="text-sm text-gray-600">{address.street2}</p>}
      {line2 && <p className="text-sm text-gray-600">{line2}</p>}
      <a
        href={formatGoogleMapsUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 pt-1"
      >
        <Navigation className="w-3.5 h-3.5 mr-1" />
        View on Google Maps
      </a>
    </div>
  );
}

const OrderDetailsPage = () => {
  const params = useParams();
  const router = useRouter();

  const orderNumber = (() => {
    if (!params?.order_number) return '';
    const raw = Array.isArray(params.order_number) ? params.order_number[0] : params.order_number;
    return raw ? decodeURIComponent(raw) : '';
  })();

  const { delivery, isLoading, error } = useDriverDelivery(orderNumber);

  const handleBack = () => {
    router.push(`/driver/deliveries/${encodeURIComponent(orderNumber)}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] px-4">
        <p className="text-red-600 mb-3">{error || 'Delivery not found'}</p>
        <button type="button" onClick={handleBack} className="text-sm font-medium text-gray-700 underline">
          Back to Cockpit
        </button>
      </div>
    );
  }

  const pickupTime = delivery.pickupDateTime
    ? new Date(delivery.pickupDateTime).toLocaleString()
    : 'N/A';
  const deliveryTime = delivery.arrivalDateTime
    ? new Date(delivery.arrivalDateTime).toLocaleString()
    : 'N/A';

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b px-4 h-14 flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100"
          aria-label="Back to cockpit"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-semibold text-gray-900">
          Order #{delivery.orderNumber}
        </h1>
      </div>

      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
        {/* Customer */}
        {delivery.user && (
          <div className="bg-white rounded-xl border p-4 space-y-2">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
              <User className="w-4 h-4 text-gray-500" />
              Customer
            </h3>
            {delivery.user.name && (
              <p className="text-sm text-gray-800">{delivery.user.name}</p>
            )}
            <p className="text-sm text-gray-600">{delivery.user.email}</p>
          </div>
        )}

        {/* Pickup Address */}
        {delivery.address && (
          <AddressCard address={delivery.address} title="Pickup Address" />
        )}

        {/* Delivery Address */}
        {delivery.delivery_address && (
          <AddressCard address={delivery.delivery_address} title="Delivery Address" />
        )}

        {/* Order Specifics */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
            <Package className="w-4 h-4 text-gray-500" />
            Order Specifics
          </h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-gray-500">Pickup Time</span>
            <span className="text-gray-900">{pickupTime}</span>

            <span className="text-gray-500">Delivery Time</span>
            <span className="text-gray-900">{deliveryTime}</span>

            {delivery.headcount != null && (
              <>
                <span className="text-gray-500">Headcount</span>
                <span className="text-gray-900">{delivery.headcount}</span>
              </>
            )}

            {delivery.order_total != null && (
              <>
                <span className="text-gray-500">Order Total</span>
                <span className="text-gray-900">${Number(delivery.order_total).toFixed(2)}</span>
              </>
            )}

            <span className="text-gray-500">Delivery Type</span>
            <span className="text-gray-900 capitalize">{delivery.delivery_type.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Additional Info */}
        {(delivery.client_attention || delivery.pickupNotes || delivery.specialNotes) && (
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-gray-500" />
              Additional Info
            </h3>
            {delivery.client_attention && (
              <div>
                <p className="text-xs font-medium text-gray-500">Client Attention</p>
                <p className="text-sm text-gray-700">{delivery.client_attention}</p>
              </div>
            )}
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
};

export default OrderDetailsPage;
