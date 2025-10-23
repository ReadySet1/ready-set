// jest.setup.ts
// Polyfills for Jest environment

import '@testing-library/jest-dom';
import React from 'react';

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

// Fix TextEncoder/Decoder for Node 18+
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

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
  useRouter() {
    return {
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
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
  useParams() {
    return {};
  },
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

// Mock Supabase server client
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn().mockReturnValue({
    auth: {
      getUser: jest.fn(),
    },
  }),
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
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
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
    const response = new MockNextResponse(data, options);
    response.json = () => Promise.resolve(data);
    return response;
  }

  static next() {
    return new MockNextResponse({}, { status: 200 });
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

// Mock Radix UI Select primitive
jest.mock('@radix-ui/react-select', () => {
  const React = require('react');
  return {
    Root: ({ children, ...props }: any) => React.createElement('div', props, children),
    Group: ({ children, ...props }: any) => React.createElement('div', props, children),
    Value: ({ children, ...props }: any) => React.createElement('span', props, children),
    Trigger: ({ children, ...props }: any) => React.createElement('button', { ...props, role: 'combobox' }, children),
    Content: ({ children, ...props }: any) => React.createElement('div', props, children),
    Label: ({ children, ...props }: any) => React.createElement('div', props, children),
    Item: ({ children, ...props }: any) => React.createElement('div', props, children),
    Separator: ({ children, ...props }: any) => React.createElement('div', props, children),
    ScrollUpButton: ({ children, ...props }: any) => React.createElement('button', props, children),
    ScrollDownButton: ({ children, ...props }: any) => React.createElement('button', props, children),
    Viewport: ({ children, ...props }: any) => React.createElement('div', props, children),
    Portal: ({ children, ...props }: any) => children,
    ItemIndicator: ({ children, ...props }: any) => React.createElement('span', props, children),
    ItemText: ({ children, ...props }: any) => React.createElement('span', props, children),
    Icon: ({ children, ...props }: any) => React.createElement('span', props, children),
  };
});

// Mock other Radix UI components that might be used
jest.mock('@radix-ui/react-tabs', () => {
  const React = require('react');
  return {
    Root: ({ children, ...props }: any) => React.createElement('div', props, children),
    List: ({ children, ...props }: any) => React.createElement('div', { ...props, role: 'tablist' }, children),
    Trigger: ({ children, ...props }: any) => React.createElement('button', { ...props, role: 'tab' }, children),
    Content: ({ children, ...props }: any) => React.createElement('div', { ...props, role: 'tabpanel' }, children),
  };
});

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
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    custom: jest.fn(),
    promise: jest.fn(),
    dismiss: jest.fn(),
  },
  Toaster: () => null,
}));

// Increase timeout for async operations
jest.setTimeout(30000); 