/**
 * Comprehensive Unit Tests for UserSoftDeleteService
 *
 * Tests soft delete, restore, permanent delete, and query operations
 * with properly mocked Prisma client.
 *
 * Part of REA-315: Service Layer Unit Tests
 */

import { UserSoftDeleteService } from '@/services/userSoftDeleteService';
import { UserType, UserStatus } from '@/types/prisma';
import {
  createMockProfile,
  createMockDeletedProfile,
  createMockSuperAdmin,
  createMockAddress,
  createMockDispatch,
  createMockFileUpload,
  resetIdCounter,
} from '../helpers/mock-data-factories';
import {
  configureUserExists,
  configureUserNotFound,
  configureUserAlreadyDeleted,
  configureUserWithActiveOrders,
  configureUserWithoutActiveOrders,
  configureSuccessfulTransaction,
  configureTransactionFailure,
  configureProfileUpdateSuccess,
  configureAuditLogSuccess,
  configureFindManyUsers,
  expectTransactionCalled,
  expectAuditLogCreated,
  expectSoftDeleteApplied,
  expectRestoreApplied,
  resetAllMocks,
} from '../helpers/service-test-utils';
import { MockPrismaClient, createMockPrismaClient, resetPrismaMocks } from '../helpers/prisma-mock-helpers';

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
const mockPrisma = prisma as unknown as MockPrismaClient;

