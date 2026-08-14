"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  CloudOff,
  MapPin,
  Navigation2,
  Play,
  Settings,
  Square,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDriverTracking } from "@/contexts/DriverTrackingContext";
import { DriverStatus } from "@/types/user";
import DriverLiveMap from "@/components/Driver/DriverLiveMap";
import {
  DriverButton,
  DriverCard,
  DriverScreen,
  HealthBar,
  NextAction,
  StateBlock,
  StatusPill,
  TypeBadge,
  formatDuration,
  getDriverNextActionLabel,
  getNextStatus,
  getStatusProgress,
} from "@/components/Driver/ui";
import { DriverPodSheet } from "@/components/Driver/ui/DriverPodSheet";
import { DriverReturnSheet } from "@/components/Driver/ui/DriverReturnSheet";
import { DriverSignatureSheet } from "@/components/Driver/ui/DriverSignatureSheet";
import { NavigateButton } from "@/components/Driver/ui/NavigateButton";
import {
  checkArrivalGeofence,
  geofenceHint,
  type GeofenceCheck,
} from "@/lib/driver/geofence";
import { useTrackingSettings } from "@/hooks/tracking/useTrackingSettings";
import type { DeliveryTracking } from "@/types/tracking";

/** Movement stages: the delivery has been started and MUST block ending the
 *  shift. Mirrors the server-side guard in endDriverShift. */
const IN_FLIGHT_STATUSES: DriverStatus[] = [
  DriverStatus.EN_ROUTE_TO_VENDOR,
  DriverStatus.ARRIVED_AT_VENDOR,
  DriverStatus.PICKED_UP,
  DriverStatus.EN_ROUTE_TO_CLIENT,
  DriverStatus.ARRIVED_TO_CLIENT,
];

/** True when this delivery should block ending the shift: it's mid-flight, or
 *  it's ASSIGNED with a pickup that is imminent (within `guardMs`) or overdue.
 *  Mirrors the server guard so the button state matches what the API will say.
 *  A guardMs of 0 disables the pickup guard entirely (in-flight still blocks). */
function blocksEndShift(delivery: DeliveryTracking, guardMs: number): boolean {
  if (IN_FLIGHT_STATUSES.includes(delivery.status)) return true;
  if (guardMs <= 0) return false;
  if (delivery.status === DriverStatus.ASSIGNED && delivery.scheduledPickupAt) {
    const pickup = new Date(delivery.scheduledPickupAt).getTime();
    return pickup <= Date.now() + guardMs;
  }
  return false;
}

/** Geofence only the "arrived" steps: block advancing when the driver is
 *  demonstrably far from the relevant stop (fail-open on unknown GPS/coords). */
function arrivalGeofence(
  delivery: DeliveryTracking,
  current: { lat: number; lng: number } | null,
  radiusM: number,
): GeofenceCheck | null {
  const next = getNextStatus(delivery.status);
  if (next === DriverStatus.ARRIVED_AT_VENDOR) {
    return checkArrivalGeofence(current, delivery.pickupLocation?.coordinates, radiusM);
  }
  if (next === DriverStatus.ARRIVED_TO_CLIENT) {
    return checkArrivalGeofence(current, delivery.deliveryLocation?.coordinates, radiusM);
  }
  return null;
}

interface PodTarget {
  deliveryId: string;
  orderNumber: string;
}

