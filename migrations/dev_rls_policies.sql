-- =====================================================
-- Development Database RLS Policies Script
-- Generated: 2025-10-03
-- Purpose: Enable Row Level Security on dev database
-- Critical Security Fix - DO NOT SKIP
-- =====================================================

BEGIN;

-- 1. Enable RLS on all tables (currently disabled)
-- ===================================================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_demand_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculator_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

-- 2. Accounts policies
-- ===================================================
CREATE POLICY "Users can view own accounts" ON accounts
  FOR SELECT
  USING ((SELECT auth.uid()) = "userId");

CREATE POLICY "Users can insert own accounts" ON accounts
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = "userId");

CREATE POLICY "Users can update own accounts" ON accounts
  FOR UPDATE
  USING ((SELECT auth.uid()) = "userId")
  WITH CHECK ((SELECT auth.uid()) = "userId");

CREATE POLICY "Restrict account deletions" ON accounts
  FOR DELETE
  USING (false);

-- 3. Sessions policies
-- ===================================================
CREATE POLICY "Users can view own sessions" ON sessions
  FOR SELECT
  USING ((SELECT auth.uid()) = "userId");

CREATE POLICY "Users can create own sessions" ON sessions
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = "userId");

CREATE POLICY "Users can update own sessions" ON sessions
  FOR UPDATE
  USING ((SELECT auth.uid()) = "userId");

CREATE POLICY "Users can delete own sessions" ON sessions
  FOR DELETE
  USING ((SELECT auth.uid()) = "userId");

-- 4. Addresses policies
-- ===================================================
CREATE POLICY "Users can view own addresses" ON addresses
  FOR SELECT
  USING ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can create own addresses" ON addresses
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can update own addresses" ON addresses
  FOR UPDATE
  USING ((SELECT auth.uid()) = userId)
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can delete own addresses" ON addresses
  FOR DELETE
  USING ((SELECT auth.uid()) = userId);

-- 5. Catering requests policies
-- ===================================================
CREATE POLICY "Users can view own catering requests" ON catering_requests
  FOR SELECT
  USING ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can create own catering requests" ON catering_requests
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can update own catering requests" ON catering_requests
  FOR UPDATE
  USING ((SELECT auth.uid()) = userId)
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Restrict catering request deletions" ON catering_requests
  FOR DELETE
  USING (false);

-- 6. Dispatches policies
-- ===================================================
CREATE POLICY "Users can view own dispatches" ON dispatches
  FOR SELECT
  USING ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can create own dispatches" ON dispatches
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can update own dispatches" ON dispatches
  FOR UPDATE
  USING ((SELECT auth.uid()) = userId)
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Restrict dispatch deletions" ON dispatches
  FOR DELETE
  USING (false);

-- 7. File uploads policies
-- ===================================================
CREATE POLICY "Users can view own files" ON file_uploads
  FOR SELECT
  USING ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can upload files" ON file_uploads
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can update own files" ON file_uploads
  FOR UPDATE
  USING ((SELECT auth.uid()) = userId)
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can delete own files" ON file_uploads
  FOR DELETE
  USING ((SELECT auth.uid()) = userId);

-- 8. On-demand requests policies
-- ===================================================
CREATE POLICY "Users can view own on-demand requests" ON on_demand_requests
  FOR SELECT
  USING ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can create on-demand requests" ON on_demand_requests
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can update own on-demand requests" ON on_demand_requests
  FOR UPDATE
  USING ((SELECT auth.uid()) = userId)
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Restrict on-demand request deletions" ON on_demand_requests
  FOR DELETE
  USING (false);

-- 9. User addresses policies
-- ===================================================
CREATE POLICY "Users can view own user addresses" ON user_addresses
  FOR SELECT
  USING ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can create user addresses" ON user_addresses
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can update own user addresses" ON user_addresses
  FOR UPDATE
  USING ((SELECT auth.uid()) = userId)
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can delete own user addresses" ON user_addresses
  FOR DELETE
  USING ((SELECT auth.uid()) = userId);

-- 10. Verification tokens policies
-- ===================================================
CREATE POLICY "Users can view own tokens" ON verification_tokens
  FOR SELECT
  USING ((SELECT auth.uid()) = "userId");

-- 11. Form submissions policies
-- ===================================================
CREATE POLICY "Users can view own form submissions" ON form_submissions
  FOR SELECT
  USING ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can create form submissions" ON form_submissions
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can update own form submissions" ON form_submissions
  FOR UPDATE
  USING ((SELECT auth.uid()) = userId)
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Restrict form submission deletions" ON form_submissions
  FOR DELETE
  USING (false);

-- 12. Lead captures policies
-- ===================================================
CREATE POLICY "Users can view own lead captures" ON lead_captures
  FOR SELECT
  USING ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can create lead captures" ON lead_captures
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Users can update own lead captures" ON lead_captures
  FOR UPDATE
  USING ((SELECT auth.uid()) = userId)
  WITH CHECK ((SELECT auth.uid()) = userId);

CREATE POLICY "Restrict lead capture deletions" ON lead_captures
  FOR DELETE
  USING (false);

-- 13. Job applications policies
-- ===================================================
CREATE POLICY "Users can view own job applications" ON job_applications
  FOR SELECT
  USING ((SELECT auth.uid()) = profileId);

CREATE POLICY "Users can create job applications" ON job_applications
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = profileId);

CREATE POLICY "Users can update own job applications" ON job_applications
  FOR UPDATE
  USING ((SELECT auth.uid()) = profileId)
  WITH CHECK ((SELECT auth.uid()) = profileId);

CREATE POLICY "Restrict job application deletions" ON job_applications
  FOR DELETE
  USING (false);

-- 14. Testimonials policies
-- ===================================================
CREATE POLICY "Public can view active testimonials" ON testimonials
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Restrict testimonial modifications" ON testimonials
  FOR ALL
  USING (false);

-- 15. Calculator templates policies
-- ===================================================
CREATE POLICY "Public can view active templates" ON calculator_templates
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Restrict template modifications" ON calculator_templates
  FOR ALL
  USING (false);

-- 16. Pricing rules policies
-- ===================================================
CREATE POLICY "Public can view pricing rules" ON pricing_rules
  FOR SELECT
  USING (true);

CREATE POLICY "Restrict pricing rule modifications" ON pricing_rules
  FOR ALL
  USING (false);

-- 17. Calculation history policies
-- ===================================================
CREATE POLICY "Users can view own calculations" ON calculation_history
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create calculations" ON calculation_history
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Restrict calculation updates" ON calculation_history
  FOR UPDATE
  USING (false);

-- 18. Client configurations policies
-- ===================================================
CREATE POLICY "Users can view own configs" ON client_configurations
  FOR SELECT
  USING ((SELECT auth.uid()) = client_id);

CREATE POLICY "Restrict config modifications" ON client_configurations
  FOR ALL
  USING (false);

-- 19. Pricing tiers policies
-- ===================================================
CREATE POLICY "Public can view active tiers" ON pricing_tiers
  FOR SELECT
  USING (isActive = true);

CREATE POLICY "Restrict tier modifications" ON pricing_tiers
  FOR ALL
  USING (false);

COMMIT;

-- Verify policies created
SELECT 'RLS policies created successfully for dev database' AS status;
SELECT COUNT(*) AS total_policies FROM pg_policies WHERE schemaname = 'public';
