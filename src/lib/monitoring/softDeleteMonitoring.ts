/**
 * Soft Delete Monitoring & Alerting System
 * 
 * Monitors soft delete operations and sends alerts for unusual patterns
 */

import { prisma } from '@/utils/prismaDB';
import { loggers } from '@/utils/logger';
import { UserType } from '@/types/prisma';

export interface SoftDeleteMetrics {
  period: string;
  startTime: Date;
  endTime: Date;
  totalSoftDeletes: number;
  totalRestores: number;
  totalPermanentDeletes: number;
  deletionsByType: Record<UserType, number>;
  deletionsByUser: Array<{
    userId: string;
    userEmail: string;
    count: number;
  }>;
  averageDeletionsPerDay: number;
  averageRestorationTime: number; // in hours
  retentionCompliance: {
    compliant: number;
    overdue: number;
    percentageCompliant: number;
  };
}

export interface AlertTrigger {
  id: string;
  name: string;
  description: string;
  condition: (metrics: SoftDeleteMetrics) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export interface Alert {
  id: string;
  triggerId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data: any;
  timestamp: Date;
  acknowledged: boolean;
}

/**
 * Soft Delete Monitoring Service
 */
export class SoftDeleteMonitoringService {
  
  /**
   * Collect metrics for a specific time period
   */
  static async collectMetrics(
    startTime: Date,
    endTime: Date
  ): Promise<SoftDeleteMetrics> {
    try {
      // Get soft delete counts by action type
      const [softDeletes, restores, permanentDeletes] = await Promise.all([
        prisma.userAudit.count({
          where: {
            action: 'SOFT_DELETE',
            createdAt: { gte: startTime, lte: endTime },
          },
        }),
        prisma.userAudit.count({
          where: {
            action: 'RESTORE',
            createdAt: { gte: startTime, lte: endTime },
          },
        }),
        prisma.userAudit.count({
          where: {
            action: 'PERMANENT_DELETE',
            createdAt: { gte: startTime, lte: endTime },
          },
        }),
      ]);

      // Get deletions by user type
      const deletionsByTypeRaw = await prisma.$queryRaw<Array<{ type: UserType; count: bigint }>>`
        SELECT p.type, COUNT(*) as count
        FROM "UserAudit" ua
        JOIN "Profile" p ON ua."userId" = p.id
        WHERE ua.action = 'SOFT_DELETE'
          AND ua."performedAt" >= ${startTime}
          AND ua."performedAt" <= ${endTime}
        GROUP BY p.type
      `;

      const deletionsByType: Record<UserType, number> = {} as Record<UserType, number>;
      Object.values(UserType).forEach(type => {
        deletionsByType[type] = 0;
      });
      
      deletionsByTypeRaw.forEach(row => {
        deletionsByType[row.type] = Number(row.count);
      });

      // Get deletions by user (who performed the deletion)
      const deletionsByUserRaw = await prisma.$queryRaw<Array<{
        performedBy: string;
        userEmail: string;
        count: bigint;
      }>>`
        SELECT 
          ua."performedBy",
          p.email as "userEmail",
          COUNT(*) as count
        FROM "UserAudit" ua
        LEFT JOIN "Profile" p ON ua."performedBy" = p.id
        WHERE ua.action = 'SOFT_DELETE'
          AND ua."performedAt" >= ${startTime}
          AND ua."performedAt" <= ${endTime}
        GROUP BY ua."performedBy", p.email
        ORDER BY count DESC
        LIMIT 10
      `;

      const deletionsByUser = deletionsByUserRaw.map(row => ({
        userId: row.performedBy,
        userEmail: row.userEmail || 'Unknown',
        count: Number(row.count),
      }));

      // Calculate average deletions per day
      const periodDays = Math.max(1, (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24));
      const averageDeletionsPerDay = softDeletes / periodDays;

      // Calculate average restoration time
      const restoreTimesRaw = await prisma.$queryRaw<Array<{
        hoursToRestore: number;
      }>>`
        SELECT 
          EXTRACT(EPOCH FROM (restore_audit."performedAt" - delete_audit."performedAt")) / 3600 as "hoursToRestore"
        FROM "UserAudit" delete_audit
        JOIN "UserAudit" restore_audit ON delete_audit."userId" = restore_audit."userId"
        WHERE delete_audit.action = 'SOFT_DELETE'
          AND restore_audit.action = 'RESTORE'
          AND restore_audit."performedAt" > delete_audit."performedAt"
          AND restore_audit."performedAt" >= ${startTime}
          AND restore_audit."performedAt" <= ${endTime}
      `;

      const averageRestorationTime = restoreTimesRaw.length > 0
        ? restoreTimesRaw.reduce((sum, row) => sum + row.hoursToRestore, 0) / restoreTimesRaw.length
        : 0;

      // Calculate retention compliance
      const allSoftDeletedUsers = await prisma.profile.findMany({
        where: { deletedAt: { not: null } },
        select: { type: true, deletedAt: true },
      });

      let compliant = 0;
      let overdue = 0;

      allSoftDeletedUsers.forEach(user => {
        if (!user.deletedAt) return;
        
        const retentionDays = this.getRetentionDaysForUserType(user.type);
        if (retentionDays === 0) return; // Manual deletion only
        
        const daysSinceDeletion = Math.floor(
          (Date.now() - user.deletedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysSinceDeletion <= retentionDays) {
          compliant++;
        } else {
          overdue++;
        }
      });

      const totalCompliance = compliant + overdue;
      const percentageCompliant = totalCompliance > 0 ? (compliant / totalCompliance) * 100 : 100;

      const metrics: SoftDeleteMetrics = {
        period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
        startTime,
        endTime,
        totalSoftDeletes: softDeletes,
        totalRestores: restores,
        totalPermanentDeletes: permanentDeletes,
        deletionsByType,
        deletionsByUser,
        averageDeletionsPerDay,
        averageRestorationTime,
        retentionCompliance: {
          compliant,
          overdue,
          percentageCompliant,
        },
      };

      loggers.prisma.info('Soft delete metrics collected', {
        period: metrics.period,
        totalSoftDeletes: softDeletes,
        totalRestores: restores,
        averageDeletionsPerDay,
        compliancePercentage: percentageCompliant,
      });

      return metrics;

    } catch (error) {
      loggers.prisma.error('Failed to collect soft delete metrics', { error });
      throw error;
    }
  }

  /**
   * Get retention days for a user type
   */
  private static getRetentionDaysForUserType(userType: UserType): number {
    const retentionMap: Record<UserType, number> = {
      [UserType.CLIENT]: 90,
      [UserType.VENDOR]: 90,
      [UserType.DRIVER]: 90,
      [UserType.ADMIN]: 365,
      [UserType.HELPDESK]: 365,
      [UserType.SUPER_ADMIN]: 0, // Manual only
    };
    return retentionMap[userType] || 90;
  }

  /**
   * Define alert triggers
   */
  static getAlertTriggers(): AlertTrigger[] {
    return [
      {
        id: 'high_deletion_volume',
        name: 'High Deletion Volume',
        description: 'More than 50 deletions per day on average',
        condition: (metrics) => metrics.averageDeletionsPerDay > 50,
        severity: 'medium',
        enabled: true,
      },
      {
        id: 'excessive_deletion_volume',
        name: 'Excessive Deletion Volume',
        description: 'More than 100 deletions per day on average',
        condition: (metrics) => metrics.averageDeletionsPerDay > 100,
        severity: 'high',
        enabled: true,
      },
      {
        id: 'single_user_mass_deletion',
        name: 'Single User Mass Deletion',
        description: 'One user performed more than 20 deletions',
        condition: (metrics) => metrics.deletionsByUser.some(user => user.count > 20),
        severity: 'high',
        enabled: true,
      },
      {
        id: 'low_restoration_rate',
        name: 'Low Restoration Rate',
        description: 'Very low restoration rate (< 5% of deletions)',
        condition: (metrics) => {
          if (metrics.totalSoftDeletes === 0) return false;
          return (metrics.totalRestores / metrics.totalSoftDeletes) < 0.05;
        },
        severity: 'low',
        enabled: true,
      },
      {
        id: 'poor_retention_compliance',
        name: 'Poor Retention Compliance',
        description: 'Retention compliance below 80%',
        condition: (metrics) => metrics.retentionCompliance.percentageCompliant < 80,
        severity: 'medium',
        enabled: true,
      },
      {
        id: 'critical_retention_compliance',
        name: 'Critical Retention Compliance',
        description: 'Retention compliance below 50%',
        condition: (metrics) => metrics.retentionCompliance.percentageCompliant < 50,
        severity: 'critical',
        enabled: true,
      },
      {
        id: 'no_permanent_deletions',
        name: 'No Permanent Deletions',
        description: 'No permanent deletions in period but overdue users exist',
        condition: (metrics) => metrics.totalPermanentDeletes === 0 && metrics.retentionCompliance.overdue > 10,
        severity: 'medium',
        enabled: true,
      },
      {
        id: 'rapid_restore_pattern',
        name: 'Rapid Restore Pattern',
        description: 'Users being restored very quickly (< 1 hour average)',
        condition: (metrics) => metrics.averageRestorationTime > 0 && metrics.averageRestorationTime < 1,
        severity: 'low',
        enabled: true,
      },
      {
        id: 'admin_deletion_spike',
        name: 'Admin Deletion Spike',
        description: 'Unusual number of admin/helpdesk deletions',
        condition: (metrics) => (metrics.deletionsByType[UserType.ADMIN] + metrics.deletionsByType[UserType.HELPDESK]) > 5,
        severity: 'high',
        enabled: true,
      },
    ];
  }

  /**
   * Check for alerts based on metrics
   */
  static checkForAlerts(metrics: SoftDeleteMetrics): Alert[] {
    const triggers = this.getAlertTriggers().filter(trigger => trigger.enabled);
    const alerts: Alert[] = [];

    triggers.forEach(trigger => {
      try {
        if (trigger.condition(metrics)) {
          const alert: Alert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            triggerId: trigger.id,
            severity: trigger.severity,
            title: trigger.name,
            message: this.generateAlertMessage(trigger, metrics),
            data: {
              trigger,
              metrics: {
                period: metrics.period,
                totalSoftDeletes: metrics.totalSoftDeletes,
                totalRestores: metrics.totalRestores,
                averageDeletionsPerDay: metrics.averageDeletionsPerDay,
                retentionCompliance: metrics.retentionCompliance,
              },
            },
            timestamp: new Date(),
            acknowledged: false,
          };
          
          alerts.push(alert);
          
          loggers.prisma.warn('Soft delete alert triggered', {
            alertId: alert.id,
            triggerId: trigger.id,
            severity: trigger.severity,
            title: trigger.name,
          });
        }
      } catch (error) {
        loggers.prisma.error('Error checking alert trigger', {
          triggerId: trigger.id,
          error,
        });
      }
    });

    return alerts;
  }

