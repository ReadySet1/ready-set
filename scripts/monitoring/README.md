# Post-Deployment Monitoring Scripts for User Deletion Endpoint

## Overview

This directory contains comprehensive post-deployment monitoring tools for the user deletion endpoint (`DELETE /api/users/[userId]`). The monitoring strategy is divided into immediate (24-48 hours) and long-term (1-4 weeks) monitoring phases.

## Scripts Overview

### 🔍 Immediate Monitoring (24-48 hours)

**Script**: `immediate-monitoring.sh`

Provides real-time monitoring immediately after production deployment:

- **Error Rate Tracking**: Monitors deletion success/failure rates with automated alerting
- **Performance Monitoring**: Tracks response times, database performance, and system resources
- **Transaction Timeout Monitoring**: Watches for unusual timeout patterns
- **Memory Usage Tracking**: Monitors memory consumption during complex deletions
- **Live Dashboard**: Real-time console dashboard with color-coded status indicators

```bash
# Start 48-hour immediate monitoring
pnpm monitor:immediate

# Custom monitoring duration (24 hours)
MONITORING_DURATION=86400 pnpm monitor:immediate

# Custom check interval (30 seconds)
CHECK_INTERVAL=30 pnpm monitor:immediate
```

### 📊 Long-term Monitoring (1-4 weeks)

**Script**: `long-term-monitoring.sh`

Performs comprehensive analysis over extended periods:

- **Data Integrity Validation**: Random audits of deletion completeness
- **Orphaned Record Detection**: Automated scanning for data integrity issues
- **Usage Pattern Analysis**: Deletion frequency patterns and trend identification
- **Failure Scenario Classification**: Analysis of common failure scenarios
- **Performance Optimization Opportunities**: Identification of improvement areas

```bash
# Start 4-week long-term monitoring
pnpm monitor:long-term

# Generate one-time comprehensive report
pnpm monitor:long-term -- --report-only

# Custom monitoring period (2 weeks)
MONITORING_PERIOD=1209600 pnpm monitor:long-term
```

### 🔐 Data Integrity Validation

**Script**: `data-integrity-validator.sh`

Performs comprehensive data integrity checks:

- **Foreign Key Constraint Validation**: Ensures no orphaned references
- **Cascade Deletion Verification**: Validates completeness of automated deletions
- **Manual Cleanup Validation**: Verifies proper handling of Dispatch, FileUpload, and Address records
- **Audit Trail Completeness**: Ensures all operations are properly logged
- **Data Consistency Checks**: Validates overall data consistency

```bash
# Run comprehensive data integrity validation
pnpm monitor:data-integrity

# Results saved to: /var/logs/ready-set/integrity/data-integrity-*.json
```

### 📈 Usage Pattern Analysis

**Script**: `usage-pattern-analyzer.sh`

Analyzes usage patterns and generates optimization insights:

- **Deletion Frequency Analysis**: Daily, weekly, and hourly usage patterns
- **User Type Patterns**: Analysis of deletion patterns by user type
- **Failure Scenario Analysis**: Classification and trending of failure types
- **Performance Pattern Analysis**: Identification of performance bottlenecks
- **Optimization Recommendations**: Automated generation of improvement suggestions

```bash
# Run comprehensive usage pattern analysis
pnpm monitor:usage-patterns

# Custom analysis period (2 weeks)
ANALYSIS_PERIOD=1209600 pnpm monitor:usage-patterns
```

---

## Monitoring Workflow

### Phase 1: Immediate Post-Deployment (0-48 hours)

```bash
# Step 1: Start immediate monitoring
pnpm monitor:immediate

# The script will:
# - Monitor error rates (threshold: 1%)
# - Track response times (threshold: 3 seconds)
# - Watch for timeout errors (threshold: 5 per hour)
# - Monitor system resources (memory, CPU, disk)
# - Display live dashboard with real-time metrics
# - Generate alerts for threshold violations
# - Create comprehensive metrics file
```

