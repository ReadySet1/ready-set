import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';
import {
  useBulkUserOperations,
  BulkOperationError,
  USERS_QUERY_KEY,
  DELETED_USERS_QUERY_KEY,
} from '../useBulkUserOperations';
import { createClient } from '@/utils/supabase/client';

const mockFetch = global.fetch as jest.Mock;
const mockCreateClient = createClient as jest.Mock;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function setupAuthenticatedClient() {
  mockCreateClient.mockReturnValue({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-token',
            user: { id: 'admin-id' },
          },
        },
      }),
    },
  });
}

const mockSuccessResponse = {
  success: true,
  results: {
    totalRequested: 3,
    totalSuccess: 3,
    totalFailed: 0,
    failures: [],
  },
};

describe('BulkOperationError', () => {
  it('should include results in the error', () => {
    const results = { totalRequested: 2, totalSuccess: 1, totalFailed: 1, failures: [] };
    const error = new BulkOperationError('Partial failure', results as any);

    expect(error.message).toBe('Partial failure');
    expect(error.name).toBe('BulkOperationError');
    expect(error.results).toEqual(results);
  });
});

describe('useBulkUserOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuthenticatedClient();
  });

  describe('auth header retrieval', () => {
    it('should throw when no session exists', async () => {
      mockCreateClient.mockReturnValue({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
          }),
        },
      });

      const onStatusChangeError = jest.fn();
      const { result } = renderHook(
        () => useBulkUserOperations({ onStatusChangeError }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.bulkStatusChangeMutation.mutate({
          userIds: ['user-1'],
          status: 'ACTIVE' as any,
        });
      });

      await waitFor(() => {
        expect(result.current.bulkStatusChangeMutation.isError).toBe(true);
      });
    });
  });

  describe('bulkStatusChangeMutation', () => {
    it('should POST to status endpoint and call onSuccess', async () => {
      const onStatusChangeSuccess = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(
        () => useBulkUserOperations({ onStatusChangeSuccess }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.bulkStatusChangeMutation.mutate({
          userIds: ['user-1', 'user-2'],
          status: 'ACTIVE' as any,
        });
      });

      await waitFor(() => {
        expect(onStatusChangeSuccess).toHaveBeenCalledWith(mockSuccessResponse);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/bulk/status',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });

    it('should call onStatusChangeError on failure', async () => {
      const onStatusChangeError = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Permission denied', results: null }),
      });

      const { result } = renderHook(
        () => useBulkUserOperations({ onStatusChangeError }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.bulkStatusChangeMutation.mutate({
          userIds: ['user-1'],
          status: 'ACTIVE' as any,
        });
      });

      await waitFor(() => {
        expect(onStatusChangeError).toHaveBeenCalled();
      });

      const error = onStatusChangeError.mock.calls[0][0];
      expect(error.message).toBe('Permission denied');
    });
  });

  describe('bulkRoleChangeMutation', () => {
    it('should POST to role endpoint', async () => {
      const onRoleChangeSuccess = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(
        () => useBulkUserOperations({ onRoleChangeSuccess }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.bulkRoleChangeMutation.mutate({
          userIds: ['user-1'],
          role: 'VENDOR' as any,
        });
      });

      await waitFor(() => {
        expect(onRoleChangeSuccess).toHaveBeenCalledWith(mockSuccessResponse);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/bulk/role',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('bulkDeleteMutation', () => {
    it('should POST to delete endpoint and call onSuccess', async () => {
      const onDeleteSuccess = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(
        () => useBulkUserOperations({ onDeleteSuccess }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.bulkDeleteMutation.mutate({
          userIds: ['user-1', 'user-2'],
          reason: 'Account cleanup',
        });
      });

      await waitFor(() => {
        expect(onDeleteSuccess).toHaveBeenCalledWith(mockSuccessResponse);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/bulk/delete',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should call onDeleteError on failure', async () => {
      const onDeleteError = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to delete users' }),
      });

      const { result } = renderHook(
        () => useBulkUserOperations({ onDeleteError }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.bulkDeleteMutation.mutate({
          userIds: ['user-1'],
          reason: 'Cleanup',
        });
      });

      await waitFor(() => {
        expect(onDeleteError).toHaveBeenCalled();
      });
    });
  });

  describe('bulkRestoreMutation', () => {
    it('should POST to restore endpoint', async () => {
      const onRestoreSuccess = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(
        () => useBulkUserOperations({ onRestoreSuccess }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.bulkRestoreMutation.mutate({
          userIds: ['user-1'],
        });
      });

      await waitFor(() => {
        expect(onRestoreSuccess).toHaveBeenCalledWith(mockSuccessResponse);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/bulk/restore',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('bulkEmailMutation', () => {
    it('should POST to email endpoint', async () => {
      const onEmailSuccess = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(
        () => useBulkUserOperations({ onEmailSuccess }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.bulkEmailMutation.mutate({
          userIds: ['user-1'],
          subject: 'Test',
          body: 'Hello',
        } as any);
      });

      await waitFor(() => {
        expect(onEmailSuccess).toHaveBeenCalledWith(mockSuccessResponse);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/bulk/email',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should call onEmailError on failure', async () => {
      const onEmailError = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to send email' }),
      });

      const { result } = renderHook(
        () => useBulkUserOperations({ onEmailError }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.bulkEmailMutation.mutate({
          userIds: ['user-1'],
          subject: 'Test',
          body: 'Hello',
        } as any);
      });

      await waitFor(() => {
        expect(onEmailError).toHaveBeenCalled();
      });
    });
  });

  describe('bulkExportMutation', () => {
    it('should GET from export endpoint and trigger download', async () => {
      const onExportSuccess = jest.fn();
      const mockBlob = new Blob(['csv,data'], { type: 'text/csv' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      // Mock URL APIs
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();

      // Render hook first, then spy on DOM methods
      const { result } = renderHook(
        () => useBulkUserOperations({ onExportSuccess }),
        { wrapper: createWrapper() }
      );

      const mockLink = { href: '', download: '', click: jest.fn() };
      const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValueOnce(mockLink as any);
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

      await act(async () => {
        result.current.bulkExportMutation.mutate({
          userIds: ['user-1', 'user-2'],
        });
      });

      await waitFor(() => {
        expect(onExportSuccess).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/bulk/export'),
        expect.objectContaining({ method: 'GET' })
      );

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('should pass filter params for export', async () => {
      const mockBlob = new Blob(['csv'], { type: 'text/csv' });
      mockFetch.mockResolvedValueOnce({ ok: true, blob: async () => mockBlob });

      global.URL.createObjectURL = jest.fn(() => 'blob:url');
      global.URL.revokeObjectURL = jest.fn();

      // Render hook first, then spy on DOM methods
      const { result } = renderHook(
        () => useBulkUserOperations(),
        { wrapper: createWrapper() }
      );

      const mockLink = { href: '', download: '', click: jest.fn() };
      const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValueOnce(mockLink as any);
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

      await act(async () => {
        result.current.bulkExportMutation.mutate({
          status: 'ACTIVE' as any,
          type: 'VENDOR' as any,
          includeDeleted: true,
        });
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const exportUrl = mockFetch.mock.calls[0][0] as string;
      expect(exportUrl).toContain('status=ACTIVE');
      expect(exportUrl).toContain('type=VENDOR');
      expect(exportUrl).toContain('includeDeleted=true');

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });

  describe('isAnyLoading', () => {
    it('should be false when no mutations are pending', () => {
      const { result } = renderHook(
        () => useBulkUserOperations(),
        { wrapper: createWrapper() }
      );

      expect(result.current.isAnyLoading).toBe(false);
    });
  });

  describe('query key constants', () => {
    it('should export correct query key constants', () => {
      expect(USERS_QUERY_KEY).toBe('users');
      expect(DELETED_USERS_QUERY_KEY).toBe('deletedUsers');
    });
  });
});
