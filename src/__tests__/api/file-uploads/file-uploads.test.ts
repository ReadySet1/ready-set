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
import { createMockSupabaseClient } from '@/__tests__/helpers/supabase-mock-helpers';
import { createMockPrisma, MockPrismaClient } from '@/__tests__/helpers/prisma-mock';

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
  let mockSupabaseClient: ReturnType<typeof createMockSupabaseClient>;
  // Type-safe Prisma mock
  let prismaMock: MockPrismaClient;

  beforeEach(() => {
    jest.clearAllMocks();
    // Use the helper to create a properly structured mock
    mockSupabaseClient = createMockSupabaseClient();

    // Override storage methods for file upload tests
    mockSupabaseClient.storage.from = jest.fn(() => ({
      createSignedUrl: jest.fn(),
      getPublicUrl: jest.fn(),
      upload: jest.fn(),
    }));

    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);

    // Initialize type-safe Prisma mock
    prismaMock = createMockPrisma();

    // DATABASE CONNECTION GUARD: Full Prisma mocking strategy
    // We mock ALL Prisma operations to prevent accidental database connections in tests.
    // This ensures:
    // 1. Tests run in isolation without database dependencies
    // 2. Tests fail fast if they try to use unmocked models
    // 3. CI/CD pipelines don't require database connections
    // 4. Test execution is faster (no network calls)

    // Mock the fileUpload model (primary model used in these tests)
    jest.mocked(prisma).fileUpload = prismaMock.fileUpload as any;

    // DATABASE CONNECTION GUARD: Mock $queryRaw to prevent raw SQL queries
    jest.mocked(prisma).$queryRaw = jest.fn().mockRejectedValue(
      new Error('MOCK_ERROR: Direct database queries are not allowed in tests. Use mocked models instead.')
    );

    // DATABASE CONNECTION GUARD: Mock $executeRaw to prevent raw SQL execution
    jest.mocked(prisma).$executeRaw = jest.fn().mockRejectedValue(
      new Error('MOCK_ERROR: Direct database execution is not allowed in tests. Use mocked models instead.')
    );

    // DATABASE CONNECTION GUARD: Mock $connect to prevent actual connections
    jest.mocked(prisma).$connect = jest.fn().mockRejectedValue(
      new Error('MOCK_ERROR: Database connections are not allowed in tests. All operations should use mocks.')
    );

    // DATABASE CONNECTION GUARD: Mock $disconnect to prevent disconnect attempts
    jest.mocked(prisma).$disconnect = jest.fn().mockResolvedValue(undefined);

    // DATABASE CONNECTION GUARD: Mock $transaction to prevent transaction usage
    jest.mocked(prisma).$transaction = jest.fn().mockRejectedValue(
      new Error('MOCK_ERROR: Database transactions are not allowed in tests. Use mocked models instead.')
    ) as any;
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

        // Use type-safe Prisma mock
        prismaMock.fileUpload.create.mockResolvedValue({
          id: 'upload-123',
          fileName: 'document.pdf',
          filePath: 'uploads/file-123.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          fileUrl: 'https://example.com/signed-url',
          uploadedAt: new Date(),
          updatedAt: new Date(),
          category: null,
          userId: null,
          cateringRequestId: null,
          onDemandId: null,
          jobApplicationId: null,
          isTemporary: false
        });

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

        // Use type-safe Prisma mock for error case
        prismaMock.fileUpload.create.mockRejectedValue(
          new Error('Database connection failed')
        );

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

        // Use type-safe Prisma mock
        prismaMock.fileUpload.create.mockResolvedValue({
          id: 'upload-123',
          fileName: 'resume.pdf',
          filePath: 'job-applications/temp/session-123/file.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          fileUrl: 'https://example.com/signed-url',
          uploadedAt: new Date(),
          updatedAt: new Date(),
          category: null,
          userId: null,
          cateringRequestId: null,
          onDemandId: null,
          jobApplicationId: null,
          isTemporary: true
        });

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

        // Use type-safe Prisma mock
        prismaMock.fileUpload.create.mockResolvedValue({
          id: 'upload-123',
          fileName: 'document.pdf',
          filePath: 'documents/file.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          fileUrl: 'https://example.com/signed-url',
          uploadedAt: new Date(),
          updatedAt: new Date(),
          category: null,
          userId: null,
          cateringRequestId: null,
          onDemandId: null,
          jobApplicationId: null,
          isTemporary: false
        });

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
