// src/__tests__/api/users/user-settings.test.ts

import { GET, PATCH } from '@/app/api/users/[userId]/settings/route';
import { createClient } from '@/utils/supabase/server';
import { UserType, UserStatus } from '@/types/prisma';
import {
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server');

describe('/api/users/[userId]/settings API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('GET /api/users/[userId]/settings - Fetch User Settings', () => {
    describe('✅ Successful Fetch', () => {
      it('should fetch user settings by ADMIN', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn()
                .mockResolvedValueOnce({
                  // First call for currentUser permissions
                  data: { type: UserType.ADMIN },
                  error: null,
                })
                .mockResolvedValueOnce({
                  // Second call for target user settings
                  data: {
                    id: 'user-456',
                    type: UserType.CLIENT,
                    status: UserStatus.ACTIVE,
                    isTemporaryPassword: false,
                  },
                  error: null,
                }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/settings'
        );
        const params = { userId: 'user-456' };

        const response = await GET(request, { params });
        const data = await expectSuccessResponse(response, 200);

        expect(data.id).toBe('user-456');
        expect(data.type).toBe(UserType.CLIENT);
        expect(data.status).toBe(UserStatus.ACTIVE);
        expect(data.isTemporaryPassword).toBe(false);
      });

      it('should fetch user settings by SUPER_ADMIN', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn()
                .mockResolvedValueOnce({
                  data: { type: UserType.SUPER_ADMIN },
                  error: null,
                })
                .mockResolvedValueOnce({
                  data: {
                    id: 'user-789',
                    type: UserType.VENDOR,
                    status: UserStatus.SUSPENDED,
                    isTemporaryPassword: true,
                  },
                  error: null,
                }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-789/settings'
        );
        const params = { userId: 'user-789' };

        const response = await GET(request, { params });
        expect(response.status).toBe(200);
      });

      it('should return only specific settings fields', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn()
                .mockResolvedValueOnce({
                  data: { type: UserType.ADMIN },
                  error: null,
                })
                .mockResolvedValueOnce({
                  data: {
                    id: 'user-456',
                    type: UserType.CLIENT,
                    status: UserStatus.ACTIVE,
                    isTemporaryPassword: false,
                  },
                  error: null,
                }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/settings'
        );
        const params = { userId: 'user-456' };

        const response = await GET(request, { params });
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('type');
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('isTemporaryPassword');
        expect(data).not.toHaveProperty('email');
        expect(data).not.toHaveProperty('password');
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: new Error('Unauthorized'),
        });

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/settings'
        );
        const params = { userId: 'user-456' };

        const response = await GET(request, { params });
        await expectUnauthorized(response, /Authentication required/i);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 for CLIENT users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'client-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { type: UserType.CLIENT },
                error: null,
              }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/settings'
        );
        const params = { userId: 'user-456' };

        const response = await GET(request, { params });
        await expectForbidden(response, /Insufficient permissions/i);
      });

      it('should return 403 for VENDOR users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'vendor-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { type: UserType.VENDOR },
                error: null,
              }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/settings'
        );
        const params = { userId: 'user-456' };

        const response = await GET(request, { params });
        await expectForbidden(response);
      });

      it('should return 403 for DRIVER users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { type: UserType.DRIVER },
                error: null,
              }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/settings'
        );
        const params = { userId: 'user-456' };

        const response = await GET(request, { params });
        await expectForbidden(response);
      });

      it('should return 403 for HELPDESK users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'helpdesk-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { type: UserType.HELPDESK },
                error: null,
              }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/settings'
        );
        const params = { userId: 'user-456' };

        const response = await GET(request, { params });
        await expectForbidden(response);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 404 when user does not exist', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn()
                .mockResolvedValueOnce({
                  data: { type: UserType.ADMIN },
                  error: null,
                })
                .mockResolvedValueOnce({
                  data: null,
                  error: null,
                }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = createGetRequest(
          'http://localhost:3000/api/users/nonexistent-123/settings'
        );
        const params = { userId: 'nonexistent-123' };

        const response = await GET(request, { params });
        await expectErrorResponse(response, 404, /User not found/i);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle permission verification errors', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('Database error'),
              }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/settings'
        );
        const params = { userId: 'user-456' };

        const response = await GET(request, { params });
        await expectErrorResponse(response, 500, /Failed to verify permissions/i);
      });

      it('should handle settings fetch errors', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn()
                .mockResolvedValueOnce({
                  data: { type: UserType.ADMIN },
                  error: null,
                })
                .mockResolvedValueOnce({
                  data: null,
                  error: new Error('Database timeout'),
                }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = createGetRequest(
          'http://localhost:3000/api/users/user-456/settings'
        );
        const params = { userId: 'user-456' };

        const response = await GET(request, { params });
        await expectErrorResponse(response, 500, /Failed to fetch user settings/i);
      });
    });
  });

  describe('PATCH /api/users/[userId]/settings - Update User Settings', () => {
    describe('✅ Successful Update', () => {
      it('should update user settings by SUPER_ADMIN', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        const updatedUser = {
          id: 'user-456',
          type: UserType.ADMIN,
          status: UserStatus.ACTIVE,
          isTemporaryPassword: false,
        };

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              update: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { type: UserType.SUPER_ADMIN },
                error: null,
              }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;
        mockSupabaseClient.from().update().eq().select = jest.fn().mockResolvedValue({
          data: [updatedUser],
          error: null,
        });

        const request = new Request(
          'http://localhost:3000/api/users/user-456/settings',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: UserType.ADMIN,
              status: UserStatus.ACTIVE,
              isTemporaryPassword: false,
            }),
          }
        );
        const params = { userId: 'user-456' };

        const response = await PATCH(request, { params });
        const data = await expectSuccessResponse(response, 200);

        expect(data.message).toMatch(/updated successfully/i);
        expect(data.data.type).toBe(UserType.ADMIN);
        expect(data.data.status).toBe(UserStatus.ACTIVE);
      });
    });

    describe('🔒 Authorization Tests - SUPER_ADMIN Only', () => {
      it('should return 403 for ADMIN users (not SUPER_ADMIN)', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { type: UserType.ADMIN },
                error: null,
              }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = new Request(
          'http://localhost:3000/api/users/user-456/settings',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: UserType.CLIENT,
              status: UserStatus.ACTIVE,
              isTemporaryPassword: false,
            }),
          }
        );
        const params = { userId: 'user-456' };

        const response = await PATCH(request, { params });
        await expectForbidden(response, /Only super admins can update user settings/i);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 for invalid user type', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { type: UserType.SUPER_ADMIN },
                error: null,
              }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = new Request(
          'http://localhost:3000/api/users/user-456/settings',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'INVALID_TYPE',
              status: UserStatus.ACTIVE,
              isTemporaryPassword: false,
            }),
          }
        );
        const params = { userId: 'user-456' };

        const response = await PATCH(request, { params });
        await expectErrorResponse(response, 400, /Invalid user type provided/i);
      });

      it('should return 400 for invalid user status', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { type: UserType.SUPER_ADMIN },
                error: null,
              }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = new Request(
          'http://localhost:3000/api/users/user-456/settings',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: UserType.CLIENT,
              status: 'INVALID_STATUS',
              isTemporaryPassword: false,
            }),
          }
        );
        const params = { userId: 'user-456' };

        const response = await PATCH(request, { params });
        await expectErrorResponse(response, 400, /Invalid user status provided/i);
      });

      it('should return 400 for invalid isTemporaryPassword value', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        const mockFrom = jest.fn().mockImplementation((table) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { type: UserType.SUPER_ADMIN },
                error: null,
              }),
            };
          }
          return mockSupabaseClient.from(table);
        });

        mockSupabaseClient.from = mockFrom;

        const request = new Request(
          'http://localhost:3000/api/users/user-456/settings',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: UserType.CLIENT,
              status: UserStatus.ACTIVE,
              isTemporaryPassword: 'not-a-boolean',
            }),
          }
        );
        const params = { userId: 'user-456' };

        const response = await PATCH(request, { params });
        await expectErrorResponse(response, 400, /isTemporaryPassword must be a boolean/i);
      });
    });
  });
});
