/**
 * Driver-facing status configuration for the redesigned driver UI.
 *
 * This is the single source of truth for how the 7-stage delivery lifecycle is
 * *presented* in the new driver experience: friendlier labels (per the design
 * handoff) and the semantic "kind" that drives color everywhere (timeline,
 * status pills, cards, Next-Action button).
 *
 * IMPORTANT: this does NOT replace `src/lib/delivery-status-transitions.ts`.
 * The transition *logic* (ordering, getNextStatus, progress, validation) is
 * reused unchanged from there — admin and other surfaces still depend on the
 * shared STATUS_LABELS. We only override the display copy + color mapping here,
 * scoped to the driver app. Enum values are untouched.
 */

import { DriverStatus } from "@/types/user";
import {
  getNextStatus,
  getStatusIndex,
  getStatusProgress,
  isDeliveryCompleted,
  STATUS_ORDER,
} from "@/lib/delivery-status-transitions";

/** Visual language: motion = blue (driver moving), action = amber (driver must
 *  act), done = green (sub-goal complete), cancelled = red. */
export type StatusKind = "motion" | "action" | "done" | "cancelled";

export interface DriverStageConfig {
  /** Friendly label shown in the new UI. */
  label: string;
  /** Short label for compact contexts (cards/timeline dots). */
  short: string;
  kind: StatusKind;
  /** Intent label for advancing FROM this stage (the Next-Action wording). */
  next: string | null;
}

/** Per-stage display config, keyed by the real DriverStatus enum value. */
export const DRIVER_STAGE_CONFIG: Record<DriverStatus, DriverStageConfig> = {
  [DriverStatus.ASSIGNED]: {
    label: "Assigned",
    short: "Assigned",
    kind: "action",
    next: "On my way to vendor",
  },
  [DriverStatus.EN_ROUTE_TO_VENDOR]: {
    label: "En route to vendor",
    short: "To vendor",
    kind: "motion",
    next: "I've arrived at vendor",
  },
  [DriverStatus.ARRIVED_AT_VENDOR]: {
    label: "Arrived at vendor",
    short: "At vendor",
    kind: "action",
    next: "Picked up the order",
  },
  [DriverStatus.PICKED_UP]: {
    label: "Picked up",
    short: "Picked up",
    kind: "done",
    next: "On my way to client",
  },
  [DriverStatus.EN_ROUTE_TO_CLIENT]: {
    label: "En route to client",
    short: "En route",
    kind: "motion",
    next: "I've arrived at client",
  },
  [DriverStatus.ARRIVED_TO_CLIENT]: {
    label: "Arrived at client",
    short: "At client",
    kind: "action",
    next: "Complete delivery",
  },
  [DriverStatus.COMPLETED]: {
    label: "Delivered",
    short: "Delivered",
    kind: "done",
    next: null,
  },
};

/** Tailwind class bundle for a given status kind, using the scoped driver
 *  tokens (`.driver-theme`). */
export interface StatusKindClasses {
  /** pill / chip background */
  bg: string;
  /** pill / chip text (ink) */
  ink: string;
  /** solid accent (dot, ring, fill) */
  dot: string;
  /** solid color as text (for emphasis) */
  text: string;
}

const KIND_CLASSES: Record<StatusKind, StatusKindClasses> = {
  motion: {
    bg: "bg-driver-info-bg",
    ink: "text-driver-info-ink",
    dot: "bg-driver-info",
    text: "text-driver-info",
  },
  action: {
    bg: "bg-driver-warning-bg",
    ink: "text-driver-warning-ink",
    dot: "bg-driver-warning",
    text: "text-driver-warning",
  },
  done: {
    bg: "bg-driver-success-bg",
    ink: "text-driver-success-ink",
    dot: "bg-driver-success",
    text: "text-driver-success",
  },
  cancelled: {
    bg: "bg-driver-error-bg",
    ink: "text-driver-error-ink",
    dot: "bg-driver-error",
    text: "text-driver-error",
  },
};

export interface ResolvedStatus {
  status: DriverStatus | "CANCELLED" | null;
  label: string;
  short: string;
  kind: StatusKind;
  classes: StatusKindClasses;
}

const CANCELLED = "CANCELLED" as const;

/** Resolve any status value (enum, raw string, null) to display config. */
export function resolveDriverStatus(
  status: DriverStatus | string | null | undefined,
): ResolvedStatus {
  if (status === CANCELLED || status === "cancelled") {
    return {
      status: CANCELLED,
      label: "Cancelled",
      short: "Cancelled",
      kind: "cancelled",
      classes: KIND_CLASSES.cancelled,
    };
  }

  const cfg = status
    ? DRIVER_STAGE_CONFIG[status as DriverStatus]
    : undefined;

  if (!cfg) {
    // Unknown / not-started → neutral "action" presentation.
    return {
      status: null,
      label: status ? String(status) : "Not started",
      short: status ? String(status) : "Not started",
      kind: "action",
      classes: KIND_CLASSES.action,
    };
  }

  return {
    status: status as DriverStatus,
    label: cfg.label,
    short: cfg.short,
    kind: cfg.kind,
    classes: KIND_CLASSES[cfg.kind],
  };
}

/** Friendly Next-Action label for advancing from the current status. */
export function getDriverNextActionLabel(
  status: DriverStatus | string | null | undefined,
): string {
  if (!status) return DRIVER_STAGE_CONFIG[DriverStatus.ASSIGNED].next ?? "Start";
  const cfg = DRIVER_STAGE_CONFIG[status as DriverStatus];
  return cfg?.next ?? "Done";
}

// Re-export the shared transition helpers so the driver UI imports everything
// status-related from one module.
export {
  getNextStatus,
  getStatusIndex,
  getStatusProgress,
  isDeliveryCompleted,
  STATUS_ORDER,
};
