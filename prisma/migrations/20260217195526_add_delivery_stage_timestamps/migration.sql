-- Add missing delivery stage timestamp columns for full timeline tracking (REA-322)
ALTER TABLE public.deliveries
  ADD COLUMN arrived_at_vendor_at TIMESTAMPTZ,
  ADD COLUMN en_route_at TIMESTAMPTZ,
  ADD COLUMN arrived_at_client_at TIMESTAMPTZ;
