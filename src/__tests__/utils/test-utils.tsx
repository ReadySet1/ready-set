import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

// Mock Next.js router
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
};

// Mock Supabase client
export const mockSupabase = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: "test-user-id", email: "test@example.com" } },
      error: null,
    }),
    getSession: jest.fn().mockResolvedValue({
      data: { session: { access_token: "mock-token", user: { id: "test-user-id" } } },
      error: null,
    }),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
};

// Mock fetch function
export const mockFetch = jest.fn();

// Setup global mocks
export const setupGlobalMocks = () => {
  // Mock Next.js navigation
  jest.mock("next/navigation", () => ({
    useRouter: () => mockRouter,
  }));

  // Mock Supabase
  jest.mock("@/utils/supabase/client", () => ({
    createClient: () => mockSupabase,
  }));

  // Mock fetch
  global.fetch = mockFetch;

  // Mock scrollIntoView for Radix components in JSDOM
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
};

// Reset all mocks
export const resetMocks = () => {
  jest.clearAllMocks();
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
  mockRouter.forward.mockClear();
  mockRouter.refresh.mockClear();
  mockRouter.prefetch.mockClear();
  mockSupabase.auth.getUser.mockClear();
  mockSupabase.auth.getSession.mockClear();
  mockSupabase.auth.onAuthStateChange.mockClear();
  mockFetch.mockClear();
};

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add any additional options here
}

const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions
) => {
  return render(ui, { ...options });
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Common test data
export const mockAddress: any = {
  id: "1",
  street1: "123 Test St",
  street2: null,
  city: "Test City",
  state: "TS",
  zip: "12345",
  county: null,
  locationNumber: null,
  parkingLoading: null,
  name: null,
  isRestaurant: false,
  isShared: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
};

export const mockAddresses = [mockAddress];

// Helper function to create future dates for form testing
export const createFutureDate = (daysFromNow: number = 30): string => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysFromNow);
  return futureDate.toISOString().split('T')[0];
};

// Helper function to wait for async operations
export const waitForAsync = async (callback: () => void, timeout = 5000) => {
  await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay to allow async operations
  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout after ${timeout}ms`));
    }, timeout);

    const check = () => {
      try {
        callback();
        clearTimeout(timeoutId);
        resolve();
      } catch (error) {
        // If callback throws, retry after a short delay
        setTimeout(check, 50);
      }
    };

    check();
  });
}; 