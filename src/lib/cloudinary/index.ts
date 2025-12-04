/**
 * Cloudinary Image CDN Utilities
 *
 * This module provides utilities for generating optimized Cloudinary URLs
 * for images migrated from /public/images/ to Cloudinary CDN.
 *
 * @module @/lib/cloudinary
 *
 * @example
 * // Basic usage
 * import { getCloudinaryUrl } from '@/lib/cloudinary';
 *
 * // In a component
 * <Image
 *   src={getCloudinaryUrl('logo/logo-dark')}
 *   alt="Logo"
 *   width={140}
 *   height={30}
 * />
 *
 * @example
 * // With transformations
 * import { getCloudinaryUrl } from '@/lib/cloudinary';
 *
 * <Image
 *   src={getCloudinaryUrl('hero/hero-bg', {
 *     width: 1920,
 *     height: 1080,
 *     crop: 'fill',
 *     quality: 80
 *   })}
 *   alt="Hero background"
 *   fill
 * />
 */

// URL generation
export {
  getCloudinaryUrl,
  getResponsiveCloudinaryUrl,
  localPathToPublicId,
} from './url-builder';

// Configuration
export { cloudinaryConfig, CLOUDINARY_BASE_URL } from './config';

// Types
export type {
  CloudinaryTransformOptions,
  CloudinaryConfig,
  ImageMapping,
} from './types';
