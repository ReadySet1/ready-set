/**
 * Page Testing Utilities
 *
 * Comprehensive utilities for testing Next.js App Router page components.
 * Provides pre-configured wrappers with all necessary providers and mocks.
 *
 * @example
 * ```tsx
 * import { renderPage, mockAuthenticatedUser } from '@/__tests__/utils/page-test-utils';
 *
 * describe('DashboardPage', () => {
 *   it('renders for authenticated admin', async () => {
 *     const { getByText } = renderPage(<DashboardPage />, {
 *       user: mockAuthenticatedUser({ role: UserType.ADMIN }),
 *     });
 *     expect(getByText('Dashboard')).toBeInTheDocument();
 *   });
 * });
 * ```
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Session, User } from '@supabase/supabase-js';
import { UserType } from '@/types/user';
import { UserContext } from '@/contexts/UserContext';
import { AuthState, EnhancedSession } from '@/types/auth';

// Re-export common testing utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// ============================================================================
// Mock Navigation
// ============================================================================

/**
 * Mock Next.js App Router navigation functions
 */
export const mockNavigation = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn().mockResolvedValue(undefined),
};

/**
 * Mock Next.js useSearchParams hook return value
 */
export const mockSearchParams = {
  get: jest.fn().mockReturnValue(null),
  getAll: jest.fn().mockReturnValue([]),
  has: jest.fn().mockReturnValue(false),
  keys: jest.fn().mockReturnValue([].values()),
  values: jest.fn().mockReturnValue([].values()),
  entries: jest.fn().mockReturnValue([].entries()),
  forEach: jest.fn(),
  toString: jest.fn().mockReturnValue(''),
};

/**
 * Mock pathname value
 */
export let mockPathname = '/';

/**
 * Mock params value
 */
export let mockParams: Record<string, string | string[]> = {};

/**
 * Set mock pathname for tests
 */
export const setMockPathname = (pathname: string) => {
  mockPathname = pathname;
};

/**
 * Set mock params for tests
 */
export const setMockParams = (params: Record<string, string | string[]>) => {
  mockParams = params;
};

/**
 * Set mock search params for tests
 */
export const setMockSearchParams = (params: Record<string, string>) => {
  mockSearchParams.get.mockImplementation((key: string) => params[key] ?? null);
  mockSearchParams.has.mockImplementation((key: string) => key in params);
  mockSearchParams.getAll.mockImplementation((key: string) =>
    params[key] ? [params[key]] : []
  );
  mockSearchParams.toString.mockReturnValue(
    new URLSearchParams(params).toString()
  );
};

/**
 * Reset all navigation mocks
 */
export const resetNavigationMocks = () => {
  mockNavigation.push.mockClear();
  mockNavigation.replace.mockClear();
  mockNavigation.back.mockClear();
  mockNavigation.forward.mockClear();
  mockNavigation.refresh.mockClear();
  mockNavigation.prefetch.mockClear();
  mockSearchParams.get.mockReturnValue(null);
  mockSearchParams.has.mockReturnValue(false);
  mockSearchParams.getAll.mockReturnValue([]);
  mockSearchParams.toString.mockReturnValue('');
  mockPathname = '/';
  mockParams = {};
};

// ============================================================================
// Mock User & Session
// ============================================================================

/**
 * Create a mock Supabase User object
 */
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  phone: '',
  app_metadata: {},
  user_metadata: { name: 'Test User' },
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
  confirmed_at: '2024-01-01T00:00:00.000Z',
  email_confirmed_at: '2024-01-01T00:00:00.000Z',
  last_sign_in_at: new Date().toISOString(),
  role: 'authenticated',
  updated_at: new Date().toISOString(),
  ...overrides,
});

/**
 * Create a mock Supabase Session object
 */
export const createMockSession = (overrides: Partial<Session> = {}): Session => ({
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: createMockUser(),
  ...overrides,
});

/**
 * Create a mock EnhancedSession object
 */
export const createMockEnhancedSession = (
  overrides: Partial<EnhancedSession> = {}
): EnhancedSession => ({
  id: 'mock-session-id',
  userId: 'test-user-id',
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: Date.now() + 3600000,
  createdAt: Date.now(),
  lastActivity: Date.now(),
  fingerprint: {
    userAgent: 'test-agent',
    language: 'en-US',
    timezone: 'America/New_York',
    screen: '1920x1080',
    hash: 'mock-fingerprint-hash',
  },
  deviceInfo: {
    browser: 'Chrome',
    os: 'macOS',
    device: 'Desktop',
  },
  ...overrides,
});