export default function DriverTrackingPortal() {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [podTarget, setPodTarget] = useState<PodTarget | null>(null);
  const [sigTarget, setSigTarget] = useState<PodTarget | null>(null);
  /** Order number of the delivery being handed back to dispatch (issue #508). */
  const [returnTarget, setReturnTarget] = useState<string | null>(null);
  // Jul-3 walk feedback: multiple staged/real orders made "Active deliveries"
  // confusing — filter by scheduled pickup date. `null` = no explicit choice,
  // in which case we default to Today whenever today has at least one.
  const [dayFilter, setDayFilter] = useState<"today" | "all" | null>(null);

  const {
    currentLocation,
    isTracking,
    accuracy,
    locationError,
    isRealtimeConnected,
    connectionMode,
    permissionState,
    isRequestingPermission,
    startTracking,
    stopTracking,
    requestLocationPermission,
    currentShift,
    isShiftActive,
    shiftLoading,
    shiftError,
    startShift,
    endShift,
    activeDeliveries,
    deliveriesLoading,
    deliveriesError,
    updateDeliveryStatus,
    refreshDeliveries,
    isOnline,
    queuedItems,
  } = useDriverTracking();

  const { settings } = useTrackingSettings();
  const endShiftGuardMs = settings.endShiftPickupGuardMinutes * 60_000;

  // Battery monitoring (best-effort; unsupported on many browsers).
  useEffect(() => {
    setMounted(true);
    if ("getBattery" in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          setBatteryLevel(battery.level * 100);
          battery.addEventListener("levelchange", () =>
            setBatteryLevel(battery.level * 100),
          );
        })
        .catch(() => {});
    }
  }, []);

  // Live shift timer.
  useEffect(() => {
    if (!isShiftActive || !currentShift?.startTime) return;
    const startedAt = new Date(currentShift.startTime).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isShiftActive, currentShift?.startTime]);

  // Auto-resume GPS when a shift is active but tracking isn't running.
  useEffect(() => {
    if (mounted && isShiftActive && !isTracking && !isRequestingPermission) {
      (async () => {
        if (permissionState !== "granted") {
          const granted = await requestLocationPermission();
          if (!granted) return;
        }
        startTracking();
      })();
    }
  }, [
    mounted,
    isShiftActive,
    isTracking,
    isRequestingPermission,
    permissionState,
    requestLocationPermission,
    startTracking,
  ]);

  const handleStartShift = async () => {
    let location = currentLocation;
    if (!location) {
      const granted = await requestLocationPermission();
      if (!granted) return;
      location = currentLocation;
    }
    if (!location) return;
    const ok = await startShift(location);
    if (ok) startTracking();
  };

  const endShiftBlockers = activeDeliveries.filter((d) =>
    blocksEndShift(d, endShiftGuardMs),
  ).length;
  // First blocking delivery — the one the "Return a delivery" escape hatch
  // targets. The feed keys these by order number (cateringRequestId /
  // onDemandId carry it; id is the deliveries-row fallback).
  const firstBlocker = activeDeliveries.find((d) =>
    blocksEndShift(d, endShiftGuardMs),
  );
  const firstBlockerOrderNumber = firstBlocker
    ? firstBlocker.cateringRequestId || firstBlocker.onDemandId || firstBlocker.id
    : null;

  const onReturnComplete = async () => {
    setReturnTarget(null);
    // Re-sync the feed so the End-shift button unblocks without a reload.
    await refreshDeliveries().catch(() => {
      /* best-effort — the next poll will still correct it */
    });
  };

  const handleEndShift = async () => {
    if (!currentShift?.id) return;
    // Backstop for the blocked button (mirrors the server guard). The button
    // stays tappable (aria-disabled, not `disabled`) so a stale client can
    // self-heal: explain the block AND re-check the server feed — a delivery
    // completed on another screen unblocks this button without a reload.
    if (endShiftBlockers > 0) {
      toast.error(
        `You still have ${endShiftBlockers} active or due ${endShiftBlockers === 1 ? "delivery" : "deliveries"}. Complete ${endShiftBlockers === 1 ? "it" : "them"} or return ${endShiftBlockers === 1 ? "it" : "them"} to dispatch before ending your shift.`,
      );
      void refreshDeliveries().catch(() => {
        /* best-effort re-check — the next poll will still correct it */
      });
      return;
    }
    let location = currentLocation;
    if (!location) {
      location = {
        driverId: currentShift.driverId,
        coordinates: { lat: 0, lng: 0 },
        accuracy: 0,
        speed: 0,
        heading: 0,
        isMoving: false,
        activityType: "stationary" as const,
        timestamp: new Date(),
      };
    }
    const ok = await endShift(currentShift.id, location);
    if (ok) stopTracking();
  };

  // Surface shift failures (e.g. the server's active-delivery guard) instead
  // of a button that silently does nothing. Effect-based so it reads the
  // freshly-set error, not the render-time closure value.
  useEffect(() => {
    if (shiftError) toast.error(shiftError);
  }, [shiftError]);

  const advanceStatus = async (deliveryId: string, status: DriverStatus) => {
    setUpdatingId(deliveryId);
    try {
      const ok = await updateDeliveryStatus(
        deliveryId,
        status,
        currentLocation || undefined,
      );
      if (!ok) {
        // The update failed server-side (auth, network, validation). Without
        // this the button just does nothing and the driver assumes a freeze.
        toast.error("Couldn't update the delivery status. Please try again.");
      }
      return ok;
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAdvance = (delivery: (typeof activeDeliveries)[number]) => {
    const next = getNextStatus(delivery.status);
    if (!next) return;
    // Backstop for the disabled button: never advance an "arrived" step while
    // the driver is demonstrably far from the stop.
    const geofence = arrivalGeofence(
      delivery,
      currentLocation?.coordinates ?? null,
      settings.arrivalGeofenceRadiusM,
    );
    if (geofence && !geofence.allowed && geofence.distanceM !== null) {
      toast.error(geofenceHint(geofence.distanceM));
      return;
    }
    const orderNumber =
      delivery.cateringRequestId || delivery.onDemandId || delivery.id;
    // The pickup step routes through vendor-signature capture (mandatory per
    // the 2026-06-22 decision — mirrors the gate in DriverDeliveryDetail; the
    // server also rejects an unsigned PICKED_UP).
    if (next === DriverStatus.PICKED_UP) {
      setSigTarget({ deliveryId: delivery.id, orderNumber });
      return;
    }
    // The final step routes through proof-of-delivery capture.
    if (next === DriverStatus.COMPLETED) {
      setPodTarget({ deliveryId: delivery.id, orderNumber });
      return;
    }
    advanceStatus(delivery.id, next);
  };

  const onPodComplete = async () => {
    if (!podTarget) return;
    const { deliveryId } = podTarget;
    // The upload already succeeded (and toasted) — close the sheet NOW instead
    // of holding it open across the status PATCH + deliveries refetch (2-5s on
    // LTE reads as a hang). A failed advance is surfaced by advanceStatus's
    // toast and retried from the delivery card. Mirrors DriverDeliveryDetail.
    setPodTarget(null);
    await advanceStatus(deliveryId, DriverStatus.COMPLETED);
  };

  const onSignatureComplete = async () => {
    if (!sigTarget) return;
    const { deliveryId } = sigTarget;
    // Same close-first semantics as POD.
    setSigTarget(null);
    await advanceStatus(deliveryId, DriverStatus.PICKED_UP);
  };

  const isPickupToday = (d?: Date) =>
    !!d && new Date(d).toDateString() === new Date().toDateString();
  const todayCount = activeDeliveries.filter((d) =>
    isPickupToday(d.scheduledPickupAt),
  ).length;
  const effectiveDayFilter =
    dayFilter ?? (todayCount > 0 ? "today" : "all");
  const visibleDeliveries =
    effectiveDayFilter === "all"
      ? activeDeliveries
      : activeDeliveries.filter((d) => isPickupToday(d.scheduledPickupAt));

  const formatPickup = (d: Date) =>
    isPickupToday(d)
      ? `today ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : d.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        }) +
        " " +
        d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const headerRight = useMemo(() => {
    if (!isShiftActive || !currentShift?.startTime) return null;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-driver-success-bg px-3 py-1.5">
        <span className="h-2 w-2 animate-driver-pulse rounded-full bg-driver-success" />
        <span className="font-mono text-[13px] font-semibold tabular-nums text-driver-success-ink">
          {formatDuration(elapsed)}
        </span>
      </span>
    );
  }, [isShiftActive, currentShift?.startTime, elapsed]);

  return (
    <DriverScreen
      title="Live tracking"
      subtitle={
        isShiftActive
          ? `Shift active · ${connectionMode === "realtime" && isRealtimeConnected ? "real-time" : "standard"}`
          : "Start a shift to begin"
      }
      right={headerRight}
    >
      <div className="space-y-4">
        <HealthBar
          online={mounted ? isOnline : true}
          realtime={isRealtimeConnected}
          gps={accuracy}
          battery={batteryLevel}
          queued={queuedItems}
        />

        {/* Show every active error — `a || b || c` masks shift/delivery
            failures whenever a location-permission error is present. */}
        {(
          [
            ["location", locationError],
            ["shift", shiftError],
            ["deliveries", deliveriesError],
          ] as Array<[string, string | null | undefined]>
        )
          .filter(([, message]) => Boolean(message))
          .map(([source, message]) => (
            <div
              key={source}
              className="flex items-start gap-2 rounded-2xl border border-driver-error/30 bg-driver-error-bg px-4 py-3 text-driver-error-ink"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-[13px] font-semibold">{message}</span>
            </div>
          ))}

        {!isOnline ? (
          <div className="flex items-center gap-2 rounded-2xl border border-driver-warning/30 bg-driver-warning-bg px-4 py-3 text-driver-warning-ink">
            <CloudOff className="h-4 w-4 shrink-0" />
            <span className="text-[13px] font-semibold">
              You&apos;re offline{queuedItems > 0 ? ` — ${queuedItems} updates queued` : ""}
            </span>
          </div>
        ) : null}

        {isShiftActive ? (
          <>
            {/* Live map */}
            <DriverCard className="overflow-hidden p-0">
              {currentLocation ? (
                <div className="h-64 w-full">
                  <DriverLiveMap
                    currentLocation={currentLocation}
                    activeDeliveries={activeDeliveries}
                    driverId={currentShift?.driverId}
                    shiftStartedAt={currentShift?.startTime}
                  />
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-3 bg-driver-surface-alt">
                  <MapPin className="h-10 w-10 text-driver-subtle" />
                  <p className="text-[13px] font-semibold text-driver-muted">
                    {isRequestingPermission
                      ? "Getting your location…"
                      : "Location not available"}
                  </p>
                  {!isRequestingPermission ? (
                    <DriverButton
                      variant="outline"
                      size="sm"
                      onClick={() => requestLocationPermission()}
                    >
                      <MapPin className="h-4 w-4" />
                      Enable location
                    </DriverButton>
                  ) : null}
                </div>
              )}
            </DriverCard>

            {/* Shift control bar */}
            <DriverCard className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-driver-text">
                    On shift
                  </div>
                  <div className="text-[11.5px] font-semibold text-driver-muted">
                    Since{" "}
                    {currentShift
                      ? new Date(currentShift.startTime).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : ""}
                  </div>
                  {endShiftBlockers > 0 ? (
                    <div className="mt-0.5 text-[11px] font-semibold text-driver-subtle">
                      {endShiftBlockers === 1
                        ? "1 delivery to finish or return first"
                        : `${endShiftBlockers} deliveries to finish or return first`}
                    </div>
                  ) : null}
                </div>
                {/* Blocked via aria-disabled (not `disabled`) so a tap still
                    reaches handleEndShift, which explains the block and
                    refreshes the feed — a stale count heals itself on tap. */}
                <DriverButton
                  variant="danger"
                  size="md"
                  onClick={handleEndShift}
                  loading={shiftLoading}
                  aria-disabled={endShiftBlockers > 0}
                  className={
                    endShiftBlockers > 0
                      ? "cursor-not-allowed opacity-50"
                      : undefined
                  }
                >
                  <Square className="h-4 w-4" />
                  End shift
                </DriverButton>
              </div>
              {/* Issue #508 escape hatch: a driver who can't start a blocking
                  assignment hands it back instead of being stuck on shift. */}
              {endShiftBlockers > 0 && firstBlockerOrderNumber ? (
                <DriverButton
                  variant="outline"
                  full
                  size="md"
                  onClick={() => setReturnTarget(firstBlockerOrderNumber)}
                >
                  Return a delivery to dispatch
                </DriverButton>
              ) : null}
            </DriverCard>

            {/* Active deliveries */}
            <section className="space-y-3">
              <h2 className="text-[14px] font-semibold uppercase tracking-[0.04em] text-driver-muted">
                Active deliveries
                {activeDeliveries.length > 0 ? ` — ${activeDeliveries.length} in progress` : ""}
              </h2>

              {activeDeliveries.length > 0 ? (
                <div className="flex gap-2" role="group" aria-label="Filter deliveries by date">
                  {(
                    [
                      { key: "today", label: `Today (${todayCount})` },
                      { key: "all", label: `All (${activeDeliveries.length})` },
                    ] as const
                  ).map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setDayFilter(chip.key)}
                      aria-pressed={effectiveDayFilter === chip.key}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-[12.5px] font-semibold transition-colors",
                        effectiveDayFilter === chip.key
                          ? "border-transparent bg-driver-brand/15 text-driver-on-brand"
                          : "border-driver-border bg-transparent text-driver-subtle",
                      )}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {activeDeliveries.length === 0 ? (
                <StateBlock
                  icon={CheckCircle2}
                  title="No active deliveries"
                  body="New assignments will appear here while you're on shift."
                />
              ) : visibleDeliveries.length === 0 ? (
                <StateBlock
                  icon={CheckCircle2}
                  title="Nothing scheduled for today"
                  body='Switch to "All" to see your other assignments.'
                />
              ) : (
                visibleDeliveries.map((delivery, idx) => {
                  const orderNumber =
                    delivery.cateringRequestId ||
                    delivery.onDemandId ||
                    delivery.id;
                  const orderType = delivery.cateringRequestId
                    ? "catering"
                    : "on_demand";
                  const next = getNextStatus(delivery.status);
                  const progress = getStatusProgress(delivery.status);
                  const coords = delivery.deliveryLocation?.coordinates;
                  const lng = coords?.[0];
                  const lat = coords?.[1];
                  const lead = idx === 0;
                  const atClient =
                    delivery.status === DriverStatus.ARRIVED_TO_CLIENT;
                  const geofence = arrivalGeofence(
                    delivery,
                    currentLocation?.coordinates ?? null,
                    settings.arrivalGeofenceRadiusM,
                  );
                  const geofenceBlocked =
                    !!geofence && !geofence.allowed && geofence.distanceM !== null;

                  return (
                    <DriverCard
                      key={delivery.id}
                      className={cn(
                        "space-y-3",
                        lead && "border-[1.5px] border-driver-brand",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <TypeBadge type={orderType} />
                        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-semibold text-driver-muted">
                          #{orderNumber}
                        </span>
                        <div className="shrink-0">
                          <StatusPill status={delivery.status} size="sm" />
                        </div>
                      </div>

                      {delivery.scheduledPickupAt ? (
                        <div className="text-[12px] font-semibold text-driver-muted">
                          Pickup {formatPickup(delivery.scheduledPickupAt)}
                        </div>
                      ) : null}

                      {delivery.estimatedArrival ? (
                        <div className="text-[12px] font-semibold text-driver-muted">
                          ETA{" "}
                          {new Date(delivery.estimatedArrival).toLocaleTimeString(
                            [],
                            { hour: "numeric", minute: "2-digit" },
                          )}
                        </div>
                      ) : null}

                      {/* progress bar */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-driver-surface-alt">
                        <div
                          className="h-full rounded-full bg-driver-brand transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {next ? (
                        <NextAction
                          label={getDriverNextActionLabel(delivery.status)}
                          sub={atClient ? "Final step" : "Next step"}
                          tone={atClient ? "success" : "brand"}
                          icon={atClient ? CheckCircle2 : Navigation2}
                          hint={
                            geofenceBlocked
                              ? geofenceHint(geofence!.distanceM!)
                              : lead
                                ? "Tap to update your status"
                                : undefined
                          }
                          loading={updatingId === delivery.id}
                          disabled={deliveriesLoading || geofenceBlocked}
                          onClick={() => handleAdvance(delivery)}
                        />
                      ) : (
                        <div className="flex items-center gap-2 rounded-2xl bg-driver-success-bg px-4 py-3 text-driver-success-ink">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-[13px] font-semibold">
                            Delivered
                          </span>
                        </div>
                      )}

                      {typeof lat === "number" && typeof lng === "number" ? (
                        <NavigateButton target={{ lat, lng }} label="Navigate" />
                      ) : null}
                    </DriverCard>
                  );
                })
              )}
            </section>
          </>
        ) : (
          /* Pre-shift permission flow */
          <DriverCard className="space-y-4">
            <div className="flex flex-col items-center py-4 text-center">
              <Truck className="mb-2 h-12 w-12 text-driver-subtle" />
              <p className="text-[17px] font-semibold text-driver-text">
                {permissionState === "denied"
                  ? "Location is turned off"
                  : currentLocation
                    ? "You're ready to roll"
                    : "Location access needed"}
              </p>
              <p className="mt-1 max-w-xs text-[13px] font-semibold text-driver-muted">
                {permissionState === "denied"
                  ? "Enable location in your browser settings, then try again."
                  : "We use your location to track your shift and deliveries."}
              </p>
            </div>

            {permissionState === "denied" ? (
              <DriverButton
                variant="outline"
                full
                size="lg"
                onClick={() => requestLocationPermission()}
                loading={isRequestingPermission}
              >
                <Settings className="h-4 w-4" />
                Try again
              </DriverButton>
            ) : !currentLocation ? (
              <DriverButton
                variant="brand"
                full
                size="lg"
                onClick={() => requestLocationPermission()}
                loading={isRequestingPermission}
              >
                <MapPin className="h-4 w-4" />
                Request location permission
              </DriverButton>
            ) : (
              <DriverButton
                variant="brand"
                full
                size="lg"
                onClick={handleStartShift}
                loading={shiftLoading || isRequestingPermission}
              >
                <Play className="h-4 w-4" />
                Start shift
              </DriverButton>
            )}
          </DriverCard>
        )}
      </div>

      {sigTarget ? (
        <DriverSignatureSheet
          open={!!sigTarget}
          onOpenChange={(o) => !o && setSigTarget(null)}
          orderNumber={sigTarget.orderNumber}
          onComplete={() => void onSignatureComplete()}
        />
      ) : null}

      {podTarget ? (
        <DriverPodSheet
          open={!!podTarget}
          onOpenChange={(o) => !o && setPodTarget(null)}
          deliveryId={podTarget.deliveryId}
          orderNumber={podTarget.orderNumber}
          uploadEndpoint={`/api/orders/${encodeURIComponent(podTarget.orderNumber)}/pod`}
          onComplete={onPodComplete}
        />
      ) : null}

      {returnTarget ? (
        <DriverReturnSheet
          open={!!returnTarget}
          onOpenChange={(o) => !o && setReturnTarget(null)}
          orderNumber={returnTarget}
          onComplete={() => void onReturnComplete()}
        />
      ) : null}
    </DriverScreen>
  );
}
