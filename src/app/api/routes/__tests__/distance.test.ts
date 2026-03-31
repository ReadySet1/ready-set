/**
 * Unit tests for POST /api/routes/distance
 *
 * Tests the Distance Matrix API route with mocked Google Maps responses.
 */

import { POST } from '../distance/route';
import { NextRequest } from 'next/server';

// Mock Sentry to avoid real error tracking
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// Mock Supabase — authenticated user by default
const mockGetUser = jest.fn().mockResolvedValue({
  data: { user: { id: 'test-user-id', email: 'admin@readyset.com' } },
  error: null,
});

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}));

// Mock Google Distance Matrix API responses via global.fetch
const mockFetchResponse = jest.fn();
(global.fetch as jest.Mock) = mockFetchResponse;

// Set API key
process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';

function buildRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/routes/distance', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/routes/distance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'admin@readyset.com' } },
      error: null,
    });
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const req = buildRequest({
      origins: [{ address: '123 Main St' }],
      destinations: [{ address: '456 Oak Ave' }],
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid request body', async () => {
    const req = buildRequest({ origins: [], destinations: [] });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Validation error');
  });

  it('returns 400 when origins is missing', async () => {
    const req = buildRequest({ destinations: [{ address: '456 Oak Ave' }] });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns distance and duration for a valid request', async () => {
    mockFetchResponse.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'OK',
          origin_addresses: ['123 Main St, Austin, TX 78701, USA'],
          destination_addresses: ['456 Oak Ave, Dallas, TX 75201, USA'],
          rows: [
            {
              elements: [
                {
                  status: 'OK',
                  distance: { value: 314217, text: '195 mi' },
                  duration: { value: 10530, text: '2 hours 56 mins' },
                },
              ],
            },
          ],
        }),
    });

    const req = buildRequest({
      origins: [{ address: '123 Main St, Austin, TX' }],
      destinations: [{ address: '456 Oak Ave, Dallas, TX' }],
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.entries).toHaveLength(1);
    expect(data.data.entries[0].distanceMiles).toBeCloseTo(195.24, 0);
    expect(data.data.entries[0].durationMinutes).toBeCloseTo(175.5, 0);
    expect(data.data.entries[0].status).toBe('OK');
  });

  it('handles multiple destinations', async () => {
    mockFetchResponse.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'OK',
          origin_addresses: ['123 Main St, Austin, TX'],
          destination_addresses: [
            '456 Oak Ave, San Antonio, TX',
            '789 Elm St, Houston, TX',
          ],
          rows: [
            {
              elements: [
                {
                  status: 'OK',
                  distance: { value: 129600, text: '80.5 mi' },
                  duration: { value: 4320, text: '1 hour 12 mins' },
                },
                {
                  status: 'OK',
                  distance: { value: 264000, text: '164 mi' },
                  duration: { value: 9720, text: '2 hours 42 mins' },
                },
              ],
            },
          ],
        }),
    });

    const req = buildRequest({
      origins: [{ address: '123 Main St, Austin, TX' }],
      destinations: [
        { address: '456 Oak Ave, San Antonio, TX' },
        { address: '789 Elm St, Houston, TX' },
      ],
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.data.entries).toHaveLength(2);
    expect(data.data.destinationAddresses).toHaveLength(2);
  });

  it('returns 500 when Google API returns non-OK status', async () => {
    mockFetchResponse.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'REQUEST_DENIED',
          error_message: 'The provided API key is invalid.',
        }),
    });

    const req = buildRequest({
      origins: [{ address: '123 Main St' }],
      destinations: [{ address: '456 Oak Ave' }],
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('REQUEST_DENIED');
  });

  it('returns 500 when Google API key is not configured', async () => {
    const originalKey = process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;

    const req = buildRequest({
      origins: [{ address: '123 Main St' }],
      destinations: [{ address: '456 Oak Ave' }],
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain('not configured');

    process.env.GOOGLE_MAPS_API_KEY = originalKey;
  });

  it('includes timestamp in all responses', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const req = buildRequest({
      origins: [{ address: '123 Main St' }],
      destinations: [{ address: '456 Oak Ave' }],
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.timestamp).toBeDefined();
    expect(new Date(data.timestamp).getTime()).not.toBeNaN();
  });
});
