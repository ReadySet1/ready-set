-- SQL script to delete specific users from the database
-- Run this in your Supabase SQL editor or via psql

-- Users to delete:
-- 1. cromo181@gmail.com
-- 2. austin@readysetllc.com  
-- 3. info@readysetllc.com (David Carson)
-- 4. cardernasfernando874@gmail.com

BEGIN;

-- Delete user: cromo181@gmail.com
DO $$
DECLARE
  user_id uuid;
BEGIN
  -- Find user ID
  SELECT id INTO user_id FROM "Profile" WHERE email = 'cromo181@gmail.com';
  
  IF user_id IS NOT NULL THEN
    -- Delete dispatch records
    DELETE FROM "Dispatch" WHERE "driverId" = user_id OR "userId" = user_id;
    
    -- Update addresses
    UPDATE "Address" SET "createdBy" = NULL WHERE "createdBy" = user_id;
    
    -- Delete profile (CASCADE will handle related records)
    DELETE FROM "Profile" WHERE id = user_id;
    
    RAISE NOTICE 'Deleted user: cromo181@gmail.com (ID: %)', user_id;
  ELSE
    RAISE NOTICE 'User not found: cromo181@gmail.com';
  END IF;
END $$;

-- Delete user: austin@readysetllc.com
DO $$
DECLARE
  user_id uuid;
BEGIN
  -- Find user ID
  SELECT id INTO user_id FROM "Profile" WHERE email = 'austin@readysetllc.com';
  
  IF user_id IS NOT NULL THEN
    -- Delete dispatch records
    DELETE FROM "Dispatch" WHERE "driverId" = user_id OR "userId" = user_id;
    
    -- Update addresses
    UPDATE "Address" SET "createdBy" = NULL WHERE "createdBy" = user_id;
    
    -- Delete profile (CASCADE will handle related records)
    DELETE FROM "Profile" WHERE id = user_id;
    
    RAISE NOTICE 'Deleted user: austin@readysetllc.com (ID: %)', user_id;
  ELSE
    RAISE NOTICE 'User not found: austin@readysetllc.com';
  END IF;
END $$;

-- Delete user: info@readysetllc.com
DO $$
DECLARE
  user_id uuid;
BEGIN
  -- Find user ID
  SELECT id INTO user_id FROM "Profile" WHERE email = 'info@readysetllc.com';
  
  IF user_id IS NOT NULL THEN
    -- Delete dispatch records
    DELETE FROM "Dispatch" WHERE "driverId" = user_id OR "userId" = user_id;
    
    -- Update addresses
    UPDATE "Address" SET "createdBy" = NULL WHERE "createdBy" = user_id;
    
    -- Delete profile (CASCADE will handle related records)
    DELETE FROM "Profile" WHERE id = user_id;
    
    RAISE NOTICE 'Deleted user: info@readysetllc.com (ID: %)', user_id;
  ELSE
    RAISE NOTICE 'User not found: info@readysetllc.com';
  END IF;
END $$;

-- Delete user: cardernasfernando874@gmail.com
DO $$
DECLARE
  user_id uuid;
BEGIN
  -- Find user ID
  SELECT id INTO user_id FROM "Profile" WHERE email = 'cardernasfernando874@gmail.com';
  
  IF user_id IS NOT NULL THEN
    -- Delete dispatch records
    DELETE FROM "Dispatch" WHERE "driverId" = user_id OR "userId" = user_id;
    
    -- Update addresses
    UPDATE "Address" SET "createdBy" = NULL WHERE "createdBy" = user_id;
    
    -- Delete profile (CASCADE will handle related records)
    DELETE FROM "Profile" WHERE id = user_id;
    
    RAISE NOTICE 'Deleted user: cardernasfernando874@gmail.com (ID: %)', user_id;
  ELSE
    RAISE NOTICE 'User not found: cardernasfernando874@gmail.com';
  END IF;
END $$;

COMMIT;

-- Summary
SELECT 'Deletion complete' AS status;
SELECT COUNT(*) AS remaining_users FROM "Profile" 
WHERE email IN ('cromo181@gmail.com', 'austin@readysetllc.com', 'info@readysetllc.com', 'cardernasfernando874@gmail.com');