  /**
   * Generate alert message based on trigger and metrics
   */
  private static generateAlertMessage(trigger: AlertTrigger, metrics: SoftDeleteMetrics): string {
    switch (trigger.id) {
      case 'high_deletion_volume':
        return `High deletion volume detected: ${metrics.averageDeletionsPerDay.toFixed(1)} deletions per day (period: ${metrics.period}). Monitor for unusual patterns.`;
      
      case 'excessive_deletion_volume':
        return `Excessive deletion volume detected: ${metrics.averageDeletionsPerDay.toFixed(1)} deletions per day (period: ${metrics.period}). Immediate review recommended.`;
      
      case 'single_user_mass_deletion':
        const topDeleter = metrics.deletionsByUser[0];
        if (!topDeleter) {
          return 'Mass deletion pattern detected but no specific user data available.';
        }
        return `Mass deletion by single user detected: ${topDeleter.userEmail} performed ${topDeleter.count} deletions. Review for potential misuse.`;
      
      case 'low_restoration_rate':
        const restorationRate = ((metrics.totalRestores / metrics.totalSoftDeletes) * 100).toFixed(1);
        return `Low restoration rate detected: ${restorationRate}% of deleted users were restored. May indicate over-aggressive deletion policies.`;
      
      case 'poor_retention_compliance':
        return `Poor retention compliance: ${metrics.retentionCompliance.percentageCompliant.toFixed(1)}% compliant. ${metrics.retentionCompliance.overdue} users overdue for permanent deletion.`;
      
      case 'critical_retention_compliance':
        return `Critical retention compliance issue: ${metrics.retentionCompliance.percentageCompliant.toFixed(1)}% compliant. Immediate cleanup required for GDPR compliance.`;
      
      case 'no_permanent_deletions':
        return `No permanent deletions performed but ${metrics.retentionCompliance.overdue} users are overdue. Cleanup job may not be running.`;
      
      case 'rapid_restore_pattern':
        return `Rapid restore pattern detected: Average restoration time is ${metrics.averageRestorationTime.toFixed(1)} hours. May indicate deletion/restore cycling.`;
      
      case 'admin_deletion_spike':
        const adminDeletions = metrics.deletionsByType[UserType.ADMIN] + metrics.deletionsByType[UserType.HELPDESK];
        return `Unusual admin deletion activity: ${adminDeletions} admin/helpdesk users deleted. Review for security concerns.`;
      
      default:
        return `${trigger.description} (period: ${metrics.period})`;
    }
  }

