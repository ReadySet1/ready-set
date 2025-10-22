// src/__tests__/api/admin/upload-errors-resolve.test.ts

import { PUT } from '@/app/api/admin/upload-errors/[id]/resolve/route';
import { prisma } from '@/utils/prismaDB';
import {
  createPutRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    uploadError: {
      update: jest.fn(),
    },
  },
}));

describe('PUT /api/admin/upload-errors/[id]/resolve - Resolve Upload Error', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('✅ Successful Resolution', () => {
    it('should mark error as resolved', async () => {
      const mockError = {
        id: 'error-123',
        correlationId: 'corr-123',
        errorType: 'NETWORK_ERROR',
        message: 'Network timeout',
        userMessage: 'Upload failed',
        resolved: true,
        timestamp: new Date('2025-10-22T10:00:00Z'),
      };

      (prisma.uploadError.update as jest.Mock).mockResolvedValue(mockError);

      const request = createPutRequest(
        'http://localhost:3000/api/admin/upload-errors/error-123/resolve',
        {}
      );

      const context = {
        params: Promise.resolve({ id: 'error-123' }),
      };

      const response = await PUT(request, context);
      const data = await expectSuccessResponse(response, 200);

      expect(data.success).toBe(true);
      expect(data.error).toMatchObject({
        id: 'error-123',
        resolved: true,
      });
      expect(prisma.uploadError.update).toHaveBeenCalledWith({
        where: { id: 'error-123' },
        data: { resolved: true },
      });
    });

    it('should return full error details after resolution', async () => {
      const mockError = {
        id: 'error-456',
        correlationId: 'corr-456',
        errorType: 'VALIDATION_ERROR',
        message: 'Invalid file type',
        userMessage: 'File not supported',
        resolved: true,
        timestamp: new Date('2025-10-22T11:00:00Z'),
      };

      (prisma.uploadError.update as jest.Mock).mockResolvedValue(mockError);

      const request = createPutRequest(
        'http://localhost:3000/api/admin/upload-errors/error-456/resolve',
        {}
      );

      const context = {
        params: Promise.resolve({ id: 'error-456' }),
      };

      const response = await PUT(request, context);
      const data = await expectSuccessResponse(response, 200);

      expect(data.error.id).toBe('error-456');
      expect(data.error.correlationId).toBe('corr-456');
      expect(data.error.errorType).toBe('VALIDATION_ERROR');
      expect(data.error.message).toBe('Invalid file type');
      expect(data.error.userMessage).toBe('File not supported');
      expect(data.error.timestamp).toBe('2025-10-22T11:00:00.000Z');
    });
  });

  describe('✏️ Validation Tests', () => {
    it('should return 400 when errorId is empty', async () => {
      const request = createPutRequest(
        'http://localhost:3000/api/admin/upload-errors//resolve',
        {}
      );

      const context = {
        params: Promise.resolve({ id: '' }),
      };

      const response = await PUT(request, context);
      await expectErrorResponse(response, 400, /Error ID is required/i);
    });

    it('should return 400 when errorId is missing', async () => {
      const request = createPutRequest(
        'http://localhost:3000/api/admin/upload-errors/undefined/resolve',
        {}
      );

      const context = {
        params: Promise.resolve({ id: '' }),
      };

      const response = await PUT(request, context);
      await expectErrorResponse(response, 400, /Error ID is required/i);
    });
  });

  describe('❌ Error Handling', () => {
    it('should return 404 when error is not found', async () => {
      const notFoundError = new Error('Record to update not found');
      (prisma.uploadError.update as jest.Mock).mockRejectedValue(notFoundError);

      const request = createPutRequest(
        'http://localhost:3000/api/admin/upload-errors/nonexistent/resolve',
        {}
      );

      const context = {
        params: Promise.resolve({ id: 'nonexistent' }),
      };

      const response = await PUT(request, context);
      await expectErrorResponse(response, 404, /Error not found/i);
    });

    it('should handle database update errors', async () => {
      (prisma.uploadError.update as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createPutRequest(
        'http://localhost:3000/api/admin/upload-errors/error-123/resolve',
        {}
      );

      const context = {
        params: Promise.resolve({ id: 'error-123' }),
      };

      const response = await PUT(request, context);
      await expectErrorResponse(response, 500, /Failed to resolve error/i);
    });

    it('should handle general errors', async () => {
      (prisma.uploadError.update as jest.Mock).mockRejectedValue(
        new Error('Unexpected error')
      );

      const request = createPutRequest(
        'http://localhost:3000/api/admin/upload-errors/error-123/resolve',
        {}
      );

      const context = {
        params: Promise.resolve({ id: 'error-123' }),
      };

      const response = await PUT(request, context);
      await expectErrorResponse(response, 500);
    });
  });

  describe('📊 Edge Cases', () => {
    it('should handle already resolved error', async () => {
      const mockError = {
        id: 'error-789',
        correlationId: 'corr-789',
        errorType: 'ERROR',
        message: 'Test',
        userMessage: 'Test',
        resolved: true, // Already resolved
        timestamp: new Date(),
      };

      (prisma.uploadError.update as jest.Mock).mockResolvedValue(mockError);

      const request = createPutRequest(
        'http://localhost:3000/api/admin/upload-errors/error-789/resolve',
        {}
      );

      const context = {
        params: Promise.resolve({ id: 'error-789' }),
      };

      const response = await PUT(request, context);
      const data = await expectSuccessResponse(response, 200);

      expect(data.error.resolved).toBe(true);
    });

    it('should handle special characters in error ID', async () => {
      const specialId = 'error-with-special-chars-@#$';
      const mockError = {
        id: specialId,
        correlationId: 'corr-special',
        errorType: 'ERROR',
        message: 'Test',
        userMessage: 'Test',
        resolved: true,
        timestamp: new Date(),
      };

      (prisma.uploadError.update as jest.Mock).mockResolvedValue(mockError);

      const request = createPutRequest(
        `http://localhost:3000/api/admin/upload-errors/${specialId}/resolve`,
        {}
      );

      const context = {
        params: Promise.resolve({ id: specialId }),
      };

      const response = await PUT(request, context);
      const data = await expectSuccessResponse(response, 200);

      expect(data.error.id).toBe(specialId);
    });
  });
});
