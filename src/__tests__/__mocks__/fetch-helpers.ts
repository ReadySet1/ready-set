/**
 * Centralized Fetch Mocking Helpers
 *
 * Provides consistent mock Response creation for all tests.
 * Use these helpers instead of manually creating Response objects.
 */

export interface MockResponseOptions {
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: HeadersInit;
  contentType?: string;
}

/**
 * Creates a properly typed mock Response object with jest mock functions.
 * Use this for tests that need to verify response method calls.
 */
export function createMockResponse(
  data: unknown,
  options: MockResponseOptions = {}
): Response {
  const status = options.status ?? 200;
  const ok = options.ok ?? (status >= 200 && status < 300);
  const headers = new Headers(options.headers);

  if (options.contentType) {
    headers.set('content-type', options.contentType);
  } else if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const textValue =
    typeof data === 'string' ? data : JSON.stringify(data ?? '');

  return {
    ok,
    status,
    statusText: options.statusText || (ok ? 'OK' : 'Error'),
    headers,
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: jest.fn(function (this: Response) {
      return this;
    }),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    blob: jest.fn().mockResolvedValue(new Blob()),
    formData: jest.fn().mockResolvedValue(new FormData()),
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(textValue),
    bytes: jest.fn().mockResolvedValue(new Uint8Array()),
  } as Response;
}

/**
 * Creates a mock fetch function with URL-based routing.
 * Useful for component tests that make multiple API calls.
 *
 * @example
 * const mockFetch = createMockFetch({
 *   '/api/orders/': { id: '1', status: 'active' },
 *   '/api/drivers': [],
 * });
 * global.fetch = mockFetch;
 */
export function createMockFetch(
  routes: Record<string, unknown | ((url: string, options?: RequestInit) => Response)>
): jest.Mock {
  return jest.fn().mockImplementation((url: string, options?: RequestInit) => {
    // Find matching route
    for (const [pattern, response] of Object.entries(routes)) {
      if (url.includes(pattern)) {
        if (typeof response === 'function') {
          return Promise.resolve(response(url, options));
        }
        return Promise.resolve(createMockResponse(response));
      }
    }

    // Default: return 404
    return Promise.resolve(
      createMockResponse({ error: 'Not Found', url }, { status: 404, ok: false })
    );
  });
}

/**
 * Helper to create success response (status 200)
 */
export function mockSuccess(data: unknown): Response {
  return createMockResponse(data, { status: 200, ok: true });
}

/**
 * Helper to create error response
 */
export function mockError(message: string, status: number = 500): Response {
  return createMockResponse(
    { error: message },
    { status, ok: false, statusText: message }
  );
}

/**
 * Helper to create 404 response
 */
export function mockNotFound(message: string = 'Not Found'): Response {
  return createMockResponse(
    { error: message },
    { status: 404, ok: false, statusText: 'Not Found' }
  );
}

/**
 * Helper to create unauthorized response (401)
 */
export function mockUnauthorized(message: string = 'Unauthorized'): Response {
  return createMockResponse(
    { error: message },
    { status: 401, ok: false, statusText: 'Unauthorized' }
  );
}