### Phase 2: Data Integrity Validation (Daily)

```bash
# Step 2: Run daily data integrity checks
pnpm monitor:data-integrity

# The script will:
# - Scan for orphaned records across all tables
# - Validate foreign key constraints
# - Verify cascade deletion completeness
# - Check audit trail consistency
# - Generate detailed integrity report
# - Alert on any data consistency issues
```

### Phase 3: Long-term Analysis (Weekly)

```bash
# Step 3: Generate weekly analysis reports
pnpm monitor:long-term -- --report-only

# The script will:
# - Analyze usage patterns and trends
# - Identify performance optimization opportunities
# - Classify and trend failure scenarios
# - Generate actionable recommendations
# - Create comprehensive analysis report
```

### Phase 4: Usage Pattern Optimization (Monthly)

```bash
# Step 4: Comprehensive usage pattern analysis
pnpm monitor:usage-patterns

# The script will:
# - Analyze deletion frequency patterns
# - Identify peak usage times and performance impacts
# - Classify failure scenarios and root causes
# - Generate optimization recommendations
# - Create detailed usage pattern report
```

---

## Configuration

### Environment Variables

**Required for all scripts:**

```bash
DATABASE_URL="postgresql://user:pass@host:port/db"
```

**Optional configuration:**

```bash
# Immediate monitoring
MONITORING_DURATION=172800    # 48 hours (default)
CHECK_INTERVAL=60            # 1 minute (default)
PROD_APP_URL="https://ready-set.app"

# Long-term monitoring
MONITORING_PERIOD=2419200    # 4 weeks (default)
AUDIT_INTERVAL=86400         # 24 hours (default)
REPORT_INTERVAL=604800       # 7 days (default)

# Usage pattern analysis
ANALYSIS_PERIOD=2419200      # 4 weeks (default)

# Alert thresholds
ERROR_RATE_THRESHOLD=1.0     # 1% error rate
RESPONSE_TIME_THRESHOLD=3000 # 3 seconds
TIMEOUT_THRESHOLD=5          # 5 timeouts per hour
```

### Alert Integration

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

---

## Monitoring Thresholds and Alerts

### Immediate Monitoring Thresholds

| Metric         | Warning  | Critical | Action                   |
| -------------- | -------- | -------- | ------------------------ |
| Error Rate     | > 0.5%   | > 1%     | Investigate immediately  |
| Response Time  | > 3s     | > 5s     | Performance optimization |
| Memory Usage   | > 80%    | > 90%    | Resource scaling         |
| Timeout Errors | > 3/hour | > 5/hour | Database optimization    |

### Data Integrity Thresholds

| Issue Type         | Warning | Critical | Action                  |
| ------------------ | ------- | -------- | ----------------------- |
| Orphaned Records   | > 5     | > 10     | Data cleanup required   |
| Failed Constraints | > 0     | > 5      | Immediate investigation |
| Audit Gaps         | > 0     | > 1      | Audit system check      |
| Inconsistencies    | > 3     | > 10     | Data repair needed      |

### Performance Optimization Triggers

| Metric           | Threshold      | Recommendation     |
| ---------------- | -------------- | ------------------ |
| Average Duration | > 3s           | Query optimization |
| P95 Duration     | > 5s           | Transaction tuning |
| Slow Operations  | > 10/day       | Async processing   |
| Peak Hour Load   | > 50% capacity | Load balancing     |

---

## Output Files and Locations

### Log Directories

```
/var/logs/ready-set/
├── monitoring/                    # Immediate monitoring logs
│   ├── immediate-alerts-*.log     # Alert logs
│   └── long-term-monitoring.log   # Long-term monitoring logs
├── metrics/                       # Metrics data
│   ├── immediate-metrics-*.json   # Real-time metrics
│   └── deployment-metrics-*.json  # Deployment metrics
├── integrity/                     # Data integrity reports
│   └── data-integrity-*.json      # Integrity validation results
├── analysis/                      # Usage pattern analysis
│   └── usage-pattern-analysis-*.json # Pattern analysis reports
└── reports/                       # Comprehensive reports
    └── long-term-report-*.json     # Long-term analysis reports
```

