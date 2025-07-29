// jest.setup.ts
// Polyfills for Jest environment

import '@testing-library/jest-dom';
import React from 'react';

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

// Clean up after each test for better isolation
afterEach(() => {
  // Clear any timers
  jest.clearAllTimers();
  // Clear all mocks
  jest.clearAllMocks();
  // Restore any mocked implementations
  jest.restoreAllMocks();
  
  // Additional cleanup for CI environment
  if (process.env.CI) {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
});

// Don't mock react-dom/client - let it work normally for tests

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

// Mock UI components to avoid displayName issues
jest.mock('@/components/ui/select', () => ({
  Select: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'select', ...props }, children),
  SelectContent: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'select-content', ...props }, children),
  SelectItem: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'select-item', ...props }, children),
  SelectTrigger: ({ children, ...props }: any) => React.createElement('button', { 'data-testid': 'select-trigger', ...props }, children),
  SelectValue: ({ children, ...props }: any) => React.createElement('span', { 'data-testid': 'select-value', ...props }, children),
  SelectLabel: ({ children, ...props }: any) => React.createElement('label', { 'data-testid': 'select-label', ...props }, children),
  SelectGroup: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'select-group', ...props }, children),
  SelectSeparator: ({ ...props }: any) => React.createElement('hr', { 'data-testid': 'select-separator', ...props }),
  SelectScrollUpButton: ({ ...props }: any) => React.createElement('button', { 'data-testid': 'select-scroll-up', ...props }),
  SelectScrollDownButton: ({ ...props }: any) => React.createElement('button', { 'data-testid': 'select-scroll-down', ...props }),
}));

// Mock other UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => React.createElement('button', { 'data-testid': 'button', ...props }, children),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ ...props }: any) => React.createElement('input', { 'data-testid': 'input', ...props }),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => React.createElement('label', { 'data-testid': 'label', ...props }, children),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'dialog', ...props }, children),
  DialogContent: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'dialog-content', ...props }, children),
  DialogHeader: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'dialog-header', ...props }, children),
  DialogTitle: ({ children, ...props }: any) => React.createElement('h2', { 'data-testid': 'dialog-title', ...props }, children),
  DialogDescription: ({ children, ...props }: any) => React.createElement('p', { 'data-testid': 'dialog-description', ...props }, children),
  DialogTrigger: ({ children, ...props }: any) => React.createElement('button', { 'data-testid': 'dialog-trigger', ...props }, children),
}));

// Only set up window-related mocks if window exists (jsdom environment)
if (typeof window !== 'undefined') {
  // PointerEvent polyfill for JSDOM (needed for Radix UI components tested with user-event)
  if (!window.PointerEvent) {
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

  // Mock BroadcastChannel for MSW
  if (!window.BroadcastChannel) {
    window.BroadcastChannel = jest.fn().mockImplementation(() => ({
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      close: jest.fn(),
    }));
  }
}

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
process.env.DIRECT_URL = "postgresql://test:test@localhost:5432/test_db";
process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.NODE_ENV = "test";

// Set timeout based on environment - CI gets longer timeout
const testTimeout = process.env.CI ? 90000 : 30000;
jest.setTimeout(testTimeout);

// Log test environment info on startup for debugging
if (process.env.CI) {
  console.log('🧪 Test Environment Info:');
  console.log(`- Node Version: ${process.version}`);
  console.log(`- Test Timeout: ${testTimeout}ms`);
  console.log(`- Max Workers: ${process.env.CI ? '2' : 'default'}`);
  console.log(`- NODE_OPTIONS: ${process.env.NODE_OPTIONS || 'not set'}`);
} 