/**
 * The backfill migration hardcodes the name → code table in SQL. Keep it in
 * lockstep with normalizeStateCode so existing rows and new writes agree.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { normalizeStateCode } from '../state-code';

const MIGRATION = join(
  process.cwd(),
  'prisma/migrations/20261106000000_address_state_usps_code/migration.sql',
);

function mappingPairs(sql: string): Array<[string, string]> {
  return [...sql.matchAll(/\('([A-Z. ]+)',\s*'([A-Z]{2})'\)/g)].map(
    (m) => [m[1]!, m[2]!] as [string, string],
  );
}

describe('address state backfill migration', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  const pairs = mappingPairs(sql);

  it('maps every pair exactly as normalizeStateCode does', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(51);
    for (const [name, code] of pairs) {
      expect([name, normalizeStateCode(name)]).toEqual([name, code]);
    }
  });

  it('covers all 50 states plus DC', () => {
    const codes = new Set(pairs.map(([, code]) => code));
    expect(codes.size).toBeGreaterThanOrEqual(51);
  });

  it('never targets a non-US region', () => {
    const names = pairs.map(([name]) => name);
    expect(names).not.toContain('GUANAJUATO');
    expect(normalizeStateCode('Guanajuato')).toBe('Guanajuato');
  });
});