### Report Formats

**Immediate Monitoring Metrics:**

```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "deletion_metrics": {
    "total_deletions": 45,
    "successful_deletions": 43,
    "failed_deletions": 2,
    "error_rate_percent": 4.44,
    "avg_response_time_ms": 1850
  },
  "application_metrics": {
    "health_status": "healthy",
    "response_time_ms": 245
  },
  "system_metrics": {
    "memory_usage_percent": 67.2,
    "cpu_usage_percent": 23.5,
    "disk_usage_percent": 45
  }
}
```

**Data Integrity Report:**

```json
{
  "data_integrity_validation": {
    "validation_timestamp": "2024-01-01T12:00:00Z",
    "total_issues_found": 0,
    "validation_status": "PASSED",
    "severity_level": "OK"
  },
  "summary": {
    "foreign_key_constraints": "0 issues",
    "cascade_deletions": "0 issues",
    "manual_cleanup": "0 issues",
    "audit_trail": "0 issues",
    "data_consistency": "0 issues"
  }
}
```

**Usage Pattern Analysis:**

```json
{
  "usage_pattern_analysis_report": {
    "analysis_period_days": 28,
    "generated_at": "2024-01-01T12:00:00Z"
  },
  "deletion_frequency_analysis": {
    "total_deletions": 1250,
    "success_rate_percent": 97.2,
    "peak_hour": 14,
    "peak_day": "Wednesday"
  },
  "optimization_recommendations": {
    "performance_optimization": [
      "Consider database query optimization for complex deletions"
    ],
    "failure_reduction": ["Implement improved error handling and user feedback"]
  }
}
```

---

## Dashboard and Visualization

### Real-time Dashboard (Immediate Monitoring)

The immediate monitoring script provides a live console dashboard:

```
================================================
 IMMEDIATE POST-DEPLOYMENT MONITORING - USER DELETION ENDPOINT
================================================
Timestamp: 2024-01-01T12:00:00Z
Monitoring Duration: 172800 seconds (48 hours)
Elapsed Time: 12.5 hours
Application URL: https://ready-set.app

🗑️  USER DELETION METRICS (Last Hour)
  Total Deletions: 23
  Successful: ✅ 22
  Failed: 1
  Error Rate: ✅ 4.3% (OK)
  Avg Response Time: 1850ms
  Timeout Errors: 0

📱 APPLICATION HEALTH
  Health Status: ✅ healthy
  Response Time: 245ms

💻 SYSTEM RESOURCES
  Memory Usage: ✅ 67.2% (OK)
  CPU Usage: 23.5%
  Disk Usage: 45%
  Load Average: 1.2

🚨 RECENT ALERTS (Last 5)
  No critical alerts

📋 MONITORING STATUS
  Press Ctrl+C to stop monitoring
  Next check in: 60 seconds
```

### Key Performance Indicators (KPIs)

**Reliability KPIs:**

- Success Rate: Target > 99%
- Error Rate: Target < 1%
- Availability: Target > 99.9%

**Performance KPIs:**

- Average Response Time: Target < 2s
- P95 Response Time: Target < 5s
- Timeout Rate: Target < 0.1%

**Data Integrity KPIs:**

- Orphaned Records: Target = 0
- Audit Coverage: Target = 100%
- Constraint Violations: Target = 0

---

## Automation and CI/CD Integration

### GitHub Actions Integration

