/**
 * Scheduled Job for Soft Deleted Users Cleanup
 * 
 * This job handles:
 * - GDPR compliance by permanently deleting users after retention period
 * - Archiving old soft-deleted records
 * - Data retention policy enforcement
 * - Cleanup metrics and reporting
 */

import { prisma } from '@/utils/prismaDB';
import { userSoftDeleteService } from '@/services/userSoftDeleteService';
import { loggers } from '@/utils/logger';
import { UserType } from '@/types/prisma';

// Configuration constants
const DEFAULT_RETENTION_DAYS = 90; // GDPR compliance: 90 days default retention
const BATCH_SIZE = 50; // Process records in batches to avoid memory issues
const MAX_DAILY_DELETIONS = 1000; // Safety limit for permanent deletions per day

interface CleanupConfig {
  retentionDays?: number;
  batchSize?: number;
  maxDailyDeletions?: number;
  dryRun?: boolean;
  includeUserTypes?: UserType[];
  excludeUserTypes?: UserType[];
}

interface CleanupResult {
  success: boolean;
  processed: number;
  permanentlyDeleted: number;
  archived: number;
  errors: string[];
  duration: number;
  timestamp: string;
}

interface CleanupMetrics {
  totalEligible: number;
  processedToday: number;
  remainingToProcess: number;
  oldestDeletionDate: Date | null;
  newestDeletionDate: Date | null;
}

/**
 * Main cleanup service class
 */
export class SoftDeleteCleanupService {
  private config: Required<CleanupConfig>;

  constructor(config: CleanupConfig = {}) {
    this.config = {
      retentionDays: config.retentionDays ?? DEFAULT_RETENTION_DAYS,
      batchSize: config.batchSize ?? BATCH_SIZE,
      maxDailyDeletions: config.maxDailyDeletions ?? MAX_DAILY_DELETIONS,
      dryRun: config.dryRun ?? false,
      includeUserTypes: config.includeUserTypes ?? [],
      excludeUserTypes: config.excludeUserTypes ?? [UserType.SUPER_ADMIN], // Never auto-delete super admins
    };
  }

