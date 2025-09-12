# TypeScript Errors Fix - Soft Delete Column Issue

## Issue Summary

The TypeScript errors were caused by a mismatch between the Prisma schema and the actual database schema. Specifically, the `deletedAt` column was defined in the Prisma schema (`prisma/schema.prisma`) but did not exist in the actual database table `profiles`.

### Original Error

```
SelectQueryError<"column 'deletedAt' does not exist on 'profiles'.">
```

## Temporary Fix Applied

To resolve the immediate TypeScript compilation errors, the following changes were made:

### 1. Removed `deletedAt` from Database Queries

**Files Modified:**

- `src/app/actions/login.ts`
- `src/app/api/auth/current-user/route.ts`
- `src/middleware.ts`
- `src/middleware/routeProtection.ts`

**Changes:**

- Removed `deletedAt` from SELECT queries
- Commented out soft-delete checks
- Added TODO comments for future restoration

### 2. Added Migration File

Created `supabase/migrations/01_add_deleted_at_column.sql` with the SQL to add the missing column.

## Next Steps to Restore Full Soft-Delete Functionality

### Option 1: Apply the Migration (Recommended)

1. **Connect to your Supabase project:**

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

2. **Apply the migration:**

   ```bash
   supabase db push
   ```

3. **Or manually run the SQL:**

   ```sql
   ALTER TABLE public.profiles
   ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6);

   CREATE INDEX CONCURRENTLY IF NOT EXISTS "profiles_deletedAt_idx"
   ON public.profiles("deletedAt");
   ```

### Option 2: Use Prisma (Alternative)

1. **Set up environment variables:**
   Ensure `DATABASE_URL` and `DIRECT_URL` are properly configured in your `.env` file.

2. **Push the schema:**
   ```bash
   pnpm exec prisma db push
   ```

### Option 3: Manual Database Update

If you have direct database access, you can run the SQL manually:

```sql
ALTER TABLE profiles ADD COLUMN "deletedAt" TIMESTAMPTZ(6);
CREATE INDEX "profiles_deletedAt_idx" ON profiles("deletedAt");
```

## Restoring Soft-Delete Code

Once the `deletedAt` column is added to the database, you can restore the soft-delete functionality by:

1. **Uncommenting the soft-delete checks** in all modified files
2. **Adding `deletedAt` back to SELECT queries**
3. **Testing the functionality**

### Files to Update:

#### `src/app/actions/login.ts`

```typescript
// Change this:
.select("type, email")

// Back to:
.select("type, email, deletedAt")

// And uncomment the soft-delete check:
if (profile.deletedAt) {
  console.log(`❌ [${requestId}] Login attempt by soft-deleted user: ${user.id}`);
  return {
    error: "Account has been deactivated. Please contact support for assistance.",
    success: false
  };
}
```

#### Similar changes needed in:

- `src/app/api/auth/current-user/route.ts`
- `src/middleware.ts`
- `src/middleware/routeProtection.ts`

## Current Status

✅ **TypeScript compilation**: Fixed - no more compilation errors  
⚠️ **Soft-delete functionality**: Temporarily disabled  
📋 **Next action required**: Add the `deletedAt` column to the database

## Database Schema Verification

To verify the column exists after adding it:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name = 'deletedAt';
```

Expected result:

```
column_name | data_type                   | is_nullable
deletedAt   | timestamp with time zone    | YES
```

## Testing After Restoration

1. **Test user login** - should work normally
2. **Test soft-delete functionality** - if you have admin tools to soft-delete users
3. **Verify middleware** - ensure deleted users can't access protected routes
4. **Run TypeScript check** - ensure no new errors are introduced

```bash
pnpm run typecheck
```