```yaml
# .github/workflows/post-deployment-monitoring.yml
name: Post-Deployment Monitoring

on: deployment_status

jobs:
  immediate-monitoring:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start Immediate Monitoring
        run: |
          # Start monitoring in background
          nohup pnpm monitor:immediate > monitoring.log 2>&1 &
          echo $! > monitoring.pid

  data-integrity-check:
    runs-on: ubuntu-latest
    schedule:
      - cron: "0 6 * * *" # Daily at 6 AM
    steps:
      - uses: actions/checkout@v3
      - name: Run Data Integrity Check
        run: pnpm monitor:data-integrity

  weekly-analysis:
    runs-on: ubuntu-latest
    schedule:
      - cron: "0 9 * * 1" # Weekly on Monday at 9 AM
    steps:
      - uses: actions/checkout@v3
      - name: Generate Weekly Report
        run: pnpm monitor:long-term -- --report-only
```

### Cron Job Setup

```bash
# Add to crontab for automated monitoring
crontab -e

# Daily data integrity check at 6 AM
0 6 * * * cd /path/to/ready-set && pnpm monitor:data-integrity

# Weekly analysis report on Mondays at 9 AM
0 9 * * 1 cd /path/to/ready-set && pnpm monitor:long-term -- --report-only

# Monthly usage pattern analysis on 1st at 10 AM
0 10 1 * * cd /path/to/ready-set && pnpm monitor:usage-patterns
```

---

## Troubleshooting

### Common Issues

**"DATABASE_URL not configured" Error:**

```bash
# Ensure DATABASE_URL is set
export DATABASE_URL="postgresql://user:pass@host:port/db"

# Test database connectivity
psql "$DATABASE_URL" -c "SELECT 1;"
```

**Permission errors for log directories:**

```bash
# Create required directories with proper permissions
sudo mkdir -p /var/logs/ready-set/{monitoring,metrics,integrity,analysis,reports}
sudo chown -R $USER:$USER /var/logs/ready-set/
```

**No data available for analysis:**

```bash
# Check if audit_logs table exists and has data
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM audit_logs WHERE action = 'USER_DELETION';"

# Verify the analysis period covers actual deletions
# Adjust ANALYSIS_PERIOD if needed
```

**High memory usage during monitoring:**

```bash
# Reduce check frequency for resource-constrained environments
CHECK_INTERVAL=300  # 5 minutes instead of 1 minute

# Limit concurrent monitoring processes
# Stop other monitoring scripts before starting new ones
```

### Performance Optimization

**Large datasets:**

```bash
# Use shorter analysis periods for large datasets
ANALYSIS_PERIOD=604800  # 1 week instead of 4 weeks

# Implement data pagination in custom queries
# Consider database performance impact during peak hours
```

**Network connectivity issues:**

```bash
# Increase timeout values for slow connections
# Add retry logic for transient failures
# Use local database connections when possible
```

---

## Best Practices

### Monitoring Strategy

1. **Start with immediate monitoring** for first 48 hours after deployment
2. **Run daily data integrity checks** during the first week
3. **Generate weekly analysis reports** for trend identification
4. **Perform monthly comprehensive analysis** for optimization planning

### Alert Management

1. **Set appropriate thresholds** based on your environment and requirements
2. **Implement escalation procedures** for critical alerts
3. **Review and adjust thresholds** based on observed patterns
4. **Document alert response procedures** for on-call teams

### Data Retention

1. **Archive old monitoring data** to prevent disk space issues
2. **Maintain recent data** for trend analysis (recommended: 90 days)
3. **Backup critical reports** for compliance and audit purposes
4. **Implement automated cleanup** for log files older than retention period

### Performance Considerations

1. **Monitor the monitoring** - ensure scripts don't impact application performance
2. **Schedule intensive analysis** during low-traffic periods
3. **Use database read replicas** when available for monitoring queries
4. **Implement circuit breakers** to prevent monitoring from overwhelming the system

---

## Related Documentation

- [User Deletion API Documentation](../../docs/api/user-deletion-endpoint.md)
- [Deployment Strategy Guide](../../docs/deployment/user-deletion-deployment-strategy.md)
- [Testing Strategy Guide](../../docs/testing/user-deletion-testing-guide.md)
- [Data Integrity Guidelines](../../docs/database/data-integrity-guidelines.md)
