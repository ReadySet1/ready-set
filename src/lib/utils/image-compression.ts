'use client';

import imageCompression from 'browser-image-compression';
import {
  ImageCompressionOptions,
  DEFAULT_POD_COMPRESSION_OPTIONS,
  POD_VALIDATION_CONSTRAINTS,
} from '@/types/proof-of-delivery';

/**
 * Validation error for image files
 */
export class ImageValidationError extends Error {
  constructor(
    message: string,
    public readonly code: 'SIZE_TOO_LARGE' | 'SIZE_TOO_SMALL' | 'INVALID_TYPE' | 'INVALID_DIMENSIONS'
  ) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

/**
 * Result of image validation
 */
export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: ImageValidationError['code'];
}

/**
 * Result of image compression
 */
export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  wasCompressed: boolean;
}

/**
 * Validates an image file before compression
 * @param file - The file to validate
 * @returns Validation result with error details if invalid
 */
export function validateImageFile(file: File): ImageValidationResult {
  // Check file type
  const allowedTypes: readonly string[] = POD_VALIDATION_CONSTRAINTS.allowedMimeTypes;
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}`,
      errorCode: 'INVALID_TYPE',
    };
  }

  // Check file size (max before compression)
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > POD_VALIDATION_CONSTRAINTS.maxFileSizeMB) {
    return {
      valid: false,
      error: `File too large: ${fileSizeMB.toFixed(2)}MB. Maximum allowed: ${POD_VALIDATION_CONSTRAINTS.maxFileSizeMB}MB`,
      errorCode: 'SIZE_TOO_LARGE',
    };
  }

  if (fileSizeMB < POD_VALIDATION_CONSTRAINTS.minFileSizeMB) {
    return {
      valid: false,
      error: `File too small: ${(fileSizeMB * 1024).toFixed(2)}KB. Minimum allowed: ${POD_VALIDATION_CONSTRAINTS.minFileSizeMB * 1024}KB`,
      errorCode: 'SIZE_TOO_SMALL',
    };
  }

  return { valid: true };
}

/**
 * Compresses an image file for POD upload
 * Uses browser-image-compression with project defaults
 *
 * @param file - The image file to compress
 * @param options - Optional compression options to override defaults
 * @returns Promise resolving to compression result
 * @throws ImageValidationError if file is invalid
 */
export async function compressImage(
  file: File,
  options?: Partial<ImageCompressionOptions>
): Promise<CompressionResult> {
  // Validate file first
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new ImageValidationError(
      validation.error || 'Invalid file',
      validation.errorCode || 'INVALID_TYPE'
    );
  }

  const originalSize = file.size;

  // Merge options with defaults
  const compressionOptions = {
    ...DEFAULT_POD_COMPRESSION_OPTIONS,
    ...options,
  };

  // Check if compression is needed
  const fileSizeMB = originalSize / (1024 * 1024);
  if (fileSizeMB <= compressionOptions.maxSizeMB) {
    // Still convert to JPEG for consistency if needed
    if (file.type === 'image/jpeg') {
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        wasCompressed: false,
      };
    }
  }

  try {
    // Compress the image
    const compressedFile = await imageCompression(file, {
      maxSizeMB: compressionOptions.maxSizeMB,
      maxWidthOrHeight: compressionOptions.maxWidthOrHeight,
      useWebWorker: compressionOptions.useWebWorker,
      fileType: compressionOptions.fileType,
      initialQuality: compressionOptions.quality,
    });

    // Ensure the file has proper extension
    const filename = generateCompressedFilename(file.name);
    const finalFile = new File([compressedFile], filename, {
      type: compressionOptions.fileType,
    });

    return {
      file: finalFile,
      originalSize,
      compressedSize: finalFile.size,
      compressionRatio: originalSize / finalFile.size,
      wasCompressed: true,
    };
  } catch (error) {
    // Re-throw with more context
    const message = error instanceof Error ? error.message : 'Unknown compression error';
    throw new Error(`Failed to compress image: ${message}`);
  }
}

/**
 * Generates a compressed filename with .jpg extension
 */
function generateCompressedFilename(originalName: string): string {
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  return `${baseName}.jpg`;
}

/**
 * Generates a POD filename with delivery ID and timestamp
 * Format: delivery-{deliveryId}-{timestamp}.jpg
 */
export function generatePODFilename(deliveryId: string): string {
  const timestamp = Date.now();
  return `delivery-${deliveryId}-${timestamp}.jpg`;
}

/**
 * Generates the full storage path for a POD photo
 * Format: deliveries/{deliveryId}/delivery-{deliveryId}-{timestamp}.jpg
 */
export function generatePODStoragePath(deliveryId: string): string {
  const filename = generatePODFilename(deliveryId);
  return `deliveries/${deliveryId}/${filename}`;
}

/**
 * Creates a preview URL for an image file
 * Remember to revoke the URL when done to avoid memory leaks
 *
 * @param file - The image file
 * @returns Object URL for preview
 */
export function createImagePreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revokes an object URL to free memory
 *
 * @param url - The object URL to revoke
 */
export function revokeImagePreviewUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/**
 * Gets image dimensions
 *
 * @param file - The image file
 * @returns Promise resolving to width and height
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = createImagePreviewUrl(file);

    img.onload = () => {
      revokeImagePreviewUrl(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      revokeImagePreviewUrl(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Formats file size for display
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
