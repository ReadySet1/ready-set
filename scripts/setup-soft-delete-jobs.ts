#!/usr/bin/env ts-node

/**
 * Setup script for Soft Delete Scheduled Jobs
 * 
 * This script sets up the necessary scheduled jobs for:
 * - Automated cleanup of old soft-deleted users
 * - Monitoring and alerting for soft delete operations
 * - Data retention compliance checking
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface JobConfig {
  name: string;
  schedule: string; // Cron format
  command: string;
  description: string;
  enabled: boolean;
}

/**
 * Default job configurations
 */
const SOFT_DELETE_JOBS: JobConfig[] = [
  {
    name: 'soft-delete-cleanup',
    schedule: '0 3 * * *', // Daily at 3:00 AM
    command: 'cd /path/to/your/project && npm run job:cleanup-soft-deleted',
    description: 'Automated cleanup of soft-deleted users past retention period',
    enabled: true,
  },
  {
    name: 'soft-delete-monitoring',
    schedule: '0 */4 * * *', // Every 4 hours
    command: 'cd /path/to/your/project && npm run job:monitor-soft-delete',
    description: 'Monitor soft delete operations and generate alerts',
    enabled: true,
  },
  {
    name: 'retention-compliance-check',
    schedule: '0 8 * * 1', // Weekly on Monday at 8:00 AM
    command: 'cd /path/to/your/project && npm run job:retention-compliance',
    description: 'Weekly compliance check and reporting',
    enabled: true,
  },
  {
    name: 'soft-delete-metrics-daily',
    schedule: '0 9 * * *', // Daily at 9:00 AM
    command: 'cd /path/to/your/project && npm run job:daily-metrics',
    description: 'Collect and store daily soft delete metrics',
    enabled: true,
  },
];

/**
 * Create package.json scripts for the jobs
 */
async function setupPackageJsonScripts(): Promise<void> {
  console.log('📦 Setting up package.json scripts...');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json not found in current directory');
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Ensure scripts section exists
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  
  // Add job scripts
  packageJson.scripts['job:cleanup-soft-deleted'] = 'ts-node scripts/jobs/cleanup-soft-deleted.ts';
  packageJson.scripts['job:monitor-soft-delete'] = 'ts-node scripts/jobs/monitor-soft-delete.ts';
  packageJson.scripts['job:retention-compliance'] = 'ts-node scripts/jobs/retention-compliance.ts';
  packageJson.scripts['job:daily-metrics'] = 'ts-node scripts/jobs/daily-metrics.ts';
  
  // Write back to package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  
  console.log('✅ Package.json scripts added');
}

/**
 * Create job script files
 */
