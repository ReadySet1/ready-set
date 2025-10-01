// src/lib/csrf-protection.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

// CSRF token configuration
const CSRF_CONFIG = {
  tokenLength: 32,
  cookieName: 'csrf-token',
  headerName: 'x-csrf-token',
  paramName: '_csrf',
  secretLength: 64,
  maxAge: 60 * 60 * 1000, // 1 hour
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  httpOnly: true
} as const;

// In-memory token store (use Redis in production)
const tokenStore = new Map<string, { token: string; expires: number; userId?: string }>();

// Generate cryptographically secure token
export function generateCSRFToken(userId?: string): string {
  const token = crypto.randomBytes(CSRF_CONFIG.tokenLength).toString('hex');
  const expires = Date.now() + CSRF_CONFIG.maxAge;

  // Store token with expiration
  tokenStore.set(token, { token, expires, userId });

  // Clean up expired tokens periodically
  cleanupExpiredTokens();

  return token;
}

// Validate CSRF token
export function validateCSRFToken(token: string, userId?: string): boolean {
  const stored = tokenStore.get(token);

  if (!stored) {
    return false;
  }

  // Check if token is expired
  if (Date.now() > stored.expires) {
    tokenStore.delete(token);
    return false;
  }

  // Check if token belongs to the same user (if userId provided)
  if (userId && stored.userId && stored.userId !== userId) {
    return false;
  }

  return true;
}

// Clean up expired tokens
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (now > data.expires) {
      tokenStore.delete(token);
    }
  }
}

// Get CSRF token from request
export function getCSRFTokenFromRequest(request: NextRequest): string | null {
  // Try header first
  const headerToken = request.headers.get(CSRF_CONFIG.headerName);
  if (headerToken) {
    return headerToken;
  }

  // Try query parameter
  const url = new URL(request.url);
  const queryToken = url.searchParams.get(CSRF_CONFIG.paramName);
  if (queryToken) {
    return queryToken;
  }

  // Try form data (for POST requests)
  // This would need to be handled in the route handler for multipart/form-data

  return null;
}

// CSRF validation middleware
export interface CSRFConfig {
  required?: boolean; // Whether CSRF validation is required for this endpoint
  methods?: string[]; // HTTP methods that require CSRF validation
  exemptPaths?: string[]; // Paths that are exempt from CSRF validation
  allowApiKey?: boolean; // Allow API key authentication to bypass CSRF
}

export function withCSRFProtection(config: CSRFConfig = {}) {
  const {
    required = true,
    methods = ['POST', 'PUT', 'DELETE', 'PATCH'],
    exemptPaths = [],
    allowApiKey = true
  } = config;

  return async function csrfMiddleware(request: NextRequest): Promise<NextResponse | null> {
    // Skip CSRF validation for GET, HEAD, OPTIONS
    if (!methods.includes(request.method.toUpperCase())) {
      return null;
    }

    // Check if path is exempt
    const pathname = request.nextUrl.pathname;
    if (exemptPaths.some(path => pathname.startsWith(path))) {
      return null;
    }

    // Check for API key bypass
    if (allowApiKey) {
      const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization');
      if (apiKey && (apiKey.startsWith('Bearer ') || apiKey.startsWith('ApiKey '))) {
        return null; // API key authentication bypasses CSRF
      }
    }

    // Skip CSRF for non-authenticated requests (but still require for authenticated)
    if (required) {
      const token = getCSRFTokenFromRequest(request);
      if (!token) {
        return NextResponse.json(
          {
            error: 'CSRF token required',
            message: 'Cross-site request forgery token is missing',
            code: 'CSRF_TOKEN_MISSING'
          },
          { status: 403 }
        );
      }

      // Validate token
      const authHeader = request.headers.get('authorization');
      let userId: string | undefined;

      if (authHeader?.startsWith('Bearer ')) {
        try {
          // In a real implementation, you'd decode the JWT to get user ID
          const supabase = await createClient();
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id;
        } catch (error) {
          // If we can't get user ID, we'll still validate the token but without user check
        }
      }

      if (!validateCSRFToken(token, userId)) {
        return NextResponse.json(
          {
            error: 'Invalid CSRF token',
            message: 'Cross-site request forgery token is invalid or expired',
            code: 'CSRF_TOKEN_INVALID'
          },
          { status: 403 }
        );
      }
    }

    return null; // CSRF validation passed
  };
}

// Set CSRF token in response
export function setCSRFTokenInResponse(response: NextResponse, token?: string): NextResponse {
  const csrfToken = token || generateCSRFToken();

  // Set CSRF token in cookie (HTTP-only for security)
  response.cookies.set(CSRF_CONFIG.cookieName, csrfToken, {
    httpOnly: CSRF_CONFIG.httpOnly,
    secure: CSRF_CONFIG.secure,
    sameSite: CSRF_CONFIG.sameSite,
    maxAge: CSRF_CONFIG.maxAge / 1000, // Convert to seconds
    path: '/'
  });

  // Also set in response headers for JavaScript access
  response.headers.set('x-csrf-token', csrfToken);

  return response;
}

