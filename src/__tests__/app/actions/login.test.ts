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

import { describe, it, expect, jest, beforeEach, afterEach, beforeAll } from '@jest/globals';

// Factory functions to create fresh mock instances
const createMockChain = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  limit: jest.fn().mockResolvedValue({ data: null, error: null }),
});

const createMockAdminChain = () => ({
  upsert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
});

// Shared mock objects
let mockChain: ReturnType<typeof createMockChain>;
let mockAdminChain: ReturnType<typeof createMockAdminChain>;

const mockSupabase = {
  auth: {
    signInWithPassword: jest.fn(),
    getUser: jest.fn(),
    signUp: jest.fn(),
  },
  from: jest.fn(),
};

const mockAdminSupabase = {
  from: jest.fn(),
};

const mockCookieStore = {
  set: jest.fn(),
};

// Mock the modules
// NOTE: Jest automocking works for createClient but NOT for createAdminClient
// This is a known Jest limitation with ES modules - see comments at end of file
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/supabase/client');

// Import after mocking
import { login, signup, FormState } from '@/app/actions/login';
import * as supabaseServer from '@/utils/supabase/server';
import { cookies } from 'next/headers';

describe('Login Action', () => {
  beforeAll(() => {
    // Setup createAdminClient once (ES module limitation workaround)
    if (!supabaseServer.createAdminClient) {
      Object.defineProperty(supabaseServer, 'createAdminClient', {
        value: jest.fn(),
        writable: true,
        configurable: true,
      });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock chains for each test
    mockChain = createMockChain();
    mockAdminChain = createMockAdminChain();

    // Mock cookies() function to return our mock cookie store
    // Note: cookies is globally mocked in jest.setup.ts
    (cookies as jest.Mock).mockResolvedValue(mockCookieStore);

    // Make from() return the fresh chains
    mockSupabase.from.mockReturnValue(mockChain);
    mockAdminSupabase.from.mockReturnValue(mockAdminChain);

    // Setup createClient and createAdminClient to return our mocks
    (supabaseServer.createClient as jest.Mock).mockResolvedValue(mockSupabase);
    (supabaseServer.createAdminClient as jest.Mock).mockResolvedValue(mockAdminSupabase);
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

      // Mock successful auth
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
      mockChain.single.mockResolvedValue({
        data: { type: 'CLIENT', email: 'test@example.com' },
        error: null
      });

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

      // Mock connection test (already set in beforeEach to succeed)
      // Mock auth to fail so we don't proceed further
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      await login(null, formData);

      // Verify connection was tested (from() and limit() were called)
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockChain.limit).toHaveBeenCalled();
    });

    it('should handle connection errors gracefully', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      formData.append('password', 'ValidPassword123!');

      // Mock connection test to fail
      mockChain.limit.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' }
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
      mockChain.limit.mockRejectedValue(new Error('Network error'));

      const result = await login(null, formData);

      expect(result.error).toBe('Authentication service is temporarily unavailable. Please try again later.');
      expect(result.success).toBe(false);
    });
  });

  describe('Authentication Flows', () => {
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
      mockChain.single.mockResolvedValue({
        data: { type: 'CLIENT', email: 'test@example.com' },
        error: null
      });

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
      mockChain.maybeSingle.mockResolvedValue({
        data: { email: 'test@example.com', type: 'CLIENT' },
        error: null
      });

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

      // Mock user does not exist (maybeSingle returns null by default from beforeEach)
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
    it('should create profile for user without profile', async () => {
      const formData = new FormData();
      formData.append('email', 'newuser@example.com');
      formData.append('password', 'ValidPassword123!');

      // Mock successful auth
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'newuser@example.com' },
          session: { access_token: 'token' }
        },
        error: null
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'newuser@example.com', user_metadata: {} } },
        error: null
      });

      // Mock no profile found
      mockChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // No rows returned
      });

      // Mock admin client profile creation
      mockAdminChain.single.mockResolvedValue({
        data: { type: 'CLIENT', email: 'newuser@example.com' },
        error: null
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

      // Mock successful auth
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'newuser@example.com' },
          session: { access_token: 'token' }
        },
        error: null
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'newuser@example.com', user_metadata: {} } },
        error: null
      });

      // Mock no profile found
      mockChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      // Mock admin client profile creation failure
      mockAdminChain.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const result = await login(null, formData);

      expect(result.error).toContain('unable to create user profile');
      expect(result.success).toBe(false);
    });

    it('should use existing profile when available', async () => {
      const formData = new FormData();
      formData.append('email', 'existing@example.com');
      formData.append('password', 'ValidPassword123!');

      // Mock successful auth
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'existing@example.com' },
          session: { access_token: 'token' }
        },
        error: null
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'existing@example.com' } },
        error: null
      });

      // Mock existing profile
      mockChain.single.mockResolvedValue({
        data: { type: 'DRIVER', email: 'existing@example.com' },
        error: null
      });

      const result = await login(null, formData);

      expect(result.success).toBe(true);
      expect(result.userType).toBe('DRIVER');
      expect(mockAdminSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('Role-Based Redirects', () => {
    // Helper to set up successful auth with a specific user type
    const setupAuthWithUserType = (userType: string, email: string) => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-123', email },
          session: { access_token: 'token' }
        },
        error: null
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email } },
        error: null
      });

      mockChain.single.mockResolvedValue({
        data: { type: userType, email },
        error: null
      });
    };

    it('should redirect ADMIN users to /admin', async () => {
      const formData = new FormData();
      formData.append('email', 'admin@example.com');
      formData.append('password', 'AdminPass123!');

      setupAuthWithUserType('ADMIN', 'admin@example.com');

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/admin');
      expect(result.userType).toBe('ADMIN');
    });

    it('should redirect SUPER_ADMIN users to /admin', async () => {
      const formData = new FormData();
      formData.append('email', 'superadmin@example.com');
      formData.append('password', 'SuperPass123!');

      setupAuthWithUserType('SUPER_ADMIN', 'superadmin@example.com');

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/admin');
      expect(result.userType).toBe('SUPER_ADMIN');
    });

    it('should redirect DRIVER users to /driver', async () => {
      const formData = new FormData();
      formData.append('email', 'driver@example.com');
      formData.append('password', 'DriverPass123!');

      setupAuthWithUserType('DRIVER', 'driver@example.com');

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/driver');
      expect(result.userType).toBe('DRIVER');
    });

    it('should redirect CLIENT users to /client', async () => {
      const formData = new FormData();
      formData.append('email', 'client@example.com');
      formData.append('password', 'ClientPass123!');

      setupAuthWithUserType('CLIENT', 'client@example.com');

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/client');
      expect(result.userType).toBe('CLIENT');
    });

    it('should redirect VENDOR users to /client', async () => {
      const formData = new FormData();
      formData.append('email', 'vendor@example.com');
      formData.append('password', 'VendorPass123!');

      setupAuthWithUserType('VENDOR', 'vendor@example.com');

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/client');
      expect(result.userType).toBe('VENDOR');
    });

    it('should redirect HELPDESK users to /helpdesk', async () => {
      const formData = new FormData();
      formData.append('email', 'helpdesk@example.com');
      formData.append('password', 'HelpdeskPass123!');

      setupAuthWithUserType('HELPDESK', 'helpdesk@example.com');

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/helpdesk');
      expect(result.userType).toBe('HELPDESK');
    });

    it('should respect returnTo parameter when user has access', async () => {
      const formData = new FormData();
      formData.append('email', 'admin@example.com');
      formData.append('password', 'AdminPass123!');
      formData.append('returnTo', '/admin/users');

      setupAuthWithUserType('ADMIN', 'admin@example.com');

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/admin/users');
    });

    it('should ignore returnTo when user lacks access', async () => {
      const formData = new FormData();
      formData.append('email', 'client@example.com');
      formData.append('password', 'ClientPass123!');
      formData.append('returnTo', '/admin/users'); // CLIENT shouldn't have access

      setupAuthWithUserType('CLIENT', 'client@example.com');

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/client'); // Redirected to home route
    });

    it('should ignore returnTo="/" and use home route', async () => {
      const formData = new FormData();
      formData.append('email', 'driver@example.com');
      formData.append('password', 'DriverPass123!');
      formData.append('returnTo', '/');

      setupAuthWithUserType('DRIVER', 'driver@example.com');

      const result = await login(null, formData);

      expect(result.redirectTo).toBe('/driver');
    });
  });

  describe('Session Management', () => {
    it('should set user-session-data cookie on successful login', async () => {
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

      mockChain.single.mockResolvedValue({
        data: { type: 'CLIENT', email: 'test@example.com' },
        error: null
      });

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

      mockChain.single.mockResolvedValue({
        data: { type: 'CLIENT', email: 'test@example.com' },
        error: null
      });

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

      mockChain.single.mockResolvedValue({
        data: { type: 'CLIENT', email: 'test@example.com' },
        error: null
      });

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
    it('should handle SQL injection attempts in email', async () => {
      const formData = new FormData();
      formData.append('email', "admin'--@example.com");
      formData.append('password', 'ValidPassword123!');

      // Mock auth failure (SQL injection should not work)
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

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

      // Mock auth to handle it
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

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

      // Mock auth
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      const result = await login(null, formData);

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@例え.com',
        password: '密码Password123!'
      });
    });
  });

  describe('Error Handling', () => {
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
      mockChain.single.mockResolvedValue({
        data: null,
        error: { code: 'SOME_ERROR', message: 'Database error' }
      });

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
      mockChain.single.mockResolvedValue({
        data: { email: 'test@example.com', type: null }, // Missing type
        error: null
      });

      const result = await login(null, formData);

      expect(result.error).toContain('profile is incomplete');
      expect(result.success).toBe(false);
    });
  });
});

