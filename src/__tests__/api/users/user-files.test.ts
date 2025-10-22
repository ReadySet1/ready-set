// src/__tests__/api/users/user-files.test.ts

import { GET as GET_USER_FILES } from '@/app/api/users/[userId]/files/route';
import { GET as GET_FILES } from '@/app/api/users/files/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { UserType } from '@/types/prisma';
import {
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
    },
    fileUpload: {
      findMany: jest.fn(),
    },
  },
}));

describe('/api/users/[userId]/files and /api/users/files APIs', () => {
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('GET /api/users/[userId]/files - Fetch User Files', () => {
    describe('✅ Successful Fetch', () => {
      it('should fetch own files for authenticated user', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        const mockFiles = [
          {
            id: 'file-1',
            fileName: 'document.pdf',
            fileUrl: 'https://storage.example.com/document.pdf',
            fileType: 'application/pdf',
            fileSize: 1024,
            category: 'invoice',
            uploadedAt: new Date('2024-01-15T10:00:00Z'),
            userId: 'user-123',
          },
          {
            id: 'file-2',
            fileName: 'image.jpg',
            fileUrl: 'https://storage.example.com/image.jpg',
            fileType: 'image/jpeg',
            fileSize: 2048,
            category: 'photo',
            uploadedAt: new Date('2024-01-14T10:00:00Z'),
            userId: 'user-123',
          },
        ];

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue(mockFiles);

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-123/files'
        );
        const params = { userId: 'user-123' };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveLength(2);
        expect(data[0].id).toBe('file-1');
        expect(data[0].fileName).toBe('document.pdf');
        expect(data[1].id).toBe('file-2');
        expect(prisma.fileUpload.findMany).toHaveBeenCalledWith({
          where: { userId: 'user-123' },
          orderBy: { uploadedAt: 'desc' },
        });
      });

      it('should fetch user files by ADMIN', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'admin-123' } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123', app_metadata: { role: 'admin' } } },
          error: null,
        });

        const mockFiles = [
          {
            id: 'file-1',
            fileName: 'user-doc.pdf',
            fileUrl: 'https://storage.example.com/user-doc.pdf',
            fileType: 'application/pdf',
            fileSize: 512,
            category: 'document',
            uploadedAt: new Date('2024-01-15T10:00:00Z'),
            userId: 'user-456',
          },
        ];

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue(mockFiles);

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/files'
        );
        const params = { userId: 'user-456' };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        expect(response.status).toBe(200);
      });

      it('should fetch user files by SUPER_ADMIN', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'superadmin-123' } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123', app_metadata: { role: 'super_admin' } } },
          error: null,
        });

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/files'
        );
        const params = { userId: 'user-456' };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        expect(response.status).toBe(200);
      });

      it('should fetch user files by HELPDESK', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'helpdesk-123' } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'helpdesk-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.HELPDESK,
        });

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/files'
        );
        const params = { userId: 'user-456' };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        expect(response.status).toBe(200);
      });

      it('should return empty array when user has no files', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-123/files'
        );
        const params = { userId: 'user-123' };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        const data = await expectSuccessResponse(response, 200);

        expect(data).toEqual([]);
      });

      it('should return files ordered by uploadedAt descending', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        const mockFiles = [
          {
            id: 'file-3',
            fileName: 'newest.pdf',
            fileUrl: 'https://storage.example.com/newest.pdf',
            fileType: 'application/pdf',
            fileSize: 1024,
            category: 'document',
            uploadedAt: new Date('2024-01-17T10:00:00Z'),
            userId: 'user-123',
          },
          {
            id: 'file-2',
            fileName: 'middle.pdf',
            fileUrl: 'https://storage.example.com/middle.pdf',
            fileType: 'application/pdf',
            fileSize: 1024,
            category: 'document',
            uploadedAt: new Date('2024-01-16T10:00:00Z'),
            userId: 'user-123',
          },
          {
            id: 'file-1',
            fileName: 'oldest.pdf',
            fileUrl: 'https://storage.example.com/oldest.pdf',
            fileType: 'application/pdf',
            fileSize: 1024,
            category: 'document',
            uploadedAt: new Date('2024-01-15T10:00:00Z'),
            userId: 'user-123',
          },
        ];

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue(mockFiles);

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-123/files'
        );
        const params = { userId: 'user-123' };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        const data = await expectSuccessResponse(response, 200);

        expect(data[0].fileName).toBe('newest.pdf');
        expect(data[1].fileName).toBe('middle.pdf');
        expect(data[2].fileName).toBe('oldest.pdf');
        expect(prisma.fileUpload.findMany).toHaveBeenCalledWith({
          where: { userId: 'user-123' },
          orderBy: { uploadedAt: 'desc' },
        });
      });

      it('should return formatted file objects with required fields', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        const mockFiles = [
          {
            id: 'file-1',
            fileName: 'test.pdf',
            fileUrl: 'https://storage.example.com/test.pdf',
            fileType: 'application/pdf',
            fileSize: 1024,
            category: 'invoice',
            uploadedAt: new Date('2024-01-15T10:00:00Z'),
            userId: 'user-123',
            extraField: 'should not be included',
          },
        ];

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue(mockFiles);

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-123/files'
        );
        const params = { userId: 'user-123' };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        const data = await expectSuccessResponse(response, 200);

        expect(data[0]).toHaveProperty('id');
        expect(data[0]).toHaveProperty('fileName');
        expect(data[0]).toHaveProperty('fileUrl');
        expect(data[0]).toHaveProperty('fileType');
        expect(data[0]).toHaveProperty('fileSize');
        expect(data[0]).toHaveProperty('category');
        expect(data[0]).toHaveProperty('uploadedAt');
        expect(data[0]).toHaveProperty('userId');
        expect(data[0]).not.toHaveProperty('extraField');
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: null },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated'),
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/files'
        );
        const params = { userId: 'user-456' };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        await expectUnauthorized(response, /Please log in/i);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 when non-admin user tries to access another user files', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.CLIENT,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/files'
        );
        const params = { userId: 'user-456' };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        await expectForbidden(response, /Insufficient permissions/i);
      });

      it('should return 403 for VENDOR trying to access another user files', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'vendor-123' } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'vendor-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.VENDOR,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/files'
        );
        const params = { userId: 'user-456' };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        await expectForbidden(response);
      });

      it('should return 403 for DRIVER trying to access another user files', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'driver-123' } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.DRIVER,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/files'
        );
        const params = { userId: 'user-456' };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        await expectForbidden(response);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle database query errors', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        (prisma.fileUpload.findMany as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-123/files'
        );
        const params = { userId: 'user-123' };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        await expectErrorResponse(response, 500, /Database connection failed/i);
      });

      it('should handle profile lookup errors', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockRejectedValue(
          new Error('Profile query failed')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/files'
        );
        const params = { userId: 'user-456' };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        await expectErrorResponse(response, 500, /authorization/i);
      });
    });
  });

  describe('GET /api/users/files - Fetch Files with Query Param', () => {
    describe('✅ Successful Fetch', () => {
      it('should fetch files with userId query parameter', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        });

        const mockFiles = [
          {
            id: 'file-1',
            fileName: 'document.pdf',
            fileUrl: 'https://storage.example.com/document.pdf',
            fileType: 'application/pdf',
            fileSize: 1024,
            category: 'invoice',
            uploadedAt: new Date('2024-01-15T10:00:00Z'),
          },
        ];

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue(mockFiles);

        const request = createGetRequest(
          'http://localhost:3000/api/users/files?userId=user-456'
        );

        const response = await GET_FILES(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.files).toHaveLength(1);
        expect(data.files[0].name).toBe('document.pdf');
        expect(data.files[0].url).toBe('https://storage.example.com/document.pdf');
      });

      it('should return files with formatted field names', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        });

        const mockFiles = [
          {
            id: 'file-1',
            fileName: 'test.jpg',
            fileUrl: 'https://storage.example.com/test.jpg',
            fileType: 'image/jpeg',
            fileSize: 2048,
            category: 'photo',
            uploadedAt: new Date('2024-01-15T10:00:00Z'),
          },
        ];

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue(mockFiles);

        const request = createGetRequest(
          'http://localhost:3000/api/users/files?userId=user-456'
        );

        const response = await GET_FILES(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.files[0]).toHaveProperty('id');
        expect(data.files[0]).toHaveProperty('name');
        expect(data.files[0]).toHaveProperty('url');
        expect(data.files[0]).toHaveProperty('type');
        expect(data.files[0]).toHaveProperty('size');
        expect(data.files[0]).toHaveProperty('category');
        expect(data.files[0]).toHaveProperty('uploadedAt');
      });

      it('should order files by uploadedAt descending', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        });

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/users/files?userId=user-456'
        );

        await GET_FILES(request);

        expect(prisma.fileUpload.findMany).toHaveBeenCalledWith({
          where: { userId: 'user-456' },
          orderBy: { uploadedAt: 'desc' },
        });
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when no session exists', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: null },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/files?userId=user-456'
        );

        const response = await GET_FILES(request);
        await expectUnauthorized(response);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 when userId parameter is missing', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/files'
        );

        const response = await GET_FILES(request);
        await expectErrorResponse(response, 400, /Missing userId parameter/i);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle database errors', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        });

        (prisma.fileUpload.findMany as jest.Mock).mockRejectedValue(
          new Error('Database timeout')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/users/files?userId=user-456'
        );

        const response = await GET_FILES(request);
        await expectErrorResponse(response, 500, /Failed to fetch user files/i);
      });

      it('should return error details in response', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        });

        (prisma.fileUpload.findMany as jest.Mock).mockRejectedValue(
          new Error('Connection lost')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/users/files?userId=user-456'
        );

        const response = await GET_FILES(request);
        const data = await response.json();

        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('details');
        expect(data.details).toContain('Connection lost');
      });
    });
  });
});
