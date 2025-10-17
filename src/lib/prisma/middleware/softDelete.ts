import { Prisma } from '@prisma/client';
import { prismaLogger } from '@/utils/logger';

/**
 * Prisma middleware for automatic soft delete filtering
 *
 * This middleware automatically filters out soft-deleted records from all queries
 * unless explicitly included using the `includeDeleted` parameter.
 *
 * Soft-deleted records are identified by having a non-null `deletedAt` field.
 */
export const softDeleteMiddleware = async (params: any, next: any) => {
  // Skip middleware for specific operations that should include deleted records
  if (params.args?.includeDeleted === true) {
    // Remove the includeDeleted flag before passing to Prisma
    delete params.args.includeDeleted;
    return next(params);
  }

  // Apply soft delete filtering to Profile queries
  if (params.model === 'Profile') {
    // For findMany operations
    if (params.action === 'findMany') {
      params.args = {
        ...params.args,
        where: {
          ...params.args.where,
          deletedAt: null
        }
      };
    }
    
    // For findFirst operations
    if (params.action === 'findFirst') {
      params.args = {
        ...params.args,
        where: {
          ...params.args.where,
          deletedAt: null
        }
      };
    }
    
    // For findUnique operations
    if (params.action === 'findUnique') {
      params.args = {
        ...params.args,
        where: {
          ...params.args.where,
          deletedAt: null
        }
      };
    }
    
    // For count operations
    if (params.action === 'count') {
      params.args = {
        ...params.args,
        where: {
          ...params.args.where,
          deletedAt: null
        }
      };
    }
    
    // For aggregate operations
    if (params.action === 'aggregate') {
      params.args = {
        ...params.args,
        where: {
          ...params.args.where,
          deletedAt: null
        }
      };
    }
  }

  // Apply soft delete filtering to related entities that reference Profile
  if (params.model === 'CateringRequest') {
    if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(params.action)) {
      params.args = {
        ...params.args,
        where: {
          ...params.args.where,
          user: {
            ...params.args.where?.user,
            deletedAt: null
          }
        }
      };
    }
  }

  if (params.model === 'Dispatch') {
    if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(params.action)) {
      params.args = {
        ...params.args,
        where: {
          ...params.args.where,
          AND: [
            params.args.where?.driver ? {
              driver: {
                ...params.args.where.driver,
                deletedAt: null
              }
            } : {},
            params.args.where?.user ? {
              user: {
                ...params.args.where.user,
                deletedAt: null
              }
            } : {}
          ].filter(condition => Object.keys(condition).length > 0)
        }
      };
    }
  }

  if (params.model === 'FileUpload') {
    if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(params.action)) {
      params.args = {
        ...params.args,
        where: {
          ...params.args.where,
          user: {
            ...params.args.where?.user,
            deletedAt: null
          }
        }
      };
    }
  }

  if (params.model === 'OnDemand') {
    if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(params.action)) {
      params.args = {
        ...params.args,
        where: {
          ...params.args.where,
          user: {
            ...params.args.where?.user,
            deletedAt: null
          }
        }
      };
    }
  }

  if (params.model === 'UserAddress') {
    if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(params.action)) {
      params.args = {
        ...params.args,
        where: {
          ...params.args.where,
          user: {
            ...params.args.where?.user,
            deletedAt: null
          }
        }
      };
    }
  }

  if (params.model === 'JobApplication') {
    if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(params.action)) {
      params.args = {
        ...params.args,
        where: {
          ...params.args.where,
          profile: {
            ...params.args.where?.profile,
            deletedAt: null
          }
        }
      };
    }
  }

  // Log middleware application for debugging
  prismaLogger.debug('Soft delete middleware applied', {
    model: params.model,
    action: params.action,
    hasWhereClause: !!params.args?.where
  });

  return next(params);
};

/**
 * Soft delete a Profile record
 * Sets the deletedAt timestamp instead of actually deleting the record
 */
export async function softDeleteProfile(
  prisma: any,
  profileId: string
): Promise<void> {
  await prisma.profile.update({
    where: { id: profileId },
    data: { deletedAt: new Date() }
  });
  
  prismaLogger.info('Profile soft deleted', { profileId });
}

/**
 * Restore a soft-deleted Profile record
 * Sets the deletedAt field to null
 */
export async function restoreProfile(
  prisma: any,
  profileId: string
): Promise<void> {
  await prisma.profile.update({
    where: { id: profileId },
    data: { deletedAt: null }
  });
  
  prismaLogger.info('Profile restored', { profileId });
}

/**
 * Check if a Profile is soft-deleted
 */
export async function isProfileSoftDeleted(
  prisma: any,
  profileId: string
): Promise<boolean> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { deletedAt: true }
  });
  
  return profile?.deletedAt !== null;
}
