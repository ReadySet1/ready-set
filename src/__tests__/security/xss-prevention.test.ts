import { sanitizeHtml, sanitizeText, sanitizeUrl } from '@/lib/security/sanitize';

/**
 * XSS Prevention Test Suite
 *
 * These tests verify that our sanitization functions properly prevent
 * Cross-Site Scripting (XSS) attacks by sanitizing user input.
 */

describe('XSS Prevention', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const malicious = '<script>alert("XSS")</script>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should remove event handlers from elements', () => {
      const malicious = '<img src=x onerror="alert(\'XSS\')">';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('should allow safe HTML tags', () => {
      const safe = '<p>Hello <strong>world</strong></p>';
      const result = sanitizeHtml(safe);
      expect(result).toContain('Hello');
      expect(result).toContain('world');
      // Note: The exact format may vary based on DOMPurify
      expect(result.toLowerCase()).toMatch(/<p>.*<strong>.*world.*<\/strong>.*<\/p>/);
    });

    it('should prevent javascript: URLs in links', () => {
      const malicious = '<a href="javascript:alert(\'XSS\')">Click</a>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('javascript:');
    });

    it('should allow safe links', () => {
      const safe = '<a href="https://example.com">Link</a>';
      const result = sanitizeHtml(safe);
      expect(result).toContain('href');
      expect(result).toContain('https://example.com');
    });

    it('should remove inline styles with javascript', () => {
      const malicious = '<div style="background:url(javascript:alert(\'XSS\'))">Test</div>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('javascript:');
    });

    it('should remove SVG with malicious scripts', () => {
      const malicious = '<svg/onload=alert(\'XSS\')>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('onload');
      expect(result).not.toContain('alert');
    });

    it('should handle multiple XSS attempts', () => {
      const malicious = '<script>alert("XSS")</script><img src=x onerror="alert(\'XSS\')">';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('should handle nested XSS attempts', () => {
      const malicious = '<div><script>alert("XSS")</script></div>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should handle empty input', () => {
      const result = sanitizeHtml('');
      expect(result).toBe('');
    });

    it('should handle plain text without HTML', () => {
      const text = 'This is plain text';
      const result = sanitizeHtml(text);
      expect(result).toBe(text);
    });
  });

  describe('sanitizeText', () => {
    it('should strip all HTML tags', () => {
      const input = '<p>Hello</p><script>alert("XSS")</script>';
      const result = sanitizeText(input);
      expect(result).not.toContain('<p>');
      expect(result).not.toContain('</p>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('Hello');
    });

    it('should remove all HTML including safe tags', () => {
      const input = '<strong>Bold</strong> and <em>italic</em>';
      const result = sanitizeText(input);
      expect(result).not.toContain('<strong>');
      expect(result).not.toContain('<em>');
      expect(result).toContain('Bold');
      expect(result).toContain('italic');
    });

    it('should handle empty input', () => {
      const result = sanitizeText('');
      expect(result).toBe('');
    });

    it('should preserve plain text', () => {
      const text = 'This is plain text';
      const result = sanitizeText(text);
      expect(result).toBe(text);
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow valid HTTP URLs', () => {
      const url = 'http://example.com';
      expect(sanitizeUrl(url)).toBe(url);
    });

    it('should allow valid HTTPS URLs', () => {
      const url = 'https://example.com';
      expect(sanitizeUrl(url)).toBe(url);
    });

    it('should reject javascript: URLs', () => {
      const url = 'javascript:alert("XSS")';
      expect(sanitizeUrl(url)).toBe('');
    });

    it('should reject data: URLs', () => {
      const url = 'data:text/html,<script>alert("XSS")</script>';
      expect(sanitizeUrl(url)).toBe('');
    });

    it('should reject file: URLs', () => {
      const url = 'file:///etc/passwd';
      expect(sanitizeUrl(url)).toBe('');
    });

    it('should reject vbscript: URLs', () => {
      const url = 'vbscript:msgbox("XSS")';
      expect(sanitizeUrl(url)).toBe('');
    });

    it('should handle invalid URLs', () => {
      const url = 'not a valid url';
      expect(sanitizeUrl(url)).toBe('');
    });

    it('should handle empty input', () => {
      expect(sanitizeUrl('')).toBe('');
    });

    it('should allow URLs with query parameters', () => {
      const url = 'https://example.com?foo=bar&baz=qux';
      expect(sanitizeUrl(url)).toBe(url);
    });

    it('should allow URLs with fragments', () => {
      const url = 'https://example.com#section';
      expect(sanitizeUrl(url)).toBe(url);
    });
  });
});

/**
 * Integration Tests: Verify XSS prevention in real-world scenarios
 */
describe('XSS Prevention - Integration', () => {
  it('should handle user-generated content safely', () => {
    const userContent = '<p>My name is <script>alert("XSS")</script>John</p>';
    const sanitized = sanitizeHtml(userContent);

    expect(sanitized).toContain('John');
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('alert');
  });

  it('should handle rich text content safely', () => {
    const richText = `
      <h1>Title</h1>
      <p>Some <strong>bold</strong> text</p>
      <script>alert("XSS")</script>
      <a href="javascript:alert('XSS')">Bad Link</a>
    `;
    const sanitized = sanitizeHtml(richText);

    expect(sanitized).toContain('Title');
    expect(sanitized).toContain('bold');
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('javascript:');
  });

  it('should handle mixed safe and unsafe content', () => {
    const mixed = `
      <p>Safe paragraph</p>
      <img src=x onerror="alert('XSS')">
      <strong>Bold text</strong>
      <iframe src="javascript:alert('XSS')"></iframe>
    `;
    const sanitized = sanitizeHtml(mixed);

    expect(sanitized).toContain('Safe paragraph');
    expect(sanitized).toContain('Bold text');
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('<iframe>');
    expect(sanitized).not.toContain('javascript:');
  });
});