  /**
   * Run monitoring check and return alerts
   */
  static async runMonitoringCheck(
    startTime?: Date,
    endTime?: Date
  ): Promise<{
    metrics: SoftDeleteMetrics;
    alerts: Alert[];
    timestamp: string;
  }> {
    // Default to last 24 hours if no time range specified
    if (!endTime) endTime = new Date();
    if (!startTime) {
      startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    }

    try {
      loggers.prisma.info('Running soft delete monitoring check', {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      const metrics = await this.collectMetrics(startTime, endTime);
      const alerts = this.checkForAlerts(metrics);

      const result = {
        metrics,
        alerts,
        timestamp: new Date().toISOString(),
      };

      if (alerts.length > 0) {
        loggers.prisma.warn('Soft delete monitoring alerts generated', {
          alertCount: alerts.length,
          severities: alerts.reduce((acc, alert) => {
            acc[alert.severity] = (acc[alert.severity] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        });

        // Here you would integrate with your alerting system
        // await this.sendAlertsToNotificationSystem(alerts);
      } else {
        loggers.prisma.info('No soft delete alerts generated');
      }

      return result;

    } catch (error) {
      loggers.prisma.error('Soft delete monitoring check failed', { error });
      throw error;
    }
  }

  /**
   * Get monitoring dashboard data
   */
  static async getDashboardData(): Promise<{
    last24Hours: SoftDeleteMetrics;
    last7Days: SoftDeleteMetrics;
    last30Days: SoftDeleteMetrics;
    recentAlerts: Alert[];
    systemHealth: {
      status: 'healthy' | 'warning' | 'critical';
      issues: string[];
    };
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      last24Hours,
      last7Days,
      last30Days,
    ] = await Promise.all([
      this.collectMetrics(oneDayAgo, now),
      this.collectMetrics(sevenDaysAgo, now),
      this.collectMetrics(thirtyDaysAgo, now),
    ]);

    // Check for recent alerts across all periods
    const allAlerts = [
      ...this.checkForAlerts(last24Hours),
      ...this.checkForAlerts(last7Days),
      ...this.checkForAlerts(last30Days),
    ];

    // Determine system health
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const issues: string[] = [];

    const criticalAlerts = allAlerts.filter(alert => alert.severity === 'critical');
    const highAlerts = allAlerts.filter(alert => alert.severity === 'high');

    if (criticalAlerts.length > 0) {
      status = 'critical';
      issues.push(`${criticalAlerts.length} critical alerts detected`);
    } else if (highAlerts.length > 0 || last30Days.retentionCompliance.percentageCompliant < 90) {
      status = 'warning';
      if (highAlerts.length > 0) {
        issues.push(`${highAlerts.length} high-severity alerts detected`);
      }
      if (last30Days.retentionCompliance.percentageCompliant < 90) {
        issues.push('Retention compliance below 90%');
      }
    }

    return {
      last24Hours,
      last7Days,
      last30Days,
      recentAlerts: allAlerts.slice(0, 10), // Most recent 10 alerts
      systemHealth: {
        status,
        issues,
      },
    };
  }
}

/**
 * Scheduled monitoring function to be called by cron job
 */
export async function scheduledMonitoring(): Promise<void> {
  try {
    loggers.prisma.info('Starting scheduled soft delete monitoring');
    
    const result = await SoftDeleteMonitoringService.runMonitoringCheck();
    
    if (result.alerts.length > 0) {
      const criticalAlerts = result.alerts.filter(alert => alert.severity === 'critical');
      const highAlerts = result.alerts.filter(alert => alert.severity === 'high');
      
      if (criticalAlerts.length > 0) {
        loggers.prisma.error('Critical soft delete alerts detected', {
          count: criticalAlerts.length,
          alerts: criticalAlerts.map(alert => ({
            id: alert.id,
            title: alert.title,
            message: alert.message,
          })),
        });
        // TODO: Send critical alerts to incident management system
      }
      
      if (highAlerts.length > 0) {
        loggers.prisma.warn('High-severity soft delete alerts detected', {
          count: highAlerts.length,
          alerts: highAlerts.map(alert => ({
            id: alert.id,
            title: alert.title,
          })),
        });
        // TODO: Send high alerts to monitoring system
      }
    }
    
    loggers.prisma.info('Scheduled soft delete monitoring completed', {
      alertsGenerated: result.alerts.length,
      metricsCollected: true,
    });
    
  } catch (error) {
    loggers.prisma.error('Scheduled soft delete monitoring failed', { error });
    // TODO: Send critical alert for monitoring system failure
    throw error;
  }
}
