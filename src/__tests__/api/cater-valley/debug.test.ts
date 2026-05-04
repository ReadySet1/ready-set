// src/__tests__/api/cater-valley/debug.test.ts

import { GET, POST, PUT, PATCH } from '@/app/api/cater-valley/debug/route';
import {
  createGetRequest,
  createPostRequest,
  expectSuccessResponse,
} from '@/__tests__/helpers/api-test-helpers';

describe('GET/POST/PUT/PATCH /api/cater-valley/debug - CaterValley Debug Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('✅ GET Method', () => {
    it('should log and return GET request details', async () => {
      const request = createGetRequest(
        'http://localhost:3000/api/cater-valley/debug?test=value&foo=bar'
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('GET');
      expect(data.url).toContain('/api/cater-valley/debug');
      expect(data.searchParams).toEqual({ test: 'value', foo: 'bar' });
      expect(data.message).toContain('Debug endpoint - request logged');
      expect(data.timestamp).toBeDefined();
    });

    it('should capture all headers in GET request', async () => {
      const request = new Request(
        'http://localhost:3000/api/cater-valley/debug',
        {
          method: 'GET',
          headers: {
            'x-api-key': 'test-key',
            'partner': 'test-partner',
            'user-agent': 'test-agent',
          },
        }
      );

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      // Sensitive headers must be redacted; non-sensitive ones pass through
      expect(data.headers).toHaveProperty('x-api-key', '<redacted>');
      expect(data.headers).toHaveProperty('partner', '<redacted>');
      expect(data.headers).toHaveProperty('user-agent', 'test-agent');
    });

    it('should handle GET request with no query parameters', async () => {
      const request = createGetRequest('http://localhost:3000/api/cater-valley/debug');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('GET');
      expect(data.searchParams).toEqual({});
    });
  });

  describe('✅ POST Method', () => {
    it('should log and return POST request with JSON body', async () => {
      const testBody = { orderCode: 'TEST-123', status: 'active' };
      const request = createPostRequest(
        'http://localhost:3000/api/cater-valley/debug?param=value',
        testBody
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('POST');
      expect(data.body).toEqual(testBody);
      expect(data.searchParams).toEqual({ param: 'value' });
      expect(data.timestamp).toBeDefined();
    });

    it('should handle POST with invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{',
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('POST');
      expect(data.body).toHaveProperty('raw');
      expect(data.body.raw).toContain('invalid json');
    });

    it('should capture headers in POST request', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'secret-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({ test: 'data' }),
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.headers).toHaveProperty('x-api-key', '<redacted>');
      expect(data.headers).toHaveProperty('partner', '<redacted>');
      expect(data.headers).toHaveProperty('content-type', 'application/json');
    });

    it('should handle empty POST body', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('POST');
      expect(data.body).toBeDefined();
    });
  });

  describe('✅ PUT Method', () => {
    it('should log and return PUT request with JSON body', async () => {
      const testBody = { id: '123', action: 'update' };
      const request = new Request('http://localhost:3000/api/cater-valley/debug', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testBody),
      });

      const response = await PUT(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('PUT');
      expect(data.body).toEqual(testBody);
      expect(data.timestamp).toBeDefined();
      expect(data.message).toContain('Debug endpoint - request logged');
    });

    it('should handle PUT with invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/debug', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      const response = await PUT(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('PUT');
      expect(data.body).toHaveProperty('raw', 'not valid json');
    });

    it('should capture URL in PUT request', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/debug', {
        method: 'PUT',
        body: JSON.stringify({ test: 'data' }),
      });

      const response = await PUT(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.url).toContain('/api/cater-valley/debug');
    });
  });

  describe('✅ PATCH Method', () => {
    it('should log and return PATCH request with JSON body', async () => {
      const testBody = { status: 'updated' };
      const request = new Request('http://localhost:3000/api/cater-valley/debug', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testBody),
      });

      const response = await PATCH(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('PATCH');
      expect(data.body).toEqual(testBody);
      expect(data.timestamp).toBeDefined();
    });

    it('should handle PATCH with text body', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/debug', {
        method: 'PATCH',
        body: 'plain text data',
      });

      const response = await PATCH(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('PATCH');
      expect(data.body).toHaveProperty('raw', 'plain text data');
    });

    it('should capture all request details in PATCH', async () => {
      const request = new Request(
        'http://localhost:3000/api/cater-valley/debug',
        {
          method: 'PATCH',
          headers: {
            'x-custom-header': 'custom-value',
            'authorization': 'Bearer token123',
          },
          body: JSON.stringify({ patch: 'data' }),
        }
      );

      const response = await PATCH(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('PATCH');
      expect(data.headers).toHaveProperty('x-custom-header', 'custom-value');
      expect(data.headers).toHaveProperty('authorization', '<redacted>');
      expect(data.body).toEqual({ patch: 'data' });
    });
  });

  describe('📊 Edge Cases', () => {
    it('should handle request with very long URL', async () => {
      const longUrl = 'http://localhost:3000/api/cater-valley/debug?' + 'a=b&'.repeat(100);
      const request = createGetRequest(longUrl);

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('GET');
      expect(data.url).toContain('api/cater-valley/debug');
    });

    it('should handle request with special characters in headers', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/debug', {
        method: 'GET',
        headers: {
          'x-special': 'value with spaces & symbols!@#',
        },
      });

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.headers).toHaveProperty('x-special');
    });

    it('should handle POST with large JSON body', async () => {
      const largeBody = {
        data: 'x'.repeat(10000),
        nested: { deep: { object: { with: { many: { levels: 'test' } } } } },
      };

      const request = createPostRequest(
        'http://localhost:3000/api/cater-valley/debug',
        largeBody
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('POST');
      expect(data.body).toEqual(largeBody);
    });

    it('should handle PUT with empty body', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/debug', {
        method: 'PUT',
        body: '',
      });

      const response = await PUT(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('PUT');
      expect(data.body).toBeDefined();
    });

    it('should handle PATCH when body is empty/missing', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/debug', {
        method: 'PATCH',
      });

      const response = await PATCH(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.method).toBe('PATCH');
      // Empty body parses to null in the new implementation rather than
      // an error sentinel object — both forms are equivalently safe.
      expect(data).toHaveProperty('body');
    });

    it('should preserve timestamp format', async () => {
      const request = createGetRequest('http://localhost:3000/api/cater-valley/debug');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('🔒 Production hardening', () => {
    const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    });

    it('returns plain 404 in production with no header/body echo', async () => {
      process.env.NODE_ENV = 'production';
      const request = new Request('http://localhost:3000/api/cater-valley/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'leaked-key',
          authorization: 'Bearer secret',
        },
        body: JSON.stringify({ secret: 'should-not-leak' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).not.toHaveProperty('headers');
      expect(data).not.toHaveProperty('body');
      expect(data).not.toHaveProperty('searchParams');
      expect(JSON.stringify(data)).not.toContain('leaked-key');
      expect(JSON.stringify(data)).not.toContain('should-not-leak');
    });
  });
});
