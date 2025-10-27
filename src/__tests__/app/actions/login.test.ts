/**
 * Comprehensive Login Flow Tests
 * Tests authentication flows, role-based redirects, error handling, and security
 *
 * Coverage:
 * - Input validation
 * - Authentication flows (success/failure)
 * - Profile creation for new users
 * - Role-based redirects
 * - Error scenarios
 * - Session management
 * - Security edge cases
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { login, signup, FormState } from '@/app/actions/login';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

// Mock dependencies
const mockRedirect = jest.fn();
const mockCreateClient = jest.fn();
const mockCreateAdminClient = jest.fn();
jest.mock('next/navigation', () => ({
  redirect: mockRedirect
}));
jest.mock('@/utils/supabase/server', () => ({
  createClient: mockCreateClient,
  createAdminClient: mockCreateAdminClient
}));
jest.mock('@/utils/supabase/client', () => ({
  prefetchUserProfile: jest.fn().mockResolvedValue(undefined)
}));

describe('Login Action', () => {
  let mockSupabase: any;
  let mockAdminSupabase: any;

  // Helper to set up successful login flow
  const setupSuccessfulLogin = (userType: string = 'CLIENT', userId: string = 'user-123') => {
    // Mock successful auth
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: userId, email: 'test@example.com' },
        session: { access_token: 'token' }
      },
      error: null
    });

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId, email: 'test@example.com' } },
      error: null
    });

    // Mock from() to return proper chains
    // Call 1: connection test (limit)
    // Call 2: get profile (single)
    let callIndex = 0;
    mockSupabase.from.mockImplementation(() => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
      };

      // Connection test (first call)
      if (callIndex === 0) {
        chain.limit.mockResolvedValue({ data: [], error: null });
      }
      // Profile fetch (second call)
      else if (callIndex === 1) {
        chain.single.mockResolvedValue({
          data: { type: userType, email: 'test@example.com' },
          error: null
        });
      }

      callIndex++;
      return chain;
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create chainable mock methods for query builder
    const createMockChain = () => {
      const chain: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
        limit: jest.fn(),
        upsert: jest.fn(),
      };

      // Make methods chainable
      chain.select.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      chain.limit.mockReturnValue(chain);
      chain.upsert.mockReturnValue(chain);

      // Default resolved values for terminal methods
      chain.single.mockResolvedValue({ data: null, error: null });
      chain.maybeSingle.mockResolvedValue({ data: null, error: null });
      chain.limit.mockResolvedValue({ data: [], error: null });

      return chain;
    };

    // Mock Supabase client with proper from() method that returns a fresh chain each time
    mockSupabase = {
      auth: {
        signInWithPassword: jest.fn(),
        getUser: jest.fn(),
        signUp: jest.fn(),
      },
      from: jest.fn(() => createMockChain()),
    };

    // Mock admin Supabase client with chainable methods
    mockAdminSupabase = {
      from: jest.fn(() => {
        const chain: any = {
          upsert: jest.fn(),
          select: jest.fn(),
          single: jest.fn(),
        };
        chain.upsert.mockReturnValue(chain);
        chain.select.mockReturnValue(chain);
        chain.single.mockResolvedValue({ data: null, error: null });
        return chain;
      }),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
    mockCreateAdminClient.mockResolvedValue(mockAdminSupabase);
  });

  describe('Input Validation', () => {
    it('should reject empty email', async () => {
      const formData = new FormData();
      formData.append('password', 'ValidPassword123!');

      const result = await login(null, formData);

      expect(result.error).toBe('Please provide email to continue.');
      expect(result.success).toBe(false);
    });

    it('should reject empty password', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');

      const result = await login(null, formData);

      expect(result.error).toBe('Please provide password to continue.');
      expect(result.success).toBe(false);
    });

    it('should reject both empty email and password', async () => {
      const formData = new FormData();

      const result = await login(null, formData);

      expect(result.error).toBe('Please provide email and password to continue.');
      expect(result.success).toBe(false);
    });

    it('should reject invalid email format', async () => {
      const formData = new FormData();
      formData.append('email', 'invalid-email');
      formData.append('password', 'ValidPassword123!');

      const result = await login(null, formData);

      expect(result.error).toBe('Please enter a valid email address.');
      expect(result.success).toBe(false);
    });

    it('should normalize email to lowercase', async () => {
      const formData = new FormData();
      formData.append('email', 'Test@EXAMPLE.COM');
      formData.append('password', 'ValidPassword123!');

      setupSuccessfulLogin();

      await login(null, formData);

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com', // Normalized to lowercase
        password: 'ValidPassword123!'
      });
    });
  });

  describe('Connection Testing', () => {
    it('should test Supabase connection before authentication', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'ValidPassword123!');

      // Mock connection test to succeed
      const mockConnectionTest = jest.fn().mockResolvedValue({ data: [], error: null });
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: mockConnectionTest
        })
      });

      // Mock auth to fail so we don't proceed further
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      await login(null, formData);

      expect(mockConnectionTest).toHaveBeenCalled();
    });

    it('should handle connection errors gracefully', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'ValidPassword123!');

      // Mock connection test to fail
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection failed' }
          })
        })
      });

      const result = await login(null, formData);

      expect(result.error).toBe('Unable to connect to authentication service. Please try again later.');
      expect(result.success).toBe(false);
    });

    it('should handle connection exceptions', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'ValidPassword123!');

      // Mock connection test to throw
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockRejectedValue(new Error('Network error'))
        })
      });

      const result = await login(null, formData);

      expect(result.error).toBe('Authentication service is temporarily unavailable. Please try again later.');
      expect(result.success).toBe(false);
    });
  });

  describe('Authentication Flows', () => {
    beforeEach(() => {
      // Mock successful connection test for all auth tests
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
          maybeSingle: jest.fn(),
        })
      });
    });

    it('should successfully authenticate with valid credentials', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'ValidPassword123!');

      // Mock successful authentication
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'test@example.com' },
          session: { access_token: 'token' }
        },
        error: null
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      });

      // Mock profile fetch
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'CLIENT', email: 'test@example.com' },
              error: null
            })
          })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.success).toBe(true);
      expect(result.userType).toBe('CLIENT');
      expect(result.redirectTo).toBe('/client');
    });

    it('should handle invalid credentials - user exists', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'WrongPassword');

      // Mock auth failure
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      // Mock user exists in profiles
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { email: 'test@example.com', type: 'CLIENT' },
              error: null
            }),
            single: jest.fn(),
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.error).toContain('Incorrect password');
      expect(result.success).toBe(false);
    });

    it('should handle invalid credentials - user does not exist', async () => {
      const formData = new FormData();
      formData.append('email', 'nonexistent@example.com');
      formData.append('password', 'SomePassword');

      // Mock auth failure
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      // Mock user does not exist
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null
            }),
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.error).toContain('Account not found');
      expect(result.success).toBe(false);
    });

    it('should handle rate limiting', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'ValidPassword123!');

      // Mock rate limit error
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Too many requests' }
      });

      const result = await login(null, formData);

      expect(result.error).toContain('Too many login attempts');
      expect(result.success).toBe(false);
    });
  });

  describe('Profile Management', () => {
    beforeEach(() => {
      // Mock successful connection and auth for profile tests
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'test@example.com' },
          session: { access_token: 'token' }
        },
        error: null
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com', user_metadata: {} } },
        error: null
      });
    });

    it('should create profile for user without profile', async () => {
      const formData = new FormData();
      formData.append('email', 'newuser@example.com');
      formData.append('password', 'ValidPassword123!');

      // Mock no profile found
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' } // No rows returned
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      // Mock admin client profile creation
      mockAdminSupabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'CLIENT', email: 'newuser@example.com' },
              error: null
            })
          })
        })
      });

      const result = await login(null, formData);

      expect(result.success).toBe(true);
      expect(result.userType).toBe('CLIENT');
      expect(mockAdminSupabase.from).toHaveBeenCalledWith('profiles');
    });

    it('should handle profile creation failure', async () => {
      const formData = new FormData();
      formData.append('email', 'newuser@example.com');
      formData.append('password', 'ValidPassword123!');

      // Mock no profile found
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      // Mock admin client profile creation failure
      mockAdminSupabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      const result = await login(null, formData);

      expect(result.error).toContain('unable to create user profile');
      expect(result.success).toBe(false);
    });

    it('should use existing profile when available', async () => {
      const formData = new FormData();
      formData.append('email', 'existing@example.com');
      formData.append('password', 'ValidPassword123!');

      // Mock existing profile
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'DRIVER', email: 'existing@example.com' },
              error: null
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.success).toBe(true);
      expect(result.userType).toBe('DRIVER');
      expect(mockAdminSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('Role-Based Redirects', () => {
    beforeEach(() => {
      // Setup common mocks for redirect tests
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'test@example.com' },
          session: { access_token: 'token' }
        },
        error: null
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      });
    });

    it('should redirect ADMIN users to /admin', async () => {
      const formData = new FormData();
      formData.append('email', 'admin@example.com');
      formData.append('password', 'AdminPass123!');

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'ADMIN', email: 'admin@example.com' },
              error: null
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/admin');
      expect(result.userType).toBe('ADMIN');
    });

    it('should redirect SUPER_ADMIN users to /admin', async () => {
      const formData = new FormData();
      formData.append('email', 'superadmin@example.com');
      formData.append('password', 'SuperPass123!');

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'SUPER_ADMIN', email: 'superadmin@example.com' },
              error: null
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/admin');
      expect(result.userType).toBe('SUPER_ADMIN');
    });

    it('should redirect DRIVER users to /driver', async () => {
      const formData = new FormData();
      formData.append('email', 'driver@example.com');
      formData.append('password', 'DriverPass123!');

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'DRIVER', email: 'driver@example.com' },
              error: null
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/driver');
      expect(result.userType).toBe('DRIVER');
    });

    it('should redirect CLIENT users to /client', async () => {
      const formData = new FormData();
      formData.append('email', 'client@example.com');
      formData.append('password', 'ClientPass123!');

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'CLIENT', email: 'client@example.com' },
              error: null
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/client');
      expect(result.userType).toBe('CLIENT');
    });

    it('should redirect VENDOR users to /client', async () => {
      const formData = new FormData();
      formData.append('email', 'vendor@example.com');
      formData.append('password', 'VendorPass123!');

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'VENDOR', email: 'vendor@example.com' },
              error: null
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/client');
      expect(result.userType).toBe('VENDOR');
    });

    it('should redirect HELPDESK users to /helpdesk', async () => {
      const formData = new FormData();
      formData.append('email', 'helpdesk@example.com');
      formData.append('password', 'HelpdeskPass123!');

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'HELPDESK', email: 'helpdesk@example.com' },
              error: null
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/helpdesk');
      expect(result.userType).toBe('HELPDESK');
    });

    it('should respect returnTo parameter when user has access', async () => {
      const formData = new FormData();
      formData.append('email', 'admin@example.com');
      formData.append('password', 'AdminPass123!');
      formData.append('returnTo', '/admin/users');

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'ADMIN', email: 'admin@example.com' },
              error: null
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/admin/users');
    });

    it('should ignore returnTo when user lacks access', async () => {
      const formData = new FormData();
      formData.append('email', 'client@example.com');
      formData.append('password', 'ClientPass123!');
      formData.append('returnTo', '/admin/users'); // CLIENT shouldn't have access

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'CLIENT', email: 'client@example.com' },
              error: null
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/client'); // Redirected to home route
    });

    it('should ignore returnTo="/" and use home route', async () => {
      const formData = new FormData();
      formData.append('email', 'driver@example.com');
      formData.append('password', 'DriverPass123!');
      formData.append('returnTo', '/');

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'DRIVER', email: 'driver@example.com' },
              error: null
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/driver');
    });
  });

  describe('Session Management', () => {
    beforeEach(() => {
      // Setup common mocks
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { type: 'CLIENT', email: 'test@example.com' },
            error: null
          }),
        })
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'test@example.com' },
          session: { access_token: 'token' }
        },
        error: null
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      });
    });

    it('should set user-session-data cookie on successful login', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'ValidPassword123!');

      await login(null, formData);

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'user-session-data',
        expect.stringContaining('user-123'),
        expect.objectContaining({
          path: '/',
          httpOnly: false,
          sameSite: 'lax',
        })
      );
    });

    it('should set temp-session-data cookie', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'ValidPassword123!');

      await login(null, formData);

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'temp-session-data',
        expect.any(String),
        expect.objectContaining({
          path: '/',
          httpOnly: false,
          maxAge: 60,
        })
      );
    });

    it('should set user-profile cache cookie', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'ValidPassword123!');

      await login(null, formData);

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.stringContaining('user-profile-'),
        expect.any(String),
        expect.objectContaining({
          maxAge: 600, // 10 minutes
        })
      );
    });
  });

  describe('Security Edge Cases', () => {
    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        })
      });
    });

    it('should handle SQL injection attempts in email', async () => {
      const formData = new FormData();
      formData.append('email', "admin'--@example.com");
      formData.append('password', 'ValidPassword123!');

      // Mock auth failure (SQL injection should not work)
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null
            }),
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.success).toBe(false);
      // Should call signInWithPassword with the email as-is (Supabase handles sanitization)
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "admin'--@example.com",
        password: 'ValidPassword123!'
      });
    });

    it('should handle XSS attempts in input', async () => {
      const formData = new FormData();
      formData.append('email', '<script>alert("xss")</script>@example.com');
      formData.append('password', '<script>alert("xss")</script>');

      const result = await login(null, formData);

      // Should fail validation due to invalid email format
      expect(result.error).toBe('Please enter a valid email address.');
      expect(result.success).toBe(false);
    });

    it('should handle extremely long password', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'a'.repeat(10000)); // Very long password

      // Mock connection test
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });

      // Mock auth to handle it
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null
            }),
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.success).toBe(false);
      // Should pass password as-is to Supabase
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'a'.repeat(10000)
      });
    });

    it('should handle unicode characters in input', async () => {
      const formData = new FormData();
      formData.append('email', 'test@例え.com');
      formData.append('password', '密码Password123!');

      // Mock connection test
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });

      // Mock auth
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null
            }),
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@例え.com',
        password: '密码Password123!'
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        })
      });
    });

    it('should handle getUser failure after successful auth', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'ValidPassword123!');

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'test@example.com' },
          session: { access_token: 'token' }
        },
        error: null
      });

      // Mock getUser failure
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Failed to get user' }
      });

      const result = await login(null, formData);

      expect(result.error).toContain('unable to retrieve user information');
      expect(result.success).toBe(false);
    });

    it('should handle profile fetch error (non-PGRST116)', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'ValidPassword123!');

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'test@example.com' },
          session: { access_token: 'token' }
        },
        error: null
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      });

      // Mock profile fetch error
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'SOME_ERROR', message: 'Database error' }
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.error).toContain('unable to retrieve user information');
      expect(result.success).toBe(false);
    });

    it('should handle missing user type in profile', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'ValidPassword123!');

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'test@example.com' },
          session: { access_token: 'token' }
        },
        error: null
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      });

      // Mock profile with missing type
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { email: 'test@example.com', type: null }, // Missing type
              error: null
            })
          }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });
      mockSupabase.from = mockFrom;

      const result = await login(null, formData);

      expect(result.error).toContain('profile is incomplete');
      expect(result.success).toBe(false);
    });
  });
});

describe('Signup Action', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create chainable mock methods for signup query builder
    const createMockChain = () => {
      const chain: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
        limit: jest.fn(),
        upsert: jest.fn(),
      };

      // Make methods chainable
      chain.select.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      chain.limit.mockReturnValue(chain);
      chain.upsert.mockReturnValue(chain);

      // Default resolved values for terminal methods
      chain.single.mockResolvedValue({ data: null, error: null });
      chain.maybeSingle.mockResolvedValue({ data: null, error: null });

      return chain;
    };

    mockSupabase = {
      auth: {
        signUp: jest.fn(),
      },
      from: jest.fn((table) => createMockChain()),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
    mockRedirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT: ${url}`);
    });
  });

  it('should reject signup without email', async () => {
    const formData = new FormData();
    formData.append('password', 'ValidPassword123!');

    await expect(signup(formData)).rejects.toThrow('REDIRECT: /sign-in?error=Email+and+password+are+required');
  });

  it('should reject signup without password', async () => {
    const formData = new FormData();
    formData.append('email', 'test@example.com');

    await expect(signup(formData)).rejects.toThrow('REDIRECT: /sign-in?error=Email+and+password+are+required');
  });

  it('should reject short password', async () => {
    const formData = new FormData();
    formData.append('email', 'test@example.com');
    formData.append('password', 'short');

    await expect(signup(formData)).rejects.toThrow('REDIRECT: /sign-in?error=Password+must+be+at+least+8+characters+long');
  });

  it('should handle successful signup without email confirmation', async () => {
    const formData = new FormData();
    formData.append('email', 'test@example.com');
    formData.append('password', 'ValidPassword123!');

    mockSupabase.auth.signUp.mockResolvedValue({
      data: {
        user: { id: 'user-123' },
        session: { access_token: 'token' } // Session present = no confirmation needed
      },
      error: null
    });

    await expect(signup(formData)).rejects.toThrow('REDIRECT: /');
  });

  it('should handle signup with email confirmation required', async () => {
    const formData = new FormData();
    formData.append('email', 'test@example.com');
    formData.append('password', 'ValidPassword123!');

    mockSupabase.auth.signUp.mockResolvedValue({
      data: {
        user: { id: 'user-123' },
        session: null // No session = confirmation required
      },
      error: null
    });

    await expect(signup(formData)).rejects.toThrow('REDIRECT: /signup-confirmation');
  });

  it('should handle signup errors', async () => {
    const formData = new FormData();
    formData.append('email', 'test@example.com');
    formData.append('password', 'ValidPassword123!');

    mockSupabase.auth.signUp.mockResolvedValue({
      data: null,
      error: { message: 'Email already registered' }
    });

    await expect(signup(formData)).rejects.toThrow('REDIRECT: /sign-in?error=Email+already+registered');
  });
});
