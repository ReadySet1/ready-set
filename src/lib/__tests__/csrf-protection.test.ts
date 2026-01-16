import { NextRequest, NextResponse } from 'next/server';
import {
  generateCSRFToken,
  validateCSRFToken,
  getCSRFTokenFromRequest,
  withCSRFProtection,
  setCSRFTokenInResponse,
  CSRFManager,
  csrfManager,
  validateCSRFTokenFromRequest,
  CSRFConfigs,
  createCSRFProtectedHandler,
} from '../csrf-protection';

// Mock Supabase
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
  }),
}));

// Helper to create a mock NextRequest with proper nextUrl
function createMockRequest(
  url: string = 'https://example.com/',
  options: { method?: string; headers?: Record<string, string> } = {}
): NextRequest {
  const { method = 'GET', headers = {} } = options;
  const headerObj = new Headers();
  Object.entries(headers).forEach(([key, value]) => {
    headerObj.set(key, value);
  });
  const request = new NextRequest(new URL(url), {
    method,
    headers: headerObj,
  });

  // Ensure nextUrl is properly set
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

describe('csrf-protection', () => {
  describe('generateCSRFToken', () => {
    it('should generate a token', () => {
      const token = generateCSRFToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      expect(token1).not.toBe(token2);
    });

    it('should accept userId parameter', () => {
      const token = generateCSRFToken('user-123');
      expect(token).toBeDefined();
    });
  });

  describe('validateCSRFToken', () => {
    it('should validate a valid token', () => {
      const token = generateCSRFToken();
      expect(validateCSRFToken(token)).toBe(true);
    });

    it('should reject invalid token', () => {
      expect(validateCSRFToken('invalid-token')).toBe(false);
    });

    it('should validate token for specific user', () => {
      const token = generateCSRFToken('user-123');
      expect(validateCSRFToken(token, 'user-123')).toBe(true);
    });

    it('should reject token for different user', () => {
      const token = generateCSRFToken('user-123');
      expect(validateCSRFToken(token, 'user-456')).toBe(false);
    });
  });

  describe('getCSRFTokenFromRequest', () => {
    it('should get token from x-csrf-token header', () => {
      const request = createMockRequest('https://example.com/', {
        headers: { 'x-csrf-token': 'header-token' },
      });
      expect(getCSRFTokenFromRequest(request)).toBe('header-token');
    });

    it('should get token from _csrf query parameter', () => {
      const request = createMockRequest('https://example.com/?_csrf=query-token');
      expect(getCSRFTokenFromRequest(request)).toBe('query-token');
    });

    it('should prefer header over query parameter', () => {
      const request = createMockRequest('https://example.com/?_csrf=query-token', {
        headers: { 'x-csrf-token': 'header-token' },
      });
      expect(getCSRFTokenFromRequest(request)).toBe('header-token');
    });

    it('should return null if no token present', () => {
      const request = createMockRequest('https://example.com/');
      expect(getCSRFTokenFromRequest(request)).toBeNull();
    });
  });

  describe('withCSRFProtection', () => {
    it('should skip validation for GET requests', async () => {
      const middleware = withCSRFProtection();
      const request = createMockRequest('https://example.com/', {
        method: 'GET',
      });

      const result = await middleware(request);
      expect(result).toBeNull();
    });

    it('should skip validation for OPTIONS requests', async () => {
      const middleware = withCSRFProtection();
      const request = createMockRequest('https://example.com/', {
        method: 'OPTIONS',
      });

      // OPTIONS is not in the default methods list, so it should be skipped
      const result = await middleware(request);
      expect(result).toBeNull();
    });

    it('should skip validation for exempt paths', async () => {
      const middleware = withCSRFProtection({
        exemptPaths: ['/api/public'],
      });
      const request = createMockRequest('https://example.com/api/public/resource', {
        method: 'POST',
      });

      const result = await middleware(request);
      expect(result).toBeNull();
    });

    it('should skip validation for Bearer token auth when allowApiKey is true', async () => {
      const middleware = withCSRFProtection({ allowApiKey: true });
      const request = createMockRequest('https://example.com/api/resource', {
        method: 'POST',
        headers: { authorization: 'Bearer some-jwt-token' },
      });

      const result = await middleware(request);
      expect(result).toBeNull();
    });

    it('should skip validation for ApiKey auth when allowApiKey is true', async () => {
      const middleware = withCSRFProtection({ allowApiKey: true });
      const request = createMockRequest('https://example.com/api/resource', {
        method: 'POST',
        headers: { 'x-api-key': 'ApiKey some-api-key' },
      });

      const result = await middleware(request);
      expect(result).toBeNull();
    });

    it('should return 403 for POST without CSRF token when required', async () => {
      const middleware = withCSRFProtection({
        required: true,
        allowApiKey: false,
      });
      const request = createMockRequest('https://example.com/api/resource', {
        method: 'POST',
      });

      const result = await middleware(request);
      expect(result).toBeInstanceOf(NextResponse);
      expect(result?.status).toBe(403);
    });

    it('should return 403 for invalid CSRF token', async () => {
      const middleware = withCSRFProtection({
        required: true,
        allowApiKey: false,
      });
      const request = createMockRequest('https://example.com/api/resource', {
        method: 'POST',
        headers: { 'x-csrf-token': 'invalid-token' },
      });

      const result = await middleware(request);
      expect(result).toBeInstanceOf(NextResponse);
      expect(result?.status).toBe(403);
    });

    it('should allow POST with valid CSRF token', async () => {
      const token = generateCSRFToken();
      const middleware = withCSRFProtection({
        required: true,
        allowApiKey: false,
      });
      const request = createMockRequest('https://example.com/api/resource', {
        method: 'POST',
        headers: { 'x-csrf-token': token },
      });

      const result = await middleware(request);
      expect(result).toBeNull();
    });
  });

  describe('setCSRFTokenInResponse', () => {
    it('should set CSRF token in response header', () => {
      // Create a response with cookies mock
      const mockCookies = {
        set: jest.fn(),
      };
      const response = new NextResponse(null, { status: 200 });
      Object.defineProperty(response, 'cookies', { value: mockCookies });

      const token = 'test-token';
      const modifiedResponse = setCSRFTokenInResponse(response, token);

      expect(modifiedResponse.headers.get('x-csrf-token')).toBe(token);
      expect(mockCookies.set).toHaveBeenCalled();
    });

    it('should generate token if not provided', () => {
      // Create a response with cookies mock
      const mockCookies = {
        set: jest.fn(),
      };
      const response = new NextResponse(null, { status: 200 });
      Object.defineProperty(response, 'cookies', { value: mockCookies });

      const modifiedResponse = setCSRFTokenInResponse(response);

      expect(modifiedResponse.headers.get('x-csrf-token')).toBeDefined();
      expect(modifiedResponse.headers.get('x-csrf-token')?.length).toBe(64);
    });
  });

  describe('CSRFManager', () => {
    describe('getInstance', () => {
      it('should return singleton instance', () => {
        const instance1 = CSRFManager.getInstance();
        const instance2 = CSRFManager.getInstance();
        expect(instance1).toBe(instance2);
      });
    });

    describe('generateToken', () => {
      it('should generate a token', () => {
        const token = csrfManager.generateToken();
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBe(64);
      });

      it('should generate unique tokens', () => {
        const token1 = csrfManager.generateToken();
        const token2 = csrfManager.generateToken();
        expect(token1).not.toBe(token2);
      });
    });

    describe('validateToken', () => {
      it('should validate a valid token', () => {
        const token = csrfManager.generateToken();
        expect(csrfManager.validateToken(token)).toBe(true);
      });

      it('should reject invalid token', () => {
        expect(csrfManager.validateToken('invalid-token')).toBe(false);
      });

      it('should validate token for specific user', () => {
        const token = csrfManager.generateToken('user-123');
        expect(csrfManager.validateToken(token, 'user-123')).toBe(true);
      });

      it('should reject token for different user', () => {
        const token = csrfManager.generateToken('user-123');
        expect(csrfManager.validateToken(token, 'user-456')).toBe(false);
      });
    });

    describe('refreshToken', () => {
      it('should refresh valid token', () => {
        const oldToken = csrfManager.generateToken();
        const newToken = csrfManager.refreshToken(oldToken);

        expect(newToken).toBeDefined();
        expect(newToken).not.toBe(oldToken);
        expect(csrfManager.validateToken(oldToken)).toBe(false);
        expect(csrfManager.validateToken(newToken!)).toBe(true);
      });

      it('should return null for invalid token', () => {
        const newToken = csrfManager.refreshToken('invalid-token');
        expect(newToken).toBeNull();
      });

      it('should preserve userId on refresh', () => {
        const oldToken = csrfManager.generateToken('user-123');
        const newToken = csrfManager.refreshToken(oldToken, 'user-123');

        expect(newToken).toBeDefined();
        expect(csrfManager.validateToken(newToken!, 'user-123')).toBe(true);
      });
    });
  });

  describe('validateCSRFTokenFromRequest', () => {
    it('should validate token from request', () => {
      const token = csrfManager.generateToken();
      const request = createMockRequest('https://example.com/', {
        headers: { 'x-csrf-token': token },
      });

      expect(validateCSRFTokenFromRequest(request)).toBe(true);
    });

    it('should return false for missing token', () => {
      const request = createMockRequest('https://example.com/');
      expect(validateCSRFTokenFromRequest(request)).toBe(false);
    });

    it('should return false for invalid token', () => {
      const request = createMockRequest('https://example.com/', {
        headers: { 'x-csrf-token': 'invalid-token' },
      });
      expect(validateCSRFTokenFromRequest(request)).toBe(false);
    });
  });

  describe('CSRFConfigs', () => {
    it('should have strict configuration', () => {
      expect(CSRFConfigs.strict.required).toBe(true);
      expect(CSRFConfigs.strict.methods).toContain('POST');
      expect(CSRFConfigs.strict.methods).toContain('DELETE');
    });

    it('should have api configuration with allowApiKey', () => {
      expect(CSRFConfigs.api.allowApiKey).toBe(true);
    });

    it('should have forms configuration', () => {
      expect(CSRFConfigs.forms.methods).toContain('POST');
      expect(CSRFConfigs.forms.exemptPaths).toContain('/api/auth');
    });

    it('should have development configuration', () => {
      expect(CSRFConfigs.development.required).toBe(false);
    });
  });

  describe('createCSRFProtectedHandler', () => {
    it('should wrap handler with CSRF protection', async () => {
      const handler = jest.fn().mockResolvedValue(
        new NextResponse(JSON.stringify({ data: 'success' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const token = generateCSRFToken();
      const protectedHandler = createCSRFProtectedHandler(handler, {
        required: true,
        allowApiKey: false,
      });

      const request = createMockRequest('https://example.com/api/resource', {
        method: 'POST',
        headers: { 'x-csrf-token': token },
      });

      const result = await protectedHandler(request);
      expect(handler).toHaveBeenCalledWith(request);
      expect(result.status).toBe(200);
    });

    it('should return 403 for invalid token', async () => {
      const handler = jest.fn().mockResolvedValue(
        new NextResponse(JSON.stringify({ data: 'success' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const protectedHandler = createCSRFProtectedHandler(handler, {
        required: true,
        allowApiKey: false,
      });

      const request = createMockRequest('https://example.com/api/resource', {
        method: 'POST',
        headers: { 'x-csrf-token': 'invalid-token' },
      });

      const result = await protectedHandler(request);
      expect(handler).not.toHaveBeenCalled();
      expect(result.status).toBe(403);
    });
  });
});
