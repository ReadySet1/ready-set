-- ============================================================================
-- Migration: Enable RLS on Admin-Managed Tables
-- Date: 2025-12-22
-- Issue: Supabase Security Advisor - RLS disabled on tables
-- ============================================================================
--
-- Description:
--   Enables Row Level Security and creates policies for tables that are
--   primarily managed by admin users but readable by authenticated users.
--
-- Tables:
--   - delivery_configurations: Pricing/delivery configuration data
--   - testimonials: Customer testimonials for public display
--   - calculator_templates: Pricing calculation templates
--   - pricing_rules: Pricing rules per template
--
-- Access Pattern:
--   - Authenticated users can READ active records
--   - Admin/Super Admin/Helpdesk can CRUD all records
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. delivery_configurations
-- ============================================================================
-- Contains delivery pricing configurations, admin-managed

DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'delivery_configurations'
    AND schemaname = 'public'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE IF EXISTS delivery_configurations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policy: Authenticated users can view active configurations
DROP POLICY IF EXISTS "Authenticated users can view active configs" ON delivery_configurations;
CREATE POLICY "Authenticated users can view active configs"
  ON delivery_configurations
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policy: Admin users have full access
DROP POLICY IF EXISTS "Admin users can manage configs" ON delivery_configurations;
CREATE POLICY "Admin users can manage configs"
  ON delivery_configurations
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Grant permissions
GRANT SELECT ON delivery_configurations TO authenticated;

-- ============================================================================
-- 2. testimonials
-- ============================================================================
-- Customer testimonials displayed on public pages

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'testimonials'
    AND schemaname = 'public'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE IF EXISTS testimonials ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policy: Anyone can view active testimonials (public content)
DROP POLICY IF EXISTS "Anyone can view active testimonials" ON testimonials;
CREATE POLICY "Anyone can view active testimonials"
  ON testimonials
  FOR SELECT
  USING (is_active = true);

-- Policy: Admin users can manage all testimonials
DROP POLICY IF EXISTS "Admin users can manage testimonials" ON testimonials;
CREATE POLICY "Admin users can manage testimonials"
  ON testimonials
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Grant permissions (public SELECT for testimonials shown on marketing pages)
GRANT SELECT ON testimonials TO anon, authenticated;

-- ============================================================================
-- 3. calculator_templates
-- ============================================================================
-- Pricing calculation templates

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'calculator_templates'
    AND schemaname = 'public'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE IF EXISTS calculator_templates ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policy: Authenticated users can view active templates
DROP POLICY IF EXISTS "Authenticated can view active templates" ON calculator_templates;
CREATE POLICY "Authenticated can view active templates"
  ON calculator_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policy: Admin users can manage all templates
DROP POLICY IF EXISTS "Admin can manage templates" ON calculator_templates;
CREATE POLICY "Admin can manage templates"
  ON calculator_templates
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Grant permissions
GRANT SELECT ON calculator_templates TO authenticated;

-- ============================================================================
-- 4. pricing_rules
-- ============================================================================
-- Pricing rules belonging to calculator templates

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'pricing_rules'
    AND schemaname = 'public'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE IF EXISTS pricing_rules ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policy: Authenticated users can view all rules (needed for calculations)
DROP POLICY IF EXISTS "Authenticated can view pricing rules" ON pricing_rules;
CREATE POLICY "Authenticated can view pricing rules"
  ON pricing_rules
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Admin users can manage all rules
DROP POLICY IF EXISTS "Admin can manage pricing rules" ON pricing_rules;
CREATE POLICY "Admin can manage pricing rules"
  ON pricing_rules
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Grant permissions
GRANT SELECT ON pricing_rules TO authenticated;

COMMIT;

-- ============================================================================
-- Verification Query
-- ============================================================================
/*
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('delivery_configurations', 'testimonials', 'calculator_templates', 'pricing_rules')
AND schemaname = 'public';

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('delivery_configurations', 'testimonials', 'calculator_templates', 'pricing_rules')
ORDER BY tablename, policyname;
*/
