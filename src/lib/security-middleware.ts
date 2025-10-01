// src/lib/security-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from './security-config';
import { securityConfigManager } from './security-config';

// Main security middleware that applies all security measures
export function withAllSecurity(config?: Parameters<typeof withSecurity>[0]) {
  return withSecurity(config);
}

// API route security wrapper with common configurations
export class SecureAPIRoute {
  /**
   * Create a secure API route with standard security measures
   */
  static create<T extends any[], R>(
    handler: (request: NextRequest & { validatedData?: any; sanitizedData?: any }, ...args: T) => Promise<NextResponse>,
    options: {
      rateLimit?: 'AUTH' | 'API' | 'UPLOAD' | 'ADMIN' | 'SENSITIVE';
      validation?: Parameters<typeof import('./validation').withValidation>[0];
      csrf?: Parameters<typeof import('./csrf-protection').withCSRFProtection>[0];
      requireAuth?: boolean;
      allowedRoles?: string[];
      customSecurity?: Parameters<typeof withSecurity>[0];
    } = {}
  ) {
    const {
      rateLimit = 'API',
      validation,
      csrf,
      requireAuth = false,
      allowedRoles = [],
      customSecurity
    } = options;

    return async function secureHandler(request: NextRequest, ...args: T): Promise<NextResponse> {
      // Apply comprehensive security
      const securityResponse = await withSecurity(customSecurity)(request);
      if (securityResponse) {
        return securityResponse;
      }

      // Apply specific security measures if provided
      if (validation) {
        const { withValidation } = await import('./validation');
        const validationResponse = await withValidation(validation)(request);
        if (validationResponse) {
          return validationResponse;
        }
      }

      if (csrf) {
        const { withCSRFProtection } = await import('./csrf-protection');
        const csrfResponse = await withCSRFProtection(csrf)(request);
        if (csrfResponse) {
          return csrfResponse;
        }
      }

      // Apply authentication if required
      if (requireAuth) {
        const { withAuth } = await import('./auth-middleware');
        const authResult = await withAuth(request, { allowedRoles, requireAuth: true });

        if (!authResult.success) {
          return authResult.response!;
        }

        // Add user context to request
        (request as any).authContext = authResult.context;
      }

      // Execute the original handler
      return handler(request as NextRequest & { validatedData?: any; sanitizedData?: any }, ...args);
    };
  }

  /**
   * Create a secure authentication route
   */
  static auth<T extends any[], R>(
    handler: (request: NextRequest & { validatedData?: any }, ...args: T) => Promise<NextResponse>,
    options: {
      validation?: Parameters<typeof import('./validation').withValidation>[0];
      rateLimit?: 'AUTH';
    } = {}
  ) {
    const { validation, rateLimit = 'AUTH' } = options;

    return this.create(handler, {
      rateLimit,
      validation: validation || {
        body: await import('./validation').then(m => m.ApiSchemas.userLogin)
      },
      csrf: { exemptPaths: ['/api/auth'] }, // CSRF exempt for auth endpoints
      requireAuth: false // Auth endpoints don't require auth
    });
  }

  /**
   * Create a secure admin route
   */
  static admin<T extends any[], R>(
    handler: (request: NextRequest & { validatedData?: any; authContext?: any }, ...args: T) => Promise<NextResponse>,
    options: {
      validation?: Parameters<typeof import('./validation').withValidation>[0];
      allowedRoles?: string[];
      rateLimit?: 'ADMIN';
    } = {}
  ) {
    const { validation, allowedRoles = ['ADMIN', 'SUPER_ADMIN'], rateLimit = 'ADMIN' } = options;

    return this.create(handler, {
      rateLimit,
      validation,
      requireAuth: true,
      allowedRoles,
      csrf: { allowApiKey: true } // Allow API key bypass for admin APIs
    });
  }

  /**
   * Create a secure file upload route
   */
  static upload<T extends any[], R>(
    handler: (request: NextRequest & { validatedData?: any; sanitizedData?: any }, ...args: T) => Promise<NextResponse>,
    options: {
      validation?: Parameters<typeof import('./validation').withValidation>[0];
      rateLimit?: 'UPLOAD';
      maxFileSize?: number;
    } = {}
  ) {
    const { validation, rateLimit = 'UPLOAD', maxFileSize } = options;

    return this.create(handler, {
      rateLimit,
      validation: validation || {
        body: await import('./validation').then(m => m.ApiSchemas.fileUpload),
        sanitizeBody: true
      },
      csrf: { allowApiKey: true } // Allow API key bypass for uploads
    });
  }

  /**
   * Create a secure sensitive operation route
   */
  static sensitive<T extends any[], R>(
    handler: (request: NextRequest & { validatedData?: any; authContext?: any }, ...args: T) => Promise<NextResponse>,
    options: {
      validation?: Parameters<typeof import('./validation').withValidation>[0];
      allowedRoles?: string[];
      rateLimit?: 'SENSITIVE';
      requireAuth?: boolean;
    } = {}
  ) {
    const { validation, allowedRoles = ['ADMIN', 'SUPER_ADMIN'], rateLimit = 'SENSITIVE' } = options;

    return this.create(handler, {
      rateLimit,
      validation,
      requireAuth: true,
      allowedRoles,
      csrf: { allowApiKey: false } // No API key bypass for sensitive operations
    });
  }
}

