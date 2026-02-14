import { renderHook, act, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

import { useJobApplicationUpload } from '../use-job-application-upload';
import type { UploadedFile } from '../use-job-application-upload';

const mockFetch = global.fetch as jest.Mock;

const mockUploadedFile: UploadedFile = {
  key: 'file-1',
  name: 'resume.pdf',
  url: 'https://example.com/resume.pdf',
  path: 'uploads/resume.pdf',
  size: 1024,
  type: 'application/pdf',
  entityId: 'entity-1',
  category: 'resume',
  bucketName: 'user-assets',
};

function createMockFile(name = 'test.pdf', size = 1024): File {
  const content = 'a'.repeat(size);
  return new File([content], name, { type: 'application/pdf' });
}

describe('useJobApplicationUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useJobApplicationUpload());

      expect(result.current.uploadedFiles).toEqual([]);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.progresses).toEqual({});
      expect(result.current.entityId).toBe('');
    });

    it('should initialize with defaultUploadedFiles', () => {
      const { result } = renderHook(() =>
        useJobApplicationUpload({
          defaultUploadedFiles: [mockUploadedFile],
        })
      );

      expect(result.current.uploadedFiles).toEqual([mockUploadedFile]);
    });

    it('should initialize with provided entityId', () => {
      const { result } = renderHook(() =>
        useJobApplicationUpload({ entityId: 'my-entity' })
      );

      expect(result.current.entityId).toBe('my-entity');
    });
  });

  describe('onUpload', () => {
    it('should upload a file successfully with upload token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          file: {
            id: 'file-new',
            name: 'resume.pdf',
            url: 'https://example.com/resume.pdf',
            path: 'uploads/resume.pdf',
            size: 1024,
            type: 'application/pdf',
            entityId: 'entity-1',
            category: 'resume',
          },
        }),
      });

      const { result } = renderHook(() =>
        useJobApplicationUpload({
          entityType: 'job_application',
          uploadToken: 'token-123',
          entityId: 'entity-1',
          category: 'resume',
        })
      );

      const file = createMockFile();
      let uploaded: UploadedFile[];

      await act(async () => {
        uploaded = await result.current.onUpload([file as any]);
      });

      expect(uploaded!).toHaveLength(1);
      expect(uploaded![0].key).toBe('file-new');
      expect(result.current.uploadedFiles).toHaveLength(1);
      expect(result.current.isUploading).toBe(false);

      // Check that the upload token header was set
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers['x-upload-token']).toBe('token-123');
    });

    it('should upload without upload token for non-job-application types', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          file: {
            id: 'file-new',
            name: 'doc.pdf',
            url: 'https://example.com/doc.pdf',
            path: 'uploads/doc.pdf',
            size: 512,
            type: 'application/pdf',
            entityId: 'entity-1',
            category: 'document',
          },
        }),
      });

      const { result } = renderHook(() =>
        useJobApplicationUpload({
          entityType: 'user',
          entityId: 'entity-1',
        })
      );

      await act(async () => {
        await result.current.onUpload([createMockFile() as any]);
      });

      expect(result.current.uploadedFiles).toHaveLength(1);
    });

    it('should throw error when upload token is missing for job_application', async () => {
      const { result } = renderHook(() =>
        useJobApplicationUpload({
          entityType: 'job_application',
          uploadToken: null,
          entityId: 'entity-1',
        })
      );

      await expect(
        act(async () => {
          await result.current.onUpload([createMockFile() as any]);
        })
      ).rejects.toThrow('Upload session token is required');

      expect(toast.error).toHaveBeenCalled();
    });

    it('should enforce maxFileCount', async () => {
      const { result } = renderHook(() =>
        useJobApplicationUpload({
          maxFileCount: 1,
          defaultUploadedFiles: [mockUploadedFile],
        })
      );

      await act(async () => {
        const uploaded = await result.current.onUpload([createMockFile() as any]);
        expect(uploaded).toEqual([]);
      });

      expect(toast.error).toHaveBeenCalled();
    });

    it('should reject when uploading more files than remaining capacity', async () => {
      const { result } = renderHook(() =>
        useJobApplicationUpload({
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

    it('should handle API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        json: async () => ({ error: 'File too large' }),
      });

      const { result } = renderHook(() =>
        useJobApplicationUpload({
          entityType: 'user',
          entityId: 'entity-1',
        })
      );

      await expect(
        act(async () => {
          await result.current.onUpload([createMockFile() as any]);
        })
      ).rejects.toThrow('File too large');

      expect(result.current.isUploading).toBe(false);
    });

    it('should handle API error when json parse fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON'); },
      });

      const { result } = renderHook(() =>
        useJobApplicationUpload({
          entityType: 'user',
          entityId: 'entity-1',
        })
      );

      await expect(
        act(async () => {
          await result.current.onUpload([createMockFile() as any]);
        })
      ).rejects.toThrow('Failed to upload file');
    });
  });

  describe('updateEntityId', () => {
    it('should PUT to update entity ID and update local state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() =>
        useJobApplicationUpload({
          entityId: 'old-entity',
          entityType: 'job_application',
          defaultUploadedFiles: [mockUploadedFile],
        })
      );

      let success: boolean;
      await act(async () => {
        success = (await result.current.updateEntityId('new-entity')) as boolean;
      });

      expect(success!).toBe(true);
      expect(result.current.entityId).toBe('new-entity');
      expect(result.current.uploadedFiles[0].entityId).toBe('new-entity');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/file-uploads/update-entity',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            oldEntityId: 'old-entity',
            newEntityId: 'new-entity',
            entityType: 'job_application',
          }),
        })
      );
    });

    it('should return false when update fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Update failed' }),
      });

      const { result } = renderHook(() =>
        useJobApplicationUpload({ entityId: 'old-entity' })
      );

      let success: boolean;
      await act(async () => {
        success = (await result.current.updateEntityId('new-entity')) as boolean;
      });

      expect(success!).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('should DELETE file and update local state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() =>
        useJobApplicationUpload({
          defaultUploadedFiles: [mockUploadedFile],
        })
      );

      expect(result.current.uploadedFiles).toHaveLength(1);

      await act(async () => {
        await result.current.deleteFile('file-1');
      });

      expect(result.current.uploadedFiles).toHaveLength(0);
      expect(toast.success).toHaveBeenCalledWith('File deleted successfully');
    });

    it('should throw when delete fails and keep files in state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'File not found' }),
      });

      const { result } = renderHook(() =>
        useJobApplicationUpload({
          defaultUploadedFiles: [mockUploadedFile],
        })
      );

      await expect(
        act(async () => {
          await result.current.deleteFile('file-1');
        })
      ).rejects.toThrow('File not found');

      // File should still be in the list since delete failed
      expect(result.current.uploadedFiles).toHaveLength(1);
    });
  });
});
