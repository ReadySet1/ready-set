import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/admin/job-applications/[id]/status/route';
import { prisma } from '@/utils/prismaDB';

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

// Create a mock for the from().select().eq().single() chain
const mockSingleQuery = jest.fn();
const mockEqQuery = jest.fn(() => ({ single: mockSingleQuery }));
const mockSelectQuery = jest.fn(() => ({ eq: mockEqQuery }));
const mockUpdateQuery = jest.fn(() => ({
  eq: jest.fn(() => ({
    select: jest.fn(),
  })),
}));
const mockFromQuery = jest.fn(() => ({ 
  select: mockSelectQuery,
  update: mockUpdateQuery 
}));

// Override the from method to return our chained mock
mockSupabaseClient.from = mockFromQuery;

jest.mock('@/utils/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}));

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    jobApplication: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock console.error to avoid cluttering test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn() as jest.MockedFunction<typeof console.error>;
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('/api/admin/job-applications/[id]/status PATCH endpoint', () => {
  const mockContext = {
    params: Promise.resolve({ id: 'test-app-id' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Log any console errors to help debug
    if ((console.error as jest.MockedFunction<typeof console.error>).mock.calls.length > 0) {
      console.log('Console errors:', (console.error as jest.MockedFunction<typeof console.error>).mock.calls);
    }
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
    mockSingleQuery.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    // Mock successful job application find
    (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
      id: 'test-app-id',
      status: 'PENDING',
    });

    // Mock successful status update
    (prisma.jobApplication.update as jest.Mock).mockResolvedValue({
      id: 'test-app-id',
      status: 'APPROVED',
    });

    const requestBody = JSON.stringify({ status: 'APPROVED' });
    console.log('Test request body:', requestBody);
    
    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    }) as NextRequest;

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    console.log('Response data:', data);
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
    mockSingleQuery.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    // Mock successful job application find
    (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
      id: 'test-app-id',
      status: 'PENDING',
    });

    // Mock successful status update
    (prisma.jobApplication.update as jest.Mock).mockResolvedValue({
      id: 'test-app-id',
      status: 'REJECTED',
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token-123',
      },
      body: JSON.stringify({ status: 'REJECTED' }),
    }) as NextRequest;

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
    mockSingleQuery.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    // Mock successful job application find
    (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
      id: 'test-app-id',
      status: 'PENDING',
    });

    // Mock successful status update
    (prisma.jobApplication.update as jest.Mock).mockResolvedValue({
      id: 'test-app-id',
      status: 'PENDING',
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token',
      },
      body: JSON.stringify({ status: 'PENDING' }),
    }) as NextRequest;

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
    }) as NextRequest;

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
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
    mockSingleQuery.mockResolvedValue({
      data: { type: 'client' },
      error: null,
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    }) as NextRequest;

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
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

    mockSingleQuery.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // Missing status
    }) as NextRequest;

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid status value');
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

    mockSingleQuery.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'INVALID_STATUS' }),
    }) as NextRequest;

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

    mockSingleQuery.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    // Mock successful job application find
    (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
      id: 'test-app-id',
      status: 'PENDING',
    });

    // Mock database error during update
    (prisma.jobApplication.update as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    }) as NextRequest;

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
    }) as NextRequest;

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update job application status');
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
    mockSingleQuery.mockResolvedValue({
      data: { type: 'helpdesk' },
      error: null,
    });

    // Mock successful job application find
    (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
      id: 'test-app-id',
      status: 'PENDING',
    });

    // Mock successful status update
    (prisma.jobApplication.update as jest.Mock).mockResolvedValue({
      id: 'test-app-id',
      status: 'INTERVIEWING',
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'INTERVIEWING' }),
    }) as NextRequest;

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
    mockSingleQuery.mockResolvedValue({
      data: null,
      error: { message: 'User not found' },
    });

    const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    }) as NextRequest;

    const response = await PATCH(request, mockContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
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

    mockSingleQuery.mockResolvedValue({
      data: { type: 'admin' },
      error: null,
    });

    const validStatuses = ['PENDING', 'INTERVIEWING', 'APPROVED', 'REJECTED'];

    for (const status of validStatuses) {
      // Mock successful job application find
      (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
        id: 'test-app-id',
        status: 'PENDING',
      });

      // Mock successful update for each status
      (prisma.jobApplication.update as jest.Mock).mockResolvedValue({
        id: 'test-app-id',
        status,
      });

      const request = new Request('http://localhost:3000/api/admin/job-applications/test-app-id/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      }) as NextRequest;

      const response = await PATCH(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.application.status).toBe(status);
    }
  });
}); 