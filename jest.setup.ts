// jest.setup.ts
// Polyfills for Jest environment

import '@testing-library/jest-dom';
import React from 'react';

// Mock cheerio - ESM module that doesn't work well with Jest + pnpm
jest.mock('cheerio', () => ({
  load: jest.fn((html: string) => {
    // Create a simple mock cheerio interface with explicit type
    interface MockCheerioElement {
      text: jest.Mock;
      html: jest.Mock;
      attr: jest.Mock;
      find: jest.Mock;
      each: jest.Mock;
      length: number;
    }
    const mockElement: MockCheerioElement = {
      text: jest.fn(() => ''),
      html: jest.fn(() => html),
      attr: jest.fn(() => ''),
      find: jest.fn((): MockCheerioElement => mockElement),
      each: jest.fn(),
      length: 0,
    };
    const $ = jest.fn(() => mockElement);
    Object.assign($, mockElement);
    return $;
  }),
  contains: jest.fn(),
  merge: jest.fn(),
}));

// Set up test environment variables
// Use Object.defineProperty to avoid read-only property error
Object.defineProperty(process.env, 'NODE_ENV', {
  value: 'test',
  writable: true,
  configurable: true,
});

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_test';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_test';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-api-key';
process.env.CLOUDINARY_API_SECRET = 'test-api-secret';
process.env.SANITY_PROJECT_ID = 'test-project';
process.env.SANITY_DATASET = 'test-dataset';
process.env.SANITY_API_TOKEN = 'test-token';
process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test.mock-mapbox-token';

// Mock Mapbox GL JS - Jest will use the manual mock from src/__mocks__/mapbox-gl.ts

// Fix TextEncoder/Decoder for Node 18+
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

// Add ReadableStream polyfill for Node.js/Jest environment
if (typeof ReadableStream === 'undefined') {
  // @ts-ignore
  global.ReadableStream = class ReadableStream {
    private reader: any;

    constructor(underlyingSource: any = {}) {
      const { start, pull, cancel } = underlyingSource;
      let controller: any;
      let started = false;
      const chunks: any[] = [];
      let closed = false;

      controller = {
        enqueue: (chunk: any) => {
          if (!closed) {
            chunks.push(chunk);
          }
        },
        close: () => {
          closed = true;
        },
        error: (err: any) => {
          closed = true;
        },
      };

      this.reader = {
        read: async () => {
          if (!started && start) {
            await start(controller);
            started = true;
          }

          if (chunks.length > 0) {
            return { value: chunks.shift(), done: false };
          }

          if (closed) {
            return { done: true };
          }

          if (pull) {
            await pull(controller);
            if (chunks.length > 0) {
              return { value: chunks.shift(), done: false };
            }
          }

          return { done: true };
        },
        releaseLock: () => {},
        cancel: cancel || (() => {}),
      };
    }

    getReader() {
      return this.reader;
    }
  } as any;
}

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return React.createElement('img', { src, alt, width, height, ...props });
  },
}));

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return React.createElement('a', { href, ...props }, children);
  };
});

// React 18 test environment setup
import { configure } from '@testing-library/react';

// Configure React Testing Library for React 18
configure({
  testIdAttribute: 'data-testid',
});

// Set up proper DOM for React 18 createRoot
beforeEach(() => {
  // Ensure document.body exists
  if (!document.body) {
    document.body = document.createElement('body');
  }
});

// React 18's createRoot is properly supported by React Testing Library
// No need to mock it - let React Testing Library handle createRoot natively

// Mock next/navigation properly
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
  })),
  useSearchParams: jest.fn(() => {
    const params = new URLSearchParams();
    // Add common query parameter support
    params.get = jest.fn((key: string) => null);
    params.has = jest.fn((key: string) => false);
    params.getAll = jest.fn((key: string) => []);
    params.toString = jest.fn(() => '');
    return params;
  }),
  usePathname: jest.fn(() => '/'),
  useParams: jest.fn(() => ({})),
  useSelectedLayoutSegment: jest.fn(() => null),
  useSelectedLayoutSegments: jest.fn(() => []),
  redirect: jest.fn(),
  permanentRedirect: jest.fn(),
  notFound: jest.fn(),
}));

// Mock next/headers globally
jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    set: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  }),
}));

// PointerEvent polyfill for JSDOM (needed for Radix UI components tested with user-event)
if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
    }
  }
  window.PointerEvent = PointerEvent as any;
}

