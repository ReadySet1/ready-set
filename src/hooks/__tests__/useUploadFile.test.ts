import { renderHook, act, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

jest.mock('@/lib/upload-error-handler', () => {
  const mockValidationError = {
    type: 'validation',
    code: 'INVALID_FILE',
    message: 'Validation failed',
    userMessage: 'File is invalid',
    retryable: false,
    timestamp: new Date(),
  };

  return {
    UploadErrorHandler: {
      categorizeError: jest.fn(() => ({
        type: 'network',
        code: 'NETWORK_ERROR',
        message: 'Network error',
        userMessage: 'Upload failed due to network error',
        retryable: true,
        timestamp: new Date(),
      })),
      logError: jest.fn(),
      createValidationError: jest.fn(() => mockValidationError),
    },
    RetryHandler: {
      withRetry: jest.fn(async (fn: () => Promise<any>) => fn()),
    },
    FileValidator: {
      validateFile: jest.fn(() => null), // null = valid
    },
    DEFAULT_RETRY_CONFIG: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
    },
    DEFAULT_VALIDATION_CONFIG: {
      maxSize: 10 * 1024 * 1024,
      allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
    },
  };
});

import { useUploadFile } from '../use-upload-file';
import type { UploadedFile } from '../use-upload-file';
import { FileValidator, RetryHandler, UploadErrorHandler } from '@/lib/upload-error-handler';

const mockFileValidator = FileValidator.validateFile as jest.Mock;
const mockRetryHandler = RetryHandler.withRetry as jest.Mock;

// Use local fetch mock
let mockFetch: jest.Mock;

const mockUploadedFile: UploadedFile = {
  key: 'file-1',
  name: 'photo.jpg',
  url: 'https://example.com/photo.jpg',
  size: 2048,
  type: 'image/jpeg',
  entityId: 'entity-1',
  category: 'photo',
  bucketName: 'fileUploader',
};

function createMockFile(name = 'test.pdf', size = 1024, type = 'application/pdf'): File {
  const content = 'a'.repeat(size);
  return new File([content], name, { type });
}

// Helper: mock response for fetchExistingFiles (mount)
function mockMountFetch() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, files: [] }),
  });
}