async function createJobScripts(): Promise<void> {
  console.log('📝 Creating job script files...');
  
  const jobsDir = path.join(process.cwd(), 'scripts', 'jobs');
  
  // Create jobs directory if it doesn't exist
  if (!fs.existsSync(jobsDir)) {
    fs.mkdirSync(jobsDir, { recursive: true });
  }
  
  // Cleanup job script
  const cleanupScript = `#!/usr/bin/env ts-node

/**
 * Automated Soft Delete Cleanup Job
 */

import { scheduledCleanup } from '../../src/jobs/cleanupSoftDeleted';

async function main() {
  try {
    console.log(\`[\${new Date().toISOString()}] Starting scheduled soft delete cleanup\`);
    await scheduledCleanup();
    console.log(\`[\${new Date().toISOString()}] Scheduled cleanup completed successfully\`);
    process.exit(0);
  } catch (error) {
    console.error(\`[\${new Date().toISOString()}] Scheduled cleanup failed:\`, error);
    process.exit(1);
  }
}

main();
`;

  // Monitoring job script
  const monitoringScript = `#!/usr/bin/env ts-node

/**
 * Soft Delete Monitoring Job
 */

import { scheduledMonitoring } from '../../src/lib/monitoring/softDeleteMonitoring';

async function main() {
  try {
    console.log(\`[\${new Date().toISOString()}] Starting scheduled soft delete monitoring\`);
    await scheduledMonitoring();
    console.log(\`[\${new Date().toISOString()}] Scheduled monitoring completed successfully\`);
    process.exit(0);
  } catch (error) {
    console.error(\`[\${new Date().toISOString()}] Scheduled monitoring failed:\`, error);
    process.exit(1);
  }
}

main();
`;

  // Retention compliance job script
  const complianceScript = `#!/usr/bin/env ts-node

/**
 * Retention Compliance Check Job
 */

import { HistoricalDataAnalysisService } from '../../src/lib/dataRetentionPolicy';

async function main() {
  try {
    console.log(\`[\${new Date().toISOString()}] Starting retention compliance check\`);
    
    const report = await HistoricalDataAnalysisService.generateComplianceReport();
    
    console.log('Compliance Report:', {
      timestamp: report.timestamp,
      totalUsers: report.analysis.totalUsersEverCreated,
      activeUsers: report.analysis.currentActiveUsers,
      softDeletedUsers: report.analysis.currentSoftDeletedUsers,
      retentionCompliance: report.analysis.retentionCompliance,
      recommendations: report.recommendations,
    });
    
    // Log critical compliance issues
    if (report.analysis.retentionCompliance.percentageCompliant < 80) {
      console.error('CRITICAL: Retention compliance below 80%!', {
        compliant: report.analysis.retentionCompliance.compliant,
        nonCompliant: report.analysis.retentionCompliance.nonCompliant,
        percentage: report.analysis.retentionCompliance.percentageCompliant,
      });
    }
    
    console.log(\`[\${new Date().toISOString()}] Retention compliance check completed\`);
    process.exit(0);
  } catch (error) {
    console.error(\`[\${new Date().toISOString()}] Retention compliance check failed:\`, error);
    process.exit(1);
  }
}

main();
`;

  // Daily metrics job script
  const metricsScript = `#!/usr/bin/env ts-node

/**
 * Daily Metrics Collection Job
 */

import { SoftDeleteMonitoringService } from '../../src/lib/monitoring/softDeleteMonitoring';

async function main() {
  try {
    console.log(\`[\${new Date().toISOString()}] Starting daily metrics collection\`);
    
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    const metrics = await SoftDeleteMonitoringService.collectMetrics(startTime, endTime);
    
    console.log('Daily Metrics:', {
      period: metrics.period,
      totalSoftDeletes: metrics.totalSoftDeletes,
      totalRestores: metrics.totalRestores,
      totalPermanentDeletes: metrics.totalPermanentDeletes,
      averageDeletionsPerDay: metrics.averageDeletionsPerDay,
      retentionCompliance: metrics.retentionCompliance,
    });
    
    // Check for alerts
    const alerts = await SoftDeleteMonitoringService.checkForAlerts(metrics);
    if (alerts.length > 0) {
      console.warn(\`Generated \${alerts.length} alerts:\`, alerts.map(alert => ({
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
      })));
    }
    
    console.log(\`[\${new Date().toISOString()}] Daily metrics collection completed\`);
    process.exit(0);
  } catch (error) {
    console.error(\`[\${new Date().toISOString()}] Daily metrics collection failed:\`, error);
    process.exit(1);
  }
}

main();
`;

  // Write job scripts
  fs.writeFileSync(path.join(jobsDir, 'cleanup-soft-deleted.ts'), cleanupScript);
  fs.writeFileSync(path.join(jobsDir, 'monitor-soft-delete.ts'), monitoringScript);
  fs.writeFileSync(path.join(jobsDir, 'retention-compliance.ts'), complianceScript);
  fs.writeFileSync(path.join(jobsDir, 'daily-metrics.ts'), metricsScript);
  
  // Make scripts executable
  await execAsync(`chmod +x ${path.join(jobsDir, '*.ts')}`).catch(() => {
    // Ignore errors on non-Unix systems
  });
  
  console.log('✅ Job scripts created');
}

