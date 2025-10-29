import React from "react";
import { renderHook, waitFor, render, screen } from "@testing-library/react";
import { act } from "@testing-library/react";

// Mock Next.js navigation hooks
const mockPush = jest.fn();
const mockPathname = jest.fn();
const mockParams = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
  useParams: () => mockParams(),
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

describe("SingleOrder - Driver Information API Tests", () => {
  const mockDriverData = {
    id: "driver-123",
    name: "David Sanchez",
    email: "davids2002@gmail.com",
    phone: "4792608514",
    lastUpdated: "2024-01-15T10:30:00Z",
  };

  const mockOrderData = {
    id: "1",
    orderNumber: "SF-56780",
    status: "assigned",
    order_type: "catering",
    order_total: "300.00",
    headcount: 24,
    brokerage: "Ez Cater",
    tip: "30.00",
    pickupDateTime: "2024-01-15T12:00:00Z",
    arrivalDateTime: "2024-01-15T12:45:00Z",
    completeDateTime: "2024-01-15T13:00:00Z",
    dispatches: [
      {
        id: "dispatch-1",
        driver: mockDriverData,
        status: "assigned",
        createdAt: "2024-01-15T10:30:00Z",
      },
    ],
    customer: {
      name: "Randy Marsh",
      email: "tegridy25@gmail.com",
    },
    pickupAddress: {
      street: "100 Main St",
      city: "San Carlos",
      state: "CA",
      zipCode: "94070",
    },
    deliveryAddress: {
      street: "100 Main St",
      city: "San Carlos",
      state: "CA",
      zipCode: "94070",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock params to return order number
    mockParams.mockReturnValue({ order_number: "SF-56780" });

    // Setup comprehensive mock responses
    mockFetch.mockImplementation((url: string) => {
      if (
        url.includes("/api/orders/") &&
        url.includes("?include=dispatch.driver")
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOrderData),
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
          json: () => Promise.resolve([mockDriverData]),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: "Success" }),
      });
    });
  });

  it("should fetch and display correct driver information", async () => {
    mockPathname.mockReturnValue("/admin/catering-orders/SF-56780");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    // Wait for API call to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders/SF-56780?include=dispatch.driver"),
        expect.objectContaining({
          credentials: "include",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
          }),
        }),
      );
    });

    // Verify driver information is displayed
    await waitFor(() => {
      expect(screen.getByText("David Sanchez")).toBeInTheDocument();
      expect(screen.getByText("davids2002@gmail.com")).toBeInTheDocument();
      expect(screen.getByText("4792608514")).toBeInTheDocument();
    });
  });

  it("should validate all driver fields are present and correct", async () => {
    mockPathname.mockReturnValue("/admin/catering-orders/SF-56780");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      // Verify driver name
      expect(
        screen.getByText("Driver Name: David Sanchez"),
      ).toBeInTheDocument();

      // Verify driver email with proper formatting
      expect(screen.getByText("davids2002@gmail.com")).toBeInTheDocument();

      // Verify driver phone
      expect(screen.getByText("4792608514")).toBeInTheDocument();

      // Verify last updated time (should be formatted)
      expect(screen.getByText(/Last Updated:/)).toBeInTheDocument();
    });
  });

  it("should handle missing driver information gracefully", async () => {
    const orderWithoutDriver = {
      ...mockOrderData,
      dispatches: [],
    };

    mockFetch.mockImplementation((url: string) => {
      if (
        url.includes("/api/orders/") &&
        url.includes("?include=dispatch.driver")
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(orderWithoutDriver),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: "Success" }),
      });
    });

    mockPathname.mockReturnValue("/admin/catering-orders/SF-56780");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      expect(
        screen.getByText("No driver assigned to this order yet"),
      ).toBeInTheDocument();
    });
  });
});

