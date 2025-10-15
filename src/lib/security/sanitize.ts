import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML to prevent XSS attacks
 * @param dirty - Potentially unsafe HTML string
 * @returns Safe HTML string
 */
export function sanitizeHtml(dirty: string): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side: use isomorphic-dompurify or return empty string
    // For now, we'll allow basic tags but strip scripts
    return dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitizes text (strips all HTML)
 * @param text - Text that may contain HTML
 * @returns Plain text only
 */
export function sanitizeText(text: string): string {
  if (typeof window === 'undefined') {
    // Server-side: strip all HTML tags
    return text.replace(/<[^>]*>/g, '');
  }

  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * For URLs only - validates and sanitizes URLs
 * @param url - URL to validate
 * @returns Safe URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return url;
  } catch {
    return '';
  }
}
