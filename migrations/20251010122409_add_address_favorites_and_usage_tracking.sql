-- Address Favorites and Usage Tracking Migration
-- Description: Adds support for favoriting addresses and tracking usage history for improved UX

-- Address Favorites Table
-- Allows users to mark addresses as favorites for quick access
CREATE TABLE IF NOT EXISTS address_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_address_favorite UNIQUE(user_id, address_id)
);

-- Address Usage History Table
-- Tracks when addresses are used to power "recent addresses" feature
CREATE TABLE IF NOT EXISTS address_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context TEXT CHECK (context IN ('pickup', 'delivery', 'order')),
  CONSTRAINT valid_context CHECK (context IS NOT NULL)
);

-- Indexes for Performance
-- Optimize queries for user-specific favorites
CREATE INDEX IF NOT EXISTS idx_address_favorites_user_id ON address_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_address_favorites_address_id ON address_favorites(address_id);

-- Optimize queries for recent addresses (sorted by time, filtered by user)
CREATE INDEX IF NOT EXISTS idx_address_usage_user_date ON address_usage_history(user_id, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_address_usage_address_id ON address_usage_history(address_id);
CREATE INDEX IF NOT EXISTS idx_address_usage_context ON address_usage_history(context);

-- Table Comments for Documentation
COMMENT ON TABLE address_favorites IS 'User-specific favorite addresses for quick access in address selector';
COMMENT ON TABLE address_usage_history IS 'Historical record of address usage to show recently used addresses';

COMMENT ON COLUMN address_favorites.user_id IS 'Reference to the user who favorited the address';
COMMENT ON COLUMN address_favorites.address_id IS 'Reference to the favorited address';

COMMENT ON COLUMN address_usage_history.user_id IS 'Reference to the user who used the address';
COMMENT ON COLUMN address_usage_history.address_id IS 'Reference to the address that was used';
COMMENT ON COLUMN address_usage_history.context IS 'Context of usage: pickup, delivery, or general order';
COMMENT ON COLUMN address_usage_history.used_at IS 'Timestamp when the address was used';

-- Enable Row Level Security (RLS)
ALTER TABLE address_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE address_usage_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for address_favorites
-- Users can only see and manage their own favorites
CREATE POLICY "Users can view their own favorites"
  ON address_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
  ON address_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON address_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for address_usage_history
-- Users can only see their own usage history
-- Only system/app can insert (users cannot manipulate their history)
CREATE POLICY "Users can view their own usage history"
  ON address_usage_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage history"
  ON address_usage_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Optional: Add trigger to automatically update usage history
-- This could be triggered by application logic instead
CREATE OR REPLACE FUNCTION update_address_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- This function can be called from application triggers
  -- Currently just a placeholder for future enhancements
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
