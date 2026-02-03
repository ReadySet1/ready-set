/**
 * Tests for useDriverHistory hook (REA-313)
 */

import { renderHook, waitFor, act } from "@testing-library/react";
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

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => "blob:test-url");
global.URL.revokeObjectURL = jest.fn();

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { useDriverHistory, useExportDriverHistory } from "../useDriverHistory";

describe("useDriverHistory", () => {
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

  const mockDriverHistory = {
    driver: {
      id: "driver-123",
      name: "John Driver",
      email: "john@example.com",
      employeeId: "EMP001",
      vehicleNumber: "V123",
    },
    period: {
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2024-03-01T00:00:00Z",
    },
    summary: {
      totalShifts: 45,
      completedShifts: 40,
      totalHours: 186.5,
      totalDeliveries: 312,
      totalMiles: 1245,
      gpsMiles: 1200,
    },
    weeklySummaries: [
      {
        weekStart: "2024-02-26T00:00:00Z",
        weekEnd: "2024-03-03T00:00:00Z",
        year: 2024,
        weekNumber: 9,
        totalShifts: 5,
        completedShifts: 5,
        totalShiftHours: 40,
        totalDeliveries: 35,
        completedDeliveries: 35,
        totalMiles: 150,
        gpsMiles: 145,
      },
    ],
    recentShifts: [],
    archivedShifts: [],
    includesArchivedData: false,
  };

  it("should fetch driver history successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockDriverHistory),
    });

    const { result } = renderHook(
      () => useDriverHistory("driver-123"),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockDriverHistory);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/drivers/driver-123/history",
      expect.objectContaining({
        credentials: "include",
      })
    );
  });

  it("should pass date range parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockDriverHistory),
    });

    const { result } = renderHook(
      () =>
        useDriverHistory("driver-123", {
          params: {
            startDate: "2024-01-01",
            endDate: "2024-03-01",
            includeArchived: true,
          },
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("startDate=2024-01-01"),
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("endDate=2024-03-01"),
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("includeArchived=true"),
      expect.any(Object)
    );
  });

  it("should not fetch when driverId is empty", () => {
    renderHook(() => useDriverHistory(""), { wrapper });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should handle fetch errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: jest.fn().mockResolvedValue({ error: "Driver not found" }),
    });

    const { result } = renderHook(
      () => useDriverHistory("invalid-id"),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("Driver not found");
  });
});

describe("useExportDriverHistory", () => {
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
        mutations: {
          retry: false,
        },
      },
    });
    mockFetch.mockClear();
    document.body.innerHTML = "";
  });

  it("should export PDF successfully", async () => {
    const mockBlob = new Blob(["PDF content"], { type: "application/pdf" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: jest.fn().mockResolvedValue(mockBlob),
      headers: new Headers({
        "content-disposition": 'attachment; filename="driver-history.pdf"',
      }),
    });

    const onSuccess = jest.fn();
    const { result } = renderHook(
      () => useExportDriverHistory("driver-123", { onSuccess }),
      { wrapper }
    );

    await act(async () => {
      result.current.mutate({ format: "pdf" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/drivers/driver-123/history/export"),
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("format=pdf"),
      expect.any(Object)
    );
  });

  it("should export CSV successfully", async () => {
    const mockBlob = new Blob(["CSV content"], { type: "text/csv" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: jest.fn().mockResolvedValue(mockBlob),
      headers: new Headers({}),
    });

    const { result } = renderHook(
      () => useExportDriverHistory("driver-123"),
      { wrapper }
    );

    await act(async () => {
      result.current.mutate({
        format: "csv",
        params: { startDate: "2024-01-01", endDate: "2024-03-01" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("format=csv"),
      expect.any(Object)
    );
  });

  it("should handle export errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: jest.fn().mockResolvedValue({ error: "Export failed" }),
    });

    const onError = jest.fn();
    const { result } = renderHook(
      () => useExportDriverHistory("driver-123", { onError }),
      { wrapper }
    );

    await act(async () => {
      result.current.mutate({ format: "pdf" });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Export failed" })
    );
  });
});
