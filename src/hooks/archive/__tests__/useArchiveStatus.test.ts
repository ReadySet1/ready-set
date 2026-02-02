/**
 * Tests for useArchiveStatus hook (REA-313)
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock Supabase client
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "test-user-id" } },
        error: null,
      }),
    },
  }),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { useArchiveStatus } from "../useArchiveStatus";

describe("useArchiveStatus", () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    mockFetch.mockClear();
  });

  const mockArchiveStatus = {
    timestamp: "2024-01-15T10:00:00Z",
    metrics: {
      driverLocations: {
        eligibleCount: 100,
        oldestDate: "2024-01-01T00:00:00Z",
        activeCount: 5000,
        archivedCount: 10000,
      },
      driverShifts: {
        eligibleCount: 50,
        oldestDate: "2024-01-05T00:00:00Z",
        activeCount: 200,
        archivedCount: 500,
      },
      orders: {
        eligibleCateringCount: 20,
        eligibleOnDemandCount: 30,
        totalEligibleCount: 50,
        oldestCateringDate: "2024-01-02T00:00:00Z",
        oldestOnDemandDate: "2024-01-03T00:00:00Z",
        archivedCateringCount: 100,
        archivedOnDemandCount: 150,
        totalArchivedCount: 250,
      },
      weeklySummaries: {
        count: 100,
      },
    },
    recentBatches: [],
    configuration: {
      locationsRetentionDays: 30,
      ordersRetentionDays: 30,
      shiftsRetentionWeeks: 5,
      batchSize: 1000,
      dryRunEnabled: false,
    },
  };

  it("should fetch archive status successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockArchiveStatus),
    });

    const { result } = renderHook(() => useArchiveStatus(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockArchiveStatus);
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/archive-status", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("should handle fetch errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
    });

    const { result } = renderHook(() => useArchiveStatus(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("Unauthorized");
  });

  it("should not fetch when disabled", async () => {
    renderHook(() => useArchiveStatus({ enabled: false }), { wrapper });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should use correct cache times", () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockArchiveStatus),
    });

    renderHook(() => useArchiveStatus(), { wrapper });

    const queryState = queryClient.getQueryCache().getAll()[0];
    expect(queryState?.options.staleTime).toBe(5 * 60 * 1000);
    expect(queryState?.options.gcTime).toBe(10 * 60 * 1000);
  });
});
