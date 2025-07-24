// src/__tests__/utils/test-utils.tsx
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { UserProvider } from '@/contexts/UserContext';

// Mock UserContext for tests
const mockUserContext = {
  user: {
    id: "test-user-id",
    email: "test@example.com",
  },
  isLoading: false,
  error: null,
  refreshUserData: vi.fn(),
  retryAuth: vi.fn(),
  clearError: vi.fn(),
  authState: {
    isInitialized: true,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    retryCount: 0,
    lastAuthCheck: new Date(),
  },
  profileState: {
    data: null,
    isLoading: false,
    error: null,
    lastFetched: null,
    retryCount: 0,
  },
  getDashboardPath: vi.fn(() => '/client'),
  getOrderDetailPath: vi.fn((orderNumber: string) => `/orders/${orderNumber}`),
};

// Custom render function that wraps components in UserProvider
const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    return (
      <UserProvider>
        {children}
      </UserProvider>
    );
  };

  return render(ui, { wrapper: AllTheProviders, ...options });
};

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Export mock context for use in tests
export { mockUserContext }; 