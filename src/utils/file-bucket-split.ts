/**
 * Pure helpers for routing file_uploads rows to the correct storage bucket
 * when generating signed URLs.
 *
 * POD artifacts (proof-of-delivery photos and pickup signatures) are uploaded
 * to the dedicated 'delivery-proofs' bucket (POD_BUCKET_NAME in
 * src/utils/supabase/storage.ts); every other upload lives in the default
 * 'fileUploader' bucket (STORAGE_BUCKETS.DEFAULT in src/utils/file-service.ts).
 * Signing a POD path against the default bucket yields a URL that 404s, so
 * callers must split paths per bucket, sign each group against its own
 * bucket, and merge the results.
 *
 * Kept dependency-free so it can be unit tested without mocking Supabase.
 */

/**
 * Categories written by the POD and pickup-signature upload routes
 * (`prisma.fileUpload.create` in src/app/api/orders/[order_number]/pod and
 * .../signature). Matched case-insensitively for safety.
 */
export const POD_FILE_CATEGORIES = ['proof_of_delivery', 'pickup_signature'] as const;

export function isPodFileCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  return (POD_FILE_CATEGORIES as readonly string[]).includes(
    category.trim().toLowerCase(),
  );
}

export interface BucketPathSplit {
  /** filePaths stored in the POD bucket ('delivery-proofs'). */
  podPaths: string[];
  /** filePaths stored in the default bucket ('fileUploader'). */
  defaultPaths: string[];
}

export function splitFilePathsByBucket(
  files: ReadonlyArray<{ filePath: string | null; category: string | null }>,
): BucketPathSplit {
  const podPaths: string[] = [];
  const defaultPaths: string[] = [];
  for (const file of files) {
    if (!file.filePath) continue;
    if (isPodFileCategory(file.category)) {
      podPaths.push(file.filePath);
    } else {
      defaultPaths.push(file.filePath);
    }
  }
  return { podPaths, defaultPaths };
}

/**
 * Merge per-bucket signed-URL maps (keyed by filePath) into one lookup so the
 * caller's path -> URL mapping is unchanged from the single-bucket days.
 */
export function mergeSignedUrlMaps(
  ...maps: ReadonlyArray<ReadonlyMap<string, string>>
): Map<string, string> {
  const merged = new Map<string, string>();
  for (const map of maps) {
    for (const [path, url] of map) {
      merged.set(path, url);
    }
  }
  return merged;
}
