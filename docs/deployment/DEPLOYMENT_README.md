# Production Deployment Documentation

**Project:** Ready Set
**Generated:** 2025-10-03
**Status:** Ready for Review

---

## 🚨 CRITICAL ALERT

**DO NOT PROCEED** with automatic deployment/migration. The dev and production databases have **completely divergent migration histories** that cannot be automatically merged.

---

## 📚 Documentation Index

This deployment preparation has generated comprehensive documentation to safely deploy to production:

### Core Documents

1. **[SCHEMA_COMPARISON.md](./SCHEMA_COMPARISON.md)** - Database Schema Analysis
   - Complete schema differences between dev and prod
   - Security vulnerabilities identified
   - Performance issues documented
   - Migration gap analysis
   - **READ THIS FIRST**

2. **[DEPLOYMENT_PLAN.md](./DEPLOYMENT_PLAN.md)** - Step-by-Step Deployment Guide
   - Week-by-week timeline (3-4 weeks)
   - Detailed deployment procedures
   - SQL migration scripts
   - Verification procedures
   - Emergency contacts

3. **[PRE_PRODUCTION_CHECKLIST.md](./PRE_PRODUCTION_CHECKLIST.md)** - Comprehensive Checklist
   - Code review requirements
   - Security validations
   - Database checks
   - Performance requirements
   - Sign-off procedures

4. **[ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md)** - Emergency Rollback Procedures
   - 3 rollback types (5 min, 15 min, 30-60 min)
   - Step-by-step rollback instructions
   - Rollback triggers and decision matrix
   - Post-rollback verification

5. **[backups/BACKUP_PROCEDURES.md](./backups/BACKUP_PROCEDURES.md)** - Backup & Restore Guide
   - Automated and manual backup procedures
   - Multiple backup methods
   - Restore procedures
   - Validation scripts

### Scripts & Tools

6. **[scripts/compare-databases.ts](./scripts/compare-databases.ts)** - Database Comparison Tool
   - Automated schema comparison
   - Row count analysis
   - Difference reporting
   - JSON export

7. **[.env.example](./.env.example)** - Environment Variables Reference
   - All required env vars documented
   - Dev and prod configurations
   - Security best practices

---

## 📊 Key Findings Summary

### Critical Issues Identified

#### 1. Migration History Divergence
- **Dev:** 15 migrations starting September 2025
- **Prod:** 15 migrations starting April 2025
- **Impact:** Standard migration tools WILL NOT WORK
- **Solution:** Manual schema migration required

#### 2. Security Gaps

**Dev Database:**
- ❌ RLS disabled on 7 critical tables
- ❌ Only 3 RLS policies active
- ❌ Leaked password protection disabled

**Prod Database:**
- ❌ RLS disabled on 14 tables
- ⚠️ 48 RLS policies need performance optimization
- ⚠️ Function security issues (3 functions)
- ⚠️ PostgreSQL 15 has security patches available

#### 3. Schema Differences

**Tables only in Dev:**
- `testimonials` (10 rows)

**Tables only in Prod:**
- `drivers` (0 rows)
- `driver_locations` (0 rows)
- `driver_shifts` (0 rows)
- `shift_breaks` (0 rows)
- `deliveries` (0 rows)
- `spatial_ref_sys` (8,500 rows - PostGIS)
- `_prisma_migrations` (2 rows)

#### 4. Extension Differences
- **Prod has PostGIS** (critical for geolocation)
- **Dev lacks PostGIS**
- Different `pg_stat_statements` versions

#### 5. Data Volume Differences
- **Prod:** 107 profiles, 102 addresses, 53 catering requests
- **Dev:** 13 profiles, 22 addresses, 9 catering requests
- **Delta:** Prod has ~400+ more rows of production data

---

## 🎯 Deployment Strategy

### Recommended: Manual Schema Migration (Option A)

**Timeline:** 3-4 weeks
**Downtime:** < 1 hour
**Risk Level:** Medium
**Data Loss:** None

**What This Means:**
1. ✅ Keep all production data
2. ✅ Manually apply dev features to prod
3. ✅ Test in staging first
4. ✅ Rollback capability maintained
5. ❌ Cannot use standard migration tools

### Alternative Options

**Option B: Fresh Production Database**
- Timeline: 2-3 weeks
- Downtime: 2-4 hours
- Risk: High
- Data Loss: Requires data migration

**Option C: Keep Databases Separate**
- Timeline: Ongoing
- Downtime: None
- Risk: Low
- Maintenance: High

---

## 📋 Pre-Deployment Checklist Summary

### Week 1: Security & Approval
- [ ] Review all documentation
- [ ] Fix critical security issues in staging
- [ ] Stakeholder meeting and approval
- [ ] Create and test backups

### Week 2: Script Development
- [ ] Write schema migration SQL
- [ ] Create RLS policy scripts
- [ ] Develop performance optimizations
- [ ] Build verification scripts

