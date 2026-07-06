/**
 * Cloudinary Transform Options
 *
 * Options for generating optimized Cloudinary image URLs with transformations.
 * All transformations are applied server-side by Cloudinary CDN.
 *
 * @see https://cloudinary.com/documentation/image_transformations
 */
export interface CloudinaryTransformOptions {
  /** Width in pixels */
  width?: number;

  /** Height in pixels */
  height?: number;

  /**
   * Output format
   * - 'auto': Cloudinary selects best format based on browser support
   * - 'webp': Force WebP format
   * - 'avif': Force AVIF format (best compression)
   * - 'png': Force PNG (lossless)
   * - 'jpg': Force JPEG
   */
  format?: 'auto' | 'webp' | 'avif' | 'png' | 'jpg';

  /**
   * Quality setting
   * - 'auto': Cloudinary optimizes quality automatically
   * - number (1-100): Specific quality level
   */
  quality?: 'auto' | number;

  /**
   * Crop mode
   * - 'fill': Resize and crop to exact dimensions
   * - 'fit': Resize to fit within dimensions, maintaining aspect ratio
   * - 'scale': Resize to exact dimensions, may distort
   * - 'crop': Crop to exact dimensions from center
   * - 'thumb': Generate thumbnail
   */
  crop?: 'fill' | 'fit' | 'scale' | 'crop' | 'thumb';

  /**
   * Gravity for cropping
   * - 'auto': Automatic content-aware cropping
   * - 'face': Focus on detected faces
   * - 'center': Crop from center
   */
  gravity?: 'auto' | 'face' | 'center';

  /**
   * Device pixel ratio for responsive images
   * - 1: Standard resolution
   * - 2: Retina (2x)
   * - 3: High DPI (3x)
   */
  dpr?: 1 | 2 | 3 | 'auto';

  /**
   * Version number for CDN cache busting. Must be a positive integer;
   * any other value is ignored and the segment is omitted.
   *
   * Use a FIXED constant (see `ASSET_CACHE_VERSION` in config.ts), bumped only
   * when an image is re-uploaded under the same public ID. Never compute this
   * at render time (e.g. `Date.now()`) — that mints a unique URL per render,
   * defeating CDN/browser caching and bloating the Next.js image optimizer
   * cache, and causes hydration mismatches in client components.
   */
  version?: number;
}

/**
 * Cloudinary configuration settings
 */
export interface CloudinaryConfig {
  /** Cloudinary cloud name */
  cloudName: string;

  /** Root folder for all images in Cloudinary */
  folder: string;
}

/**
 * Image mapping entry (local path to Cloudinary public ID)
 */
export interface ImageMapping {
  /** Original local path (e.g., '/images/logo/logo-dark.png') */
  localPath: string;

  /** Cloudinary public ID (e.g., 'ready-set/logo/logo-dark') */
  publicId: string;

  /** Original file format */
  format: string;
}
