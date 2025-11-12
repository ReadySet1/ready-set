// src/lib/upload-error-handler.ts
import { v4 as uuidv4 } from 'uuid';
import {
  UploadError,
  UploadErrorType,
  RetryConfig,
  UploadOptions,
  FileValidationConfig
} from '@/types/upload';
import { UPLOAD_LIMITS, ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, ENV_CONFIG } from '@/config/upload-config';

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  jitter: true
};

// Default validation configuration
export const DEFAULT_VALIDATION_CONFIG: FileValidationConfig = {
  maxSize: UPLOAD_LIMITS.MAX_FILE_SIZE,
  allowedTypes: [...ALLOWED_MIME_TYPES],
  blockedTypes: [
    'application/x-executable',
    'application/x-msdownload',
    'application/x-dosexec',
    'application/octet-stream'
  ],
  allowedExtensions: [...ALLOWED_EXTENSIONS],
  blockedExtensions: [
    '.exe', '.bat', '.cmd', '.scr', '.pif',
    '.com', '.jar', '.js', '.vbs', '.ps1'
  ],
  checkVirus: true,
  sanitizeFilename: true,
  scanContent: true
};

// Error categorization utilities
export class UploadErrorHandler {
  private static correlationIdCounter = 0;

  static categorizeError(error: any, file?: File): UploadError {
    const correlationId = uuidv4();
    const timestamp = new Date();

    // Network errors
    if (this.isNetworkError(error)) {
      return {
        type: UploadErrorType.NETWORK_ERROR,
        message: error.message || 'Network connection failed',
        userMessage: 'Connection problem. Please check your internet and try again.',
        details: {
          originalMessage: error.message,
          status: error.status,
          fileName: file?.name,
          fileSize: file?.size
        },
        retryable: true,
        retryAfter: 2000,
        correlationId,
        timestamp,
        originalError: error
      };
    }

    // Storage errors (5xx responses)
    if (this.isStorageError(error)) {
      return {
        type: UploadErrorType.STORAGE_ERROR,
        message: error.message || 'Storage service error',
        userMessage: 'Storage service is temporarily unavailable. Please try again in a moment.',
        details: {
          originalMessage: error.message,
          status: error.status,
          fileName: file?.name
        },
        retryable: true,
        retryAfter: 5000,
        correlationId,
        timestamp,
        originalError: error
      };
    }

    // Permission errors
    if (this.isPermissionError(error)) {
      return {
        type: UploadErrorType.PERMISSION_ERROR,
        message: error.message || 'Permission denied',
        userMessage: 'You don\'t have permission to upload files. Please contact support if this continues.',
        details: {
          originalMessage: error.message,
          status: error.status
        },
        retryable: false,
        correlationId,
        timestamp,
        originalError: error
      };
    }

    // Quota exceeded errors
    if (this.isQuotaError(error)) {
      return {
        type: UploadErrorType.QUOTA_ERROR,
        message: error.message || 'Storage quota exceeded',
        userMessage: 'Storage quota exceeded. Please delete some files or contact support.',
        details: {
          originalMessage: error.message,
          status: error.status
        },
        retryable: false,
        correlationId,
        timestamp,
        originalError: error
      };
    }

    // Virus detection errors
    if (this.isVirusError(error)) {
      return {
        type: UploadErrorType.VIRUS_ERROR,
        message: error.message || 'Malicious file detected',
        userMessage: 'This file appears to contain malicious content and cannot be uploaded.',
        details: {
          originalMessage: error.message,
          threats: error.threats || []
        },
        retryable: false,
        correlationId,
        timestamp,
        originalError: error
      };
    }

    // File size errors
    if (this.isSizeError(error)) {
      return {
        type: UploadErrorType.SIZE_ERROR,
        message: error.message || 'File too large',
        userMessage: error.userMessage || 'File is too large. Please choose a smaller file.',
        details: {
          maxSize: error.maxSize,
          actualSize: error.actualSize,
          fileName: file?.name
        },
        retryable: false,
        correlationId,
        timestamp,
        originalError: error
      };
    }

    // File type errors
    if (this.isTypeError(error)) {
      return {
        type: UploadErrorType.TYPE_ERROR,
        message: error.message || 'Invalid file type',
        userMessage: error.userMessage || 'This file type is not allowed. Please choose a different file.',
        details: {
          fileType: file?.type,
          fileName: file?.name,
          allowedTypes: error.allowedTypes
        },
        retryable: false,
        correlationId,
        timestamp,
        originalError: error
      };
    }

    // Default unknown error - sanitize for production
    const errorMessage = error.message || error.toString() || 'Unknown error occurred';
    const errorCode = error.code || error.statusCode || error.status;

    // Create user message - sanitized for production, detailed for development
    let userMessage: string;
    if (ENV_CONFIG.isProduction) {
      // Production: Generic message with correlation ID only
      userMessage = 'An unexpected error occurred. Please try again or contact support if the problem persists.';
    } else {
      // Development: Include error details for debugging
      userMessage = 'An unexpected error occurred';
      if (errorCode) {
        userMessage += ` (Code: ${errorCode})`;
      }
      if (errorMessage && errorMessage !== 'Unknown error occurred') {
        userMessage += `. Details: ${errorMessage}`;
      }
      userMessage += '. Please try again or contact support if the problem persists.';
    }

    return {
      type: UploadErrorType.UNKNOWN_ERROR,
      message: errorMessage,
      userMessage,
      details: ENV_CONFIG.isDevelopment ? {
        originalMessage: errorMessage,
        errorCode,
        errorName: error.name,
        errorConstructor: error.constructor?.name,
        stack: error.stack,
        // Include any additional properties from the error object (dev only)
        ...Object.keys(error).reduce((acc, key) => {
          if (!['message', 'stack', 'name'].includes(key)) {
            acc[key] = error[key];
          }
          return acc;
        }, {} as Record<string, any>)
      } : {
        // Production: Only include correlation ID
        correlationId
      },
      retryable: true,
      retryAfter: 3000,
      correlationId,
      timestamp,
      originalError: error
    };
  }

