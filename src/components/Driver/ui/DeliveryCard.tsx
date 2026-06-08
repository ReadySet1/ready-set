"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DriverStatus } from "@/types/user";
import { DriverCard } from "./Card";
import { StatusPill } from "./StatusPill";
import { TypeBadge, type DeliveryKind } from "./TypeBadge";

interface DeliveryCardProps {
  orderNumber: string;
  type: DeliveryKind | string | null | undefined;
  status: DriverStatus | string | null | undefined;
  /** Pickup (vendor) place name. */
  pickupName: string;
  /** Dropoff (client) place name. */
  dropoffName: string;
  /** e.g. "11:15 AM" pickup window or ETA. */
  timeLabel?: string;
  /** Left meta, e.g. "45 guests" or "2 × pastry boxes". */
  meta?: string;
  /** e.g. "4.2 mi". */
  miles?: string;
  /** Formatted order total, e.g. "$486.50". */
  total?: string;
  /** Highlight the lead/active card with an amber border. */
  lead?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Delivery summary card used in the Home list and Tracking stack. */
export function DeliveryCard({
  orderNumber,
  type,
  status,
  pickupName,
  dropoffName,
  timeLabel,
  meta,
  miles,
  total,
  lead,
  onClick,
  className,
}: DeliveryCardProps) {
  return (
    <DriverCard
      interactive={!!onClick}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-3",
        lead && "border-[1.5px] border-driver-brand",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <TypeBadge type={type} />
        <span className="font-mono text-[12.5px] font-bold text-driver-muted">
          {orderNumber}
        </span>
        <div className="flex-1" />
        <StatusPill status={status} size="sm" />
      </div>

      {/* Pickup → dropoff stops */}
      <div className="flex flex-col gap-2">
        <Stop tone="info" name={pickupName} />
        <div className="ml-driver-nudge h-3 w-0.5 bg-driver-border" />
        <Stop tone="brand" name={dropoffName} />
      </div>

      <div className="flex items-center justify-between border-t border-driver-border pt-2.5">
        <span className="truncate text-[11.5px] font-semibold text-driver-muted">
          {[timeLabel, meta, miles].filter(Boolean).join(" · ")}
        </span>
        <div className="flex items-center gap-1">
          {total ? (
            <span className="text-[14px] font-extrabold text-driver-text">
              {total}
            </span>
          ) : null}
          {onClick ? (
            <ChevronRight className="h-4 w-4 text-driver-subtle" strokeWidth={2.4} />
          ) : null}
        </div>
      </div>
    </DriverCard>
  );
}

function Stop({ tone, name }: { tone: "info" | "brand"; name: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-driver-surface",
          tone === "info" ? "bg-driver-info" : "bg-driver-brand",
        )}
      />
      <span className="truncate text-[13.5px] font-bold text-driver-text">
        {name}
      </span>
    </div>
  );
}
