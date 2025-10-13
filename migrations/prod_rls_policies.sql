-- =====================================================
-- Production RLS Policies Script
-- Generated: 2025-10-03
-- Purpose: Enable comprehensive Row Level Security
-- =====================================================

BEGIN;

-- 1. Enable RLS on all tables
-- ===================================================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculator_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- 2. Optimize existing profiles policies
-- ===================================================
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Recreate with optimized auth.uid()
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Restrict profile deletions" ON profiles
  FOR DELETE
  USING (false);

-- 3. Testimonials policies (public read, admin write)
-- ===================================================
CREATE POLICY "Public can view active testimonials" ON testimonials
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Restrict testimonial modifications" ON testimonials
  FOR ALL
  USING (false);

-- 4. Calculator system policies
-- ===================================================
-- Templates: public read
CREATE POLICY "Public can view active templates" ON calculator_templates
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Restrict template modifications" ON calculator_templates
  FOR ALL
  USING (false);

-- Pricing rules: public read
CREATE POLICY "Public can view pricing rules" ON pricing_rules
  FOR SELECT
  USING (true);

CREATE POLICY "Restrict pricing rule modifications" ON pricing_rules
  FOR ALL
  USING (false);

-- Client configurations: users can view own
CREATE POLICY "Users can view own configs" ON client_configurations
  FOR SELECT
  USING ((SELECT auth.uid()) = client_id);

CREATE POLICY "Restrict config modifications" ON client_configurations
  FOR ALL
  USING (false);

-- Calculation history: users can view own
CREATE POLICY "Users can view own calculations" ON calculation_history
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create calculations" ON calculation_history
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Restrict calculation updates" ON calculation_history
  FOR UPDATE
  USING (false);

-- 5. Pricing tiers policies
-- ===================================================
CREATE POLICY "Public can view active tiers" ON pricing_tiers
  FOR SELECT
  USING (isActive = true);

CREATE POLICY "Restrict tier modifications" ON pricing_tiers
  FOR ALL
  USING (false);

-- 6. Driver system policies
-- ===================================================
-- Drivers: users can view own driver profile
CREATE POLICY "Users can view own driver profile" ON drivers
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Restrict driver modifications" ON drivers
  FOR ALL
  USING (false);

-- Driver locations: drivers can manage own locations
CREATE POLICY "Drivers can view own locations" ON driver_locations
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Drivers can create own locations" ON driver_locations
  FOR INSERT
  WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = (SELECT auth.uid())
    )
  );

-- Driver shifts: drivers can manage own shifts
CREATE POLICY "Drivers can view own shifts" ON driver_shifts
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Restrict shift modifications" ON driver_shifts
  FOR ALL
  USING (false);

-- Shift breaks: drivers can view own breaks
CREATE POLICY "Drivers can view own breaks" ON shift_breaks
  FOR SELECT
  USING (
    shift_id IN (
      SELECT id FROM driver_shifts ds
      JOIN drivers d ON d.id = ds.driver_id
      WHERE d.user_id = (SELECT auth.uid())
    )
  );

-- Deliveries: drivers can view assigned deliveries
CREATE POLICY "Drivers can view assigned deliveries" ON deliveries
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Restrict delivery modifications" ON deliveries
  FOR ALL
  USING (false);

COMMIT;

-- Verify policies created
SELECT 'RLS policies created successfully' AS status;
SELECT COUNT(*) AS total_policies FROM pg_policies WHERE schemaname = 'public';
