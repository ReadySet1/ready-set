// src/__tests__/integration/enhanced-auth-flow.test.tsx
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@/__tests__/utils/test-utils';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import ProfilePage from '@/app/(site)/profile/page';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock UserContext
vi.mock('@/contexts/UserContext', () => ({
  useUser: vi.fn(),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: vi.fn(),
  Toaster: vi.fn(() => null),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
};

// Mock user context
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

describe('Enhanced Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useUser as any).mockReturnValue(mockUserContext);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading States', () => {
    it('should show loading skeleton when UserContext is not initialized', async () => {
      (useUser as any).mockReturnValue({
        ...mockUserContext,
        authState: {
          ...mockUserContext.authState,
          isInitialized: false,
        },
      });

      render(<ProfilePage />);
      
      // Should show loading skeleton
      expect(screen.getByTestId('profile-skeleton')).toBeInTheDocument();
    });

    it('should show loading skeleton when auth check is not complete', async () => {
      render(<ProfilePage />);
      
      // Should show loading skeleton initially
      expect(screen.getByTestId('profile-skeleton')).toBeInTheDocument();
    });
  });

  describe('Authenticated Profile Fetch', () => {
    it('should fetch and display profile data successfully', async () => {
      const mockProfileData = {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        type: 'CLIENT',
        status: 'active',
        contactNumber: '123-456-7890',
        companyName: 'Test Company',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfileData,
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/profile', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        });
      });

      await waitFor(() => {
        expect(screen.getAllByText('Test User')).toHaveLength(2); // Header and form field
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getAllByText('CLIENT')).toHaveLength(2); // Header badges
      });
    });
  });

  describe('UserContext Error Handling', () => {
    it('should handle UserContext errors gracefully', async () => {
      const mockError = {
        type: 'INITIALIZATION_FAILED',
        message: 'Authentication setup failed',
        retryable: true,
        timestamp: new Date(),
      };

      (useUser as any).mockReturnValue({
        ...mockUserContext,
        error: mockError,
        authState: {
          ...mockUserContext.authState,
          error: mockError,
        },
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile Error')).toBeInTheDocument();
        expect(screen.getByText('Authentication setup failed')).toBeInTheDocument();
        expect(screen.getByText('Retry Auth')).toBeInTheDocument();
      });
    });

    it('should handle non-retryable UserContext errors', async () => {
      const mockError = {
        type: 'USER_NOT_FOUND',
        message: 'User not found',
        retryable: false,
        timestamp: new Date(),
      };

      (useUser as any).mockReturnValue({
        ...mockUserContext,
        error: mockError,
        authState: {
          ...mockUserContext.authState,
          error: mockError,
        },
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile Error')).toBeInTheDocument();
        expect(screen.getByText('User not found')).toBeInTheDocument();
        expect(screen.queryByText('Retry Auth')).not.toBeInTheDocument();
      });
    });
  });

  describe('API Error Handling', () => {
    it('should handle 401 Unauthorized from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile Error')).toBeInTheDocument();
        expect(screen.getByText('You are not authorized to view this profile.')).toBeInTheDocument();
      });
    });

    it('should handle 404 Profile Not Found from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile Error')).toBeInTheDocument();
        expect(screen.getByText('Profile not found. Please contact support.')).toBeInTheDocument();
      });
    });

    it('should handle network errors with retry logic', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      render(<ProfilePage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Should retry after 2 seconds
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      }, { timeout: 3000 });
    });
  });

  describe('Profile Not Found State', () => {
    it('should show profile not found state when no profile data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile Not Found')).toBeInTheDocument();
        expect(screen.getByText('We couldn\'t load your profile information. This might be a temporary issue.')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
        expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Profile Display', () => {
    it('should display profile information correctly', async () => {
      const mockProfileData = {
        id: 'test-user-id',
        name: 'John Doe',
        email: 'john@example.com',
        type: 'CLIENT',
        status: 'active',
        contactNumber: '555-123-4567',
        companyName: 'Acme Corp',
        street1: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfileData,
      });

      render(<ProfilePage />);

      await waitFor(() => {
        // Use getAllByText for elements that appear multiple times
        expect(screen.getAllByText('John Doe')).toHaveLength(2); // Header and form field
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
        expect(screen.getByText('555-123-4567')).toBeInTheDocument();
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        expect(screen.getByText('123 Main St')).toBeInTheDocument();
        expect(screen.getByText('Anytown')).toBeInTheDocument();
        expect(screen.getByText('CA')).toBeInTheDocument();
        expect(screen.getByText('12345')).toBeInTheDocument();
      });
    });

    it('should display last fetch time when available', async () => {
      const mockProfileData = {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        type: 'CLIENT',
        status: 'active',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfileData,
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      });
    });
  });

  describe('Edit Mode', () => {
    it('should enter edit mode when edit button is clicked', async () => {
      const mockProfileData = {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        type: 'CLIENT',
        status: 'active',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfileData,
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit Profile'));

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });

    it('should handle input changes in edit mode', async () => {
      const mockProfileData = {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        type: 'CLIENT',
        status: 'active',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfileData,
      });

      render(<ProfilePage />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit Profile'));
      });

      const nameInput = screen.getByDisplayValue('Test User');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      expect(nameInput).toHaveValue('Updated Name');
    });
  });

  describe('Redirects', () => {
    it('should redirect to sign-in when no user is authenticated', async () => {
      (useUser as any).mockReturnValue({
        ...mockUserContext,
        user: null,
        authState: {
          ...mockUserContext.authState,
          isAuthenticated: false,
        },
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
      }, { timeout: 1000 });
    });
  });

  describe('Performance Timing', () => {
    it('should track performance metrics', async () => {
      const startTime = Date.now();
      
      const mockProfileData = {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        type: 'CLIENT',
        status: 'active',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfileData,
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getAllByText('Test User')).toHaveLength(2); // Header and form field
      });

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // Should load within reasonable time (less than 5 seconds)
      expect(loadTime).toBeLessThan(5000);
    });
  });

  describe('Error Recovery', () => {
    it('should allow retry after network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test User' }),
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getAllByText('Test User')).toHaveLength(2); // Header and form field
      });
    });

    it('should allow retry after UserContext error', async () => {
      const mockError = {
        type: 'INITIALIZATION_FAILED',
        message: 'Authentication setup failed',
        retryable: true,
        timestamp: new Date(),
      };

      (useUser as any).mockReturnValue({
        ...mockUserContext,
        error: mockError,
        authState: {
          ...mockUserContext.authState,
          error: mockError,
        },
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Retry Auth')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry Auth'));

      await waitFor(() => {
        expect(mockUserContext.retryAuth).toHaveBeenCalled();
      });
    });
  });
}); 