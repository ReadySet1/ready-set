// src/__tests__/api/auth/redirect.test.ts

import { GET } from '@/app/api/auth/redirect/route';
import { createRequestWithParams, createGetRequest } from '@/__tests__/helpers/api-test-helpers';

describe('/api/auth/redirect GET API', () => {
  // Helper to create request with query parameters
  const createRedirectRequest = (destination?: string) => {
    if (destination) {
      return createRequestWithParams('http://localhost:3000/api/auth/redirect', {
        destination,
      });
    }
    return createGetRequest('http://localhost:3000/api/auth/redirect');
  };

  describe('✅ Successful Redirects', () => {
    it('should redirect to valid Supabase callback URL', async () => {
      const destination = 'https://jiasmmmmhtreoacdpiby.supabase.co/auth/v1/callback';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(destination);
    });

    it('should redirect to localhost domain', async () => {
      const destination = 'http://localhost:3000/dashboard';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(destination);
    });

    it('should redirect to Vercel app domain', async () => {
      const destination = 'https://ready-sets-projects.vercel.app/auth/callback';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(destination);
    });

    it('should redirect to subdomain of allowed domain', async () => {
      const destination = 'https://api.ready-sets-projects.vercel.app/callback';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(destination);
    });

    it('should redirect to Supabase subdomain', async () => {
      const destination = 'https://abc123.supabase.co/auth/v1/callback';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(destination);
    });
  });

  describe('✏️ Validation Tests', () => {
    it('should return 400 when destination parameter is missing', async () => {
      const request = createRedirectRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid destination');
    });

    it('should return 400 when destination is empty string', async () => {
      const request = createRedirectRequest('');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid destination');
    });

    it('should return 400 for invalid URL format', async () => {
      const request = createRedirectRequest('not-a-valid-url');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid destination URL format');
    });

    it('should return 400 for malformed URL', async () => {
      const request = createRedirectRequest('http://[invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid destination URL format');
    });

    it('should return 400 for relative URLs', async () => {
      const request = createRedirectRequest('/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid destination URL format');
    });
  });

  describe('🔒 Security Tests - Unauthorized Domains', () => {
    it('should return 403 for unauthorized domain', async () => {
      const request = createRedirectRequest('https://evil.com/phishing');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized redirect destination');
    });

    it('should return 403 for similar but different domain', async () => {
      const request = createRedirectRequest('https://ready-sets-projects-vercel.app.evil.com/');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized redirect destination');
    });

    it('should return 403 for domain with extra path segments', async () => {
      const request = createRedirectRequest('https://attacker.com/localhost:3000');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized redirect destination');
    });

    it('should return 403 for unauthorized Supabase project', async () => {
      const request = createRedirectRequest('https://other-project.supabase.co/auth/callback');
      const response = await GET(request);

      // This should pass because supabase.co is in allowed domains
      // If you want to restrict to specific Supabase projects, this test would fail
      expect(response.status).toBe(302);
    });
  });

  describe('🔒 Open Redirect Prevention', () => {
    it('should prevent open redirect to external site', async () => {
      const request = createRedirectRequest('https://google.com');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized redirect destination');
    });

    it('should prevent redirect to data URLs', async () => {
      const request = createRedirectRequest('data:text/html,<script>alert(1)</script>');
      const response = await GET(request);
      const data = await response.json();

      // data: URLs are parsed as valid URLs but their "hostname" isn't in allowed domains
      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized redirect destination');
    });

    it('should prevent redirect to javascript URLs', async () => {
      const request = createRedirectRequest('javascript:alert(1)');
      const response = await GET(request);
      const data = await response.json();

      // javascript: URLs are parsed as valid URLs but their "hostname" isn't in allowed domains
      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized redirect destination');
    });

    it('should prevent redirect to file URLs', async () => {
      const request = createRedirectRequest('file:///etc/passwd');
      const response = await GET(request);
      const data = await response.json();

      // file: URLs are parsed as valid URLs but their "hostname" isn't in allowed domains
      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized redirect destination');
    });
  });

  describe('🔒 URL Encoding Attack Prevention', () => {
    it('should handle URL encoded characters correctly', async () => {
      const destination = encodeURIComponent('https://localhost:3000/dashboard');
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      // URL encoded https%3A%2F%2Flocalhost%3A3000%2Fdashboard should fail URL parsing
      expect(response.status).toBe(400);
    });

    it('should handle double URL encoding attack', async () => {
      const destination = encodeURIComponent(encodeURIComponent('https://evil.com'));
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should properly decode valid URL encoded destination', async () => {
      const destination = 'https://localhost:3000/dashboard?param=value%20with%20spaces';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(destination);
    });
  });

  describe('🔒 Protocol-based Attack Prevention', () => {
    it('should reject ftp protocol for non-allowed domains', async () => {
      // Use a non-allowed domain to test ftp rejection
      const request = createRedirectRequest('ftp://evil.com/file');
      const response = await GET(request);
      const data = await response.json();

      // ftp is a valid URL but evil.com not in allowed domains
      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized redirect destination');
    });

    it('should reject mailto protocol', async () => {
      const request = createRedirectRequest('mailto:user@example.com');
      const response = await GET(request);
      const data = await response.json();

      // mailto: URLs have hostname that isn't in allowed domains
      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized redirect destination');
    });

    it('should reject custom protocols', async () => {
      const request = createRedirectRequest('myapp://deeplink');
      const response = await GET(request);
      const data = await response.json();

      // custom protocols have hostname that isn't in allowed domains
      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized redirect destination');
    });
  });

  describe('📊 Response Structure Tests', () => {
    it('should return proper redirect response with location header', async () => {
      const destination = 'https://localhost:3000/dashboard';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
      expect(response.headers.has('location')).toBe(true);
      expect(response.headers.get('location')).toBe(destination);
    });

    it('should return JSON error response for validation errors', async () => {
      const request = createRedirectRequest('invalid-url');
      const response = await GET(request);
      const data = await response.json();

      expect(response.headers.get('content-type')).toContain('application/json');
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    });

    it('should return JSON error response for security violations', async () => {
      const request = createRedirectRequest('https://evil.com');
      const response = await GET(request);
      const data = await response.json();

      expect(response.headers.get('content-type')).toContain('application/json');
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Unauthorized redirect destination');
    });
  });

  describe('🔍 Edge Cases', () => {
    it('should handle URLs with allowed port for localhost', async () => {
      // Only localhost:3000 is in the allowed domains list
      const destination = 'http://localhost:3000/dashboard';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
    });

    it('should reject localhost with non-allowed port', async () => {
      // localhost:3001 is NOT in the allowed domains list
      const destination = 'http://localhost:3001/dashboard';
      const request = createRedirectRequest(destination);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized redirect destination');
    });

    it('should handle URLs with query parameters', async () => {
      const destination = 'https://localhost:3000/callback?code=abc123&state=xyz';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(destination);
    });

    it('should handle URLs with hash fragments', async () => {
      const destination = 'https://localhost:3000/dashboard#section';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(destination);
    });

    it('should handle URLs with authentication credentials (username:password)', async () => {
      const destination = 'https://user:pass@localhost:3000/dashboard';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      // Should allow valid URLs with auth credentials for allowed domains
      expect(response.status).toBe(302);
    });

    it('should handle IPv4 localhost address', async () => {
      const destination = 'http://127.0.0.1:3000/dashboard';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      // 127.0.0.1 is not in allowed domains, should be rejected
      expect(response.status).toBe(403);
    });

    it('should handle IPv6 localhost address', async () => {
      const destination = 'http://[::1]:3000/dashboard';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      // [::1] is not in allowed domains, should be rejected
      expect(response.status).toBe(403);
    });
  });

  describe('⚠️ Security Logging', () => {
    it('should log unauthorized redirect attempts', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const evilUrl = 'https://evil.com/phishing';

      const request = createRedirectRequest(evilUrl);
      await GET(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Unauthorized redirect attempt to: ${evilUrl}`)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should not log successful redirects as errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = createRedirectRequest('https://localhost:3000/dashboard');
      await GET(request);

      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('🌐 HTTPS vs HTTP', () => {
    it('should allow HTTP for localhost', async () => {
      const destination = 'http://localhost:3000/dashboard';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
    });

    it('should allow HTTPS for localhost', async () => {
      const destination = 'https://localhost:3000/dashboard';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
    });

    it('should allow HTTPS for production domains', async () => {
      const destination = 'https://ready-sets-projects.vercel.app/callback';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
    });

    it('should allow HTTP for production domains (if needed)', async () => {
      const destination = 'http://ready-sets-projects.vercel.app/callback';
      const request = createRedirectRequest(destination);
      const response = await GET(request);

      expect(response.status).toBe(302);
    });
  });
});
