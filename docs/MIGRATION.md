# Database Migration Guide

This guide covers migrating data and schema changes between development and production environments.

## 🎯 Overview

Our development setup uses Docker PostgreSQL while production uses Supabase. This guide helps you:

- Sync schema changes safely
- Move data between environments  
- Handle production-development workflows
- Manage migrations properly

## 🔄 Schema Migration Workflow

### Development → Production

1. **Develop schema changes locally**:
   ```bash
   # Edit prisma/schema.prisma
   pnpm prisma db push  # Apply to dev database
   pnpm dev:db:seed     # Test with seed data
   ```

2. **Test thoroughly**:
   ```bash
   pnpm test            # Run full test suite
   pnpm dev             # Manual testing
   ```

3. **Generate migration** (when ready for production):
   ```bash
   pnpm prisma migrate dev --name "add_user_preferences"
   ```

4. **Deploy to production**:
   ```bash
   # This will be handled by your CI/CD or manually:
   pnpm prisma migrate deploy
   ```

### Production → Development

When syncing back from production changes:

1. **Pull latest schema**:
   ```bash
   git pull origin main
   ```

2. **Update local database**:
   ```bash
   pnpm prisma db push
   ```

3. **Reseed if needed**:
   ```bash
   pnpm dev:db:reset  # Fresh start with new schema
   ```

## 📊 Data Migration Strategies

### 1. Production Data → Development (Anonymized)

For testing with production-like data:

```bash
# 1. Export anonymized production data
# (This would be a custom script you create)
pnpm export:production:anonymized

# 2. Import to development
pnpm import:anonymized:data
```

### 2. Development Test Data → Staging

Share development test scenarios:

```bash
# 1. Create specific test scenarios
pnpm dev:db:seed:scenario customer_journey
pnpm dev:db:seed:scenario edge_cases

# 2. Export scenarios
pnpm export:test:scenarios

# 3. Apply to staging
pnpm staging:import:scenarios
```

### 3. Configuration Migration

Migrate configuration changes:

```bash
# 1. Export configuration from production
pnpm export:config:production

# 2. Apply to development (with modifications)
pnpm import:config:development
```

## 🛡️ Safety Guidelines

### Before Any Migration

1. **Always backup first**:
   ```bash
   # Development
   ./scripts/backup-dev-db.sh
   
   # Production (through Supabase dashboard)
   # or automated backup scripts
   ```

2. **Test on staging first**:
   ```bash
   # Never migrate directly to production
   # Always use: dev → staging → production
   ```

3. **Verify schema compatibility**:
   ```bash
   pnpm prisma validate
   pnpm typecheck
   ```

### Migration Checklist

- [ ] Schema changes tested locally
- [ ] All tests pass
- [ ] Backup created
- [ ] Migration script reviewed
- [ ] Rollback plan prepared
- [ ] Team notified
- [ ] Staged deployment tested

## 🔧 Environment-Specific Configurations

### Development Environment

```env
# .env.local
DATABASE_URL="postgresql://dev_user:dev_password@localhost:5432/ready_set_dev"
DIRECT_URL="postgresql://dev_user:dev_password@localhost:5432/ready_set_dev"

# Local file storage
UPLOAD_DIRECTORY="./uploads"
NEXT_PUBLIC_UPLOAD_URL="http://localhost:3000/uploads"
```

### Production Environment

```env
# .env.production (Vercel)
DATABASE_URL="postgresql://[user]:[pass]@[host]:5432/[db]?pgbouncer=true"
DIRECT_URL="postgresql://[user]:[pass]@[host]:5432/[db]"

# Supabase storage
NEXT_PUBLIC_SUPABASE_URL="https://[project].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
```

## 📝 Migration Scripts

### Custom Migration Script Template

Create custom migration scripts in `scripts/migrations/`:

```typescript
// scripts/migrations/202401XX_add_user_preferences.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function up() {
  // Forward migration
  await prisma.$executeRaw`
    -- Your migration SQL here
    ALTER TABLE profiles ADD COLUMN preferences JSONB DEFAULT '{}';
  `;
  
  console.log('✅ Migration completed: add_user_preferences');
}

export async function down() {
  // Rollback migration
  await prisma.$executeRaw`
    -- Your rollback SQL here
    ALTER TABLE profiles DROP COLUMN preferences;
  `;
  
  console.log('✅ Rollback completed: add_user_preferences');
}

// Run migration
if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
```

### Data Anonymization Script

```typescript
// scripts/anonymize-production-data.ts
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

export async function anonymizeData() {
  console.log('🔒 Anonymizing production data...');
  
  // Anonymize user data
  const profiles = await prisma.profile.findMany();
  
  for (const profile of profiles) {
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        contactNumber: faker.phone.number(),
        // Keep structure, anonymize content
      }
    });
  }
  
  console.log(`✅ Anonymized ${profiles.length} profiles`);
}
```

## 🚨 Emergency Procedures

### Rollback Production Migration

1. **Immediate rollback**:
   ```bash
   # Use Prisma migration rollback
   pnpm prisma migrate resolve --rolled-back [migration_name]
   ```

2. **Database restore** (if needed):
   ```bash
   # Through Supabase dashboard
   # Restore from automated backup
   ```

3. **Code rollback**:
   ```bash
   git revert [commit_hash]
   # Deploy immediately
   ```

### Development Database Corruption

1. **Quick reset**:
   ```bash
   pnpm dev:db:reset  # Nuclear option
   ```

2. **Restore from backup**:
   ```bash
   ./scripts/restore-dev-db.sh ./backups/[backup_file].gz
   ```

3. **Rebuild from scratch**:
   ```bash
   pnpm dev:setup  # Complete fresh setup
   ```

## 🔍 Migration Monitoring

### Track Migration Status

```bash
# Check migration status
pnpm prisma migrate status

# View migration history
pnpm prisma migrate diff
```

### Performance Monitoring

During migrations, monitor:

1. **Query performance**
2. **Connection pools**
3. **Lock contention**
4. **Disk space usage**

## 🤝 Team Coordination

### Migration Communication

1. **Before migration**:
   - Announce in team chat
   - Update migration log
   - Schedule maintenance window

2. **During migration**:
   - Monitor systems
   - Be available for issues
   - Document any problems

3. **After migration**:
   - Confirm success
   - Update documentation
   - Share any lessons learned

### Migration Log Template

```markdown
## Migration: [Name] - [Date]

### Changes
- [ ] Schema changes
- [ ] Data changes  
- [ ] Configuration changes

### Pre-migration
- [ ] Backup created
- [ ] Team notified
- [ ] Tests passed

### Post-migration
- [ ] Verification completed
- [ ] Performance checked
- [ ] Documentation updated
```

## 📚 Best Practices

### 1. Schema Evolution

- **Additive changes first**: Add columns before removing
- **Default values**: Always provide defaults for new columns
- **Gradual rollout**: Phase complex changes

### 2. Data Migration

- **Batch processing**: Handle large datasets in chunks
- **Transactional**: Use transactions for data consistency
- **Validation**: Verify data integrity after migration

### 3. Testing

- **Local testing**: Always test migrations locally first
- **Staging validation**: Use staging environment
- **Rollback testing**: Test rollback procedures

### 4. Documentation

- **Migration notes**: Document all changes
- **Breaking changes**: Highlight API breaking changes
- **Recovery procedures**: Document rollback steps

## 🔗 Related Resources

- [Prisma Migration Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Supabase Migration Docs](https://supabase.com/docs/guides/database/migrating-and-upgrading-projects)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/current/backup.html)

---

This migration strategy ensures **safe, predictable, and reversible** changes between your development and production environments. 