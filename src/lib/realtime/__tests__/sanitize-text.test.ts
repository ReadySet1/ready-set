/**
 * Tests for the dependency-free realtime plain-text sanitizer.
 *
 * Regression context: `schemas.ts` used to import `InputSanitizer` from
 * `@/lib/validation`, which top-level imported `isomorphic-dompurify` and
 * constructed a JSDOM window at module evaluation. jsdom is a webpack
 * external, and its html-encoding-sniffer dependency CJS-requires an
 * ESM-only package — so merely importing the realtime schemas broke every
 * /driver SSR with ERR_REQUIRE_ESM. The schemas must sanitize without
 * touching @/lib/validation at all.
 */

// If `../schemas` (or anything it imports) pulls in @/lib/validation again,
// this hoisted mock factory throws and the regression test below fails.
jest.mock('@/lib/validation', () => {
  throw new Error(
    'REGRESSION: @/lib/realtime must not import @/lib/validation (jsdom in the driver SSR graph)',
  );
});

import { sanitizePlainText } from '../sanitize-text';

describe('sanitizePlainText', () => {
  it('passes plain realtime payload strings through unchanged', () => {
    expect(sanitizePlainText('123 Main St, San Francisco')).toBe(
      '123 Main St, San Francisco',
    );
    expect(sanitizePlainText('EN_ROUTE_TO_CLIENT')).toBe('EN_ROUTE_TO_CLIENT');
    expect(sanitizePlainText('Driver dropped keys at front desk.')).toBe(
      'Driver dropped keys at front desk.',
    );
  });

  it('strips HTML tags but keeps their text content', () => {
    expect(sanitizePlainText('<b>urgent</b> delivery')).toBe('urgent delivery');
    expect(sanitizePlainText('<img src=x onerror=alert(1)>note')).toBe('note');
  });

  it('removes script and style blocks including their content', () => {
    expect(sanitizePlainText('<script>alert("xss")</script>hello')).toBe('hello');
    expect(sanitizePlainText('before<style>.x{color:red}</style>after')).toBe(
      'beforeafter',
    );
  });

  it('removes HTML comments', () => {
    expect(sanitizePlainText('a<!-- hidden -->b')).toBe('ab');
  });

  it('preserves non-tag angle brackets', () => {
    expect(sanitizePlainText('1 < 2 > 0')).toBe('1 < 2 > 0');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizePlainText('  padded  ')).toBe('padded');
  });

  it('handles null, undefined, and empty input', () => {
    expect(sanitizePlainText(null)).toBe('');
    expect(sanitizePlainText(undefined)).toBe('');
    expect(sanitizePlainText('')).toBe('');
  });

  it('is idempotent', () => {
    const inputs = [
      '<b>urgent</b> delivery',
      '<script>alert(1)</script>ok',
      '<<b>script>alert(1)<</b>/script>',
      'plain text',
    ];
    for (const input of inputs) {
      const once = sanitizePlainText(input);
      expect(sanitizePlainText(once)).toBe(once);
    }
  });

  it('does not let nested markup reassemble into a tag', () => {
    expect(sanitizePlainText('<<b>script>alert(1)<</b>/script>')).not.toContain(
      '<script>',
    );
  });
});

describe('realtime schemas import graph (ERR_REQUIRE_ESM regression)', () => {
  it('imports @/lib/realtime/schemas without loading @/lib/validation', () => {
    // The jest.mock factory above throws if @/lib/validation is required.
    expect(() => require('../schemas')).not.toThrow();
  });

  it('still sanitizes string payload fields through the schemas', () => {
    const { AdminMessagePayloadSchema } = require('../schemas');
    const parsed = AdminMessagePayloadSchema.parse({
      message: '<b>Return</b> to depot <script>alert(1)</script>now',
    });
    expect(parsed.message).toBe('Return to depot now');
  });
});
