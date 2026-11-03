"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Hourglass,
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
import { DriverReturnSheet } from "@/components/Driver/ui/DriverReturnSheet";
import { ReturnDeclinedNotice } from "@/components/Driver/ui/ReturnDeclinedNotice";
import { DriverSignatureSheet } from "@/components/Driver/ui/DriverSignatureSheet";
import { NavigateButton } from "@/components/Driver/ui/NavigateButton";
import { addressQuery } from "@/lib/driver-navigation";
import { useDriverTracking } from "@/contexts/DriverTrackingContext";
import { checkArrivalGeofence, geofenceHint } from "@/lib/driver/geofence";
import { requiresActiveShift } from "@/lib/state-machine/driver-state";
import { useTrackingSettings } from "@/hooks/tracking/useTrackingSettings";
import {
  DELIVERY_PHOTO_CATEGORY,
  PICKUP_PHOTO_CATEGORY,
  POD_MAX_PHOTOS,
  RECIPIENT_REQUIRED_CODE,
  hasRecipientConfirmation,
  hasUploadInCategory,
} from "@/lib/driver/stage-photos";

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
 *   - pickup photo: POST /api/orders/{orderNumber}/pickup-photo (same sheet)
 *
 * Mandatory captures (server-enforced with 422 codes, mirrored here):
 *   ARRIVED_AT_VENDOR → PICKED_UP: photo of the order, then pickup confirmation
 *   ARRIVED_TO_CLIENT → COMPLETED: photo of the setup (POD), then the
 *     recipient's signature or — if they refuse to sign — their name
 *     (POST /api/orders/{orderNumber}/recipient via DriverSignatureSheet)
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
  /** Present when the address was geocoded — used by the arrival geofence. */
  latitude?: number | null;
  longitude?: number | null;
}

