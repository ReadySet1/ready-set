import { prisma } from "@/utils/prismaDB";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  AuditAction,
  AuditLogEntry,
  AuditLogQueryParams,
  AuditPagination,
  CreateAuditEntryParams,
} from "@/types/audit";

/**
 * Result type for paginated audit logs
 */
export interface PaginatedAuditLogs {
  logs: AuditLogEntry[];
  pagination: AuditPagination;
  filters: {
    availableActions: AuditAction[];
  };
}

/**
 * CSV row representation for export
 */
interface AuditCSVRow {
  timestamp: string;
  action: string;
  performedByName: string;
  performedByEmail: string;
  fieldChanged: string;
  beforeValue: string;
  afterValue: string;
  reason: string;
}

/**
 * Service class for handling user audit log operations
 */
export class UserAuditService {
  private prisma = prisma;

  /**
   * Get audit logs for a specific user with filtering and pagination
   */
  async getAuditLogs(params: AuditLogQueryParams): Promise<PaginatedAuditLogs> {
    const {
      userId,
      page = 1,
      limit = 20,
      actions,
      startDate,
      endDate,
      performedBy,
    } = params;

    try {
      // Build where clause
      const where: Prisma.UserAuditWhereInput = {
        userId,
      };

      // Filter by actions
      if (actions && actions.length > 0) {
        where.action = { in: actions };
      }

      // Filter by date range
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      // Filter by performer
      if (performedBy) {
        where.performedBy = performedBy;
      }

      // Execute query with pagination
      const [auditLogs, totalCount] = await Promise.all([
        this.prisma.userAudit.findMany({
          where,
          include: {
            performer: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.userAudit.count({ where }),
      ]);

      // Get unique actions for filter options
      const uniqueActions = await this.prisma.userAudit.findMany({
        where: { userId },
        select: { action: true },
        distinct: ["action"],
      });

      const totalPages = Math.ceil(totalCount / limit);

      // Transform to API response format
      const logs: AuditLogEntry[] = auditLogs.map((log) => ({
        id: log.id,
        userId: log.userId,
        action: log.action as AuditAction,
        performedBy: log.performedBy,
        performerName: log.performer?.name || null,
        performerEmail: log.performer?.email || null,
        performerImage: log.performer?.image || null,
        changes: log.changes as AuditLogEntry["changes"],
        reason: log.reason,
        metadata: log.metadata as Record<string, unknown> | null,
        createdAt: log.createdAt.toISOString(),
      }));

      return {
        logs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        filters: {
          availableActions: uniqueActions.map(
            (a) => a.action as AuditAction
          ),
        },
      };
    } catch (error) {
      console.error("Error in getAuditLogs:", error);
      throw error;
    }
  }

  /**
   * Export audit logs to CSV format
   */
  async exportAuditLogsCSV(
    params: Omit<AuditLogQueryParams, "page" | "limit">
  ): Promise<string> {
    const { userId, actions, startDate, endDate, performedBy } = params;

    try {
      // Build where clause
      const where: Prisma.UserAuditWhereInput = {
        userId,
      };

      if (actions && actions.length > 0) {
        where.action = { in: actions };
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      if (performedBy) {
        where.performedBy = performedBy;
      }

      // Fetch all matching logs (no pagination for export)
      const auditLogs = await this.prisma.userAudit.findMany({
        where,
        include: {
          performer: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Convert to CSV rows
      const rows: AuditCSVRow[] = [];

      for (const log of auditLogs) {
        const changes = log.changes as {
          before?: Record<string, unknown>;
          after?: Record<string, unknown>;
        } | null;

        if (changes?.before || changes?.after) {
          // Get all changed fields
          const allFields = new Set([
            ...Object.keys(changes.before || {}),
            ...Object.keys(changes.after || {}),
          ]);

          for (const field of allFields) {
            const beforeVal = changes.before?.[field];
            const afterVal = changes.after?.[field];

            // Skip if values are the same
            if (JSON.stringify(beforeVal) === JSON.stringify(afterVal)) {
              continue;
            }

            rows.push({
              timestamp: log.createdAt.toISOString(),
              action: log.action,
              performedByName: log.performer?.name || "System",
              performedByEmail: log.performer?.email || "",
              fieldChanged: field,
              beforeValue: this.formatValueForCSV(beforeVal),
              afterValue: this.formatValueForCSV(afterVal),
              reason: log.reason || "",
            });
          }
        } else {
          // No specific field changes, just log the action
          rows.push({
            timestamp: log.createdAt.toISOString(),
            action: log.action,
            performedByName: log.performer?.name || "System",
            performedByEmail: log.performer?.email || "",
            fieldChanged: "-",
            beforeValue: "-",
            afterValue: "-",
            reason: log.reason || "",
          });
        }
      }

      // Generate CSV string
      return this.generateCSV(rows);
    } catch (error) {
      console.error("Error in exportAuditLogsCSV:", error);
      throw error;
    }
  }

  /**
   * Create a new audit entry
   * This is designed to be used within a Prisma transaction
   */
  async createAuditEntry(
    tx: Prisma.TransactionClient | PrismaClient,
    params: CreateAuditEntryParams
  ): Promise<void> {
    const { userId, action, performedBy, before, after, reason, metadata } =
      params;

    // Build changes object for Prisma (handle null values properly)
    const changesData =
      before || after
        ? ({
            before: before ?? null,
            after: after ?? null,
          } as Prisma.InputJsonValue)
        : Prisma.JsonNull;

    const metadataData = metadata
      ? (metadata as Prisma.InputJsonValue)
      : Prisma.JsonNull;

    await tx.userAudit.create({
      data: {
        userId,
        action,
        performedBy,
        changes: changesData,
        reason: reason ?? null,
        metadata: metadataData,
      },
    });
  }

  /**
   * Helper to create audit entry without transaction (for simple cases)
   */
  async logAuditEntry(params: CreateAuditEntryParams): Promise<void> {
    await this.createAuditEntry(this.prisma, params);
  }

  /**
   * Get audit summary stats for a user
   */
  async getAuditSummary(userId: string) {
    try {
      const [totalEntries, actionCounts, recentActivity] = await Promise.all([
        this.prisma.userAudit.count({ where: { userId } }),
        this.prisma.userAudit.groupBy({
          by: ["action"],
          where: { userId },
          _count: { action: true },
        }),
        this.prisma.userAudit.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, action: true },
        }),
      ]);

      return {
        totalEntries,
        actionCounts: actionCounts.reduce(
          (acc, item) => {
            acc[item.action as AuditAction] = item._count.action;
            return acc;
          },
          {} as Record<AuditAction, number>
        ),
        lastActivity: recentActivity?.createdAt || null,
        lastAction: recentActivity?.action || null,
      };
    } catch (error) {
      console.error("Error in getAuditSummary:", error);
      throw error;
    }
  }

  /**
   * Format a value for CSV export
   */
  private formatValueForCSV(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Generate CSV string from rows
   */
  private generateCSV(rows: AuditCSVRow[]): string {
    const headers = [
      "Timestamp",
      "Action",
      "Performed By",
      "Email",
      "Field Changed",
      "Before Value",
      "After Value",
      "Reason",
    ];

    const csvRows = [
      headers.join(","),
      ...rows.map((row) =>
        [
          this.escapeCSV(row.timestamp),
          this.escapeCSV(row.action),
          this.escapeCSV(row.performedByName),
          this.escapeCSV(row.performedByEmail),
          this.escapeCSV(row.fieldChanged),
          this.escapeCSV(row.beforeValue),
          this.escapeCSV(row.afterValue),
          this.escapeCSV(row.reason),
        ].join(",")
      ),
    ];

    return csvRows.join("\n");
  }

  /**
   * Escape a value for CSV (handle quotes and commas)
   */
  private escapeCSV(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Compare two objects and return the changed fields
   * Useful for detecting what changed between before/after states
   */
  static getChangedFields(
    before: Record<string, unknown>,
    after: Record<string, unknown>
  ): {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  } {
    const changedBefore: Record<string, unknown> = {};
    const changedAfter: Record<string, unknown> = {};

    // Check all keys from both objects
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      const beforeVal = before[key];
      const afterVal = after[key];

      // Compare stringified values to handle objects/arrays
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changedBefore[key] = beforeVal;
        changedAfter[key] = afterVal;
      }
    }

    return {
      before: changedBefore,
      after: changedAfter,
    };
  }

  /**
   * Fields that should never be logged in audit (sensitive data)
   */
  static readonly EXCLUDED_FIELDS = new Set([
    "password",
    "passwordHash",
    "refreshToken",
    "accessToken",
    "apiKey",
    "secretKey",
  ]);

  /**
   * Sanitize an object by removing sensitive fields
   */
  static sanitizeForAudit(
    obj: Record<string, unknown>
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (!this.EXCLUDED_FIELDS.has(key)) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

// Export singleton instance
export const userAuditService = new UserAuditService();
