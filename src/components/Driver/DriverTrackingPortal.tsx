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
    isOnline,
    queuedItems,
  } = useDriverTracking();

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

  const handleEndShift = async () => {
    if (!currentShift?.id) return;
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
    const orderNumber =
      delivery.cateringRequestId || delivery.onDemandId || delivery.id;
    // The final step routes through proof-of-delivery capture.
    if (next === DriverStatus.COMPLETED) {
      setPodTarget({ deliveryId: delivery.id, orderNumber });
      return;
    }
    advanceStatus(delivery.id, next);
  };

  const onPodComplete = async () => {
    if (!podTarget) return;
    // Keep the POD sheet open on failure so the driver can retry instead of
    // having to re-capture the proof after only seeing the error toast.
    const ok = await advanceStatus(podTarget.deliveryId, DriverStatus.COMPLETED);
    if (ok) setPodTarget(null);
  };

  const headerRight = useMemo(() => {
    if (!isShiftActive || !currentShift?.startTime) return null;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-driver-success-bg px-3 py-1.5">
        <span className="h-2 w-2 animate-driver-pulse rounded-full bg-driver-success" />
        <span className="font-mono text-[13px] font-extrabold tabular-nums text-driver-success-ink">
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
            <span className="text-[13px] font-bold">
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
            <DriverCard className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-extrabold text-driver-text">
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
              </div>
              <DriverButton
                variant="danger"
                size="md"
                onClick={handleEndShift}
                loading={shiftLoading}
              >
                <Square className="h-4 w-4" />
                End shift
              </DriverButton>
            </DriverCard>

            {/* Active deliveries */}
            <section className="space-y-3">
              <h2 className="text-[14px] font-extrabold uppercase tracking-[0.04em] text-driver-muted">
                Active deliveries
                {activeDeliveries.length > 0 ? ` — ${activeDeliveries.length} in progress` : ""}
              </h2>

              {activeDeliveries.length === 0 ? (
                <StateBlock
                  icon={CheckCircle2}
                  title="No active deliveries"
                  body="New assignments will appear here while you're on shift."
                />
              ) : (
                activeDeliveries.map((delivery, idx) => {
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
                        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-bold text-driver-muted">
                          #{orderNumber}
                        </span>
                        <div className="shrink-0">
                          <StatusPill status={delivery.status} size="sm" />
                        </div>
                      </div>

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
                          hint={lead ? "Tap to update your status" : undefined}
                          loading={updatingId === delivery.id}
                          disabled={deliveriesLoading}
                          onClick={() => handleAdvance(delivery)}
                        />
                      ) : (
                        <div className="flex items-center gap-2 rounded-2xl bg-driver-success-bg px-4 py-3 text-driver-success-ink">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-[13px] font-extrabold">
                            Delivered
                          </span>
                        </div>
                      )}

                      {typeof lat === "number" && typeof lng === "number" ? (
                        <a
                          href={`https://maps.google.com/?q=${lat},${lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 text-[12.5px] font-bold text-driver-on-brand"
                        >
                          <Navigation2 className="h-3.5 w-3.5" />
                          Navigate
                        </a>
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
              <p className="text-[17px] font-extrabold text-driver-text">
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
    </DriverScreen>
  );
}