/** [lng, lat] tuple for the geofence check, or null when ungeocoded (fail-open). */
function addressTarget(addr?: AddressLike | null): [number, number] | null {
  if (
    !addr ||
    typeof addr.latitude !== "number" ||
    typeof addr.longitude !== "number"
  ) {
    return null;
  }
  return [addr.longitude, addr.latitude];
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
  /** file_uploads rows on the order — the stage-photo categories decide
   *  whether a capture sheet still has to open. */
  fileUploads?: Array<{ category?: string | null } | null> | null;
  /** Recipient name recorded at completion (deliveries.delivery_received_by). */
  deliveryReceivedBy?: string | null;
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

/** Shift gate toast: a delivery worked off-shift leaves no GPS trail, so send
 *  the driver to the tracking screen where shifts start. Keyed so repeated
 *  taps don't stack. */
function showShiftRequiredToast() {
  toast.error(
    <span>
      Start your shift first.{" "}
      <Link href="/driver/tracking" className="font-semibold underline">
        Go to shift
      </Link>
    </span>,
    { id: "shift-required" },
  );
}

interface DriverDeliveryDetailProps {
  orderNumber: string;
}

export function DriverDeliveryDetail({ orderNumber }: DriverDeliveryDetailProps) {
  const router = useRouter();
  // Live GPS from the shared tracking provider (wraps all /driver/* routes).
  // May be null outside an active shift — the geofence fails open in that case.
  // `refreshDeliveries` syncs the provider's shared deliveries feed after a
  // status change here, so /driver/tracking (End-shift guard, active list)
  // updates immediately instead of waiting on its 60s poll.
  // `isShiftActive` / `shiftLoading` drive the shift gate on the Next-Action.
  const { currentLocation, refreshDeliveries, isShiftActive, shiftLoading } =
    useDriverTracking();
  const { settings } = useTrackingSettings();
  const geofenceRadiusM = settings.arrivalGeofenceRadiusM;
  const supabase = useMemo(() => createClient(), []);

  const [order, setOrder] = useState<DriverOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [podOpen, setPodOpen] = useState(false);
  const [pickupPhotoOpen, setPickupPhotoOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  /** Stage photos stored in this session. Seeded from the order's file
   *  uploads on load (below); the server gate (422) stays authoritative. */
  const [pickupPhotoDone, setPickupPhotoDone] = useState(false);
  const [podDone, setPodDone] = useState(false);
  /** Recipient sign-off at completion (signature, or name if they refuse). */
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [recipientDone, setRecipientDone] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  /** True while this order has a PENDING return request awaiting dispatch. */
  const [pendingReturn, setPendingReturn] = useState(false);
  /** Most recent REJECTED return request (last 24h) — dispatch said no and
   *  the delivery is still ours; rendered as a dismissable notice. */
  const [rejectedReturn, setRejectedReturn] = useState<{
    id: string;
    resolutionNotes: string | null;
  } | null>(null);

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

  /** Non-fatal lookup of the caller's return requests for this order —
   *  drives the "Return requested — awaiting dispatch" state and the
   *  "Dispatch declined your return request" notice. */
  const fetchPendingReturn = useCallback(async () => {
    if (!orderNumber) return;
    try {
      const session = await getValidSession();
      if (!session) return;
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/return`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        request?: unknown;
        lastRejected?: { id?: unknown; resolutionNotes?: unknown } | null;
      };
      setPendingReturn(data.request != null);
      const rejected = data.lastRejected;
      setRejectedReturn(
        rejected && typeof rejected.id === "string"
          ? {
              id: rejected.id,
              resolutionNotes:
                typeof rejected.resolutionNotes === "string"
                  ? rejected.resolutionNotes
                  : null,
            }
          : null,
      );
    } catch {
      /* best-effort — the badge simply stays hidden */
    }
  }, [orderNumber, getValidSession]);

  useEffect(() => {
    void fetchOrder();
    void fetchPendingReturn();
  }, [fetchOrder, fetchPendingReturn]);

  // Proof-of-delivery photos (up to POD_MAX_PHOTOS) for a completed delivery.
  // The fileUrl stored on the order is a public URL into the private
  // delivery-proofs bucket (it 404s), so read the signed URLs from the files
  // route, which signs POD paths against the right bucket (#506). Non-fatal:
  // no photo, no card.
  const isCompleted =
    !!order &&
    resolveDriverStatus(order.driverStatus).status === DriverStatus.COMPLETED;
  const [podPhotoUrls, setPodPhotoUrls] = useState<string[]>([]);
  useEffect(() => {
    if (!isCompleted || !orderNumber) return;
    let cancelled = false;
    (async () => {
      try {
        const session = await getValidSession();
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderNumber)}/files`,
          {
            credentials: "include",
            headers: session
              ? { Authorization: `Bearer ${session.access_token}` }
              : undefined,
          },
        );
        if (!res.ok) return;
        const files = (await res.json()) as unknown;
        if (!Array.isArray(files)) return;
        const pods = (
          files as Array<{ category?: unknown; fileUrl?: unknown; uploadedAt?: unknown }>
        )
          .filter(
            (f) =>
              typeof f?.category === "string" &&
              f.category.toLowerCase() === DELIVERY_PHOTO_CATEGORY &&
              typeof f.fileUrl === "string" &&
              f.fileUrl.length > 0,
          )
          // The files route lists newest first; show photos in capture order.
          .sort((a, b) => {
            const at = typeof a.uploadedAt === "string" ? Date.parse(a.uploadedAt) : NaN;
            const bt = typeof b.uploadedAt === "string" ? Date.parse(b.uploadedAt) : NaN;
            return Number.isNaN(at) || Number.isNaN(bt) ? 0 : at - bt;
          })
          .map((f) => f.fileUrl as string);
        if (!cancelled && pods.length > 0) setPodPhotoUrls(pods);
      } catch {
        /* best-effort — the card simply stays hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCompleted, orderNumber, getValidSession]);

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
          let code = "";
          let message = "";
          try {
            const body = await res.json();
            code =
              typeof body.error === "string"
                ? body.error
                : typeof body.code === "string"
                  ? body.code
                  : "";
            message = typeof body.message === "string" ? body.message : "";
            detail = message || body.error || "";
          } catch {
            /* ignore */
          }
          // Server-side shift gate (authoritative) — the client check above
          // can be stale, e.g. the shift ended in another tab.
          if (code === "SHIFT_REQUIRED") {
            showShiftRequiredToast();
            return;
          }
          // Mandatory stage captures (authoritative): reopen whichever sheet
          // the server says is missing — e.g. the photo was queued offline
          // and has not landed yet, or the order was loaded before it.
          if (code === "PICKUP_PHOTO_REQUIRED") {
            setPickupPhotoDone(false);
            toast.error(
              message || "Take a photo of the order before marking it picked up.",
            );
            setPickupPhotoOpen(true);
            return;
          }
          if (code === "POD_REQUIRED") {
            setPodDone(false);
            toast.error(message || "Take a photo of the setup before completing.");
            setPodOpen(true);
            return;
          }
          if (code === RECIPIENT_REQUIRED_CODE) {
            setRecipientDone(false);
            toast.error(
              message ||
                "Get the recipient's signature, or their name if they refuse to sign.",
            );
            setRecipientOpen(true);
            return;
          }
          if (code === "PICKUP_CONFIRMATION_REQUIRED") {
            toast.error(message || "Confirm the pickup before continuing.");
            setSignatureOpen(true);
            return;
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

        // The server auto-voids a PENDING return request at PICKED_UP and
        // beyond (keeping the food means keeping the job) — mirror it locally.
        if (
          [
            DriverStatus.PICKED_UP,
            DriverStatus.EN_ROUTE_TO_CLIENT,
            DriverStatus.ARRIVED_TO_CLIENT,
            DriverStatus.COMPLETED,
          ].includes(newStatus)
        ) {
          setPendingReturn(false);
        }

        // Mirror SingleOrder: a completed delivery also completes the order.
        // Not awaited: the server already maps driverStatus=COMPLETED to the
        // order status, and this follow-up is failure-tolerant — the driver
        // should not wait an extra round trip for it.
        if (newStatus === DriverStatus.COMPLETED) {
          void fetch(`/api/orders/${encodeURIComponent(order.orderNumber)}`, {
            method: "PATCH",
            // Not awaited: keep it alive through navigation / webview unload.
            keepalive: true,
            credentials: "include",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: OrderStatus.COMPLETED }),
          }).catch((e) => console.warn("Order status sync failed:", e));
        }

        // Sync the shared deliveries feed so other driver surfaces (the
        // End-shift guard on /driver/tracking) see this change right away.
        // Non-fatal: local state above is already updated.
        await refreshDeliveries().catch((e) =>
          console.warn("Deliveries feed refresh failed:", e),
        );

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
    [order, getValidSession, router, refreshDeliveries],
  );

  // Stage photos already on file: captured in this session, or present on
  // the order when it loaded (e.g. the PATCH failed after the upload).
  const hasPickupPhoto =
    pickupPhotoDone || hasUploadInCategory(order?.fileUploads, PICKUP_PHOTO_CATEGORY);
  const hasPod = podDone || hasUploadInCategory(order?.fileUploads, DELIVERY_PHOTO_CATEGORY);
  const hasRecipient =
    recipientDone ||
    hasRecipientConfirmation({
      files: order?.fileUploads,
      deliveryReceivedBy: order?.deliveryReceivedBy,
    });

  /** Next-Action handler: gate the pickup photo + confirmation (pickup) and
   *  the POD photo (delivery) steps, otherwise advance. */
  const handleNextAction = useCallback(() => {
    if (!order) return;
    const current = order.driverStatus as DriverStatus | undefined;
    const next = current ? getNextStatus(current) : DriverStatus.ASSIGNED;
    if (!next) return;
    // Shift gate: no shift means no GPS trail, so the driver must start one
    // before working the delivery. Fails open while the shift state is still
    // loading — the server enforces the same rule (422 SHIFT_REQUIRED).
    if (!shiftLoading && !isShiftActive && requiresActiveShift(next)) {
      showShiftRequiredToast();
      return;
    }
    // Arrival geofence backstop (fail-open on unknown GPS/coords): never mark
    // "arrived" while demonstrably far from the stop.
    const arrivalTarget =
      next === DriverStatus.ARRIVED_AT_VENDOR
        ? addressTarget(order.pickupAddress)
        : next === DriverStatus.ARRIVED_TO_CLIENT
          ? addressTarget(order.deliveryAddress)
          : null;
    if (arrivalTarget) {
      const check = checkArrivalGeofence(
        currentLocation?.coordinates ?? null,
        arrivalTarget,
        geofenceRadiusM,
      );
      if (!check.allowed && check.distanceM !== null) {
        toast.error(geofenceHint(check.distanceM));
        return;
      }
    }
    // Pickup: a photo of the order at the vendor (mandatory), then the pickup
    // confirmation (receiver name / signature). The server enforces both.
    if (current === DriverStatus.ARRIVED_AT_VENDOR && next === DriverStatus.PICKED_UP) {
      if (!hasPickupPhoto) {
        setPickupPhotoOpen(true);
        return;
      }
      setSignatureOpen(true);
      return;
    }
    // Completion: a photo of the setup, then the recipient's signature or
    // name (both mandatory; the server enforces them).
    if (current === DriverStatus.ARRIVED_TO_CLIENT && next === DriverStatus.COMPLETED) {
      if (!hasPod) {
        setPodOpen(true);
        return;
      }
      if (!hasRecipient) {
        setRecipientOpen(true);
        return;
      }
    }
    void advanceStatus(next);
  }, [
    order,
    advanceStatus,
    currentLocation,
    geofenceRadiusM,
    isShiftActive,
    shiftLoading,
    hasPickupPhoto,
    hasPod,
    hasRecipient,
  ]);

  /** Photo of the order stored → straight on to the pickup confirmation. */
  const onPickupPhotoComplete = useCallback(() => {
    setPickupPhotoDone(true);
    setPickupPhotoOpen(false);
    setSignatureOpen(true);
  }, []);

  const onSignatureComplete = useCallback(async () => {
    setSignatureOpen(false);
    await advanceStatus(DriverStatus.PICKED_UP);
  }, [advanceStatus]);

  /** Setup photo stored → on to the recipient sign-off (unless on file). */
  const onPodComplete = useCallback(async () => {
    setPodDone(true);
    setPodOpen(false);
    if (!hasRecipient) {
      setRecipientOpen(true);
      return;
    }
    await advanceStatus(DriverStatus.COMPLETED);
  }, [advanceStatus, hasRecipient]);

  const onRecipientComplete = useCallback(async () => {
    setRecipientDone(true);
    setRecipientOpen(false);
    await advanceStatus(DriverStatus.COMPLETED);
  }, [advanceStatus]);

  /** pending: the request awaits dispatch review — the delivery is still ours,
   *  so stay on the screen and show the pending state. Otherwise (privileged
   *  immediate return) the order is no longer ours: sync the shared feed
   *  (End-shift guard unblocks) and leave the screen. */
  const onReturnComplete = useCallback(
    async (result: { pending: boolean }) => {
      setReturnOpen(false);
      await refreshDeliveries().catch((e) =>
        console.warn("Deliveries feed refresh failed:", e),
      );
      if (result.pending) {
        setPendingReturn(true);
        return;
      }
      router.back();
    },
    [refreshDeliveries, router],
  );

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
  const pickingUp = nextStatus === DriverStatus.PICKED_UP;

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

  // Arrival geofence for the sticky Next-Action: engaged only on the two
  // "arrived" steps, and only when GPS + target coords are both known.
  const nextDriverStatus = order.driverStatus
    ? getNextStatus(order.driverStatus as DriverStatus)
    : null;
  const arrivalCheck =
    nextDriverStatus === DriverStatus.ARRIVED_AT_VENDOR
      ? checkArrivalGeofence(
          currentLocation?.coordinates ?? null,
          addressTarget(order.pickupAddress),
          geofenceRadiusM,
        )
      : nextDriverStatus === DriverStatus.ARRIVED_TO_CLIENT
        ? checkArrivalGeofence(
            currentLocation?.coordinates ?? null,
            addressTarget(order.deliveryAddress),
            geofenceRadiusM,
          )
        : null;
  const geofenceBlocked =
    !!arrivalCheck && !arrivalCheck.allowed && arrivalCheck.distanceM !== null;

  // Self-serve return is pre-pickup only (mirrors the server's POST_PICKUP
  // guard) — once the driver holds the food, hand-back goes through dispatch.
  const canReturn =
    !isDone &&
    (order.driverStatus == null ||
      [
        DriverStatus.ASSIGNED,
        DriverStatus.EN_ROUTE_TO_VENDOR,
        DriverStatus.ARRIVED_AT_VENDOR,
      ].includes(order.driverStatus as DriverStatus));

  return (
    <div className="flex flex-col gap-3 px-2 pb-32">
      {/* Status header */}
      <DriverCard className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <StatusPill status={order.driverStatus} />
          <span className="font-mono text-[12px] font-semibold text-driver-subtle">
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
        {pendingReturn && !isDone ? (
          <div className="flex items-center gap-2 rounded-xl bg-driver-surface-alt px-3 py-2 text-[12.5px] font-semibold text-driver-muted">
            <Hourglass className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
            Return requested — awaiting dispatch
          </div>
        ) : rejectedReturn && !isDone ? (
          // A newer PENDING request supersedes the decline; otherwise explain
          // why the badge vanished and why this order still blocks end-shift.
          <ReturnDeclinedNotice
            key={rejectedReturn.id}
            requestId={rejectedReturn.id}
            notes={rejectedReturn.resolutionNotes}
          />
        ) : null}
      </DriverCard>

      {/* Timeline */}
      <DriverCard>
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-driver-subtle">
          Progress
        </div>
        <StatusTimeline status={order.driverStatus} timestamps={timestamps} />
      </DriverCard>

      {/* Pickup */}
      <DriverCard className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-driver-info" strokeWidth={2.4} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-driver-subtle">
            Pickup
          </span>
        </div>
        <div className="text-driver-pip font-semibold text-driver-text">{vendorName}</div>
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
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-driver-subtle">
            Drop-off
          </span>
        </div>
        <div className="text-driver-pip font-semibold text-driver-text">{clientName}</div>
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
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-driver-subtle">
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

      {isCompleted && podPhotoUrls.length > 0 ? (
        <DriverCard className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-driver-subtle" strokeWidth={2.4} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-driver-subtle">
              Proof of delivery
            </span>
            {podPhotoUrls.length > 1 ? (
              <span className="ml-auto text-[11px] font-semibold text-driver-subtle">
                {podPhotoUrls.length} photos
              </span>
            ) : null}
          </div>
          {podPhotoUrls.length === 1 ? (
            /* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Supabase URL; next/image would need a remote pattern per signed host */
            <img
              src={podPhotoUrls[0]}
              alt="Proof of delivery photo"
              className="max-h-80 w-full rounded-xl object-contain"
            />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {podPhotoUrls.map((url, index) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square overflow-hidden rounded-xl bg-driver-surface-alt"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Supabase URL */}
                  <img
                    src={url}
                    alt={`Proof of delivery photo ${index + 1} of ${podPhotoUrls.length}`}
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}
        </DriverCard>
      ) : null}

      {isCompleted && order.deliveryReceivedBy?.trim() ? (
        <DriverCard className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-driver-subtle" strokeWidth={2.4} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-driver-subtle">
              Received by
            </span>
          </div>
          <div className="text-[14px] font-semibold text-driver-text">
            {order.deliveryReceivedBy.trim()}
          </div>
        </DriverCard>
      ) : null}

      {/* Sticky action bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-driver-border bg-driver-glass px-4 pt-3 backdrop-blur-xl backdrop-saturate-150"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div className="mx-auto w-full max-w-2xl lg:max-w-5xl">
          {isDone ? (
            <div className="flex min-h-driver-action items-center justify-center gap-2 rounded-2xl bg-driver-success-bg text-driver-pip font-semibold text-driver-success-ink">
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.6} />
              {resolved.status === "CANCELLED" ? "Delivery cancelled" : "Delivery complete"}
            </div>
          ) : (
            <NextAction
              label={getDriverNextActionLabel(order.driverStatus)}
              sub="Next step"
              tone={completing ? "success" : "brand"}
              hint={
                geofenceBlocked
                  ? geofenceHint(arrivalCheck!.distanceM!)
                  : completing
                    ? "Photo + recipient signature or name required"
                    : pickingUp
                      ? "Photo of the order required"
                      : "Tap to update your status"
              }
              loading={isAdvancing}
              disabled={geofenceBlocked}
              onClick={handleNextAction}
            />
          )}
          {pendingReturn && !isDone ? (
            <div className="mt-2 flex w-full items-center justify-center gap-1.5 pb-1 text-center text-[13px] font-semibold text-driver-subtle">
              <Hourglass className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
              Return requested — awaiting dispatch
            </div>
          ) : canReturn ? (
            <button
              type="button"
              onClick={() => setReturnOpen(true)}
              className="mt-2 w-full pb-1 text-center text-[13px] font-semibold text-driver-subtle underline underline-offset-2"
            >
              Can&apos;t complete this delivery?
            </button>
          ) : null}
        </div>
      </div>

      {pickupPhotoOpen ? (
        <DriverPodSheet
          open={pickupPhotoOpen}
          onOpenChange={setPickupPhotoOpen}
          deliveryId={order.id}
          orderNumber={order.orderNumber}
          title="Photo of the order"
          requirementHint="Take a photo of the order at the vendor before confirming pickup"
          uploadEndpoint={`/api/orders/${encodeURIComponent(order.orderNumber)}/pickup-photo`}
          onComplete={onPickupPhotoComplete}
        />
      ) : null}

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
          maxPhotos={POD_MAX_PHOTOS}
          onComplete={onPodComplete}
        />
      ) : null}

      {recipientOpen ? (
        <DriverSignatureSheet
          open={recipientOpen}
          onOpenChange={setRecipientOpen}
          orderNumber={order.orderNumber}
          stage="delivery"
          uploadEndpoint={`/api/orders/${encodeURIComponent(order.orderNumber)}/recipient`}
          onComplete={onRecipientComplete}
        />
      ) : null}

      {returnOpen ? (
        <DriverReturnSheet
          open={returnOpen}
          onOpenChange={setReturnOpen}
          orderNumber={order.orderNumber}
          onComplete={(result) => void onReturnComplete(result)}
        />
      ) : null}
    </div>
  );
}

export default DriverDeliveryDetail;
