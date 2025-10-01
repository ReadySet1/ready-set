// src/lib/security-config.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Security configuration schema
export const SecurityConfigSchema = z.object({
  // Rate limiting configuration
  rateLimiting: z.object({
    enabled: z.boolean().default(true),
    defaultTier: z.enum(['AUTH', 'API', 'UPLOAD', 'ADMIN', 'SENSITIVE']).default('API'),
    tiers: z.object({
      AUTH: z.object({
        windowMs: z.number().default(15 * 60 * 1000),
        maxRequests: z.number().default(5),
        strategy: z.enum(['fixed-window', 'sliding-window']).default('sliding-window')
      }),
      API: z.object({
        windowMs: z.number().default(15 * 60 * 1000),
        maxRequests: z.number().default(100),
        strategy: z.enum(['fixed-window', 'sliding-window']).default('sliding-window')
      }),
      UPLOAD: z.object({
        windowMs: z.number().default(60 * 60 * 1000),
        maxRequests: z.number().default(50),
        strategy: z.enum(['fixed-window', 'sliding-window']).default('sliding-window')
      }),
      ADMIN: z.object({
        windowMs: z.number().default(15 * 60 * 1000),
        maxRequests: z.number().default(50),
        strategy: z.enum(['fixed-window', 'sliding-window']).default('sliding-window')
      }),
      SENSITIVE: z.object({
        windowMs: z.number().default(5 * 60 * 1000),
        maxRequests: z.number().default(10),
        strategy: z.enum(['fixed-window', 'sliding-window']).default('sliding-window')
      })
    }).default({})
  }).default({}),

  // Request validation configuration
  validation: z.object({
    enabled: z.boolean().default(true),
    sanitizeInputs: z.boolean().default(true),
    strictValidation: z.boolean().default(false),
    maxRequestSize: z.number().default(10 * 1024 * 1024), // 10MB
    allowedContentTypes: z.array(z.string()).default(['application/json', 'multipart/form-data'])
  }).default({}),

  // CSRF protection configuration
  csrf: z.object({
    enabled: z.boolean().default(true),
    requiredForMethods: z.array(z.string()).default(['POST', 'PUT', 'DELETE', 'PATCH']),
    exemptPaths: z.array(z.string()).default(['/api/auth']),
    allowApiKeyBypass: z.boolean().default(true),
    tokenMaxAge: z.number().default(60 * 60 * 1000), // 1 hour
    cookieSecure: z.boolean().default(true),
    cookieSameSite: z.enum(['strict', 'lax', 'none']).default('strict')
  }).default({}),

  // IP access control configuration
  ipAccessControl: z.object({
    enabled: z.boolean().default(false),
    allowlist: z.array(z.string()).default([]),
    blocklist: z.array(z.string()).default([]),
    allowPrivateIPs: z.boolean().default(true),
    allowTrustedProxies: z.boolean().default(true),
    enableThreatIntelligence: z.boolean().default(false),
    geolocationRules: z.array(z.object({
      country: z.string(),
      action: z.enum(['allow', 'block']),
      reason: z.string().optional()
    })).default([])
  }).default({}),

  // Security headers configuration
  securityHeaders: z.object({
    enabled: z.boolean().default(true),
    includeAll: z.boolean().default(true),
    customHeaders: z.record(z.string()).default({}),
    excludeHeaders: z.array(z.string()).default([]),
    environmentOverrides: z.record(z.record(z.string())).default({}),
    pathOverrides: z.record(z.record(z.string())).default({})
  }).default({}),

  // Security logging configuration
  securityLogging: z.object({
    enabled: z.boolean().default(true),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    storeEvents: z.boolean().default(true),
    maxEventAge: z.number().default(90),
    retentionDays: z.number().default(90),
    enableRealTimeAlerts: z.boolean().default(false),
    alertWebhooks: z.array(z.string()).default([]),
    alertThresholds: z.record(z.number()).default({
      login_failure: 5,
      unauthorized_access: 10,
      csrf_violation: 3,
      rate_limit_exceeded: 50,
      injection_attempt: 1
    })
  }).default({}),

  // Input sanitization configuration
  inputSanitization: z.object({
    enabled: z.boolean().default(true),
    htmlSanitization: z.boolean().default(true),
    sqlInjectionPrevention: z.boolean().default(true),
    xssPrevention: z.boolean().default(true),
    filenameSanitization: z.boolean().default(true),
    aggressiveFiltering: z.boolean().default(false)
  }).default({})
});

// Security configuration type
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

