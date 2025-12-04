import { cloudinaryConfig, CLOUDINARY_BASE_URL } from './config';
import type { CloudinaryTransformOptions } from './types';

/**
 * Build transformation string from options
 *
 * @param options - Transform options
 * @returns Cloudinary transformation string
 */
function buildTransformString(options?: CloudinaryTransformOptions): string {
  // Default: auto format and quality for best optimization
  if (!options) {
    return 'f_auto,q_auto';
  }

  const parts: string[] = [];

  // Format (default to auto for best browser-specific format)
  parts.push(`f_${options.format || 'auto'}`);

  // Quality (default to auto for optimal compression)
  parts.push(`q_${options.quality || 'auto'}`);

  // Dimensions
  if (options.width) parts.push(`w_${options.width}`);
  if (options.height) parts.push(`h_${options.height}`);

  // Crop mode
  if (options.crop) parts.push(`c_${options.crop}`);

  // Gravity (for cropping)
  if (options.gravity) parts.push(`g_${options.gravity}`);

  // Device pixel ratio
  if (options.dpr) parts.push(`dpr_${options.dpr}`);

  return parts.join(',');
}

/**
 * Generate a Cloudinary URL for an image
 *
 * @param publicId - The public ID of the image (without folder prefix or extension)
 *                   e.g., 'logo/logo-dark' for an image at ready-set/logo/logo-dark
 * @param options - Optional transformation options
 * @returns Full Cloudinary URL with transformations
 *
 * @example
 * // Basic usage - auto optimization
 * getCloudinaryUrl('logo/logo-dark')
 * // Returns: https://res.cloudinary.com/dzm8qcnfd/image/upload/f_auto,q_auto/ready-set/logo/logo-dark
 *
 * @example
 * // With transformations
 * getCloudinaryUrl('hero/hero-bg', { width: 1920, height: 1080, crop: 'fill' })
 * // Returns: https://res.cloudinary.com/dzm8qcnfd/image/upload/f_auto,q_auto,w_1920,h_1080,c_fill/ready-set/hero/hero-bg
 */
export function getCloudinaryUrl(
  publicId: string,
  options?: CloudinaryTransformOptions
): string {
  const transforms = buildTransformString(options);
  const { folder } = cloudinaryConfig;

  // Ensure publicId doesn't have leading slash
  const cleanPublicId = publicId.startsWith('/') ? publicId.slice(1) : publicId;

  return `${CLOUDINARY_BASE_URL}/${transforms}/${folder}/${cleanPublicId}`;
}

/**
 * Generate a Cloudinary URL with responsive breakpoints
 *
 * @param publicId - The public ID of the image
 * @param breakpoints - Array of widths for srcset
 * @param options - Base transformation options
 * @returns Object with src and srcSet for responsive images
 *
 * @example
 * const { src, srcSet } = getResponsiveCloudinaryUrl('hero/hero-bg', [640, 1024, 1920])
 * // Use in img: <img src={src} srcSet={srcSet} />
 */
export function getResponsiveCloudinaryUrl(
  publicId: string,
  breakpoints: number[],
  options?: Omit<CloudinaryTransformOptions, 'width'>
): { src: string; srcSet: string } {
  const src = getCloudinaryUrl(publicId, options);

  const srcSet = breakpoints
    .map((width) => {
      const url = getCloudinaryUrl(publicId, { ...options, width });
      return `${url} ${width}w`;
    })
    .join(', ');

  return { src, srcSet };
}

/**
 * Helper to convert local image path to Cloudinary public ID
 *
 * @param localPath - Local path like '/images/logo/logo-dark.png'
 * @returns Cloudinary public ID like 'logo/logo-dark'
 *
 * @example
 * localPathToPublicId('/images/logo/logo-dark.png')
 * // Returns: 'logo/logo-dark'
 */
export function localPathToPublicId(localPath: string): string {
  // Remove leading /images/ prefix
  let publicId = localPath.replace(/^\/images\//, '');

  // Remove file extension
  publicId = publicId.replace(/\.[^/.]+$/, '');

  return publicId;
}