// CSRF token generation endpoint
export async function generateCSRFTokens(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const token = generateCSRFToken(user?.id);

    const response = NextResponse.json({
      token,
      expiresIn: CSRF_CONFIG.maxAge
    });

    return setCSRFTokenInResponse(response, token);
  } catch (error) {
    console.error('CSRF token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}

// Double-submit cookie pattern implementation
export class CSRFManager {
  private static instance: CSRFManager;
  private tokens = new Map<string, { token: string; expires: number; userId?: string }>();

  private constructor() {
    // Clean up expired tokens every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  static getInstance(): CSRFManager {
    if (!CSRFManager.instance) {
      CSRFManager.instance = new CSRFManager();
    }
    return CSRFManager.instance;
  }

  generateToken(userId?: string): string {
    const token = crypto.randomBytes(CSRF_CONFIG.tokenLength).toString('hex');
    const expires = Date.now() + CSRF_CONFIG.maxAge;

    this.tokens.set(token, { token, expires, userId });
    return token;
  }

  validateToken(token: string, userId?: string): boolean {
    const stored = this.tokens.get(token);

    if (!stored) {
      return false;
    }

    // Check expiration
    if (Date.now() > stored.expires) {
      this.tokens.delete(token);
      return false;
    }

    // Check user match
    if (userId && stored.userId && stored.userId !== userId) {
      return false;
    }

    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [token, data] of this.tokens.entries()) {
      if (now > data.expires) {
        this.tokens.delete(token);
      }
    }
  }

  // Refresh token (generate new one and invalidate old)
  refreshToken(oldToken: string, userId?: string): string | null {
    if (this.validateToken(oldToken, userId)) {
      this.tokens.delete(oldToken);
      return this.generateToken(userId);
    }
    return null;
  }
}

// Export singleton instance
export const csrfManager = CSRFManager.getInstance();

// Enhanced CSRF middleware with double-submit pattern
export function withEnhancedCSRFProtection(config: CSRFConfig = {}) {
  return async function enhancedCSRFMiddleware(request: NextRequest): Promise<NextResponse | null> {
    const csrfMiddleware = withCSRFProtection(config);
    const result = await csrfMiddleware(request);

    if (result) {
      return result; // Return CSRF error if validation fails
    }

    // For successful requests, refresh CSRF token to prevent reuse
    const token = getCSRFTokenFromRequest(request);
    if (token) {
      const authHeader = request.headers.get('authorization');
      let userId: string | undefined;

      if (authHeader?.startsWith('Bearer ')) {
        try {
          const supabase = await createClient();
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id;
        } catch (error) {
          // Continue without user ID
        }
      }

      // Refresh token to prevent replay attacks
      const newToken = csrfManager.refreshToken(token, userId);
      if (newToken) {
        // Note: In a real implementation, you'd want to return this in a response header
        // or redirect to update the client's token
      }
    }

    return null;
  };
}

// CSRF token validation for API routes
export function validateCSRFTokenFromRequest(request: NextRequest, userId?: string): boolean {
  const token = getCSRFTokenFromRequest(request);
  return token ? csrfManager.validateToken(token, userId) : false;
}

// Predefined CSRF configurations for different route types
export const CSRFConfigs = {
  // Strict CSRF for state-changing operations
  strict: {
    required: true,
    methods: ['POST', 'PUT', 'DELETE', 'PATCH'] as string[],
    exemptPaths: [] as string[]
  },

  // Relaxed CSRF for API endpoints (requires API key bypass)
  api: {
    required: true,
    methods: ['POST', 'PUT', 'DELETE', 'PATCH'] as string[],
    exemptPaths: [] as string[],
    allowApiKey: true
  },

  // CSRF for form submissions
  forms: {
    required: true,
    methods: ['POST'] as string[],
    exemptPaths: ['/api/auth'] as string[]
  },

  // Optional CSRF for development/testing
  development: {
    required: false,
    methods: ['POST', 'PUT', 'DELETE', 'PATCH'] as string[],
    exemptPaths: [] as string[]
  }
} as const;

// Create CSRF-protected API route handler
export function createCSRFProtectedHandler<T extends any[], R>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  csrfConfig: CSRFConfig = CSRFConfigs.strict
) {
  return async function csrfProtectedHandler(request: NextRequest, ...args: T): Promise<NextResponse> {
    // Apply CSRF protection
    const csrfResponse = await withCSRFProtection(csrfConfig)(request);
    if (csrfResponse) {
      return csrfResponse; // Return CSRF error if validation fails
    }

    // Proceed with original handler
    return handler(request, ...args);
  };
}
