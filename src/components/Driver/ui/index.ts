// Driver app primitive kit (mobile-first redesign).
// All components assume they render inside a `.driver-theme` scope.

export { DriverThemeProvider, useDriverTheme } from "./DriverThemeProvider";
export type { DriverThemeMode } from "./DriverThemeProvider";
export { DriverScreen } from "./DriverScreen";
export { BottomNav } from "./BottomNav";
export { ShiftPill } from "./ShiftPill";
export { formatDuration, formatDurationShort, formatTime } from "./format";
export { DriverCard } from "./Card";
export { DriverButton } from "./DriverButton";
export { StatusPill } from "./StatusPill";
export { TypeBadge } from "./TypeBadge";
export type { DeliveryKind } from "./TypeBadge";
export { Segmented } from "./Segmented";
export type { SegmentedOption } from "./Segmented";
export { HealthBar } from "./HealthBar";
export { StatTile } from "./StatTile";
export { NextAction } from "./NextAction";
export { StatusTimeline } from "./StatusTimeline";
export { DeliveryCard } from "./DeliveryCard";
export { StateBlock, Spinner } from "./StateBlock";
export { DriverProfileSheet } from "./DriverProfileSheet";
export { DriverPodSheet } from "./DriverPodSheet";

export {
  DRIVER_STAGE_CONFIG,
  resolveDriverStatus,
  getDriverNextActionLabel,
  getNextStatus,
  getStatusIndex,
  getStatusProgress,
  isDeliveryCompleted,
  STATUS_ORDER,
} from "./status-config";
export type {
  StatusKind,
  DriverStageConfig,
  ResolvedStatus,
} from "./status-config";
