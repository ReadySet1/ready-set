-- drivers carries two auth-user link columns in the same id space
-- (profiles.id === auth.users.id):
--   profile_id — canonical: unique, FK -> profiles(id)
--   user_id    — legacy:    FK -> auth.users(id), NULL on most rows
-- Ownership checks accept either column (src/lib/auth/driver-ownership.ts);
-- this backfill brings existing rows in sync so the legacy column stops
-- diverging. Both fills are guarded by their FK targets (a profile can exist
-- without an auth.users row, e.g. seeded test drivers). Idempotent.

-- Forward fill: the common case — rows created with only profile_id.
UPDATE drivers d
SET user_id = d.profile_id
WHERE d.user_id IS NULL
  AND d.profile_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = d.profile_id);

-- Reverse fill: rows created with only user_id. Guarded so we only adopt a
-- user_id that actually references a profile and doesn't collide with the
-- unique constraint on profile_id.
UPDATE drivers d
SET profile_id = d.user_id
WHERE d.profile_id IS NULL
  AND d.user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.user_id)
  AND NOT EXISTS (SELECT 1 FROM drivers d2 WHERE d2.profile_id = d.user_id);
