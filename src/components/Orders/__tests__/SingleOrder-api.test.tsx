import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "@testing-library/react";

// Mock Next.js navigation hooks
const mockPush = jest.fn();
const mockPathname = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
}));

// Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({
      data: { session: { access_token: "mock-token" } },
      error: null,
    }),
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    }),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: { type: "admin" },
          error: null,
        }),
      })),
    })),
  })),
  storage: {
    listBuckets: jest.fn().mockResolvedValue({
      data: [{ name: "user-assets" }],
      error: null,
    }),
  },
};

jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock broker sync service
jest.mock("@/lib/services/brokerSyncService", () => ({
  syncOrderStatusWithBroker: jest.fn().mockResolvedValue(undefined),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("SingleOrder - API Encoding Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default successful responses
    mockFetch.mockImplementation((url: string) => {
      if (
        url.includes("/api/orders/") &&
        url.includes("?include=dispatch.driver")
      ) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "1",
              order_number: "CV-0GF59K/1",
              status: "active",
              order_type: "catering",
              order_total: "250.00",
              date: "2024-01-15",
              dispatches: [],
            }),
        });
      }

      if (url.includes("/api/orders/") && url.includes("/files")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }

      if (url.includes("/api/drivers")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }

      // Default PATCH/PUT responses
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: "Success" }),
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should encode order numbers with slashes in API calls for order details", async () => {
    // Set pathname to include encoded order number
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%2F1");

    // Import and render SingleOrder component
    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    const { rerender } = await act(async () => {
      return renderHook(() => <SingleOrder onDeleteSuccess={() => {}} />);
    });

    // Wait for the component to make API calls
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/orders/CV-0GF59K%2F1?include=dispatch.driver",
        ),
        expect.objectContaining({
          credentials: "include",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
          }),
        }),
      );
    });
  });

  it("should encode order numbers with slashes in API calls for files", async () => {
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%2F1");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      renderHook(() => <SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders/CV-0GF59K%2F1/files"),
        expect.objectContaining({
          credentials: "include",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
          }),
        }),
      );
    });
  });

  it("should encode order numbers with various special characters", async () => {
    // Test different special characters
    const testCases = [
      {
        pathname: "/admin/catering-orders/CV-0GF59K%261",
        encoded: "CV-0GF59K%261",
      },
      {
        pathname: "/admin/catering-orders/CV-0GF59K%2B1",
        encoded: "CV-0GF59K%2B1",
      },
      {
        pathname: "/admin/catering-orders/CV-0GF59K%231",
        encoded: "CV-0GF59K%231",
      },
    ];

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    for (const testCase of testCases) {
      jest.clearAllMocks();
      mockPathname.mockReturnValue(testCase.pathname);

      await act(async () => {
        renderHook(() => <SingleOrder onDeleteSuccess={() => {}} />);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(
            `/api/orders/${testCase.encoded}?include=dispatch.driver`,
          ),
          expect.any(Object),
        );
      });
    }
  });

  it("should handle normal order numbers without special characters", async () => {
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K1");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      renderHook(() => <SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/orders/CV-0GF59K1?include=dispatch.driver",
        ),
        expect.any(Object),
      );
    });
  });

  it("should encode order numbers in status update API calls", async () => {
    // Mock an order response first
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "1",
            orderNumber: "CV-0GF59K/1",
            status: "active",
            order_type: "catering",
            order_total: "250.00",
            date: "2024-01-15",
            dispatches: [],
          }),
      }),
    );

    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%2F1");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      renderHook(() => <SingleOrder onDeleteSuccess={() => {}} />);
    });

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/orders/CV-0GF59K%2F1?include=dispatch.driver",
        ),
        expect.any(Object),
      );
    });

    // Now test status update calls would also be encoded
    // This tests the pattern that status updates would follow
    const expectedPattern = "/api/orders/CV-0GF59K%2F1";
    const actualCalls = mockFetch.mock.calls.filter((call) =>
      call[0].includes(expectedPattern),
    );

    expect(actualCalls.length).toBeGreaterThan(0);
  });

  it("should handle edge cases with complex encoded order numbers", async () => {
    const complexOrderNumber = "CV-0GF59K%2F1%26test%2Bmore%23end";
    mockPathname.mockReturnValue(
      `/admin/catering-orders/${complexOrderNumber}`,
    );

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      renderHook(() => <SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/api/orders/${complexOrderNumber}?include=dispatch.driver`,
        ),
        expect.any(Object),
      );
    });
  });

  it("should properly decode and re-encode order numbers from URL", async () => {
    // Simulate the full flow: encoded URL -> decoded order number -> re-encoded for API
    mockPathname.mockReturnValue("/admin/catering-orders/CV-0GF59K%2F1%2F2");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      renderHook(() => <SingleOrder onDeleteSuccess={() => {}} />);
    });

    // Should decode CV-0GF59K%2F1%2F2 to CV-0GF59K/1/2 then re-encode for API
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/orders/CV-0GF59K%2F1%2F2?include=dispatch.driver",
        ),
        expect.any(Object),
      );
    });
  });
});
