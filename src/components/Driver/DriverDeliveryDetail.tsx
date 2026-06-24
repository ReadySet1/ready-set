"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Package,
  StickyNote,
  Store,
  User as UserIcon,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import { DriverStatus } from "@/types/user";
import { OrderStatus } from "@/types/order";
import {
  DriverCard,
  NextAction,
  StateBlock,
  StatusPill,
  StatusTimeline,
  Spinner,
  formatTime,
  getDriverNextActionLabel,
  getNextStatus,
  getStatusProgress,
  resolveDriverStatus,
} from "@/components/Driver/ui";
import { DriverPodSheet } from "@/components/Driver/ui/DriverPodSheet";
import { DriverSignatureSheet } from "@/components/Driver/ui/DriverSignatureSheet";
import { NavigateButton } from "@/components/Driver/ui/NavigateButton";

/**
 * Driver-specific Delivery Detail.
 *
 * Replaces the shared `SingleOrder` body on `/driver/deliveries/[order_number]`
 * with a mobile-first driver view (status timeline + pickup/delivery blocks +
 * sticky Next-Action + proof-of-delivery).
 *
 * The DATA + MUTATION layer is intentionally identical to what `SingleOrder`
 * already did, so behavior is unchanged:
 *   - fetch:  GET  /api/orders/{orderNumber}?include=dispatch.driver  (Bearer)
 *   - advance: PATCH /api/orders/{orderNumber}  { driverStatus }
 *              (on COMPLETED, also PATCH the order status to COMPLETED)
 *   - POD:    POST /api/orders/{orderNumber}/pod  (via DriverPodSheet)
 *
 * POD is required at ARRIVED_TO_CLIENT before advancing to COMPLETED — mirroring
 * the Live Tracking screen.
 */

interface AddressLike {
  name?: string | null;
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  locationNumber?: string | null;
  parkingLoading?: string | null;
  isRestaurant?: boolean | null;
}

interface DeliveryTimestampMap {
  assignedAt?: string | null;
  enRouteToVendorAt?: string | null;
  arrivedAtVendorAt?: string | null;
  pickedUpAt?: string | null;
  enRouteAt?: string | null;
  arrivedAtClientAt?: string | null;
  deliveredAt?: string | null;
}

interface DriverOrder {
  id: string;
  orderNumber: string;
  order_type?: "catering" | "on_demand";
  status?: string;
  driverStatus?: DriverStatus | string | null;
  pickupAddress?: AddressLike | null;
  deliveryAddress?: AddressLike | null;
  user?: { name?: string | null; email?: string | null } | null;
  dispatches?: Array<{
    driver?: {
      id?: string;
      name?: string | null;
      contactNumber?: string | null;
    } | null;
  }> | null;
  pickupDateTime?: string | null;
  arrivalDateTime?: string | null;
  clientAttention?: string | null;
  pickupNotes?: string | null;
  specialNotes?: string | null;
  headcount?: number | null;
  itemDelivered?: string | null;
  vehicleType?: string | null;
  deliveryTimestamps?: DeliveryTimestampMap | null;
}

/** Map each lifecycle stage to the deliveryTimestamps field that records it. */
const TIMESTAMP_FIELD_BY_STATUS: Partial<
  Record<DriverStatus, keyof DeliveryTimestampMap>
> = {
  [DriverStatus.ASSIGNED]: "assignedAt",
  [DriverStatus.EN_ROUTE_TO_VENDOR]: "enRouteToVendorAt",
  [DriverStatus.ARRIVED_AT_VENDOR]: "arrivedAtVendorAt",
  [DriverStatus.PICKED_UP]: "pickedUpAt",
  [DriverStatus.EN_ROUTE_TO_CLIENT]: "enRouteAt",
  [DriverStatus.ARRIVED_TO_CLIENT]: "arrivedAtClientAt",
  [DriverStatus.COMPLETED]: "deliveredAt",
};

function formatAddressLines(addr?: AddressLike | null): string[] {
  if (!addr) return [];
  const line1 = [addr.street1, addr.street2].filter(Boolean).join(", ");
  const line2 = [addr.city, addr.state, addr.zip].filter(Boolean).join(", ");
  return [line1, line2].filter((l) => l.length > 0);
}

