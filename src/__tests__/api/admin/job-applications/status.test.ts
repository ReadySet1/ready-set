import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/admin/job-applications/[id]/status/route';

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(),
      })),
    })),
  })),
};

jest.mock('@/utils/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}));

// Mock console.error to avoid cluttering test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('/api/admin/job-applications/[id]/status PATCH endpoint', () => {
  const mockContext = {
    params: { id: 'test-app-id' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully update job application status with session auth', async () => {
    // Mock successful user session
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          user_metadata: { userRole: 'admin' },
        },
      },
      error: null,
    });

    // Mock successful user role fetch
    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    // Mock successful status update
    mockSupabaseClient.from().update().eq().select.mockResolvedValue({
      data: [{ id: 'test-app-id', status: 'APPROVED' }],
      error: null,
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    });

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.application.status).toBe('APPROVED');
  });

  it('should successfully update job application status with Bearer token auth', async () => {
    // Mock token-based authentication
    mockSupabaseClient.auth.getUser
      .mockResolvedValueOnce({
        // First call with token - success
        data: {
          user: {
            id: 'admin-user-id',
            email: 'admin@example.com',
            user_metadata: { userRole: 'admin' },
          },
        },
        error: null,
      });

    // Mock successful user role fetch
    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    // Mock successful status update
    mockSupabaseClient.from().update().eq().select.mockResolvedValue({
      data: [{ id: 'test-app-id', status: 'REJECTED' }],
      error: null,
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token-123',
      },
      body: JSON.stringify({ status: 'REJECTED' }),
    });

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.application.status).toBe('REJECTED');
    expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledWith('valid-token-123');
  });

  it('should fallback to session auth when token auth fails', async () => {
    // Mock token auth failure, then session auth success
    mockSupabaseClient.auth.getUser
      .mockResolvedValueOnce({
        // First call with token - fails
        data: { user: null },
        error: { message: 'Invalid token' },
      })
      .mockResolvedValueOnce({
        // Second call without token - succeeds
        data: {
          user: {
            id: 'admin-user-id',
            email: 'admin@example.com',
            user_metadata: { userRole: 'admin' },
          },
        },
        error: null,
      });

    // Mock successful user role fetch
    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    // Mock successful status update
    mockSupabaseClient.from().update().eq().select.mockResolvedValue({
      data: [{ id: 'test-app-id', status: 'PENDING' }],
      error: null,
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token',
      },
      body: JSON.stringify({ status: 'PENDING' }),
    });

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledTimes(2);
  });

  it('should return 401 when no authentication is available', async () => {
    // Mock no user authentication
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    });

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized - no active session');
  });

  it('should return 403 when user does not have admin or helpdesk role', async () => {
    // Mock successful authentication but wrong role
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'regular-user-id',
          email: 'user@example.com',
          user_metadata: { userRole: 'client' },
        },
      },
      error: null,
    });

    // Mock user role fetch showing client role
    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: { type: 'client' },
      error: null,
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    });

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden - insufficient permissions');
  });

  it('should return 400 when status is missing from request body', async () => {
    // Mock successful authentication
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          user_metadata: { userRole: 'admin' },
        },
      },
      error: null,
    });

    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // Missing status
    });

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Status is required');
  });

  it('should return 400 when status value is invalid', async () => {
    // Mock successful authentication
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          user_metadata: { userRole: 'admin' },
        },
      },
      error: null,
    });

    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'INVALID_STATUS' }),
    });

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid status value');
  });

  it('should handle database error during status update', async () => {
    // Mock successful authentication
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          user_metadata: { userRole: 'admin' },
        },
      },
      error: null,
    });

    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    // Mock database error during update
    mockSupabaseClient.from().update().eq().select.mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    });

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update job application status');
  });

  it('should handle invalid JSON in request body', async () => {
    // Mock successful authentication
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          user_metadata: { userRole: 'admin' },
        },
      },
      error: null,
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'invalid json',
    });

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid JSON in request body');
  });

  it('should allow helpdesk users to update status', async () => {
    // Mock successful authentication with helpdesk role
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'helpdesk-user-id',
          email: 'helpdesk@example.com',
          user_metadata: { userRole: 'helpdesk' },
        },
      },
      error: null,
    });

    // Mock user role fetch showing helpdesk role
    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: { type: 'helpdesk' },
      error: null,
    });

    // Mock successful status update
    mockSupabaseClient.from().update().eq().select.mockResolvedValue({
      data: [{ id: 'test-app-id', status: 'UNDER_REVIEW' }],
      error: null,
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'UNDER_REVIEW' }),
    });

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.application.status).toBe('UNDER_REVIEW');
  });

  it('should handle user role fetch error', async () => {
    // Mock successful authentication
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          user_metadata: { userRole: 'admin' },
        },
      },
      error: null,
    });

    // Mock error when fetching user role
    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: null,
      error: { message: 'User not found' },
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    });

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('User role not found');
  });

  it('should validate all acceptable status values', async () => {
    // Mock successful authentication
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          user_metadata: { userRole: 'admin' },
        },
      },
      error: null,
    });

    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    const validStatuses = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

    for (const status of validStatuses) {
      // Mock successful update for each status
      mockSupabaseClient.from().update().eq().select.mockResolvedValue({
        data: [{ id: 'test-app-id', status }],
        error: null,
      });

      const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      const response = await PATCH(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.application.status).toBe(status);
    }
  });
}); 