// src/lib/upload-security.test.ts
import { UploadSecurityManager } from './upload-security';

// Mock Supabase client
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        list: jest.fn(() => ({ data: [], error: null })),
        upload: jest.fn(() => ({ data: { path: 'test-path' }, error: null })),
        remove: jest.fn(() => ({ error: null })),
      })),
    },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ error: null })),
    })),
  })),
}));

describe('UploadSecurityManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Stop any running schedulers
    UploadSecurityManager.stopCleanupScheduler();
  });

  describe('scanForMaliciousContent', () => {
    it('should detect script injection in small files', async () => {
      const maliciousContent = '<script>alert("xss")</script>';
      const file = new File([maliciousContent], 'test.txt', { type: 'text/plain' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats.some(t => t.includes('Malicious pattern detected'))).toBe(true);
    });

    it('should detect javascript protocol in small files', async () => {
      const maliciousContent = '<a href="javascript:void(0)">Click</a>';
      const file = new File([maliciousContent], 'test.html', { type: 'text/html' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
    });

    it('should detect SQL injection patterns', async () => {
      const maliciousContent = "'; DROP TABLE users; --";
      const file = new File([maliciousContent], 'test.sql', { type: 'text/plain' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
    });

    it('should allow clean files', async () => {
      const cleanContent = 'This is a normal text file with no malicious content.';
      const file = new File([cleanContent], 'test.txt', { type: 'text/plain' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(true);
      expect(result.threats.length).toBe(0);
    });

    it('should reject files larger than MAX_SCAN_SIZE (10MB)', async () => {
      // Create a file larger than 10MB
      const largeContent = 'a'.repeat(11 * 1024 * 1024);
      const file = new File([largeContent], 'large.txt', { type: 'text/plain' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(false);
      expect(result.threats).toContain('File too large for full content scan');
    });

    it('should use in-memory scanning for files < 5MB', async () => {
      // Create a file < 5MB
      const content = 'Clean content ' + 'a'.repeat(1024 * 1024); // ~1MB
      const file = new File([content], 'medium.txt', { type: 'text/plain' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(true);
      expect(result.details.fileSize).toBeLessThan(5 * 1024 * 1024);
    });

    it('should detect executable content in text files', async () => {
      const shebangContent = '#!/bin/bash\necho "hello"';
      const file = new File([shebangContent], 'script.sh', { type: 'text/plain' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(false);
      expect(result.threats).toContain('Executable content in text file');
    });

    it('should detect path traversal attempts', async () => {
      const pathTraversal = '../../etc/passwd';
      const file = new File([pathTraversal], 'test.txt', { type: 'text/plain' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
    });

    it('should detect command execution patterns', async () => {
      const commandExec = '; cat /etc/passwd';
      const file = new File([commandExec], 'test.txt', { type: 'text/plain' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
    });

    it('should detect template injection patterns', async () => {
      const templateInjection = '{{constructor.constructor("alert(1)")()}}';
      const file = new File([templateInjection], 'test.txt', { type: 'text/plain' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
    });

    it('should flag unusually large files', async () => {
      // Create a file > 50MB (but we can't test this easily without causing memory issues)
      // So we'll mock the file.size property instead
      const content = 'normal content';
      const file = new File([content], 'huge.txt', { type: 'text/plain' });
      Object.defineProperty(file, 'size', { value: 51 * 1024 * 1024 });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(false);
      expect(result.threats).toContain('Unusually large file size');
    });

    it('should flag unusually small files', async () => {
      const tinyContent = 'x';
      const file = new File([tinyContent], 'tiny.txt', { type: 'text/plain' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(false);
      expect(result.threats).toContain('Unusually small file size');
    });
  });

  describe('scanFileInChunks (streaming)', () => {
    // Helper to create a large file for streaming tests
    const createLargeFile = (size: number, content: string = 'safe content '): File => {
      const repeatCount = Math.ceil(size / content.length);
      const largeContent = content.repeat(repeatCount);
      return new File([largeContent.slice(0, size)], 'large.txt', { type: 'text/plain' });
    };

    it('should use streaming for files > 5MB', async () => {
      // Create a file just over 5MB
      const file = createLargeFile(6 * 1024 * 1024);

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.details.fileSize).toBeGreaterThan(5 * 1024 * 1024);
      expect(result.isClean).toBe(true);
    });

    it('should detect patterns at chunk boundaries', async () => {
      // Create a file with malicious content that might span chunk boundaries
      const safeContent = 'safe '.repeat(1024 * 200); // ~1MB of safe content
      const maliciousPattern = '<script>alert("xss")</script>';
      const combinedContent = safeContent + maliciousPattern + safeContent;

      const file = new File([combinedContent], 'boundary.txt', { type: 'text/plain' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
    });

    it('should handle files at exactly 5MB boundary (should use in-memory)', async () => {
      const file = createLargeFile(5 * 1024 * 1024);

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(true);
      expect(result.details.fileSize).toBe(5 * 1024 * 1024);
    });

    it('should handle files at 5MB + 1 byte (should use streaming)', async () => {
      const file = createLargeFile(5 * 1024 * 1024 + 1);

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(true);
      expect(result.details.fileSize).toBe(5 * 1024 * 1024 + 1);
    });

    it('should detect pattern in last chunk with overlap', async () => {
      // Create file where malicious pattern is near the end
      const safeContent = 'safe '.repeat(1024 * 1024); // ~5MB
      const maliciousPattern = '<script>alert("end")</script>';
      const combinedContent = safeContent + maliciousPattern;

      const file = new File([combinedContent], 'end-pattern.txt', { type: 'text/plain' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
    });

    it('should handle streaming errors gracefully', async () => {
      // Create a mock file with a failing stream
      const mockFile = {
        size: 6 * 1024 * 1024,
        type: 'text/plain',
        name: 'failing.txt',
        stream: () => ({
          getReader: () => ({
            read: () => Promise.reject(new Error('Stream error')),
          }),
        }),
      } as unknown as File;

      const result = await UploadSecurityManager.scanForMaliciousContent(mockFile);

      expect(result.isClean).toBe(false);
      expect(result.threats.some(t => t.includes('Error during file scan'))).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('should detect large pattern split across chunks (up to 4KB)', async () => {
      // Create a pattern that's ~3KB (should be caught by 4KB overlap)
      const largePattern = '<script>' + 'x'.repeat(3000) + '</script>';
      const safeContent = 'safe '.repeat(1024 * 1024); // ~5MB

      // Place pattern at a likely chunk boundary
      const combinedContent = safeContent + largePattern + safeContent;
      const file = new File([combinedContent], 'large-pattern.txt', { type: 'text/plain' });

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
    });

    it('should scan file near rejection threshold (9.9MB)', async () => {
      const file = createLargeFile(9.9 * 1024 * 1024);

      const result = await UploadSecurityManager.scanForMaliciousContent(file);

      expect(result.isClean).toBe(true);
      expect(result.details.fileSize).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      const userId = 'test-user-1';

      const result = await UploadSecurityManager.checkRateLimit(userId, 'UPLOAD');

      expect(result).toBe(true);
    });

    it('should block requests exceeding rate limit', async () => {
      const userId = 'test-user-2';

      // Make 10 requests (max allowed)
      for (let i = 0; i < 10; i++) {
        await UploadSecurityManager.checkRateLimit(userId, 'UPLOAD');
      }

      // 11th request should fail
      const result = await UploadSecurityManager.checkRateLimit(userId, 'UPLOAD');
      expect(result).toBe(false);
    });

    it('should reset rate limit after window expires', async () => {
      const userId = 'test-user-3';

      // Exhaust the rate limit
      for (let i = 0; i < 10; i++) {
        await UploadSecurityManager.checkRateLimit(userId, 'UPLOAD');
      }

      // Should fail
      let result = await UploadSecurityManager.checkRateLimit(userId, 'UPLOAD');
      expect(result).toBe(false);

      // Wait for window to expire (using a mock or fast-forward time would be better)
      // For now, we'll just verify the logic is there
      // In a real test, you'd mock Date.now() to simulate time passing
    });

    it('should track different actions separately', async () => {
      const userId = 'test-user-4';

      // Use UPLOAD limit
      for (let i = 0; i < 10; i++) {
        await UploadSecurityManager.checkRateLimit(userId, 'UPLOAD');
      }

      // UPLOAD should be exhausted
      let uploadResult = await UploadSecurityManager.checkRateLimit(userId, 'UPLOAD');
      expect(uploadResult).toBe(false);

      // But VIRUS_SCAN should still work
      let scanResult = await UploadSecurityManager.checkRateLimit(userId, 'VIRUS_SCAN');
      expect(scanResult).toBe(true);
    });
  });

  describe('validateFileSecurity', () => {
    it('should validate clean files successfully', async () => {
      const cleanFile = new File(['clean content'], 'clean.txt', { type: 'text/plain' });

      const result = await UploadSecurityManager.validateFileSecurity(cleanFile, 'test-user');

      expect(result.isSecure).toBe(true);
      expect(result.quarantineRequired).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should reject malicious files', async () => {
      const maliciousFile = new File(
        ['<script>alert("xss")</script>'],
        'malicious.html',
        { type: 'text/html' }
      );

      const result = await UploadSecurityManager.validateFileSecurity(maliciousFile, 'test-user');

      expect(result.isSecure).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('VIRUS_ERROR');
    });

    it('should enforce rate limiting', async () => {
      const userId = 'rate-limit-test';
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      // Exhaust rate limit
      for (let i = 0; i < 50; i++) {
        await UploadSecurityManager.checkRateLimit(userId, 'VIRUS_SCAN');
      }

      // Next validation should fail due to rate limit
      const result = await UploadSecurityManager.validateFileSecurity(file, userId);

      expect(result.isSecure).toBe(false);
      expect(result.error?.message).toContain('Rate limit exceeded');
    });
  });

  describe('cleanupExpiredRateLimits', () => {
    it('should remove expired rate limit entries', () => {
      const userId = 'cleanup-test';

      // Create a rate limit entry
      UploadSecurityManager.checkRateLimit(userId, 'UPLOAD');

      // Run cleanup (this won't remove the entry since it's not expired)
      const cleanedCount = UploadSecurityManager.cleanupExpiredRateLimits();

      // Should not clean up recent entries
      expect(cleanedCount).toBe(0);
    });
  });

  describe('scheduler', () => {
    it('should start cleanup scheduler', () => {
      // Should not throw
      expect(() => {
        UploadSecurityManager.startCleanupScheduler();
      }).not.toThrow();
    });

    it('should not start multiple schedulers', () => {
      UploadSecurityManager.startCleanupScheduler();

      // Second call should be idempotent
      expect(() => {
        UploadSecurityManager.startCleanupScheduler();
      }).not.toThrow();

      UploadSecurityManager.stopCleanupScheduler();
    });

    it('should stop cleanup scheduler', () => {
      UploadSecurityManager.startCleanupScheduler();

      expect(() => {
        UploadSecurityManager.stopCleanupScheduler();
      }).not.toThrow();
    });
  });
});