function addressQuery(addr?: AddressLike | null): string | null {
  if (!addr) return null;
  const q = [addr.street1, addr.street2, addr.city, addr.state, addr.zip]
    .filter(Boolean)
    .join(", ");
  return q || null;
}

interface DriverDeliveryDetailProps {
  orderNumber: string;
}

export function DriverDeliveryDetail({ orderNumber }: DriverDeliveryDetailProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [order, setOrder] = useState<DriverOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [podOpen, setPodOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);

  // Cache the session per mount cycle to reduce auth-lock contention (same
  // pattern SingleOrder uses).
  const sessionRef = useRef<{ session: any; fetchedAt: number } | null>(null);
  const getValidSession = useCallback(async () => {
    const now = Date.now();
    if (sessionRef.current && now - sessionRef.current.fetchedAt < 60000) {
      return sessionRef.current.session;
    }
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session) return null;
    sessionRef.current = { session, fetchedAt: now };
    return session;
  }, [supabase.auth]);

  const fetchOrder = useCallback(async () => {
    if (!orderNumber) {
      // The parent resolves order_number asynchronously; keep showing the
      // loading state until it arrives rather than flashing "not found".
      setIsLoading(true);
      return;
    }
    setIsLoading(true);
    try {
      const session = await getValidSession();
      if (!session) {
        toast.error("Authentication error. Please log in again.");
        router.push("/sign-in");
        return;
      }
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}?include=dispatch.driver`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        router.push("/sign-in");
        return;
      }
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        throw new Error(`Order API error (${res.status})`);
      }
      const data = (await res.json()) as DriverOrder;
      setOrder({ ...data, id: String(data.id) });
      setNotFound(false);
    } catch (err) {
      console.error("Error fetching order:", err);
      toast.error("Failed to load delivery details");
    } finally {
      setIsLoading(false);
    }
  }, [orderNumber, getValidSession, router]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  /** PATCH driverStatus (and order status on COMPLETED), then refresh. */
  const advanceStatus = useCallback(
    async (newStatus: DriverStatus) => {
      if (!order) return;
      setIsAdvancing(true);
      try {
        const session = await getValidSession();
        if (!session) {
          toast.error("Authentication error. Please log in again.");
          router.push("/sign-in");
          return;
        }
        const res = await fetch(
          `/api/orders/${encodeURIComponent(order.orderNumber)}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ driverStatus: newStatus }),
          },
        );
        if (!res.ok) {
          let detail = "";
          try {
            const body = await res.json();
            detail = body.error || body.message || "";
          } catch {
            /* ignore */
          }
          throw new Error(detail || res.statusText);
        }
        const updated = (await res.json()) as DriverOrder;
        setOrder((prev) => {
          const merged = {
            ...(prev?.deliveryTimestamps ?? {}),
            ...(updated.deliveryTimestamps ?? {}),
          };
          return { ...updated, id: String(updated.id), deliveryTimestamps: merged };
        });

        // Mirror SingleOrder: a completed delivery also completes the order.
        if (newStatus === DriverStatus.COMPLETED) {
          await fetch(`/api/orders/${encodeURIComponent(order.orderNumber)}`, {
            method: "PATCH",
            credentials: "include",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: OrderStatus.COMPLETED }),
          }).catch((e) => console.warn("Order status sync failed:", e));
        }

        toast.success("Status updated");
      } catch (err) {
        console.error("Error updating driver status:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to update status",
        );
      } finally {
        setIsAdvancing(false);
      }
    },
    [order, getValidSession, router],
  );

  /** Next-Action handler: gate the signature (pickup) + POD (delivery) steps,
   *  otherwise advance. */
  const handleNextAction = useCallback(() => {
    if (!order) return;
    const current = order.driverStatus as DriverStatus | undefined;
    const next = current ? getNextStatus(current) : DriverStatus.ASSIGNED;
    if (!next) return;
    // Require a vendor-staff signature before marking the pickup done.
    if (current === DriverStatus.ARRIVED_AT_VENDOR && next === DriverStatus.PICKED_UP) {
      setSignatureOpen(true);
      return;
    }
    // Require proof of delivery before completing.
    if (current === DriverStatus.ARRIVED_TO_CLIENT && next === DriverStatus.COMPLETED) {
      setPodOpen(true);
      return;
    }
    void advanceStatus(next);
  }, [order, advanceStatus]);

  const onSignatureComplete = useCallback(async () => {
    setSignatureOpen(false);
    await advanceStatus(DriverStatus.PICKED_UP);
  }, [advanceStatus]);

  const onPodComplete = useCallback(async () => {
    setPodOpen(false);
    await advanceStatus(DriverStatus.COMPLETED);
  }, [advanceStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <StateBlock
        icon={AlertTriangle}
        title="Delivery not found"
        body="This delivery may have been reassigned or is no longer available."
      />
    );
  }

  const resolved = resolveDriverStatus(order.driverStatus);
  const isDone =
    resolved.status === DriverStatus.COMPLETED || resolved.status === "CANCELLED";
  const progress = getStatusProgress(order.driverStatus ?? undefined);
  const nextStatus = order.driverStatus
    ? getNextStatus(order.driverStatus as DriverStatus)
    : DriverStatus.ASSIGNED;
  const completing = nextStatus === DriverStatus.COMPLETED;

  // Build formatted timestamps keyed by DriverStatus for the timeline.
  const timestamps: Partial<Record<DriverStatus, string>> = {};
  if (order.deliveryTimestamps) {
    for (const [status, field] of Object.entries(TIMESTAMP_FIELD_BY_STATUS)) {
      const raw = order.deliveryTimestamps[field as keyof DeliveryTimestampMap];
      const formatted = formatTime(raw);
      if (formatted) timestamps[status as DriverStatus] = formatted;
    }
  }

  const clientName = order.user?.name?.trim() || "Client";
  const vendorName =
    order.pickupAddress?.name?.trim() ||
    (order.pickupAddress?.isRestaurant ? "Restaurant" : "Pickup");
  const pickupLines = formatAddressLines(order.pickupAddress);
  const deliveryLines = formatAddressLines(order.deliveryAddress);
  const pickupQuery = addressQuery(order.pickupAddress);
  const deliveryQuery = addressQuery(order.deliveryAddress);

  return (
    <div className="flex flex-col gap-3 px-2 pb-32">
      {/* Status header */}
      <DriverCard className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <StatusPill status={order.driverStatus} />
          <span className="font-mono text-[12px] font-bold text-driver-subtle">
            #{order.orderNumber}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-driver-surface-alt">
          <div
            className="h-full rounded-full bg-driver-brand transition-all"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        {order.arrivalDateTime ? (
          <div className="text-[12.5px] font-semibold text-driver-muted">
            Drop-off scheduled {formatTime(order.arrivalDateTime)}
          </div>
        ) : null}
      </DriverCard>

      {/* Timeline */}
      <DriverCard>
        <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.06em] text-driver-subtle">
          Progress
        </div>
        <StatusTimeline status={order.driverStatus} timestamps={timestamps} />
      </DriverCard>

      {/* Pickup */}
      <DriverCard className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-driver-info" strokeWidth={2.4} />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-driver-subtle">
            Pickup
          </span>
        </div>
        <div className="text-driver-pip font-extrabold text-driver-text">{vendorName}</div>
        {pickupLines.map((line) => (
          <div key={line} className="text-[13.5px] font-medium text-driver-muted">
            {line}
          </div>
        ))}
        {order.pickupAddress?.locationNumber ? (
          <div className="text-[12.5px] font-semibold text-driver-muted">
            Suite/Unit {order.pickupAddress.locationNumber}
          </div>
        ) : null}
        {order.pickupAddress?.parkingLoading ? (
          <div className="flex items-start gap-1.5 text-[12.5px] font-medium text-driver-muted">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{order.pickupAddress.parkingLoading}</span>
          </div>
        ) : null}
        {order.pickupDateTime ? (
          <div className="text-[12.5px] font-semibold text-driver-muted">
            Pickup {formatTime(order.pickupDateTime)}
          </div>
        ) : null}
        {order.pickupNotes ? (
          <div className="flex items-start gap-1.5 rounded-xl bg-driver-surface-alt px-3 py-2 text-[12.5px] font-medium text-driver-muted">
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{order.pickupNotes}</span>
          </div>
        ) : null}
        {pickupQuery ? (
          <NavigateButton
            target={{ address: pickupQuery }}
            label="Directions to pickup"
            className="mt-0.5"
          />
        ) : null}
      </DriverCard>

      {/* Drop-off */}
      <DriverCard className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-driver-brand" strokeWidth={2.4} />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-driver-subtle">
            Drop-off
          </span>
        </div>
        <div className="text-driver-pip font-extrabold text-driver-text">{clientName}</div>
        {deliveryLines.map((line) => (
          <div key={line} className="text-[13.5px] font-medium text-driver-muted">
            {line}
          </div>
        ))}
        {order.deliveryAddress?.locationNumber ? (
          <div className="text-[12.5px] font-semibold text-driver-muted">
            Suite/Unit {order.deliveryAddress.locationNumber}
          </div>
        ) : null}
        {order.clientAttention ? (
          <div className="text-[12.5px] font-semibold text-driver-muted">
            Attn: {order.clientAttention}
          </div>
        ) : null}
        {order.arrivalDateTime ? (
          <div className="text-[12.5px] font-semibold text-driver-muted">
            Arrive by {formatTime(order.arrivalDateTime)}
          </div>
        ) : null}
        {order.specialNotes ? (
          <div className="flex items-start gap-1.5 rounded-xl bg-driver-surface-alt px-3 py-2 text-[12.5px] font-medium text-driver-muted">
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{order.specialNotes}</span>
          </div>
        ) : null}
        {deliveryQuery ? (
          <NavigateButton
            target={{ address: deliveryQuery }}
            label="Directions to drop-off"
            className="mt-0.5"
          />
        ) : null}
      </DriverCard>

      {/* Order summary */}
      <DriverCard className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-driver-subtle" strokeWidth={2.4} />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-driver-subtle">
            Order
          </span>
        </div>
        {order.order_type === "catering" && order.headcount ? (
          <div className="text-[13.5px] font-semibold text-driver-text">
            {order.headcount} headcount
          </div>
        ) : null}
        {order.itemDelivered ? (
          <div className="text-[13.5px] font-semibold text-driver-text">
            {order.itemDelivered}
          </div>
        ) : null}
        {order.vehicleType ? (
          <div className="text-[12.5px] font-medium text-driver-muted">
            Vehicle: {order.vehicleType}
          </div>
        ) : null}
      </DriverCard>

      {/* Sticky action bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-driver-border bg-driver-glass px-4 pt-3 backdrop-blur-xl backdrop-saturate-150"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div className="mx-auto w-full max-w-2xl lg:max-w-5xl">
          {isDone ? (
            <div className="flex min-h-driver-action items-center justify-center gap-2 rounded-2xl bg-driver-success-bg text-driver-pip font-extrabold text-driver-success-ink">
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.6} />
              {resolved.status === "CANCELLED" ? "Delivery cancelled" : "Delivery complete"}
            </div>
          ) : (
            <NextAction
              label={getDriverNextActionLabel(order.driverStatus)}
              sub="Next step"
              tone={completing ? "success" : "brand"}
              hint={completing ? "Photo required to complete" : "Tap to update your status"}
              loading={isAdvancing}
              onClick={handleNextAction}
            />
          )}
        </div>
      </div>

      {signatureOpen ? (
        <DriverSignatureSheet
          open={signatureOpen}
          onOpenChange={setSignatureOpen}
          orderNumber={order.orderNumber}
          onComplete={onSignatureComplete}
        />
      ) : null}

      {podOpen ? (
        <DriverPodSheet
          open={podOpen}
          onOpenChange={setPodOpen}
          deliveryId={order.id}
          orderNumber={order.orderNumber}
          uploadEndpoint={`/api/orders/${encodeURIComponent(order.orderNumber)}/pod`}
          onComplete={onPodComplete}
        />
      ) : null}
    </div>
  );
}

export default DriverDeliveryDetail;
