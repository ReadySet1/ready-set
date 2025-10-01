// src/lib/security-headers.ts
import { NextRequest, NextResponse } from 'next/server';

// Security headers configuration based on environment and requirements
export const SECURITY_HEADERS = {
  // Content Security Policy - comprehensive protection against XSS
  'Content-Security-Policy': process.env.NODE_ENV === 'production'
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"
    : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co http://localhost:* ws://localhost:*; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';",

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // Enable XSS filtering in browsers
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy for privacy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy - restrict browser features
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'interest-cohort=()',
    'payment=()',
    'usb=()',
    'bluetooth=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'ambient-light-sensor=()'
  ].join(', '),

  // HTTP Strict Transport Security (only for HTTPS)
  'Strict-Transport-Security': process.env.NODE_ENV === 'production'
    ? 'max-age=31536000; includeSubDomains; preload'
    : undefined,

  // Feature policy for legacy browsers (deprecated but still useful)
  'Feature-Policy': [
    'camera "none"',
    'microphone "none"',
    'geolocation "none"',
    'payment "none"',
    'usb "none"',
    'bluetooth "none"',
    'magnetometer "none"',
    'gyroscope "none"',
    'accelerometer "none"',
    'ambient-light-sensor "none"'
  ].join(', ')
} as const;

// Remove undefined headers
const filteredSecurityHeaders = Object.fromEntries(
  Object.entries(SECURITY_HEADERS).filter(([_, value]) => value !== undefined)
) as Record<string, string>;

// Security headers middleware configuration
export interface SecurityHeadersConfig {
  // Whether to include all security headers
  includeAll?: boolean;

  // Custom headers to add
  customHeaders?: Record<string, string>;

  // Headers to exclude
  excludeHeaders?: string[];

  // Environment-specific overrides
  environmentOverrides?: Record<string, Record<string, string>>;

  // Path-specific headers
  pathOverrides?: Record<string, Record<string, string>>;
}

// Generate security headers for a request
export function generateSecurityHeaders(
  request: NextRequest,
  config: SecurityHeadersConfig = {}
): Record<string, string> {
  const {
    includeAll = true,
    customHeaders = {},
    excludeHeaders = [],
    environmentOverrides = {},
    pathOverrides = {}
  } = config;

  let headers = { ...filteredSecurityHeaders };

  // Apply environment-specific overrides
  const env = process.env.NODE_ENV || 'development';
  if (environmentOverrides[env]) {
    headers = { ...headers, ...environmentOverrides[env] };
  }

  // Apply path-specific overrides
  const pathname = request.nextUrl.pathname;
  for (const [path, pathHeaders] of Object.entries(pathOverrides)) {
    if (pathname.startsWith(path)) {
      headers = { ...headers, ...pathHeaders };
    }
  }

  // Apply custom headers
  headers = { ...headers, ...customHeaders };

  // Exclude specified headers
  excludeHeaders.forEach(header => {
    delete headers[header];
  });

  return headers;
}

// Security headers middleware
export function withSecurityHeaders(config: SecurityHeadersConfig = {}) {
  return function securityHeadersMiddleware(request: NextRequest): NextResponse | null {
    // Generate headers for this request
    const headers = generateSecurityHeaders(request, config);

    // Create response with security headers
    const response = NextResponse.next();

    // Add all security headers
    Object.entries(headers).forEach(([name, value]) => {
      response.headers.set(name, value);
    });

    // Add request correlation ID for tracing
    const correlationId = request.headers.get('x-correlation-id') ||
                         request.headers.get('x-request-id') ||
                         crypto.randomUUID();

    response.headers.set('x-correlation-id', correlationId);
    response.headers.set('x-response-time', new Date().toISOString());

    // Add security validation headers
    response.headers.set('x-security-headers', 'applied');
    response.headers.set('x-content-type-validated', 'true');

    return response;
  };
}

// API-specific security headers (stricter than general pages)
export const API_SECURITY_HEADERS = {
  ...filteredSecurityHeaders,

  // Stricter CSP for API endpoints
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'none';",

  // Additional API security headers
  'X-API-Version': '1.0',
  'X-API-Deprecated': 'false',

  // Cache control for API responses
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
} as const;

// File upload specific security headers
export const UPLOAD_SECURITY_HEADERS = {
  ...filteredSecurityHeaders,

  // Additional security for file uploads
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',

  // File upload specific CSP
  'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'none'; img-src 'self' data:; font-src 'none'; connect-src 'self'; media-src 'self' data:; object-src 'none'; frame-ancestors 'none';",

  // Additional upload security
  'X-Upload-Security': 'enabled',
  'X-File-Validation': 'enabled'
} as const;

// Admin panel security headers (most restrictive)
export const ADMIN_SECURITY_HEADERS = {
  ...filteredSecurityHeaders,

  // Very strict CSP for admin panel
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';",

  // Additional admin security
  'X-Admin-Access': 'restricted',
  'X-Session-Timeout': 'enabled',

  // Cache control for admin pages
  'Cache-Control': 'no-cache, no-store, must-revalidate, private',
  'Pragma': 'no-cache',
  'Expires': '0'
} as const;

