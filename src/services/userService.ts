import { prisma } from '@/utils/prismaDB';
import { UserType, UserStatus } from '@/types/prisma';
import { Prisma } from '@prisma/client';

/**
 * Interface for user query filters
 */
export interface UserFilters {
  type?: UserType;
  status?: UserStatus;
  search?: string;
  includeDeleted?: boolean;
  page?: number;
  limit?: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for user query result
 */
export interface UserQueryResult {
  users: any[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Service class for handling user database operations with soft delete support
 */
export class UserService {
  private prisma = prisma;

  /**
   * Helper function to exclude soft-deleted users from Prisma queries
   * This can be used as a middleware for all user queries
   */
  excludeDeleted(): Prisma.ProfileWhereInput {
    return {
      deletedAt: null,
    };
  }

  /**
   * Helper function to include only soft-deleted users
   */
  includeOnlyDeleted(): Prisma.ProfileWhereInput {
    return {
      deletedAt: { not: null },
    };
  }

  /**
   * Get users with filtering and pagination
   */
  async getUsers(filters: UserFilters = {}): Promise<UserQueryResult> {
    try {
      const {
        type,
        status,
        search,
        includeDeleted = false,
        page = 1,
        limit = 10,
        sortField = 'createdAt',
        sortOrder = 'desc',
      } = filters;

      // Build where clause
      const where: Prisma.ProfileWhereInput = {};

      // Apply soft delete filter
      if (includeDeleted) {
        // Include all users (both active and soft-deleted)
        // No additional filter needed
      } else {
        // Exclude soft-deleted users by default
        where.deletedAt = null;
      }

      // Apply other filters
      if (type) {
        where.type = type;
      }

      if (status) {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { contactName: { contains: search, mode: 'insensitive' } },
          { companyName: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Build order by clause
      const orderBy: Prisma.ProfileOrderByWithRelationInput = {};
      if (sortField && (sortOrder === 'asc' || sortOrder === 'desc')) {
        (orderBy as any)[sortField] = sortOrder;
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
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            deletedBy: true,
            deletionReason: true,
          },
          orderBy,
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
      console.error('Error in getUsers:', error);
      throw error;
    }
  }

  /**
   * Get a single user by ID
   */
  async getUserById(
    userId: string,
    includeDeleted: boolean = false
  ): Promise<any | null> {
    try {
      const where: Prisma.ProfileWhereUniqueInput = { id: userId };

      // Apply soft delete filter
      if (!includeDeleted) {
        where.deletedAt = null;
      }

      return await this.prisma.profile.findUnique({
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
          website: true,
          street1: true,
          street2: true,
          city: true,
          state: true,
          zip: true,
          locationNumber: true,
          parkingLoading: true,
          counties: true,
          timeNeeded: true,
          cateringBrokerage: true,
          provide: true,
          frequency: true,
          headCount: true,
          sideNotes: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          deletedBy: true,
          deletionReason: true,
        },
      });
    } catch (error) {
      console.error('Error in getUserById:', error);
      throw error;
    }
  }

  /**
   * Get users by type with soft delete filtering
   */
  async getUsersByType(
    type: UserType,
    includeDeleted: boolean = false
  ): Promise<any[]> {
    try {
      const where: Prisma.ProfileWhereInput = {
        type,
      };

      // Apply soft delete filter
      if (!includeDeleted) {
        where.deletedAt = null;
      }

      return await this.prisma.profile.findMany({
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
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      console.error('Error in getUsersByType:', error);
      throw error;
    }
  }

  /**
   * Get active users count (excluding soft-deleted)
   */
  async getActiveUsersCount(): Promise<number> {
    try {
      return await this.prisma.profile.count({
        where: this.excludeDeleted(),
      });
    } catch (error) {
      console.error('Error in getActiveUsersCount:', error);
      throw error;
    }
  }

  /**
   * Get soft-deleted users count
   */
  async getDeletedUsersCount(): Promise<number> {
    try {
      return await this.prisma.profile.count({
        where: this.includeOnlyDeleted(),
      });
    } catch (error) {
      console.error('Error in getDeletedUsersCount:', error);
      throw error;
    }
  }

  /**
   * Search users with soft delete filtering
   */
  async searchUsers(
    searchTerm: string,
    includeDeleted: boolean = false,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const where: Prisma.ProfileWhereInput = {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { contactName: { contains: searchTerm, mode: 'insensitive' } },
          { companyName: { contains: searchTerm, mode: 'insensitive' } },
        ],
      };

      // Apply soft delete filter
      if (!includeDeleted) {
        where.deletedAt = null;
      }

      return await this.prisma.profile.findMany({
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
          createdAt: true,
          deletedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      console.error('Error in searchUsers:', error);
      throw error;
    }
  }

  /**
   * Check if user exists and is not soft-deleted
   */
  async isUserActive(userId: string): Promise<boolean> {
    try {
      const user = await this.prisma.profile.findUnique({
        where: { id: userId },
        select: { id: true, deletedAt: true },
      });

      return user ? user.deletedAt === null : false;
    } catch (error) {
      console.error('Error in isUserActive:', error);
      throw error;
    }
  }

  /**
   * Get user statistics including soft delete counts
   */
  async getUserStatistics() {
    try {
      const [
        totalUsers,
        activeUsers,
        deletedUsers,
        usersByType,
        usersByStatus,
      ] = await Promise.all([
        this.prisma.profile.count(),
        this.prisma.profile.count({
          where: this.excludeDeleted(),
        }),
        this.prisma.profile.count({
          where: this.includeOnlyDeleted(),
        }),
        this.prisma.profile.groupBy({
          by: ['type'],
          where: this.excludeDeleted(),
          _count: { type: true },
        }),
        this.prisma.profile.groupBy({
          by: ['status'],
          where: this.excludeDeleted(),
          _count: { status: true },
        }),
      ]);

      return {
        totalUsers,
        activeUsers,
        deletedUsers,
        usersByType: usersByType.reduce((acc, item) => {
          acc[item.type] = item._count.type;
          return acc;
        }, {} as Record<string, number>),
        usersByStatus: usersByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      console.error('Error in getUserStatistics:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const userService = new UserService();
