import { UserCheck } from "lucide-react";

interface DeliveryRecipientProps {
  /** `deliveries.delivery_received_by`, exposed as `deliveryReceivedBy` by
   *  GET /api/orders/[order_number]. */
  receivedBy?: string | null;
}

/**
 * Who received the order at completion. The driver records the recipient's
 * signature or, when they refuse to sign, their name (Gary 2026-06-01/06-22);
 * the signature image itself is listed with the order files. Renders nothing
 * when no name was recorded.
 */
export function DeliveryRecipient({ receivedBy }: DeliveryRecipientProps) {
  const name = receivedBy?.trim();
  if (!name) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <UserCheck className="h-4 w-4 text-slate-500" />
      <span className="font-semibold text-slate-700">Received by</span>
      <span className="text-slate-800">{name}</span>
    </div>
  );
}
