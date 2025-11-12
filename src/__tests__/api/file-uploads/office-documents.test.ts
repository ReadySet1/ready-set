// src/__tests__/api/file-uploads/office-documents.test.ts
// Comprehensive test suite for office document file uploads

import { POST } from '@/app/api/file-uploads/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { FileValidator, UploadErrorHandler } from '@/lib/upload-error-handler';
import { UploadSecurityManager } from '@/lib/upload-security';
import {
  createPostRequestWithFormData,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/prismaDB');
jest.mock('@/lib/upload-error-handler');
jest.mock('@/lib/upload-security');
jest.mock('@/utils/file-service', () => ({
  STORAGE_BUCKETS: { DEFAULT: 'fileUploader' },
  initializeStorageBuckets: jest.fn(),
  diagnoseStorageIssues: jest.fn(),
}));

describe('/api/file-uploads - Office Document Formats', () => {
  // Set NODE_ENV to development for these tests to enable detailed logging and diagnostics
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  // Create a shared mock storage bucket that will be returned by from()
  const mockStorageBucket = {
    createSignedUrl: jest.fn(),
    upload: jest.fn(),
    remove: jest.fn(),
  };

  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
    },
    storage: {
      from: jest.fn(() => mockStorageBucket),
    },
    from: jest.fn(),
  };

  const createMockFile = (name: string, type: string, size: number = 1024): File => {
    const blob = new Blob(['test content'], { type });
    return new File([blob], name, { type });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);

    // Mock authentication
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null,
    });

    // Mock file validation to pass by default
    (FileValidator.validateFile as jest.Mock).mockReturnValue(null);
    (FileValidator.sanitizeFilename as jest.Mock).mockImplementation((name) => name);

    // Mock security checks to pass by default
    (UploadSecurityManager.checkRateLimit as jest.Mock).mockResolvedValue(true);
    (UploadSecurityManager.validateFileSecurity as jest.Mock).mockResolvedValue({
      isSecure: true,
      scanResults: { passed: true },
    });

    // Mock successful upload
    mockStorageBucket.upload.mockResolvedValue({
      data: { path: 'test/path/file.pdf' },
      error: null,
    });

    // Mock successful signed URL generation
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed-url' },
      error: null,
    });

    // Mock database creation
    // Note: Using 'as any' here is necessary because Prisma's generated types
    // are very strict and difficult to mock properly in Jest. This is a standard
    // pattern for Prisma testing.
    (prisma as any).fileUpload = {
      create: jest.fn().mockResolvedValue({
        id: 'upload-123',
        fileName: 'test.pdf',
        fileUrl: 'https://example.com/signed-url',
      }),
    };
  });

  describe('✅ PDF Document Uploads', () => {
    it('should successfully upload a PDF file', async () => {
      const file = createMockFile('test-document.pdf', 'application/pdf');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'entity-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectSuccessResponse(response);
      const data = await response.json();
      expect(data.file.name).toBe('test-document.pdf');
    });

    it('should handle PDF files with special characters in filename', async () => {
      const file = createMockFile('Invoice-E0F18A7B-0008.pdf', 'application/pdf');
      (FileValidator.sanitizeFilename as jest.Mock).mockReturnValue('Invoice-E0F18A7B-0008.pdf');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'user-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectSuccessResponse(response);
    });

    it('should handle large PDF files (near 10MB limit)', async () => {
      const file = createMockFile('large-document.pdf', 'application/pdf', 9 * 1024 * 1024);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'user-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectSuccessResponse(response);
    });
  });

  describe('✅ Word Document Uploads (DOC/DOCX)', () => {
    it('should successfully upload a DOC file', async () => {
      const file = createMockFile('document.doc', 'application/msword');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'entity-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectSuccessResponse(response);
      const data = await response.json();
      expect(data.file.name).toBe('document.doc');
      expect(data.file.type).toBe('application/msword');
    });

    it('should successfully upload a DOCX file', async () => {
      const file = createMockFile(
        'document.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'entity-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectSuccessResponse(response);
      const data = await response.json();
      expect(data.file.name).toBe('document.docx');
    });
  });

  describe('✅ Excel Spreadsheet Uploads (XLS/XLSX)', () => {
    it('should successfully upload an XLS file', async () => {
      const file = createMockFile('spreadsheet.xls', 'application/vnd.ms-excel');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'entity-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectSuccessResponse(response);
      const data = await response.json();
      expect(data.file.name).toBe('spreadsheet.xls');
      expect(data.file.type).toBe('application/vnd.ms-excel');
    });

    it('should successfully upload an XLSX file', async () => {
      const file = createMockFile(
        'spreadsheet.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'entity-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectSuccessResponse(response);
      const data = await response.json();
      expect(data.file.name).toBe('spreadsheet.xlsx');
    });
  });

  describe('✅ PowerPoint Presentation Uploads (PPT/PPTX)', () => {
    it('should successfully upload a PPT file', async () => {
      const file = createMockFile('presentation.ppt', 'application/vnd.ms-powerpoint');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'entity-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectSuccessResponse(response);
      const data = await response.json();
      expect(data.file.name).toBe('presentation.ppt');
      expect(data.file.type).toBe('application/vnd.ms-powerpoint');
    });

    it('should successfully upload a PPTX file', async () => {
      const file = createMockFile(
        'presentation.pptx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'entity-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectSuccessResponse(response);
      const data = await response.json();
      expect(data.file.name).toBe('presentation.pptx');
      expect(data.file.type).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    });
  });

  describe('❌ Invalid File Type Errors', () => {
    it('should reject unsupported file types with detailed error message', async () => {
      const file = createMockFile('script.exe', 'application/x-msdownload');
      (FileValidator.validateFile as jest.Mock).mockReturnValue({
        type: 'TYPE_ERROR',
        message: 'File type not allowed',
        userMessage: 'File type "application/x-msdownload" is not supported. Allowed formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, JPEG, PNG, GIF, WEBP, TXT, CSV. Please choose a different file.',
        details: {
          fileType: 'application/x-msdownload',
          allowedTypes: ['application/pdf', 'application/msword', /* ... */],
        },
        retryable: false,
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'user-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectErrorResponse(response, 400);
      const data = await response.json();
      expect(data.error).toContain('Allowed formats:');
      expect(data.errorType).toBe('TYPE_ERROR');
    });

    it('should reject files with blocked extensions', async () => {
      const file = createMockFile('malicious.js', 'text/javascript');
      (FileValidator.validateFile as jest.Mock).mockReturnValue({
        type: 'TYPE_ERROR',
        message: 'File extension not allowed',
        userMessage: 'File extension ".js" is not allowed. Allowed formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, JPEG, PNG, GIF, WEBP, TXT, CSV. Please choose a different file.',
        retryable: false,
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'user-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectErrorResponse(response, 400);
    });
  });

  describe('❌ File Size Validation', () => {
    it('should reject files exceeding 10MB limit with specific error', async () => {
      const file = createMockFile('huge-file.pdf', 'application/pdf', 11 * 1024 * 1024);
      (FileValidator.validateFile as jest.Mock).mockReturnValue({
        type: 'SIZE_ERROR',
        message: 'File too large',
        userMessage: 'File is too large (11.00 MB). Maximum allowed size is 10.00 MB.',
        details: {
          actualSize: 11 * 1024 * 1024,
          maxSize: 10 * 1024 * 1024,
        },
        retryable: false,
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'user-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectErrorResponse(response, 400);
      const data = await response.json();
      expect(data.error).toContain('too large');
      expect(data.errorType).toBe('SIZE_ERROR');
    });
  });

  describe('❌ Security Validation', () => {
    it('should reject files failing security scan with specific error', async () => {
      (UploadSecurityManager.validateFileSecurity as jest.Mock).mockResolvedValue({
        isSecure: false,
        error: {
          type: 'VIRUS_ERROR',
          message: 'Malicious content detected',
          userMessage: 'This file appears to contain malicious content and cannot be uploaded.',
          retryable: false,
        },
        scanResults: { threats: ['XSS pattern detected'] },
      });

      const file = createMockFile('malicious.pdf', 'application/pdf');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'user-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectErrorResponse(response, 403);
      const data = await response.json();
      expect(data.error).toContain('malicious content');
      expect(data.errorType).toBe('VIRUS_ERROR');
    });
  });

  describe('❌ Storage Error Handling', () => {
    it('should provide detailed error when storage upload fails', async () => {
      mockStorageBucket.upload.mockResolvedValue({
        data: null,
        error: { message: 'Bucket not found' },
      });

      (UploadErrorHandler.categorizeError as jest.Mock).mockReturnValue({
        type: 'STORAGE_ERROR',
        message: 'Bucket not found',
        userMessage: 'Storage service is temporarily unavailable. Please try again in a moment.',
        details: {
          originalMessage: 'Bucket not found',
          status: 500,
        },
        retryable: true,
        retryAfter: 5000,
        correlationId: 'test-correlation-id',
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'user-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      await expectErrorResponse(response, 500);
      const data = await response.json();
      expect(data.errorType).toBe('STORAGE_ERROR');
      expect(data.retryable).toBe(true);
      expect(data.correlationId).toBe('test-correlation-id');
      expect(data.diagnostics).toBeDefined();
    });
  });

  describe('✅ Enhanced Error Messages', () => {
    it('should include correlation ID in all errors for tracking', async () => {
      (FileValidator.validateFile as jest.Mock).mockReturnValue({
        type: 'TYPE_ERROR',
        message: 'Invalid type',
        userMessage: 'File type not supported',
        correlationId: 'error-123',
        retryable: false,
      });

      const file = createMockFile('test.exe', 'application/x-msdownload');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'user-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      const data = await response.json();
      expect(data.correlationId).toBe('error-123');
    });

    it('should include diagnostic information in error responses', async () => {
      mockStorageBucket.upload.mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' },
      });

      (UploadErrorHandler.categorizeError as jest.Mock).mockReturnValue({
        type: 'STORAGE_ERROR',
        message: 'Upload failed',
        userMessage: 'Storage error occurred',
        correlationId: 'test-id',
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', 'user-123');
      formData.append('entityType', 'user');

      const request = createPostRequestWithFormData('http://localhost:3000/api/file-uploads', formData);
      const response = await POST(request);

      const data = await response.json();
      expect(data.diagnostics).toBeDefined();
      expect(data.diagnostics.originalError).toBeDefined();
    });
  });
});