/**
 * Create a mock AuthState object
 */
export const createMockAuthState = (
  overrides: Partial<AuthState> = {}
): AuthState => ({
  user: createMockUser(),
  session: createMockSession(),
  enhancedSession: createMockEnhancedSession(),
  userRole: UserType.CLIENT,
  isLoading: false,
  isAuthenticating: false,
  error: null,
  lastActivity: Date.now(),
  sessionExpiresAt: Date.now() + 3600000,
  needsRefresh: false,
  suspiciousActivity: false,
  ...overrides,
});

// ============================================================================
// User Context Types & Mocks
// ============================================================================

export interface MockUserContextValue {
  session: Session | null;
  user: User | null;
  userRole: UserType | null;
  enhancedSession: EnhancedSession | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticating: boolean;
  authState: AuthState;
  authProgress: {
    step: 'idle' | 'connecting' | 'authenticating' | 'fetching_profile' | 'redirecting' | 'complete';
    message: string;
  };
  refreshUserData: jest.Mock;
  refreshToken: jest.Mock;
  logout: jest.Mock;
  clearAuthError: jest.Mock;
  setAuthProgress: jest.Mock;
  getActiveSessions: jest.Mock;
  revokeSession: jest.Mock;
  updateActivity: jest.Mock;
  updateProfileName: jest.Mock;
}

/**
 * Create a full mock UserContext value
 */
export const createMockUserContext = (
  overrides: Partial<MockUserContextValue> = {}
): MockUserContextValue => {
  const user = overrides.user !== undefined ? overrides.user : createMockUser();
  const session = overrides.session !== undefined ? overrides.session : createMockSession();
  const userRole = overrides.userRole !== undefined ? overrides.userRole : UserType.CLIENT;

  return {
    session,
    user,
    userRole,
    enhancedSession: overrides.enhancedSession ?? createMockEnhancedSession(),
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    isAuthenticating: overrides.isAuthenticating ?? false,
    authState: overrides.authState ?? createMockAuthState({ user, session, userRole }),
    authProgress: overrides.authProgress ?? { step: 'idle', message: '' },
    refreshUserData: jest.fn().mockResolvedValue(undefined),
    refreshToken: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    clearAuthError: jest.fn(),
    setAuthProgress: jest.fn(),
    getActiveSessions: jest.fn().mockResolvedValue([]),
    revokeSession: jest.fn().mockResolvedValue(undefined),
    updateActivity: jest.fn(),
    updateProfileName: jest.fn(),
    ...overrides,
  };
};

/**
 * Pre-configured mock for authenticated user with specific role
 */
export const mockAuthenticatedUser = (options: {
  role?: UserType;
  email?: string;
  name?: string;
  userId?: string;
} = {}): MockUserContextValue => {
  const { role = UserType.CLIENT, email = 'test@example.com', name = 'Test User', userId = 'test-user-id' } = options;

  const user = createMockUser({ id: userId, email, user_metadata: { name } });
  const session = createMockSession({ user });

  return createMockUserContext({
    user,
    session,
    userRole: role,
    authState: createMockAuthState({ user, session, userRole: role }),
  });
};

/**
 * Pre-configured mock for unauthenticated user
 */
export const mockUnauthenticatedUser = (): MockUserContextValue => createMockUserContext({
  user: null,
  session: null,
  userRole: null,
  enhancedSession: null,
  authState: createMockAuthState({
    user: null,
    session: null,
    enhancedSession: null,
    userRole: null,
  }),
});

/**
 * Pre-configured mock for loading state
 */
export const mockLoadingUser = (): MockUserContextValue => createMockUserContext({
  user: null,
  session: null,
  userRole: null,
  isLoading: true,
  authState: createMockAuthState({
    user: null,
    session: null,
    userRole: null,
    isLoading: true,
  }),
});

// ============================================================================
// Query Client
// ============================================================================

/**
 * Create a QueryClient configured for testing
 */
export const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: console.log,
      warn: console.warn,
      error: () => {}, // Suppress error logging in tests
    },
  });

// ============================================================================
// Provider Wrapper
// ============================================================================

export interface PageTestWrapperProps {
  children: ReactNode;
  userContext?: MockUserContextValue;
  queryClient?: QueryClient;
}

/**
 * Wrapper component that provides all necessary providers for page testing
 */
