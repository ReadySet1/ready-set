/**
 * Data Retention Policy Service
 * 
 * Manages data retention policies and compliance for soft deleted users
 */

import { prisma } from '@/utils/prismaDB';
import { UserType } from '@/types/prisma';
import { loggers } from '@/utils/logger';

export interface RetentionPolicy {
  id: string;
  name: string;
  description: string;
  retentionDays: number;
  userTypes: UserType[];
  autoDelete: boolean;
  gdprCompliant: boolean;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface HistoricalDataAnalysis {
  totalUsersEverCreated: number;
  currentActiveUsers: number;
  currentSoftDeletedUsers: number;
  hardDeletedEstimate: number; // Estimated based on gaps in user creation
  dataIntegrityIssues: string[];
  retentionCompliance: {
    compliant: number;
    nonCompliant: number;
    details: Array<{
      userId: string;
      email: string;
      deletedAt: Date;
      daysOverdue: number;
      userType: UserType;
    }>;
  };
}

/**
 * Default retention policies based on user types and GDPR requirements
 */
export const DEFAULT_RETENTION_POLICIES: Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Standard GDPR Compliance',
    description: 'Standard 90-day retention for most user types',
    retentionDays: 90,
    userTypes: [UserType.CLIENT, UserType.VENDOR, UserType.DRIVER],
    autoDelete: true,
    gdprCompliant: true,
    isActive: true,
  },
  {
    name: 'Administrative Extended Retention',
    description: 'Extended 365-day retention for administrative users',
    retentionDays: 365,
    userTypes: [UserType.ADMIN, UserType.HELPDESK],
    autoDelete: false, // Manual review required for admin accounts
    gdprCompliant: true,
    isActive: true,
  },
  {
    name: 'Super Admin Manual Only',
    description: 'Super admins require manual deletion only',
    retentionDays: 0,
    userTypes: [UserType.SUPER_ADMIN],
    autoDelete: false,
    gdprCompliant: true,
    isActive: true,
  },
];

/**
 * Data Retention Policy Service
 */
export class DataRetentionPolicyService {
  
