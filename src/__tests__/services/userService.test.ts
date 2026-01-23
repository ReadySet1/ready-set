/**
 * Unit Tests for User Service
 *
 * Tests the UserService class with mocked Prisma client.
 * Covers filtering, pagination, search, and soft-delete filtering.
 *
 * Part of REA-315: Service Layer Unit Tests
 */

import { UserService, userService, UserFilters } from '@/services/userService';
import { UserType, UserStatus } from '@/types/prisma';
import {
  createMockProfile,
  createMockDeletedProfile,
  createMockVendor,
  createMockDriver,
  resetIdCounter,
} from '../helpers/mock-data-factories';
import { createMockPrismaClient, resetPrismaMocks } from '../helpers/prisma-mock-helpers';
import { configureFindManyUsers, configureGroupBy, resetAllMocks } from '../helpers/service-test-utils';

// Mock the prisma module - use a factory function
jest.mock('@/utils/prismaDB', () => {
  const { createMockPrismaClient } = jest.requireActual('../helpers/prisma-mock-helpers');
  return {
    prisma: createMockPrismaClient(),
  };
});

// Import mocked prisma client after mocking
import { prisma } from '@/utils/prismaDB';

// Type the mock prisma client for easier usage
const mockPrisma = prisma as unknown as ReturnType<typeof createMockPrismaClient>;

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
    resetPrismaMocks(mockPrisma);
    resetIdCounter();
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should create an instance of UserService', () => {
      expect(service).toBeInstanceOf(UserService);
    });

    it('should export a singleton instance', () => {
      expect(userService).toBeInstanceOf(UserService);
    });

    it('should have all required methods', () => {
      expect(typeof service.getUsers).toBe('function');
      expect(typeof service.getUserById).toBe('function');
      expect(typeof service.getUsersByType).toBe('function');
      expect(typeof service.getActiveUsersCount).toBe('function');
      expect(typeof service.getDeletedUsersCount).toBe('function');
      expect(typeof service.searchUsers).toBe('function');
      expect(typeof service.isUserActive).toBe('function');
      expect(typeof service.getUserStatistics).toBe('function');
    });
  });

  describe('excludeDeleted', () => {
    it('should return filter for non-deleted users', () => {
      const filter = service.excludeDeleted();

      expect(filter).toEqual({ deletedAt: null });
    });
  });

  describe('includeOnlyDeleted', () => {
    it('should return filter for only deleted users', () => {
      const filter = service.includeOnlyDeleted();

      expect(filter).toEqual({ deletedAt: { not: null } });
    });
  });

  describe('getUsers', () => {
    describe('Soft Delete Filtering', () => {
      it('should exclude soft-deleted users by default', async () => {
        const users = [createMockProfile({ id: 'user-1' })];
        configureFindManyUsers(mockPrisma, users, 1);

        await service.getUsers();

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              deletedAt: null,
            }),
          })
        );
      });

      it('should include deleted users when specified', async () => {
        const users = [
          createMockProfile({ id: 'user-1' }),
          createMockDeletedProfile({ id: 'user-2' }),
        ];
        configureFindManyUsers(mockPrisma, users, 2);

        await service.getUsers({ includeDeleted: true });

        const whereClause = mockPrisma.profile.findMany.mock.calls[0][0].where;
        expect(whereClause.deletedAt).toBeUndefined();
      });
    });

    describe('Type Filtering', () => {
      it('should filter by user type', async () => {
        const vendors = [createMockVendor({ id: 'vendor-1' })];
        configureFindManyUsers(mockPrisma, vendors, 1);

        await service.getUsers({ type: UserType.VENDOR });

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              type: UserType.VENDOR,
            }),
          })
        );
      });

      it('should filter by status', async () => {
        const activeUsers = [createMockProfile({ status: UserStatus.ACTIVE })];
        configureFindManyUsers(mockPrisma, activeUsers, 1);

        await service.getUsers({ status: UserStatus.ACTIVE });

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: UserStatus.ACTIVE,
            }),
          })
        );
      });
    });

    describe('Search', () => {
      it('should search by name, email, contactName, and companyName', async () => {
        configureFindManyUsers(mockPrisma, [], 0);

        await service.getUsers({ search: 'test' });

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [
                { name: { contains: 'test', mode: 'insensitive' } },
                { email: { contains: 'test', mode: 'insensitive' } },
                { contactName: { contains: 'test', mode: 'insensitive' } },
                { companyName: { contains: 'test', mode: 'insensitive' } },
              ],
            }),
          })
        );
      });
    });

    describe('Pagination', () => {
      it('should use default pagination values', async () => {
        configureFindManyUsers(mockPrisma, [], 0);

        const result = await service.getUsers();

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 0,
            take: 10,
          })
        );
        expect(result.pagination.page).toBe(1);
        expect(result.pagination.limit).toBe(10);
      });

      it('should calculate skip value for pagination', async () => {
        configureFindManyUsers(mockPrisma, [], 100);

        await service.getUsers({ page: 3, limit: 20 });

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 40, // (3 - 1) * 20
            take: 20,
          })
        );
      });

      it('should calculate pagination metadata correctly', async () => {
        const users = Array.from({ length: 10 }, (_, i) =>
          createMockProfile({ id: `user-${i}` })
        );
        configureFindManyUsers(mockPrisma, users, 45);

        const result = await service.getUsers({ page: 2, limit: 10 });

        expect(result.pagination).toEqual({
          page: 2,
          limit: 10,
          totalCount: 45,
          totalPages: 5,
          hasNextPage: true,
          hasPrevPage: true,
        });
      });

      it('should handle last page correctly', async () => {
        const users = Array.from({ length: 5 }, (_, i) =>
          createMockProfile({ id: `user-${i}` })
        );
        configureFindManyUsers(mockPrisma, users, 45);

        const result = await service.getUsers({ page: 5, limit: 10 });

        expect(result.pagination.hasNextPage).toBe(false);
        expect(result.pagination.hasPrevPage).toBe(true);
      });

      it('should handle first page correctly', async () => {
        configureFindManyUsers(mockPrisma, [], 45);

        const result = await service.getUsers({ page: 1, limit: 10 });

        expect(result.pagination.hasPrevPage).toBe(false);
      });
    });

    describe('Sorting', () => {
      it('should use default sorting (createdAt desc)', async () => {
        configureFindManyUsers(mockPrisma, [], 0);

        await service.getUsers();

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { createdAt: 'desc' },
          })
        );
      });

      it('should apply custom sorting', async () => {
        configureFindManyUsers(mockPrisma, [], 0);

        await service.getUsers({ sortField: 'name', sortOrder: 'asc' });

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { name: 'asc' },
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should rethrow database errors', async () => {
        mockPrisma.profile.findMany.mockRejectedValue(new Error('Database error'));

        await expect(service.getUsers()).rejects.toThrow('Database error');
      });
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const user = createMockProfile({ id: 'user-123' });
      mockPrisma.profile.findUnique.mockResolvedValue(user);

      const result = await service.getUserById('user-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-123');
    });

    it('should return null when user not found', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getUserById('nonexistent');

      expect(result).toBeNull();
    });

    it('should exclude soft-deleted by default', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      await service.getUserById('user-123');

      expect(mockPrisma.profile.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'user-123',
          deletedAt: null,
        },
        select: expect.any(Object),
      });
    });

    it('should include deleted when specified', async () => {
      const deletedUser = createMockDeletedProfile({ id: 'user-123' });
      mockPrisma.profile.findUnique.mockResolvedValue(deletedUser);

      const result = await service.getUserById('user-123', true);

      expect(mockPrisma.profile.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: expect.any(Object),
      });
      expect(result).not.toBeNull();
    });
  });

  describe('getUsersByType', () => {
    it('should return users of specified type', async () => {
      const drivers = [
        createMockDriver({ id: 'driver-1' }),
        createMockDriver({ id: 'driver-2' }),
      ];
      mockPrisma.profile.findMany.mockResolvedValue(drivers);

      const result = await service.getUsersByType(UserType.DRIVER);

      expect(result).toHaveLength(2);
      expect(mockPrisma.profile.findMany).toHaveBeenCalledWith({
        where: {
          type: UserType.DRIVER,
          deletedAt: null,
        },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should exclude soft-deleted by default', async () => {
      mockPrisma.profile.findMany.mockResolvedValue([]);

      await service.getUsersByType(UserType.CLIENT);

      expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });

    it('should include deleted when specified', async () => {
      mockPrisma.profile.findMany.mockResolvedValue([]);

      await service.getUsersByType(UserType.CLIENT, true);

      const whereClause = mockPrisma.profile.findMany.mock.calls[0][0].where;
      expect(whereClause.deletedAt).toBeUndefined();
    });
  });

  describe('getActiveUsersCount', () => {
    it('should return count of non-deleted users', async () => {
      mockPrisma.profile.count.mockResolvedValue(150);

      const result = await service.getActiveUsersCount();

      expect(result).toBe(150);
      expect(mockPrisma.profile.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    });
  });

  describe('getDeletedUsersCount', () => {
    it('should return count of soft-deleted users', async () => {
      mockPrisma.profile.count.mockResolvedValue(25);

      const result = await service.getDeletedUsersCount();

      expect(result).toBe(25);
      expect(mockPrisma.profile.count).toHaveBeenCalledWith({
        where: { deletedAt: { not: null } },
      });
    });
  });

  describe('searchUsers', () => {
    it('should search across multiple fields', async () => {
      const matchingUsers = [
        createMockProfile({ name: 'John Smith' }),
        createMockProfile({ email: 'john@example.com' }),
      ];
      mockPrisma.profile.findMany.mockResolvedValue(matchingUsers);

      const result = await service.searchUsers('john');

      expect(result).toHaveLength(2);
      expect(mockPrisma.profile.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } },
            { contactName: { contains: 'john', mode: 'insensitive' } },
            { companyName: { contains: 'john', mode: 'insensitive' } },
          ],
          deletedAt: null,
        },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });

    it('should respect limit parameter', async () => {
      mockPrisma.profile.findMany.mockResolvedValue([]);

      await service.searchUsers('test', false, 25);

      expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
        })
      );
    });

    it('should include deleted users when specified', async () => {
      mockPrisma.profile.findMany.mockResolvedValue([]);

      await service.searchUsers('test', true);

      const whereClause = mockPrisma.profile.findMany.mock.calls[0][0].where;
      expect(whereClause.deletedAt).toBeUndefined();
    });
  });

  describe('isUserActive', () => {
    it('should return true for active user', async () => {
      const activeUser = createMockProfile({ id: 'user-123', deletedAt: null });
      mockPrisma.profile.findUnique.mockResolvedValue(activeUser);

      const result = await service.isUserActive('user-123');

      expect(result).toBe(true);
    });

    it('should return false for soft-deleted user', async () => {
      const deletedUser = createMockDeletedProfile({ id: 'user-123' });
      mockPrisma.profile.findUnique.mockResolvedValue(deletedUser);

      const result = await service.isUserActive('user-123');

      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.isUserActive('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getUserStatistics', () => {
    it('should return comprehensive user statistics', async () => {
      mockPrisma.profile.count
        .mockResolvedValueOnce(200) // totalUsers
        .mockResolvedValueOnce(175) // activeUsers
        .mockResolvedValueOnce(25); // deletedUsers

      mockPrisma.profile.groupBy
        .mockResolvedValueOnce([
          { type: UserType.CLIENT, _count: { type: 100 } },
          { type: UserType.VENDOR, _count: { type: 50 } },
          { type: UserType.DRIVER, _count: { type: 25 } },
        ])
        .mockResolvedValueOnce([
          { status: UserStatus.ACTIVE, _count: { status: 170 } },
          { status: UserStatus.PENDING, _count: { status: 5 } },
        ]);

      const result = await service.getUserStatistics();

      expect(result.totalUsers).toBe(200);
      expect(result.activeUsers).toBe(175);
      expect(result.deletedUsers).toBe(25);
      expect(result.usersByType).toEqual({
        CLIENT: 100,
        VENDOR: 50,
        DRIVER: 25,
      });
      expect(result.usersByStatus).toEqual({
        ACTIVE: 170,
        PENDING: 5,
      });
    });

    it('should exclude deleted users from type and status aggregations', async () => {
      mockPrisma.profile.count.mockResolvedValue(0);
      mockPrisma.profile.groupBy.mockResolvedValue([]);

      await service.getUserStatistics();

      // Both groupBy calls should filter out deleted users
      expect(mockPrisma.profile.groupBy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { deletedAt: null },
        })
      );
      expect(mockPrisma.profile.groupBy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { deletedAt: null },
        })
      );
    });
  });
});
