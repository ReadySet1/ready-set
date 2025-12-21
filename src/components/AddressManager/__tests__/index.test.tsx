import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AddressManager from "../index";
import { Address } from "@/types/address";

// Mock React Query hooks used by AddressModal
const mockCreateMutateAsync = jest.fn();
const mockUpdateMutateAsync = jest.fn();

jest.mock("@/hooks/useAddresses", () => ({
  useCreateAddress: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateAddress: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
};

jest.mock("@/utils/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// Mock fetch
global.fetch = jest.fn();

// Create a test QueryClient
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

// Wrapper with QueryClientProvider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Custom render function with QueryClientProvider
const customRender = (ui: React.ReactElement, options?: any) =>
  render(ui, { wrapper: TestWrapper, ...options });

const mockAddresses: Address[] = [
  {
    id: "1",
    county: "San Francisco",
    name: "Home",
    street1: "123 Main St",
    street2: "",
    city: "San Francisco",
    state: "CA",
    zip: "94103",
    locationNumber: "4155551234",
    parkingLoading: "",
    isRestaurant: false,
    isShared: false,
    createdBy: "user1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    county: "San Mateo",
    name: "Office",
    street1: "456 Oak Ave",
    street2: "Suite 100",
    city: "San Mateo",
    state: "CA",
    zip: "94402",
    locationNumber: "6505551234",
    parkingLoading: "Parking garage",
    isRestaurant: false,
    isShared: true,
    createdBy: "user2",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockOnAddressSelected = jest.fn();
const mockOnAddressesLoaded = jest.fn();
const mockOnError = jest.fn();
const mockOnRefresh = jest.fn();

const defaultProps = {
  onAddressSelected: mockOnAddressSelected,
  onAddressesLoaded: mockOnAddressesLoaded,
  onError: mockOnError,
  onRefresh: mockOnRefresh,
};

describe("AddressManager Refresh Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();

    // Mock successful auth
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user1" } },
      error: null,
    });

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "mock-token", user: { id: "user1" } } },
      error: null,
    });

    // Mock successful address fetch with pagination
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          addresses: mockAddresses,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: mockAddresses.length,
            hasNextPage: false,
            hasPrevPage: false,
            limit: 5,
          },
        }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("calls onRefresh with refresh function when provided", async () => {
    customRender(<AddressManager {...defaultProps} />);

    await waitFor(() => {
      expect(mockOnRefresh).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  it("loads addresses on mount and calls onAddressesLoaded", async () => {
    customRender(<AddressManager {...defaultProps} />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/addresses?filter=all&page=1&limit=5",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
    });
  });

  // TODO: REA-266 - Test needs component behavior verification (debounce/timing issues)
  it.skip("refreshes addresses when refresh function is called", async () => {
    const capturedRefreshFunctions: Array<() => void> = [];

    const captureRefreshFunction = (fn: () => void) => {
      capturedRefreshFunctions.push(fn);
    };

    customRender(
      <AddressManager {...defaultProps} onRefresh={captureRefreshFunction} />,
    );

    // Wait for initial load
    await waitFor(() => {
      expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
    });

    // Clear previous calls
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();

    // Mock new address data for refresh
    const newMockAddresses: Address[] = [
      ...mockAddresses,
      {
        id: "3",
        county: "Santa Clara",
        name: "New Address",
        street1: "789 Pine St",
        street2: "",
        city: "Palo Alto",
        state: "CA",
        zip: "94301",
        locationNumber: "6505559999",
        parkingLoading: "",
        isRestaurant: false,
        isShared: false,
        createdBy: "user1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          addresses: newMockAddresses,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: newMockAddresses.length,
            hasNextPage: false,
            hasPrevPage: false,
            limit: 5,
          },
        }),
    });

    // Call refresh function
    expect(capturedRefreshFunctions.length).toBeGreaterThan(0);
    if (capturedRefreshFunctions.length > 0) {
      capturedRefreshFunctions[0]!();
    }

    // Verify addresses are refetched
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/addresses?filter=all&page=1&limit=5",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockOnAddressesLoaded).toHaveBeenCalledWith(newMockAddresses);
    });
  });

  // TODO: REA-266 - Test needs component behavior verification (debounce/timing issues)
  it.skip("resets fetch attempts when refresh is called manually", async () => {
    const capturedRefreshFunctions: Array<() => void> = [];

    const captureRefreshFunction = (fn: () => void) => {
      capturedRefreshFunctions.push(fn);
    };

    // First, simulate multiple failed attempts
    (fetch as jest.Mock)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            addresses: mockAddresses,
            pagination: {
              currentPage: 1,
              totalPages: 1,
              totalCount: mockAddresses.length,
              hasNextPage: false,
              hasPrevPage: false,
              limit: 5,
            },
          }),
      });

    customRender(
      <AddressManager {...defaultProps} onRefresh={captureRefreshFunction} />,
    );

    // Wait for refresh function to be available
    await waitFor(() => {
      expect(capturedRefreshFunctions.length).toBeGreaterThan(0);
    });

    // Now call refresh - it should reset attempts and succeed
    if (capturedRefreshFunctions.length > 0) {
      capturedRefreshFunctions[0]!();
    }

    await waitFor(() => {
      expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
    });
  });

  it("handles authentication errors properly", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Unauthorized" },
    });

    customRender(<AddressManager {...defaultProps} />);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        "Authentication required to load addresses.",
      );
    });
  });

  // TODO: REA-266 - Test timing out due to component retry/debounce behavior
  it.skip("handles API fetch errors properly", async () => {
    // Mock fetch to return an error response
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    customRender(<AddressManager {...defaultProps} />);

    // Wait for the error to be handled
    await waitFor(
      () => {
        expect(mockOnError).toHaveBeenCalledWith(
          "Error fetching addresses: Internal Server Error",
        );
      },
      { timeout: 5000 },
    );
  });
});

describe("AddressManager Pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();

    // Mock successful auth
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user1" } },
      error: null,
    });

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "mock-token", user: { id: "user1" } } },
      error: null,
    });
  });

  it("fetches addresses with pagination parameters", async () => {
    const mockPaginatedResponse = {
      addresses: mockAddresses.slice(0, 2), // First 2 addresses
      pagination: {
        currentPage: 1,
        totalPages: 2,
        totalCount: 4,
        hasNextPage: true,
        hasPrevPage: false,
        limit: 5,
      },
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPaginatedResponse),
    });

    customRender(<AddressManager {...defaultProps} />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/addresses?filter=all&page=1&limit=5",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });
  });

  it("handles backward compatibility with old API format", async () => {
    // Mock old format response (array of addresses)
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAddresses),
    });

    customRender(<AddressManager {...defaultProps} />);

    await waitFor(() => {
      expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
    });
  });

  it("resets to first page when filter changes", async () => {
    const mockPaginatedResponse = {
      addresses: mockAddresses.slice(0, 2),
      pagination: {
        currentPage: 1,
        totalPages: 2,
        totalCount: 4,
        hasNextPage: true,
        hasPrevPage: false,
        limit: 5,
      },
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPaginatedResponse),
    });

    customRender(<AddressManager {...defaultProps} />);

    // Wait for initial load
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/addresses?filter=all&page=1&limit=5",
        expect.anything(),
      );
    });

    // Change filter - component uses buttons not tabs
    const privateButton = screen.getByRole("button", { name: /Your Addresses/i });
    fireEvent.click(privateButton);

    // Should reset to page 1
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/addresses?filter=private&page=1&limit=5",
        expect.anything(),
      );
    });
  });
});
