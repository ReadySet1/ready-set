import { prisma } from '@/utils/prismaDB';
import { prismaLogger } from '@/utils/logger';

/**
 * Utility functions for handling soft-deleted users in related entities
 *
 * These functions ensure that soft-deleted users are properly excluded
 * from various business operations and data queries.
 */

/**
 * Check if a user is soft-deleted before allowing operations
 */
export async function validateUserNotSoftDeleted(userId: string): Promise<{
  isValid: boolean;
  error?: string;
}> {
  try {
    const user = await prisma.profile.findUnique({
      where: { id: userId },
      select: { deletedAt: true }
    });

    if (!user) {
      prismaLogger.warn('User not found during validation', { userId });
      return {
        isValid: false,
        error: 'User not found'
      };
    }

    if (user.deletedAt) {
      prismaLogger.warn('Operation attempted on soft-deleted user', { userId });
      return {
        isValid: false,
        error: 'User account has been deactivated'
      };
    }

    return { isValid: true };
  } catch (error) {
    prismaLogger.error('Error validating user soft delete status', { userId, error });
    return {
      isValid: false,
      error: 'Unable to verify user status'
    };
  }
}

/**
 * Get active drivers for dispatch assignments
 * Excludes soft-deleted drivers from assignment pool
 */
export async function getActiveDriversForDispatch(): Promise<any[]> {
  try {
    const activeDrivers = await prisma.profile.findMany({
      where: {
        type: 'DRIVER',
        deletedAt: null, // Explicitly exclude soft-deleted drivers
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        email: true,
        contactNumber: true,
        status: true
      }
    });

    prismaLogger.debug('Retrieved active drivers for dispatch', { 
      count: activeDrivers.length 
    });

    return activeDrivers;
  } catch (error) {
    prismaLogger.error('Error fetching active drivers', { error });
    throw new Error('Failed to fetch available drivers');
  }
}

/**
 * Get active vendors for order display
 * Excludes soft-deleted vendors from order listings
 */
export async function getActiveVendorsForOrders(): Promise<any[]> {
  try {
    const activeVendors = await prisma.profile.findMany({
      where: {
        type: 'VENDOR',
        deletedAt: null, // Explicitly exclude soft-deleted vendors
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        status: true
      }
    });

    prismaLogger.debug('Retrieved active vendors for orders', { 
      count: activeVendors.length 
    });

    return activeVendors;
  } catch (error) {
    prismaLogger.error('Error fetching active vendors', { error });
    throw new Error('Failed to fetch available vendors');
  }
}

/**
 * Get active clients for catering requests
 * Excludes soft-deleted clients from catering operations
 */
export async function getActiveClientsForCatering(): Promise<any[]> {
  try {
    const activeClients = await prisma.profile.findMany({
      where: {
        type: 'CLIENT',
        deletedAt: null, // Explicitly exclude soft-deleted clients
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        status: true
      }
    });

    prismaLogger.debug('Retrieved active clients for catering', { 
      count: activeClients.length 
    });

    return activeClients;
  } catch (error) {
    prismaLogger.error('Error fetching active clients', { error });
    throw new Error('Failed to fetch available clients');
  }
}

/**
 * Archive file uploads from soft-deleted users
 * Marks file uploads as archived when user is soft-deleted
 */
export async function archiveFileUploadsForUser(userId: string): Promise<void> {
  try {
    // Update file uploads to mark them as archived
    await prisma.fileUpload.updateMany({
      where: {
        userId: userId
      },
      data: {
        isTemporary: true, // Mark as temporary/archived
        updatedAt: new Date()
      }
    });

    prismaLogger.info('Archived file uploads for soft-deleted user', { userId });
  } catch (error) {
    prismaLogger.error('Error archiving file uploads', { userId, error });
    throw new Error('Failed to archive user files');
  }
}

/**
 * Get orders excluding those from soft-deleted users
 * Used in vendor order listings and admin dashboards
 */
