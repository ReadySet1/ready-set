/**
 * Unit Tests for useAuditHistory Hook
 *
 * Tests for:
 * - Hook exports and default values
 * - Basic hook structure
 *
 * Note: Full integration tests for the hook would require mocking
 * both Supabase auth and fetch. Those are covered by the API integration tests.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { ReactNode } from "react";
import { useAuditHistory, useExportAuditHistory, DEFAULT_AUDIT_PAGINATION } from "../useAuditHistory";

// Mock Supabase client
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "test-user-id" } },
        error: null,
      }),
    },
  })),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Create wrapper for React Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useAuditHistory Hook", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("DEFAULT_AUDIT_PAGINATION", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_AUDIT_PAGINATION.page).toBe(1);
      expect(DEFAULT_AUDIT_PAGINATION.limit).toBe(20);
    });
  });

  describe("useAuditHistory", () => {
    it("should return loading state initially", () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          logs: [],
          pagination: {
            page: 1,
            limit: 20,
            total_count: 0,
            total_pages: 0,
            has_next_page: false,
            has_prev_page: false,
          },
          filters: { available_actions: [] },
        }),
      });

      const { result } = renderHook(
        () => useAuditHistory("user-123", { page: 1, limit: 20 }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
    });

    it("should fetch data and transform response", async () => {
      const mockResponse = {
        logs: [
          {
            id: "audit-1",
            user_id: "user-123",
            action: "UPDATE",
            performed_by: "admin-1",
            performer_name: "Admin User",
            performer_email: "admin@test.com",
            performer_image: null,
            changes: { before: { name: "Old" }, after: { name: "New" } },
            reason: "Profile update",
            metadata: null,
            created_at: "2024-01-15T10:00:00Z",
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total_count: 1,
          total_pages: 1,
          has_next_page: false,
          has_prev_page: false,
        },
        filters: { available_actions: ["UPDATE"] },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(
        () => useAuditHistory("user-123", { page: 1, limit: 20 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check data is transformed to camelCase
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.logs[0].userId).toBe("user-123");
      expect(result.current.data?.logs[0].performerName).toBe("Admin User");
      expect(result.current.data?.pagination.totalCount).toBe(1);
      expect(result.current.data?.pagination.hasNextPage).toBe(false);
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Failed to fetch" }),
      });

      const { result } = renderHook(
        () => useAuditHistory("user-123", { page: 1, limit: 20 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
    });

    it("should be disabled when userId is empty", () => {
      const { result } = renderHook(
        () => useAuditHistory("", { page: 1, limit: 20 }),
        { wrapper: createWrapper() }
      );

      // Query should not be loading because it's disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);
    });
  });

  describe("useExportAuditHistory", () => {
    beforeEach(() => {
      // Mock URL.createObjectURL and URL.revokeObjectURL
      global.URL.createObjectURL = jest.fn(() => "mock-url");
      global.URL.revokeObjectURL = jest.fn();
    });

    it("should return mutation functions", () => {
      const { result } = renderHook(
        () => useExportAuditHistory("user-123"),
        { wrapper: createWrapper() }
      );

      expect(typeof result.current.mutate).toBe("function");
      expect(typeof result.current.mutateAsync).toBe("function");
      expect(result.current.isPending).toBe(false);
    });

    it("should call export API when mutate is called", async () => {
      const csvContent = "Date,Action,Performer\n2024-01-15,UPDATE,Admin";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob([csvContent], { type: "text/csv" }),
      });

      const { result } = renderHook(
        () => useExportAuditHistory("user-123"),
        { wrapper: createWrapper() }
      );

      // Mock DOM methods after render
      const mockLink = {
        href: "",
        download: "",
        click: jest.fn(),
        remove: jest.fn(),
      };
      const createElementSpy = jest.spyOn(document, "createElement").mockReturnValueOnce(mockLink as unknown as HTMLAnchorElement);
      const appendChildSpy = jest.spyOn(document.body, "appendChild").mockImplementation(() => mockLink as unknown as HTMLAnchorElement);

      // Trigger export
      result.current.mutate({});

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Check that the export endpoint was called
      const fetchCall = mockFetch.mock.calls[0][0];
      expect(fetchCall).toContain("/api/users/user-123/audit/export");

      // Cleanup
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
    });
  });
});
