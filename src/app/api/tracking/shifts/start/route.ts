import { NextRequest, NextResponse } from 'next/server';
import { startDriverShift } from '@/app/actions/tracking/driver-actions';

/**
 * POST /api/tracking/shifts/start
 *
 * Stable API wrapper around the `startDriverShift` logic. The driver client used to
 * invoke the Server Action directly, but server-action digests break when the deployed
 * bundle changes mid-shift ("Server Action not found"), which made starting/ending a
 * shift fail unpredictably during the walk test. A fixed URL is deployment-proof.
 *
 * The underlying function performs its own caller authorization
 * (`callerMayActOnDriver`) and input validation, so this handler stays thin.
 *
 * Body: { driverId: string, location: LocationUpdate, metadata?: object }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { driverId, location, metadata } = body ?? {};

    if (!driverId || !location?.coordinates) {
      return NextResponse.json(
        { success: false, error: 'Missing driverId or location' },
        { status: 400 },
      );
    }

    const result = await startDriverShift(driverId, location, metadata ?? {});
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start shift',
      },
      { status: 500 },
    );
  }
}