// Fix hasPointerCapture and related pointer capture methods for JSDOM
if (typeof Element !== 'undefined') {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function(pointerId: number) { 
      // No-op: JSDOM doesn't support pointer capture
    };
  }

  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = function(pointerId: number) {
      // No-op: JSDOM doesn't support pointer capture
    };
  }

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = function(pointerId: number): boolean {
      // No-op: JSDOM doesn't support pointer capture
      return false;
    };
  }
}

// Mock window methods
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn(),
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  disconnect: jest.fn(),
  observe: jest.fn(),
  unobserve: jest.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock Supabase server client with full query builder support
jest.mock('@/utils/supabase/server', () => {
  const createMockQueryBuilder = () => {
    const mockBuilder: any = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      like: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      containedBy: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn((resolve) => resolve({ data: null, error: null })),
    };
    return mockBuilder;
  };

  return {
    createClient: jest.fn().mockResolvedValue({
      from: jest.fn((table: string) => createMockQueryBuilder()),
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInWithPassword: jest.fn().mockResolvedValue({ data: null, error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        signUp: jest.fn().mockResolvedValue({ data: null, error: null }),
        refreshSession: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
      storage: {
        from: jest.fn((bucket: string) => ({
          upload: jest.fn().mockResolvedValue({ data: null, error: null }),
          download: jest.fn().mockResolvedValue({ data: null, error: null }),
          remove: jest.fn().mockResolvedValue({ data: null, error: null }),
          list: jest.fn().mockResolvedValue({ data: [], error: null }),
          getPublicUrl: jest.fn((path: string) => ({ data: { publicUrl: `https://example.com/${path}` } })),
        })),
      },
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      schema: jest.fn().mockReturnThis(),
    }),
    createAdminClient: jest.fn().mockResolvedValue({
      from: jest.fn((table: string) => createMockQueryBuilder()),
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInWithPassword: jest.fn().mockResolvedValue({ data: null, error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        signUp: jest.fn().mockResolvedValue({ data: null, error: null }),
        refreshSession: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
      storage: {
        from: jest.fn((bucket: string) => ({
          upload: jest.fn().mockResolvedValue({ data: null, error: null }),
          download: jest.fn().mockResolvedValue({ data: null, error: null }),
          remove: jest.fn().mockResolvedValue({ data: null, error: null }),
          list: jest.fn().mockResolvedValue({ data: [], error: null }),
          getPublicUrl: jest.fn((path: string) => ({ data: { publicUrl: `https://example.com/${path}` } })),
        })),
      },
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      schema: jest.fn().mockReturnThis(),
    }),
  };
});

// Mock Supabase client-side (browser) client
jest.mock('@/utils/supabase/client', () => {
  const createMockQueryBuilder = () => {
    const mockBuilder: any = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      like: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      containedBy: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn((resolve) => resolve({ data: null, error: null })),
    };
    return mockBuilder;
  };

  return {
    createClient: jest.fn().mockReturnValue({
      from: jest.fn((table: string) => createMockQueryBuilder()),
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInWithPassword: jest.fn().mockResolvedValue({ data: null, error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        signUp: jest.fn().mockResolvedValue({ data: null, error: null }),
        refreshSession: jest.fn().mockResolvedValue({ data: null, error: null }),
        onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      },
      storage: {
        from: jest.fn((bucket: string) => ({
          upload: jest.fn().mockResolvedValue({ data: null, error: null }),
          download: jest.fn().mockResolvedValue({ data: null, error: null }),
          remove: jest.fn().mockResolvedValue({ data: null, error: null }),
          list: jest.fn().mockResolvedValue({ data: [], error: null }),
          getPublicUrl: jest.fn((path: string) => ({ data: { publicUrl: `https://example.com/${path}` } })),
        })),
      },
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      schema: jest.fn().mockReturnThis(),
    }),
  };
});

// Mock auth utilities to prevent real database calls during auth middleware tests
jest.mock('@/lib/auth', () => ({
  getUserRole: jest.fn().mockResolvedValue(null),
  updateUserRole: jest.fn().mockResolvedValue({ success: true }),
  syncOAuthProfile: jest.fn().mockResolvedValue({ success: true, newProfile: false }),
  getCurrentUser: jest.fn().mockResolvedValue(null),
}));

// Mock Prisma client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $transaction: jest.fn(),
    cateringRequest: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    onDemand: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    address: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  })),
}));

