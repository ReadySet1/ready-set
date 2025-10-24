-- Fix address_usage_history constraint to allow NULL context values
-- This allows tracking address usage without requiring a specific context

-- Drop the existing constraint that doesn't allow NULL
ALTER TABLE address_usage_history
DROP CONSTRAINT IF EXISTS address_usage_history_context_check;

-- Add a new constraint that allows NULL or the specified values
ALTER TABLE address_usage_history
ADD CONSTRAINT address_usage_history_context_check
CHECK (context IS NULL OR context IN ('pickup', 'delivery', 'order'));