  /**
   * Get metrics about users eligible for cleanup
   */
  async getCleanupMetrics(): Promise<CleanupMetrics> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    try {
      // Build the where clause for eligible users
      const whereClause: any = {
        deletedAt: {
          not: null,
          lte: cutoffDate,
        },
      };

      // Apply user type filters
      if (this.config.includeUserTypes.length > 0) {
        whereClause.type = { in: this.config.includeUserTypes };
      }
      if (this.config.excludeUserTypes.length > 0) {
        whereClause.type = { notIn: this.config.excludeUserTypes };
      }

      const [totalEligible, oldestRecord, newestRecord] = await Promise.all([
        prisma.profile.count({ where: whereClause }),
        prisma.profile.findFirst({
          where: whereClause,
          orderBy: { deletedAt: 'asc' },
          select: { deletedAt: true },
        }),
        prisma.profile.findFirst({
          where: whereClause,
          orderBy: { deletedAt: 'desc' },
          select: { deletedAt: true },
        }),
      ]);

      // Get today's processed count (from audit logs)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const processedToday = await prisma.userAudit.count({
        where: {
          action: 'PERMANENT_DELETE',
          performedBy: { not: null },
          createdAt: { gte: todayStart },
          metadata: {
            path: ['operation'],
            equals: 'automated_cleanup',
          },
        },
      });

      return {
        totalEligible,
        processedToday,
        remainingToProcess: Math.max(0, totalEligible - processedToday),
        oldestDeletionDate: oldestRecord?.deletedAt || null,
        newestDeletionDate: newestRecord?.deletedAt || null,
      };
    } catch (error) {
      loggers.prisma.error('Failed to get cleanup metrics', { error });
      throw error;
    }
  }

  /**
   * Run the cleanup process
   */
  async runCleanup(): Promise<CleanupResult> {
    const startTime = Date.now();
    const result: CleanupResult = {
      success: false,
      processed: 0,
      permanentlyDeleted: 0,
      archived: 0,
      errors: [],
      duration: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      loggers.prisma.info('Starting soft delete cleanup job', {
        config: this.config,
        dryRun: this.config.dryRun,
      });

      // Get metrics first
      const metrics = await this.getCleanupMetrics();
      
      // Safety check: don't process more than daily limit
      if (metrics.processedToday >= this.config.maxDailyDeletions) {
        loggers.prisma.warn('Daily deletion limit reached, skipping cleanup', {
          processedToday: metrics.processedToday,
          maxDaily: this.config.maxDailyDeletions,
        });
        result.success = true;
        return result;
      }

      // Calculate how many we can process today
      const remainingQuota = this.config.maxDailyDeletions - metrics.processedToday;
      const toProcess = Math.min(remainingQuota, metrics.totalEligible);

      if (toProcess === 0) {
        loggers.prisma.info('No records to process', { metrics });
        result.success = true;
        return result;
      }

      // Process in batches
      let processed = 0;
      while (processed < toProcess) {
        const batchSize = Math.min(this.config.batchSize, toProcess - processed);
        
        try {
          const batchResult = await this.processBatch(batchSize);
          result.processed += batchResult.processed;
          result.permanentlyDeleted += batchResult.permanentlyDeleted;
          result.archived += batchResult.archived;
          result.errors.push(...batchResult.errors);
          
          processed += batchResult.processed;
          
          // Log progress
          loggers.prisma.info('Batch processed', {
            batchSize,
            totalProcessed: processed,
            totalToProcess: toProcess,
            permanentlyDeleted: result.permanentlyDeleted,
          });

          // Small delay between batches to avoid overwhelming the database
          if (processed < toProcess) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Batch processing error: ${errorMessage}`);
          loggers.prisma.error('Batch processing failed', { error, processed });
          break; // Stop processing on batch failure
        }
      }

      result.success = result.errors.length === 0;
      
      loggers.prisma.info('Cleanup job completed', {
        result,
        config: this.config,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Cleanup job failed: ${errorMessage}`);
      loggers.prisma.error('Cleanup job failed', { error, config: this.config });
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Process a batch of users for cleanup
   */
  private async processBatch(batchSize: number): Promise<{
    processed: number;
    permanentlyDeleted: number;
    archived: number;
    errors: string[];
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    // Build the where clause for eligible users
    const whereClause: any = {
      deletedAt: {
        not: null,
        lte: cutoffDate,
      },
    };

    // Apply user type filters
    if (this.config.includeUserTypes.length > 0) {
      whereClause.type = { in: this.config.includeUserTypes };
    }
    if (this.config.excludeUserTypes.length > 0) {
      whereClause.type = { notIn: this.config.excludeUserTypes };
    }

    // Get batch of users to process
    const usersToProcess = await prisma.profile.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        type: true,
        deletedAt: true,
        deletedBy: true,
        deletionReason: true,
      },
      orderBy: { deletedAt: 'asc' }, // Process oldest deletions first
      take: batchSize,
    });

    const batchResult = {
      processed: 0,
      permanentlyDeleted: 0,
      archived: 0,
      errors: [] as string[],
    };

    for (const user of usersToProcess) {
      try {
        if (this.config.dryRun) {
          // In dry run mode, just log what would be done
          loggers.prisma.info('DRY RUN: Would permanently delete user', {
            userId: user.id,
            email: user.email,
            type: user.type,
            deletedAt: user.deletedAt,
            retentionDays: this.config.retentionDays,
          });
          batchResult.archived++;
        } else {
          // Permanently delete the user
          const deleteReason = `Automated cleanup: retention period of ${this.config.retentionDays} days exceeded. Original deletion reason: ${user.deletionReason || 'Not specified'}`;
          
          await userSoftDeleteService.permanentlyDeleteUser(user.id);
          
          // Log the automated deletion with special metadata for tracking
          await prisma.userAudit.create({
            data: {
              userId: user.id,
              action: 'PERMANENT_DELETE',
              performedBy: 'system', // System-performed action
              changes: {
                before: {
                  deletedAt: user.deletedAt,
                  deletedBy: user.deletedBy,
                  deletionReason: user.deletionReason,
                },
                after: {
                  permanentlyDeleted: true,
                },
              },
              reason: deleteReason,
              metadata: {
                operation: 'automated_cleanup',
                retentionDays: this.config.retentionDays,
                originalDeletionDate: user.deletedAt,
                cleanupTimestamp: new Date().toISOString(),
              },
            },
          });

          batchResult.permanentlyDeleted++;
          
          loggers.prisma.info('User permanently deleted by cleanup job', {
            userId: user.id,
            email: user.email,
            type: user.type,
            originalDeletionDate: user.deletedAt,
            retentionDays: this.config.retentionDays,
          });
        }

        batchResult.processed++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        batchResult.errors.push(`Failed to process user ${user.id}: ${errorMessage}`);
        loggers.prisma.error('Failed to process user in cleanup batch', {
          userId: user.id,
          email: user.email,
          error,
        });
      }
    }

    return batchResult;
  }

  /**
   * Generate cleanup report
   */
  async generateCleanupReport(): Promise<{
    metrics: CleanupMetrics;
    recentCleanups: any[];
    recommendations: string[];
  }> {
    const metrics = await this.getCleanupMetrics();
    
    // Get recent cleanup activities from audit logs
    const recentCleanups = await prisma.userAudit.findMany({
      where: {
        action: 'PERMANENT_DELETE',
        metadata: {
          path: ['operation'],
          equals: 'automated_cleanup',
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        userId: true,
        performedBy: true,
        createdAt: true,
        reason: true,
        metadata: true,
      },
    });

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (metrics.totalEligible > 500) {
      recommendations.push('High number of users eligible for cleanup. Consider increasing batch size or frequency.');
    }
    
    if (metrics.processedToday >= this.config.maxDailyDeletions * 0.8) {
      recommendations.push('Approaching daily deletion limit. Consider increasing the limit if needed.');
    }
    
    if (metrics.oldestDeletionDate) {
      const daysSinceOldest = Math.floor(
        (Date.now() - metrics.oldestDeletionDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceOldest > this.config.retentionDays + 30) {
        recommendations.push(`Oldest deletion is ${daysSinceOldest} days old, significantly past retention period.`);
      }
    }

    return {
      metrics,
      recentCleanups,
      recommendations,
    };
  }
}

/**
 * Convenience function to run cleanup with default configuration
 */
export async function runSoftDeleteCleanup(config?: CleanupConfig): Promise<CleanupResult> {
  const cleanupService = new SoftDeleteCleanupService(config);
  return await cleanupService.runCleanup();
}

/**
 * Convenience function to get cleanup metrics
 */
export async function getSoftDeleteMetrics(config?: CleanupConfig): Promise<CleanupMetrics> {
  const cleanupService = new SoftDeleteCleanupService(config);
  return await cleanupService.getCleanupMetrics();
}

/**
 * Function to be called by cron job or scheduler
 */
export async function scheduledCleanup(): Promise<void> {
  try {
    loggers.prisma.info('Starting scheduled soft delete cleanup');
    
    const result = await runSoftDeleteCleanup({
      dryRun: process.env.CLEANUP_DRY_RUN === 'true',
      retentionDays: parseInt(process.env.CLEANUP_RETENTION_DAYS || '90'),
      maxDailyDeletions: parseInt(process.env.CLEANUP_MAX_DAILY || '1000'),
    });
    
    if (result.success) {
      loggers.prisma.info('Scheduled cleanup completed successfully', result);
    } else {
      loggers.prisma.error('Scheduled cleanup completed with errors', result);
    }
    
    // Send alert if there were errors
    if (result.errors.length > 0) {
      // TODO: Integrate with your alerting system here
      console.error('Cleanup errors that need attention:', result.errors);
    }
    
  } catch (error) {
    loggers.prisma.error('Scheduled cleanup failed', { error });
    // TODO: Send critical alert for cleanup failure
    throw error;
  }
}
