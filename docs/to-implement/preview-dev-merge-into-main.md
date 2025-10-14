## Enhanced Claude Code Prompt for PR & Merge with Database Migrations

```bash
I need you to create a pull request to merge the preview-development branch into main for the ReadySet1/ready-set repository, with special attention to database migrations and compatibility.

Repository: ReadySet1/ready-set
Source branch: preview-development
Target branch: main

TASKS:

1. MIGRATION ANALYSIS (CRITICAL - DO FIRST):
   a. Compare migration files between branches:
      - List all files in /migrations directory on preview-development
      - List all files in /migrations directory on main
      - Identify new migrations that will be applied

   b. Check Prisma schema changes:
      - Compare prisma/schema.prisma between branches
      - Identify breaking changes (removed fields, renamed tables, changed types)
      - Check for new models, fields, or relationships

   c. Verify migration compatibility:
      - Ensure migrations are numbered sequentially
      - Check for data migration scripts (not just schema changes)
      - Look for any DOWN migrations or rollback scripts
      - Verify foreign key constraints won't break existing data

   d. Database backup reminder:
      - Note: "⚠️ BACKUP DATABASE BEFORE MERGING - Run backup script or snapshot"

2. COMPATIBILITY CHECKS:
   a. TypeScript/Prisma compatibility:
      - Verify @prisma/client version matches migrations
      - Check that generated types are up to date
      - Run: npx prisma generate (simulate check)

   b. Environment variables:
      - Compare .env.example between branches
      - List new database-related env vars required
      - Check DATABASE_URL, DIRECT_URL, shadow database config

   c. Seed data compatibility:
      - Check if prisma/seed.ts has changes
      - Verify seed data works with new schema

   d. API/Query compatibility:
      - Scan src/ for Prisma queries that might break
      - Look for removed fields still being queried
      - Check for new required fields without defaults

3. CREATE PULL REQUEST:
   Title: "Merge preview-development into main - Production Release with DB Migrations"

   Body template:
   ```markdown
   ## 🚀 Production Release

   Merging preview-development → main

   ### 📊 Database Migration Summary

   #### New Migrations
   - [ ] List each new migration file with description
   - [ ] Total migrations to apply: X

   #### Schema Changes
   - [ ] New tables: [list]
   - [ ] Modified tables: [list]
   - [ ] Dropped tables: [list]
   - [ ] New indexes: [list]
   - [ ] Breaking changes: [YES/NO - describe if yes]

   #### Migration Strategy
   - [ ] Migrations tested on staging/preview database
   - [ ] Backup strategy confirmed
   - [ ] Rollback plan documented
   - [ ] Downtime required: [YES/NO - estimate if yes]
   - [ ] Data migration scripts included: [YES/NO]

   ### 🔍 Compatibility Checklist

   **Database**
   - [ ] PostgreSQL version compatible: [specify min version]
   - [ ] Connection pooling configured (if using Prisma Data Proxy/Accelerate)
   - [ ] Migration lock mechanism in place
   - [ ] No orphaned foreign keys
   - [ ] Indexes optimized for new queries

   **Application**
   - [ ] Prisma Client regenerated
   - [ ] TypeScript types updated
   - [ ] API routes updated for schema changes
   - [ ] Seed data compatible
   - [ ] Tests pass with new schema

   **Environment**
   - [ ] New environment variables documented
   - [ ] DATABASE_URL format validated
   - [ ] Shadow database configured (for dev)
   - [ ] Connection limits reviewed

   ### 📝 Pre-Merge Commands

   ```bash
   # On production database (or staging first):

   # 1. Backup database
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

   # 2. Review migrations
   npx prisma migrate status

   # 3. Apply migrations (DRY RUN first if possible)
   npx prisma migrate deploy --preview-feature

   # 4. Verify schema
   npx prisma db pull

   # 5. Regenerate client
   npx prisma generate

   # 6. Run seed (if needed)
   npx prisma db seed
   ```

   ### 🔄 Rollback Plan

   If issues occur after merge:
   ```bash
   # 1. Restore from backup
   psql $DATABASE_URL < backup_[timestamp].sql

   # 2. Revert code
   git revert -m 1 [merge-commit-sha]

   # 3. Redeploy previous version
   ```

   ### 🔗 References
   - Comparison: https://github.com/ReadySet1/ready-set/compare/preview-development
   - Migration docs: [link to internal docs]

   ### ⚠️ CRITICAL ACTIONS BEFORE MERGE
   1. **BACKUP PRODUCTION DATABASE**
   2. **Test migrations on staging clone**
   3. **Verify no active user sessions during migration**
   4. **Confirm rollback procedure**

   ---

   **Changes Overview:**
   [Auto-generated commit summary]

   cc: @ReadySet1
   ```

4. REVIEW PR:
   - Examine all files changed with focus on:
     * migrations/*.sql files
     * prisma/schema.prisma
     * src/**/queries.ts or database-related files
     * package.json for Prisma version changes

   - Check for:
     * SQL injection vulnerabilities in raw queries
     * Missing indexes on frequently queried columns
     * N+1 query patterns
     * Missing transactions for multi-step operations

5. MIGRATION SAFETY CHECKS:
   a. Check for potentially dangerous operations:
      - DROP TABLE without backup confirmation
      - ALTER COLUMN that changes data types
      - Removing NOT NULL without default values
      - Adding UNIQUE constraints on existing data

   b. Performance considerations:
      - Large table alterations (might cause locks)
      - Index creation on large tables (use CONCURRENTLY)
      - Data backfills on large datasets

   c. Zero-downtime migration patterns:
      - Adding nullable columns (safe)
      - Creating new indexes concurrently (safe)
      - Adding tables (safe)
      - Removing columns (needs multi-step deployment)

6. POST-MERGE ACTIONS:
   After successful merge, create a checklist:
   ```bash
   # 1. Deploy to production (triggers migrations)
   # 2. Monitor application logs for database errors
   # 3. Check query performance metrics
   # 4. Verify data integrity with spot checks
   # 5. Monitor connection pool usage
   # 6. Check for slow queries in pg_stat_statements
   ```

7. MERGE STRATEGY:
   - Use "squash and merge" for cleaner history
   - Commit message format:
     ```
     Merge preview-development into main (#PR_NUMBER)

     Database changes:
     - [list key schema changes]

     Application changes:
     - [list key features/fixes]

     Migrations: X new, 0 breaking
     ```

IMPORTANT:
- DO NOT MERGE if there are breaking schema changes without a migration plan
- DO NOT MERGE if migrations haven't been tested on a production-like database
- CONFIRM database backup exists before proceeding with merge
- ASK FOR EXPLICIT CONFIRMATION before merging to main

Please proceed step-by-step and provide:
1. Migration analysis summary
2. Compatibility report
3. Risk assessment (LOW/MEDIUM/HIGH)
4. Recommendation to proceed or wait

Then ask for confirmation before creating the PR.
```

## Additional Migration Analysis Script

You might also want Claude Code to run this analysis script:

```typescript
// analyze-migrations.ts
import { execSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface MigrationAnalysis {
  newMigrations: string[];
  schemaChanges: {
    addedTables: string[];
    modifiedTables: string[];
    droppedTables: string[];
    addedColumns: string[];
    droppedColumns: string[];
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  breakingChanges: string[];
}

async function analyzeMigrations(): Promise<MigrationAnalysis> {
  // Get migrations from both branches
  const mainMigrations = getMigrationsFromBranch('main');
  const devMigrations = getMigrationsFromBranch('preview-development');

  const newMigrations = devMigrations.filter(m => !mainMigrations.includes(m));

  // Analyze Prisma schema diff
  const mainSchema = getSchemaFromBranch('main');
  const devSchema = getSchemaFromBranch('preview-development');

  const schemaChanges = analyzeSchemaChanges(mainSchema, devSchema);
  const breakingChanges = identifyBreakingChanges(schemaChanges);

  const riskLevel = calculateRiskLevel(schemaChanges, breakingChanges);

  return {
    newMigrations,
    schemaChanges,
    riskLevel,
    breakingChanges
  };
}

function getMigrationsFromBranch(branch: string): string[] {
  try {
    const content = execSync(
      `git show ${branch}:migrations`,
      { encoding: 'utf-8' }
    );
    return content.split('\n').filter(f => f.endsWith('.sql'));
  } catch {
    return [];
  }
}

function getSchemaFromBranch(branch: string): string {
  return execSync(
    `git show ${branch}:prisma/schema.prisma`,
    { encoding: 'utf-8' }
  );
}

function analyzeSchemaChanges(mainSchema: string, devSchema: string) {
  // Parse and compare schemas
  const mainModels = extractModels(mainSchema);
  const devModels = extractModels(devSchema);

  return {
    addedTables: devModels.filter(m => !mainModels.includes(m)),
    modifiedTables: [], // Implement detailed comparison
    droppedTables: mainModels.filter(m => !devModels.includes(m)),
    addedColumns: [],
    droppedColumns: []
  };
}

function extractModels(schema: string): string[] {
  const modelRegex = /model\s+(\w+)\s*{/g;
  const models: string[] = [];
  let match;

  while ((match = modelRegex.exec(schema)) !== null) {
    models.push(match[1]);
  }

  return models;
}

function identifyBreakingChanges(schemaChanges: any): string[] {
  const breaking: string[] = [];

  if (schemaChanges.droppedTables.length > 0) {
    breaking.push(`Dropped tables: ${schemaChanges.droppedTables.join(', ')}`);
  }

  if (schemaChanges.droppedColumns.length > 0) {
    breaking.push(`Dropped columns: ${schemaChanges.droppedColumns.join(', ')}`);
  }

  return breaking;
}

function calculateRiskLevel(
  schemaChanges: any,
  breakingChanges: string[]
): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (breakingChanges.length > 0) return 'HIGH';
  if (schemaChanges.modifiedTables.length > 3) return 'MEDIUM';
  return 'LOW';
}

// Run analysis
analyzeMigrations().then(result => {
  console.log(JSON.stringify(result, null, 2));
});
```