  private static isNetworkError(error: any): boolean {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';
    const status = error.status;

    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('fetch') ||
      status === 0 ||
      status === 408 || // Request timeout
      status === 503 || // Service unavailable
      status === 504   // Gateway timeout
    );
  }

  private static isStorageError(error: any): boolean {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';
    const status = error.status;

    return (
      status >= 500 ||
      message.includes('storage') ||
      message.includes('bucket') ||
      message.includes('internal server error')
    );
  }

  private static isPermissionError(error: any): boolean {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';
    const status = error.status;

    return (
      status === 401 ||
      status === 403 ||
      message.includes('permission') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('access denied')
    );
  }

  private static isQuotaError(error: any): boolean {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';

    return (
      message.includes('quota') ||
      message.includes('limit') ||
      message.includes('exceeded') ||
      message.includes('too large')
    );
  }

  private static isVirusError(error: any): boolean {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';

    return (
      message.includes('virus') ||
      message.includes('malicious') ||
      message.includes('threat') ||
      message.includes('infected')
    );
  }

  private static isSizeError(error: any): boolean {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';

    return (
      message.includes('size') ||
      message.includes('large') ||
      message.includes('limit')
    );
  }

  private static isTypeError(error: any): boolean {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';

    return (
      message.includes('type') ||
      message.includes('format') ||
      message.includes('mime') ||
      message.includes('extension')
    );
  }

  static createValidationError(
    type: 'size' | 'type' | 'content' | 'name',
    message: string,
    userMessage: string,
    details?: Record<string, any>
  ): UploadError {
    const correlationId = uuidv4();

    let errorType = UploadErrorType.VALIDATION_ERROR;
    if (type === 'size') errorType = UploadErrorType.SIZE_ERROR;
    if (type === 'type') errorType = UploadErrorType.TYPE_ERROR;

    return {
      type: errorType,
      message,
      userMessage,
      details,
      retryable: false,
      correlationId,
      timestamp: new Date()
    };
  }

  static logError(error: UploadError, context?: Record<string, any>): void {
    const logData = {
      correlationId: error.correlationId,
      type: error.type,
      message: error.message,
      userMessage: error.userMessage,
      retryable: error.retryable,
      timestamp: error.timestamp.toISOString(),
      context,
      stack: error.originalError?.stack
    };

    // Log to console for development
    console.error('Upload Error:', logData);

    // In production, you would send this to your logging service
    // Example: await logToService('upload-error', logData);
  }

  static async reportError(error: UploadError, userId?: string): Promise<void> {
    try {
      // Construct absolute URL for server-side fetch
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;

      // Validate environment variable in production
      if (ENV_CONFIG.isProduction && !baseUrl) {
        console.warn('NEXT_PUBLIC_SITE_URL is not defined. Error reporting is disabled.');
        return;
      }

      // Use localhost as fallback only in development
      const apiUrl = `${baseUrl || 'http://localhost:3000'}/api/upload-errors`;

      // Report to error tracking service
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          correlationId: error.correlationId,
          errorType: error.type,
          message: error.message,
          userMessage: error.userMessage,
          details: error.details,
          userId,
          timestamp: error.timestamp.toISOString(),
          retryable: error.retryable
        })
      });
    } catch (reportError) {
      if (ENV_CONFIG.isDevelopment) {
        console.error('Failed to report error:', reportError);
      }
    }
  }
}

