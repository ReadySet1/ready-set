// jest.setup.ts
// Polyfills for Jest environment

import '@testing-library/jest-dom';

// Fix TextEncoder/Decoder for Node 18+
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

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

// Mock React 18's createRoot to fall back to React 17 render
jest.mock('react-dom/client', () => ({
  createRoot: jest.fn().mockImplementation((container) => {
    const ReactDOM = require('react-dom');
    
    // If no container is provided or it's not a valid DOM element, create one
    let targetContainer = container;
    if (!container || !container.nodeType) {
      targetContainer = document.createElement('div');
      if (document.body) {
        document.body.appendChild(targetContainer);
      }
    }
    
    return {
      // eslint-disable-next-line react/no-deprecated
      render: (element: any) => {
        ReactDOM.render(element, targetContainer);
      },
      // eslint-disable-next-line react/no-deprecated
      unmount: () => ReactDOM.unmountComponentAtNode(targetContainer),
    };
  }),
}));

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

if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function(pointerId: number) { 
    // No-op: JSDOM doesn't support pointer capture
  };
}

if (typeof Element !== 'undefined' && !Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = function(pointerId: number) {
    // No-op: JSDOM doesn't support pointer capture
  };
}

if (typeof Element !== 'undefined' && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function(pointerId: number): boolean {
    // No-op: JSDOM doesn't support pointer capture
    return false;
  };
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

// Mock NextResponse
const mockNextResponse = {
  json: jest.fn((data, options) => ({
    json: () => Promise.resolve(data),
    status: options?.status || 200,
    headers: new Headers(),
  })),
  next: jest.fn(() => ({
    json: () => Promise.resolve({}),
    status: 200,
    headers: new Headers(),
  })),
};

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: mockNextResponse,
}));

// Set up environment variables for tests
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

// Increase timeout for async operations
jest.setTimeout(30000); 