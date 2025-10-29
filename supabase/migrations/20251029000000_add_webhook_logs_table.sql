-- Create webhook_logs table to track carrier webhook success/failure rates
-- This enables real-time monitoring of carrier integration health
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  response_time INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint to ensure carrier_id is not empty
  CONSTRAINT webhook_logs_carrier_id_check CHECK (carrier_id <> '')
);

-- Create index for efficient carrier-specific queries
CREATE INDEX IF NOT EXISTS idx_webhook_logs_carrier_id ON public.webhook_logs(carrier_id);

-- Create composite index for calculating success rates per carrier
-- This index optimizes queries that filter by carrier_id, success, and time range
CREATE INDEX IF NOT EXISTS idx_webhook_logs_carrier_success ON public.webhook_logs(carrier_id, success, created_at DESC);

-- Create index for order-specific lookups
CREATE INDEX IF NOT EXISTS idx_webhook_logs_order_number ON public.webhook_logs(order_number);

-- Add comments to document the table and columns
COMMENT ON TABLE public.webhook_logs IS 'Tracks all webhook attempts to carrier systems for monitoring integration health and calculating success rates';
COMMENT ON COLUMN public.webhook_logs.carrier_id IS 'Carrier identifier (e.g., ''catervalley'') matching CarrierConfig.id';
COMMENT ON COLUMN public.webhook_logs.order_number IS 'Order number that was included in the webhook payload';
COMMENT ON COLUMN public.webhook_logs.status IS 'Internal driver status that was being sent';
COMMENT ON COLUMN public.webhook_logs.success IS 'Whether the webhook call succeeded';
COMMENT ON COLUMN public.webhook_logs.error_message IS 'Error message if the webhook failed';
COMMENT ON COLUMN public.webhook_logs.response_time IS 'Response time in milliseconds';

-- Enable Row Level Security
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read webhook logs
-- This supports admin dashboard viewing of webhook statistics
CREATE POLICY "Allow authenticated users to read webhook logs"
  ON public.webhook_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow service role to insert webhook logs
-- This is used by the carrierService to log webhook attempts
CREATE POLICY "Allow service role to insert webhook logs"
  ON public.webhook_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
