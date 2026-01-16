import { NextRequest, NextResponse } from 'next/server';
import {
  SECURITY_HEADERS,
  generateSecurityHeaders,
  withSecurityHeaders,
  addSecurityHeaders,
  SecurityValidation,
  API_SECURITY_HEADERS,
  UPLOAD_SECURITY_HEADERS,
  ADMIN_SECURITY_HEADERS,
  SecurityHeaderConfigs,
} from '../security-headers';

// Mock crypto.randomUUID
const mockUUID = 'test-uuid-1234-5678';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: () => mockUUID,
}));

// Also mock global.crypto for edge runtime
const originalRandomUUID = global.crypto?.randomUUID;
beforeAll(() => {
  if (global.crypto) {
    global.crypto.randomUUID = jest.fn(() => mockUUID) as () => `${string}-${string}-${string}-${string}-${string}`;
  }
});

afterAll(() => {
  if (global.crypto && originalRandomUUID) {
    global.crypto.randomUUID = originalRandomUUID;
  }
});

// Helper to create a mock NextRequest with proper nextUrl
function createMockRequest(
  url: string = 'https://example.com/',
  headers: Record<string, string> = {}
): NextRequest {
  const headerObj = new Headers();
  Object.entries(headers).forEach(([key, value]) => {
    headerObj.set(key, value);
  });
  const request = new NextRequest(new URL(url), {
    headers: headerObj,
  });

  // Ensure nextUrl is properly set (jest.setup.ts may override Request class)
  if (!request.nextUrl || !request.nextUrl.pathname) {
    const parsedUrl = new URL(url);
    Object.defineProperty(request, 'nextUrl', {
      value: {
        pathname: parsedUrl.pathname,
        search: parsedUrl.search,
        searchParams: parsedUrl.searchParams,
        href: parsedUrl.href,
        origin: parsedUrl.origin,
        host: parsedUrl.host,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        protocol: parsedUrl.protocol,
        hash: parsedUrl.hash,
      },
      writable: false,
      configurable: true,
    });
  }

  return request;
}

