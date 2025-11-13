-- Add delivery cost and distance fields to catering_requests table
-- This provides transparency for helpdesk and operations teams
-- NOTE: Using camelCase column names to match existing Prisma schema convention

-- Add deliveryCost field to store the calculated delivery fee
ALTER TABLE public.catering_requests 
ADD COLUMN IF NOT EXISTS "deliveryCost" DECIMAL(10, 2);

-- Add deliveryDistance field to store the calculated distance in miles
ALTER TABLE public.catering_requests 
ADD COLUMN IF NOT EXISTS "deliveryDistance" DECIMAL(10, 2);

-- Add comments for documentation
COMMENT ON COLUMN public.catering_requests."deliveryCost" IS 'Calculated delivery fee for the order (includes base fee + mileage - discounts)';
COMMENT ON COLUMN public.catering_requests."deliveryDistance" IS 'Distance in miles between pickup and delivery locations';

-- Create indexes for potential queries/reporting
CREATE INDEX IF NOT EXISTS idx_catering_requests_delivery_cost ON public.catering_requests("deliveryCost") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS idx_catering_requests_delivery_distance ON public.catering_requests("deliveryDistance") WHERE "deletedAt" IS NULL;

