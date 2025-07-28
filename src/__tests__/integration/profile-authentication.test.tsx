import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import ProfilePage from '@/app/(site)/profile/page';
import { createClient } from '@/utils/supabase/client';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/contexts/UserContext', () => ({
  useUser: jest.fn(),
}));

jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

// Mock fetch globally
global.fetch = jest.fn();

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(),
    refreshSession: jest.fn(),
    getUser: jest.fn(),
  },
};

describe('Profile Page Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  describe('Authentication Flow', () => {
    it('should redirect to sign-in when user is not authenticated', async () => {
      (useUser as jest.Mock).mockReturnValue({
        user: null,
        session: null,
        isLoading: false,
        error: null,
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
      });
    });

    it('should redirect to sign-in when user is loading but then becomes null', async () => {
      const { rerender } = render(
        <ProfilePage />
      );

      // Initially loading
      (useUser as jest.Mock).mockReturnValue({
        user: null,
        session: null,
        isLoading: true,
        error: null,
      });

      rerender(<ProfilePage />);

      // Then not loading and no user
      (useUser as jest.Mock).mockReturnValue({
        user: null,
        session: null,
        isLoading: false,
        error: null,
      });

      rerender(<ProfilePage />);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
      });
    });

    it('should load profile when user is authenticated', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
      };

      const mockSession = {
        access_token: 'test-token',
        refresh_token: 'test-refresh-token',
      };

      (useUser as jest.Mock).mockReturnValue({
        user: mockUser,
        session: mockSession,
        isLoading: false,
        error: null,
      });

      // Mock successful session and profile fetch
      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@example.com',
            type: 'client',
            status: 'active',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(mockSupabaseClient.auth.getSession).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/users/test-user-id',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-token',
            }),
          })
        );
      });
    });

    it('should handle session refresh when initial session is null', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
      };

      const mockRefreshedSession = {
        access_token: 'refreshed-token',
        refresh_token: 'refreshed-refresh-token',
      };

      (useUser as jest.Mock).mockReturnValue({
        user: mockUser,
        session: null,
        isLoading: false,
        error: null,
      });

      // Mock initial session as null, then successful refresh
      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      (mockSupabaseClient.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: mockRefreshedSession },
        error: null,
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@example.com',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/users/test-user-id',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer refreshed-token',
            }),
          })
        );
      });
    });

    it('should redirect to sign-in when session refresh fails', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
      };

      (useUser as jest.Mock).mockReturnValue({
        user: mockUser,
        session: null,
        isLoading: false,
        error: null,
      });

      // Mock initial session as null, then failed refresh
      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      (mockSupabaseClient.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'Refresh failed' },
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
      };

      const mockSession = {
        access_token: 'test-token',
      };

      (useUser as jest.Mock).mockReturnValue({
        user: mockUser,
        session: mockSession,
        isLoading: false,
        error: null,
      });

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Mock API error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });

  describe('Profile Data Loading', () => {
    it('should display loading skeleton while fetching profile', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
      };

      (useUser as jest.Mock).mockReturnValue({
        user: mockUser,
        session: null,
        isLoading: false,
        error: null,
      });

      // Mock slow API response
      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      });

      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<ProfilePage />);

      // Should show loading state initially
      expect(screen.getByTestId('profile-skeleton')).toBeInTheDocument();
    });

    it('should display profile data when successfully loaded', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
      };

      const mockProfile = {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        type: 'client',
        status: 'active',
        contact_number: '123-456-7890',
        company_name: 'Test Company',
        street1: '123 Test St',
        city: 'Test City',
        state: 'CA',
        zip: '12345',
      };

      (useUser as jest.Mock).mockReturnValue({
        user: mockUser,
        session: null,
        isLoading: false,
        error: null,
      });

      (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProfile,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('123-456-7890')).toBeInTheDocument();
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });
    });
  });
}); 