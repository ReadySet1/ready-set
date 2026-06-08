import { DriverStatus } from "@/types/user";
import {
  DRIVER_STAGE_CONFIG,
  getDriverNextActionLabel,
  resolveDriverStatus,
  STATUS_ORDER,
} from "../status-config";

describe("status-config", () => {
  describe("resolveDriverStatus", () => {
    it("maps every stage to a friendly label + kind", () => {
      expect(resolveDriverStatus(DriverStatus.ASSIGNED)).toMatchObject({
        label: "Assigned",
        kind: "action",
      });
      expect(resolveDriverStatus(DriverStatus.EN_ROUTE_TO_VENDOR)).toMatchObject({
        label: "En route to vendor",
        kind: "motion",
      });
      expect(resolveDriverStatus(DriverStatus.PICKED_UP)).toMatchObject({
        label: "Picked up",
        kind: "done",
      });
      expect(resolveDriverStatus(DriverStatus.COMPLETED)).toMatchObject({
        label: "Delivered",
        kind: "done",
      });
    });

    it("uses the semantic color bundle that matches the kind", () => {
      // motion → info/blue
      expect(resolveDriverStatus(DriverStatus.EN_ROUTE_TO_CLIENT).classes.bg).toBe(
        "bg-driver-info-bg",
      );
      // action → warning/amber
      expect(resolveDriverStatus(DriverStatus.ARRIVED_AT_VENDOR).classes.dot).toBe(
        "bg-driver-warning",
      );
      // done → success/green
      expect(resolveDriverStatus(DriverStatus.COMPLETED).classes.ink).toBe(
        "text-driver-success-ink",
      );
    });

    it("handles cancelled and unknown/null statuses", () => {
      expect(resolveDriverStatus("CANCELLED")).toMatchObject({
        label: "Cancelled",
        kind: "cancelled",
      });
      expect(resolveDriverStatus(null).label).toBe("Not started");
      expect(resolveDriverStatus(undefined).label).toBe("Not started");
    });

    it("covers all seven stages in STATUS_ORDER", () => {
      expect(STATUS_ORDER).toHaveLength(7);
      for (const stage of STATUS_ORDER) {
        expect(DRIVER_STAGE_CONFIG[stage]).toBeDefined();
      }
    });
  });

  describe("getDriverNextActionLabel", () => {
    it("returns the intent label for advancing from a stage", () => {
      expect(getDriverNextActionLabel(null)).toBe("On my way to vendor");
      expect(getDriverNextActionLabel(DriverStatus.ASSIGNED)).toBe(
        "On my way to vendor",
      );
      expect(getDriverNextActionLabel(DriverStatus.ARRIVED_TO_CLIENT)).toBe(
        "Complete delivery",
      );
    });

    it("returns Done at the terminal stage", () => {
      expect(getDriverNextActionLabel(DriverStatus.COMPLETED)).toBe("Done");
    });
  });
});