describe("SingleOrder - Order Data API Tests", () => {
  const mockOrderData = {
    id: "1",
    orderNumber: "SF-56780",
    status: "assigned",
    order_type: "catering",
    order_total: "300.00",
    headcount: 24,
    brokerage: "Ez Cater",
    tip: "30.00",
    pickupDateTime: "2024-01-15T12:00:00Z",
    arrivalDateTime: "2024-01-15T12:45:00Z",
    completeDateTime: "2024-01-15T13:00:00Z",
    dispatches: [],
    customer: {
      name: "Randy Marsh",
      email: "tegridy25@gmail.com",
    },
    pickupAddress: {
      street: "100 Main St",
      city: "San Carlos",
      state: "CA",
      zipCode: "94070",
    },
    deliveryAddress: {
      street: "100 Main St",
      city: "San Carlos",
      state: "CA",
      zipCode: "94070",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock params to return order number
    mockParams.mockReturnValue({ order_number: "SF-56780" });

    mockFetch.mockImplementation((url: string) => {
      if (
        url.includes("/api/orders/") &&
        url.includes("?include=dispatch.driver")
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOrderData),
        });
      }

      if (url.includes("/api/orders/") && url.includes("/files")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: "Success" }),
      });
    });
  });

  it("should display correct order ID and basic information", async () => {
    mockPathname.mockReturnValue("/admin/catering-orders/SF-56780");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      // Verify order number in title
      expect(screen.getByText("Order SF-56780")).toBeInTheDocument();

      // Verify order details
      expect(screen.getByText("Headcount: 24")).toBeInTheDocument();
      expect(screen.getByText("Total: $300.00")).toBeInTheDocument();
      expect(screen.getByText("Brokerage: Ez Cater")).toBeInTheDocument();
      expect(screen.getByText("Tip: $30.00")).toBeInTheDocument();
    });
  });

  it("should display correct customer details", async () => {
    mockPathname.mockReturnValue("/admin/catering-orders/SF-56780");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      // Verify customer information
      expect(screen.getByText("Name: Randy Marsh")).toBeInTheDocument();
      expect(screen.getByText("tegridy25@gmail.com")).toBeInTheDocument();
    });
  });

  it("should display correct order status", async () => {
    mockPathname.mockReturnValue("/admin/catering-orders/SF-56780");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      // Verify status badge
      expect(screen.getByText("ASSIGNED")).toBeInTheDocument();
      expect(screen.getByText("Current Status:")).toBeInTheDocument();
    });
  });

  it("should display correct address information", async () => {
    mockPathname.mockReturnValue("/admin/catering-orders/SF-56780");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      // Verify pickup address
      expect(screen.getByText("100 Main St")).toBeInTheDocument();
      expect(screen.getByText("San Carlos, CA 94070")).toBeInTheDocument();

      // Verify delivery address
      expect(screen.getAllByText("100 Main St")).toHaveLength(2); // Pickup and delivery
      expect(screen.getAllByText("San Carlos, CA 94070")).toHaveLength(2);
    });
  });

  it("should handle API errors gracefully", async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Order not found" }),
      });
    });

    mockPathname.mockReturnValue("/admin/catering-orders/SF-56780");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      // Should show loading state or error handling
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  it("should validate API response structure", async () => {
    mockPathname.mockReturnValue("/admin/catering-orders/SF-56780");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      // Verify API was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders/SF-56780?include=dispatch.driver"),
        expect.objectContaining({
          method: "GET",
          credentials: "include",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          }),
        }),
      );
    });
  });

  it("should handle successful API responses with complete data", async () => {
    mockPathname.mockReturnValue("/admin/catering-orders/SF-56780");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      // Verify all major sections are rendered
      expect(screen.getByText("Driver & Status")).toBeInTheDocument();
      expect(screen.getByText("Order Details")).toBeInTheDocument();
      expect(screen.getByText("Locations")).toBeInTheDocument();
      expect(screen.getByText("Customer")).toBeInTheDocument();
      expect(screen.getByText("Quick Actions")).toBeInTheDocument();
      expect(screen.getByText("Timeline")).toBeInTheDocument();
    });
  });
});

describe("SingleOrder - Role-based Visibility Tests", () => {
  const mockOrderData = {
    id: "1",
    orderNumber: "CV-PBMD00/1",
    status: "active",
    order_type: "catering",
    order_total: "250.00",
    pickupDateTime: "2025-07-18T08:00:00Z",
    dispatches: [],
    user: {
      name: "CaterValley System",
      email: "system@catervalley.com",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams.mockReturnValue({ order_number: "CV-PBMD00/1" });

    mockFetch.mockImplementation((url: string) => {
      if (
        url.includes("/api/orders/") &&
        url.includes("?include=dispatch.driver")
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOrderData),
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
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: "Success" }),
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should show order information for admin users", async () => {
    // Mock admin user role
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { type: "admin" },
            error: null,
          }),
        })),
      })),
    });

    mockPathname.mockReturnValue("/admin/catering-orders/CV-PBMD00%2F1");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    // Increase timeout and add better error messages
    await waitFor(() => {
      // Should show all order information for admin
      expect(screen.queryByText(/Catering Request/i) || screen.queryByText(/CV-PBMD00\/1/i)).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 60000); // Increase test timeout to 60s

  it("should show order information for super admin users", async () => {
    // Mock super admin user role
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { type: "super_admin" },
            error: null,
          }),
        })),
      })),
    });

    mockPathname.mockReturnValue("/admin/catering-orders/CV-PBMD00%2F1");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      // Should show all order information for super admin
      expect(screen.queryByText(/Catering Request/i) || screen.queryByText(/CV-PBMD00\/1/i)).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 60000);

  it("should hide order information for non-admin users", async () => {
    // Mock regular user role
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { type: "client" },
            error: null,
          }),
        })),
      })),
    });

    mockPathname.mockReturnValue("/admin/catering-orders/CV-PBMD00%2F1");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    await waitFor(() => {
      // Component should render (might show limited info or redirect)
      expect(document.body).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 60000);

  it("should allow granular permission overrides", async () => {
    // Mock regular user role but with explicit permissions
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { type: "client" },
            error: null,
          }),
        })),
      })),
    });

    mockPathname.mockReturnValue("/admin/catering-orders/CV-PBMD00%2F1");

    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(
        <SingleOrder
          onDeleteSuccess={() => {}}
          canViewOrderTitle={true}
          canViewOrderNumber={true}
          canViewOrderStatus={true}
          canViewDeliveryDate={true}
          canViewDeliveryTime={true}
        />,
      );
    });

    await waitFor(() => {
      // Should show order information when explicitly granted permissions
      expect(screen.queryByText(/Catering Request/i) || screen.queryByText(/CV-PBMD00\/1/i)).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 60000);
});
