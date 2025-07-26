import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useRouter } from 'next/navigation';
import { ModernDashboardHome } from '@/components/Dashboard/DashboardHome';
import { useUser } from '@/contexts/UserContext';

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
  useDashboardMetrics: vi.fn(() => ({
    metrics: {
      totalRevenue: 1000,
      deliveriesRequests: 50,
      salesTotal: 25,
      totalVendors: 10,
    },
    loading: false,
    error: null,
  })),
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

describe('Dashboard Authentication Flow', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
  });

  describe('Authentication Redirect', () => {
    it('should redirect unauthenticated users to login', async () => {
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

    it('should not redirect when user is authenticated', () => {
      (useUser as any).mockReturnValue({
        user: mockUser,
        isLoading: false,
        error: null,
      });

      render(<ModernDashboardHome />);

      expect(mockRouter.replace).not.toHaveBeenCalled();
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
      const { useDashboardMetrics } = require('@/components/Dashboard/DashboardMetrics');
      (useDashboardMetrics as any).mockReturnValue({
        metrics: {
          totalRevenue: 1000,
          deliveriesRequests: 50,
          salesTotal: 25,
          totalVendors: 10,
        },
        loading: false,
        error: 'Failed to load metrics',
      });

      (useUser as any).mockReturnValue({
        user: mockUser,
        isLoading: false,
        error: null,
      });

      render(<ModernDashboardHome />);

      expect(screen.getByText(/Failed to load metrics/)).toBeInTheDocument();
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

      expect(screen.getByText(/Loading dashboard data/)).toBeInTheDocument();
    });

    it('should show loading state when metrics are loading', () => {
      const { useDashboardMetrics } = require('@/components/Dashboard/DashboardMetrics');
      (useDashboardMetrics as any).mockReturnValue({
        metrics: {
          totalRevenue: 1000,
          deliveriesRequests: 50,
          salesTotal: 25,
          totalVendors: 10,
        },
        loading: true,
        error: null,
      });

      (useUser as any).mockReturnValue({
        user: mockUser,
        isLoading: false,
        error: null,
      });

      render(<ModernDashboardHome />);

      expect(screen.getByText(/Loading dashboard data/)).toBeInTheDocument();
    });
  });
}); 