describe('UserSoftDeleteService', () => {
  let service: UserSoftDeleteService;

  beforeEach(() => {
    service = new UserSoftDeleteService();
    resetPrismaMocks(mockPrisma);
    resetIdCounter();
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should create an instance of UserSoftDeleteService', () => {
      expect(service).toBeInstanceOf(UserSoftDeleteService);
    });

    it('should have all required methods', () => {
      expect(typeof service.softDeleteUser).toBe('function');
      expect(typeof service.restoreUser).toBe('function');
      expect(typeof service.permanentlyDeleteUser).toBe('function');
      expect(typeof service.getDeletedUsers).toBe('function');
    });
  });

  describe('softDeleteUser', () => {
    describe('Validation', () => {
      it('should throw error when user not found', async () => {
        configureUserNotFound(mockPrisma);

        await expect(
          service.softDeleteUser('nonexistent-user', 'admin-123', 'Test reason')
        ).rejects.toThrow('User not found');
      });

      it('should throw error when user is already soft deleted', async () => {
        configureUserAlreadyDeleted(mockPrisma);

        await expect(
          service.softDeleteUser('user-123', 'admin-123', 'Test reason')
        ).rejects.toThrow('User is already soft deleted');
      });

      it('should throw error when user has active orders', async () => {
        const user = configureUserExists(mockPrisma, { id: 'user-123' });
        configureUserWithActiveOrders(mockPrisma, 2, 1);

        await expect(
          service.softDeleteUser('user-123', 'admin-123', 'Test reason')
        ).rejects.toThrow('Cannot delete user with active orders');
      });
    });

    describe('Success Scenarios', () => {
      it('should successfully soft delete user without active orders', async () => {
        const userId = 'user-123';
        const deletedBy = 'admin-456';
        const reason = 'User requested deletion';

        const user = configureUserExists(mockPrisma, { id: userId });
        configureUserWithoutActiveOrders(mockPrisma);
        configureSuccessfulTransaction(mockPrisma);

        const now = new Date();
        mockPrisma.profile.update.mockResolvedValue({
          ...user,
          deletedAt: now,
          deletedBy,
          deletionReason: reason,
        });
        configureAuditLogSuccess(mockPrisma);

        const result = await service.softDeleteUser(userId, deletedBy, reason);

        expect(result.success).toBe(true);
        expect(result.userId).toBe(userId);
        expect(result.deletedBy).toBe(deletedBy);
        expect(result.deletionReason).toBe(reason);
        expect(result.deletedAt).toBeDefined();
        expect(result.message).toBe('User soft deleted successfully');
      });

      it('should soft delete user without reason', async () => {
        const userId = 'user-123';
        const deletedBy = 'admin-456';

        configureUserExists(mockPrisma, { id: userId });
        configureUserWithoutActiveOrders(mockPrisma);
        configureSuccessfulTransaction(mockPrisma);

        mockPrisma.profile.update.mockResolvedValue({
          id: userId,
          deletedAt: new Date(),
          deletedBy,
          deletionReason: null,
        });
        configureAuditLogSuccess(mockPrisma);

        const result = await service.softDeleteUser(userId, deletedBy);

        expect(result.success).toBe(true);
        expect(result.deletionReason).toBeUndefined();
      });
    });

    describe('Transaction Behavior', () => {
      it('should use transaction for soft delete operation', async () => {
        const userId = 'user-123';

        configureUserExists(mockPrisma, { id: userId });
        configureUserWithoutActiveOrders(mockPrisma);
        configureSuccessfulTransaction(mockPrisma);

        mockPrisma.profile.update.mockResolvedValue({
          id: userId,
          deletedAt: new Date(),
          deletedBy: 'admin-123',
          deletionReason: null,
        });
        configureAuditLogSuccess(mockPrisma);

        await service.softDeleteUser(userId, 'admin-123');

        expectTransactionCalled(mockPrisma);
      });

      it('should create audit log entry during soft delete', async () => {
        const userId = 'user-123';

        configureUserExists(mockPrisma, { id: userId });
        configureUserWithoutActiveOrders(mockPrisma);
        configureSuccessfulTransaction(mockPrisma);

        mockPrisma.profile.update.mockResolvedValue({
          id: userId,
          deletedAt: new Date(),
          deletedBy: 'admin-123',
          deletionReason: 'Test',
        });
        configureAuditLogSuccess(mockPrisma);

        await service.softDeleteUser(userId, 'admin-123', 'Test');

        expect(mockPrisma.userAudit.create).toHaveBeenCalled();
        const auditCall = mockPrisma.userAudit.create.mock.calls[0][0];
        expect(auditCall.data.action).toBe('SOFT_DELETE');
        expect(auditCall.data.userId).toBe(userId);
      });

      it('should rollback on transaction failure', async () => {
        const userId = 'user-123';

        configureUserExists(mockPrisma, { id: userId });
        configureUserWithoutActiveOrders(mockPrisma);
        configureTransactionFailure(mockPrisma, new Error('Transaction failed'));

        await expect(
          service.softDeleteUser(userId, 'admin-123')
        ).rejects.toThrow('Transaction failed');
      });
    });
  });

  describe('restoreUser', () => {
    describe('Validation', () => {
      it('should throw error when user not found', async () => {
        configureUserNotFound(mockPrisma);

        await expect(
          service.restoreUser('nonexistent-user', 'admin-123')
        ).rejects.toThrow('User not found');
      });

      it('should throw error when user is not soft deleted', async () => {
        configureUserExists(mockPrisma, { id: 'user-123', deletedAt: null });

        await expect(
          service.restoreUser('user-123', 'admin-123')
        ).rejects.toThrow('User is not soft deleted');
      });
    });

    describe('Success Scenarios', () => {
      it('should successfully restore a soft-deleted user', async () => {
        const userId = 'user-123';
        const restoredBy = 'admin-456';

        const deletedUser = configureUserAlreadyDeleted(mockPrisma, { id: userId });
        configureSuccessfulTransaction(mockPrisma);

        mockPrisma.profile.update.mockResolvedValue({
          ...deletedUser,
          deletedAt: null,
          deletedBy: null,
          deletionReason: null,
        });
        configureAuditLogSuccess(mockPrisma);

        const result = await service.restoreUser(userId, restoredBy);

        expect(result.success).toBe(true);
        expect(result.userId).toBe(userId);
        expect(result.restoredBy).toBe(restoredBy);
        expect(result.restoredAt).toBeDefined();
        expect(result.message).toBe('User restored successfully');
      });
    });

    describe('Transaction Behavior', () => {
      it('should use transaction for restore operation', async () => {
        const userId = 'user-123';

        configureUserAlreadyDeleted(mockPrisma, { id: userId });
        configureSuccessfulTransaction(mockPrisma);

        mockPrisma.profile.update.mockResolvedValue({
          id: userId,
          deletedAt: null,
          deletedBy: null,
          deletionReason: null,
        });
        configureAuditLogSuccess(mockPrisma);

        await service.restoreUser(userId, 'admin-123');

        expectTransactionCalled(mockPrisma);
      });

      it('should create RESTORE audit log entry', async () => {
        const userId = 'user-123';

        configureUserAlreadyDeleted(mockPrisma, { id: userId });
        configureSuccessfulTransaction(mockPrisma);

        mockPrisma.profile.update.mockResolvedValue({
          id: userId,
          deletedAt: null,
          deletedBy: null,
          deletionReason: null,
        });
        configureAuditLogSuccess(mockPrisma);

        await service.restoreUser(userId, 'admin-123');

        expect(mockPrisma.userAudit.create).toHaveBeenCalled();
        const auditCall = mockPrisma.userAudit.create.mock.calls[0][0];
        expect(auditCall.data.action).toBe('RESTORE');
      });
    });
  });

  describe('permanentlyDeleteUser', () => {
    describe('Validation', () => {
      it('should throw error when user not found', async () => {
        configureUserNotFound(mockPrisma);

        await expect(
          service.permanentlyDeleteUser('nonexistent-user')
        ).rejects.toThrow('User not found');
      });

      it('should throw error when user is not soft deleted', async () => {
        configureUserExists(mockPrisma, { id: 'user-123', deletedAt: null });

        await expect(
          service.permanentlyDeleteUser('user-123')
        ).rejects.toThrow('User must be soft deleted before permanent deletion');
      });

      it('should throw error when trying to delete SUPER_ADMIN', async () => {
        const superAdmin = createMockDeletedProfile({
          id: 'admin-123',
          type: UserType.SUPER_ADMIN,
        });
        mockPrisma.profile.findUnique.mockResolvedValue(superAdmin);

        await expect(
          service.permanentlyDeleteUser('admin-123')
        ).rejects.toThrow('Super Admin users cannot be permanently deleted');
      });
    });

    describe('Cascade Deletion', () => {
      it('should delete dispatches for the user', async () => {
        const userId = 'user-123';

        configureUserAlreadyDeleted(mockPrisma, { id: userId, type: UserType.CLIENT });
        configureSuccessfulTransaction(mockPrisma);

        mockPrisma.dispatch.deleteMany.mockResolvedValue({ count: 3 });
        mockPrisma.fileUpload.updateMany.mockResolvedValue({ count: 2 });
        mockPrisma.address.findMany.mockResolvedValue([]);
        mockPrisma.profile.delete.mockResolvedValue({ id: userId });
        configureAuditLogSuccess(mockPrisma);

        const result = await service.permanentlyDeleteUser(userId);

        expect(result.success).toBe(true);
        expect(result.affectedRecords.dispatchesDeleted).toBe(3);
      });

      it('should update file uploads to null userId', async () => {
        const userId = 'user-123';

        configureUserAlreadyDeleted(mockPrisma, { id: userId, type: UserType.CLIENT });
        configureSuccessfulTransaction(mockPrisma);

        mockPrisma.dispatch.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.fileUpload.updateMany.mockResolvedValue({ count: 5 });
        mockPrisma.address.findMany.mockResolvedValue([]);
        mockPrisma.profile.delete.mockResolvedValue({ id: userId });
        configureAuditLogSuccess(mockPrisma);

        const result = await service.permanentlyDeleteUser(userId);

        expect(result.affectedRecords.fileUploadsUpdated).toBe(5);
      });

      it('should handle addresses correctly', async () => {
        const userId = 'user-123';

        configureUserAlreadyDeleted(mockPrisma, { id: userId, type: UserType.VENDOR });
        configureSuccessfulTransaction(mockPrisma);

        // Simulate two addresses: one can be deleted, one needs update
        const addressToDelete = createMockAddress({
          id: 'addr-1',
          createdBy: userId,
        });
        const addressToUpdate = createMockAddress({
          id: 'addr-2',
          createdBy: userId,
        });

        mockPrisma.dispatch.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.fileUpload.updateMany.mockResolvedValue({ count: 0 });
        mockPrisma.address.findMany.mockResolvedValue([
          {
            ...addressToDelete,
            userAddresses: [],
            cateringPickupRequests: [],
            cateringDeliveryRequests: [],
            onDemandPickupRequests: [],
            onDemandDeliveryRequests: [],
          },
          {
            ...addressToUpdate,
            userAddresses: [{ userId: 'other-user' }],
            cateringPickupRequests: [],
            cateringDeliveryRequests: [],
            onDemandPickupRequests: [],
            onDemandDeliveryRequests: [],
          },
        ]);
        mockPrisma.address.delete.mockResolvedValue(addressToDelete);
        mockPrisma.address.update.mockResolvedValue(addressToUpdate);
        mockPrisma.profile.delete.mockResolvedValue({ id: userId });
        configureAuditLogSuccess(mockPrisma);

        const result = await service.permanentlyDeleteUser(userId);

        expect(result.success).toBe(true);
        expect(result.affectedRecords.addressesDeleted).toBe(1);
        expect(result.affectedRecords.addressesUpdated).toBe(1);
      });
    });

    describe('Transaction Behavior', () => {
      it('should create PERMANENT_DELETE audit log entry', async () => {
        const userId = 'user-123';

        configureUserAlreadyDeleted(mockPrisma, { id: userId, type: UserType.DRIVER });
        configureSuccessfulTransaction(mockPrisma);

        mockPrisma.dispatch.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.fileUpload.updateMany.mockResolvedValue({ count: 0 });
        mockPrisma.address.findMany.mockResolvedValue([]);
        mockPrisma.profile.delete.mockResolvedValue({ id: userId });
        configureAuditLogSuccess(mockPrisma);

        await service.permanentlyDeleteUser(userId);

        expect(mockPrisma.userAudit.create).toHaveBeenCalled();
        const auditCall = mockPrisma.userAudit.create.mock.calls[0][0];
        expect(auditCall.data.action).toBe('PERMANENT_DELETE');
      });
    });
  });

  describe('getDeletedUsers', () => {
    describe('Filtering', () => {
      it('should return only soft-deleted users', async () => {
        const deletedUsers = [
          createMockDeletedProfile({ id: 'user-1' }),
          createMockDeletedProfile({ id: 'user-2' }),
        ];

        configureFindManyUsers(mockPrisma, deletedUsers, 2);

        const result = await service.getDeletedUsers();

        expect(result.users).toHaveLength(2);
        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              deletedAt: { not: null },
            }),
          })
        );
      });

      it('should filter by user type', async () => {
        const deletedDrivers = [
          createMockDeletedProfile({ id: 'driver-1', type: UserType.DRIVER }),
        ];

        configureFindManyUsers(mockPrisma, deletedDrivers, 1);

        const result = await service.getDeletedUsers({ type: UserType.DRIVER });

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              type: UserType.DRIVER,
            }),
          })
        );
      });

      it('should filter by deletedBy', async () => {
        configureFindManyUsers(mockPrisma, [], 0);

        await service.getDeletedUsers({ deletedBy: 'admin-123' });

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              deletedBy: 'admin-123',
            }),
          })
        );
      });

      it('should filter by date range', async () => {
        const deletedAfter = new Date('2024-01-01');
        const deletedBefore = new Date('2024-12-31');

        configureFindManyUsers(mockPrisma, [], 0);

        await service.getDeletedUsers({ deletedAfter, deletedBefore });

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              deletedAt: expect.objectContaining({
                gte: deletedAfter,
                lte: deletedBefore,
              }),
            }),
          })
        );
      });
    });

    describe('Pagination', () => {
      it('should return paginated results', async () => {
        const users = Array.from({ length: 10 }, (_, i) =>
          createMockDeletedProfile({ id: `user-${i}` })
        );

        configureFindManyUsers(mockPrisma, users.slice(0, 5), 25);

        const result = await service.getDeletedUsers({ page: 1, limit: 5 });

        expect(result.pagination.page).toBe(1);
        expect(result.pagination.limit).toBe(5);
        expect(result.pagination.totalCount).toBe(25);
        expect(result.pagination.totalPages).toBe(5);
        expect(result.pagination.hasNextPage).toBe(true);
        expect(result.pagination.hasPrevPage).toBe(false);
      });

      it('should calculate hasNextPage correctly', async () => {
        configureFindManyUsers(mockPrisma, [], 20);

        const result = await service.getDeletedUsers({ page: 2, limit: 10 });

        expect(result.pagination.hasNextPage).toBe(false);
        expect(result.pagination.hasPrevPage).toBe(true);
      });
    });

    describe('Search', () => {
      it('should search by name, email, contactName, and companyName', async () => {
        configureFindManyUsers(mockPrisma, [], 0);

        await service.getDeletedUsers({ search: 'john' });

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                { name: { contains: 'john', mode: 'insensitive' } },
                { email: { contains: 'john', mode: 'insensitive' } },
                { contactName: { contains: 'john', mode: 'insensitive' } },
                { companyName: { contains: 'john', mode: 'insensitive' } },
              ]),
            }),
          })
        );
      });
    });
  });
});
