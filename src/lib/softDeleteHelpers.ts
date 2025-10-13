/**
 * Soft Delete Helper Functions
 * 
 * This module provides utility functions to ensure consistent soft delete
 * behavior across the application, especially for related entity queries
 * that may not be automatically filtered by Prisma middleware.
 */

import { Prisma } from '@prisma/client';

/**
 * Helper to add soft delete filters to user-related queries
 */
export const softDeleteFilters = {
  /**
   * Filter for active (non-soft-deleted) users
   */
  activeUsers: (): Prisma.ProfileWhereInput => ({
    deletedAt: null
  }),

  /**
   * Filter for soft-deleted users only
   */
  deletedUsers: (): Prisma.ProfileWhereInput => ({
    deletedAt: { not: null }
  }),

  /**
   * Filter orders to exclude those from soft-deleted users
   */
  ordersFromActiveUsers: (): Prisma.CateringRequestWhereInput => ({
    user: {
      deletedAt: null
    }
  }),

  /**
   * Filter on-demand requests to exclude those from soft-deleted users
   */
  onDemandFromActiveUsers: (): Prisma.OnDemandWhereInput => ({
    user: {
      deletedAt: null
    }
  }),

  /**
   * Filter dispatches to exclude those with soft-deleted drivers or users
   */
  dispatchesWithActiveParticipants: (): Prisma.DispatchWhereInput => ({
    AND: [
      {
        OR: [
          { driver: null },
          { driver: { deletedAt: null } }
        ]
      },
      {
        OR: [
          { user: null },
          { user: { deletedAt: null } }
        ]
      }
    ]
  }),

  /**
   * Filter file uploads to exclude those from soft-deleted users
   */
  fileUploadsFromActiveUsers: (): Prisma.FileUploadWhereInput => ({
    OR: [
      { user: null },
      { user: { deletedAt: null } }
    ]
  }),

  /**
   * Filter user addresses to exclude those from soft-deleted users
   */
  addressesFromActiveUsers: (): Prisma.UserAddressWhereInput => ({
    user: {
      deletedAt: null
    }
  })
};

/**
 * Validation functions to check if entities should be included
 */
export const softDeleteValidations = {
  /**
   * Check if a user is active (not soft-deleted)
   */
  isUserActive: (user: { deletedAt: Date | null } | null): boolean => {
    return user ? user.deletedAt === null : false;
  },

  /**
   * Check if a user can be assigned orders (active and appropriate type)
   */
  canUserReceiveOrders: (user: { deletedAt: Date | null; status: string } | null): boolean => {
    return user ? user.deletedAt === null && user.status === 'ACTIVE' : false;
  },

  /**
   * Check if a driver can be assigned deliveries
   */
  canDriverBeAssigned: (driver: { deletedAt: Date | null; type: string; status: string } | null): boolean => {
    return driver ? 
      driver.deletedAt === null && 
      driver.type === 'DRIVER' && 
      driver.status === 'ACTIVE' : false;
  }
};

/**
 * Business logic helpers for soft delete scenarios
 */
export const softDeleteBusinessLogic = {
  /**
   * Get available drivers for assignment (excludes soft-deleted)
   */
  getAvailableDriversFilter: (): Prisma.ProfileWhereInput => ({
    type: 'DRIVER',
    status: 'ACTIVE',
    deletedAt: null
  }),

  /**
   * Get active vendor profiles
   */
  getActiveVendorsFilter: (): Prisma.ProfileWhereInput => ({
    type: 'VENDOR',
    status: 'ACTIVE',
    deletedAt: null
  }),

  /**
   * Get active client profiles
   */
  getActiveClientsFilter: (): Prisma.ProfileWhereInput => ({
    type: 'CLIENT',
    status: 'ACTIVE',
    deletedAt: null
  }),

  /**
   * Filter for orders that can be assigned (from active users)
   */
  getAssignableOrdersFilter: (): Prisma.CateringRequestWhereInput => ({
    status: { in: ['ACTIVE', 'PENDING', 'CONFIRMED'] },
    user: {
      deletedAt: null,
      status: 'ACTIVE'
    }
  }),

  /**
   * Filter for on-demand requests that can be assigned
   */
  getAssignableOnDemandFilter: (): Prisma.OnDemandWhereInput => ({
    status: { in: ['ACTIVE', 'PENDING', 'CONFIRMED'] },
    user: {
      deletedAt: null,
      status: 'ACTIVE'
    }
  })
};

/**
 * Error messages for soft delete scenarios
 */
export const softDeleteErrorMessages = {
  USER_DEACTIVATED: 'Account has been deactivated',
  DRIVER_DEACTIVATED: 'Driver account has been deactivated',
  VENDOR_DEACTIVATED: 'Vendor account has been deactivated',
  CLIENT_DEACTIVATED: 'Client account has been deactivated',
  CANNOT_ASSIGN_TO_DELETED_USER: 'Cannot assign orders to deactivated accounts',
  CANNOT_ASSIGN_DELETED_DRIVER: 'Cannot assign deliveries to deactivated drivers',
  ORDER_FROM_DELETED_USER: 'This order is from a deactivated account'
};

/**
 * Logging helper for soft delete operations
 */
export const softDeleteLogging = {
  logSoftDeletedUserAccess: (userId: string, operation: string, context?: any) => {
    console.warn(`[SOFT_DELETE] Attempted ${operation} on soft-deleted user ${userId}`, context);
  },

  logDriverAssignmentAttempt: (driverId: string, orderId: string, isDriverDeleted: boolean) => {
    if (isDriverDeleted) {
      console.warn(`[SOFT_DELETE] Attempted to assign order ${orderId} to soft-deleted driver ${driverId}`);
    }
  },

  logOrderAccessAttempt: (orderId: string, userId: string, isUserDeleted: boolean) => {
    if (isUserDeleted) {
      console.warn(`[SOFT_DELETE] Attempted to access order ${orderId} from soft-deleted user ${userId}`);
    }
  }
};
