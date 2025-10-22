// src/__tests__/api/admin/upload-errors.test.ts

import { GET, DELETE } from '@/app/api/admin/upload-errors/route';
import { prisma } from '@/utils/prismaDB';
import {
  createGetRequest,
  createDeleteRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    uploadError: {
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe('GET/DELETE /api/admin/upload-errors - Upload Error Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/upload-errors - List Upload Errors', () => {
    describe('✅ Successful Retrieval', () => {
      it('should return all upload errors with default pagination', async () => {
        const mockErrors = [
          {
            id: 'error-1',
            correlationId: 'corr-1',
            errorType: 'NETWORK_ERROR',
            message: 'Network timeout',
            userMessage: 'Upload failed',
            details: '{"extra":"info"}',
            userId: 'user-1',
            timestamp: new Date('2025-10-22T10:00:00Z'),
            retryable: true,
            resolved: false,
          },
          {
            id: 'error-2',
            correlationId: 'corr-2',
            errorType: 'VALIDATION_ERROR',
            message: 'Invalid file type',
            userMessage: 'File not supported',
            details: null,
            userId: 'user-2',
            timestamp: new Date('2025-10-22T09:00:00Z'),
            retryable: false,
            resolved: true,
          },
        ];

        (prisma.uploadError.findMany as jest.Mock).mockResolvedValue(mockErrors);
        (prisma.uploadError.count as jest.Mock).mockResolvedValue(2);

        const request = createGetRequest('http://localhost:3000/api/admin/upload-errors');
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.errors).toHaveLength(2);
        expect(data.errors[0]).toMatchObject({
          id: 'error-1',
          errorType: 'NETWORK_ERROR',
          retryable: true,
          resolved: false,
        });
        expect(data.errors[0].details).toEqual({ extra: 'info' });
        expect(data.pagination).toEqual({
          total: 2,
          limit: 50,
          offset: 0,
          hasMore: false,
        });
      });

      it('should filter by errorType', async () => {
        (prisma.uploadError.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.uploadError.count as jest.Mock).mockResolvedValue(0);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/upload-errors?errorType=NETWORK_ERROR'
        );
        await GET(request);

        expect(prisma.uploadError.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { errorType: 'NETWORK_ERROR' },
          })
        );
      });

      it('should filter by retryable status', async () => {
        (prisma.uploadError.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.uploadError.count as jest.Mock).mockResolvedValue(0);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/upload-errors?retryable=true'
        );
        await GET(request);

        expect(prisma.uploadError.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { retryable: true },
          })
        );
      });

      it('should filter by resolved status', async () => {
        (prisma.uploadError.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.uploadError.count as jest.Mock).mockResolvedValue(0);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/upload-errors?resolved=false'
        );
        await GET(request);

        expect(prisma.uploadError.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { resolved: false },
          })
        );
      });

      it('should filter by 24h dateRange', async () => {
        (prisma.uploadError.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.uploadError.count as jest.Mock).mockResolvedValue(0);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/upload-errors?dateRange=24h'
        );
        await GET(request);

        const callArg = (prisma.uploadError.findMany as jest.Mock).mock.calls[0][0];
        expect(callArg.where.timestamp).toBeDefined();
        expect(callArg.where.timestamp.gte).toBeDefined();
      });

      it('should filter by 7d dateRange', async () => {
        (prisma.uploadError.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.uploadError.count as jest.Mock).mockResolvedValue(0);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/upload-errors?dateRange=7d'
        );
        await GET(request);

        const callArg = (prisma.uploadError.findMany as jest.Mock).mock.calls[0][0];
        expect(callArg.where.timestamp).toBeDefined();
      });

      it('should filter by 30d dateRange', async () => {
        (prisma.uploadError.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.uploadError.count as jest.Mock).mockResolvedValue(0);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/upload-errors?dateRange=30d'
        );
        await GET(request);

        const callArg = (prisma.uploadError.findMany as jest.Mock).mock.calls[0][0];
        expect(callArg.where.timestamp).toBeDefined();
      });

      it('should support custom limit and offset', async () => {
        (prisma.uploadError.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.uploadError.count as jest.Mock).mockResolvedValue(100);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/upload-errors?limit=10&offset=20'
        );
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(prisma.uploadError.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 10,
            skip: 20,
          })
        );
        expect(data.pagination).toEqual({
          total: 100,
          limit: 10,
          offset: 20,
          hasMore: true,
        });
      });

      it('should combine multiple filters', async () => {
        (prisma.uploadError.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.uploadError.count as jest.Mock).mockResolvedValue(0);

        const request = createGetRequest(
          'http://localhost:3000/api/admin/upload-errors?errorType=NETWORK_ERROR&retryable=true&resolved=false&dateRange=7d'
        );
        await GET(request);

        const callArg = (prisma.uploadError.findMany as jest.Mock).mock.calls[0][0];
        expect(callArg.where.errorType).toBe('NETWORK_ERROR');
        expect(callArg.where.retryable).toBe(true);
        expect(callArg.where.resolved).toBe(false);
        expect(callArg.where.timestamp).toBeDefined();
      });

      it('should handle null details field', async () => {
        const mockErrors = [
          {
            id: 'error-1',
            correlationId: 'corr-1',
            errorType: 'ERROR',
            message: 'Test',
            userMessage: 'Test',
            details: null,
            userId: 'user-1',
            timestamp: new Date(),
            retryable: false,
            resolved: false,
          },
        ];

        (prisma.uploadError.findMany as jest.Mock).mockResolvedValue(mockErrors);
        (prisma.uploadError.count as jest.Mock).mockResolvedValue(1);

        const request = createGetRequest('http://localhost:3000/api/admin/upload-errors');
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.errors[0].details).toBeNull();
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle database query errors', async () => {
        (prisma.uploadError.findMany as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = createGetRequest('http://localhost:3000/api/admin/upload-errors');
        const response = await GET(request);
        await expectErrorResponse(response, 500, /Failed to fetch upload errors/i);
      });

      it('should handle count query errors', async () => {
        (prisma.uploadError.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.uploadError.count as jest.Mock).mockRejectedValue(
          new Error('Count failed')
        );

        const request = createGetRequest('http://localhost:3000/api/admin/upload-errors');
        const response = await GET(request);
        await expectErrorResponse(response, 500);
      });
    });

    describe('📊 Edge Cases', () => {
      it('should handle empty results', async () => {
        (prisma.uploadError.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.uploadError.count as jest.Mock).mockResolvedValue(0);

        const request = createGetRequest('http://localhost:3000/api/admin/upload-errors');
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.errors).toHaveLength(0);
        expect(data.pagination.total).toBe(0);
        expect(data.pagination.hasMore).toBe(false);
      });
    });
  });

  describe('DELETE /api/admin/upload-errors - Delete Upload Errors', () => {
    describe('✅ Successful Deletion', () => {
      it('should delete specific error by errorId', async () => {
        (prisma.uploadError.delete as jest.Mock).mockResolvedValue({
          id: 'error-1',
        });

        const request = createDeleteRequest(
          'http://localhost:3000/api/admin/upload-errors?errorId=error-1'
        );
        const response = await DELETE(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.deleted).toBe(1);
        expect(prisma.uploadError.delete).toHaveBeenCalledWith({
          where: { id: 'error-1' },
        });
      });

      it('should delete all resolved errors', async () => {
        (prisma.uploadError.deleteMany as jest.Mock).mockResolvedValue({
          count: 15,
        });

        const request = createDeleteRequest(
          'http://localhost:3000/api/admin/upload-errors?allResolved=true'
        );
        const response = await DELETE(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.deleted).toBe(15);
        expect(prisma.uploadError.deleteMany).toHaveBeenCalledWith({
          where: { resolved: true },
        });
      });

      it('should delete 0 resolved errors if none exist', async () => {
        (prisma.uploadError.deleteMany as jest.Mock).mockResolvedValue({
          count: 0,
        });

        const request = createDeleteRequest(
          'http://localhost:3000/api/admin/upload-errors?allResolved=true'
        );
        const response = await DELETE(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.deleted).toBe(0);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 when neither errorId nor allResolved is provided', async () => {
        const request = createDeleteRequest(
          'http://localhost:3000/api/admin/upload-errors'
        );
        const response = await DELETE(request);
        await expectErrorResponse(
          response,
          400,
          /Either errorId or allResolved=true is required/i
        );
      });

      it('should prioritize allResolved over errorId', async () => {
        (prisma.uploadError.deleteMany as jest.Mock).mockResolvedValue({
          count: 5,
        });

        const request = createDeleteRequest(
          'http://localhost:3000/api/admin/upload-errors?errorId=error-1&allResolved=true'
        );
        await DELETE(request);

        expect(prisma.uploadError.deleteMany).toHaveBeenCalled();
        expect(prisma.uploadError.delete).not.toHaveBeenCalled();
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle deletion errors for specific error', async () => {
        (prisma.uploadError.delete as jest.Mock).mockRejectedValue(
          new Error('Deletion failed')
        );

        const request = createDeleteRequest(
          'http://localhost:3000/api/admin/upload-errors?errorId=error-1'
        );
        const response = await DELETE(request);
        await expectErrorResponse(response, 500, /Failed to delete upload errors/i);
      });

      it('should handle deletion errors for bulk delete', async () => {
        (prisma.uploadError.deleteMany as jest.Mock).mockRejectedValue(
          new Error('Bulk deletion failed')
        );

        const request = createDeleteRequest(
          'http://localhost:3000/api/admin/upload-errors?allResolved=true'
        );
        const response = await DELETE(request);
        await expectErrorResponse(response, 500);
      });
    });
  });
});
