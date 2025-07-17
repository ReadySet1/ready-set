// vitest.setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    pathname: '',
    query: {},
    asPath: '',
  })),
  usePathname: vi.fn(() => ''),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock Next.js Link component
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    React.createElement('a', { href: href }, children)
  ),
}));

// Mock fetch globally
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
    status: 200,
    headers: new Headers(),
    text: () => Promise.resolve(''),
    statusText: '',
    type: 'basic',
    redirected: false,
    url: '',
  } as Response)
);

// Mock environment variables
vi.mock('process', () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: 'https://example.com',
    // Add other environment variables as needed
  },
}));

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

// --- Mock Pointer Events for Radix --- 
// JSDOM doesn't support Pointer Events, which Radix uses.
if (typeof window !== 'undefined') {
  // Mock Element.prototype.hasPointerCapture
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  // Mock Element.prototype.releasePointerCapture
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
}
// -----------------------------------

// Optional: Extend Vitest's expect assertions with DOM matchers if needed
// If you rely heavily on `@testing-library/jest-dom` matchers, you might need a similar library for Vitest
// import '* as matchers from '@testing-library/jest-dom/matchers'';
// import { expect } from 'vitest';
// expect.extend(matchers);

// Optional: Add cleanup for testing-library/react if used
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup(); // Run cleanup after each test
});

// Add any other global setup needed for your tests here

console.log("Vitest setup file loaded."); 