describe('useUploadFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileValidator.mockReturnValue(null); // Valid by default
    mockRetryHandler.mockImplementation(async (fn: () => Promise<any>) => fn());
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  describe('initial state', () => {
    it('should initialize with default values', () => {
      // No entityId -> fetchExistingFiles skips -> no fetch call needed
      const { result } = renderHook(() => useUploadFile());

      expect(result.current.uploadedFiles).toEqual([]);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.progresses).toEqual({});
      expect(result.current.uploadSession).toBeNull();
      expect(result.current.entityId).toBe('');
    });

    it('should initialize with provided entityId', () => {
      mockMountFetch(); // entityId provided -> fetchExistingFiles will call fetch

      const { result } = renderHook(() =>
        useUploadFile({ entityId: 'my-entity' })
      );

      expect(result.current.entityId).toBe('my-entity');
    });

    it('should generate tempEntityId when no entityId is provided', async () => {
      const { result } = renderHook(() => useUploadFile());

      await waitFor(() => {
        expect(result.current.tempEntityId).toBeTruthy();
      });

      expect(result.current.tempEntityId).toContain('temp-');
    });

    it('should initialize with defaultUploadedFiles', () => {
      const { result } = renderHook(() =>
        useUploadFile({
          defaultUploadedFiles: [mockUploadedFile],
        })
      );

      expect(result.current.uploadedFiles).toEqual([mockUploadedFile]);
    });
  });

  describe('onUpload (batch)', () => {
    it('should upload a single file via POST', async () => {
      mockMountFetch(); // entityId provided

      const { result } = renderHook(() =>
        useUploadFile({ entityId: 'entity-1', entityType: 'user' })
      );

      await waitFor(() => {
        expect(result.current.entityId).toBe('entity-1');
      });

      // Upload fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          file: {
            id: 'new-file',
            name: 'test.pdf',
            url: 'https://example.com/test.pdf',
            path: 'uploads/test.pdf',
            size: 1024,
            type: 'application/pdf',
            entityId: 'entity-1',
            category: null,
            bucketName: 'fileUploader',
          },
        }),
      });

      let uploaded: UploadedFile[];
      await act(async () => {
        uploaded = await result.current.onUpload([createMockFile() as any]);
      });

      expect(uploaded!).toHaveLength(1);
      expect(uploaded![0].key).toBe('new-file');
      expect(result.current.uploadedFiles).toHaveLength(1);
      expect(result.current.isUploading).toBe(false);
    });

    it('should enforce maxFileCount', async () => {
      // No entityId -> no mount fetch needed
      const { result } = renderHook(() =>
        useUploadFile({
          maxFileCount: 2,
          defaultUploadedFiles: [mockUploadedFile],
        })
      );

      await act(async () => {
        const uploaded = await result.current.onUpload([
          createMockFile('a.pdf') as any,
          createMockFile('b.pdf') as any,
        ]);
        expect(uploaded).toEqual([]);
      });

      expect(toast.error).toHaveBeenCalled();
    });

    it('should replace file when maxFileCount is 1 and uploading 1 file', async () => {
      // No entityId -> no mount fetch
      const { result } = renderHook(() =>
        useUploadFile({
          maxFileCount: 1,
          defaultUploadedFiles: [mockUploadedFile],
        })
      );

      await waitFor(() => {
        expect(result.current.tempEntityId).toBeTruthy();
      });

      // Delete existing file
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      // Upload new file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          file: {
            id: 'replaced-file',
            name: 'new.pdf',
            url: 'https://example.com/new.pdf',
            path: 'uploads/new.pdf',
            size: 512,
            type: 'application/pdf',
            entityId: 'entity-1',
            bucketName: 'fileUploader',
          },
        }),
      });

      await act(async () => {
        await result.current.onUpload([createMockFile('new.pdf') as any]);
      });

      expect(result.current.uploadedFiles).toHaveLength(1);
      expect(result.current.uploadedFiles[0].key).toBe('replaced-file');
    });

    it('should skip invalid files and continue with valid ones', async () => {
      mockMountFetch();

      // First file is invalid, second is valid
      mockFileValidator
        .mockReturnValueOnce({
          type: 'validation',
          code: 'FILE_TOO_LARGE',
          message: 'File too large',
          userMessage: 'File exceeds maximum size',
          retryable: false,
        })
        .mockReturnValueOnce(null);

      const { result } = renderHook(() =>
        useUploadFile({ entityId: 'entity-1', maxFileCount: 5 })
      );

      await waitFor(() => {
        expect(result.current.entityId).toBe('entity-1');
      });

      // Upload for the valid file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          file: {
            id: 'valid-file',
            name: 'valid.pdf',
            url: 'https://example.com/valid.pdf',
            path: 'uploads/valid.pdf',
            size: 512,
            type: 'application/pdf',
            entityId: 'entity-1',
            bucketName: 'fileUploader',
          },
        }),
      });

      await act(async () => {
        const uploaded = await result.current.onUpload([
          createMockFile('big.pdf', 20 * 1024 * 1024) as any,
          createMockFile('valid.pdf') as any,
        ]);
        expect(uploaded).toHaveLength(1);
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('File exceeds maximum size')
      );
    });

    it('should handle upload API error with retry', async () => {
      mockMountFetch();

      // Make retry handler throw
      mockRetryHandler.mockRejectedValueOnce({ error: 'Server error' });

      const { result } = renderHook(() =>
        useUploadFile({ entityId: 'entity-1', maxFileCount: 5 })
      );

      await waitFor(() => {
        expect(result.current.entityId).toBe('entity-1');
      });

      await act(async () => {
        const uploaded = await result.current.onUpload([createMockFile() as any]);
        expect(uploaded).toHaveLength(0);
      });

      expect(UploadErrorHandler.categorizeError).toHaveBeenCalled();
    });

    it('should handle invalid server response (success: false)', async () => {
      mockMountFetch();

      // Retry handler returns the response
      mockRetryHandler.mockImplementationOnce(async (fn: () => Promise<any>) => fn());

      const { result } = renderHook(() =>
        useUploadFile({ entityId: 'entity-1', maxFileCount: 5 })
      );

      await waitFor(() => {
        expect(result.current.entityId).toBe('entity-1');
      });

      // Upload returns success: false
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Invalid response' }),
      });

      await act(async () => {
        const uploaded = await result.current.onUpload([createMockFile() as any]);
        expect(uploaded).toHaveLength(0);
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid server response')
      );
    });
  });

  describe('updateEntityId', () => {
    it('should PUT to update entity ID and update local state', async () => {
      // Use URL-based routing because the init effect re-runs multiple times.
      // fetchExistingFiles re-runs after entityId changes, so return files matching the requested entityId.
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('/api/file-uploads/update-entity')) {
          return { ok: true, json: async () => ({}) };
        }
        // Default: fetchExistingFiles — reflect entityId from URL params
        const parsedUrl = new URL(url, 'http://localhost');
        const reqEntityId = parsedUrl.searchParams.get('entityId') || 'entity-1';
        return {
          ok: true,
          json: async () => ({
            success: true,
            files: [{ ...mockUploadedFile, entityId: reqEntityId }],
          }),
        };
      });

      const { result } = renderHook(() =>
        useUploadFile({
          entityId: 'old-entity',
          entityType: 'user',
          defaultUploadedFiles: [mockUploadedFile],
        })
      );

      await waitFor(() => {
        expect(result.current.uploadedFiles).toHaveLength(1);
      });

      let success: boolean;
      await act(async () => {
        success = (await result.current.updateEntityId('new-entity')) as boolean;
      });

      expect(success!).toBe(true);
      expect(result.current.entityId).toBe('new-entity');

      await waitFor(() => {
        expect(result.current.uploadedFiles[0].entityId).toBe('new-entity');
      });
    });

    it('should return false when update fails', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('/api/file-uploads/update-entity')) {
          return { ok: false, json: async () => ({ error: 'Update failed' }) };
        }
        return {
          ok: true,
          json: async () => ({ success: true, files: [] }),
        };
      });

      const { result } = renderHook(() =>
        useUploadFile({ entityId: 'old-entity' })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      let success: boolean;
      await act(async () => {
        success = (await result.current.updateEntityId('new-entity')) as boolean;
      });

      expect(success!).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('should DELETE file via API and update local state', async () => {
      // No entityId -> no mount fetch
      const { result } = renderHook(() =>
        useUploadFile({
          defaultUploadedFiles: [mockUploadedFile],
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await act(async () => {
        await result.current.deleteFile('file-1');
      });

      expect(result.current.uploadedFiles).toHaveLength(0);
      expect(toast.success).toHaveBeenCalledWith('File deleted successfully');
    });

    it('should throw when delete fails', async () => {
      // No entityId -> no mount fetch
      const { result } = renderHook(() =>
        useUploadFile({
          defaultUploadedFiles: [mockUploadedFile],
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'File not found' }),
      });

      await expect(
        act(async () => {
          await result.current.deleteFile('file-1');
        })
      ).rejects.toThrow('File not found');
    });
  });

  describe('deleteFileWithSupabase', () => {
    it('should get file info, delete from storage, then delete from DB', async () => {
      // No entityId -> no mount fetch
      const { result } = renderHook(() =>
        useUploadFile({
          defaultUploadedFiles: [mockUploadedFile],
        })
      );

      // Get file info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          fileUrl: 'https://storage.supabase.co/user-assets/uploads/photo.jpg',
        }),
      });

      // Delete from DB
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await act(async () => {
        await result.current.deleteFileWithSupabase('file-1');
      });

      expect(result.current.uploadedFiles).toHaveLength(0);
      expect(toast.success).toHaveBeenCalledWith('File deleted successfully');
    });

    it('should throw when file info fetch fails', async () => {
      const { result } = renderHook(() =>
        useUploadFile({
          defaultUploadedFiles: [mockUploadedFile],
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'File not found' }),
      });

      await expect(
        act(async () => {
          await result.current.deleteFileWithSupabase('file-1');
        })
      ).rejects.toThrow('File not found');
    });
  });

  describe('cancelUpload', () => {
    it('should reset upload state', async () => {
      const { result } = renderHook(() => useUploadFile());

      await act(async () => {
        result.current.cancelUpload();
      });

      expect(result.current.isUploading).toBe(false);
      expect(result.current.progresses).toEqual({});
    });
  });

  describe('retryFailedUploads', () => {
    it('should return empty array when no upload session exists', async () => {
      const { result } = renderHook(() => useUploadFile());

      let retried: UploadedFile[];
      await act(async () => {
        retried = await result.current.retryFailedUploads();
      });

      expect(retried!).toEqual([]);
    });
  });
});
