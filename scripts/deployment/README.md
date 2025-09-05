# Deployment Scripts for User Deletion Endpoint

## Overview

This directory contains comprehensive deployment scripts for safely deploying the user deletion endpoint (`DELETE /api/users/[userId]`) across all environments.

## Scripts Overview

### 🔍 Pre-Deployment Validation

**Script**: `pre-deployment-checks.sh`

Comprehensive validation before any deployment:

- Environment and dependency checks
- Code quality validation (TypeScript, ESLint)
- Test suite execution
- Database schema validation
- Security implementation verification

```bash
# Run pre-deployment checks
./scripts/deployment/pre-deployment-checks.sh

# Exit code 0 = ready for deployment
# Exit code > 0 = issues found, check output
```

### 💾 Database Backup & Restore

**Script**: `backup-production-db.sh`

Creates comprehensive backups before deployment:

- Full database backup with compression
- Schema-only backup
- Table-specific backups for affected tables
- Backup integrity verification with checksums
- Automated cleanup of old backups

```bash
# Create production backup
./scripts/deployment/backup-production-db.sh

# Environment variables are set for other scripts:
# BACKUP_TIMESTAMP, BACKUP_FULL_FILE, BACKUP_MANIFEST_FILE
```

### 🚨 Emergency Rollback

**Script**: `emergency-rollback.sh`

Provides immediate rollback capabilities:

- Feature flag disable (fastest rollback)
- Application deployment revert
- Full rollback including database restoration
- Health check and verification

```bash
# Interactive rollback menu
./scripts/deployment/emergency-rollback.sh

# Automatic feature flag disable
./scripts/deployment/emergency-rollback.sh --auto

# Full rollback (including database)
./scripts/deployment/emergency-rollback.sh --full
```

### 🔧 Development Environment Validation

**Script**: `development-deployment-validation.sh`

Validates deployment in development environment:

- Application health checks
- Database connectivity testing
- Unit test execution
- Security configuration validation
- Performance benchmarking
- Generates detailed validation report

```bash
# Run development validation
./scripts/deployment/development-deployment-validation.sh

# Check results in generated JSON report
```

### 📊 Production Monitoring

**Script**: `production-deployment-monitor.sh`

Real-time monitoring during production deployment:

- Live dashboard with health metrics
- Error rate monitoring with alerting
- Response time tracking
- System resource monitoring
- Database performance monitoring
- Automated alert notifications

```bash
# Start production monitoring (1 hour default)
./scripts/deployment/production-deployment-monitor.sh

# Custom monitoring duration (30 minutes)
MONITORING_DURATION=1800 ./scripts/deployment/production-deployment-monitor.sh
```

## Deployment Workflow

### Phase 1: Pre-Deployment

```bash
# 1. Run pre-deployment validation
./scripts/deployment/pre-deployment-checks.sh

# 2. Create database backup
./scripts/deployment/backup-production-db.sh

# 3. Verify backup integrity (check generated manifest)
```

### Phase 2: Development Deployment

```bash
# 1. Deploy to development environment
# (Your deployment process here)

# 2. Validate deployment
./scripts/deployment/development-deployment-validation.sh

# 3. Review validation report
# Fix any issues before proceeding
```

### Phase 3: Staging Deployment

```bash
# 1. Deploy to staging environment
# (Your deployment process here)

# 2. Run integration tests
pnpm test:user-deletion:integration

# 3. Run load tests
# (Your load testing process here)

# 4. Security penetration testing
# (Your security testing process here)
```

### Phase 4: Production Deployment

```bash
# 1. Start monitoring in background
./scripts/deployment/production-deployment-monitor.sh &

# 2. Deploy to production with feature flag disabled
# (Your production deployment process here)

# 3. Run production smoke tests
./scripts/deployment/production-smoke-tests.sh  # (if available)

# 4. Gradually enable feature
# (Your feature flag management process)

# 5. Monitor for issues
# Check the monitoring dashboard
```

### Phase 5: Post-Deployment Verification

```bash
# 1. Verify deployment success
# Monitor error rates and response times

# 2. If issues detected, rollback immediately
./scripts/deployment/emergency-rollback.sh --auto

# 3. If successful, continue monitoring
# Keep monitoring for 24-48 hours
```

## Configuration

### Environment Variables

**Required for all scripts:**

```bash
DATABASE_URL="postgresql://user:pass@host:port/db"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

**Optional for specific scripts:**

```bash
# Application URLs
DEV_APP_URL="http://localhost:3000"
STAGING_APP_URL="https://staging.ready-set.app"
PROD_APP_URL="https://ready-set.app"