// Retry utilities
export class RetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    onRetry?: (error: UploadError, attempt: number) => void
  ): Promise<T> {
    let lastError: UploadError | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = UploadErrorHandler.categorizeError(error);

        // Don't retry if error is not retryable or if it's the last attempt
        if (!lastError.retryable || attempt === config.maxAttempts) {
          throw lastError;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, config);

        if (onRetry) {
          onRetry(lastError, attempt);
        }

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private static calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);

    // Cap at max delay
    delay = Math.min(delay, config.maxDelay);

    // Add jitter if enabled
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// File validation utilities
export class FileValidator {
  static validateFile(
    file: File,
    config: FileValidationConfig = DEFAULT_VALIDATION_CONFIG
  ): UploadError | null {
    // Size validation
    if (file.size > config.maxSize) {
      return UploadErrorHandler.createValidationError(
        'size',
        `File size ${file.size} exceeds maximum allowed size ${config.maxSize}`,
        `File is too large (${this.formatFileSize(file.size)}). Maximum allowed size is ${this.formatFileSize(config.maxSize)}.`,
        {
          actualSize: file.size,
          maxSize: config.maxSize,
          fileName: file.name
        }
      );
    }

    // Type validation
    if (!this.isAllowedType(file, config)) {
      // Create a user-friendly list of allowed formats
      const allowedFormats = config.allowedExtensions
        .map(ext => ext.replace('.', '').toUpperCase())
        .join(', ');

      return UploadErrorHandler.createValidationError(
        'type',
        `File type ${file.type} is not allowed`,
        `File type "${file.type}" is not supported. Allowed formats: ${allowedFormats}. Please choose a different file.`,
        {
          fileType: file.type,
          fileName: file.name,
          allowedTypes: config.allowedTypes,
          allowedExtensions: config.allowedExtensions
        }
      );
    }

    // Extension validation
    if (!this.isAllowedExtension(file, config)) {
      const currentExtension = this.getExtension(file.name);
      // Create a user-friendly list of allowed extensions
      const allowedFormats = config.allowedExtensions
        .map(ext => ext.replace('.', '').toUpperCase())
        .join(', ');

      return UploadErrorHandler.createValidationError(
        'type',
        `File extension not allowed for file ${file.name}`,
        `File extension "${currentExtension}" is not allowed. Allowed formats: ${allowedFormats}. Please choose a different file.`,
        {
          fileName: file.name,
          extension: currentExtension,
          allowedExtensions: config.allowedExtensions
        }
      );
    }

    // Filename validation
    if (!this.isValidFilename(file.name, config)) {
      return UploadErrorHandler.createValidationError(
        'name',
        `Invalid filename: ${file.name}`,
        'Filename contains invalid characters or is too long.',
        {
          fileName: file.name,
          reason: 'Invalid characters or length'
        }
      );
    }

    return null;
  }

  private static isAllowedType(file: File, config: FileValidationConfig): boolean {
    // Check blocked types first
    const blockedTypes = config.blockedTypes || [];
    for (const blockedType of blockedTypes) {
      if (file.type.includes(blockedType)) {
        return false;
      }
    }

    // Check allowed types
    const allowedTypes = config.allowedTypes || [];
    if (allowedTypes.length > 0) {
      return allowedTypes.some(type => file.type.startsWith(type));
    }

    return true;
  }

