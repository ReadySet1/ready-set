import { NextRequest, NextResponse } from 'next/server';
import { getActiveShift } from '@/app/actions/tracking/driver-actions';

/**
 * GET /api/tracking/shifts/active?driverId=<uuid>
 *
 * Stable API wrapper around `getActiveShift` (see the start route for why the shift
 * ops moved off Server Actions — a stale digest also broke the shift-state refresh,
 * making the live-tracking screen flap between active and "Start a shift to begin").
 * The underlying function authorizes the caller (`callerMayActOnDriver`).
 *
 * Returns: { success: true, shift: DriverShift | null }
 */
export async function GET(request: NextRequest) {
  try {
    const driverId = new URL(request.url).searchParams.get('driverId');
    if (!driverId) {
      return NextResponse.json(
        { success: false, error: 'Missing driverId' },
        { status: 400 },
      );
    }

    const shift = await getActiveShift(driverId);
    return NextResponse.json({ success: true, shift });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load shift',
      },
      { status: 500 },
    );
  }
}
