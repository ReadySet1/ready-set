import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
}));

// Mock Supabase client
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

// Mock all complex components to isolate the header behavior
jest.mock('@/components/Header/MobileMenu', () => {
  return function MockMobileMenu() {
    return <div data-testid="mobile-menu">Mobile Menu</div>;
  };
});

jest.mock('@/components/Header/Logo', () => {
  return function MockLogo() {
    return <div data-testid="logo">Logo</div>;
  };
});

jest.mock('@/components/Header/menuData', () => ({
  __esModule: true,
  default: [],
}));

// Mock UserContext with different user states
const mockUseUser = jest.fn();
jest.mock('@/contexts/UserContext', () => ({
  useUser: () => mockUseUser(),
}));

// Import the component after mocks are set up
import Header from '@/components/Header';

/**
 * TODO: REA-211 - Header component tests have auth context mocking issues
 */
describe.skip('Header Component - Auth Update Fix (Key Prop)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with no-user key when user is not logged in', () => {
    mockUseUser.mockReturnValue({
      user: null,
      userRole: null,
      isLoading: false,
      session: null,
      error: null,
      refreshUserData: jest.fn(),
    });

    const { container } = render(<Header />);
    
    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
    
    // The key prop should be set to 'no-user' when no user is logged in
    // Note: React doesn't render the key as an attribute, but we can test the re-render behavior
    expect(header).toHaveClass('ud-header');
  });

  it('should render with user-id key when user is logged in', () => {
    mockUseUser.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      userRole: 'client',
      isLoading: false,
      session: { user: { id: 'user-123' } },
      error: null,
      refreshUserData: jest.fn(),
    });

    const { container } = render(<Header />);
    
    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass('ud-header');
  });

  it('should show authentication buttons when user is not logged in', () => {
    mockUseUser.mockReturnValue({
      user: null,
      userRole: null,
      isLoading: false,
      session: null,
      error: null,
      refreshUserData: jest.fn(),
    });

    render(<Header />);
    
    // Look for sign in link (case insensitive)
    const signInElement = screen.getByRole('link', { name: /sign in/i });
    expect(signInElement).toBeInTheDocument();
    expect(signInElement).toHaveAttribute('href', '/sign-in');
  });

  it('should show user info when user is logged in', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { name: 'Test User' }
    };

    mockUseUser.mockReturnValue({
      user: mockUser,
      userRole: 'client',
      isLoading: false,
      session: { user: mockUser },
      error: null,
      refreshUserData: jest.fn(),
    });

    render(<Header />);
    
    // Should show user name or email
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should not show auth buttons during loading state', () => {
    mockUseUser.mockReturnValue({
      user: null,
      userRole: null,
      isLoading: true,
      session: null,
      error: null,
      refreshUserData: jest.fn(),
    });

    render(<Header />);
    
    // Should not show sign in link during loading
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('should render different content based on authentication state changes', () => {
    // Initial render - not logged in
    mockUseUser.mockReturnValue({
      user: null,
      userRole: null,
      isLoading: false,
      session: null,
      error: null,
      refreshUserData: jest.fn(),
    });

    const { rerender } = render(<Header />);
    
    // Should show sign in
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();

    // Re-render with logged in user
    mockUseUser.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com', user_metadata: { name: 'Test User' } },
      userRole: 'client',
      isLoading: false,
      session: { user: { id: 'user-123' } },
      error: null,
      refreshUserData: jest.fn(),
    });

    rerender(<Header />);
    
    // Should now show user name instead of sign in
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should handle sign out functionality', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { name: 'Test User' }
    };

    mockUseUser.mockReturnValue({
      user: mockUser,
      userRole: 'client',
      isLoading: false,
      session: { user: mockUser },
      error: null,
      refreshUserData: jest.fn(),
    });

    render(<Header />);
    
    // Should show sign out button
    const signOutButton = screen.getByRole('button', { name: /sign out/i });
    expect(signOutButton).toBeInTheDocument();
  });

  it('should maintain header structure regardless of auth state', () => {
    mockUseUser.mockReturnValue({
      user: null,
      userRole: null,
      isLoading: false,
      session: null,
      error: null,
      refreshUserData: jest.fn(),
    });

    const { container } = render(<Header />);
    
    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass('ud-header');
    
    // Should have container div
    const containerDiv = header?.querySelector('.container');
    expect(containerDiv).toBeInTheDocument();
  });
}); 