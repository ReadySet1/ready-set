// src/__tests__/api/file-uploads/file-uploads.test.ts

import { GET, POST } from '@/app/api/file-uploads/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { FileValidator, UploadErrorHandler } from '@/lib/upload-error-handler';
import { UploadSecurityManager } from '@/lib/upload-security';
import {
  createGetRequest,
  createPostRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/prismaDB');
jest.mock('@/lib/upload-error-handler');
jest.mock('@/lib/upload-security');
jest.mock('@/utils/file-service', () => ({
  STORAGE_BUCKETS: { DEFAULT: 'default-bucket' },
  initializeStorageBuckets: jest.fn(),
  diagnoseStorageIssues: jest.fn(),
}));

describe('/api/file-uploads API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    storage: {
      from: jest.fn(() => ({
        createSignedUrl: jest.fn(),
        getPublicUrl: jest.fn(),
        upload: jest.fn(),
      })),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('GET /api/file-uploads - Get File URL', () => {
    describe('✅ Successful URL Generation', () => {
      it('should return signed URL for private files', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } },
          error: null,
        });

        mockSupabaseClient.storage.from().createSignedUrl.mockResolvedValue({
          data: { signedUrl: 'https://signed.url/file.pdf?token=abc123' },
          error: null,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/file-uploads?path=documents/file.pdf',
          { authorization: 'Bearer valid-token' }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.url).toBe('https://signed.url/file.pdf?token=abc123');
        expect(data.isPublic).toBe(false);
        expect(data.expiresIn).toBe('30 minutes');
      });

      it('should fallback to public URL if signed URL fails', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        mockSupabaseClient.storage.from().createSignedUrl.mockResolvedValue({
          data: null,
          error: { message: 'Bucket not configured for private access' },
        });

        mockSupabaseClient.storage.from().getPublicUrl.mockReturnValue({
          data: { publicUrl: 'https://public.url/file.pdf' },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/file-uploads?path=documents/file.pdf',
          { authorization: 'Bearer valid-token' }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.url).toBe('https://public.url/file.pdf');
        expect(data.isPublic).toBe(true);
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 for missing authorization header', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/file-uploads?path=documents/file.pdf'
        );

        const response = await GET(request);
        await expectUnauthorized(
          response,
          /Invalid authorization header/i
        );
      });

      it('should return 401 for invalid Bearer token format', async () => {
        const request = createGetRequest(
          'http://localhost:3000/api/file-uploads?path=documents/file.pdf',
          { authorization: 'InvalidFormat token' }
        );

        const response = await GET(request);
        await expectUnauthorized(response);
      });

      it('should return 401 for invalid token', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/file-uploads?path=documents/file.pdf',
          { authorization: 'Bearer invalid-token' }
        );

        const response = await GET(request);
        await expectUnauthorized(response);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 for missing path parameter', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/file-uploads',
          { authorization: 'Bearer valid-token' }
        );

        const response = await GET(request);
        await expectErrorResponse(response, 400, /Path parameter is required/i);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle storage service errors', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        mockSupabaseClient.storage.from().createSignedUrl.mockRejectedValue(
          new Error('Storage service unavailable')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/file-uploads?path=documents/file.pdf',
          { authorization: 'Bearer valid-token' }
        );

        const response = await GET(request);
        await expectErrorResponse(
          response,
          500,
          /Failed to generate file URL/i
        );
      });
    });
  });

  describe('POST /api/file-uploads - Upload File', () => {
    describe('✅ Successful Upload', () => {
      it('should upload file with valid data', async () => {
        (UploadSecurityManager.checkRateLimit as jest.Mock).mockResolvedValue(
          true
        );
        (FileValidator.validateFile as jest.Mock).mockReturnValue(null);

        mockSupabaseClient.storage.from().upload.mockResolvedValue({
          data: { path: 'uploads/file-123.pdf' },
          error: null,
        });

        (prisma as any).fileUpload = {
          create: jest.fn().mockResolvedValue({
            id: 'upload-123',
            fileName: 'document.pdf',
            filePath: 'uploads/file-123.pdf',
          }),
        };

        // Create mock file
        const mockFile = new File(['file content'], 'document.pdf', {
          type: 'application/pdf',
        });

        // Create form data
        const formData = new FormData();
        formData.append('file', mockFile);
        formData.append('entityId', 'entity-123');
        formData.append('entityType', 'job_application');

        const request = new Request('http://localhost:3000/api/file-uploads', {
          method: 'POST',
          body: formData,
          headers: {
            'x-user-id': 'user-123',
          },
        });

        const response = await POST(request as any);

        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
      });
    });

    describe('🚫 Rate Limiting', () => {
      it('should return 429 when rate limit exceeded', async () => {
        (UploadSecurityManager.checkRateLimit as jest.Mock).mockResolvedValue(
          false
        );

        (UploadErrorHandler.createValidationError as jest.Mock).mockReturnValue({
          type: 'RATE_LIMIT_EXCEEDED',
          userMessage: 'Too many upload attempts',
          retryable: true,
          correlationId: 'corr-123',
        });

        const mockFile = new File(['content'], 'document.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);
        formData.append('entityId', 'entity-123');

        const request = new Request('http://localhost:3000/api/file-uploads', {
          method: 'POST',
          body: formData,
          headers: {
            'x-user-id': 'user-123',
          },
        });

        const response = await POST(request as any);

        expect(response.status).toBe(429);
        const data = await response.json();
        expect(data.retryAfter).toBeDefined();
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should reject invalid file types', async () => {
        (UploadSecurityManager.checkRateLimit as jest.Mock).mockResolvedValue(
          true
        );

        (FileValidator.validateFile as jest.Mock).mockReturnValue({
          type: 'INVALID_FILE_TYPE',
          userMessage: 'File type not allowed',
        });

        const mockFile = new File(['content'], 'malicious.exe', {
          type: 'application/x-msdownload',
        });

        const formData = new FormData();
        formData.append('file', mockFile);
        formData.append('entityId', 'entity-123');

        const request = new Request('http://localhost:3000/api/file-uploads', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);

        expect(response.status).toBeGreaterThanOrEqual(400);
      });

      it('should reject files exceeding size limit', async () => {
        (UploadSecurityManager.checkRateLimit as jest.Mock).mockResolvedValue(
          true
        );

        (FileValidator.validateFile as jest.Mock).mockReturnValue({
          type: 'FILE_TOO_LARGE',
          userMessage: 'File size exceeds maximum allowed',
        });

        const mockFile = new File(['x'.repeat(10000000)], 'large.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);
        formData.append('entityId', 'entity-123');

        const request = new Request('http://localhost:3000/api/file-uploads', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);

        expect(response.status).toBeGreaterThanOrEqual(400);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle storage upload errors', async () => {
        (UploadSecurityManager.checkRateLimit as jest.Mock).mockResolvedValue(
          true
        );
        (FileValidator.validateFile as jest.Mock).mockReturnValue(null);

        mockSupabaseClient.storage.from().upload.mockResolvedValue({
          data: null,
          error: { message: 'Storage quota exceeded' },
        });

        const mockFile = new File(['content'], 'document.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);
        formData.append('entityId', 'entity-123');

        const request = new Request('http://localhost:3000/api/file-uploads', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);

        expect(response.status).toBeGreaterThanOrEqual(500);
      });

      it('should handle database errors when creating file record', async () => {
        (UploadSecurityManager.checkRateLimit as jest.Mock).mockResolvedValue(
          true
        );
        (FileValidator.validateFile as jest.Mock).mockReturnValue(null);

        mockSupabaseClient.storage.from().upload.mockResolvedValue({
          data: { path: 'uploads/file-123.pdf' },
          error: null,
        });

        (prisma as any).fileUpload = {
          create: jest.fn().mockRejectedValue(
            new Error('Database connection failed')
          ),
        };

        const mockFile = new File(['content'], 'document.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);
        formData.append('entityId', 'entity-123');

        const request = new Request('http://localhost:3000/api/file-uploads', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);

        expect(response.status).toBeGreaterThanOrEqual(500);
      });
    });

    describe('🔐 Session Token Validation (Security Enhancement)', () => {
      it('should accept uploads with valid session token for job applications', async () => {
        (UploadSecurityManager.checkRateLimit as jest.Mock).mockResolvedValue(true);
        (FileValidator.validateFile as jest.Mock).mockReturnValue(null);

        mockSupabaseClient.storage.from().upload.mockResolvedValue({
          data: { path: 'job-applications/temp/session-123/file.pdf' },
          error: null,
        });

        (prisma as any).fileUpload = {
          create: jest.fn().mockResolvedValue({
            id: 'upload-123',
            fileName: 'resume.pdf',
            filePath: 'job-applications/temp/session-123/file.pdf',
          }),
        };

        const mockFile = new File(['resume content'], 'resume.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);
        formData.append('entityId', 'temp_123_abc');
        formData.append('entityType', 'job_application');

        const request = new Request('http://localhost:3000/api/file-uploads', {
          method: 'POST',
          body: formData,
          headers: {
            'x-upload-token': 'valid-session-token',
          },
        });

        const response = await POST(request as any);

        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
      });

      it('should reject job application uploads without session token', async () => {
        const mockFile = new File(['resume content'], 'resume.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);
        formData.append('entityId', 'temp_123_abc');
        formData.append('entityType', 'job_application');

        // No x-upload-token header provided
        const request = new Request('http://localhost:3000/api/file-uploads', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);

        // Should fail due to missing session token for job applications
        expect(response.status).toBeGreaterThanOrEqual(400);
      });

      it('should allow uploads for non-job-application entity types without session token', async () => {
        (UploadSecurityManager.checkRateLimit as jest.Mock).mockResolvedValue(true);
        (FileValidator.validateFile as jest.Mock).mockReturnValue(null);

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        mockSupabaseClient.storage.from().upload.mockResolvedValue({
          data: { path: 'documents/file.pdf' },
          error: null,
        });

        (prisma as any).fileUpload = {
          create: jest.fn().mockResolvedValue({
            id: 'upload-123',
            fileName: 'document.pdf',
            filePath: 'documents/file.pdf',
          }),
        };

        const mockFile = new File(['content'], 'document.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);
        formData.append('entityId', 'entity-123');
        formData.append('entityType', 'document'); // Not job_application

        const request = new Request('http://localhost:3000/api/file-uploads', {
          method: 'POST',
          body: formData,
          headers: {
            'x-user-id': 'user-123',
          },
        });

        const response = await POST(request as any);

        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
      });
    });
  });
});
