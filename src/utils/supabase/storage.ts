// src/utils/supabase/storage.ts

import { createClient } from '@/utils/supabase/server';

/**
 * Utility class for interacting with Supabase Storage
 *
 * This provides a cleaner interface for handling storage operations
 * while managing the async initialization behind the scenes
 */
export const storage = {
  /**
   * Access a storage bucket
   *
   * @param bucket - Name of the storage bucket
   * @returns A promise that resolves to the bucket interface
   */
  from: async (bucket: string) => {
    const supabase = await createClient();
    const storageClient = supabase.storage;
    const bucketClient = storageClient.from(bucket);

    return {
      /**
       * Upload a file to the bucket
       */
      upload: async (path: string, fileBody: File | Blob | ArrayBuffer | string) => {
        return await bucketClient.upload(path, fileBody);
      },

      /**
       * Remove one or more files from the bucket
       */
      remove: async (paths: string[]) => {
        return await bucketClient.remove(paths);
      },

      /**
       * Get a public URL for a file
       */
      getPublicUrl: (path: string) => {
        return bucketClient.getPublicUrl(path);
      },

      /**
       * Create a signed URL for a file (time-limited access)
       */
      createSignedUrl: async (path: string, expiresIn: number) => {
        return await bucketClient.createSignedUrl(path, expiresIn);
      }
    };
  }
};

/**
 * Storage bucket name for POD images
 */
export const POD_BUCKET_NAME = 'delivery-proofs';

/**
 * Upload a Proof of Delivery image
 *
 * @param file - The image file to upload (File or Blob)
 * @param deliveryId - The delivery UUID
 * @returns Object with url, path, and optional error message
 */
export async function uploadPODImage(
  file: File | Blob,
  deliveryId: string
): Promise<{ url: string; path?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Validate file size (max 2MB - images are compressed client-side)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return { url: '', error: 'File too large (max 2MB)' };
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const fileType = file.type || '';
    if (!allowedTypes.includes(fileType)) {
      return { url: '', error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' };
    }

    // Generate unique filename following the pattern: delivery-{deliveryId}-{timestamp}.jpg
    const timestamp = Date.now();
    const filename = `deliveries/${deliveryId}/delivery-${deliveryId}-${timestamp}.jpg`;

    // Upload to Supabase Storage (delivery-proofs bucket)
    const { data, error } = await supabase.storage
      .from(POD_BUCKET_NAME)
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileType,
      });

    if (error) {
      console.error('POD upload error:', error);
      return { url: '', error: error.message || 'Upload failed' };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(POD_BUCKET_NAME)
      .getPublicUrl(data.path);

    return { url: publicUrl, path: data.path };
  } catch (error) {
    console.error('POD upload exception:', error);
    return {
      url: '',
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

/**
 * Delete a Proof of Delivery image
 *
 * @param path - The storage path of the image to delete
 * @returns Object with success status and optional error
 */
export async function deletePODImage(
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.storage
      .from(POD_BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.error('POD delete error:', error);
      return { success: false, error: error.message || 'Delete failed' };
    }

    return { success: true };
  } catch (error) {
    console.error('POD delete exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed'
    };
  }
}

/**
 * Get a signed URL for a POD image (for private access if needed)
 *
 * @param path - The storage path of the image
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Object with signed URL and optional error
 */
export async function getPODSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<{ url: string; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(POD_BUCKET_NAME)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('POD signed URL error:', error);
      return { url: '', error: error.message || 'Failed to generate URL' };
    }

    return { url: data.signedUrl };
  } catch (error) {
    console.error('POD signed URL exception:', error);
    return {
      url: '',
      error: error instanceof Error ? error.message : 'Failed to generate URL'
    };
  }
}