describe('security-headers', () => {
  describe('SECURITY_HEADERS', () => {
    it('should contain required security headers', () => {
      expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
      expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
      expect(SECURITY_HEADERS['X-XSS-Protection']).toBe('1; mode=block');
      expect(SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should have Content-Security-Policy defined', () => {
      expect(SECURITY_HEADERS['Content-Security-Policy']).toBeDefined();
      expect(typeof SECURITY_HEADERS['Content-Security-Policy']).toBe('string');
    });

    it('should have Permissions-Policy defined', () => {
      expect(SECURITY_HEADERS['Permissions-Policy']).toBeDefined();
      expect(SECURITY_HEADERS['Permissions-Policy']).toContain('camera=()');
      expect(SECURITY_HEADERS['Permissions-Policy']).toContain('microphone=()');
      expect(SECURITY_HEADERS['Permissions-Policy']).toContain('geolocation=()');
    });

    it('should have Feature-Policy defined', () => {
      expect(SECURITY_HEADERS['Feature-Policy']).toBeDefined();
      expect(SECURITY_HEADERS['Feature-Policy']).toContain('camera "none"');
      expect(SECURITY_HEADERS['Feature-Policy']).toContain('microphone "none"');
    });
  });

  describe('API_SECURITY_HEADERS', () => {
    it('should have stricter CSP for API endpoints', () => {
      expect(API_SECURITY_HEADERS['Content-Security-Policy']).toContain(
        "default-src 'none'"
      );
    });

    it('should have API version headers', () => {
      expect(API_SECURITY_HEADERS['X-API-Version']).toBe('1.0');
      expect(API_SECURITY_HEADERS['X-API-Deprecated']).toBe('false');
    });

    it('should have cache control headers', () => {
      expect(API_SECURITY_HEADERS['Cache-Control']).toContain('no-cache');
      expect(API_SECURITY_HEADERS['Cache-Control']).toContain('no-store');
      expect(API_SECURITY_HEADERS['Pragma']).toBe('no-cache');
      expect(API_SECURITY_HEADERS['Expires']).toBe('0');
    });
  });

  describe('UPLOAD_SECURITY_HEADERS', () => {
    it('should have upload-specific security headers', () => {
      expect(UPLOAD_SECURITY_HEADERS['X-Upload-Security']).toBe('enabled');
      expect(UPLOAD_SECURITY_HEADERS['X-File-Validation']).toBe('enabled');
    });

    it('should have restrictive CSP for uploads', () => {
      expect(UPLOAD_SECURITY_HEADERS['Content-Security-Policy']).toContain(
        "script-src 'none'"
      );
    });
  });

  describe('ADMIN_SECURITY_HEADERS', () => {
    it('should have admin-specific security headers', () => {
      expect(ADMIN_SECURITY_HEADERS['X-Admin-Access']).toBe('restricted');
      expect(ADMIN_SECURITY_HEADERS['X-Session-Timeout']).toBe('enabled');
    });

    it('should have strict cache control', () => {
      expect(ADMIN_SECURITY_HEADERS['Cache-Control']).toContain('private');
    });
  });

  describe('generateSecurityHeaders', () => {
    it('should generate default security headers', () => {
      const request = createMockRequest();
      const headers = generateSecurityHeaders(request);

      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    });

    it('should apply custom headers', () => {
      const request = createMockRequest();
      const headers = generateSecurityHeaders(request, {
        customHeaders: {
          'X-Custom-Header': 'custom-value',
        },
      });

      expect(headers['X-Custom-Header']).toBe('custom-value');
    });

    it('should exclude specified headers', () => {
      const request = createMockRequest();
      const headers = generateSecurityHeaders(request, {
        excludeHeaders: ['X-Frame-Options'],
      });

      expect(headers['X-Frame-Options']).toBeUndefined();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should apply path-specific overrides', () => {
      const request = createMockRequest('https://example.com/admin/dashboard');
      const headers = generateSecurityHeaders(request, {
        pathOverrides: {
          '/admin': {
            'X-Admin-Access': 'restricted',
          },
        },
      });

      expect(headers['X-Admin-Access']).toBe('restricted');
    });

    it('should not apply path overrides for non-matching paths', () => {
      const request = createMockRequest('https://example.com/public/page');
      const headers = generateSecurityHeaders(request, {
        pathOverrides: {
          '/admin': {
            'X-Admin-Access': 'restricted',
          },
        },
      });

      expect(headers['X-Admin-Access']).toBeUndefined();
    });
  });

  describe('withSecurityHeaders', () => {
    it('should return a middleware function', () => {
      const middleware = withSecurityHeaders();
      expect(typeof middleware).toBe('function');
    });

    it('should apply security headers to response', () => {
      const middleware = withSecurityHeaders();
      const request = createMockRequest();

      const response = middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response?.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should add correlation ID', () => {
      const middleware = withSecurityHeaders();
      const request = createMockRequest();

      const response = middleware(request);

      expect(response?.headers.get('x-correlation-id')).toBe(mockUUID);
    });

    it('should use existing correlation ID if present', () => {
      const middleware = withSecurityHeaders();
      const request = createMockRequest('https://example.com/', {
        'x-correlation-id': 'existing-correlation-id',
      });

      const response = middleware(request);

      expect(response?.headers.get('x-correlation-id')).toBe(
        'existing-correlation-id'
      );
    });

    it('should use x-request-id as correlation ID if x-correlation-id is missing', () => {
      const middleware = withSecurityHeaders();
      const request = createMockRequest('https://example.com/', {
        'x-request-id': 'request-id-12345',
      });

      const response = middleware(request);

      expect(response?.headers.get('x-correlation-id')).toBe('request-id-12345');
    });

    it('should add response time header', () => {
      const middleware = withSecurityHeaders();
      const request = createMockRequest();

      const response = middleware(request);

      expect(response?.headers.get('x-response-time')).toBeDefined();
    });

    it('should add security headers applied marker', () => {
      const middleware = withSecurityHeaders();
      const request = createMockRequest();

      const response = middleware(request);

      expect(response?.headers.get('x-security-headers')).toBe('applied');
      expect(response?.headers.get('x-content-type-validated')).toBe('true');
    });

    it('should apply custom configuration', () => {
      const middleware = withSecurityHeaders({
        customHeaders: {
          'X-Custom': 'value',
        },
      });
      const request = createMockRequest();

      const response = middleware(request);

      expect(response?.headers.get('X-Custom')).toBe('value');
    });
  });

  describe('addSecurityHeaders', () => {
    it('should add security headers to existing response', () => {
      const request = createMockRequest();
      const response = NextResponse.json({ data: 'test' });

      const modifiedResponse = addSecurityHeaders(response, request);

      expect(modifiedResponse.headers.get('X-Content-Type-Options')).toBe(
        'nosniff'
      );
      expect(modifiedResponse.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should add correlation ID if not present', () => {
      const request = createMockRequest();
      const response = NextResponse.json({ data: 'test' });

      const modifiedResponse = addSecurityHeaders(response, request);

      expect(modifiedResponse.headers.get('x-correlation-id')).toBe(mockUUID);
    });

    it('should not override existing correlation ID', () => {
      const request = createMockRequest();
      const response = NextResponse.json({ data: 'test' });
      response.headers.set('x-correlation-id', 'existing-id');

      const modifiedResponse = addSecurityHeaders(response, request);

      expect(modifiedResponse.headers.get('x-correlation-id')).toBe(
        'existing-id'
      );
    });

    it('should add timestamp header', () => {
      const request = createMockRequest();
      const response = NextResponse.json({ data: 'test' });

      const modifiedResponse = addSecurityHeaders(response, request);

      expect(
        modifiedResponse.headers.get('x-security-headers-applied')
      ).toBeDefined();
    });

    it('should apply custom configuration', () => {
      const request = createMockRequest();
      const response = NextResponse.json({ data: 'test' });

      const modifiedResponse = addSecurityHeaders(response, request, {
        customHeaders: {
          'X-API-Version': '2.0',
        },
      });

      expect(modifiedResponse.headers.get('X-API-Version')).toBe('2.0');
    });
  });

  describe('SecurityValidation.validateSecurityHeaders', () => {
    it('should validate response with all required headers', () => {
      const response = NextResponse.json({ data: 'test' });
      response.headers.set('x-content-type-options', 'nosniff');
      response.headers.set('x-frame-options', 'DENY');
      response.headers.set('x-xss-protection', '1; mode=block');
      response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
      response.headers.set('content-security-policy', "default-src 'self'");

      const result = SecurityValidation.validateSecurityHeaders(response);

      expect(result.isValid).toBe(true);
      expect(result.missingHeaders).toHaveLength(0);
      expect(result.weakHeaders).toHaveLength(0);
    });

    it('should detect missing headers', () => {
      const response = NextResponse.json({ data: 'test' });

      const result = SecurityValidation.validateSecurityHeaders(response);

      expect(result.isValid).toBe(false);
      expect(result.missingHeaders).toContain('x-content-type-options');
      expect(result.missingHeaders).toContain('x-frame-options');
      expect(result.missingHeaders).toContain('x-xss-protection');
      expect(result.missingHeaders).toContain('referrer-policy');
      expect(result.missingHeaders).toContain('content-security-policy');
    });

    it('should detect weak x-frame-options', () => {
      const response = NextResponse.json({ data: 'test' });
      response.headers.set('x-content-type-options', 'nosniff');
      response.headers.set('x-frame-options', 'ALLOW-FROM https://example.com');
      response.headers.set('x-xss-protection', '1; mode=block');
      response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
      response.headers.set('content-security-policy', "default-src 'self'");

      const result = SecurityValidation.validateSecurityHeaders(response);

      expect(result.isValid).toBe(false);
      expect(result.weakHeaders).toContain('x-frame-options');
    });

    it('should detect weak x-content-type-options', () => {
      const response = NextResponse.json({ data: 'test' });
      response.headers.set('x-content-type-options', 'sniff');
      response.headers.set('x-frame-options', 'DENY');
      response.headers.set('x-xss-protection', '1; mode=block');
      response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
      response.headers.set('content-security-policy', "default-src 'self'");

      const result = SecurityValidation.validateSecurityHeaders(response);

      expect(result.isValid).toBe(false);
      expect(result.weakHeaders).toContain('x-content-type-options');
    });

    it('should detect weak x-xss-protection', () => {
      const response = NextResponse.json({ data: 'test' });
      response.headers.set('x-content-type-options', 'nosniff');
      response.headers.set('x-frame-options', 'DENY');
      response.headers.set('x-xss-protection', '0');
      response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
      response.headers.set('content-security-policy', "default-src 'self'");

      const result = SecurityValidation.validateSecurityHeaders(response);

      expect(result.isValid).toBe(false);
      expect(result.weakHeaders).toContain('x-xss-protection');
    });

    it('should accept SAMEORIGIN for x-frame-options', () => {
      const response = NextResponse.json({ data: 'test' });
      response.headers.set('x-content-type-options', 'nosniff');
      response.headers.set('x-frame-options', 'SAMEORIGIN');
      response.headers.set('x-xss-protection', '1; mode=block');
      response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
      response.headers.set('content-security-policy', "default-src 'self'");

      const result = SecurityValidation.validateSecurityHeaders(response);

      expect(result.isValid).toBe(true);
      expect(result.weakHeaders).not.toContain('x-frame-options');
    });
  });

  describe('SecurityValidation.checkSecurityMisconfigurations', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should detect missing HSTS in production', () => {
      process.env.NODE_ENV = 'production';
      const request = createMockRequest('https://example.com/', {
        'x-forwarded-proto': 'https',
      });
      const response = NextResponse.json({ data: 'test' });

      const issues =
        SecurityValidation.checkSecurityMisconfigurations(request, response);

      expect(issues).toContain('HSTS header missing in production');
    });

    it('should detect weak CSP with unsafe-inline', () => {
      const request = createMockRequest();
      const response = NextResponse.json({ data: 'test' });
      response.headers.set(
        'content-security-policy',
        "default-src 'self'; script-src 'unsafe-inline'"
      );

      const issues =
        SecurityValidation.checkSecurityMisconfigurations(request, response);

      expect(issues).toContain(
        'Content Security Policy allows unsafe inline/eval'
      );
    });

    it('should detect weak CSP with unsafe-eval', () => {
      const request = createMockRequest();
      const response = NextResponse.json({ data: 'test' });
      response.headers.set(
        'content-security-policy',
        "default-src 'self'; script-src 'unsafe-eval'"
      );

      const issues =
        SecurityValidation.checkSecurityMisconfigurations(request, response);

      expect(issues).toContain(
        'Content Security Policy allows unsafe inline/eval'
      );
    });

    it('should detect missing cache control on admin pages', () => {
      const request = createMockRequest('https://example.com/admin/users');
      const response = NextResponse.json({ data: 'test' });

      const issues =
        SecurityValidation.checkSecurityMisconfigurations(request, response);

      expect(issues).toContain('Sensitive endpoints should not be cached');
    });

    it('should detect missing cache control on auth API', () => {
      const request = createMockRequest('https://example.com/api/auth/login');
      const response = NextResponse.json({ data: 'test' });

      const issues =
        SecurityValidation.checkSecurityMisconfigurations(request, response);

      expect(issues).toContain('Sensitive endpoints should not be cached');
    });

    it('should not flag cache control for properly cached sensitive endpoints', () => {
      const request = createMockRequest('https://example.com/admin/users');
      const response = NextResponse.json({ data: 'test' });
      response.headers.set('cache-control', 'no-cache, no-store');

      const issues =
        SecurityValidation.checkSecurityMisconfigurations(request, response);

      expect(issues).not.toContain('Sensitive endpoints should not be cached');
    });

    it('should return empty array for properly secured response', () => {
      process.env.NODE_ENV = 'development';
      const request = createMockRequest('https://example.com/public');
      const response = NextResponse.json({ data: 'test' });
      response.headers.set(
        'content-security-policy',
        "default-src 'self'; script-src 'self'"
      );

      const issues =
        SecurityValidation.checkSecurityMisconfigurations(request, response);

      expect(issues).toHaveLength(0);
    });
  });

  describe('SecurityHeaderConfigs', () => {
    it('should have web configuration', () => {
      expect(SecurityHeaderConfigs.web).toBeDefined();
      expect(SecurityHeaderConfigs.web.includeAll).toBe(true);
      expect(SecurityHeaderConfigs.web.customHeaders?.['X-Powered-By']).toBe(
        'Ready-Set'
      );
    });

    it('should have api configuration', () => {
      expect(SecurityHeaderConfigs.api).toBeDefined();
      expect(SecurityHeaderConfigs.api.includeAll).toBe(true);
      expect(SecurityHeaderConfigs.api.environmentOverrides?.development).toBeDefined();
    });

    it('should have upload configuration', () => {
      expect(SecurityHeaderConfigs.upload).toBeDefined();
      expect(SecurityHeaderConfigs.upload.includeAll).toBe(true);
    });

    it('should have admin configuration', () => {
      expect(SecurityHeaderConfigs.admin).toBeDefined();
      expect(SecurityHeaderConfigs.admin.pathOverrides?.['/admin']).toBeDefined();
    });

    it('should have auth configuration', () => {
      expect(SecurityHeaderConfigs.auth).toBeDefined();
      expect(SecurityHeaderConfigs.auth.includeAll).toBe(true);
    });
  });
});