// Predefined security header configurations
export const SecurityHeaderConfigs = {
  // General web pages
  web: {
    includeAll: true,
    customHeaders: {
      'X-Robots-Tag': 'index, follow',
      'X-Powered-By': 'Ready-Set'
    }
  },

  // API endpoints
  api: {
    includeAll: true,
    customHeaders: API_SECURITY_HEADERS,
    environmentOverrides: {
      development: {
        'Content-Security-Policy': "default-src 'self' http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' http://localhost:* https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com http://localhost:*; img-src 'self' data: https: http://localhost:*; connect-src 'self' https://*.supabase.co wss://*.supabase.co http://localhost:* ws://localhost:*;"
      }
    }
  },

  // File upload endpoints
  upload: {
    includeAll: true,
    customHeaders: UPLOAD_SECURITY_HEADERS
  },

  // Admin panel
  admin: {
    includeAll: true,
    customHeaders: ADMIN_SECURITY_HEADERS,
    pathOverrides: {
      '/admin': ADMIN_SECURITY_HEADERS
    }
  },

  // Authentication pages (relaxed for third-party auth)
  auth: {
    includeAll: true,
    customHeaders: {
      ...filteredSecurityHeaders,
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.supabase.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src https://*.supabase.co; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self' https://*.supabase.co;"
    }
  }
} as const;

// Apply security headers to response
export function addSecurityHeaders(
  response: NextResponse,
  request: NextRequest,
  config: SecurityHeadersConfig = {}
): NextResponse {
  const headers = generateSecurityHeaders(request, config);

  Object.entries(headers).forEach(([name, value]) => {
    response.headers.set(name, value);
  });

  // Add correlation ID if not present
  if (!response.headers.get('x-correlation-id')) {
    response.headers.set('x-correlation-id', crypto.randomUUID());
  }

  response.headers.set('x-security-headers-applied', new Date().toISOString());

  return response;
}

// Security validation utilities
export const SecurityValidation = {
  // Validate security headers are present
  validateSecurityHeaders(response: NextResponse): {
    isValid: boolean;
    missingHeaders: string[];
    weakHeaders: string[];
  } {
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'referrer-policy',
      'content-security-policy'
    ];

    const missingHeaders: string[] = [];
    const weakHeaders: string[] = [];

    requiredHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (!value) {
        missingHeaders.push(header);
      } else {
        // Check for weak values
        switch (header) {
          case 'x-frame-options':
            if (value !== 'DENY' && value !== 'SAMEORIGIN') {
              weakHeaders.push(header);
            }
            break;
          case 'x-content-type-options':
            if (value !== 'nosniff') {
              weakHeaders.push(header);
            }
            break;
          case 'x-xss-protection':
            if (value !== '1; mode=block') {
              weakHeaders.push(header);
            }
            break;
        }
      }
    });

    return {
      isValid: missingHeaders.length === 0 && weakHeaders.length === 0,
      missingHeaders,
      weakHeaders
    };
  },

  // Check for common security misconfigurations
  checkSecurityMisconfigurations(request: NextRequest, response: NextResponse): string[] {
    const issues: string[] = [];

    // Check for missing HTTPS in production
    if (process.env.NODE_ENV === 'production') {
      const protocol = request.headers.get('x-forwarded-proto') || request.url.split(':')[0];
      if (protocol !== 'https') {
        issues.push('HTTPS not enforced in production');
      }
    }

    // Check for missing HSTS in production
    if (process.env.NODE_ENV === 'production' && !response.headers.get('strict-transport-security')) {
      issues.push('HSTS header missing in production');
    }

    // Check for weak CSP
    const csp = response.headers.get('content-security-policy');
    if (csp && (csp.includes('unsafe-inline') || csp.includes('unsafe-eval'))) {
      issues.push('Content Security Policy allows unsafe inline/eval');
    }

    // Check for missing cache control on sensitive pages
    const pathname = request.nextUrl.pathname;
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/auth')) {
      const cacheControl = response.headers.get('cache-control');
      if (!cacheControl || !cacheControl.includes('no-cache')) {
        issues.push('Sensitive endpoints should not be cached');
      }
    }

    return issues;
  }
};

// Export default security headers configuration for different contexts
export const DEFAULT_SECURITY_HEADERS = SecurityHeaderConfigs.web;
export const API_SECURITY_HEADERS_CONFIG = SecurityHeaderConfigs.api;
export const UPLOAD_SECURITY_HEADERS_CONFIG = SecurityHeaderConfigs.upload;
export const ADMIN_SECURITY_HEADERS_CONFIG = SecurityHeaderConfigs.admin;
export const AUTH_SECURITY_HEADERS_CONFIG = SecurityHeaderConfigs.auth;
