import { NextResponse } from 'next/server';

/**
 * Guard for API routes and pages that must never be reachable in production.
 *
 * Usage in an API route handler:
 *
 *   export async function GET(request: NextRequest) {
 *     const blocked = devOnlyGuard();
 *     if (blocked) return blocked;
 *
 *     // ...rest of handler (typically followed by withAuth + SUPER_ADMIN check)
 *   }
 *
 * Returns a 404 response when NODE_ENV === 'production' (treats Vercel
 * staging deployments the same as production). Returns null otherwise so the
 * caller can proceed.
 */
export function devOnlyGuard(): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not Found' },
      { status: 404 },
    );
  }
  return null;
}