// Default security configuration
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  rateLimiting: {
    enabled: true,
    defaultTier: 'API',
    tiers: {
      AUTH: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
        strategy: 'sliding-window'
      },
      API: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 100,
        strategy: 'sliding-window'
      },
      UPLOAD: {
        windowMs: 60 * 60 * 1000,
        maxRequests: 50,
        strategy: 'sliding-window'
      },
      ADMIN: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 50,
        strategy: 'sliding-window'
      },
      SENSITIVE: {
        windowMs: 5 * 60 * 1000,
        maxRequests: 10,
        strategy: 'sliding-window'
      }
    }
  },
  validation: {
    enabled: true,
    sanitizeInputs: true,
    strictValidation: false,
    maxRequestSize: 10 * 1024 * 1024,
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
    enabled: false,
    allowlist: [],
    blocklist: [],
    allowPrivateIPs: true,
    allowTrustedProxies: true,
    enableThreatIntelligence: false,
    geolocationRules: []
  },
  securityHeaders: {
    enabled: true,
    includeAll: true,
    customHeaders: {},
    excludeHeaders: [],
    environmentOverrides: {},
    pathOverrides: {}
  },
  securityLogging: {
    enabled: true,
    logLevel: 'info',
    storeEvents: true,
    maxEventAge: 90,
    retentionDays: 90,
    enableRealTimeAlerts: false,
    alertWebhooks: [],
    alertThresholds: {
      login_failure: 5,
      unauthorized_access: 10,
      csrf_violation: 3,
      rate_limit_exceeded: 50,
      injection_attempt: 1
    }
  },
  inputSanitization: {
    enabled: true,
    htmlSanitization: true,
    sqlInjectionPrevention: true,
    xssPrevention: true,
    filenameSanitization: true,
    aggressiveFiltering: false
  }
};

// Security configuration manager
export class SecurityConfigManager {
  private static instance: SecurityConfigManager;
  private config: SecurityConfig = DEFAULT_SECURITY_CONFIG;

  private constructor() {
    this.loadConfig();
  }

