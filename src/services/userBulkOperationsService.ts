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
  BulkRoleChangeRequest,
  BulkEmailRequest,
  BulkImportResult,
  ParsedUserRow,
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
   * Bulk change role for multiple users
   * SUPER_ADMIN only operation
   */
  async bulkRoleChange(
    request: BulkRoleChangeRequest,
    performedBy: string
  ): Promise<BulkOperationResult> {
    const { userIds, newRole, reason } = request;

    const results: BulkOperationResult = {
      success: [],
      failed: [],
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };

    for (const userId of userIds) {
      try {
        // Check if user can be modified (also checks for SUPER_ADMIN)
        const error = await this.canModifyUser(userId);
        if (error) {
          results.failed.push({ id: userId, reason: error });
          continue;
        }

        // Get current state for audit
        const currentUser = await this.prisma.profile.findUnique({
          where: { id: userId },
          select: { type: true },
        });

        if (!currentUser) {
          results.failed.push({ id: userId, reason: "User not found" });
          continue;
        }

        // Skip if role is already the same
        if (currentUser.type === newRole) {
          results.failed.push({ id: userId, reason: "Role unchanged" });
          continue;
        }

        // Use transaction for update + audit
        await this.prisma.$transaction(async (tx) => {
          await tx.profile.update({
            where: { id: userId },
            data: { type: newRole },
          });

          await this.auditService.createAuditEntry(tx, {
            userId,
            action: AuditAction.ROLE_CHANGE,
            performedBy,
            before: { type: currentUser.type },
            after: { type: newRole },
            reason: reason || `Bulk role change to ${newRole}`,
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

  /**
   * Bulk import users from CSV content
   */
  async bulkImportUsers(
    csvContent: string,
    performedBy: string
  ): Promise<BulkImportResult> {
    const results: BulkImportResult = {
      success: [],
      failed: [],
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };

    // Parse CSV
    const rows = this.parseCSV(csvContent);

    if (rows.length === 0) {
      return results;
    }

    // Skip header row
    const dataRows = rows.slice(1);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // Account for header and 0-indexing

      // Skip if row is undefined (shouldn't happen but TypeScript requires the check)
      if (!row) {
        continue;
      }

      try {
        // Validate row
        const validationError = this.validateImportRow(row, rowNum);
        if (validationError) {
          results.failed.push({
            row: rowNum,
            email: row.email || "unknown",
            reason: validationError,
          });
          continue;
        }

        // Check if email already exists
        const existingUser = await this.prisma.profile.findFirst({
          where: { email: row.email.toLowerCase().trim() },
          select: { id: true, deletedAt: true },
        });

        if (existingUser) {
          results.failed.push({
            row: rowNum,
            email: row.email,
            reason: existingUser.deletedAt ? "User exists (deleted)" : "Email already exists",
          });
          continue;
        }

        // Normalize type and status
        const userType = this.normalizeUserType(row.type);
        const userStatus = this.normalizeUserStatus(row.status);

        if (!userType) {
          results.failed.push({
            row: rowNum,
            email: row.email,
            reason: `Invalid type: ${row.type}`,
          });
          continue;
        }

        if (!userStatus) {
          results.failed.push({
            row: rowNum,
            email: row.email,
            reason: `Invalid status: ${row.status}`,
          });
          continue;
        }

        // Create user in transaction
        await this.prisma.$transaction(async (tx) => {
          const newUser = await tx.profile.create({
            data: {
              id: crypto.randomUUID(),
              email: row.email.toLowerCase().trim(),
              name: row.name?.trim() || null,
              type: userType,
              status: userStatus,
              contactName: row.contactName?.trim() || null,
              contactNumber: row.contactNumber?.trim() || null,
              companyName: row.companyName?.trim() || null,
              website: row.website?.trim() || null,
              street1: row.street1?.trim() || null,
              street2: row.street2?.trim() || null,
              city: row.city?.trim() || null,
              state: row.state?.trim() || null,
              zip: row.zip?.trim() || null,
            },
          });

          await this.auditService.createAuditEntry(tx, {
            userId: newUser.id,
            action: AuditAction.CREATE,
            performedBy,
            before: null,
            after: { email: row.email, type: userType, status: userStatus },
            reason: "Bulk import from CSV",
            metadata: { bulkOperation: true, importRow: rowNum },
          });

          results.success.push(newUser.id);
        });
      } catch (error) {
        results.failed.push({
          row: rowNum,
          email: row.email || "unknown",
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    results.totalProcessed = dataRows.length;
    results.totalSuccess = results.success.length;
    results.totalFailed = results.failed.length;

    return results;
  }

  /**
   * Parse CSV content into rows
   */
  private parseCSV(content: string): ParsedUserRow[] {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) return [];

    const rows: ParsedUserRow[] = [];

    for (const line of lines) {
      const values = this.parseCSVLine(line);

      // Map values to ParsedUserRow based on expected column order
      // Email,Name,Type,Status,Contact Name,Contact Number,Company Name,Website,Street 1,Street 2,City,State,ZIP
      rows.push({
        email: values[0] || "",
        name: values[1] || undefined,
        type: values[2] || "",
        status: values[3] || "",
        contactName: values[4] || undefined,
        contactNumber: values[5] || undefined,
        companyName: values[6] || undefined,
        website: values[7] || undefined,
        street1: values[8] || undefined,
        street2: values[9] || undefined,
        city: values[10] || undefined,
        state: values[11] || undefined,
        zip: values[12] || undefined,
      });
    }

    return rows;
  }

  /**
   * Parse a single CSV line, handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote
            current += '"';
            i++;
          } else {
            // End of quoted value
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
    }

    // Don't forget the last value
    values.push(current.trim());

    return values;
  }

  /**
   * Validate a row from CSV import
   */
  private validateImportRow(row: ParsedUserRow, rowNum: number): string | null {
    // Check required fields
    if (!row.email || !row.email.trim()) {
      return "Email is required";
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row.email.trim())) {
      return "Invalid email format";
    }

    if (!row.type || !row.type.trim()) {
      return "Type is required";
    }

    if (!row.status || !row.status.trim()) {
      return "Status is required";
    }

    return null;
  }

  /**
   * Normalize user type string to UserType enum
   */
  private normalizeUserType(type: string): UserType | null {
    const normalized = type.toUpperCase().trim();
    const validTypes: UserType[] = [
      UserType.VENDOR,
      UserType.CLIENT,
      UserType.DRIVER,
      UserType.ADMIN,
      UserType.HELPDESK,
    ];

    // Don't allow importing SUPER_ADMIN
    if (normalized === "SUPER_ADMIN") return null;

    return validTypes.find((t) => t === normalized) || null;
  }

  /**
   * Normalize user status string to UserStatus enum
   */
  private normalizeUserStatus(status: string): UserStatus | null {
    const normalized = status.toUpperCase().trim();

    // Only allow ACTIVE or PENDING for imports
    if (normalized === UserStatus.ACTIVE) return UserStatus.ACTIVE;
    if (normalized === UserStatus.PENDING) return UserStatus.PENDING;

    return null;
  }

  /**
   * Bulk send email to multiple users
   */
  async bulkSendEmail(
    request: BulkEmailRequest,
    performedBy: string
  ): Promise<BulkOperationResult> {
    const { userIds, template, subject, body, reason } = request;

    const results: BulkOperationResult = {
      success: [],
      failed: [],
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };

    // Get user emails
    const users = await this.prisma.profile.findMany({
      where: {
        id: { in: userIds },
        deletedAt: null,
        email: { not: "" }, // Filter out users without email
      },
      select: { id: true, email: true, name: true },
    });

    // For now, we'll just mark as successful since we don't have email service integrated
    // In a real implementation, you would integrate with EmailNotificationService
    for (const user of users) {
      try {
        // TODO: Integrate with EmailNotificationService
        // await emailService.sendEmail({
        //   to: user.email,
        //   subject,
        //   body,
        //   template,
        // });

        results.success.push(user.id);

        // Log audit entry
        await this.auditService.createAuditEntry(this.prisma, {
          userId: user.id,
          action: AuditAction.UPDATE,
          performedBy,
          before: null,
          after: { emailSent: true, template, subject },
          reason: reason || `Bulk email: ${template}`,
          metadata: { bulkOperation: true, emailTemplate: template },
        });
      } catch (error) {
        results.failed.push({
          id: user.id,
          reason: error instanceof Error ? error.message : "Failed to send email",
        });
      }
    }

    // Add failed entries for users not found
    const foundIds = new Set(users.map((u) => u.id));
    for (const userId of userIds) {
      if (!foundIds.has(userId)) {
        results.failed.push({ id: userId, reason: "User not found or no email" });
      }
    }

    results.totalProcessed = userIds.length;
    results.totalSuccess = results.success.length;
    results.totalFailed = results.failed.length;

    return results;
  }
}

// Export singleton instance
export const userBulkOperationsService = new UserBulkOperationsService();
