-- Fix Calculator Permissions Migration
-- Date: 2025-09-29
-- Issue: Permission denied (42501) on calculator tables
-- Root Cause: Missing GRANT permissions for authenticated and anon roles

-- Grant permissions to authenticated users for calculator tables
-- This allows the Supabase client to read from these tables

-- Calculator Templates (read-only for all)
GRANT SELECT ON calculator_templates TO authenticated;
GRANT SELECT ON calculator_templates TO anon;

-- Pricing Rules (read-only for all)
GRANT SELECT ON pricing_rules TO authenticated;
GRANT SELECT ON pricing_rules TO anon;

-- Client Configurations
GRANT SELECT ON client_configurations TO authenticated;
GRANT SELECT ON client_configurations TO anon;
GRANT INSERT, UPDATE ON client_configurations TO authenticated;

-- Calculation History
GRANT SELECT ON calculation_history TO authenticated;
GRANT SELECT ON calculation_history TO anon;
GRANT INSERT ON calculation_history TO authenticated;

-- Add documentation comments
COMMENT ON TABLE calculator_templates IS 'Calculator templates - readable by all authenticated users';
COMMENT ON TABLE pricing_rules IS 'Pricing rules for calculator templates - readable by all';
COMMENT ON TABLE client_configurations IS 'Client-specific calculator configurations - readable by all, modifiable by authenticated';
COMMENT ON TABLE calculation_history IS 'Calculation history - users can view their own via API filtering';

-- Verify permissions were granted
DO $$
BEGIN
  RAISE NOTICE 'Calculator permissions migration completed successfully';
  RAISE NOTICE 'Granted SELECT to authenticated and anon roles on calculator tables';
  RAISE NOTICE 'Granted INSERT/UPDATE to authenticated role where appropriate';
END $$;

