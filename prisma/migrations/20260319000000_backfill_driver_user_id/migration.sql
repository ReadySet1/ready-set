-- Backfill drivers.user_id from profiles where it is NULL
-- This fixes BUG-02 where driver stats API returns 403 because
-- the auth check only looked at user_id, but some drivers only have profile_id set.
UPDATE drivers d
SET user_id = p.id
FROM profiles p
WHERE d.profile_id = p.id
  AND d.user_id IS NULL
  AND d.deleted_at IS NULL;
