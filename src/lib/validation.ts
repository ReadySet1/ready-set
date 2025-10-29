// src/lib/validation.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Common validation patterns
export const ValidationPatterns = {
  // Email validation with common TLDs
  email: z.string()
    .email('Invalid email address format')
    .min(5, 'Email must be at least 5 characters')
    .max(254, 'Email must not exceed 254 characters'),

  // Password with complexity requirements
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  // Strong password (for sensitive operations)
  strongPassword: z.string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .regex(/^(?!.*(.)\1{2})/, 'Password must not contain repeated characters'),

  // Name validation (allows unicode characters)
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .regex(/^[\p{L}\p{M}\s\-'.]+$/u, 'Name contains invalid characters'),

  // Phone number (international format)
  phone: z.string()
    .regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format')
    .min(10, 'Phone number too short')
    .max(20, 'Phone number too long'),

  // URL validation
  url: z.string()
    .url('Invalid URL format')
    .max(2048, 'URL too long'),

  // UUID validation
  uuid: z.string()
    .uuid('Invalid UUID format'),

  // Safe text (no HTML/script)
  safeText: z.string()
    .max(10000, 'Text too long'),

  // File name validation
  filename: z.string()
    .min(1, 'Filename required')
    .max(255, 'Filename too long')
    .regex(/^[a-zA-Z0-9._\-\s()]+$/, 'Filename contains invalid characters'),

  // IP address validation
  ipAddress: z.string()
    .regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/,
      'Invalid IP address format'),

  // JSON validation
  json: z.string()
    .refine((str) => {
      try {
        JSON.parse(str);
        return true;
      } catch {
        return false;
      }
    }, 'Invalid JSON format')
} as const;

// Common schema types
export const CommonSchemas = {
  // Pagination parameters
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc')
  }),

  // Search parameters
  search: z.object({
    query: z.string().min(1).max(100),
    filters: z.record(z.string(), z.any()).optional()
  }),

  // File upload metadata
  fileUpload: z.object({
    filename: ValidationPatterns.filename,
    contentType: z.string().min(1).max(100),
    size: z.coerce.number().int().min(1).max(50 * 1024 * 1024), // 50MB max
    checksum: z.string().optional()
  }),

  // Date range
  dateRange: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  }).refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
    message: 'Start date must be before or equal to end date'
  }),

  // Location coordinates
  coordinates: z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180)
  })
} as const;

// Input sanitization utilities
export class InputSanitizer {
  /**
   * Sanitize HTML content to prevent XSS
   */
  static sanitizeHtml(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [], // No HTML tags allowed by default
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });
  }

  /**
   * Sanitize text input (remove potential script injection and malicious content)
   * Uses DOMPurify for comprehensive XSS protection
   */
  static sanitizeText(input: string): string {
    // Use DOMPurify with strict settings to remove all HTML tags and malicious content
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [], // Strip all HTML tags
      ALLOWED_ATTR: [], // Strip all attributes
      KEEP_CONTENT: true, // Keep the text content
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'], // Explicitly block dangerous tags
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'] // Block event handlers
    }).trim();
  }

  /**
   * Sanitize filename
   */
  static sanitizeFilename(input: string): string {
    return input
      .replace(/[<>:"/\\|?*]/g, '') // Remove dangerous characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 255); // Limit length
  }

  /**
   * Sanitize SQL-like input (basic prevention)
   */
  static sanitizeSqlInput(input: string): string {
    return input
      .replace(/[';\\]/g, '') // Remove quotes and semicolons
      .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi, '') // Remove SQL keywords
      .trim();
  }

  /**
   * Sanitize number input
   */
  static sanitizeNumber(input: string | number): number {
    const num = typeof input === 'string' ? parseFloat(input) : input;
    return isNaN(num) ? 0 : num;
  }

  /**
   * Comprehensive input sanitization
   */
  static sanitize(input: any, type: 'html' | 'text' | 'sql' | 'filename' | 'number' = 'text'): any {
    if (typeof input === 'string') {
      switch (type) {
        case 'html':
          return this.sanitizeHtml(input);
        case 'sql':
          return this.sanitizeSqlInput(input);
        case 'filename':
          return this.sanitizeFilename(input);
        case 'number':
          return this.sanitizeNumber(input);
        case 'text':
        default:
          return this.sanitizeText(input);
      }
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitize(value, type);
      }
      return sanitized;
    }

    return input;
  }
}

// Validation middleware
export interface ValidationConfig {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  headers?: z.ZodSchema;
  sanitizeBody?: boolean;
  sanitizeQuery?: boolean;
  strict?: boolean; // If true, reject extra fields in body
}

export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
  sanitizedData?: any;
}

