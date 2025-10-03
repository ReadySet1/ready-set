# Claude Code: Production Merge Preparation Prompt

## Context
I'm preparing to merge the `preview-development` branch into `main` for a production deployment. I need to ensure database consistency, create manual backups, and follow production deployment best practices.

## Required Tasks

### 1. Database Audit & Comparison
- **Connect to both Supabase databases** (development and production)
- **Compare database schemas** between dev and prod:
  - Tables structure differences
  - Column types, constraints, and indexes
  - Foreign key relationships
  - Row Level Security (RLS) policies
  - Database functions and triggers
  - Extensions enabled
- **Identify migration gaps**: List any migrations in dev that haven't been applied to prod
- **Document schema differences** in a markdown file

### 2. Manual Database Backups
Since we're on Supabase free tier without automated backups:

- **Create SQL dumps** for both databases:
  - Schema-only backup (structure)
  - Full backup (schema + data)
  - Data-only backup for critical tables
- **Save backups locally** with timestamps in `./backups/` directory:
  - `backup-dev-{timestamp}-schema.sql`
  - `backup-dev-{timestamp}-full.sql`
  - `backup-prod-{timestamp}-schema.sql`
  - `backup-prod-{timestamp}-full.sql`
- **Generate rollback scripts** for any new migrations

### 3. Pre-Production Checklist
Create a checklist document covering:

**Code Review:**
- [ ] All TypeScript compilation passes with no errors
- [ ] All tests passing (unit, integration, e2e)
- [ ] No console.log or debug code in production builds
- [ ] Environment variables documented and verified
- [ ] API routes have proper error handling
- [ ] Rate limiting configured for sensitive endpoints

**Database:**
- [ ] All migrations tested in development
- [ ] RLS policies reviewed and tested
- [ ] Database indexes optimized for production queries
- [ ] No hardcoded credentials in migration files
- [ ] Backup restoration tested

**Security:**
- [ ] Authentication flows tested
- [ ] Authorization rules verified
- [ ] CORS settings configured correctly
- [ ] Sensitive data encrypted
- [ ] API keys rotated if needed
- [ ] SQL injection vulnerabilities checked

**Performance:**
- [ ] Next.js build optimized (check bundle size)
- [ ] Database queries optimized (no N+1 issues)
- [ ] Images optimized
- [ ] Caching strategies implemented
- [ ] CDN configured

**Monitoring:**
- [ ] Error tracking configured (Sentry, LogRocket, etc.)
- [ ] Analytics setup verified
- [ ] Performance monitoring enabled
- [ ] Database connection pool limits set

### 4. Migration Strategy Document
Generate a deployment plan including:

- **Pre-deployment steps**: What to do before merging
- **Deployment sequence**: Order of operations
- **Migration execution plan**: Which migrations to run, in what order
- **Rollback procedure**: How to revert if issues occur
- **Post-deployment verification**: Tests to run after deployment
- **Estimated downtime**: If any

### 5. Database Comparison Script
Create a TypeScript script that:

```typescript
// Compare databases and generate report
interface SchemaComparison {
  tablesOnlyInDev: string[];
  tablesOnlyInProd: string[];
  columnDifferences: ColumnDiff[];
  policyDifferences: PolicyDiff[];
  functionDifferences: FunctionDiff[];
}
```

### 6. Environment Verification
- Compare `.env.local` vs `.env.production` requirements
- Verify all production environment variables are set
- Check Supabase project IDs and API keys are correct
- Verify third-party API credentials for production

## Deliverables

1. **`/backups/`** directory with timestamped SQL dumps
2. **`SCHEMA_COMPARISON.md`** - Detailed database diff report
3. **`PRE_PRODUCTION_CHECKLIST.md`** - Complete pre-deployment checklist
4. **`DEPLOYMENT_PLAN.md`** - Step-by-step deployment instructions
5. **`/scripts/compare-databases.ts`** - Automated comparison script
6. **`ROLLBACK_PLAN.md`** - Emergency rollback procedures

## Constraints & Best Practices

- Use TypeScript for all scripts
- Follow PostgreSQL best practices for queries
- Include proper error handling in all database operations
- Generate human-readable reports in markdown
- Create idempotent scripts (safe to run multiple times)
- Include dry-run modes for destructive operations
- Log all operations with timestamps
- Never expose sensitive data in logs or reports

## Supabase Connection Details

Development Database:
- Project URL: `[Your Dev URL]`
- Anon Key: `[Use from env]`

Production Database:
- Project URL: `[Your Prod URL]`
- Anon Key: `[Use from env]`

## Success Criteria

- All database differences documented
- Local backups created and verified
- Rollback plan tested
- Checklist 100% complete
- Zero breaking changes identified
- Migration order validated
- Deployment plan approved

## Additional Notes

- This is a critical production deployment
- Prioritize data integrity over speed
- Document everything for future reference
- Test rollback procedures before deploying
- Communicate deployment window to stakeholders