// Security utility functions for API routes
export const SecurityUtils = {
  /**
   * Apply security middleware to an API route
   */
  apply: withSecurity,

  /**
   * Get current security configuration
   */
  getConfig: () => securityConfigManager.getConfig(),

  /**
   * Update security configuration
   */
  updateConfig: (config: Parameters<typeof securityConfigManager.updateConfig>[0]) =>
    securityConfigManager.updateConfig(config),

  /**
   * Validate security configuration
   */
  validateConfig: (config: any) => securityConfigManager.validateConfig(config),

  /**
   * Log security event
   */
  logEvent: async (
    type: Parameters<typeof import('./security-logging').securityLogger.log>[0],
    severity: Parameters<typeof import('./security-logging').securityLogger.log>[1],
    message: string,
    request: NextRequest,
    details?: Record<string, any>,
    userId?: string
  ) => {
    const { securityLogger } = await import('./security-logging');
    return securityLogger.log(type, severity, message, request, details, userId);
  },

  /**
   * Check if IP is allowed
   */
  isIPAllowed: (request: NextRequest) => {
    const { ipManager } = require('./ip-management');
    return ipManager.isAllowed(ipManager.getClientIP(request));
  },

  /**
   * Generate CSRF token
   */
  generateCSRFToken: (userId?: string) => {
    const { generateCSRFToken } = require('./csrf-protection');
    return generateCSRFToken(userId);
  },

  /**
   * Validate CSRF token from request
   */
  validateCSRFToken: (request: NextRequest, userId?: string) => {
    const { validateCSRFTokenFromRequest } = require('./csrf-protection');
    return validateCSRFTokenFromRequest(request, userId);
  },

  /**
   * Sanitize input data
   */
  sanitizeInput: (data: any, type?: 'html' | 'text' | 'sql' | 'filename' | 'number') => {
    const { InputSanitizer } = require('./validation');
    return InputSanitizer.sanitize(data, type);
  }
};

