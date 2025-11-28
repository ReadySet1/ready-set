// src/__tests__/api/cater-valley/catch-all.test.ts

import { GET, POST, PUT, PATCH, DELETE } from '@/app/api/cater-valley/[...slug]/route';
import { expectErrorResponse } from '@/__tests__/helpers/api-test-helpers';
import { NextRequest } from 'next/server';

/**
 * Helper to create a NextRequest with nextUrl property
 */
function createNextRequest(url: string, init?: RequestInit): NextRequest {
  const request = new NextRequest(url, init);
  return request;
}

describe('GET/POST/PUT/PATCH/DELETE /api/cater-valley/[...slug] - CaterValley Catch-All', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('✅ GET Method', () => {
    it('should return 404 for unknown GET endpoint', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/unknown/path');
      const context = { params: Promise.resolve({ slug: ['unknown', 'path'] }) };

      const response = await GET(request, context);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.method).toBe('GET');
      expect(data.slug).toEqual(['unknown', 'path']);
      expect(data.message).toContain('does not exist');
      expect(data.availableEndpoints).toHaveLength(3);
    });

    it('should include request details in GET response', async () => {
      const request = createNextRequest(
        'http://localhost:3000/api/cater-valley/test?param=value',
        {
          headers: { 'x-custom': 'header' },
        }
      );
      const context = { params: Promise.resolve({ slug: ['test'] }) };

      const response = await GET(request, context);
      const data = await response.json();

      expect(data.method).toBe('GET');
      expect(data.url).toContain('/api/cater-valley/test');
      expect(data.searchParams).toEqual({ param: 'value' });
      expect(data.headers).toHaveProperty('x-custom', 'header');
      expect(data.timestamp).toBeDefined();
    });

    it('should list available endpoints in GET response', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/invalid');
      const context = { params: Promise.resolve({ slug: ['invalid'] }) };

      const response = await GET(request, context);
      const data = await response.json();

      expect(data.availableEndpoints).toContain('POST /api/cater-valley/orders/draft');
      expect(data.availableEndpoints).toContain('POST /api/cater-valley/orders/update');
      expect(data.availableEndpoints).toContain('POST /api/cater-valley/orders/confirm');
    });

    it('should handle deeply nested slug paths', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/very/deep/nested/path');
      const context = { params: Promise.resolve({ slug: ['very', 'deep', 'nested', 'path'] }) };

      const response = await GET(request, context);
      const data = await response.json();

      expect(data.slug).toEqual(['very', 'deep', 'nested', 'path']);
      expect(response.status).toBe(404);
    });
  });

  describe('✅ POST Method', () => {
    it('should return 404 for unknown POST endpoint', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/unknown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      });
      const context = { params: Promise.resolve({ slug: ['unknown'] }) };

      const response = await POST(request, context);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.method).toBe('POST');
      expect(data.body).toEqual({ test: 'data' });
      expect(data.message).toContain('does not exist');
    });

    it('should capture POST body in response', async () => {
      const testBody = { orderCode: 'TEST-123', status: 'active' };
      const request = createNextRequest('http://localhost:3000/api/cater-valley/wrong/path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testBody),
      });
      const context = { params: Promise.resolve({ slug: ['wrong', 'path'] }) };

      const response = await POST(request, context);
      const data = await response.json();

      expect(data.body).toEqual(testBody);
      expect(data.slug).toEqual(['wrong', 'path']);
    });

    it('should handle POST with invalid JSON', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/test', {
        method: 'POST',
        body: 'invalid json{',
      });
      const context = { params: Promise.resolve({ slug: ['test'] }) };

      const response = await POST(request, context);
      const data = await response.json();

      expect(data.method).toBe('POST');
      expect(data.body).toHaveProperty('raw');
      expect(response.status).toBe(404);
    });

    it('should include query parameters in POST response', async () => {
      const request = createNextRequest(
        'http://localhost:3000/api/cater-valley/test?foo=bar&baz=qux',
        {
          method: 'POST',
          body: JSON.stringify({ data: 'test' }),
        }
      );
      const context = { params: Promise.resolve({ slug: ['test'] }) };

      const response = await POST(request, context);
      const data = await response.json();

      expect(data.searchParams).toEqual({ foo: 'bar', baz: 'qux' });
    });
  });

  describe('✅ PUT Method', () => {
    it('should return 404 for unknown PUT endpoint', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/unknown', {
        method: 'PUT',
        body: JSON.stringify({ update: 'data' }),
      });
      const context = { params: Promise.resolve({ slug: ['unknown'] }) };

      const response = await PUT(request, context);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.method).toBe('PUT');
      expect(data.body).toEqual({ update: 'data' });
    });

    it('should capture PUT body and slug', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/test/endpoint', {
        method: 'PUT',
        body: JSON.stringify({ test: 'value' }),
      });
      const context = { params: Promise.resolve({ slug: ['test', 'endpoint'] }) };

      const response = await PUT(request, context);
      const data = await response.json();

      expect(data.method).toBe('PUT');
      expect(data.slug).toEqual(['test', 'endpoint']);
      expect(data.body).toEqual({ test: 'value' });
    });

    it('should handle PUT with text body', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/test', {
        method: 'PUT',
        body: 'plain text',
      });
      const context = { params: Promise.resolve({ slug: ['test'] }) };

      const response = await PUT(request, context);
      const data = await response.json();

      expect(data.body).toHaveProperty('raw', 'plain text');
    });
  });

  describe('✅ PATCH Method', () => {
    it('should return 404 for unknown PATCH endpoint', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/unknown', {
        method: 'PATCH',
        body: JSON.stringify({ patch: 'data' }),
      });
      const context = { params: Promise.resolve({ slug: ['unknown'] }) };

      const response = await PATCH(request, context);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.method).toBe('PATCH');
      expect(data.body).toEqual({ patch: 'data' });
    });

    it('should list available endpoints in PATCH response', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/wrong', {
        method: 'PATCH',
        body: JSON.stringify({ data: 'test' }),
      });
      const context = { params: Promise.resolve({ slug: ['wrong'] }) };

      const response = await PATCH(request, context);
      const data = await response.json();

      expect(data.availableEndpoints).toHaveLength(3);
      expect(data.availableEndpoints[0]).toContain('draft');
    });
  });

  describe('✅ DELETE Method', () => {
    it('should return 404 for unknown DELETE endpoint', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/unknown', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ slug: ['unknown'] }) };

      const response = await DELETE(request, context);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.method).toBe('DELETE');
      expect(data.slug).toEqual(['unknown']);
    });

    it('should include headers in DELETE response', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/test', {
        method: 'DELETE',
        headers: {
          'x-api-key': 'test-key',
          'partner': 'test-partner',
        },
      });
      const context = { params: Promise.resolve({ slug: ['test'] }) };

      const response = await DELETE(request, context);
      const data = await response.json();

      expect(data.headers).toHaveProperty('x-api-key', 'test-key');
      expect(data.headers).toHaveProperty('partner', 'test-partner');
    });

    it('should handle DELETE with multiple slug segments', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/orders/delete/123', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ slug: ['orders', 'delete', '123'] }) };

      const response = await DELETE(request, context);
      const data = await response.json();

      expect(data.slug).toEqual(['orders', 'delete', '123']);
    });
  });

  describe('📊 Edge Cases', () => {
    it('should handle empty slug array', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/');
      const context = { params: Promise.resolve({ slug: [] }) };

      const response = await GET(request, context);
      const data = await response.json();

      expect(data.slug).toEqual([]);
      expect(response.status).toBe(404);
    });

    it('should handle single slug segment', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/test');
      const context = { params: Promise.resolve({ slug: ['test'] }) };

      const response = await GET(request, context);
      const data = await response.json();

      expect(data.slug).toEqual(['test']);
    });

    it('should handle very long slug path', async () => {
      const longSlug = Array(20).fill('segment').map((s, i) => `${s}${i}`);
      const request = createNextRequest(`http://localhost:3000/api/cater-valley/${longSlug.join('/')}`);
      const context = { params: Promise.resolve({ slug: longSlug }) };

      const response = await GET(request, context);
      const data = await response.json();

      expect(data.slug).toEqual(longSlug);
    });

    it('should handle special characters in slug', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/test%20path');
      const context = { params: Promise.resolve({ slug: ['test path'] }) };

      const response = await GET(request, context);
      const data = await response.json();

      expect(data.slug).toEqual(['test path']);
    });

    it('should preserve timestamp in all responses', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/test');
      const context = { params: Promise.resolve({ slug: ['test'] }) };

      const response = await GET(request, context);
      const data = await response.json();

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle POST with empty body', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/test', {
        method: 'POST',
        body: '',
      });
      const context = { params: Promise.resolve({ slug: ['test'] }) };

      const response = await POST(request, context);
      const data = await response.json();

      expect(data.method).toBe('POST');
      expect(data.body).toBeDefined();
    });

    it('should handle PUT request without body', async () => {
      const request = createNextRequest('http://localhost:3000/api/cater-valley/test', {
        method: 'PUT',
      });
      const context = { params: Promise.resolve({ slug: ['test'] }) };

      const response = await PUT(request, context);
      const data = await response.json();

      expect(data.method).toBe('PUT');
      // When no body is provided, body parsing may return null, empty object, or error
      expect(data.body).toBeDefined();
    });
  });
});
