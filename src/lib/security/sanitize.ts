import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML to prevent XSS attacks
 * NOTE: This function should only be called in client components (use 'client' directive)
 * @param dirty - Potentially unsafe HTML string
 * @returns Safe HTML string
 */
export function sanitizeHtml(dirty: string): string {
  // Ensure we're in a browser environment
  if (typeof window === 'undefined') {
    console.warn('sanitizeHtml called in server environment - returning empty string for safety');
    return '';
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitizes text (strips all HTML)
 * NOTE: This function should only be called in client components (use 'client' directive)
 * @param text - Text that may contain HTML
 * @returns Plain text only
 */
export function sanitizeText(text: string): string {
  // Ensure we're in a browser environment
  if (typeof window === 'undefined') {
    console.warn('sanitizeText called in server environment - returning empty string for safety');
    return '';
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
