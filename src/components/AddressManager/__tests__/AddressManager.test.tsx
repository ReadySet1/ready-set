import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
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

// Mock fetch
global.fetch = jest.fn();

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

// Helper to set up default mocks - called within each test if needed after mock modifications
const setupDefaultMocks = () => {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: "user1" } },
    error: null,
  });

  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: { access_token: "mock-token", user: { id: "user1" } } },
    error: null,
  });

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
};

describe("AddressManager Refresh Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
    setupDefaultMocks();
  });

  afterEach(() => {
    cleanup();
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

  // TODO: REA-259 - Test needs component behavior verification
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

    // Clear previous fetch calls but keep auth mocks working
    (fetch as jest.Mock).mockClear();
    mockOnAddressesLoaded.mockClear();

    // Re-establish auth mock (cleared by jest.clearAllMocks)
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "mock-token", user: { id: "user1" } } },
      error: null,
    });

    // Mock new address data for refresh
    const newMockAddresses = [
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

  it("displays addresses as clickable cards", async () => {
    customRender(<AddressManager {...defaultProps} />);

    // Wait for addresses to load (skeleton cards disappear and real addresses appear)
    await waitFor(() => {
      expect(screen.getByText("Home")).toBeInTheDocument();
    });

    // Check that addresses are displayed as cards
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("123 Main St")).toBeInTheDocument();
    expect(screen.getByText("Office")).toBeInTheDocument();
    expect(screen.getByText("456 Oak Ave")).toBeInTheDocument();
  });

  it("calls onAddressSelected when address card is clicked", async () => {
    customRender(<AddressManager {...defaultProps} />);

    // Wait for addresses to load
    await waitFor(() => {
      expect(screen.getByText("Home")).toBeInTheDocument();
    });

    // Click on address card - find the card container by the address name
    const homeAddressCard = screen.getByText("Home").closest("div[class*='cursor-pointer']");
    expect(homeAddressCard).toBeInTheDocument();

    if (homeAddressCard) {
      await userEvent.click(homeAddressCard);
    }

    expect(mockOnAddressSelected).toHaveBeenCalledWith("1");
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

  it("handles API fetch errors properly", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    customRender(<AddressManager {...defaultProps} />);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        "Error fetching addresses: Internal Server Error",
      );
    });
  });

  it("filters addresses correctly based on filter type", async () => {
    customRender(<AddressManager {...defaultProps} defaultFilter="private" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/addresses?filter=private&page=1&limit=5",
        expect.any(Object),
      );
    });
  });

  // TODO: REA-259 - Test needs component behavior verification
  it.skip("resets fetch attempts when refresh is called manually", async () => {
    const capturedRefreshFunctions: Array<() => void> = [];

    const captureRefreshFunction = (fn: () => void) => {
      capturedRefreshFunctions.push(fn);
    };

    // First, simulate multiple failed attempts then success
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

  // TODO: REA-259 - Test needs component behavior verification
  it.skip("shows filter buttons for address types", async () => {
    customRender(<AddressManager {...defaultProps} />);

    // Wait for addresses to load
    await waitFor(() => {
      expect(screen.getByText("Home")).toBeInTheDocument();
    });

    // Check for filter buttons
    expect(screen.getByRole("button", { name: /All Addresses/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Your Addresses/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Shared Addresses/i })).toBeInTheDocument();

    // Check that both types of addresses are displayed
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Office")).toBeInTheDocument();
  });

  // TODO: REA-259 - Test needs component behavior verification
  it.skip("handles empty address list gracefully", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          addresses: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalCount: 0,
            hasNextPage: false,
            hasPrevPage: false,
            limit: 5,
          },
        }),
    });

    customRender(<AddressManager {...defaultProps} />);

    await waitFor(() => {
      expect(mockOnAddressesLoaded).toHaveBeenCalledWith([]);
    });
  });
});
