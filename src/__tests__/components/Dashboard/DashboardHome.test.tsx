import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useRouter } from 'next/navigation';
import { ModernDashboardHome } from '@/components/Dashboard/DashboardHome';
import { useUser } from '@/contexts/UserContext';
import { useDashboardMetrics } from '@/components/Dashboard/DashboardMetrics';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock the UserContext
vi.mock('@/contexts/UserContext', () => ({
  useUser: vi.fn(),
}));

// Mock the DashboardMetrics hook
vi.mock('@/components/Dashboard/DashboardMetrics', () => ({
  useDashboardMetrics: vi.fn(),
}));

// Mock Supabase client
vi.mock('@/utils/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
  })),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('DashboardHome Component', () => {
  const mockRouter = {
    replace: vi.fn(),
    push: vi.fn(),
  };

  const mockUser = {
    id: 'test-user-id',
    email: 'admin@test.com',
    user_metadata: {
      full_name: 'Test Admin',
    },
  };

  const mockSession = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    user: mockUser,
  };

  const mockMetrics = {
    totalRevenue: 1000,
    deliveriesRequests: 50,
    salesTotal: 25,
    totalVendors: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useDashboardMetrics as any).mockReturnValue({
      metrics: mockMetrics,
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Authentication Flow', () => {
    it('should redirect to login when user is not authenticated', async () => {
      (useUser as any).mockReturnValue({
        user: null,
        isLoading: false,
        error: null,
      });

      render(<ModernDashboardHome />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/login');
      });
    });

    it('should redirect to login when user loading is complete and no user exists', async () => {
      (useUser as any).mockReturnValue({
        user: null,
        isLoading: false,
        error: null,
      });

      render(<ModernDashboardHome />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/login');
      });
    });

    it('should not redirect when user is still loading', () => {
      (useUser as any).mockReturnValue({
        user: null,
        isLoading: true,
        error: null,
      });

      render(<ModernDashboardHome />);

      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('should not redirect when user is authenticated', async () => {
      (useUser as any).mockReturnValue({
        user: mockUser,
        isLoading: false,
        error: null,
      });

      // Mock successful API responses
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ orders: [], totalPages: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: [], totalPages: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ applications: [], totalCount: 0, totalPages: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

      render(<ModernDashboardHome />);

      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });

  describe('Data Fetching', () => {
    beforeEach(() => {
      (useUser as any).mockReturnValue({
        user: mockUser,
        isLoading: false,
        error: null,
      });
    });

    it('should fetch dashboard data when user is authenticated', async () => {
      const mockOrdersResponse = {
        orders: [
          {
            id: '1',
            orderNumber: 'ORD-001',
            status: 'ACTIVE',
            user: { name: 'Test User' },
            createdAt: new Date().toISOString(),
          },
        ],
        totalPages: 1,
      };

      const mockUsersResponse = {
        users: [
          {
            id: '1',
            name: 'Test User',
            email: 'test@example.com',
            type: 'CLIENT',
          },
        ],
        totalPages: 1,
      };

      const mockApplicationsResponse = {
        applications: [
          {
            id: '1',
            firstName: 'John',
            lastName: 'Doe',
            position: 'Driver',
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          },
        ],
        totalCount: 1,
        totalPages: 1,
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOrdersResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUsersResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApplicationsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ name: 'Test Admin' }),
        });

      render(<ModernDashboardHome />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/orders/catering-orders?recentOnly=true',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer mock-access-token',
            }),
          })
        );
      });
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: () => Promise.resolve('Unauthorized'),
        });

      render(<ModernDashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Error Loading Dashboard/)).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<ModernDashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Error Loading Dashboard/)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state when user is loading', () => {
      (useUser as any).mockReturnValue({
        user: null,
        isLoading: true,
        error: null,
      });

      render(<ModernDashboardHome />);

      // Should show loading component
      expect(screen.getByText(/Loading dashboard data/)).toBeInTheDocument();
    });

    it('should show loading state when metrics are loading', () => {
      (useUser as any).mockReturnValue({
        user: mockUser,
        isLoading: false,
        error: null,
      });

      (useDashboardMetrics as any).mockReturnValue({
        metrics: mockMetrics,
        loading: true,
        error: null,
      });

      render(<ModernDashboardHome />);

      expect(screen.getByText(/Loading dashboard data/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display user context errors', () => {
      (useUser as any).mockReturnValue({
        user: null,
        isLoading: false,
        error: 'Authentication failed',
      });

      render(<ModernDashboardHome />);

      expect(screen.getByText(/Authentication failed/)).toBeInTheDocument();
    });

    it('should display metrics errors', () => {
      (useUser as any).mockReturnValue({
        user: mockUser,
        isLoading: false,
        error: null,
      });

      (useDashboardMetrics as any).mockReturnValue({
        metrics: mockMetrics,
        loading: false,
        error: 'Failed to load metrics',
      });

      render(<ModernDashboardHome />);

      expect(screen.getByText(/Failed to load metrics/)).toBeInTheDocument();
    });

    it('should show retry button when there is an error', async () => {
      (useUser as any).mockReturnValue({
        user: mockUser,
        isLoading: false,
        error: null,
      });

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<ModernDashboardHome />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });
  });

  describe('Session Validation', () => {
    it('should handle missing session gracefully', async () => {
      (useUser as any).mockReturnValue({
        user: mockUser,
        isLoading: false,
        error: null,
      });

      // Mock Supabase to return no session
      const { createClient } = require('@/utils/supabase/client');
      const mockSupabase = createClient();
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      render(<ModernDashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Authentication required: No active session/)).toBeInTheDocument();
      });
    });

    it('should handle missing access token gracefully', async () => {
      (useUser as any).mockReturnValue({
        user: mockUser,
        isLoading: false,
        error: null,
      });

      // Mock Supabase to return session without access token
      const { createClient } = require('@/utils/supabase/client');
      const mockSupabase = createClient();
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { 
          session: { 
            ...mockSession, 
            access_token: null 
          } 
        },
        error: null,
      });

      render(<ModernDashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Authentication required: No access token in session/)).toBeInTheDocument();
      });
    });
  });
}); 