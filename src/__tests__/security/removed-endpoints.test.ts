/**
 * Endpoints removed by the pilot API auth sweep. Each one was reachable
 * without authentication and had no caller in src/ or e2e/:
 *
 * - GET /api/download            — served arbitrary files via an unchecked
 *                                  `path` query param (path traversal).
 */
import { existsSync } from 'fs';
import path from 'path';

const removed = [
  'src/app/api/download/route.ts',
];

describe('removed unauthenticated endpoints', () => {
  it.each(removed)('%s no longer exists', (relative) => {
    expect(existsSync(path.join(process.cwd(), relative))).toBe(false);
  });
});
