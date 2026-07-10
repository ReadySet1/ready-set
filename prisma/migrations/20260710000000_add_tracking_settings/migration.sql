-- Admin-editable driver-tracking settings. Singleton row (id = 1) enforced by
-- a CHECK constraint. Column defaults mirror TRACKING_SETTINGS_DEFAULTS in
-- src/types/tracking-settings.ts; application code fails open to those
-- defaults when the row or table is absent.
CREATE TABLE "public"."tracking_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "arrival_geofence_radius_m" INTEGER NOT NULL DEFAULT 150,
    "stale_gps_threshold_seconds" INTEGER NOT NULL DEFAULT 300,
    "end_shift_pickup_guard_minutes" INTEGER NOT NULL DEFAULT 120,
    "location_update_interval_seconds" INTEGER NOT NULL DEFAULT 5,
    "mileage_gps_accuracy_threshold_m" INTEGER NOT NULL DEFAULT 100,
    "mileage_max_speed_mph" INTEGER NOT NULL DEFAULT 95,
    "max_reasonable_shift_miles" INTEGER NOT NULL DEFAULT 310,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "tracking_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tracking_settings_singleton" CHECK ("id" = 1)
);

-- Seed the singleton row so the admin UI has something to edit immediately.
INSERT INTO "public"."tracking_settings" ("id", "updated_at")
VALUES (1, NOW())
ON CONFLICT ("id") DO NOTHING;