/**
 * Generate crontab entries
 */
function generateCrontabEntries(): string {
  console.log('⏰ Generating crontab entries...');
  
  const projectPath = process.cwd();
  const entries = SOFT_DELETE_JOBS
    .filter(job => job.enabled)
    .map(job => {
      const command = job.command.replace('/path/to/your/project', projectPath);
      return `# ${job.description}
${job.schedule} ${command} >> /var/log/${job.name}.log 2>&1`;
    })
    .join('\n\n');
  
  const crontabContent = `# Soft Delete Scheduled Jobs
# Generated on ${new Date().toISOString()}
# Project: ${projectPath}

${entries}

`;
  
  return crontabContent;
}

/**
 * Create environment configuration template
 */
function createEnvironmentTemplate(): void {
  console.log('🔧 Creating environment configuration template...');
  
  const envTemplate = `# Soft Delete Job Configuration
# Add these to your .env file

# Cleanup Job Settings
CLEANUP_DRY_RUN=false
CLEANUP_RETENTION_DAYS=90
CLEANUP_MAX_DAILY=1000
CLEANUP_BATCH_SIZE=50

# Monitoring Settings
MONITORING_ENABLED=true
MONITORING_ALERT_WEBHOOK_URL=your_webhook_url_here
MONITORING_SLACK_CHANNEL=#alerts

# Logging
SOFT_DELETE_LOG_LEVEL=info
SOFT_DELETE_LOG_FILE=/var/log/soft-delete.log

# Database Connection (if different from main app)
# CLEANUP_DATABASE_URL=your_database_url_here
`;
  
  const envPath = path.join(process.cwd(), '.env.soft-delete.template');
  fs.writeFileSync(envPath, envTemplate);
  
  console.log('✅ Environment template created at .env.soft-delete.template');
}

/**
 * Create monitoring dashboard script
 */
