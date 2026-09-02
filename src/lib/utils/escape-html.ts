/**
 * Escape HTML special characters to prevent XSS when interpolating into HTML.
 *
 * Consolidated from the duplicate implementations in:
 *   - src/app/actions/email.ts (not exported)
 *   - src/lib/tracking/driver-popup.ts (exported)
 *
 * Both call sites now import from this module.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
