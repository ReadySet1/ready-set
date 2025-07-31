import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Set up environment variables for tests
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={width} height={height} {...props} />;
  },
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock Supabase client (if needed)
// jest.mock('@/utils/supabase/client', () => ({
//   createClient: jest.fn(() => ({
//     auth: {
//       getUser: jest.fn(),
//       getSession: jest.fn(),
//       onAuthStateChange: jest.fn(() => ({
//         data: { subscription: { unsubscribe: jest.fn() } }
//       })),
//     },
//   })),
// }));

// Mock window methods (only if window is available)
if (typeof window !== 'undefined') {
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

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

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

// Add TextEncoder and TextDecoder to global scope
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

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