### Week 3: Staging Tests
- [ ] Clone prod to staging
- [ ] Apply all migration scripts
- [ ] Run comprehensive tests
- [ ] Test rollback procedures

### Week 4: Production Deployment
- [ ] Final backup of production
- [ ] Apply migration scripts
- [ ] Deploy application code
- [ ] Verify and monitor

---

## 🚀 Quick Start Guide

### For Team Leads (First Time)

1. **Read Documentation (30 minutes)**
   ```bash
   # Review in this order:
   cat SCHEMA_COMPARISON.md        # Understand differences
   cat DEPLOYMENT_PLAN.md          # Learn deployment process
   cat PRE_PRODUCTION_CHECKLIST.md # Know requirements
   ```

2. **Verify Environment Setup**
   ```bash
   # Check you have access to both databases
   echo $NEXT_PUBLIC_SUPABASE_URL           # Prod
   echo $NEXT_PUBLIC_SUPABASE_DEV_URL       # Dev
   ```

3. **Run Database Comparison**
   ```bash
   # See current state
   npx tsx scripts/compare-databases.ts
   ```

4. **Schedule Team Meeting**
   - Attendees: Engineering Lead, DevOps, Product, Security
   - Duration: 1 hour
   - Agenda: Review findings, choose strategy, assign tasks

### For Developers (Contributing)

1. **Understand Current State**
   - Read SCHEMA_COMPARISON.md
   - Understand why automatic deployment won't work

2. **Development Guidelines**
   - Work in `preview-development` branch
   - DO NOT create new migrations manually
   - Schema changes must be documented
   - Test RLS policies thoroughly

3. **Pre-PR Requirements**
   - Run type checking: `npm run type-check`
   - Run tests: `npm test`
   - Verify no security issues
   - Document any schema changes

---

## 🔧 Essential Commands

### Database Comparison
```bash
# Compare dev and prod databases
npx tsx scripts/compare-databases.ts

# Output: JSON report in ./backups/
```

### Create Backup
```bash
# Automated backup (if script is set up)
./scripts/backup-database.sh production full

# Manual via Supabase Dashboard:
# Dashboard → Database → Backups → Create Backup
```

### Verify Deployment Readiness
```bash
# Run all checks
npm run build              # Build succeeds
npm test                   # Tests pass
npm run lint               # No lint errors

# Check documentation
ls -la *.md               # All docs present
```

---

## 📞 Emergency Contacts

### Deployment Team
- **Deployment Lead:** [Name] - [Phone]
- **DevOps Engineer:** [Name] - [Phone]
- **Database Admin:** [Name] - [Phone]
- **Security Lead:** [Name] - [Phone]

### Escalation Path
1. Engineering Manager
2. CTO/VP Engineering
3. On-Call Rotation: [Link to PagerDuty/Oncall]

---

## ⚠️ Important Warnings

### DO NOT Do These Things

1. ❌ **DO NOT** merge `preview-development` to `main` without following this plan
2. ❌ **DO NOT** run database migrations automatically
3. ❌ **DO NOT** use Prisma/Drizzle migration tools directly
4. ❌ **DO NOT** deploy without stakeholder approval
5. ❌ **DO NOT** skip staging environment testing
6. ❌ **DO NOT** deploy without backups
7. ❌ **DO NOT** proceed if any critical checklist items are incomplete

### Safety Requirements

1. ✅ **ALWAYS** create backup before any database change
2. ✅ **ALWAYS** test in staging first
3. ✅ **ALWAYS** have rollback plan ready
4. ✅ **ALWAYS** monitor closely post-deployment
5. ✅ **ALWAYS** document all changes
6. ✅ **ALWAYS** communicate with team

---

## 📈 Success Criteria

### Deployment Successful If:
- ✅ Error rate < 1% (baseline)
- ✅ No authentication failures
- ✅ No data loss or corruption
- ✅ Response times within 10% of baseline
- ✅ All RLS policies active and working
- ✅ No security vulnerabilities
- ✅ User feedback positive

### Rollback Required If:
- ❌ Error rate > 5%
- ❌ Authentication broken
- ❌ Data corruption detected
- ❌ Performance degradation > 50%
- ❌ Security breach detected

---

## 📝 Next Steps

### Immediate Actions (This Week)
1. [ ] **Team Lead:** Schedule deployment planning meeting
2. [ ] **Team Lead:** Assign document review tasks
3. [ ] **DevOps:** Verify access to both databases
4. [ ] **Security:** Review security findings
5. [ ] **All:** Read SCHEMA_COMPARISON.md

### Week 1 Tasks
1. [ ] Stakeholder approval meeting
2. [ ] Create staging environment
3. [ ] Begin security fixes
4. [ ] Document current production state

### Week 2 Tasks
1. [ ] Develop migration scripts
2. [ ] Create test suite
3. [ ] Setup monitoring alerts
4. [ ] Prepare communication plan

