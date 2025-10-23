// src/utils/__tests__/file-service.test.ts
import { describe, it, expect } from '@jest/globals';

// Import the sanitizeFilename function from the FileValidator class
import { FileValidator } from '@/lib/upload-error-handler';

describe('FileValidator.sanitizeFilename', () => {
  describe('Path Traversal Protection', () => {
    it('should remove path separators', () => {
      const input = '../../../etc/passwd.txt';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).not.toContain('/');
      expect(result).not.toContain('\\');
    });

    it('should replace dot-dot patterns with underscores', () => {
      const input = 'file..name.pdf';
      const result = FileValidator.sanitizeFilename(input);
      // The function extracts extension first, then replaces .. in the name part
      expect(result).not.toContain('..');
      expect(result).toMatch(/\.pdf$/);
    });

    it('should handle complex path traversal attempts', () => {
      const input = '..\\..\\..\\system32\\malware.exe';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).not.toContain('\\');
      expect(result).not.toContain('..');
    });
  });

  describe('Special Character Handling', () => {
    it('should remove control characters', () => {
      const input = 'file\x00name.txt';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).not.toContain('\x00');
    });

    it('should remove dangerous characters', () => {
      const input = 'file<>:"|?*.txt';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain(':');
      expect(result).not.toContain('"');
      expect(result).not.toContain('|');
      expect(result).not.toContain('?');
      expect(result).not.toContain('*');
    });

    it('should preserve safe special characters', () => {
      const input = 'My Document - Draft (Final) v2.pdf';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).toContain(' ');
      expect(result).toContain('-');
      expect(result).toContain('(');
      expect(result).toContain(')');
    });

    it('should preserve hyphens and underscores', () => {
      const input = 'my-file_name-2024.pdf';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).toBe('my-file_name-2024.pdf');
    });

    it('should handle unicode characters properly', () => {
      const input = 'résumé_español_日本語.pdf';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).toContain('résumé');
      expect(result).toContain('español');
      expect(result).toContain('日本語');
    });
  });

  describe('Extension Preservation', () => {
    it('should preserve file extensions', () => {
      const input = 'document.pdf';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).toMatch(/\.pdf$/);
    });

    it('should preserve multi-dot extensions', () => {
      const input = 'archive.tar.gz';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).toMatch(/\.gz$/);
    });

    it('should handle filenames with multiple dots', () => {
      const input = 'my.document.v1.2.pdf';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).toMatch(/\.pdf$/);
      expect(result).toContain('my');
    });

    it('should handle files without extensions', () => {
      const input = 'README';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).toBe('README');
    });
  });

  describe('Length Handling', () => {
    it('should truncate long filenames', () => {
      const longName = 'a'.repeat(400) + '.pdf';
      const result = FileValidator.sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(300);
      expect(result).toMatch(/\.pdf$/);
    });

    it('should preserve extension when truncating', () => {
      const longName = 'my_very_long_document_name_'.repeat(20) + '.pdf';
      const result = FileValidator.sanitizeFilename(longName);
      expect(result).toMatch(/\.pdf$/);
      expect(result.length).toBeLessThanOrEqual(300);
    });

    it('should handle short filenames without truncation', () => {
      const input = 'short.pdf';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).toBe('short.pdf');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle Windows-style paths', () => {
      const input = 'C:\\Users\\Documents\\resume.pdf';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).not.toContain('\\');
      expect(result).not.toContain(':');
      expect(result).toMatch(/resume\.pdf$/);
    });

    it('should handle common filename patterns', () => {
      const testCases = [
        'Resume 2024.pdf',
        'Driver License (Front).jpg',
        'Insurance_Card.png',
        'Vehicle-Registration-2024.pdf',
        'Food Handler Card (Valid).pdf'
      ];

      testCases.forEach(input => {
        const result = FileValidator.sanitizeFilename(input);
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(0);
        // Should preserve the structure and extension
        const ext = input.split('.').pop();
        expect(result).toContain(`.${ext}`);
      });
    });

    it('should handle files from different operating systems', () => {
      const inputs = [
        '/home/user/documents/resume.pdf',
        '~/Downloads/license.jpg',
        'C:\\Users\\Public\\Documents\\insurance.pdf'
      ];

      inputs.forEach(input => {
        const result = FileValidator.sanitizeFilename(input);
        // Should remove path separators
        expect(result).not.toContain('/');
        expect(result).not.toContain('\\');
        // Should remove colons (dangerous character)
        expect(result).not.toContain(':');
        // Extension should be preserved
        const ext = input.split('.').pop();
        if (ext) {
          expect(result).toContain(`.${ext}`);
        }
      });
    });

    it('should handle empty or whitespace-only names gracefully', () => {
      const result1 = FileValidator.sanitizeFilename('.pdf');
      expect(result1).toBe('.pdf');

      const result2 = FileValidator.sanitizeFilename('   .pdf');
      expect(result2).toBeTruthy();
    });

    it('should prevent null byte injection', () => {
      const input = 'malicious\x00.pdf.exe';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).not.toContain('\x00');
    });
  });

  describe('Edge Cases', () => {
    it('should handle filenames with only special characters', () => {
      const input = '@@##$$.pdf';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).toMatch(/\.pdf$/);
    });

    it('should handle consecutive special characters', () => {
      const input = 'file---___...pdf';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).toBeTruthy();
    });

    it('should handle mixed case filenames', () => {
      const input = 'MyResuME_2024.PDF';
      const result = FileValidator.sanitizeFilename(input);
      expect(result).toContain('MyResuME');
      expect(result).toMatch(/\.PDF$/);
    });
  });
});
