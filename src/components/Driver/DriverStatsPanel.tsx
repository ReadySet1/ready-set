"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Gauge,
  Loader,
  Package,
  Route,
} from "lucide-react";
import type { StatsPeriod } from "@/services/tracking/driver-stats";
import { useDriverStats } from "@/hooks/tracking/useDriverStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented, StatTile } from "@/components/Driver/ui";

interface DriverStatsPanelProps {
  driverId: string;
}

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

function pct(n: number | undefined): string | undefined {
  if (n == null || Number.isNaN(n)) return undefined;
  const rounded = Math.round(n);
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}

/** Performance panel: period selector + 3×2 stat tile grid, with trend deltas
 *  on week/month views. Reuses the existing useDriverStats hook. */
export function DriverStatsPanel({ driverId }: DriverStatsPanelProps) {
  const [period, setPeriod] = useState<StatsPeriod>("today");
  const { data, isLoading } = useDriverStats({ driverId, period, enabled: !!driverId });

  const showTrends = period === "week" || period === "month";

  return (
    <section className="space-y-3">
      <h2 className="text-[14px] font-extrabold uppercase tracking-[0.04em] text-driver-muted">
        Performance
      </h2>

      <Segmented
        options={PERIODS}
        value={period}
        onChange={setPeriod}
        small
        aria-label="Stats period"
      />

      {isLoading || !data ? (
        <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-driver-tile rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6">
          <StatTile
            icon={Package}
            label="Deliveries"
            value={data.deliveryStats.total}
            sub={`${data.deliveryStats.completed} done`}
            delta={showTrends ? pct(data.trends?.deliveryChange) : undefined}
            accent
          />
          <StatTile
            icon={CheckCircle2}
            label="Completed"
            value={data.deliveryStats.completed}
          />
          <StatTile
            icon={Loader}
            label="In progress"
            value={data.deliveryStats.inProgress}
          />
          <StatTile
            icon={Route}
            label="Miles"
            value={Math.round(data.distanceStats.totalMiles)}
            delta={showTrends ? pct(data.trends?.distanceChange) : undefined}
          />
          <StatTile
            icon={Gauge}
            label="Avg mi/drop"
            value={data.distanceStats.averageMilesPerDelivery.toFixed(1)}
          />
          <StatTile
            icon={Clock}
            label="Hours"
            value={data.shiftStats.totalHoursWorked.toFixed(1)}
            sub={`${data.shiftStats.totalShifts} shifts`}
          />
        </div>
      )}
    </section>
  );
}
