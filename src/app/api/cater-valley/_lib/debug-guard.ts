/**
 * Helpers for the CaterValley debug + catch-all routes.
 *
 * The original versions echoed every request header (including x-api-key)
 * and the full body back in the JSON response. In production that's a
 * credential disclosure surface — anyone who can reach the URL can see
 * what credentials another caller used. These helpers keep the routes
 * useful for local development while neutralizing them in production.
 */

const REDACTED = '<redacted>';
const SENSITIVE_HEADERS = new Set<string>([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-readyset-signature',
  'partner',
  'proxy-authorization',
]);

export function isDebugEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Returns headers safe to echo back. Sensitive header values are replaced
 * with `<redacted>`, and the rest are passed through. Used only in the
 * non-production branch of debug routes — production never echoes
 * headers at all.
 */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? REDACTED : value;
  }
  return out;
}
