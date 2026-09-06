/**
 * Endpoints removed by the pilot API auth sweep. Each one was reachable
 * without authentication and had no caller in src/ or e2e/:
 *
 * - GET /api/download            — served arbitrary files via an unchecked
 *                                  `path` query param (path traversal).
 * - GET /api/file-uploads/fix-catering-file — hardcoded one-off DB mutation.
 * - POST /api/uploads/image      — mock scaffold, no callers.
 * - getUserFiles server action   — listed any user's files by id.
 */
import { existsSync } from 'fs';
import path from 'path';

const removed = [
  'src/app/api/download/route.ts',
  'src/app/api/file-uploads/fix-catering-file/route.ts',
  'src/app/api/uploads/image/route.ts',
  'src/app/actions/getUserFiles.ts',
];

describe('removed unauthenticated endpoints', () => {
  it.each(removed)('%s no longer exists', (relative) => {
    expect(existsSync(path.join(process.cwd(), relative))).toBe(false);
  });
});