export async function getOrdersExcludingSoftDeletedUsers(
  orderType: 'catering' | 'ondemand' = 'catering',
  additionalFilters: any = {}
): Promise<any[]> {
  try {
    const baseWhere = {
      ...additionalFilters,
      user: {
        deletedAt: null // Exclude orders from soft-deleted users
      }
    };

    if (orderType === 'catering') {
      return await prisma.cateringRequest.findMany({
        where: baseWhere,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              type: true
            }
          },
          pickupAddress: true,
          deliveryAddress: true
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      return await prisma.onDemand.findMany({
        where: baseWhere,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              type: true
            }
          },
          pickupAddress: true,
          deliveryAddress: true
        },
        orderBy: { createdAt: 'desc' }
      });
    }
  } catch (error) {
    prismaLogger.error('Error fetching orders excluding soft-deleted users', { 
      orderType, 
      error 
    });
    throw new Error('Failed to fetch orders');
  }
}

/**
 * Get dispatches excluding those with soft-deleted drivers or users
 * Used in dispatch management and tracking
 */
export async function getDispatchesExcludingSoftDeletedUsers(
  additionalFilters: any = {}
): Promise<any[]> {
  try {
    const baseWhere = {
      ...additionalFilters,
      AND: [
        {
          OR: [
            { driver: { deletedAt: null } },
            { driver: null }
          ]
        },
        {
          OR: [
            { user: { deletedAt: null } },
            { user: null }
          ]
        }
      ]
    };

    return await prisma.dispatch.findMany({
      where: baseWhere,
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            contactNumber: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            type: true
          }
        },
        cateringRequest: {
          include: {
            pickupAddress: true,
            deliveryAddress: true
          }
        },
        onDemand: {
          include: {
            pickupAddress: true,
            deliveryAddress: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  } catch (error) {
    prismaLogger.error('Error fetching dispatches excluding soft-deleted users', { 
      error 
    });
    throw new Error('Failed to fetch dispatches');
  }
}

/**
 * Validate that all users in a batch operation are not soft-deleted
 * Used for bulk operations that involve multiple users
 */
export async function validateBatchUsersNotSoftDeleted(userIds: string[]): Promise<{
  validUserIds: string[];
  invalidUserIds: string[];
  errors: string[];
}> {
  const validUserIds: string[] = [];
  const invalidUserIds: string[] = [];
  const errors: string[] = [];

  for (const userId of userIds) {
    const validation = await validateUserNotSoftDeleted(userId);
    
    if (validation.isValid) {
      validUserIds.push(userId);
    } else {
      invalidUserIds.push(userId);
      errors.push(`User ${userId}: ${validation.error}`);
    }
  }

  return { validUserIds, invalidUserIds, errors };
}

/**
 * Soft delete a user and handle all related cleanup
 * This is the main function to call when soft-deleting a user
 */
export async function softDeleteUserWithCleanup(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // First validate the user exists and is not already soft-deleted
    const user = await prisma.profile.findUnique({
      where: { id: userId },
      select: { deletedAt: true }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.deletedAt) {
      return { success: false, error: 'User is already soft-deleted' };
    }

    // Perform soft delete with cleanup in a transaction
    await prisma.$transaction(async (tx) => {
      // Soft delete the user
      await tx.profile.update({
        where: { id: userId },
        data: { deletedAt: new Date() }
      });

      // Archive file uploads
      await tx.fileUpload.updateMany({
        where: { userId: userId },
        data: { 
          isTemporary: true,
          updatedAt: new Date()
        }
      });

      // Note: Other related entities (orders, dispatches) are handled
      // by the middleware which will automatically filter them out
    });

    prismaLogger.info('User soft-deleted with cleanup completed', { userId });
    return { success: true };
  } catch (error) {
    prismaLogger.error('Error soft-deleting user with cleanup', { userId, error });
    return { 
      success: false, 
      error: 'Failed to soft-delete user and perform cleanup' 
    };
  }
}