  static getInstance(): SecurityConfigManager {
    if (!SecurityConfigManager.instance) {
      SecurityConfigManager.instance = new SecurityConfigManager();
    }
    return SecurityConfigManager.instance;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): void {
    try {
      // Rate limiting config
      const rateLimitingConfig = {
        enabled: process.env.SECURITY_RATE_LIMITING_ENABLED !== 'false',
        defaultTier: (process.env.SECURITY_RATE_LIMITING_DEFAULT_TIER as any) || 'API',
        tiers: {
          AUTH: {
            windowMs: parseInt(process.env.SECURITY_RATE_LIMITING_AUTH_WINDOW || '900000'),
            maxRequests: parseInt(process.env.SECURITY_RATE_LIMITING_AUTH_MAX || '5'),
            strategy: (process.env.SECURITY_RATE_LIMITING_AUTH_STRATEGY as any) || 'sliding-window'
          },
          API: {
            windowMs: parseInt(process.env.SECURITY_RATE_LIMITING_API_WINDOW || '900000'),
            maxRequests: parseInt(process.env.SECURITY_RATE_LIMITING_API_MAX || '100'),
            strategy: (process.env.SECURITY_RATE_LIMITING_API_STRATEGY as any) || 'sliding-window'
          },
          UPLOAD: {
            windowMs: parseInt(process.env.SECURITY_RATE_LIMITING_UPLOAD_WINDOW || '3600000'),
            maxRequests: parseInt(process.env.SECURITY_RATE_LIMITING_UPLOAD_MAX || '50'),
            strategy: (process.env.SECURITY_RATE_LIMITING_UPLOAD_STRATEGY as any) || 'sliding-window'
          },
          ADMIN: {
            windowMs: parseInt(process.env.SECURITY_RATE_LIMITING_ADMIN_WINDOW || '900000'),
            maxRequests: parseInt(process.env.SECURITY_RATE_LIMITING_ADMIN_MAX || '50'),
            strategy: (process.env.SECURITY_RATE_LIMITING_ADMIN_STRATEGY as any) || 'sliding-window'
          },
          SENSITIVE: {
            windowMs: parseInt(process.env.SECURITY_RATE_LIMITING_SENSITIVE_WINDOW || '300000'),
            maxRequests: parseInt(process.env.SECURITY_RATE_LIMITING_SENSITIVE_MAX || '10'),
            strategy: (process.env.SECURITY_RATE_LIMITING_SENSITIVE_STRATEGY as any) || 'sliding-window'
          }
        }
      };

      // Validation config
      const validationConfig = {
        enabled: process.env.SECURITY_VALIDATION_ENABLED !== 'false',
        sanitizeInputs: process.env.SECURITY_VALIDATION_SANITIZE !== 'false',
        strictValidation: process.env.SECURITY_VALIDATION_STRICT === 'true',
        maxRequestSize: parseInt(process.env.SECURITY_VALIDATION_MAX_SIZE || '10485760'),
        allowedContentTypes: (process.env.SECURITY_VALIDATION_CONTENT_TYPES || 'application/json,multipart/form-data').split(',')
      };

      // CSRF config
      const csrfConfig = {
        enabled: process.env.SECURITY_CSRF_ENABLED !== 'false',
        requiredForMethods: (process.env.SECURITY_CSRF_METHODS || 'POST,PUT,DELETE,PATCH').split(','),
        exemptPaths: (process.env.SECURITY_CSRF_EXEMPT_PATHS || '/api/auth').split(','),
        allowApiKeyBypass: process.env.SECURITY_CSRF_ALLOW_API_KEY !== 'false',
        tokenMaxAge: parseInt(process.env.SECURITY_CSRF_TOKEN_MAX_AGE || '3600000'),
        cookieSecure: process.env.SECURITY_CSRF_COOKIE_SECURE !== 'false',
        cookieSameSite: (process.env.SECURITY_CSRF_COOKIE_SAME_SITE as any) || 'strict'
      };

      // IP access control config
      const ipAccessControlConfig = {
        enabled: process.env.SECURITY_IP_ACCESS_CONTROL_ENABLED === 'true',
        allowlist: (process.env.SECURITY_IP_ALLOWLIST || '').split(',').filter(Boolean),
        blocklist: (process.env.SECURITY_IP_BLOCKLIST || '').split(',').filter(Boolean),
        allowPrivateIPs: process.env.SECURITY_IP_ALLOW_PRIVATE !== 'false',
        allowTrustedProxies: process.env.SECURITY_IP_ALLOW_PROXIES !== 'false',
        enableThreatIntelligence: process.env.SECURITY_IP_THREAT_INTELLIGENCE === 'true',
        geolocationRules: [] // Would be parsed from env if needed
      };

      // Security headers config
      const securityHeadersConfig = {
        enabled: process.env.SECURITY_HEADERS_ENABLED !== 'false',
        includeAll: process.env.SECURITY_HEADERS_INCLUDE_ALL !== 'false',
        customHeaders: {},
        excludeHeaders: (process.env.SECURITY_HEADERS_EXCLUDE || '').split(',').filter(Boolean),
        environmentOverrides: {},
        pathOverrides: {}
      };

      // Security logging config
      const securityLoggingConfig = {
        enabled: process.env.SECURITY_LOGGING_ENABLED !== 'false',
        logLevel: (process.env.SECURITY_LOGGING_LEVEL as any) || 'info',
        storeEvents: process.env.SECURITY_LOGGING_STORE_EVENTS !== 'false',
        maxEventAge: parseInt(process.env.SECURITY_LOGGING_MAX_AGE || '90'),
        retentionDays: parseInt(process.env.SECURITY_LOGGING_RETENTION || '90'),
        enableRealTimeAlerts: process.env.SECURITY_LOGGING_ALERTS === 'true',
        alertWebhooks: (process.env.SECURITY_LOGGING_WEBHOOKS || '').split(',').filter(Boolean),
        alertThresholds: {
          login_failure: parseInt(process.env.SECURITY_LOGGING_THRESHOLD_LOGIN_FAILURE || '5'),
          unauthorized_access: parseInt(process.env.SECURITY_LOGGING_THRESHOLD_UNAUTHORIZED || '10'),
          csrf_violation: parseInt(process.env.SECURITY_LOGGING_THRESHOLD_CSRF || '3'),
          rate_limit_exceeded: parseInt(process.env.SECURITY_LOGGING_THRESHOLD_RATE_LIMIT || '50'),
          injection_attempt: parseInt(process.env.SECURITY_LOGGING_THRESHOLD_INJECTION || '1')
        }
      };

      // Input sanitization config
      const inputSanitizationConfig = {
        enabled: process.env.SECURITY_SANITIZATION_ENABLED !== 'false',
        htmlSanitization: process.env.SECURITY_SANITIZATION_HTML !== 'false',
        sqlInjectionPrevention: process.env.SECURITY_SANITIZATION_SQL !== 'false',
        xssPrevention: process.env.SECURITY_SANITIZATION_XSS !== 'false',
        filenameSanitization: process.env.SECURITY_SANITIZATION_FILENAME !== 'false',
        aggressiveFiltering: process.env.SECURITY_SANITIZATION_AGGRESSIVE === 'true'
      };

      // Merge configurations
      this.config = {
        rateLimiting: { ...this.config.rateLimiting, ...rateLimitingConfig },
        validation: { ...this.config.validation, ...validationConfig },
        csrf: { ...this.config.csrf, ...csrfConfig },
        ipAccessControl: { ...this.config.ipAccessControl, ...ipAccessControlConfig },
        securityHeaders: { ...this.config.securityHeaders, ...securityHeadersConfig },
        securityLogging: { ...this.config.securityLogging, ...securityLoggingConfig },
        inputSanitization: { ...this.config.inputSanitization, ...inputSanitizationConfig }
      };

    } catch (error) {
      console.error('Error loading security configuration:', error);
      // Keep default config on error
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    try {
      const merged = { ...this.config, ...newConfig };
      const validated = SecurityConfigSchema.parse(merged);
      this.config = validated;
    } catch (error) {
      console.error('Invalid security configuration:', error);
      throw new Error('Invalid security configuration provided');
    }
  }

  /**
   * Validate configuration
   */
  validateConfig(config: any): { isValid: boolean; errors: string[] } {
    try {
      SecurityConfigSchema.parse(config);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { isValid: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * Export configuration for backup/audit
   */
  exportConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Import configuration from backup
   */
  importConfig(config: SecurityConfig): void {
    const validation = this.validateConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }
    this.config = config;
  }
}

// Export singleton instance
export const securityConfigManager = SecurityConfigManager.getInstance();

// Comprehensive security middleware that integrates all features
export function withSecurity(config?: Partial<SecurityConfig>) {
  // Update configuration if provided
  if (config) {
    securityConfigManager.updateConfig(config);
  }

  const currentConfig = securityConfigManager.getConfig();

  return async function securityMiddleware(request: NextRequest): Promise<NextResponse | null> {
    // Import security modules (lazy loading to avoid circular dependencies)
    const { withRateLimit, getRateLimitForRequest } = await import('./rate-limiting');
    const { withValidation, SecurityValidation } = await import('./validation');
    const { withCSRFProtection } = await import('./csrf-protection');
    const { withSecurityHeaders } = await import('./security-headers');
    const { withIPAccessControl } = await import('./ip-management');
    const { securityLogger } = await import('./security-logging');

    // Get client information for logging
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    // 1. IP Access Control (first line of defense)
    if (currentConfig.ipAccessControl.enabled) {
      const ipControlResponse = await withIPAccessControl({
        allowlist: currentConfig.ipAccessControl.allowlist,
        blocklist: currentConfig.ipAccessControl.blocklist,
        allowPrivateIPs: currentConfig.ipAccessControl.allowPrivateIPs,
        allowTrustedProxies: currentConfig.ipAccessControl.allowTrustedProxies,
        enableThreatIntelligence: currentConfig.ipAccessControl.enableThreatIntelligence,
        geolocationRules: currentConfig.ipAccessControl.geolocationRules
      })(request);

      if (ipControlResponse) {
        securityLogger.log('unauthorized_access', 'high', 'IP access control violation', request);
        return ipControlResponse;
      }
    }

    // 2. Rate Limiting
    if (currentConfig.rateLimiting.enabled) {
      const rateLimitTier = getRateLimitForRequest(request);
      const rateLimitResponse = await withRateLimit(rateLimitTier)(request);

      if (rateLimitResponse) {
        securityLogger.logRateLimitEvent(
          request,
          rateLimitTier,
          parseInt(rateLimitResponse.headers.get('x-ratelimit-current') || '0'),
          parseInt(rateLimitResponse.headers.get('x-ratelimit-limit') || '100')
        );
        return rateLimitResponse;
      }
    }

    // 3. Request Validation and Sanitization
    if (currentConfig.validation.enabled) {
      // Basic request size validation
      if (!SecurityValidation.validateRequestSize(request, currentConfig.validation.maxRequestSize)) {
        securityLogger.log('validation_error', 'medium', 'Request size exceeded', request, {
          maxSize: currentConfig.validation.maxRequestSize
        });
        return NextResponse.json(
          { error: 'Request too large', code: 'REQUEST_TOO_LARGE' },
          { status: 413 }
        );
      }

      // Content type validation
      if (!SecurityValidation.validateContentType(request, currentConfig.validation.allowedContentTypes)) {
        securityLogger.log('validation_error', 'medium', 'Invalid content type', request);
        return NextResponse.json(
          { error: 'Invalid content type', code: 'INVALID_CONTENT_TYPE' },
          { status: 415 }
        );
      }

      // Injection pattern detection
      const bodyText = await request.text();
      if (bodyText && SecurityValidation.detectInjection(bodyText)) {
        securityLogger.logInjectionEvent(request, ['Potential injection attack'], clientIP);
        return NextResponse.json(
          { error: 'Suspicious request content', code: 'INJECTION_DETECTED' },
          { status: 400 }
        );
      }
    }

    // 4. CSRF Protection
    if (currentConfig.csrf.enabled) {
      const csrfResponse = await withCSRFProtection({
        required: currentConfig.csrf.enabled,
        methods: currentConfig.csrf.requiredForMethods,
        exemptPaths: currentConfig.csrf.exemptPaths,
        allowApiKey: currentConfig.csrf.allowApiKeyBypass
      })(request);

      if (csrfResponse) {
        securityLogger.logCSRFEvent(request, 'CSRF token missing or invalid');
        return csrfResponse;
      }
    }

    // 5. Security Headers (applied to all responses)
    if (currentConfig.securityHeaders.enabled) {
      const headersResponse = withSecurityHeaders({
        includeAll: currentConfig.securityHeaders.includeAll,
        customHeaders: currentConfig.securityHeaders.customHeaders,
        excludeHeaders: currentConfig.securityHeaders.excludeHeaders,
        environmentOverrides: currentConfig.securityHeaders.environmentOverrides,
        pathOverrides: currentConfig.securityHeaders.pathOverrides
      })(request);

      if (headersResponse) {
        return headersResponse;
      }
    }

    return null; // All security checks passed
  };
}

// Security monitoring endpoint configuration
export interface SecurityMonitoringConfig {
  endpoint: string;
  requireAuth: boolean;
  allowedRoles?: string[];
  enableMetrics: boolean;
  enableLogs: boolean;
  enableAlerts: boolean;
}

// Default monitoring configuration
export const DEFAULT_MONITORING_CONFIG: SecurityMonitoringConfig = {
  endpoint: '/api/admin/security-monitoring',
  requireAuth: true,
  allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
  enableMetrics: true,
  enableLogs: true,
  enableAlerts: true
};

// Security monitoring utilities
export const SecurityMonitoringUtils = {
  /**
   * Get security health status
   */
  getHealthStatus(): {
    overall: 'healthy' | 'warning' | 'critical';
    components: Record<string, 'healthy' | 'warning' | 'critical'>;
    issues: string[];
  } {
    const issues: string[] = [];
    const components: Record<string, 'healthy' | 'warning' | 'critical'> = {};

    // Check rate limiting
    try {
      const rateLimitStorage = (global as any).__rateLimitStorage;
      if (!rateLimitStorage) {
        issues.push('Rate limiting storage not configured');
        components.rateLimiting = 'critical';
      } else {
        components.rateLimiting = 'healthy';
      }
    } catch {
      components.rateLimiting = 'critical';
      issues.push('Rate limiting check failed');
    }

    // Check security logging
    try {
      const logger = (global as any).__securityLogger;
      if (!logger) {
        issues.push('Security logging not configured');
        components.securityLogging = 'warning';
      } else {
        components.securityLogging = 'healthy';
      }
    } catch {
      components.securityLogging = 'warning';
      issues.push('Security logging check failed');
    }

    // Check IP management
    try {
      const ipManager = (global as any).__ipManager;
      if (!ipManager) {
        components.ipManagement = 'warning';
      } else {
        components.ipManagement = 'healthy';
      }
    } catch {
      components.ipManagement = 'warning';
      issues.push('IP management check failed');
    }

    // Determine overall status
    const hasCritical = Object.values(components).some(status => status === 'critical');
    const hasWarnings = Object.values(components).some(status => status === 'warning');

    const overall = hasCritical ? 'critical' : (hasWarnings ? 'warning' : 'healthy');

    return { overall, components, issues };
  },

  /**
   * Get security metrics
   */
  async getMetrics(timeRange?: { start: Date; end: Date }): Promise<{
    requests: { total: number; blocked: number; rateLimited: number };
    threats: { detected: number; blocked: number; byType: Record<string, number> };
    performance: { avgResponseTime: number; errorRate: number };
  }> {
    // This would integrate with actual monitoring data in production
    return {
      requests: { total: 0, blocked: 0, rateLimited: 0 },
      threats: { detected: 0, blocked: 0, byType: {} },
      performance: { avgResponseTime: 0, errorRate: 0 }
    };
  }
};