  /**
   * Get the applicable retention policy for a user type
   */
  static getRetentionPolicyForUserType(userType: UserType): RetentionPolicy | null {
    // In a real implementation, this would query a database table
    // For now, return the default policy based on user type
    const defaultPolicy = DEFAULT_RETENTION_POLICIES.find(policy => 
      policy.userTypes.includes(userType)
    );

    if (!defaultPolicy) {
      return null;
    }

    return {
      id: `default-${userType.toLowerCase()}`,
      ...defaultPolicy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Check if a soft-deleted user is compliant with retention policy
   */
  static isRetentionCompliant(deletedAt: Date, userType: UserType): {
    compliant: boolean;
    daysOverdue: number;
    retentionDays: number;
  } {
    const policy = this.getRetentionPolicyForUserType(userType);
    
    if (!policy || policy.retentionDays === 0) {
      return {
        compliant: true,
        daysOverdue: 0,
        retentionDays: policy?.retentionDays || 0,
      };
    }

    const daysSinceDeletion = Math.floor(
      (Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const daysOverdue = Math.max(0, daysSinceDeletion - policy.retentionDays);

    return {
      compliant: daysOverdue === 0,
      daysOverdue,
      retentionDays: policy.retentionDays,
    };
  }

  /**
   * Get all active retention policies
   */
  static getAllRetentionPolicies(): RetentionPolicy[] {
    return DEFAULT_RETENTION_POLICIES
      .filter(policy => policy.isActive)
      .map(policy => ({
        id: `default-${policy.userTypes.join('-').toLowerCase()}`,
        ...policy,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
  }
}

/**
 * Historical Data Analysis Service
 */
export class HistoricalDataAnalysisService {

  /**
   * Analyze historical user data and identify potential issues
   */
  static async analyzeHistoricalData(): Promise<HistoricalDataAnalysis> {
    try {
      loggers.prisma.info('Starting historical data analysis');

      // Get basic user counts
      const [
        totalUsersEverCreated,
        currentActiveUsers,
        currentSoftDeletedUsers,
        allSoftDeletedUsers,
      ] = await Promise.all([
        // Total users ever created (including permanently deleted)
        prisma.profile.count(),
        
        // Current active users
        prisma.profile.count({
          where: { deletedAt: null }
        }),
        
        // Current soft-deleted users
        prisma.profile.count({
          where: { deletedAt: { not: null } }
        }),
        
        // Get all soft-deleted users for compliance analysis
        prisma.profile.findMany({
          where: { deletedAt: { not: null } },
          select: {
            id: true,
            email: true,
            type: true,
            deletedAt: true,
          }
        }),
      ]);

      // Estimate hard-deleted users (this is approximate)
      // In reality, you'd need to track this through audit logs or other means
      const hardDeletedEstimate = Math.max(0, totalUsersEverCreated - currentActiveUsers - currentSoftDeletedUsers);

      // Analyze retention compliance
      const retentionCompliance = {
        compliant: 0,
        nonCompliant: 0,
        details: [] as Array<{
          userId: string;
          email: string;
          deletedAt: Date;
          daysOverdue: number;
          userType: UserType;
        }>,
      };

      for (const user of allSoftDeletedUsers) {
        if (!user.deletedAt) continue;
        
        const compliance = DataRetentionPolicyService.isRetentionCompliant(
          user.deletedAt,
          user.type
        );

        if (compliance.compliant) {
          retentionCompliance.compliant++;
        } else {
          retentionCompliance.nonCompliant++;
          retentionCompliance.details.push({
            userId: user.id,
            email: user.email || 'Unknown',
            deletedAt: user.deletedAt,
            daysOverdue: compliance.daysOverdue,
            userType: user.type,
          });
        }
      }

      // Sort non-compliant users by days overdue (most overdue first)
      retentionCompliance.details.sort((a, b) => b.daysOverdue - a.daysOverdue);

      // Identify data integrity issues
      const dataIntegrityIssues: string[] = [];

      // Check for users with no email
      const usersWithoutEmail = await prisma.profile.count({
        where: { 
          email: ''
        }
      });
      if (usersWithoutEmail > 0) {
        dataIntegrityIssues.push(`${usersWithoutEmail} users have null email addresses`);
      }

      // Check for users with invalid deletion states
      const invalidDeletionStates = await prisma.profile.count({
        where: {
          deletedAt: { not: null },
          deletedBy: null,
        }
      });
      if (invalidDeletionStates > 0) {
        dataIntegrityIssues.push(`${invalidDeletionStates} soft-deleted users missing deletedBy field`);
      }

      // Check for very old soft-deleted users (more than 2 years)
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      const veryOldDeletedUsers = await prisma.profile.count({
        where: {
          deletedAt: {
            not: null,
            lt: twoYearsAgo,
          }
        }
      });
      if (veryOldDeletedUsers > 0) {
        dataIntegrityIssues.push(`${veryOldDeletedUsers} users have been soft-deleted for more than 2 years`);
      }

      // Check for duplicate emails (should not happen with unique constraints)
      const duplicateEmails = await prisma.$queryRaw<Array<{ email: string; count: number }>>`
        SELECT email, COUNT(*) as count
        FROM "Profile"
        WHERE email IS NOT NULL AND "deletedAt" IS NULL
        GROUP BY email
        HAVING COUNT(*) > 1
      `;
      if (duplicateEmails.length > 0) {
        dataIntegrityIssues.push(`${duplicateEmails.length} duplicate email addresses found in active users`);
      }

      const analysis: HistoricalDataAnalysis = {
        totalUsersEverCreated,
        currentActiveUsers,
        currentSoftDeletedUsers,
        hardDeletedEstimate,
        dataIntegrityIssues,
        retentionCompliance,
      };

      loggers.prisma.info('Historical data analysis completed', {
        totalUsers: totalUsersEverCreated,
        activeUsers: currentActiveUsers,
        softDeletedUsers: currentSoftDeletedUsers,
        nonCompliantUsers: retentionCompliance.nonCompliant,
        integrityIssues: dataIntegrityIssues.length,
      });

      return analysis;

    } catch (error) {
      loggers.prisma.error('Historical data analysis failed', { error });
      throw error;
    }
  }

  /**
   * Generate a compliance report
   */
  static async generateComplianceReport(): Promise<{
    analysis: HistoricalDataAnalysis;
    policies: RetentionPolicy[];
    recommendations: string[];
    timestamp: string;
  }> {
    const analysis = await this.analyzeHistoricalData();
    const policies = DataRetentionPolicyService.getAllRetentionPolicies();
    
    const recommendations: string[] = [];
    
    // Generate recommendations based on analysis
    if (analysis.retentionCompliance.nonCompliant > 0) {
      recommendations.push(
        `${analysis.retentionCompliance.nonCompliant} users are overdue for permanent deletion. ` +
        'Consider running the cleanup job or reviewing retention policies.'
      );
    }

    if (analysis.dataIntegrityIssues.length > 0) {
      recommendations.push(
        'Data integrity issues detected. Review and fix these issues to ensure data quality.'
      );
    }

    if (analysis.hardDeletedEstimate > analysis.totalUsersEverCreated * 0.1) {
      recommendations.push(
        'High number of estimated hard-deleted users. Consider implementing better audit tracking.'
      );
    }

    const complianceRate = analysis.retentionCompliance.compliant / 
      (analysis.retentionCompliance.compliant + analysis.retentionCompliance.nonCompliant);
    
    if (complianceRate < 0.95) {
      recommendations.push(
        `Retention compliance rate is ${(complianceRate * 100).toFixed(1)}%. ` +
        'Consider more frequent cleanup jobs or automated processes.'
      );
    }

    return {
      analysis,
      policies,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Utility functions for data retention
 */
export class DataRetentionUtils {
  
  /**
   * Calculate days until a user becomes eligible for permanent deletion
   */
  static getDaysUntilEligibleForDeletion(deletedAt: Date, userType: UserType): number {
    const policy = DataRetentionPolicyService.getRetentionPolicyForUserType(userType);
    
    if (!policy || policy.retentionDays === 0) {
      return -1; // Never eligible for auto-deletion
    }

    const daysSinceDeletion = Math.floor(
      (Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return Math.max(0, policy.retentionDays - daysSinceDeletion);
  }

  /**
   * Get users approaching deletion deadline
   */
  static async getUsersApproachingDeletion(warningDays: number = 7): Promise<Array<{
    id: string;
    email: string;
    type: UserType;
    deletedAt: Date;
    daysUntilDeletion: number;
  }>> {
    const softDeletedUsers = await prisma.profile.findMany({
      where: { deletedAt: { not: null } },
      select: {
        id: true,
        email: true,
        type: true,
        deletedAt: true,
      }
    });

    const approachingDeletion = [];

    for (const user of softDeletedUsers) {
      if (!user.deletedAt) continue;
      
      const daysUntilDeletion = this.getDaysUntilEligibleForDeletion(user.deletedAt, user.type);
      
      if (daysUntilDeletion >= 0 && daysUntilDeletion <= warningDays) {
        approachingDeletion.push({
          id: user.id,
          email: user.email || 'Unknown',
          type: user.type,
          deletedAt: user.deletedAt,
          daysUntilDeletion,
        });
      }
    }

    return approachingDeletion.sort((a, b) => a.daysUntilDeletion - b.daysUntilDeletion);
  }
}
