"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, TriangleAlert } from "lucide-react";
import { encodeOrderNumber } from "@/utils/order/urlEncoding";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DeliveryCard,
  DriverButton,
  Segmented,
  StateBlock,
  formatTime,
} from "@/components/Driver/ui";
import type { ApiDelivery } from "@/hooks/driver/useDriverDeliveriesFeed";

type Tab = "today" | "upcoming" | "completed";

const TABS: { value: Tab; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

function formatCurrency(value: string | number | null | undefined): string {
  if (value == null) return "";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return typeof value === "string" ? value : "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function pickupName(d: ApiDelivery): string {
  return d.address?.street1 || d.address?.city || "Pickup";
}
function dropoffName(d: ApiDelivery): string {
  return (
    d.user?.name ||
    d.client_attention ||
    d.delivery_address?.street1 ||
    d.delivery_address?.city ||
    "Delivery"
  );
}
function metaFor(d: ApiDelivery): string | undefined {
  if (d.delivery_type === "catering" && d.headcount)
    return `${d.headcount} guests`;
  if (d.delivery_type === "on_demand" && d.itemDelivered)
    return d.itemDelivered;
  return undefined;
}

interface DriverDeliveryListProps {
  deliveries: ApiDelivery[];
  loading: boolean;
  error: string | null;
  /** Re-fetch the shared feed (used by the error-state retry). */
  onRetry: () => void;
}

/**
 * Redesigned driver deliveries list (Home). Renders the shared delivery feed
 * (from `useDriverDeliveriesFeed`, lifted to the Home page) into Today/Upcoming/
 * Completed tabs as DeliveryCards that open the Delivery Detail view. Because the
 * data is passed in from the same feed that drives the Home "N active" count,
 * the count and the list are always consistent. Status advancement lives on
 * Detail / Live Tracking (the "one dominant action").
 */
export function DriverDeliveryList({
  deliveries,
  loading,
  error,
  onRetry,
}: DriverDeliveryListProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("today");

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return deliveries.filter((d) => {
      const pickup = new Date(d.pickupDateTime);
      if (tab === "today") return pickup >= today && pickup < tomorrow;
      if (tab === "upcoming") return pickup >= tomorrow;
      return !!d.completeDateTime;
    });
  }, [deliveries, tab]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-extrabold uppercase tracking-[0.04em] text-driver-muted">
          Deliveries
        </h2>
      </div>

      <Segmented options={TABS} value={tab} onChange={setTab} aria-label="Delivery filter" />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-driver-block w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <StateBlock
          icon={TriangleAlert}
          title="Couldn't load deliveries"
          body={error}
          action={
            <DriverButton variant="outline" onClick={onRetry}>
              Retry
            </DriverButton>
          }
        />
      ) : filtered.length === 0 ? (
        <StateBlock
          icon={Inbox}
          title={
            tab === "today"
              ? "No deliveries today"
              : tab === "upcoming"
                ? "Nothing upcoming"
                : "No completed deliveries"
          }
          body={
            tab === "completed"
              ? "Completed deliveries from the last few weeks will appear here."
              : "New assignments will show up here when they're ready."
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((d) => (
            <DeliveryCard
              key={d.id}
              orderNumber={d.orderNumber}
              type={d.delivery_type}
              status={d.driverStatus}
              pickupName={pickupName(d)}
              dropoffName={dropoffName(d)}
              timeLabel={formatTime(d.pickupDateTime)}
              meta={metaFor(d)}
              total={formatCurrency(d.order_total)}
              onClick={() =>
                router.push(
                  `/driver/deliveries/${encodeOrderNumber(d.orderNumber)}`,
                )
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
