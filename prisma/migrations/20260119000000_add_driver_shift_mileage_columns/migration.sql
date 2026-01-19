-- AddMileageColumns
-- Add mileage tracking columns to driver_shifts table for distance reporting

-- Primary distance in miles (calculated or final value)
ALTER TABLE "driver_shifts" ADD COLUMN IF NOT EXISTS "total_distance_miles" DOUBLE PRECISION;

-- GPS-calculated distance for audit purposes
ALTER TABLE "driver_shifts" ADD COLUMN IF NOT EXISTS "gps_distance_miles" DOUBLE PRECISION;

-- Client/driver reported distance
ALTER TABLE "driver_shifts" ADD COLUMN IF NOT EXISTS "reported_distance_miles" DOUBLE PRECISION;

-- Source of mileage data: gps, odometer, manual, hybrid
ALTER TABLE "driver_shifts" ADD COLUMN IF NOT EXISTS "mileage_source" VARCHAR(20);
