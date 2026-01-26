import { prisma } from "@/utils/prismaDB";
import { UserStatus, UserType } from "@/types/prisma";
import { Prisma } from "@prisma/client";
import { AuditAction } from "@/types/audit";
import { UserAuditService } from "./userAuditService";
import type {
  BulkOperationResult,
  BulkStatusChangeRequest,
  BulkDeleteRequest,
  BulkRestoreRequest,
  BulkExportParams,
} from "@/types/bulk-operations";

/**
 * Service class for handling bulk user operations
 */
export class UserBulkOperationsService {
  private prisma = prisma;
  private auditService = new UserAuditService();

  /**
   * Check if a user can be modified by bulk operations
   * Returns null if allowed, error message if not
   */
  private async canModifyUser(userId: string): Promise<string | null> {
    const user = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, type: true, deletedAt: true },
    });

    if (!user) {
      return "User not found";
    }

    if (user.type === UserType.SUPER_ADMIN) {
      return "Cannot modify Super Admin users";
    }

    return null;
  }

  /**
   * Bulk change status for multiple users
   */
  async bulkStatusChange(
    request: BulkStatusChangeRequest,
    performedBy: string
  ): Promise<BulkOperationResult> {
    const { userIds, status, reason } = request;

    const results: BulkOperationResult = {
      success: [],
      failed: [],
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };

    for (const userId of userIds) {
      try {
        // Check if user can be modified
        const error = await this.canModifyUser(userId);
        if (error) {
          results.failed.push({ id: userId, reason: error });
          continue;
        }

        // Get current state for audit
        const currentUser = await this.prisma.profile.findUnique({
          where: { id: userId },
          select: { status: true },
        });

        if (!currentUser) {
          results.failed.push({ id: userId, reason: "User not found" });
          continue;
        }

        // Skip if status is already the same
        if (currentUser.status === status) {
          results.failed.push({ id: userId, reason: "Status unchanged" });
          continue;
        }

        // Use transaction for update + audit
        await this.prisma.$transaction(async (tx) => {
          await tx.profile.update({
            where: { id: userId },
            data: { status },
          });

          await this.auditService.createAuditEntry(tx, {
            userId,
            action: AuditAction.STATUS_CHANGE,
            performedBy,
            before: { status: currentUser.status },
            after: { status },
            reason: reason || `Bulk status change to ${status}`,
            metadata: { bulkOperation: true },
          });
        });

        results.success.push(userId);
      } catch (error) {
        results.failed.push({
          id: userId,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    results.totalProcessed = userIds.length;
    results.totalSuccess = results.success.length;
    results.totalFailed = results.failed.length;

    return results;
  }

  /**
   * Bulk soft delete multiple users
   */
  async bulkSoftDelete(
    request: BulkDeleteRequest,
    performedBy: string
  ): Promise<BulkOperationResult> {
    const { userIds, reason } = request;

    const results: BulkOperationResult = {
      success: [],
      failed: [],
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };

    for (const userId of userIds) {
      try {
        // Check if user can be modified
        const error = await this.canModifyUser(userId);
        if (error) {
          results.failed.push({ id: userId, reason: error });
          continue;
        }

        // Check if already deleted
        const user = await this.prisma.profile.findUnique({
          where: { id: userId },
          select: { deletedAt: true },
        });

        if (user?.deletedAt) {
          results.failed.push({ id: userId, reason: "User already deleted" });
          continue;
        }

        // Check for active orders
        const activeOrders = await this.checkActiveOrders(userId);
        if (activeOrders > 0) {
          results.failed.push({
            id: userId,
            reason: `User has ${activeOrders} active orders`,
          });
          continue;
        }

        // Use transaction for soft delete + audit
        await this.prisma.$transaction(async (tx) => {
          const now = new Date();

          await tx.profile.update({
            where: { id: userId },
            data: {
              deletedAt: now,
              deletedBy: performedBy,
              deletionReason: reason,
            },
          });

          await this.auditService.createAuditEntry(tx, {
            userId,
            action: AuditAction.SOFT_DELETE,
            performedBy,
            before: { deletedAt: null, deletedBy: null, deletionReason: null },
            after: { deletedAt: now, deletedBy: performedBy, deletionReason: reason },
            reason: reason || "Bulk soft delete",
            metadata: { bulkOperation: true },
          });
        });

        results.success.push(userId);
      } catch (error) {
        results.failed.push({
          id: userId,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    results.totalProcessed = userIds.length;
    results.totalSuccess = results.success.length;
    results.totalFailed = results.failed.length;

    return results;
  }

  /**
   * Bulk restore multiple soft-deleted users
   */
  async bulkRestore(
    request: BulkRestoreRequest,
    performedBy: string
  ): Promise<BulkOperationResult> {
    const { userIds } = request;

    const results: BulkOperationResult = {
      success: [],
      failed: [],
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };

    for (const userId of userIds) {
      try {
        // Get user to check if it's deleted
        const user = await this.prisma.profile.findUnique({
          where: { id: userId },
          select: {
            id: true,
            type: true,
            deletedAt: true,
            deletedBy: true,
            deletionReason: true,
          },
        });

        if (!user) {
          results.failed.push({ id: userId, reason: "User not found" });
          continue;
        }

        if (!user.deletedAt) {
          results.failed.push({ id: userId, reason: "User is not deleted" });
          continue;
        }

        // Use transaction for restore + audit
        await this.prisma.$transaction(async (tx) => {
          await tx.profile.update({
            where: { id: userId },
            data: {
              deletedAt: null,
              deletedBy: null,
              deletionReason: null,
            },
          });

          await this.auditService.createAuditEntry(tx, {
            userId,
            action: AuditAction.RESTORE,
            performedBy,
            before: {
              deletedAt: user.deletedAt,
              deletedBy: user.deletedBy,
              deletionReason: user.deletionReason,
            },
            after: { deletedAt: null, deletedBy: null, deletionReason: null },
            reason: "Bulk restore",
            metadata: { bulkOperation: true },
          });
        });

        results.success.push(userId);
      } catch (error) {
        results.failed.push({
          id: userId,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    results.totalProcessed = userIds.length;
    results.totalSuccess = results.success.length;
    results.totalFailed = results.failed.length;

    return results;
  }

  /**
   * Export users to CSV format
   */
  async exportUsersToCSV(params: BulkExportParams): Promise<string> {
    const { userIds, status, type, includeDeleted = false } = params;

    // Build where clause
    const where: Prisma.ProfileWhereInput = {};

    if (userIds && userIds.length > 0) {
      where.id = { in: userIds };
    }

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    // Fetch users
    const users = await this.prisma.profile.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        status: true,
        contactName: true,
        contactNumber: true,
        companyName: true,
        website: true,
        street1: true,
        street2: true,
        city: true,
        state: true,
        zip: true,
        createdAt: true,
        deletedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Generate CSV
    const headers = [
      "ID",
      "Name",
      "Email",
      "Type",
      "Status",
      "Contact Name",
      "Contact Number",
      "Company Name",
      "Website",
      "Street 1",
      "Street 2",
      "City",
      "State",
      "ZIP",
      "Created At",
      "Deleted At",
    ];

    const rows = users.map((user) => [
      this.escapeCSV(user.id),
      this.escapeCSV(user.name || ""),
      this.escapeCSV(user.email),
      this.escapeCSV(user.type),
      this.escapeCSV(user.status),
      this.escapeCSV(user.contactName || ""),
      this.escapeCSV(user.contactNumber || ""),
      this.escapeCSV(user.companyName || ""),
      this.escapeCSV(user.website || ""),
      this.escapeCSV(user.street1 || ""),
      this.escapeCSV(user.street2 || ""),
      this.escapeCSV(user.city || ""),
      this.escapeCSV(user.state || ""),
      this.escapeCSV(user.zip || ""),
      this.escapeCSV(user.createdAt.toISOString()),
      this.escapeCSV(user.deletedAt?.toISOString() || ""),
    ]);

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }

  /**
   * Check for active orders before deletion
   */
  private async checkActiveOrders(userId: string): Promise<number> {
    const [cateringCount, onDemandCount] = await Promise.all([
      this.prisma.cateringRequest.count({
        where: {
          userId,
          status: {
            in: ["ACTIVE", "ASSIGNED", "PENDING", "CONFIRMED", "IN_PROGRESS"],
          },
        },
      }),
      this.prisma.onDemand.count({
        where: {
          userId,
          status: {
            in: ["ACTIVE", "ASSIGNED", "PENDING", "CONFIRMED", "IN_PROGRESS"],
          },
        },
      }),
    ]);

    return cateringCount + onDemandCount;
  }

  /**
   * Escape a value for CSV
   */
  private escapeCSV(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

// Export singleton instance
export const userBulkOperationsService = new UserBulkOperationsService();
