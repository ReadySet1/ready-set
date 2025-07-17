// jest.setup.js
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    pathname: '',
    query: {},
    asPath: '',
  })),
  usePathname: jest.fn(() => ''),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
    status: 200,
    headers: new Headers(),
    text: () => Promise.resolve(''),
  })
);

// Mock environment variables
jest.mock('process', () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: 'https://example.com',
    // Add other environment variables as needed
  },
}));

// Optional: Extend expect with additional matchers
expect.extend({
  toBeInTheDocument(received) {
    const pass = received !== null && received !== undefined;
    if (pass) {
      return {
        message: () => `expected element not to be in the document`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected element to be in the document`,
        pass: false,
      };
    }
  },
});

// Silence console errors during testing
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: An update inside a test was not wrapped in act') ||
     args[0].includes('Warning: Can\'t perform a React state update on an unmounted component'))
  ) {
    return;
  }
  originalConsoleError(...args);
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
}); 