import { NextRequest } from 'next/server';
import { handleStagePhotoUpload } from '../pod/stage-photo-upload';

/**
 * POST - Upload the photo of the order taken at the vendor (pickup stage).
 *
 * Mandatory since the 2026-06-01 decision: the orders PATCH route refuses
 * PICKED_UP for a driver until a 'pickup_photo' FileUpload exists on the
 * order. Same auth, validation and storage path as the POD route; see
 * ../pod/stage-photo-upload.ts.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ order_number: string }> }
) {
  return handleStagePhotoUpload(request, context, 'pickup');
}
