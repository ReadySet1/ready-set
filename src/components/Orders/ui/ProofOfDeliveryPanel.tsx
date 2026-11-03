"use client";

import React from "react";
import { Camera } from "lucide-react";
import { ProofOfDeliveryViewer } from "@/components/Driver/ProofOfDeliveryViewer";
import { DELIVERY_PHOTO_CATEGORY } from "@/lib/driver/stage-photos";

interface PodFileLike {
  id: string;
  category?: string | null;
  fileUrl: string;
  uploadedAt?: Date | string | null;
}

interface ProofOfDeliveryPanelProps {
  orderId: string;
  orderNumber: string;
  /** The order's files, as returned (signed) by /api/orders/[order_number]/files. */
  files: ReadonlyArray<PodFileLike>;
}

const timeOf = (value: PodFileLike["uploadedAt"]) => {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Admin order page: every proof-of-delivery photo on the order (up to 3), in
 * capture order, each in the shared ProofOfDeliveryViewer (full-size view +
 * download). Renders nothing until the order has a POD photo.
 */
export function ProofOfDeliveryPanel({ orderId, orderNumber, files }: ProofOfDeliveryPanelProps) {
  const photos = files
    .filter(
      (file) =>
        file.category?.trim().toLowerCase() === DELIVERY_PHOTO_CATEGORY && !!file.fileUrl,
    )
    .sort((a, b) => timeOf(a.uploadedAt) - timeOf(b.uploadedAt));

  if (photos.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
          <Camera className="h-5 w-5 text-green-600" />
          Proof of Delivery
        </h2>
        <span className="text-sm text-slate-500">
          {photos.length} {photos.length === 1 ? "photo" : "photos"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
        {photos.map((photo) => (
          <ProofOfDeliveryViewer
            key={photo.id}
            photoUrl={photo.fileUrl}
            deliveryId={orderId}
            orderNumber={orderNumber}
            capturedAt={photo.uploadedAt ? new Date(photo.uploadedAt) : undefined}
            showDownload={true}
            showLocation={false}
          />
        ))}
      </div>
    </div>
  );
}

export default ProofOfDeliveryPanel;
