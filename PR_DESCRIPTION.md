# PR: Merge development into main

## Summary

This PR merges 18 commits from the `development` branch into `main`, bringing critical security fixes, new features, and improvements to production.

**Key Features:**
- File upload security fixes and PowerPoint support (REA-53)
- Client-specific calculator configurations with tiered driver pay (REA-41)
- CaterValley delivery fee calculation fixes
- Test improvements (REA-177)

**Related Issues:**
- REA-53: Document upload security fixes
- REA-41: Calculator client configurations
- REA-177: Test improvements

## Features/Changes

### REA-53: Document Upload Security Fixes
- ✅ Fixed RLS policy violations causing upload failures
- ✅ Added PowerPoint (PPT/PPTX) file support
- ✅ Enhanced security scanning and error handling
- ✅ Improved PDF detection (reduced false positives)
- ✅ Added comprehensive error logging and reporting
- ✅ Created file uploader storage bucket migration

### REA-41: Calculator Client Configurations
- ✅ Added client-specific delivery cost configurations
- ✅ Implemented tiered driver pay system
- ✅ Added support for custom mileage rates per client
- ✅ Implemented manual review thresholds
- ✅ Added bridge toll support with auto-detection
- ✅ Enhanced calculator with null safety checks

### REA-177: Test Improvements
- ✅ Applied high-impact quick wins for test reliability
- ✅ Fixed test mocking issues
- ✅ Improved test coverage

### CaterValley Integration
- ✅ Fixed delivery fee calculation bugs
- ✅ Added delivery cost and distance transparency
- ✅ Enhanced error handling and logging

### Other Improvements
- ✅ Comprehensive code quality improvements
- ✅ Documentation updates
- ✅ Removed unused files

## Testing

### Unit Tests
- ✅ **delivery-cost-calculator.test.ts**: 75/75 tests passing
- ✅ **file-uploads.test.ts**: Core functionality tests passing
- ⚠️ Some pre-existing test failures unrelated to this branch

### Integration Tests
- ✅ File upload integration tests passing
- ✅ Calculator integration tests passing

### E2E Tests
- ✅ Order flow tests passing
- ✅ Authentication flow tests passing

### Manual Testing
- ✅ File upload functionality (including PowerPoint)
- ✅ Calculator configurations
- ✅ CaterValley delivery fee calculations
- ✅ Order creation/update flows

## Database Changes

### Migrations Applied
1. **`add-delivery-cost-distance-to-catering-requests.sql`**
   - Adds `deliveryCost` and `deliveryDistance` columns to `catering_requests` table
   - Creates indexes for reporting
   - **Status**: Already applied to production ✅
   - **Rollback**: 
     ```sql
     ALTER TABLE public.catering_requests 
     DROP COLUMN IF EXISTS "deliveryCost", 
     DROP COLUMN IF EXISTS "deliveryDistance";
     ```

2. **`20251112000000_create_file_uploader_bucket.sql`**
   - Creates `fileUploader` storage bucket
   - Sets MIME type restrictions
   - **Status**: Already applied to production ✅
   - **Rollback**: 
     ```sql
     DELETE FROM storage.buckets WHERE id = 'fileUploader';
     ```

### Prisma Schema Updates
- Updated schema to match database changes
- Run `prisma generate` after merge

### Migration Notes
- Both migrations are idempotent (use `IF NOT EXISTS`/`ON CONFLICT`)
- Migrations already applied to production
- No manual steps required

## Breaking Changes

**None** - All changes are backward compatible.

- API endpoints remain unchanged
- Database schema changes are additive only
- No deprecated features removed

## Deployment Notes

### Pre-Deployment Checklist
- [x] Database migrations reviewed and verified
- [x] Environment variables documented
- [x] Build passes successfully
- [x] Key tests passing

### Environment Variables
No new required environment variables. Optional variables:
- `CATERVALLEY_WEBHOOK_URL` (optional, has default)
- `CATERVALLEY_API_KEY` (optional)
- `GOOGLE_MAPS_API_KEY` (required for distance calculations)

### Post-Deployment Steps
1. Verify migrations applied successfully (already done)
2. Run `prisma generate` to update Prisma client
3. Monitor file upload functionality
4. Monitor CaterValley webhook deliveries
5. Check Sentry for any errors

### Rollback Procedure
1. **Code Rollback**: Revert merge commit
2. **Database Rollback**: 
   - Columns can be dropped if needed (see migration rollback SQL above)
   - Bucket deletion only if no files exist
3. **Monitoring**: Check Sentry/error logs for issues

## Reviewer Checklist

- [ ] Code follows TypeScript/Next.js best practices
- [ ] Tests pass and cover new functionality
- [ ] No security vulnerabilities introduced
- [ ] Documentation is updated
- [ ] Performance impact acceptable
- [ ] Migrations are safe and idempotent
- [ ] No breaking changes introduced

## Files Changed

### Key Files
- `src/app/api/file-uploads/route.ts` - Enhanced upload security
- `src/app/api/file-uploads/catering/upload/route.ts` - Catering upload endpoint
- `src/lib/calculator/delivery-cost-calculator.ts` - Calculator improvements
- `src/lib/calculator/client-configurations.ts` - Client configurations
- `src/lib/upload-error-handler.ts` - Enhanced error handling
- `migrations/add-delivery-cost-distance-to-catering-requests.sql` - Migration
- `supabase/migrations/20251112000000_create_file_uploader_bucket.sql` - Migration

### Documentation
- `docs/api/FILE_UPLOAD_API.md` - File upload API documentation
- `docs/api/CALCULATOR_API.md` - Calculator API documentation
- `docs/api/CATERVALLEY_WEBHOOK_API.md` - CaterValley webhook API documentation
- `docs/migrations/MIGRATION_REVIEW_202501.md` - Migration review
- `docs/CODE_QUALITY_REVIEW_202501.md` - Code quality review
- `docs/TEST_RESULTS_202501.md` - Test results summary

## Risk Assessment

### Low Risk
- ✅ Test improvements (REA-177)
- ✅ Documentation updates
- ✅ Code quality improvements

### Medium Risk
- ⚠️ File upload security changes (REA-53) - requires monitoring
- ⚠️ Calculator configuration changes (REA-41) - requires verification

### High Risk
- ⚠️ Database migrations - already applied, but monitor for issues
- ⚠️ CaterValley integration changes - requires webhook monitoring

## Additional Notes

- Branch rebased onto main (18 commits, 0 behind)
- All migrations already applied to production
- Pre-existing test failures documented (unrelated to this branch)
- Console.logs reviewed and approved (properly guarded)
- TODOs reviewed (non-blocking improvements)

