import { prisma } from '@/utils/prismaDB';
import { UserType } from '@/types/prisma';
import { Prisma } from '@prisma/client';

/**
 * Interface for filtering deleted users
 */
export interface DeletedUserFilters {
  type?: UserType;
  status?: string;
  deletedBy?: string;
  deletedAfter?: Date;
  deletedBefore?: Date;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Interface for soft delete result
 */
export interface SoftDeleteResult {
  success: boolean;
  userId: string;
  deletedAt: Date;
  deletedBy: string;
  deletionReason?: string;
  message: string;
}

/**
 * Interface for restore result
 */
export interface RestoreResult {
  success: boolean;
  userId: string;
  restoredAt: Date;
  restoredBy: string;
  message: string;
}

/**
 * Interface for permanent delete result
 */
export interface PermanentDeleteResult {
  success: boolean;
  userId: string;
  deletedAt: Date;
  deletedBy: string;
  message: string;
  affectedRecords: {
    dispatchesDeleted: number;
    fileUploadsUpdated: number;
    addressesDeleted: number;
    addressesUpdated: number;
  };
}

/**
 * Service class for handling user soft delete operations
 */
export class UserSoftDeleteService {
  private prisma = prisma;

  /**
   * Soft delete a user by setting deletedAt timestamp
   */
  async softDeleteUser(
    userId: string,
    deletedBy: string,
    reason?: string
  ): Promise<SoftDeleteResult> {
    try {
      // Validate that the user exists and is not already deleted
      const existingUser = await this.prisma.profile.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          email: true, 
          type: true, 
          deletedAt: true,
          deletedBy: true 
        }
      });

      if (!existingUser) {
        throw new Error('User not found');
      }

      if (existingUser.deletedAt) {
        throw new Error('User is already soft deleted');
      }

      // Check for active orders before soft deletion
      const activeOrders = await this.checkActiveOrders(userId);
      if (activeOrders.totalActiveOrders > 0) {
        throw new Error(
          `Cannot delete user with active orders. Complete or cancel orders first. Active orders: ${activeOrders.totalActiveOrders}`
        );
      }

      // Perform soft delete in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Update the user with soft delete information
        const updatedUser = await tx.profile.update({
          where: { id: userId },
          data: {
            deletedAt: new Date(),
            deletedBy,
            deletionReason: reason,
          },
        });

        // Create audit log entry
        await tx.userAudit.create({
          data: {
            userId,
            action: 'SOFT_DELETE',
            performedBy: deletedBy,
            changes: {
              before: {
                deletedAt: null,
                deletedBy: null,
                deletionReason: null,
              },
              after: {
                deletedAt: updatedUser.deletedAt,
                deletedBy: updatedUser.deletedBy,
                deletionReason: updatedUser.deletionReason,
              },
            },
            reason: reason || 'User soft deleted',
            metadata: {
              operation: 'soft_delete',
              timestamp: new Date().toISOString(),
            },
          },
        });

