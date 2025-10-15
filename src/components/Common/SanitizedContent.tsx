'use client';

import { sanitizeHtml } from '@/lib/security/sanitize';

interface SanitizedContentProps {
  html: string;
  className?: string;
}

/**
 * Client component that safely renders sanitized HTML content
 * This component runs on the client side where DOMPurify can safely operate
 */
export function SanitizedContent({ html, className }: SanitizedContentProps) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
