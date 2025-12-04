import type { CloudinaryConfig } from './types';

/**
 * Cloudinary configuration
 *
 * Cloud name is exposed publicly (needed for URL generation on client).
 * API credentials are server-side only (used by migration scripts).
 */
export const cloudinaryConfig: CloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dzm8qcnfd',
  folder: 'ready-set',
};

/**
 * Base URL for Cloudinary image delivery
 */
export const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload`;

/**
 * Server-side only: Cloudinary API configuration
 * Used by migration scripts and server actions
 */
export function getCloudinaryApiConfig() {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary API credentials not configured. Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET environment variables.'
    );
  }

  return {
    cloud_name: cloudinaryConfig.cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  };
}