  private static isAllowedExtension(file: File, config: FileValidationConfig): boolean {
    const extension = this.getExtension(file.name).toLowerCase();

    // Check blocked extensions
    const blockedExtensions = config.blockedExtensions || [];
    for (const blockedExt of blockedExtensions) {
      if (extension === blockedExt.toLowerCase()) {
        return false;
      }
    }

    // Check allowed extensions
    const allowedExtensions = config.allowedExtensions || [];
    if (allowedExtensions.length > 0) {
      return allowedExtensions.some(ext => extension === ext.toLowerCase());
    }

    return true;
  }

  private static getExtension(filename: string): string {
    return '.' + filename.split('.').pop()?.toLowerCase();
  }

  private static isValidFilename(filename: string, config: FileValidationConfig): boolean {
    if (config.sanitizeFilename) {
      // Check length - allow slightly longer filenames (300 chars instead of 255)
      if (filename.length > 300) {
        return false;
      }

      // Only check for the most dangerous characters
      // Only reject: null bytes and control characters (0x00-0x1f)
      // Allow everything else as sanitization will clean it up
      const dangerousChars = /[\x00-\x1f]/;
      if (dangerousChars.test(filename)) {
        return false;
      }
    }

    return true;
  }

  static sanitizeFilename(filename: string): string {
    // First, extract the extension to preserve it
    const lastDotIndex = filename.lastIndexOf('.');
    let nameWithoutExt = filename;
    let extension = '';

    if (lastDotIndex > 0 && lastDotIndex < filename.length - 1) {
      nameWithoutExt = filename.substring(0, lastDotIndex);
      extension = filename.substring(lastDotIndex); // includes the dot
    }

    // Remove path separators from the name part
    let sanitizedName = nameWithoutExt.replace(/[\/\\]/g, '');

    // Remove only the most dangerous characters - keep spaces, hyphens, parentheses, etc.
    // Do NOT use replace(/\.\./g, '') as it can break filenames with multiple dots
    sanitizedName = sanitizedName.replace(/[\x00-\x1f<>:"|?*]/g, '');

    // Remove any remaining path traversal patterns
    sanitizedName = sanitizedName.replace(/\.\./g, '_');

    // Combine name and extension
    let sanitized = sanitizedName + extension;

    // Truncate if too long (allow up to 300 chars)
    if (sanitized.length > 300) {
      const maxNameLength = 295 - extension.length;
      sanitized = sanitizedName.substring(0, maxNameLength) + extension;
    }

    return sanitized;
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static async scanForVirus(file: File): Promise<{ isClean: boolean; threats: string[] }> {
    // This is a placeholder for virus scanning
    // In a real implementation, you would integrate with a virus scanning service
    // like ClamAV, VirusTotal, or a cloud-based service
    //
    // TODO: PERFORMANCE IMPROVEMENT NEEDED
    // Current implementation has several issues:
    // 1. Reads entire file into memory (will fail for large files)
    // 2. Uses synchronous regex scanning (blocks event loop)
    // 3. Won't scale for high-volume scenarios
    //
    // Recommended improvements:
    // - Use streaming-based scanning to process files in chunks
    // - Integrate with dedicated virus scanning service (ClamAV, AWS GuardDuty, etc.)
    // - Implement async scanning queue for large files
    // - Consider offloading to background worker for files > 1MB
    // - Add caching layer for already-scanned file hashes

    // Check file size first to prevent memory issues
    const MAX_SCAN_SIZE = 10 * 1024 * 1024; // 10MB limit for content scanning
    if (file.size > MAX_SCAN_SIZE) {
      return {
        isClean: false,
        threats: [`File too large for virus scan (${this.formatFileSize(file.size)}). Maximum scan size is 10MB.`]
      };
    }

    // For now, we'll do basic content scanning
    const content = await file.text();
    const threats: string[] = [];

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /eval\(/i,
      /exec\(/i,
      /system\(/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        threats.push(`Suspicious pattern detected: ${pattern.source}`);
      }
    }

    return {
      isClean: threats.length === 0,
      threats
    };
  }
}
