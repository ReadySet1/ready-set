import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/users/[userId]/route';
import { UserType } from '@/types/prisma';

// Mock the Prisma module
jest.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code: string;
      clientVersion: string;
      meta?: any;
      
      constructor(message: string, { code, clientVersion, meta }: { code: string; clientVersion: string; meta?: any }) {
        super(message);
        this.name = 'PrismaClientKnownRequestError';
        this.code = code;
        this.clientVersion = clientVersion;
        this.meta = meta;
      }
    },
  },
}));

// Import after mocking
import { Prisma } from '@prisma/client';

// Mocks
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
};

jest.mock('@/utils/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}));

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
    },
    cateringRequest: {
      count: jest.fn(),
    },
    onDemand: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
    dispatch: {
      deleteMany: jest.fn(),
    },
    fileUpload: {
      updateMany: jest.fn(),
    },
    address: {
      findMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '@/utils/prismaDB';

// Test helpers
const createRequest = (userId: string): NextRequest => {
  return new Request(`http://localhost:3000/api/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'x-forwarded-for': '127.0.0.1',
      'user-agent': 'test-agent'
    }
  }) as NextRequest;
};

const mockAuthenticatedUser = (userId: string, userType: UserType = UserType.ADMIN) => {
  (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
  
  (prisma.profile.findUnique as jest.Mock).mockResolvedValueOnce({
    type: userType,
  });
};

const mockTargetUser = (userId: string, userType: UserType = UserType.VENDOR, email: string = 'target@example.com') => {
  (prisma.profile.findUnique as jest.Mock).mockResolvedValueOnce({
    type: userType,
    email: email,
  });
};

const mockNoActiveOrders = () => {
  (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);
  (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);
};

const mockActiveOrders = (cateringCount: number = 1, onDemandCount: number = 1) => {
  (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(cateringCount);
  (prisma.onDemand.count as jest.Mock).mockResolvedValue(onDemandCount);
};

describe('/api/users/[userId] DELETE API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('🔐 Authorization Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = createRequest('target-user-id');
      const res = await DELETE(req);
      
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized: Authentication required');
    });

    it('should allow ADMIN to delete users', async () => {
      mockAuthenticatedUser('admin-id', UserType.ADMIN);
      mockTargetUser('target-id', UserType.VENDOR);
      mockNoActiveOrders();

      // Mock successful deletion transaction
      (prisma.$transaction as jest.Mock).mockResolvedValue({
        deletedProfile: { id: 'target-id' },
        deletedDispatches: 0,
        updatedFileUploads: 0,
        deletedAddresses: 0,
        updatedAddresses: 0,
        totalAddressesProcessed: 0,
      });

      const req = createRequest('target-id');
      const res = await DELETE(req);
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('User and associated data deleted successfully');
    });

    it('should allow SUPER_ADMIN to delete users', async () => {
      mockAuthenticatedUser('superadmin-id', UserType.SUPER_ADMIN);
      mockTargetUser('target-id', UserType.VENDOR);
      mockNoActiveOrders();

      (prisma.$transaction as jest.Mock).mockResolvedValue({
        deletedProfile: { id: 'target-id' },
        deletedDispatches: 0,
        updatedFileUploads: 0,
        deletedAddresses: 0,
        updatedAddresses: 0,
        totalAddressesProcessed: 0,
      });

      const req = createRequest('target-id');
      const res = await DELETE(req);
      
      expect(res.status).toBe(200);
    });

    it('should deny HELPDESK from deleting users', async () => {
      mockAuthenticatedUser('helpdesk-id', UserType.HELPDESK);

      const req = createRequest('target-id');
      const res = await DELETE(req);
      
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden: Only Admin or Super Admin can delete users');
    });

    it('should deny VENDOR from deleting users', async () => {
      mockAuthenticatedUser('vendor-id', UserType.VENDOR);

      const req = createRequest('target-id');
      const res = await DELETE(req);
      
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden: Only Admin or Super Admin can delete users');
    });

    it('should prevent deletion of SUPER_ADMIN users', async () => {
      mockAuthenticatedUser('admin-id', UserType.ADMIN);
      mockTargetUser('superadmin-target', UserType.SUPER_ADMIN);

      const req = createRequest('superadmin-target');
      const res = await DELETE(req);
      
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden: Super Admin users cannot be deleted');
    });

    it('should prevent self-deletion', async () => {
      const adminId = 'admin-id';
      mockAuthenticatedUser(adminId, UserType.ADMIN);
      mockTargetUser(adminId, UserType.ADMIN);

      const req = createRequest(adminId);
      const res = await DELETE(req);
      
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden: Cannot delete your own account');
    });
  });

  describe('🗄️ Database Integrity Tests', () => {
    beforeEach(() => {
      mockAuthenticatedUser('admin-id', UserType.ADMIN);
      mockTargetUser('target-id', UserType.VENDOR);
    });

    it('should prevent deletion when user has active catering orders', async () => {
      mockActiveOrders(2, 0); // 2 catering, 0 on-demand

      const req = createRequest('target-id');
      const res = await DELETE(req);
      
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe('Cannot delete user with active orders. Complete or cancel orders first.');
      expect(data.details).toEqual({
        activeCateringOrders: 2,
        activeOnDemandOrders: 0,
        totalActiveOrders: 2,
      });
    });

    it('should prevent deletion when user has active on-demand orders', async () => {
      mockActiveOrders(0, 3); // 0 catering, 3 on-demand

      const req = createRequest('target-id');
      const res = await DELETE(req);
      
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.details.activeOnDemandOrders).toBe(3);
      expect(data.details.totalActiveOrders).toBe(3);
    });

    it('should execute deletion transaction with all steps', async () => {
      mockNoActiveOrders();

      const mockTransactionCallback = jest.fn().mockResolvedValue({
        deletedProfile: { id: 'target-id' },
        deletedDispatches: 5,
        updatedFileUploads: 3,
        deletedAddresses: 2,
        updatedAddresses: 1,
        totalAddressesProcessed: 3,
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        // Simulate transaction operations
        const mockTx = {
          dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
          fileUpload: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
          address: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'addr1',
                userAddresses: [],
                cateringPickupRequests: [],
                cateringDeliveryRequests: [],
                onDemandPickupRequests: [],
                onDemandDeliveryRequests: [],
              },
              {
                id: 'addr2',
                userAddresses: [],
                cateringPickupRequests: [],
                cateringDeliveryRequests: [],
                onDemandPickupRequests: [],
                onDemandDeliveryRequests: [],
              },
              {
                id: 'addr3',
                userAddresses: [{ userId: 'other-user' }], // Used by another user
                cateringPickupRequests: [],
                cateringDeliveryRequests: [],
                onDemandPickupRequests: [],
                onDemandDeliveryRequests: [],
              },
            ]),
            delete: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue({}),
          },
          profile: { delete: jest.fn().mockResolvedValue({ id: 'target-id' }) },
        };
        
        return await callback(mockTx);
      });

      const req = createRequest('target-id');
      const res = await DELETE(req);
      
      expect(res.status).toBe(200);
      const data = await res.json();
      
      expect(data.summary).toMatchObject({
        deletedUser: { id: 'target-id' },
        deletedDispatches: 5,
        updatedFileUploads: 3,
        processedAddresses: 3,
        deletedAddresses: 2,
        updatedAddresses: 1,
      });

      // Verify transaction was called with timeout
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 10000 }
      );
    });

    it('should handle complex address relationships correctly', async () => {
      mockNoActiveOrders();

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          fileUpload: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          address: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'unused-addr',
                userAddresses: [], // Not used by anyone
                cateringPickupRequests: [],
                cateringDeliveryRequests: [],
                onDemandPickupRequests: [],
                onDemandDeliveryRequests: [],
              },
              {
                id: 'used-addr',
                userAddresses: [],
                cateringPickupRequests: [{ id: 'catering-1' }], // Used by catering
                cateringDeliveryRequests: [],
                onDemandPickupRequests: [],
                onDemandDeliveryRequests: [],
              },
            ]),
            delete: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue({}),
          },
          profile: { delete: jest.fn().mockResolvedValue({ id: 'target-id' }) },
        };
        
        return await callback(mockTx);
      });

      const req = createRequest('target-id');
      await DELETE(req);
      
      // Verify the transaction callback was executed
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('🚫 Edge Case Testing', () => {
    beforeEach(() => {
      mockAuthenticatedUser('admin-id', UserType.ADMIN);
    });

    it('should return 400 when userId is missing', async () => {
      const req = new Request('http://localhost:3000/api/users/', {
        method: 'DELETE',
      }) as NextRequest;

      const res = await DELETE(req);
      
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('User ID is required');
    });

    it('should return 404 when target user does not exist', async () => {
      // Setup authentication  
      (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'admin-id' } },
        error: null,
      });
      
      // Setup profile queries in sequence:
      // 1. Requester profile check
      // 2. Target user check (returns null - user doesn't exist)
      (prisma.profile.findUnique as jest.Mock)
        .mockResolvedValueOnce({ type: UserType.ADMIN }) // requester profile
        .mockResolvedValueOnce(null); // target user doesn't exist

      const req = createRequest('nonexistent-id');
      const res = await DELETE(req);
      
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('User not found');
    });

    it('should handle Prisma P2025 error (record not found)', async () => {
      mockAuthenticatedUser('admin-id', UserType.ADMIN);
      mockTargetUser('target-id', UserType.VENDOR);
      mockNoActiveOrders();

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        {
          code: 'P2025',
          clientVersion: '4.0.0',
          meta: { cause: 'Record to delete does not exist.' }
        }
      );

      (prisma.$transaction as jest.Mock).mockRejectedValue(prismaError);

      const req = createRequest('target-id');
      const res = await DELETE(req);
      
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.code).toBe('USER_NOT_FOUND');
      expect(data.error).toBe('User not found or already deleted');
    });

    it('should handle Prisma P2003 error (foreign key constraint)', async () => {
      mockAuthenticatedUser('admin-id', UserType.ADMIN);
      mockTargetUser('target-id', UserType.VENDOR);
      mockNoActiveOrders();

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '4.0.0',
          meta: { field_name: 'user_id' }
        }
      );

      (prisma.$transaction as jest.Mock).mockRejectedValue(prismaError);

      const req = createRequest('target-id');
      const res = await DELETE(req);
      
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe('FOREIGN_KEY_VIOLATION');
      expect(data.error).toBe('Cannot delete user: referenced by other records');
    });

    it('should handle database connection timeout', async () => {
      mockAuthenticatedUser('admin-id', UserType.ADMIN);
      mockTargetUser('target-id', UserType.VENDOR);
      mockNoActiveOrders();

      const timeoutError = new Error('timeout exceeded');
      (prisma.$transaction as jest.Mock).mockRejectedValue(timeoutError);

      const req = createRequest('target-id');
      const res = await DELETE(req);
      
      expect(res.status).toBe(408);
      const data = await res.json();
      expect(data.code).toBe('TRANSACTION_TIMEOUT');
      expect(data.error).toContain('timed out');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockAuthenticatedUser('admin-id', UserType.ADMIN);
      mockTargetUser('target-id', UserType.VENDOR);
      mockNoActiveOrders();

      const unexpectedError = new Error('Unexpected database error');
      (prisma.$transaction as jest.Mock).mockRejectedValue(unexpectedError);

      const req = createRequest('target-id');
      const res = await DELETE(req);
      
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.code).toBe('DELETION_FAILED');
      expect(data.error).toBe('Failed to delete user');
    });
  });

  describe('📊 Audit Trail Testing', () => {
    beforeEach(() => {
      mockAuthenticatedUser('admin-id', UserType.ADMIN);
      mockTargetUser('target-id', UserType.VENDOR, 'target@example.com');
    });

    it('should log successful deletion audit trail', async () => {
      mockNoActiveOrders();
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      (prisma.$transaction as jest.Mock).mockResolvedValue({
        deletedProfile: { id: 'target-id' },
        deletedDispatches: 2,
        updatedFileUploads: 1,
        deletedAddresses: 1,
        updatedAddresses: 0,
        totalAddressesProcessed: 1,
      });

      const req = createRequest('target-id');
      await DELETE(req);
      
      // Check if audit log was created
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AUDIT] User deletion completed:',
        expect.stringContaining('"action":"USER_DELETION"')
      );
      
      const auditCall = consoleSpy.mock.calls.find(call => 
        call[0] === '[AUDIT] User deletion completed:'
      );
      
      if (auditCall) {
        const auditData = JSON.parse(auditCall[1]);
        expect(auditData).toMatchObject({
          action: 'USER_DELETION',
          performedBy: 'admin-id',
          performedByType: UserType.ADMIN,
          targetUserId: 'target-id',
          targetUserEmail: 'target@example.com',
          targetUserType: UserType.VENDOR,
          success: true,
          affectedRecords: {
            dispatchesDeleted: 2,
            fileUploadsUpdated: 1,
            addressesDeleted: 1,
            addressesUpdated: 0,
          },
        });
      }

      consoleSpy.mockRestore();
    });

    it('should log failed deletion audit trail', async () => {
      mockAuthenticatedUser('admin-id', UserType.ADMIN);
      mockTargetUser('target-id', UserType.VENDOR, 'target@example.com');
      mockNoActiveOrders();
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const error = new Error('Database connection failed');
      (prisma.$transaction as jest.Mock).mockRejectedValue(error);

      const req = createRequest('target-id');
      await DELETE(req);
      
      // Check if failure audit log was created
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AUDIT] User deletion failed:',
        expect.stringContaining('"action":"USER_DELETION_FAILED"')
      );

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('⚡ Performance Considerations', () => {
    beforeEach(() => {
      mockAuthenticatedUser('admin-id', UserType.ADMIN);
      mockTargetUser('target-id', UserType.VENDOR);
      mockNoActiveOrders();
    });

    it('should complete deletion within reasonable time', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const mockTx = {
          dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          fileUpload: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          address: {
            findMany: jest.fn().mockResolvedValue([]),
            delete: jest.fn(),
            update: jest.fn(),
          },
          profile: { delete: jest.fn().mockResolvedValue({ id: 'target-id' }) },
        };
        
        return await callback(mockTx);
      });

      const req = createRequest('target-id');
      const startTime = Date.now();
      
      await DELETE(req);
      
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time (allowing for test overhead)
      expect(duration).toBeLessThan(5000);

      // Check if performance logging occurred
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[DELETE\] Transaction completed successfully in \d+ms/)
      );

      consoleSpy.mockRestore();
    });

    it('should use transaction timeout correctly', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue({
        deletedProfile: { id: 'target-id' },
        deletedDispatches: 0,
        updatedFileUploads: 0,
        deletedAddresses: 0,
        updatedAddresses: 0,
        totalAddressesProcessed: 0,
      });

      const req = createRequest('target-id');
      await DELETE(req);
      
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 10000 }
      );
    });
  });
});
