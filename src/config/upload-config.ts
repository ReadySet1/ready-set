/**
 * Centralized Upload Configuration
 *
 * This file contains all file upload related configuration to ensure consistency
 * across the application and prevent mismatched limits between validation and storage.
 */

/**
 * File size limits in bytes
 * Note: These limits must match across all upload validation and storage configuration
 */
export const UPLOAD_LIMITS = {
  /** Maximum file size allowed (10MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB

  /** Storage bucket size limit (should match or exceed MAX_FILE_SIZE) */
  BUCKET_SIZE_LIMIT: 10 * 1024 * 1024, // 10MB
} as const;

/**
 * Allowed MIME types for file uploads
 */
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text files
  'text/plain',
  'text/csv',
] as const;

/**
 * Allowed file extensions
 */
export const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv'
] as const;

/**
 * Environment configuration
 */
export const ENV_CONFIG = {
  /** Whether we're running in development mode */
  isDevelopment: process.env.NODE_ENV === 'development',

  /** Whether we're running in production mode */
  isProduction: process.env.NODE_ENV === 'production',

  /** Whether to include sensitive diagnostics in error responses */
  includeDiagnostics: process.env.NODE_ENV === 'development',

  /** Whether to enable verbose logging */
  enableVerboseLogging: process.env.NODE_ENV === 'development',
} as const;