/**
 * Validate and sanitize request data
 */
export async function validateRequest<T = any>(
  request: NextRequest,
  config: ValidationConfig
): Promise<ValidationResult<T>> {
  try {
    const { body: bodySchema, query: querySchema, params: paramsSchema, headers: headersSchema } = config;
    let validatedData: any = {};

    // Validate body if schema provided
    if (bodySchema) {
      const bodyText = await request.text();
      let bodyData: any = {};

      if (bodyText.trim()) {
        try {
          bodyData = JSON.parse(bodyText);
        } catch (error) {
          return {
            success: false,
            errors: new z.ZodError([{
              code: 'custom',
              message: 'Invalid JSON in request body',
              path: ['body']
            }])
          };
        }
      }

      // Sanitize body if requested
      if (config.sanitizeBody) {
        bodyData = InputSanitizer.sanitize(bodyData, 'text');
      }

      const bodyResult = bodySchema.safeParse(bodyData);
      if (!bodyResult.success) {
        return {
          success: false,
          errors: bodyResult.error
        };
      }

      validatedData = { ...validatedData, ...(bodyResult.data as object) };
    }

    // Validate query parameters if schema provided
    if (querySchema) {
      const url = new URL(request.url);
      let queryData: any = {};

      for (const [key, value] of url.searchParams.entries()) {
        // Handle array values (e.g., ?tags=tag1&tags=tag2)
        if (queryData[key]) {
          if (Array.isArray(queryData[key])) {
            queryData[key].push(value);
          } else {
            queryData[key] = [queryData[key], value];
          }
        } else {
          queryData[key] = value;
        }
      }

      // Sanitize query if requested
      if (config.sanitizeQuery) {
        queryData = InputSanitizer.sanitize(queryData, 'text');
      }

      const queryResult = querySchema.safeParse(queryData);
      if (!queryResult.success) {
        return {
          success: false,
          errors: queryResult.error
        };
      }

      validatedData = { ...validatedData, ...(queryResult.data as object) };
    }

    // Validate URL params if schema provided
    if (paramsSchema) {
      const params = request.nextUrl.pathname.split('/').filter(Boolean);
      const paramsResult = paramsSchema.safeParse(params);

      if (!paramsResult.success) {
        return {
          success: false,
          errors: paramsResult.error
        };
      }

      validatedData = { ...validatedData, ...(paramsResult.data as object) };
    }

    // Validate headers if schema provided
    if (headersSchema) {
      const headers: any = {};
      request.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      const headersResult = headersSchema.safeParse(headers);
      if (!headersResult.success) {
        return {
          success: false,
          errors: headersResult.error
        };
      }

      validatedData = { ...validatedData, ...(headersResult.data as object) };
    }

    return {
      success: true,
      data: validatedData as T,
      sanitizedData: config.sanitizeBody || config.sanitizeQuery ? validatedData : undefined
    };

  } catch (error) {
    console.error('Validation error:', error);
    return {
      success: false,
      errors: new z.ZodError([{
        code: 'custom',
        message: 'Validation failed',
        path: ['request']
      }])
    };
  }
}