---

## 🔍 Verification Commands

### Check Environment Variables
```bash
# Required for prod deployment
echo "Prod URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "Prod Anon Key: ${NEXT_PUBLIC_SUPABASE_ANON_KEY:0:20}..."

# Required for dev
echo "Dev URL: $NEXT_PUBLIC_SUPABASE_DEV_URL"
echo "Dev Anon Key: ${NEXT_PUBLIC_SUPABASE_DEV_ANON_KEY:0:20}..."
```

### Database Health Check
```bash
# Via curl (if health endpoint exists)
curl https://your-production-domain.com/api/health

# Expected: {"status":"ok","database":"connected"}
```

### Application Build
```bash
# Production build test
npm run build

# Should complete without errors
# Build artifacts in .next/
```

---

## 📊 Project Statistics

### Database Metrics (As of 2025-10-03)

| Metric | Dev | Prod | Status |
|--------|-----|------|--------|
| **PostgreSQL Version** | 17.6.1 | 15.8.1 | ⚠️ Version mismatch |
| **Region** | us-west-1 | us-east-1 | ⚠️ Different regions |
| **Total Tables** | 19 | 25 | ⚠️ 6 tables difference |
| **Total Rows** | ~100 | ~500 | ✅ Expected |
| **RLS Enabled Tables** | 1 | 13 | ⚠️ Security gap |
| **RLS Policies** | 3 | 48 | ⚠️ Major difference |
| **Extensions** | 7 | 9 | ⚠️ PostGIS in prod only |

### Code Metrics

| Metric | Value |
|--------|-------|
| **TypeScript Files** | ~150+ |
| **Components** | ~80+ |
| **API Routes** | ~30+ |
| **Test Files** | ~50+ |
| **Documentation Pages** | 6 (deployment) |

---

## 🎓 Learning Resources

### For New Team Members

1. **Supabase Basics**
   - [Supabase Documentation](https://supabase.com/docs)
   - [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

2. **Database Migrations**
   - Our approach: Manual schema migration
   - Why: Divergent migration histories
   - Process: See DEPLOYMENT_PLAN.md

3. **Security Best Practices**
   - Enable RLS on all public tables
   - Optimize auth.uid() calls with SELECT wrapper
   - Regular security audits

### Internal Documentation
- Project Wiki: [Link]
- Architecture Docs: [Link]
- API Documentation: [Link]

---

## 🔄 Maintenance Schedule

### Daily
- Monitor error rates
- Check database performance
- Review user feedback

### Weekly
- Review deployment progress
- Team sync meeting
- Update documentation

### Monthly
- Full security audit
- Performance optimization
- Backup verification
- Process improvement review

---

## 📅 Deployment Timeline

```
Week 1: Security & Approval
├── Day 1-2: Fix security issues in staging
├── Day 3: Stakeholder meeting
└── Day 4-5: Backup & rollback planning

Week 2: Script Development
├── Day 1-2: Write migration scripts
├── Day 3-4: Create test suite
└── Day 5: Code review & refinement

Week 3: Staging Tests
├── Day 1: Apply scripts to staging
├── Day 2-3: Comprehensive testing
├── Day 4: Rollback test
└── Day 5: Final review

Week 4: Production Deployment
├── Day 1-2: Pre-deployment prep
├── Day 3: DEPLOYMENT DAY 🚀
└── Day 4-5: Monitoring & documentation
```

---

## ✅ Completion Status

### Documents Created ✓
- [x] SCHEMA_COMPARISON.md
- [x] DEPLOYMENT_PLAN.md
- [x] PRE_PRODUCTION_CHECKLIST.md
- [x] ROLLBACK_PLAN.md
- [x] backups/BACKUP_PROCEDURES.md
- [x] scripts/compare-databases.ts
- [x] DEPLOYMENT_README.md (this file)

### Backups
- [x] Backup directory structure created
- [ ] Production backup created (do before deployment)
- [ ] Dev backup created (do before deployment)
- [ ] Backup procedures tested

### Environment
- [x] Database projects identified
- [x] Environment variables documented
- [ ] Staging environment setup (Week 1)
- [ ] All credentials verified (Week 1)

---

## 🎯 Final Notes

**This is a complex deployment** that requires careful planning and execution. The divergent migration histories mean we cannot use standard automated deployment tools.

**Success depends on:**
1. Following the documented process exactly
2. Testing everything in staging first
3. Having rollback plan ready
4. Team coordination and communication
5. Patience and attention to detail

**Remember:**
- Safety > Speed
- Documentation > Memory
- Testing > Assumptions
- Communication > Silence

---

**Questions or Issues?**
- Slack: #engineering-deployment
- Email: engineering@readyset.com
- Emergency: [On-call rotation]

**Last Updated:** 2025-10-03
**Next Review:** Before deployment (Week 3)