        return updatedUser;
      });

      return {
        success: true,
        userId: result.id,
        deletedAt: result.deletedAt!,
        deletedBy: result.deletedBy!,
        deletionReason: result.deletionReason || undefined,
        message: 'User soft deleted successfully',
      };
    } catch (error) {
      console.error('Error in softDeleteUser:', error);
      throw error;
    }
  }

  /**
   * Restore a soft-deleted user
   */
  async restoreUser(
    userId: string,
    restoredBy: string
  ): Promise<RestoreResult> {
    try {
      // Validate that the user exists and is soft deleted
      const existingUser = await this.prisma.profile.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          email: true, 
          deletedAt: true,
          deletedBy: true 
        }
      });

      if (!existingUser) {
        throw new Error('User not found');
      }

      if (!existingUser.deletedAt) {
        throw new Error('User is not soft deleted');
      }

      // Perform restore in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Restore the user by clearing soft delete fields
        const restoredUser = await tx.profile.update({
          where: { id: userId },
          data: {
            deletedAt: null,
            deletedBy: null,
            deletionReason: null,
          },
        });

        // Create audit log entry
        await tx.userAudit.create({
          data: {
            userId,
            action: 'RESTORE',
            performedBy: restoredBy,
            changes: {
              before: {
                deletedAt: existingUser.deletedAt,
                deletedBy: existingUser.deletedBy,
                deletionReason: null,
              },
              after: {
                deletedAt: null,
                deletedBy: null,
                deletionReason: null,
              },
            },
            reason: 'User restored from soft delete',
            metadata: {
              operation: 'restore',
              timestamp: new Date().toISOString(),
            },
          },
        });

        return restoredUser;
      });

      return {
        success: true,
        userId: result.id,
        restoredAt: new Date(),
        restoredBy,
        message: 'User restored successfully',
      };
    } catch (error) {
      console.error('Error in restoreUser:', error);
      throw error;
    }
  }

  /**
   * Permanently delete a user (for GDPR compliance after retention period)
   */
  async permanentlyDeleteUser(userId: string): Promise<PermanentDeleteResult> {
    try {
      // Validate that the user exists and is soft deleted
      const existingUser = await this.prisma.profile.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          email: true, 
          type: true,
          deletedAt: true,
          deletedBy: true 
        }
      });

      if (!existingUser) {
        throw new Error('User not found');
      }

      if (!existingUser.deletedAt) {
        throw new Error('User must be soft deleted before permanent deletion');
      }

      // Prevent deletion of SUPER_ADMIN users
      if (existingUser.type === UserType.SUPER_ADMIN) {
        throw new Error('Super Admin users cannot be permanently deleted');
      }

      // Perform permanent deletion in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Step 1: Delete Dispatch records
        const deletedDispatches = await tx.dispatch.deleteMany({
          where: {
            OR: [{ driverId: userId }, { userId }],
          },
        });

        // Step 2: Update FileUpload records to null out userId
        const updatedFileUploads = await tx.fileUpload.updateMany({
          where: { userId },
          data: { userId: null },
        });

        // Step 3: Handle Address ownership logic
        const createdAddresses = await tx.address.findMany({
          where: { createdBy: userId },
          include: {
            userAddresses: true,
            cateringPickupRequests: true,
            cateringDeliveryRequests: true,
            onDemandPickupRequests: true,
            onDemandDeliveryRequests: true,
          }
        });

        let deletedAddresses = 0;
        let updatedAddresses = 0;

        for (const address of createdAddresses) {
          const isUsedByOthers = 
            address.userAddresses.some((ua: { userId: string }) => ua.userId !== userId) ||
            address.cateringPickupRequests.length > 0 ||
            address.cateringDeliveryRequests.length > 0 ||
            address.onDemandPickupRequests.length > 0 ||
            address.onDemandDeliveryRequests.length > 0;

          if (!isUsedByOthers) {
            await tx.address.delete({
              where: { id: address.id }
            });
            deletedAddresses++;
          } else {
            await tx.address.update({
              where: { id: address.id },
              data: { createdBy: null }
            });
            updatedAddresses++;
          }
        }

        // Step 4: Delete the Profile (triggers CASCADE deletes)
        const deletedProfile = await tx.profile.delete({
          where: { id: userId },
        });

        // Step 5: Create audit log entry
        await tx.userAudit.create({
          data: {
            userId,
            action: 'PERMANENT_DELETE',
            performedBy: existingUser.deletedBy,
            changes: {
              before: {
                id: existingUser.id,
                email: existingUser.email,
                type: existingUser.type,
                deletedAt: existingUser.deletedAt,
                deletedBy: existingUser.deletedBy,
              },
              after: null,
            },
            reason: 'User permanently deleted for GDPR compliance',
            metadata: {
              operation: 'permanent_delete',
              timestamp: new Date().toISOString(),
              affectedRecords: {
                dispatchesDeleted: deletedDispatches.count,
                fileUploadsUpdated: updatedFileUploads.count,
                addressesDeleted: deletedAddresses,
                addressesUpdated: updatedAddresses,
              },
            },
          },
        });

        return {
          deletedProfile,
          deletedDispatches: deletedDispatches.count,
          updatedFileUploads: updatedFileUploads.count,
          deletedAddresses,
          updatedAddresses,
        };
      });

      return {
        success: true,
        userId,
        deletedAt: new Date(),
        deletedBy: existingUser.deletedBy!,
        message: 'User permanently deleted successfully',
        affectedRecords: {
          dispatchesDeleted: result.deletedDispatches,
          fileUploadsUpdated: result.updatedFileUploads,
          addressesDeleted: result.deletedAddresses,
          addressesUpdated: result.updatedAddresses,
        },
      };
    } catch (error) {
      console.error('Error in permanentlyDeleteUser:', error);
      throw error;
    }
  }

  /**
   * Get soft-deleted users with filtering
   */
  async getDeletedUsers(filters: DeletedUserFilters = {}) {
    try {
      const {
        type,
        status,
        deletedBy,
        deletedAfter,
        deletedBefore,
        search,
        page = 1,
        limit = 10,
      } = filters;

      // Build where clause
      const where: Prisma.ProfileWhereInput = {
        deletedAt: { not: null }, // Only soft-deleted users
      };

      if (type) {
        where.type = type;
      }

      if (status) {
        where.status = status as any;
      }

      if (deletedBy) {
        where.deletedBy = deletedBy;
      }

      if (deletedAfter || deletedBefore) {
        where.deletedAt = {
          not: null,
          ...(deletedAfter && { gte: deletedAfter }),
          ...(deletedBefore && { lte: deletedBefore }),
        };
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { contactName: { contains: search, mode: 'insensitive' } },
          { companyName: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Execute query with pagination
      const [users, totalCount] = await Promise.all([
        this.prisma.profile.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            type: true,
            status: true,
            contactNumber: true,
            companyName: true,
            contactName: true,
            deletedAt: true,
            deletedBy: true,
            deletionReason: true,
            createdAt: true,
            updatedAt: true,
            deletedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
                type: true,
              },
            },
          },
          orderBy: { deletedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.profile.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        users,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      console.error('Error in getDeletedUsers:', error);
      throw error;
    }
  }

  /**
   * Check for active orders before deletion
   */
  private async checkActiveOrders(userId: string) {
    const [cateringOrders, onDemandOrders] = await Promise.all([
      this.prisma.cateringRequest.count({
        where: { 
          userId, 
          status: { in: ['ACTIVE', 'ASSIGNED', 'PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
        }
      }),
      this.prisma.onDemand.count({
        where: { 
          userId, 
          status: { in: ['ACTIVE', 'ASSIGNED', 'PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
        }
      })
    ]);

    return {
      activeCateringOrders: cateringOrders,
      activeOnDemandOrders: onDemandOrders,
      totalActiveOrders: cateringOrders + onDemandOrders,
    };
  }
}

// Export singleton instance
export const userSoftDeleteService = new UserSoftDeleteService();
