import { renderHook, waitFor, act } from '@testing-library/react';
// Test imports handled by Jest globals
import { useUserForm } from '../useUserForm';
import { UserFormValues } from '../../types';
import toast from 'react-hot-toast';

// Mock dependencies
jest.mock('react-hot-toast', () => ({
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null,
      }),
    },
  })),
}));

jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    session: { access_token: 'mock-token' },
  }),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useUserForm', () => {
  const mockUserId = 'test-user-id';
  const mockFetchUser = jest.fn();
  const mockOnSaveSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue('true'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockUserData: UserFormValues = {
    id: mockUserId,
    displayName: 'John Doe',
    name: 'John Doe',
    contact_name: 'John Contact',
    email: 'john@example.com',
    contact_number: '123-456-7890',
    type: 'vendor',
    status: 'active',
    company_name: 'Test Company',
    street1: '123 Test St',
    city: 'Test City',
    state: 'TS',
    zip: '12345',
    countiesServed: ['Alameda', 'San Francisco'],
    counties: [],
    timeNeeded: ['Lunch', 'Dinner'],
    cateringBrokerage: ['Grubhub'],
    provisions: ['Utensils'],
    headCount: 50,
    frequency: '1-5 per week',
    website: 'https://test.com',
    location_number: '1',
    parking_loading: 'Loading dock',
    sideNotes: 'Test notes',
  };

  describe('Field mapping for vendors and clients - THE MAIN FIX', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'User updated successfully' }),
      });
    });

    it('should update both name and contact_name fields for vendors', async () => {
      mockFetchUser.mockResolvedValue({ ...mockUserData, type: 'vendor' });

      const { result } = renderHook(() =>
        useUserForm(mockUserId, mockFetchUser)
      );

      await waitFor(() => {
        expect(result.current.watchedValues.type).toBe('vendor');
      });

      const formData = {
        ...mockUserData,
        displayName: 'Updated Vendor Name',
        type: 'vendor' as const,
      };

      await act(async () => {
        await result.current.onSubmit(formData);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/users/${mockUserId}`,
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"name":"Updated Vendor Name"'),
        })
      );

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/users/${mockUserId}`,
        expect.objectContaining({
          body: expect.stringContaining('"contact_name":"Updated Vendor Name"'),
        })
      );
    });

    it('should update both name and contact_name fields for clients', async () => {
      mockFetchUser.mockResolvedValue({ ...mockUserData, type: 'client' });

      const { result } = renderHook(() =>
        useUserForm(mockUserId, mockFetchUser)
      );

      await waitFor(() => {
        expect(result.current.watchedValues.type).toBe('client');
      });

      const formData = {
        ...mockUserData,
        displayName: 'Updated Client Name',
        type: 'client' as const,
      };

      await act(async () => {
        await result.current.onSubmit(formData);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/users/${mockUserId}`,
        expect.objectContaining({
          body: expect.stringContaining('"name":"Updated Client Name"'),
        })
      );

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/users/${mockUserId}`,
        expect.objectContaining({
          body: expect.stringContaining('"contact_name":"Updated Client Name"'),
        })
      );
    });
  });

  describe('onSaveSuccess callback behavior', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'User updated successfully' }),
      });
      mockFetchUser.mockResolvedValue(mockUserData);
    });

    it('should call onSaveSuccess callback after successful save', async () => {
      const { result } = renderHook(() =>
        useUserForm(mockUserId, mockFetchUser, mockOnSaveSuccess)
      );

      await waitFor(() => {
        expect(result.current.watchedValues.displayName).toBe('John Doe');
      });

      await act(async () => {
        await result.current.onSubmit(mockUserData);
      });

      // Wait for the timeout in the callback
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      });

      expect(mockOnSaveSuccess).toHaveBeenCalled();
    });

    it('should not call onSaveSuccess when callback is not provided', async () => {
      const { result } = renderHook(() =>
        useUserForm(mockUserId, mockFetchUser) // No callback provided
      );

      await waitFor(() => {
        expect(result.current.watchedValues.displayName).toBe('John Doe');
      });

      await act(async () => {
        await result.current.onSubmit(mockUserData);
      });

      expect(mockOnSaveSuccess).not.toHaveBeenCalled();
    });
  });
});
