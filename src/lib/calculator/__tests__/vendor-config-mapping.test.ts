/**
 * Tests for vendor-config-mapping.ts
 *
 * Covers:
 * - resolveConfigId (existing functionality)
 * - resolveConfigIdByEmail (new email-domain fallback)
 */

import { resolveConfigId, resolveConfigIdByEmail } from '../vendor-config-mapping';

describe('resolveConfigId', () => {
  it('resolves "try hungry" → "try-hungry"', () => {
    expect(resolveConfigId('try hungry')).toBe('try-hungry');
  });

  it('resolves "Try Hungry - ATX" via partial match', () => {
    expect(resolveConfigId('Try Hungry - ATX')).toBe('try-hungry');
  });

  it('resolves "Destino" → "ready-set-food-standard"', () => {
    expect(resolveConfigId('Destino')).toBe('ready-set-food-standard');
  });

  it('returns null for an unknown vendor', () => {
    expect(resolveConfigId('Unknown Corp')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(resolveConfigId('')).toBeNull();
  });
});

describe('resolveConfigIdByEmail', () => {
  it('resolves "ops@tryhungry.com" → "try-hungry"', () => {
    expect(resolveConfigIdByEmail('ops@tryhungry.com')).toBe('try-hungry');
  });

  it('resolves a subdomain like "user@orders.tryhungry.com" → "try-hungry"', () => {
    expect(resolveConfigIdByEmail('user@orders.tryhungry.com')).toBe('try-hungry');
  });

  it('handles mixed-case email "Ops@TryHungry.COM" → "try-hungry"', () => {
    expect(resolveConfigIdByEmail('Ops@TryHungry.COM')).toBe('try-hungry');
  });

  it('returns null for "someone@gmail.com" (unmapped domain)', () => {
    expect(resolveConfigIdByEmail('someone@gmail.com')).toBeNull();
  });

  it('returns null for null', () => {
    expect(resolveConfigIdByEmail(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(resolveConfigIdByEmail(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(resolveConfigIdByEmail('')).toBeNull();
  });

  it('returns null for a string without @', () => {
    expect(resolveConfigIdByEmail('no-at-sign')).toBeNull();
  });
});
