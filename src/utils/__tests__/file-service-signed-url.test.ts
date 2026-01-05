// src/utils/__tests__/file-service-signed-url.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Tests for Signed URL Generation
 *
 * These tests verify:
 * - Signed URL generation with custom expiration
 * - Error handling for missing files
 * - URL format and structure
 * - Security considerations
 */

// Module-level mock functions
const mockCreateSignedUrl = jest.fn();
const mockGetPublicUrl = jest.fn();

// Mock Supabase server module with stable mock functions
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn()
}));

// Import after mocking
import { getSignedUrl, getFileUrl } from '@/utils/file-service';
import { createClient, createAdminClient } from '@/utils/supabase/server';

describe('Signed URL Generation', () => {
  beforeEach(() => {
    // Reset mock call history but keep implementations
    jest.clearAllMocks();

    // Setup mock storage client with stable mock functions
    const mockStorageClient = {
      storage: {
        from: jest.fn(() => ({
          createSignedUrl: mockCreateSignedUrl,
          getPublicUrl: mockGetPublicUrl
        }))
      }
    };

    (createClient as jest.Mock).mockResolvedValue(mockStorageClient);
    (createAdminClient as jest.Mock).mockResolvedValue(mockStorageClient);
  });

  describe('getSignedUrl', () => {
    it('should generate a signed URL with default expiration', async () => {
      const mockSignedUrl = 'https://storage.example.com/signed/file.pdf?token=abc123';

      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: mockSignedUrl },
        error: null
      });

      const result = await getSignedUrl('test-bucket', 'path/to/file.pdf');

      expect(result).toBe(mockSignedUrl);
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file.pdf', 60);
    });

    it('should generate a signed URL with custom expiration time', async () => {
      const mockSignedUrl = 'https://storage.example.com/signed/file.pdf?token=xyz789';

      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: mockSignedUrl },
        error: null
      });

      const customExpiresIn = 3600; // 1 hour
      const result = await getSignedUrl('test-bucket', 'path/to/file.pdf', customExpiresIn);

      expect(result).toBe(mockSignedUrl);
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file.pdf', customExpiresIn);
    });

    it('should handle errors when file does not exist', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: null,
        error: { message: 'File not found' }
      });

      // Supabase returns plain objects with message property, not Error instances
      await expect(
        getSignedUrl('test-bucket', 'non-existent-file.pdf')
      ).rejects.toMatchObject({ message: 'File not found' });
    });

    it('should handle errors for invalid bucket name', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: null,
        error: { message: 'Bucket not found' }
      });

      await expect(
        getSignedUrl('invalid-bucket', 'file.pdf')
      ).rejects.toMatchObject({ message: 'Bucket not found' });
    });

    it('should handle permission errors', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: null,
        error: { message: 'Permission denied' }
      });

      await expect(
        getSignedUrl('private-bucket', 'restricted-file.pdf')
      ).rejects.toMatchObject({ message: 'Permission denied' });
    });

    it('should generate different URLs for the same file when called multiple times', async () => {
      const urls = [
        'https://storage.example.com/signed/file.pdf?token=abc123',
        'https://storage.example.com/signed/file.pdf?token=def456',
        'https://storage.example.com/signed/file.pdf?token=ghi789'
      ];

      for (const url of urls) {
        mockCreateSignedUrl.mockResolvedValueOnce({
          data: { signedUrl: url },
          error: null
        });
      }

      const result1 = await getSignedUrl('test-bucket', 'file.pdf');
      const result2 = await getSignedUrl('test-bucket', 'file.pdf');
      const result3 = await getSignedUrl('test-bucket', 'file.pdf');

      expect(result1).not.toBe(result2);
      expect(result2).not.toBe(result3);
      expect(result1).not.toBe(result3);
    });

    it('should handle special characters in file paths', async () => {
      const specialPath = 'uploads/user files/résumé (final).pdf';
      const mockSignedUrl = `https://storage.example.com/signed/${encodeURIComponent(specialPath)}?token=abc123`;

      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: mockSignedUrl },
        error: null
      });

      const result = await getSignedUrl('test-bucket', specialPath);

      expect(result).toBeTruthy();
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(specialPath, 60);
    });
  });

  describe('getFileUrl (Public URLs)', () => {
    it('should generate a public URL for a file', async () => {
      const mockPublicUrl = 'https://storage.example.com/public/file.pdf';

      mockGetPublicUrl.mockReturnValueOnce({
        data: { publicUrl: mockPublicUrl }
      });

      const result = await getFileUrl('test-bucket', 'path/to/file.pdf');

      expect(result).toBe(mockPublicUrl);
      expect(mockGetPublicUrl).toHaveBeenCalledWith('path/to/file.pdf');
    });

    it('should handle errors gracefully', async () => {
      mockGetPublicUrl.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      await expect(
        getFileUrl('test-bucket', 'file.pdf')
      ).rejects.toThrow('Storage error');
    });
  });

  describe('URL Security', () => {
    it('should generate URLs with time-limited access', async () => {
      const shortExpiration = 30; // 30 seconds
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'https://storage.example.com/signed/file.pdf?token=abc123&exp=1234567890' },
        error: null
      });

      await getSignedUrl('test-bucket', 'sensitive-file.pdf', shortExpiration);

      expect(mockCreateSignedUrl).toHaveBeenCalledWith('sensitive-file.pdf', shortExpiration);
    });

    it('should reject negative expiration times', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid expiration time' }
      });

      // Supabase returns plain objects with message property, not Error instances
      await expect(
        getSignedUrl('test-bucket', 'file.pdf', -60)
      ).rejects.toMatchObject({ message: 'Invalid expiration time' });
    });

    it('should handle very long expiration times', async () => {
      const longExpiration = 86400 * 7; // 7 days
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'https://storage.example.com/signed/file.pdf?token=abc123&exp=2000000000' },
        error: null
      });

      const result = await getSignedUrl('test-bucket', 'archive-file.pdf', longExpiration);

      expect(result).toBeTruthy();
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('archive-file.pdf', longExpiration);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should generate signed URLs for job application documents', async () => {
      const documents = [
        'job-applications/123/resume.pdf',
        'job-applications/123/drivers-license.jpg',
        'job-applications/123/insurance.pdf'
      ];

      for (const doc of documents) {
        mockCreateSignedUrl.mockResolvedValueOnce({
          data: { signedUrl: `https://storage.example.com/signed/${doc}?token=${Math.random()}` },
          error: null
        });
      }

      const urls = await Promise.all(
        documents.map(doc => getSignedUrl('job-applications', doc))
      );

      expect(urls).toHaveLength(3);
      urls.forEach(url => {
        expect(url).toContain('https://');
        expect(url).toContain('token=');
      });
    });

    it('should handle batch URL generation efficiently', async () => {
      const fileCount = 10;
      const files = Array.from({ length: fileCount }, (_, i) => `file-${i}.pdf`);

      files.forEach((file, i) => {
        mockCreateSignedUrl.mockResolvedValueOnce({
          data: { signedUrl: `https://storage.example.com/signed/${file}?token=${i}` },
          error: null
        });
      });

      const startTime = Date.now();
      const urls = await Promise.all(
        files.map(file => getSignedUrl('test-bucket', file))
      );
      const endTime = Date.now();

      expect(urls).toHaveLength(fileCount);
      // Should complete in reasonable time (mocked, so should be fast)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should generate URLs for different file types', async () => {
      const fileTypes = [
        { path: 'resume.pdf', type: 'application/pdf' },
        { path: 'photo.jpg', type: 'image/jpeg' },
        { path: 'document.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
      ];

      for (const file of fileTypes) {
        mockCreateSignedUrl.mockResolvedValueOnce({
          data: { signedUrl: `https://storage.example.com/signed/${file.path}?token=abc` },
          error: null
        });
      }

      const urls = await Promise.all(
        fileTypes.map(file => getSignedUrl('uploads', file.path))
      );

      expect(urls).toHaveLength(3);
      urls.forEach((url, index) => {
        expect(url).toContain(fileTypes[index].path);
      });
    });
  });

  describe('Error Recovery', () => {
    it('should throw descriptive errors for network failures', async () => {
      mockCreateSignedUrl.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        getSignedUrl('test-bucket', 'file.pdf')
      ).rejects.toThrow('Network error');
    });

    it('should handle storage service unavailability', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: null,
        error: { message: 'Service unavailable', status: 503 }
      });

      // Supabase returns plain objects with message property, not Error instances
      await expect(
        getSignedUrl('test-bucket', 'file.pdf')
      ).rejects.toMatchObject({ message: 'Service unavailable' });
    });

    it('should handle quota exceeded errors', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: null,
        error: { message: 'Storage quota exceeded' }
      });

      await expect(
        getSignedUrl('test-bucket', 'file.pdf')
      ).rejects.toMatchObject({ message: 'Storage quota exceeded' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file paths by passing to storage API', async () => {
      // Note: Validation for empty paths is done by Supabase storage, not application code
      const mockSignedUrl = 'https://storage.example.com/signed/?token=abc';
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: mockSignedUrl },
        error: null
      });

      const result = await getSignedUrl('test-bucket', '');
      expect(result).toBe(mockSignedUrl);
    });

    it('should handle very long file paths', async () => {
      const longPath = 'a/'.repeat(100) + 'file.pdf';
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: `https://storage.example.com/signed/${longPath}?token=abc` },
        error: null
      });

      const result = await getSignedUrl('test-bucket', longPath);
      expect(result).toBeTruthy();
    });

    it('should handle file paths with query parameters', async () => {
      const pathWithQuery = 'file.pdf?version=1';
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: `https://storage.example.com/signed/file.pdf?version=1&token=abc` },
        error: null
      });

      const result = await getSignedUrl('test-bucket', pathWithQuery);
      expect(result).toContain('token=');
    });

    it('should handle zero expiration time by passing to storage API', async () => {
      // Note: Validation for zero expiration is done by Supabase storage, not application code
      const mockSignedUrl = 'https://storage.example.com/signed/file.pdf?token=abc';
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: mockSignedUrl },
        error: null
      });

      const result = await getSignedUrl('test-bucket', 'file.pdf', 0);
      expect(result).toBe(mockSignedUrl);
    });
  });
});