describe('Signup Action', () => {
  // Factory function for signup mock chain
  const createSignupMockChain = () => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    limit: jest.fn().mockResolvedValue({ data: null, error: null }),
    upsert: jest.fn().mockReturnThis(),
  });

  let mockChain: ReturnType<typeof createSignupMockChain>;

  const mockSupabase = {
    auth: {
      signUp: jest.fn(),
    },
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock chain for each test
    mockChain = createSignupMockChain();

    // Make from() return the fresh chain
    mockSupabase.from.mockReturnValue(mockChain);

    // Setup mocked Supabase client
    (supabaseServer.createClient as jest.Mock).mockResolvedValue(mockSupabase);
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

/**
 * KNOWN LIMITATION - Jest ES Module Mocking
 *
 * Status: 28/40 tests passing (70% success rate)
 *
 * Issue:
 * Jest's automocking does NOT create the `createAdminClient` export from '@/utils/supabase/server'.
 * Only `createClient` is properly automocked. This is a fundamental Jest limitation with ES modules.
 *
 * Failing Tests (12):
 * - Profile Management › should create profile for user without profile
 * - Profile Management › should handle profile creation failure
 * - Session Management › should set user-session-data cookie on successful login
 * - Session Management › should set temp-session-data cookie
 * - Session Management › should set user-profile cache cookie
 * - Security Edge Cases › should handle XSS attempts in input
 * - All Signup Action tests (6 tests)
 *
 * Root Cause:
 * When login.ts imports `createAdminClient`, it gets `undefined` because Jest's automocking
 * doesn't create it. Factory-based mocking (jest.mock with a factory function) creates
 * mock instances that are DIFFERENT from what gets imported, making it impossible to configure
 * them in beforeEach.
 *
 * Attempted Solutions (all failed):
 * 1. Factory mocking with jest.fn() - creates different instances
 * 2. Object.defineProperty after import - too late, bindings already created
 * 3. Various factory syntaxes (arrow functions, named functions, module.exports) - all fail
 * 4. Pre-creating mocks before jest.mock - Jest replaces them with different instances
 * 5. __esModule: true flag - no effect
 * 6. jest.requireActual() - circular dependency issues
 *
 * Possible Solutions:
 * 1. Refactor login.ts to not use createAdminClient directly (use dependency injection)
 * 2. Use integration tests instead of unit tests for these scenarios
 * 3. Wait for Jest to improve ES module support
 * 4. Switch to a different test framework (Vitest has better ES module support)
 *
 * References:
 * - https://jestjs.io/docs/ecmascript-modules
 * - https://github.com/facebook/jest/issues/10025
 */
