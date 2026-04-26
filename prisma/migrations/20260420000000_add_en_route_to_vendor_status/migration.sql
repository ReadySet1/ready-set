-- Add EN_ROUTE_TO_VENDOR status to DriverStatus enum
ALTER TYPE public."DriverStatus" ADD VALUE IF NOT EXISTS 'EN_ROUTE_TO_VENDOR';

-- Add en_route_to_vendor_at timestamp column to deliveries table
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS en_route_to_vendor_at TIMESTAMPTZ(6);