# Monitoring configuration
MONITORING_DURATION=3600  # 1 hour
CHECK_INTERVAL=30         # 30 seconds

# Alert thresholds
ERROR_RATE_WARNING=0.5    # 0.5%
ERROR_RATE_CRITICAL=2.0   # 2.0%
RESPONSE_TIME_WARNING=5.0 # 5 seconds
RESPONSE_TIME_CRITICAL=10.0 # 10 seconds

# Backup configuration
BACKUP_DIR="/var/backups/ready-set-db"
RETENTION_DAYS=30

# Rollback configuration
FORCE_DATABASE_RESTORE=false  # Set to true for database restoration
```

### Alerting Integration

The scripts support integration with various alerting systems. Uncomment and configure the relevant sections in the scripts:

**Slack Integration:**

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

**Email Alerts:**

```bash
export ALERT_EMAIL="ops@ready-set.app"
```

**PagerDuty Integration:**

```bash
export PAGERDUTY_KEY="your-integration-key"
```

## File Locations

### Log Files

- Deployment validation logs: `./validation-results-*.json`
- Deployment monitoring logs: `/var/logs/ready-set/deployment-monitor-*.log`
- Rollback logs: `/var/logs/ready-set/rollback-*.log`
- Backup manifests: `/var/backups/ready-set-db/pre-user-deletion-deployment-manifest-*.json`

### Backup Files

- Full backups: `/var/backups/ready-set-db/pre-user-deletion-deployment-full-*.sql.gz`
- Schema backups: `/var/backups/ready-set-db/pre-user-deletion-deployment-schema-*.sql`
- Table backups: `/var/backups/ready-set-db/table-backups-*/`
- Checksums: `/var/backups/ready-set-db/pre-user-deletion-deployment-checksums-*.md5`

### Metrics Files

- Deployment metrics: `/var/logs/ready-set/deployment-metrics-*.json`
- Performance data: Available in JSON format for analysis

## Security Considerations

### Database Access

- Scripts use environment variables for database credentials
- Backup files are created with restricted permissions (750)
- Database restoration requires explicit `FORCE_DATABASE_RESTORE=true`

### Emergency Procedures

- Rollback scripts include safety confirmations
- Critical operations generate alerts
- All operations are logged for audit trails

### Access Control

- Scripts should be run by authorized deployment personnel only
- Log files contain sensitive information - secure appropriately
- Backup files contain full database dumps - encrypt and secure

## Troubleshooting

### Common Issues

**"Command not found" errors:**

```bash
# Install missing dependencies
sudo apt-get install curl bc postgresql-client-common

# For macOS
brew install curl bc postgresql
```

**Database connection failures:**

```bash
# Check DATABASE_URL format
# Should be: postgresql://user:password@host:port/database

# Test connection manually
psql "$DATABASE_URL" -c "SELECT 1;"
```

**Permission errors:**

```bash
# Make scripts executable
chmod +x scripts/deployment/*.sh

# Create required directories
sudo mkdir -p /var/logs/ready-set /var/backups/ready-set-db
sudo chown $USER:$USER /var/logs/ready-set /var/backups/ready-set-db
```

**Monitoring dashboard issues:**

```bash
# Check if bc (calculator) is installed
which bc || sudo apt-get install bc

# Verify curl supports timing options
curl --version
```

### Getting Help

1. **Check script help:** `./script-name.sh --help`
2. **Review log files:** Check the generated log files for detailed error messages
3. **Validate environment:** Ensure all required environment variables are set
4. **Test prerequisites:** Run the pre-deployment checks script first

## Best Practices

### Before Running Scripts

1. **Test in development first** - Always validate scripts in dev environment
2. **Verify backups** - Test backup restoration in isolated environment
3. **Prepare rollback** - Have emergency rollback procedures ready
4. **Notify team** - Alert team members before production deployment

### During Deployment

1. **Monitor actively** - Watch the monitoring dashboard closely
2. **Have emergency contacts ready** - Keep escalation contacts available
3. **Document issues** - Log any problems encountered
4. **Be ready to rollback** - Don't hesitate if issues are detected

### After Deployment

1. **Monitor extended period** - Watch metrics for 24-48 hours
2. **Verify functionality** - Test user deletion scenarios
3. **Review logs** - Analyze logs for any anomalies
4. **Update documentation** - Document lessons learned

---

## Related Documentation

- [User Deletion API Documentation](../../docs/api/user-deletion-endpoint.md)
- [Deployment Strategy Guide](../../docs/deployment/user-deletion-deployment-strategy.md)
- [Testing Strategy Guide](../../docs/testing/user-deletion-testing-guide.md)
- [Security Guidelines](../../docs/security/user-deletion-security.md)
