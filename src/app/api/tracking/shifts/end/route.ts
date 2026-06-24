import { NextRequest, NextResponse } from 'next/server';
import { endDriverShift } from '@/app/actions/tracking/driver-actions';

/**
 * POST /api/tracking/shifts/end
 *
 * Stable API wrapper around `endDriverShift` (see the sibling start route for why the
 * shift ops moved off Server Actions). The underlying function authorizes the caller,
 * enforces the active-delivery guard, and computes shift mileage from the GPS trail.
 *
 * Body: { shiftId: string, location: LocationUpdate, finalMileage?: number, metadata?: object }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { shiftId, location, finalMileage, metadata } = body ?? {};

    if (!shiftId || !location?.coordinates) {
      return NextResponse.json(
        { success: false, error: 'Missing shiftId or location' },
        { status: 400 },
      );
    }

    const result = await endDriverShift(shiftId, location, finalMileage, metadata ?? {});
    // 200 on success; 409 when the active-delivery guard blocks (so the client can
    // surface the "complete your deliveries first" message distinctly); 400 otherwise.
    const status = result.success ? 200 : result.activeDeliveries ? 409 : 400;
    return NextResponse.json(result, { status });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to end shift',
      },
      { status: 500 },
    );
  }
}
