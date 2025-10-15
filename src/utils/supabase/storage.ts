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
 * Upload a Proof of Delivery image
 *
 * @param file - The image file to upload (File or Blob)
 * @param deliveryId - The delivery UUID
 * @returns Object with url and optional error message
 */
export async function uploadPODImage(
  file: File | Blob,
  deliveryId: string
): Promise<{ url: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return { url: '', error: 'File too large (max 5MB)' };
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const fileType = file.type || '';
    if (!allowedTypes.includes(fileType)) {
      return { url: '', error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file instanceof File
      ? file.name.split('.').pop() || 'jpg'
      : (fileType.split('/')[1] || 'jpg');
    const filename = `deliveries/${deliveryId}/pod-${timestamp}.${fileExtension}`;

    // Upload to Supabase Storage (order-files bucket)
    const { data, error } = await supabase.storage
      .from('order-files')
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
      .from('order-files')
      .getPublicUrl(data.path);

    return { url: publicUrl };
  } catch (error) {
    console.error('POD upload exception:', error);
    return {
      url: '',
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}