// Mock email sender
jest.mock('@/utils/emailSender', () => ({
  sendOrderEmail: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock Next.js server APIs globally
global.Request = jest.fn().mockImplementation((url, options) => ({
  url,
  method: options?.method || 'GET',
  headers: new Headers(options?.headers),
  json: () => {
    try {
      return Promise.resolve(options?.body ? JSON.parse(options.body) : {});
    } catch (error) {
      return Promise.reject(new SyntaxError('Unexpected token in JSON'));
    }
  },
  text: () => Promise.resolve(options?.body || ''),
}));

// @ts-ignore - Mock Response constructor for tests
global.Response = jest.fn().mockImplementation((body, options) => ({
  ok: true,
  status: options?.status || 200,
  headers: new Headers(options?.headers),
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(body),
}));

// Mock NextResponse with constructor support
class MockNextResponse {
  public status: number;
  public headers: Headers;
  private body: any;

  constructor(body?: any, init?: ResponseInit) {
    this.body = body;
    this.status = init?.status || 200;
    this.headers = new Headers(init?.headers);
  }

  async json() {
    return this.body;
  }

  async text() {
    return this.body ? String(this.body) : '';
  }

  static json(data: any, options?: ResponseInit) {
    const mergedHeaders = new Headers(options?.headers);
    if (!mergedHeaders.has('content-type')) {
      mergedHeaders.set('content-type', 'application/json');
    }
    const response = new MockNextResponse(data, {
      ...options,
      headers: mergedHeaders,
    });
    response.json = () => Promise.resolve(data);
    return response;
  }

  static next() {
    return new MockNextResponse({}, { status: 200 });
  }

  static redirect(url: string | URL, status: number = 302) {
    const urlString = typeof url === 'string' ? url : url.toString();
    const response = new MockNextResponse(null, {
      status,
      headers: { location: urlString },
    });
    return response;
  }
}

jest.mock('next/server', () => {
  // Import the actual NextRequest for proper functionality
  const actualNextServer = jest.requireActual('next/server');

  return {
    NextRequest: actualNextServer.NextRequest,
    NextResponse: MockNextResponse,
  };
});

// Also mock NextResponse directly for API routes
(global as any).NextResponse = MockNextResponse;

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => React.createElement('div', props, children),
    span: ({ children, ...props }: any) => React.createElement('span', props, children),
    button: ({ children, ...props }: any) => React.createElement('button', props, children),
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock react-hot-toast
jest.mock('react-hot-toast', () => {
  const mockToastFn = jest.fn((message: any) => message);
  const mockToast = {
    success: mockToastFn,
    error: mockToastFn,
    loading: mockToastFn,
    custom: mockToastFn,
    promise: jest.fn(() => Promise.resolve()),
    dismiss: jest.fn(),
    remove: jest.fn(),
  };

  return {
    __esModule: true,
    default: mockToast,
    toast: mockToast,
    Toaster: () => null,
    useToaster: jest.fn(() => ({
      toasts: [],
      handlers: {
        startPause: jest.fn(),
        endPause: jest.fn(),
        updateHeight: jest.fn(),
        calculateOffset: jest.fn(),
      },
    })),
  };
});

// Mock Radix UI Dialog
jest.mock('@radix-ui/react-dialog', () => {
  const React = require('react');

  const createMockComponent = (name: string) => {
    const Component = React.forwardRef(({ children, ...props }: any, ref: any) => {
      // Filter out Radix-specific props
      const { asChild, onOpenChange, ...domProps } = props;
      return React.createElement('div', { ref, 'data-testid': `dialog-${name.toLowerCase()}`, ...domProps }, children);
    });
    Component.displayName = name;
    return Component;
  };

  return {
    Root: createMockComponent('Root'),
    Trigger: createMockComponent('Trigger'),
    Portal: createMockComponent('Portal'),
    Close: createMockComponent('Close'),
    Overlay: createMockComponent('Overlay'),
    Content: createMockComponent('Content'),
    Title: createMockComponent('Title'),
    Description: createMockComponent('Description'),
  };
});

// Mock Radix UI Alert Dialog
jest.mock('@radix-ui/react-alert-dialog', () => {
  const React = require('react');

  const createMockComponent = (name: string) => {
    const Component = React.forwardRef(({ children, ...props }: any, ref: any) => {
      // Filter out Radix-specific props
      const { asChild, onOpenChange, ...domProps } = props;
      return React.createElement('div', { ref, 'data-testid': `alert-dialog-${name.toLowerCase()}`, ...domProps }, children);
    });
    Component.displayName = name;
    return Component;
  };

  return {
    Root: createMockComponent('Root'),
    Trigger: createMockComponent('Trigger'),
    Portal: createMockComponent('Portal'),
    Overlay: createMockComponent('Overlay'),
    Content: createMockComponent('Content'),
    Title: createMockComponent('Title'),
    Description: createMockComponent('Description'),
    Action: createMockComponent('Action'),
    Cancel: createMockComponent('Cancel'),
  };
});

// Mock Radix UI Select
jest.mock('@radix-ui/react-select', () => {
  const React = require('react');

  const createMockComponent = (name: string) => {
    const Component = React.forwardRef(({ children, ...props }: any, ref: any) => {
      // Filter out Radix-specific props
      const { asChild, onValueChange, onOpenChange, value, defaultValue, ...domProps } = props;
      return React.createElement('div', { ref, 'data-testid': `select-${name.toLowerCase()}`, ...domProps }, children);
    });
    Component.displayName = name;
    return Component;
  };

  return {
    Root: createMockComponent('Root'),
    Trigger: createMockComponent('Trigger'),
    Value: createMockComponent('Value'),
    Icon: createMockComponent('Icon'),
    Portal: createMockComponent('Portal'),
    Content: createMockComponent('Content'),
    Viewport: createMockComponent('Viewport'),
    Item: createMockComponent('Item'),
    ItemText: createMockComponent('ItemText'),
    ItemIndicator: createMockComponent('ItemIndicator'),
    ScrollUpButton: createMockComponent('ScrollUpButton'),
    ScrollDownButton: createMockComponent('ScrollDownButton'),
    Group: createMockComponent('Group'),
    Label: createMockComponent('Label'),
    Separator: createMockComponent('Separator'),
  };
});

// Mock Radix UI Tabs
jest.mock('@radix-ui/react-tabs', () => {
  const React = require('react');

  const createMockComponent = (name: string) => {
    const Component = React.forwardRef(({ children, ...props }: any, ref: any) => {
      // Filter out Radix-specific props
      const { asChild, onValueChange, value, defaultValue, ...domProps } = props;
      return React.createElement('div', { ref, 'data-testid': `tabs-${name.toLowerCase()}`, ...domProps }, children);
    });
    Component.displayName = name;
    return Component;
  };

  return {
    Root: createMockComponent('Root'),
    List: createMockComponent('List'),
    Trigger: createMockComponent('Trigger'),
    Content: createMockComponent('Content'),
  };
});

// Mock File API for upload tests
// Enhance existing File class or create new one if it doesn't exist
if (typeof File !== 'undefined' && typeof File.prototype !== 'undefined') {
  // File exists but may be missing methods - add them to prototype
  if (!File.prototype.text) {
    File.prototype.text = async function(): Promise<string> {
      // @ts-ignore - accessing internal bits
      const bits = this._bits || [];
      return bits.join('');
    };
  }

  if (!File.prototype.arrayBuffer) {
    File.prototype.arrayBuffer = async function(): Promise<ArrayBuffer> {
      const text = await this.text();
      const encoder = new TextEncoder();
      return encoder.encode(text).buffer as ArrayBuffer;
    };
  }

  if (!File.prototype.stream) {
    File.prototype.stream = function(): ReadableStream {
      const file = this;
      return new ReadableStream({
        async start(controller) {
          const text = await file.text();
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      });
    };
  }

  // Wrap the original File constructor to store bits for text() method
  const OriginalFile = global.File;
  // @ts-ignore
  global.File = class File extends OriginalFile {
    _bits: any[];

    constructor(bits: any[], filename: string, options: any = {}) {
      super(bits, filename, options);
      // Store bits for text() method to access
      this._bits = bits;
    }
  };
  // Copy static properties
  Object.setPrototypeOf(global.File, OriginalFile);
} else {
  // File doesn't exist at all - create from scratch
  // @ts-ignore
  global.File = class File {
    name: string;
    type: string;
    size: number;
    lastModified: number;
    _bits: any[];

    constructor(bits: any[], filename: string, options: any = {}) {
      this.name = filename;
      this.type = options.type || '';
      this.size = bits.reduce((acc, bit) => acc + (bit?.length || 0), 0);
      this.lastModified = options.lastModified || Date.now();
      this._bits = bits;
    }

    async text(): Promise<string> {
      return this._bits.join('');
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
      const text = await this.text();
      const encoder = new TextEncoder();
      return encoder.encode(text).buffer as ArrayBuffer;
    }

    stream(): ReadableStream {
      const file = this;
      return new ReadableStream({
        async start(controller) {
          const text = await file.text();
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      });
    }

    slice(start?: number, end?: number, contentType?: string): Blob {
      const slicedBits = this._bits.slice(start, end);
      return new Blob(slicedBits, { type: contentType || this.type });
    }
  } as any;
}

// Mock Blob API
if (typeof Blob !== 'undefined' && typeof Blob.prototype !== 'undefined') {
  // Blob exists but may be missing methods - add them to prototype
  if (!Blob.prototype.text) {
    Blob.prototype.text = async function(): Promise<string> {
      // @ts-ignore - accessing internal bits
      const bits = this._bits || [];
      return bits.join('');
    };
  }

  if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = async function(): Promise<ArrayBuffer> {
      const text = await this.text();
      const encoder = new TextEncoder();
      return encoder.encode(text).buffer as ArrayBuffer;
    };
  }

  if (!Blob.prototype.stream) {
    Blob.prototype.stream = function(): ReadableStream {
      const blob = this;
      return new ReadableStream({
        async start(controller) {
          const text = await blob.text();
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      });
    };
  }

  // Wrap the original Blob constructor to store bits for text() method
  const OriginalBlob = global.Blob;
  // @ts-ignore
  global.Blob = class Blob extends OriginalBlob {
    _bits: any[];

    constructor(bits: any[] = [], options: any = {}) {
      super(bits, options);
      // Store bits for text() method to access
      this._bits = bits;
    }
  };
  // Copy static properties
  Object.setPrototypeOf(global.Blob, OriginalBlob);
} else {
  // Blob doesn't exist at all - create from scratch
  global.Blob = class Blob {
    type: string;
    size: number;
    _bits: any[];

    constructor(bits: any[] = [], options: any = {}) {
      this.type = options.type || '';
      this._bits = bits;
      this.size = bits.reduce((acc, bit) => acc + (bit?.length || 0), 0);
    }

    async text(): Promise<string> {
      return this._bits.join('');
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
      const text = await this.text();
      const encoder = new TextEncoder();
      return encoder.encode(text).buffer as ArrayBuffer;
    }

    stream(): ReadableStream {
      const blob = this;
      return new ReadableStream({
        async start(controller) {
          const text = await blob.text();
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      });
    }

    slice(start?: number, end?: number, contentType?: string): Blob {
      const slicedBits = this._bits.slice(start, end);
      return new Blob(slicedBits, { type: contentType || this.type });
    }
  } as any;
}

// Mock FormData API
if (typeof FormData === 'undefined') {
  global.FormData = class FormData {
    private data: Map<string, any[]>;

    constructor() {
      this.data = new Map();
    }

    append(name: string, value: any, filename?: string): void {
      if (!this.data.has(name)) {
        this.data.set(name, []);
      }
      this.data.get(name)!.push(value);
    }

    delete(name: string): void {
      this.data.delete(name);
    }

    get(name: string): any {
      const values = this.data.get(name);
      return values ? values[0] : null;
    }

    getAll(name: string): any[] {
      return this.data.get(name) || [];
    }

    has(name: string): boolean {
      return this.data.has(name);
    }

    set(name: string, value: any, filename?: string): void {
      this.data.set(name, [value]);
    }

    entries(): IterableIterator<[string, any]> {
      const entries: [string, any][] = [];
      this.data.forEach((values, key) => {
        values.forEach(value => {
          entries.push([key, value]);
        });
      });
      return entries[Symbol.iterator]();
    }

    keys(): IterableIterator<string> {
      return this.data.keys();
    }

    values(): IterableIterator<any> {
      const values: any[] = [];
      this.data.forEach((vals) => {
        vals.forEach(val => values.push(val));
      });
      return values[Symbol.iterator]();
    }

    forEach(callback: (value: any, key: string, parent: FormData) => void): void {
      this.data.forEach((values, key) => {
        values.forEach(value => {
          callback(value, key, this);
        });
      });
    }

    [Symbol.iterator](): IterableIterator<[string, any]> {
      return this.entries();
    }
  } as any;
}

// Enhance Request mock to support formData()
if (typeof Request !== 'undefined' && Request.prototype) {
  const originalRequest = Request;
  // @ts-ignore - Extending Request prototype
  global.Request = class extends originalRequest {
    async formData(): Promise<FormData> {
      // Return empty FormData for tests
      return new FormData();
    }
  } as any;
}

// Increase timeout for async operations
jest.setTimeout(30000); 