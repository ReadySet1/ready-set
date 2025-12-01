import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useUserForm } from '../useUserForm';
import toast from 'react-hot-toast';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

// Mock the UserContext
jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    session: {
      access_token: 'mock-token',
      user: { id: 'user-1' }
    }
  })
}));

// Mock Supabase client
jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } }
      })
    }
  }))
}));

// Mock fetch
global.fetch = jest.fn();

/**
 * TODO: REA-211 - useUserForm hook tests have Supabase mocking issues
 */
describe.skip('useUserForm', () => {
  const mockFetchUser = jest.fn();
  const mockOnSaveSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => 
      useUserForm('user-1', mockFetchUser, mockOnSaveSuccess)
    );

    expect(result.current.watchedValues).toBeDefined();
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('should handle form submission successfully', async () => {
    const mockUserData = {
      id: 'user-1',
      displayName: 'Test User',
      email: 'test@example.com',
      type: 'client' as const,
      street1: '123 Test St',
      city: 'Test City',
      state: 'CA',
      zip: '12345',
      counties: [],
      countiesServed: [],
      timeNeeded: [],
      cateringBrokerage: [],
      provisions: [],
      frequency: null,
      headCount: null,
      status: 'pending' as const,
      name: null,
      contact_name: null,
      sideNotes: null,
      contact_number: '',
      street2: '',
      company_name: '',
      website: '',
      location_number: '',
      parking_loading: ''
    };

    mockFetchUser.mockResolvedValue(mockUserData);

    const { result } = renderHook(() => 
      useUserForm('user-1', mockFetchUser, mockOnSaveSuccess)
    );

    // Mock successful API response
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });

    await act(async () => {
      await result.current.onSubmit(mockUserData);
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/users/user-1',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token'
        }),
        body: JSON.stringify(mockUserData)
      })
    );

    expect(toast.success).toHaveBeenCalledWith('User saved successfully!');
  });

  it('should handle form submission error', async () => {
    const mockUserData = {
      id: 'user-1',
      displayName: 'Test User',
      email: 'test@example.com',
      type: 'client' as const,
      street1: '123 Test St',
      city: 'Test City',
      state: 'CA',
      zip: '12345',
      counties: [],
      countiesServed: [],
      timeNeeded: [],
      cateringBrokerage: [],
      provisions: [],
      frequency: null,
      headCount: null,
      status: 'pending' as const,
      name: null,
      contact_name: null,
      sideNotes: null,
      contact_number: '',
      street2: '',
      company_name: '',
      website: '',
      location_number: '',
      parking_loading: ''
    };

    mockFetchUser.mockResolvedValue(mockUserData);

    const { result } = renderHook(() => 
      useUserForm('user-1', mockFetchUser, mockOnSaveSuccess)
    );

    // Mock failed API response
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    await act(async () => {
      await result.current.onSubmit(mockUserData);
    });

    expect(toast.error).toHaveBeenCalledWith(
      'Failed to save user: Failed to update user'
    );
  });
});
