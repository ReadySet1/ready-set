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

// Test UUIDs - must be valid UUID format since API validates UUID format
const TEST_USER_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const OTHER_USER_ID = 'a1b2c3d4-5678-9abc-def0-123456789abc';
const ADMIN_USER_ID = '11111111-1111-1111-1111-111111111111';
const SUPER_ADMIN_ID = '22222222-2222-2222-2222-222222222222';
const HELPDESK_USER_ID = '33333333-3333-3333-3333-333333333333';
const VENDOR_USER_ID = '44444444-4444-4444-4444-444444444444';
const DRIVER_USER_ID = '55555555-5555-5555-5555-555555555555';

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
          data: { session: { user: { id: TEST_USER_ID } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: TEST_USER_ID } },
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
            userId: TEST_USER_ID,
          },
          {
            id: 'file-2',
            fileName: 'image.jpg',
            fileUrl: 'https://storage.example.com/image.jpg',
            fileType: 'image/jpeg',
            fileSize: 2048,
            category: 'photo',
            uploadedAt: new Date('2024-01-14T10:00:00Z'),
            userId: TEST_USER_ID,
          },
        ];

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue(mockFiles);

        const request = createGetRequest(
          `http://localhost:3000/api/users/${TEST_USER_ID}/files`
        );
        const params = { userId: TEST_USER_ID };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveLength(2);
        expect(data[0].id).toBe('file-1');
        expect(data[0].fileName).toBe('document.pdf');
        expect(data[1].id).toBe('file-2');
        expect(prisma.fileUpload.findMany).toHaveBeenCalledWith({
          where: { userId: TEST_USER_ID },
          orderBy: { uploadedAt: 'desc' },
        });
      });

      it('should fetch user files by ADMIN', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: ADMIN_USER_ID } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: ADMIN_USER_ID, app_metadata: { role: 'admin' } } },
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
            userId: OTHER_USER_ID,
          },
        ];

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue(mockFiles);

        const request = createGetRequest(
          `http://localhost:3000/api/users/${OTHER_USER_ID}/files`
        );
        const params = { userId: OTHER_USER_ID };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        expect(response.status).toBe(200);
      });

      it('should fetch user files by SUPER_ADMIN', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: SUPER_ADMIN_ID } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: SUPER_ADMIN_ID, app_metadata: { role: 'super_admin' } } },
          error: null,
        });

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          `http://localhost:3000/api/users/${OTHER_USER_ID}/files`
        );
        const params = { userId: OTHER_USER_ID };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        expect(response.status).toBe(200);
      });

      it('should fetch user files by HELPDESK', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: HELPDESK_USER_ID } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: HELPDESK_USER_ID } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.HELPDESK,
        });

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          `http://localhost:3000/api/users/${OTHER_USER_ID}/files`
        );
        const params = { userId: OTHER_USER_ID };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        expect(response.status).toBe(200);
      });

      it('should return empty array when user has no files', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: TEST_USER_ID } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: TEST_USER_ID } },
          error: null,
        });

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          `http://localhost:3000/api/users/${TEST_USER_ID}/files`
        );
        const params = { userId: TEST_USER_ID };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        const data = await expectSuccessResponse(response, 200);

        expect(data).toEqual([]);
      });

      it('should return files ordered by uploadedAt descending', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: TEST_USER_ID } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: TEST_USER_ID } },
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
            userId: TEST_USER_ID,
          },
          {
            id: 'file-2',
            fileName: 'middle.pdf',
            fileUrl: 'https://storage.example.com/middle.pdf',
            fileType: 'application/pdf',
            fileSize: 1024,
            category: 'document',
            uploadedAt: new Date('2024-01-16T10:00:00Z'),
            userId: TEST_USER_ID,
          },
          {
            id: 'file-1',
            fileName: 'oldest.pdf',
            fileUrl: 'https://storage.example.com/oldest.pdf',
            fileType: 'application/pdf',
            fileSize: 1024,
            category: 'document',
            uploadedAt: new Date('2024-01-15T10:00:00Z'),
            userId: TEST_USER_ID,
          },
        ];

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue(mockFiles);

        const request = createGetRequest(
          `http://localhost:3000/api/users/${TEST_USER_ID}/files`
        );
        const params = { userId: TEST_USER_ID };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        const data = await expectSuccessResponse(response, 200);

        expect(data[0].fileName).toBe('newest.pdf');
        expect(data[1].fileName).toBe('middle.pdf');
        expect(data[2].fileName).toBe('oldest.pdf');
        expect(prisma.fileUpload.findMany).toHaveBeenCalledWith({
          where: { userId: TEST_USER_ID },
          orderBy: { uploadedAt: 'desc' },
        });
      });

      it('should return formatted file objects with required fields', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: TEST_USER_ID } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: TEST_USER_ID } },
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
            userId: TEST_USER_ID,
            extraField: 'should not be included',
          },
        ];

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue(mockFiles);

        const request = createGetRequest(
          `http://localhost:3000/api/users/${TEST_USER_ID}/files`
        );
        const params = { userId: TEST_USER_ID };

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
          `http://localhost:3000/api/users/${OTHER_USER_ID}/files`
        );
        const params = { userId: OTHER_USER_ID };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        await expectUnauthorized(response, /Please log in/i);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 when non-admin user tries to access another user files', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: TEST_USER_ID } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: TEST_USER_ID } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.CLIENT,
        });

        const request = createGetRequest(
          `http://localhost:3000/api/users/${OTHER_USER_ID}/files`
        );
        const params = { userId: OTHER_USER_ID };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        await expectForbidden(response, /Insufficient permissions/i);
      });

      it('should return 403 for VENDOR trying to access another user files', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: VENDOR_USER_ID } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: VENDOR_USER_ID } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.VENDOR,
        });

        const request = createGetRequest(
          `http://localhost:3000/api/users/${OTHER_USER_ID}/files`
        );
        const params = { userId: OTHER_USER_ID };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        await expectForbidden(response);
      });

      it('should return 403 for DRIVER trying to access another user files', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: DRIVER_USER_ID } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: DRIVER_USER_ID } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type: UserType.DRIVER,
        });

        const request = createGetRequest(
          `http://localhost:3000/api/users/${OTHER_USER_ID}/files`
        );
        const params = { userId: OTHER_USER_ID };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        await expectForbidden(response);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle database query errors', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: TEST_USER_ID } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: TEST_USER_ID } },
          error: null,
        });

        (prisma.fileUpload.findMany as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createGetRequest(
          `http://localhost:3000/api/users/${TEST_USER_ID}/files`
        );
        const params = { userId: TEST_USER_ID };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        await expectErrorResponse(response, 500, /Database connection failed/i);
      });

      it('should handle profile lookup errors', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: TEST_USER_ID } } },
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: TEST_USER_ID } },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockRejectedValue(
          new Error('Profile query failed')
        );

        const request = createGetRequest(
          `http://localhost:3000/api/users/${OTHER_USER_ID}/files`
        );
        const params = { userId: OTHER_USER_ID };

        const response = await GET_USER_FILES(request, { params: Promise.resolve(params) });
        await expectErrorResponse(response, 500, /authorization/i);
      });
    });
  });

  describe('GET /api/users/files - Fetch Files with Query Param', () => {
    describe('✅ Successful Fetch', () => {
      it('should fetch files with userId query parameter', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: TEST_USER_ID } } },
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
          `http://localhost:3000/api/users/files?userId=${OTHER_USER_ID}`
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
          data: { session: { user: { id: TEST_USER_ID } } },
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
          `http://localhost:3000/api/users/files?userId=${OTHER_USER_ID}`
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
          data: { session: { user: { id: TEST_USER_ID } } },
        });

        (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          `http://localhost:3000/api/users/files?userId=${OTHER_USER_ID}`
        );

        await GET_FILES(request);

        expect(prisma.fileUpload.findMany).toHaveBeenCalledWith({
          where: { userId: OTHER_USER_ID },
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
          `http://localhost:3000/api/users/files?userId=${OTHER_USER_ID}`
        );

        const response = await GET_FILES(request);
        await expectUnauthorized(response);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 when userId parameter is missing', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: TEST_USER_ID } } },
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
          data: { session: { user: { id: TEST_USER_ID } } },
        });

        (prisma.fileUpload.findMany as jest.Mock).mockRejectedValue(
          new Error('Database timeout')
        );

        const request = createGetRequest(
          `http://localhost:3000/api/users/files?userId=${OTHER_USER_ID}`
        );

        const response = await GET_FILES(request);
        await expectErrorResponse(response, 500, /Failed to fetch user files/i);
      });

      it('should return error details in response', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: TEST_USER_ID } } },
        });

        (prisma.fileUpload.findMany as jest.Mock).mockRejectedValue(
          new Error('Connection lost')
        );

        const request = createGetRequest(
          `http://localhost:3000/api/users/files?userId=${OTHER_USER_ID}`
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
