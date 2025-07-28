import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CateringRequestForm from '@/components/CateringRequest/CateringRequestForm';
import OnDemandForm from '@/components/CateringRequest/OnDemandForm';
import CateringOrderForm from '@/components/CateringRequest/CateringOrderForm';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock the Supabase client
jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { 
          session: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com'
            }
          }
        },
        error: null,
      }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  })),
}));

// Mock the API calls
global.fetch = jest.fn();

// Mock toast
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: {
      success: jest.fn(),
      error: jest.fn(),
    },
  }),
}));

describe('Dashboard Redirect Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CateringRequestForm Redirects', () => {
    it('should redirect VENDOR users to /vendor dashboard', async () => {
      // Mock successful form submission
      const mockFormSubmit = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      global.fetch = mockFormSubmit;

      // Mock user profile API to return VENDOR type
      const mockProfileFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'VENDOR' }),
      });

      // Set up fetch to handle both form submission and profile fetch
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFormSubmit()) // Form submission
        .mockResolvedValueOnce(mockProfileFetch()); // Profile fetch

      render(<CateringRequestForm />);

      // Fill out form and submit
      const submitButton = screen.getByText('Submit Request');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/vendor');
      });
    });

    it('should redirect CLIENT users to /client dashboard', async () => {
      // Mock successful form submission
      const mockFormSubmit = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Mock user profile API to return CLIENT type
      const mockProfileFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'CLIENT' }),
      });

      // Set up fetch to handle both form submission and profile fetch
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFormSubmit()) // Form submission
        .mockResolvedValueOnce(mockProfileFetch()); // Profile fetch

      render(<CateringRequestForm />);

      // Fill out form and submit
      const submitButton = screen.getByText('Submit Request');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/client');
      });
    });

    it('should handle profile fetch errors gracefully', async () => {
      // Mock successful form submission
      const mockFormSubmit = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Mock profile fetch error
      const mockProfileFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      // Set up fetch to handle both form submission and profile fetch
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFormSubmit()) // Form submission
        .mockResolvedValueOnce(mockProfileFetch()); // Profile fetch

      render(<CateringRequestForm />);

      // Fill out form and submit
      const submitButton = screen.getByText('Submit Request');
      fireEvent.click(submitButton);

      // Should still redirect to vendor as fallback
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/vendor');
      });
    });
  });

  describe('OnDemandForm Redirects', () => {
    it('should redirect VENDOR users to /vendor dashboard', async () => {
      // Mock successful form submission
      const mockFormSubmit = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Mock user profile API to return VENDOR type
      const mockProfileFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'VENDOR' }),
      });

      // Set up fetch to handle both form submission and profile fetch
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFormSubmit()) // Form submission
        .mockResolvedValueOnce(mockProfileFetch()); // Profile fetch

      render(<OnDemandForm />);

      // Fill out form and submit
      const submitButton = screen.getByText('Submit Request');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/vendor');
      });
    });

    it('should redirect CLIENT users to /client dashboard', async () => {
      // Mock successful form submission
      const mockFormSubmit = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Mock user profile API to return CLIENT type
      const mockProfileFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'CLIENT' }),
      });

      // Set up fetch to handle both form submission and profile fetch
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFormSubmit()) // Form submission
        .mockResolvedValueOnce(mockProfileFetch()); // Profile fetch

      render(<OnDemandForm />);

      // Fill out form and submit
      const submitButton = screen.getByText('Submit Request');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/client');
      });
    });
  });

  describe('CateringOrderForm Redirects', () => {
    it('should redirect VENDOR users to /vendor dashboard', async () => {
      // Mock successful form submission
      const mockFormSubmit = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Mock user profile API to return VENDOR type
      const mockProfileFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'VENDOR' }),
      });

      // Set up fetch to handle both form submission and profile fetch
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFormSubmit()) // Form submission
        .mockResolvedValueOnce(mockProfileFetch()); // Profile fetch

      render(<CateringOrderForm />);

      // Fill out form and submit
      const submitButton = screen.getByText('Submit Order');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/vendor');
      });
    });

    it('should redirect CLIENT users to /client dashboard', async () => {
      // Mock successful form submission
      const mockFormSubmit = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Mock user profile API to return CLIENT type
      const mockProfileFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'CLIENT' }),
      });

      // Set up fetch to handle both form submission and profile fetch
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFormSubmit()) // Form submission
        .mockResolvedValueOnce(mockProfileFetch()); // Profile fetch

      render(<CateringOrderForm />);

      // Fill out form and submit
      const submitButton = screen.getByText('Submit Order');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/client');
      });
    });
  });

  describe('API Endpoint Tests', () => {
    it('should call correct profile API endpoint', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'CLIENT' }),
      });
      global.fetch = mockFetch;

      render(<CateringRequestForm />);

      // Submit form to trigger profile fetch
      const submitButton = screen.getByText('Submit Request');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/users/profile?email=test%40example.com',
          expect.any(Object)
        );
      });
    });
  });
}); 