/**
 * Create validation middleware for API routes
 */
export function withValidation<T = any>(config: ValidationConfig) {
  return async function validationMiddleware(request: NextRequest): Promise<NextResponse | null> {
    const validation = await validateRequest<T>(request, config);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.errors?.format() || 'Invalid request data',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    // Add validated data to request for downstream use
    (request as any).validatedData = validation.data;
    (request as any).sanitizedData = validation.sanitizedData;

    return null; // Continue to next middleware/handler
  };
}

/**
 * Predefined validation schemas for common API operations
 */
export const ApiSchemas = {
  // User registration
  userRegistration: z.object({
    email: ValidationPatterns.email,
    password: ValidationPatterns.password,
    name: ValidationPatterns.name,
    phone: ValidationPatterns.phone.optional()
  }),

  // User login
  userLogin: z.object({
    email: ValidationPatterns.email,
    password: z.string().min(1, 'Password is required')
  }),

  // Password reset request
  passwordResetRequest: z.object({
    email: ValidationPatterns.email
  }),

  // Password reset confirmation
  passwordResetConfirm: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: ValidationPatterns.password
  }),

  // Profile update
  profileUpdate: z.object({
    name: ValidationPatterns.name.optional(),
    phone: ValidationPatterns.phone.optional(),
    bio: ValidationPatterns.safeText.optional()
  }),

  // Order creation
  orderCreate: z.object({
    items: z.array(z.object({
      id: ValidationPatterns.uuid,
      quantity: z.coerce.number().int().min(1).max(100),
      price: z.coerce.number().min(0).optional()
    })).min(1).max(50),
    deliveryAddress: ValidationPatterns.safeText,
    notes: ValidationPatterns.safeText.optional()
  }),

  // Search query
  searchQuery: z.object({
    q: z.string().min(1).max(100),
    type: z.enum(['orders', 'users', 'products']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10)
  }),

  // File upload
  fileUpload: z.object({
    file: z.any(), // File object will be validated separately
    description: ValidationPatterns.safeText.optional()
  }),

  // Admin user update
  adminUserUpdate: z.object({
    userId: ValidationPatterns.uuid,
    role: z.enum(['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK', 'CLIENT']),
    status: z.enum(['active', 'inactive', 'suspended']).optional()
  })
} as const;

// Security validation helpers
export const SecurityValidation = {
  /**
   * Check for common injection patterns
   */
  detectInjection(input: string): boolean {
    const injectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /<script[^>]*>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /expression\s*\(/gi,
      /@import/gi,
      /<\?php/gi,
      /<%.*%>/g,
      /\{\{.*\}\}/g
    ];

    return injectionPatterns.some(pattern => pattern.test(input));
  },

  /**
   * Validate request size
   */
  validateRequestSize(request: NextRequest, maxSize: number = 10 * 1024 * 1024): boolean {
    const contentLength = request.headers.get('content-length');
    return !contentLength || parseInt(contentLength) <= maxSize;
  },

  /**
   * Validate content type
   */
  validateContentType(request: NextRequest, allowedTypes: string[]): boolean {
    const contentType = request.headers.get('content-type');
    if (!contentType) return false;

    return allowedTypes.some(type => contentType.includes(type));
  }
};

/**
 * Create a validated API route handler
 */
export function createValidatedHandler<T extends any[], R>(
  handler: (request: NextRequest & { validatedData: any }, ...args: T) => Promise<NextResponse>,
  validationConfig: ValidationConfig
) {
  return async function validatedHandler(request: NextRequest, ...args: T): Promise<NextResponse> {
    // Apply validation
    const validationResponse = await withValidation(validationConfig)(request);
    if (validationResponse) {
      return validationResponse; // Return validation error if validation fails
    }

    // Proceed with original handler, passing validated data
    return handler(request as NextRequest & { validatedData: any }, ...args);
  };
}