export const PageTestWrapper: React.FC<PageTestWrapperProps> = ({
  children,
  userContext = createMockUserContext(),
  queryClient = createTestQueryClient(),
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <UserContext.Provider value={userContext}>
        {children}
      </UserContext.Provider>
    </QueryClientProvider>
  );
};

// ============================================================================
// Render Functions
// ============================================================================

export interface PageRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  user?: MockUserContextValue;
  queryClient?: QueryClient;
  pathname?: string;
  params?: Record<string, string | string[]>;
  searchParams?: Record<string, string>;
}

export interface PageRenderResult extends RenderResult {
  user: MockUserContextValue;
  queryClient: QueryClient;
  navigation: typeof mockNavigation;
}

/**
 * Render a page component with all necessary providers and mocks
 *
 * @example
 * ```tsx
 * const { getByText, user, navigation } = renderPage(<DashboardPage />, {
 *   user: mockAuthenticatedUser({ role: UserType.ADMIN }),
 *   pathname: '/admin/dashboard',
 * });
 *
 * // Assert content
 * expect(getByText('Welcome')).toBeInTheDocument();
 *
 * // Check navigation was called
 * expect(navigation.push).toHaveBeenCalledWith('/admin/orders');
 * ```
 */
export const renderPage = (
  ui: ReactElement,
  options: PageRenderOptions = {}
): PageRenderResult => {
  const {
    user = createMockUserContext(),
    queryClient = createTestQueryClient(),
    pathname,
    params,
    searchParams,
    ...renderOptions
  } = options;

  // Set up navigation mocks if provided
  if (pathname) {
    setMockPathname(pathname);
  }
  if (params) {
    setMockParams(params);
  }
  if (searchParams) {
    setMockSearchParams(searchParams);
  }

  const wrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
    <PageTestWrapper userContext={user} queryClient={queryClient}>
      {children}
    </PageTestWrapper>
  );

  const result = render(ui, { wrapper, ...renderOptions });

  return {
    ...result,
    user,
    queryClient,
    navigation: mockNavigation,
  };
};

/**
 * Render a page component for an authenticated user
 * Convenience wrapper around renderPage with pre-configured auth
 */
export const renderAuthenticatedPage = (
  ui: ReactElement,
  options: Omit<PageRenderOptions, 'user'> & {
    role?: UserType;
    email?: string;
    name?: string;
    userId?: string;
  } = {}
): PageRenderResult => {
  const { role, email, name, userId, ...restOptions } = options;
  return renderPage(ui, {
    ...restOptions,
    user: mockAuthenticatedUser({ role, email, name, userId }),
  });
};

/**
 * Render a page component for an unauthenticated user
 */
export const renderUnauthenticatedPage = (
  ui: ReactElement,
  options: Omit<PageRenderOptions, 'user'> = {}
): PageRenderResult => {
  return renderPage(ui, {
    ...options,
    user: mockUnauthenticatedUser(),
  });
};

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Wait for loading state to complete
 */
export const waitForLoadingToComplete = async (
  queryClient: QueryClient
): Promise<void> => {
  await queryClient.cancelQueries();
  // Small delay to allow React to process updates
  await new Promise((resolve) => setTimeout(resolve, 0));
};

/**
 * Create a mock API response for fetch calls
 */
export const createMockApiResponse = <T,>(
  data: T,
  options: { status?: number; ok?: boolean } = {}
): Response => {
  const { status = 200, ok = true } = options;
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    headers: new Headers(),
    redirected: false,
    statusText: ok ? 'OK' : 'Error',
    type: 'basic',
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
  } as unknown as Response;
};

/**
 * Create a mock API error response
 */
export const createMockApiError = (
  message: string,
  status: number = 400
): Response => {
  return createMockApiResponse({ error: message }, { status, ok: false });
};

/**
 * Setup fetch mock to return specific responses
 */
export const setupFetchMock = (responses: Record<string, unknown>) => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const urlPath = new URL(url, 'http://localhost').pathname;
    const responseData = responses[urlPath];

    if (responseData !== undefined) {
      return Promise.resolve(createMockApiResponse(responseData));
    }

    return Promise.resolve(createMockApiError('Not found', 404));
  });
};

/**
 * Reset fetch mock
 */
export const resetFetchMock = () => {
  if (jest.isMockFunction(global.fetch)) {
    (global.fetch as jest.Mock).mockReset();
  }
};

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Reset all mocks - call in afterEach
 */
export const resetAllPageMocks = () => {
  resetNavigationMocks();
  resetFetchMock();
  jest.clearAllMocks();
};
