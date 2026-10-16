import { DriverStatus } from '@/types/user';

/**
 * Mandatory stage photos (decision 2026-06-01, reaffirmed 2026-06-22):
 *
 *   - a photo of the order at the vendor before PICKED_UP, and
 *   - a photo of the setup at the client before COMPLETED.
 *
 * Both are stored as `file_uploads` rows on the order (category below); the
 * orders PATCH route reads them to gate the transition, and the driver detail
 * screen reads the same rows to decide whether to open the capture sheet.
 * Kept dependency-free so both sides share one definition.
 */

/** `file_uploads.category` written by POST /api/orders/[order_number]/pickup-photo. */
export const PICKUP_PHOTO_CATEGORY = 'pickup_photo';
/** `file_uploads.category` written by POST /api/orders/[order_number]/pod. */
export const DELIVERY_PHOTO_CATEGORY = 'proof_of_delivery';
/** `file_uploads.category` written by POST /api/orders/[order_number]/recipient
 *  when the recipient signs at completion. */
export const DELIVERY_SIGNATURE_CATEGORY = 'delivery_signature';

/**
 * Recipient confirmation at completion (same decision): besides the setup
 * photo, COMPLETED requires the recipient's signature OR — when they refuse to
 * sign — their name. Satisfied by a 'delivery_signature' upload, the mirrored
 * `deliveries.delivery_signature_url`, or a non-blank
 * `deliveries.delivery_received_by`.
 */
export const RECIPIENT_REQUIRED_CODE = 'RECIPIENT_REQUIRED';
export const RECIPIENT_REQUIRED_MESSAGE =
  "Get the recipient's signature, or their name if they refuse to sign, before completing the delivery.";

export function hasRecipientConfirmation(input: {
  files?: ReadonlyArray<{ category?: string | null } | null | undefined> | null;
  deliveryReceivedBy?: string | null;
  deliverySignatureUrl?: string | null;
}): boolean {
  return (
    hasUploadInCategory(input.files, DELIVERY_SIGNATURE_CATEGORY) ||
    !!input.deliverySignatureUrl?.trim() ||
    !!input.deliveryReceivedBy?.trim()
  );
}

export type StagePhotoCode = 'PICKUP_PHOTO_REQUIRED' | 'POD_REQUIRED';

export interface StagePhotoRequirement {
  category: string;
  code: StagePhotoCode;
  /** Driver-facing copy, surfaced as-is by the client. */
  message: string;
}

const REQUIREMENTS: Partial<Record<DriverStatus, StagePhotoRequirement>> = {
  [DriverStatus.PICKED_UP]: {
    category: PICKUP_PHOTO_CATEGORY,
    code: 'PICKUP_PHOTO_REQUIRED',
    message: 'Take a photo of the order at the vendor before marking it picked up.',
  },
  [DriverStatus.COMPLETED]: {
    category: DELIVERY_PHOTO_CATEGORY,
    code: 'POD_REQUIRED',
    message: 'Take a photo of the setup before completing the delivery.',
  },
};

/** The photo a driver must have on file before entering `next`, or null. */
export function requiredPhotoForTransition(
  next: DriverStatus | string | null | undefined,
): StagePhotoRequirement | null {
  if (!next) return null;
  return REQUIREMENTS[next as DriverStatus] ?? null;
}

/** True when any upload in `files` carries `category` (case-insensitive). */
export function hasUploadInCategory(
  files: ReadonlyArray<{ category?: string | null } | null | undefined> | null | undefined,
  category: string,
): boolean {
  if (!Array.isArray(files)) return false;
  const wanted = category.trim().toLowerCase();
  return files.some(
    (file) => typeof file?.category === 'string' && file.category.trim().toLowerCase() === wanted,
  );
}