function createMonitoringDashboard(): void {
  console.log('📊 Creating monitoring dashboard script...');
  
  const dashboardScript = `#!/usr/bin/env ts-node

/**
 * Soft Delete Monitoring Dashboard
 * Run this script to get a quick overview of soft delete system status
 */

import { SoftDeleteMonitoringService } from '../src/lib/monitoring/softDeleteMonitoring';
import { HistoricalDataAnalysisService } from '../src/lib/dataRetentionPolicy';
import { getSoftDeleteMetrics } from '../src/jobs/cleanupSoftDeleted';

async function main() {
  try {
    console.log('🔍 Soft Delete System Dashboard');
    console.log('='.repeat(50));
    console.log();

    // Get dashboard data
    const dashboardData = await SoftDeleteMonitoringService.getDashboardData();
    
    // System Health
    console.log('🏥 System Health:', dashboardData.systemHealth.status.toUpperCase());
    if (dashboardData.systemHealth.issues.length > 0) {
      console.log('Issues:');
      dashboardData.systemHealth.issues.forEach(issue => {
        console.log(\`  - \${issue}\`);
      });
    }
    console.log();

    // Recent metrics
    console.log('📈 Recent Activity (Last 24 Hours):');
    console.log(\`  Deletions: \${dashboardData.last24Hours.totalSoftDeletes}\`);
    console.log(\`  Restores: \${dashboardData.last24Hours.totalRestores}\`);
    console.log(\`  Permanent Deletions: \${dashboardData.last24Hours.totalPermanentDeletes}\`);
    console.log(\`  Compliance Rate: \${dashboardData.last24Hours.retentionCompliance.percentageCompliant.toFixed(1)}%\`);
    console.log();

    // Weekly trends
    console.log('📊 Weekly Trends (Last 7 Days):');
    console.log(\`  Deletions: \${dashboardData.last7Days.totalSoftDeletes}\`);
    console.log(\`  Restores: \${dashboardData.last7Days.totalRestores}\`);
    console.log(\`  Average per day: \${dashboardData.last7Days.averageDeletionsPerDay.toFixed(1)}\`);
    console.log();

    // Cleanup metrics
    console.log('🧹 Cleanup Status:');
    const cleanupMetrics = await getSoftDeleteMetrics();
    console.log(\`  Users eligible for cleanup: \${cleanupMetrics.totalEligible}\`);
    console.log(\`  Processed today: \${cleanupMetrics.processedToday}\`);
    console.log(\`  Remaining to process: \${cleanupMetrics.remainingToProcess}\`);
    console.log();

    // Recent alerts
    if (dashboardData.recentAlerts.length > 0) {
      console.log('⚠️  Recent Alerts:');
      dashboardData.recentAlerts.slice(0, 5).forEach(alert => {
        const emoji = {
          critical: '🚨',
          high: '⚠️',
          medium: '⚡',
          low: 'ℹ️'
        }[alert.severity] || 'ℹ️';
        console.log(\`  \${emoji} [\${alert.severity.toUpperCase()}] \${alert.title}\`);
      });
      console.log();
    }

    // Compliance summary
    const complianceReport = await HistoricalDataAnalysisService.generateComplianceReport();
    console.log('📋 Compliance Summary:');
    console.log(\`  Total users ever created: \${complianceReport.analysis.totalUsersEverCreated}\`);
    console.log(\`  Currently active: \${complianceReport.analysis.currentActiveUsers}\`);
    console.log(\`  Currently soft-deleted: \${complianceReport.analysis.currentSoftDeletedUsers}\`);
    console.log(\`  Retention compliance: \${complianceReport.analysis.retentionCompliance.percentageCompliant.toFixed(1)}%\`);
    
    if (complianceReport.recommendations.length > 0) {
      console.log();
      console.log('💡 Recommendations:');
      complianceReport.recommendations.forEach(rec => {
        console.log(\`  - \${rec}\`);
      });
    }

    console.log();
    console.log('✅ Dashboard complete');
    
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    process.exit(1);
  }
}

main();
`;
  
  const dashboardPath = path.join(process.cwd(), 'scripts', 'soft-delete-dashboard.ts');
  fs.writeFileSync(dashboardPath, dashboardScript);
  
  console.log('✅ Monitoring dashboard created at scripts/soft-delete-dashboard.ts');
}

/**
 * Main setup function
 */
async function main() {
  console.log('🚀 Setting up Soft Delete Scheduled Jobs');
  console.log('='.repeat(50));
  
  try {
    await setupPackageJsonScripts();
    await createJobScripts();
    
    const crontabEntries = generateCrontabEntries();
    
    createEnvironmentTemplate();
    createMonitoringDashboard();
    
    // Save crontab entries to file
    const crontabPath = path.join(process.cwd(), 'soft-delete-crontab.txt');
    fs.writeFileSync(crontabPath, crontabEntries);
    
    console.log();
    console.log('🎉 Setup completed successfully!');
    console.log();
    console.log('Next steps:');
    console.log('1. Review and configure environment variables in .env.soft-delete.template');
    console.log('2. Install the crontab entries:');
    console.log(`   crontab ${crontabPath}`);
    console.log('3. Test the jobs manually:');
    console.log('   npm run job:cleanup-soft-deleted');
    console.log('   npm run job:monitor-soft-delete');
    console.log('4. Monitor the dashboard:');
    console.log('   ts-node scripts/soft-delete-dashboard.ts');
    console.log();
    console.log('📊 Crontab entries saved to:', crontabPath);
    console.log('🔧 Environment template saved to: .env.soft-delete.template');
    console.log('📈 Dashboard script created at: scripts/soft-delete-dashboard.ts');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  main();
}

export { SOFT_DELETE_JOBS, setupPackageJsonScripts, createJobScripts };
