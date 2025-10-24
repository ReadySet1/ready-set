-- Fix RLS policies to use authenticated role instead of public role
-- This ensures that only authenticated users can access their own favorites and usage history

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own favorites" ON address_favorites;
DROP POLICY IF EXISTS "Users can insert their own favorites" ON address_favorites;
DROP POLICY IF EXISTS "Users can delete their own favorites" ON address_favorites;
DROP POLICY IF EXISTS "Users can view their own usage history" ON address_usage_history;
DROP POLICY IF EXISTS "System can insert usage history" ON address_usage_history;

-- Create new policies with authenticated role
CREATE POLICY "Users can view their own favorites"
  ON address_favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
  ON address_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON address_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own usage history"
  ON address_usage_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage history"
  ON address_usage_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
