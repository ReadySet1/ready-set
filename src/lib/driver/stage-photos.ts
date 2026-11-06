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

/**
 * Proof of delivery accepts up to this many photos per order (Gary, card
 * `delivery-finalize-multi-photo`); at least one is still required to complete.
 * The pickup photo stays a single, replaceable photo.
 */
export const POD_MAX_PHOTOS = 3;
/** Error code returned by POST /pod when the order already holds POD_MAX_PHOTOS. */
export const POD_PHOTO_LIMIT_CODE = 'POD_PHOTO_LIMIT';

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

type UploadList =
  | ReadonlyArray<{ category?: string | null } | null | undefined>
  | null
  | undefined;

/** Number of uploads in `files` that carry `category` (case-insensitive). */
export function countUploadsInCategory(files: UploadList, category: string): number {
  if (!Array.isArray(files)) return 0;
  const wanted = category.trim().toLowerCase();
  return files.filter(
    (file) => typeof file?.category === 'string' && file.category.trim().toLowerCase() === wanted,
  ).length;
}

/** True when any upload in `files` carries `category` (case-insensitive). */
export function hasUploadInCategory(files: UploadList, category: string): boolean {
  return countUploadsInCategory(files, category) > 0;
}

/** Plain driver copy per orders-PATCH gate code (fallback when the 422 body
 *  carries no message). */
const GATE_FALLBACK_MESSAGES: Record<string, string> = {
  PICKUP_PHOTO_REQUIRED: REQUIREMENTS[DriverStatus.PICKED_UP]!.message,
  POD_REQUIRED: REQUIREMENTS[DriverStatus.COMPLETED]!.message,
  [RECIPIENT_REQUIRED_CODE]: RECIPIENT_REQUIRED_MESSAGE,
  PICKUP_CONFIRMATION_REQUIRED:
    'Record who handed over the order (name) or capture a signature before marking it picked up.',
  SHIFT_REQUIRED: 'Start your shift before working a delivery.',
};

/** Message to show for a gate rejection: the server's, else plain fallback
 *  copy for a known code, else null (caller shows its generic error). */
export function stageGateMessage(
  code: string | null | undefined,
  serverMessage?: string | null,
): string | null {
  if (!code || !(code in GATE_FALLBACK_MESSAGES)) return null;
  return serverMessage?.trim() || GATE_FALLBACK_MESSAGES[code] || null;
}
