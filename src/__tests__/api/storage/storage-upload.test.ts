// src/__tests__/api/storage/storage-upload.test.ts

import { POST } from '@/app/api/storage/upload/route';
import { createClient } from '@/utils/supabase/server';
import { saveFileMetadata, STORAGE_BUCKETS } from '@/utils/file-service';
import {
  expectSuccessResponse,
  expectUnauthorized,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/file-service');

describe('/api/storage/upload API', () => {
  const mockUpload = jest.fn();
  const mockGetPublicUrl = jest.fn();
  const mockStorageFrom = jest.fn(() => ({
    upload: mockUpload,
    getPublicUrl: mockGetPublicUrl,
  }));

  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn(),
    },
    storage: {
      from: mockStorageFrom,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('POST /api/storage/upload - File Upload', () => {
    describe('✅ Successful Upload', () => {
      it('should upload file with default parameters', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-123', email: 'user@example.com' },
            },
          },
        });

        mockUpload.mockResolvedValue({
          data: { path: 'user-123/abc123.pdf' },
          error: null,
        });

        mockGetPublicUrl.mockReturnValue({
          data: { publicUrl: 'https://storage.example.com/abc123.pdf' },
        });

        (saveFileMetadata as jest.Mock).mockResolvedValue({
          id: 'metadata-123',
        });

        const mockFile = new File(['file content'], 'document.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);

        const request = new Request('http://localhost:3000/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);
        const data = await expectSuccessResponse(response, 200);

        expect(data.message).toMatch(/uploaded successfully/i);
        expect(data.file.name).toBe('document.pdf');
        expect(data.file.url).toBe('https://storage.example.com/abc123.pdf');
        expect(data.file.id).toBe('metadata-123');
      });

      it('should upload file with custom bucket', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-123' },
            },
          },
        });

        mockUpload.mockResolvedValue({
          data: { path: 'custom-bucket/file.jpg' },
          error: null,
        });

        mockGetPublicUrl.mockReturnValue({
          data: { publicUrl: 'https://storage.example.com/file.jpg' },
        });

        (saveFileMetadata as jest.Mock).mockResolvedValue({
          id: 'metadata-456',
        });

        const mockFile = new File(['image data'], 'photo.jpg', {
          type: 'image/jpeg',
        });

        const formData = new FormData();
        formData.append('file', mockFile);
        formData.append('bucket', 'custom-bucket');

        const request = new Request('http://localhost:3000/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);
        expect(response.status).toBe(200);
      });

      it('should upload file with entity metadata', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-123' },
            },
          },
        });

        mockUpload.mockResolvedValue({
          data: { path: 'user-123/file.pdf' },
          error: null,
        });

        mockGetPublicUrl.mockReturnValue({
          data: { publicUrl: 'https://storage.example.com/file.pdf' },
        });

        (saveFileMetadata as jest.Mock).mockResolvedValue({
          id: 'metadata-789',
        });

        const mockFile = new File(['content'], 'document.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);
        formData.append('entityType', 'catering_order');
        formData.append('entityId', 'order-123');
        formData.append('category', 'invoice');

        const request = new Request('http://localhost:3000/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);
        const data = await expectSuccessResponse(response, 200);

        expect(data.file.entityType).toBe('catering_order');
        expect(data.file.entityId).toBe('order-123');
        expect(saveFileMetadata).toHaveBeenCalledWith(
          expect.objectContaining({
            entity_type: 'catering_order',
            entity_id: 'order-123',
            category: 'invoice',
          })
        );
      });

      it('should upload file with custom folder', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-123' },
            },
          },
        });

        mockUpload.mockResolvedValue({
          data: { path: 'custom-folder/file.pdf' },
          error: null,
        });

        mockGetPublicUrl.mockReturnValue({
          data: { publicUrl: 'https://storage.example.com/file.pdf' },
        });

        (saveFileMetadata as jest.Mock).mockResolvedValue({
          id: 'metadata-999',
        });

        const mockFile = new File(['content'], 'document.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);
        formData.append('folder', 'custom-folder');

        const request = new Request('http://localhost:3000/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);
        expect(response.status).toBe(200);
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: null },
        });

        const mockFile = new File(['content'], 'document.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);

        const request = new Request('http://localhost:3000/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);
        await expectUnauthorized(response, /logged in to upload files/i);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 when no file is provided', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-123' },
            },
          },
        });

        const formData = new FormData();

        const request = new Request('http://localhost:3000/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);
        await expectErrorResponse(response, 400, /No file provided/i);
      });

      it('should return 413 when file exceeds size limit', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-123' },
            },
          },
        });

        // Create a file that exceeds 10MB
        const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
        const mockFile = new File([largeContent], 'large-file.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);

        const request = new Request('http://localhost:3000/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);
        await expectErrorResponse(response, 413, /exceeds the 10MB size limit/i);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle storage upload errors', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-123' },
            },
          },
        });

        mockUpload.mockResolvedValue({
          data: null,
          error: { message: 'Storage quota exceeded' },
        });

        const mockFile = new File(['content'], 'document.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);

        const request = new Request('http://localhost:3000/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);
        await expectErrorResponse(response, 500, /Storage quota exceeded/i);
      });

      it('should handle metadata save errors', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-123' },
            },
          },
        });

        mockUpload.mockResolvedValue({
          data: { path: 'user-123/file.pdf' },
          error: null,
        });

        mockGetPublicUrl.mockReturnValue({
          data: { publicUrl: 'https://storage.example.com/file.pdf' },
        });

        (saveFileMetadata as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const mockFile = new File(['content'], 'document.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);

        const request = new Request('http://localhost:3000/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);
        await expectErrorResponse(response, 500, /Database connection failed/i);
      });

      it('should handle unexpected errors', async () => {
        mockSupabaseClient.auth.getSession.mockRejectedValue(
          new Error('Auth service unavailable')
        );

        const mockFile = new File(['content'], 'document.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);

        const request = new Request('http://localhost:3000/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);
        await expectErrorResponse(response, 500);
      });
    });

    describe('📁 File Processing', () => {
      it('should generate unique filenames', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-123' },
            },
          },
        });

        mockUpload.mockResolvedValue({
          data: { path: 'user-123/unique-id.pdf' },
          error: null,
        });

        mockGetPublicUrl.mockReturnValue({
          data: { publicUrl: 'https://storage.example.com/unique-id.pdf' },
        });

        (saveFileMetadata as jest.Mock).mockResolvedValue({
          id: 'metadata-123',
        });

        const mockFile = new File(['content'], 'document.pdf', {
          type: 'application/pdf',
        });

        const formData = new FormData();
        formData.append('file', mockFile);

        const request = new Request('http://localhost:3000/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request as any);
        expect(response.status).toBe(200);

        // Verify unique filename was used in upload
        expect(mockUpload).toHaveBeenCalledWith(
          expect.stringMatching(/user-123\/.+\.pdf$/),
          expect.any(File),
          expect.objectContaining({
            upsert: false,
            contentType: 'application/pdf',
          })
        );
      });

      it('should preserve file extension', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-123' },
            },
          },
        });

        mockUpload.mockResolvedValue({
          data: { path: 'user-123/file.jpg' },
          error: null,
        });

        mockGetPublicUrl.mockReturnValue({
          data: { publicUrl: 'https://storage.example.com/file.jpg' },
        });

        (saveFileMetadata as jest.Mock).mockResolvedValue({
          id: 'metadata-123',
        });

        const mockFile = new File(['image'], 'photo.jpg', {
          type: 'image/jpeg',
        });

        const formData = new FormData();
        formData.append('file', mockFile);

        const request = new Request('http://localhost:3000/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        await POST(request as any);

        expect(mockUpload).toHaveBeenCalledWith(
          expect.stringMatching(/\.jpg$/),
          expect.any(File),
          expect.any(Object)
        );
      });
    });
  });
});