// Environment-specific security configurations
export const SecurityPresets = {
  /**
   * Development environment - relaxed security for easier development
   */
  development: {
    rateLimiting: {
      enabled: true,
      defaultTier: 'API',
      tiers: {
        AUTH: { windowMs: 15 * 60 * 1000, maxRequests: 100, strategy: 'sliding-window' },
        API: { windowMs: 15 * 60 * 1000, maxRequests: 1000, strategy: 'sliding-window' },
        UPLOAD: { windowMs: 60 * 60 * 1000, maxRequests: 100, strategy: 'sliding-window' },
        ADMIN: { windowMs: 15 * 60 * 1000, maxRequests: 500, strategy: 'sliding-window' },
        SENSITIVE: { windowMs: 5 * 60 * 1000, maxRequests: 50, strategy: 'sliding-window' }
      }
    },
    validation: {
      enabled: true,
      sanitizeInputs: true,
      strictValidation: false,
      maxRequestSize: 50 * 1024 * 1024, // 50MB for development
      allowedContentTypes: ['application/json', 'multipart/form-data', 'text/plain']
    },
    csrf: {
      enabled: false, // Disabled in development for easier testing
      requiredForMethods: ['POST', 'PUT', 'DELETE', 'PATCH'],
      exemptPaths: ['/api/auth', '/api/test'],
      allowApiKeyBypass: true,
      tokenMaxAge: 60 * 60 * 1000,
      cookieSecure: false,
      cookieSameSite: 'lax'
    },
    ipAccessControl: {
      enabled: false // Disabled in development
    },
    securityHeaders: {
      enabled: true,
      includeAll: true,
      environmentOverrides: {
        development: {
          'Content-Security-Policy': "default-src 'self' http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' http://localhost:* https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com http://localhost:*; img-src 'self' data: https: http://localhost:*; connect-src 'self' https://*.supabase.co wss://*.supabase.co http://localhost:* ws://localhost:*;"
        }
      }
    },
    securityLogging: {
      enabled: true,
      logLevel: 'debug',
      storeEvents: true,
      maxEventAge: 7, // 7 days in development
      retentionDays: 7,
      enableRealTimeAlerts: false
    }
  },

  /**
   * Production environment - strict security
   */
  production: {
    rateLimiting: {
      enabled: true,
      defaultTier: 'API',
      tiers: {
        AUTH: { windowMs: 15 * 60 * 1000, maxRequests: 5, strategy: 'sliding-window' },
        API: { windowMs: 15 * 60 * 1000, maxRequests: 100, strategy: 'sliding-window' },
        UPLOAD: { windowMs: 60 * 60 * 1000, maxRequests: 50, strategy: 'sliding-window' },
        ADMIN: { windowMs: 15 * 60 * 1000, maxRequests: 50, strategy: 'sliding-window' },
        SENSITIVE: { windowMs: 5 * 60 * 1000, maxRequests: 10, strategy: 'sliding-window' }
      }
    },
    validation: {
      enabled: true,
      sanitizeInputs: true,
      strictValidation: true,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      allowedContentTypes: ['application/json', 'multipart/form-data']
    },
    csrf: {
      enabled: true,
      requiredForMethods: ['POST', 'PUT', 'DELETE', 'PATCH'],
      exemptPaths: ['/api/auth'],
      allowApiKeyBypass: true,
      tokenMaxAge: 60 * 60 * 1000,
      cookieSecure: true,
      cookieSameSite: 'strict'
    },
    ipAccessControl: {
      enabled: true,
      allowPrivateIPs: false, // Block private IPs in production
      allowTrustedProxies: true,
      enableThreatIntelligence: true,
      geolocationRules: [] // Configure based on business needs
    },
    securityHeaders: {
      enabled: true,
      includeAll: true
    },
    securityLogging: {
      enabled: true,
      logLevel: 'info',
      storeEvents: true,
      maxEventAge: 90,
      retentionDays: 90,
      enableRealTimeAlerts: true,
      alertWebhooks: [] // Configure with actual webhook URLs
    }
  },

  /**
   * Staging environment - balanced security
   */
  staging: {
    rateLimiting: {
      enabled: true,
      defaultTier: 'API',
      tiers: {
        AUTH: { windowMs: 15 * 60 * 1000, maxRequests: 10, strategy: 'sliding-window' },
        API: { windowMs: 15 * 60 * 1000, maxRequests: 200, strategy: 'sliding-window' },
        UPLOAD: { windowMs: 60 * 60 * 1000, maxRequests: 75, strategy: 'sliding-window' },
        ADMIN: { windowMs: 15 * 60 * 1000, maxRequests: 100, strategy: 'sliding-window' },
        SENSITIVE: { windowMs: 5 * 60 * 1000, maxRequests: 20, strategy: 'sliding-window' }
      }
    },
    validation: {
      enabled: true,
      sanitizeInputs: true,
      strictValidation: true,
      maxRequestSize: 25 * 1024 * 1024, // 25MB
      allowedContentTypes: ['application/json', 'multipart/form-data']
    },
    csrf: {
      enabled: true,
      requiredForMethods: ['POST', 'PUT', 'DELETE', 'PATCH'],
      exemptPaths: ['/api/auth'],
      allowApiKeyBypass: true,
      tokenMaxAge: 60 * 60 * 1000,
      cookieSecure: true,
      cookieSameSite: 'strict'
    },
    ipAccessControl: {
      enabled: true,
      allowPrivateIPs: false,
      allowTrustedProxies: true,
      enableThreatIntelligence: false, // Disable in staging to avoid false positives
      geolocationRules: []
    },
    securityHeaders: {
      enabled: true,
      includeAll: true
    },
    securityLogging: {
      enabled: true,
      logLevel: 'info',
      storeEvents: true,
      maxEventAge: 30,
      retentionDays: 30,
      enableRealTimeAlerts: false
    }
  }
};

// Apply security preset based on environment
export function applySecurityPreset(preset?: keyof typeof SecurityPresets) {
  const env = process.env.NODE_ENV || 'development';
  const presetName = preset || env;

  const presetConfig = SecurityPresets[presetName as keyof typeof SecurityPresets];
  if (presetConfig) {
    securityConfigManager.updateConfig(presetConfig);
    console.log(`✅ Applied security preset: ${presetName}`);
  } else {
    console.warn(`⚠️ Security preset '${presetName}' not found, using default configuration`);
  }
}

// Initialize security on application startup
export function initializeSecurity() {
  // Apply environment-specific security preset
  applySecurityPreset();

  // Set up periodic cleanup for security events
  setInterval(async () => {
    const { securityLogger } = require('./security-logging');
    const cleaned = securityLogger.cleanup(90);
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old security events`);
    }
  }, 24 * 60 * 60 * 1000); // Daily cleanup

  // Set up threat intelligence cleanup
  setInterval(async () => {
    const { ThreatIntelligence } = require('./ip-management');
    const cleaned = ThreatIntelligence.cleanup(30);
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old threat intelligence entries`);
    }
  }, 7 * 24 * 60 * 60 * 1000); // Weekly cleanup

  console.log('🔒 Security system initialized');
}

// Export types and interfaces for use in API routes
export type {
  SecurityConfig,
  SecurityMonitoringConfig
} from './security-config';

export {
  SecurityEventType,
  SecurityEventSeverity,
  SecurityEvent
} from './security-logging';

export {
  RateLimitTier,
  RateLimitConfig,
  RateLimitConfigs
} from './rate-limiting';

export {
  ValidationConfig,
  ValidationPatterns,
  CommonSchemas,
  ApiSchemas
} from './validation';

export {
  CSRFConfig,
  CSRFConfigs
} from './csrf-protection';

export {
  SecurityHeadersConfig,
  SecurityHeaderConfigs
} from './security-headers';

export {
  IPAccessControlConfig,
  GeolocationRule
} from './ip-management';
